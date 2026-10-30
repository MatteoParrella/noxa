"""API interna del worker: solo `/salute` e `/pronto` (ARCHITECTURE.md §3.3).

Il worker non è raggiungibile da internet; questi endpoint servono ai controlli di
docker-compose e di un'eventuale istanza sempre accesa (ADR-0021). Nel ciclo di vita
dell'applicazione partono `CODA_CONCORRENZA` esecutori della coda, fermati in modo ordinato
all'arresto. In staging e produzione il worker gira invece a esaurimento (`esaurisci.py`).
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

import structlog
from fastapi import FastAPI, Response, status
from pydantic import BaseModel

from noxa_worker.coda import EsecutoreCoda, GestoreJob, TipoJob
from noxa_worker.coda_postgres import ArchivioJobPostgres
from noxa_worker.configurazione import Impostazioni, leggi_impostazioni
from noxa_worker.database import VerificaDatabase, crea_pool, verifica_con_pool
from noxa_worker.flyer.archivio import ArchivioFlyerPostgres
from noxa_worker.flyer.jobs import GestoreFlyer
from noxa_worker.flyer.storage import ClientStorage
from noxa_worker.fonti.http import ClientHttpConforme, StatoCondiviso, crea_client_httpx
from noxa_worker.fonti.registro import crea_registro
from noxa_worker.osservabilita import configura_log, configura_sentry
from noxa_worker.raccolta.pipeline import GestoreRaccolta
from noxa_worker.raccolta.postgres import ArchivioRaccoltaPostgres

log = structlog.get_logger(__name__)

# Tempo concesso agli esecutori per finire il job in corso all'arresto; poi il lease scade e
# un'altra istanza lo riprende.
ATTESA_ARRESTO_S = 20.0


@dataclass
class Risorse:
    """Verifica del database e esecutori della coda creati all'avvio."""

    verifica: VerificaDatabase
    esecutori: list[EsecutoreCoda] = field(default_factory=list)


class RispostaSalute(BaseModel):
    stato: Literal["ok"]


class RispostaPronto(BaseModel):
    stato: Literal["pronto", "non_pronto"]
    database: bool


def crea_app(
    impostazioni: Impostazioni | None = None,
    crea_risorse: Callable[[Impostazioni], AsyncIterator[Risorse]] | None = None,
) -> FastAPI:
    """Crea l'applicazione. `crea_risorse` sostituisce database ed esecutori nei test."""
    impostazioni_effettive = impostazioni or leggi_impostazioni()
    fabbrica = crea_risorse or risorse_postgres

    @asynccontextmanager
    async def ciclo_di_vita(app: FastAPI) -> AsyncIterator[None]:
        configura_log(impostazioni_effettive.log_formato, impostazioni_effettive.log_livello)
        configura_sentry(impostazioni_effettive)
        async for risorse in fabbrica(impostazioni_effettive):
            app.state.verifica_database = risorse.verifica
            arresto = asyncio.Event()
            compiti = [
                asyncio.create_task(esecutore.esegui(arresto), name=f"esecutore-{numero}")
                for numero, esecutore in enumerate(risorse.esecutori)
            ]
            log.info(
                "worker_avviato",
                ambiente=impostazioni_effettive.ambiente,
                esecutori=len(compiti),
            )
            try:
                yield
            finally:
                arresto.set()
                if compiti:
                    _, in_corso = await asyncio.wait(compiti, timeout=ATTESA_ARRESTO_S)
                    for compito in in_corso:
                        compito.cancel()
                    await asyncio.gather(*in_corso, return_exceptions=True)
        log.info("worker_arrestato")

    app = FastAPI(
        title="Noxa worker",
        lifespan=ciclo_di_vita,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @app.get("/salute")
    async def salute() -> RispostaSalute:
        """Liveness: il processo risponde."""
        return RispostaSalute(stato="ok")

    @app.get("/pronto")
    async def pronto(risposta: Response) -> RispostaPronto:
        """Readiness: il database è raggiungibile."""
        verifica: VerificaDatabase = app.state.verifica_database
        database = await verifica()
        if not database:
            risposta.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
            return RispostaPronto(stato="non_pronto", database=False)
        return RispostaPronto(stato="pronto", database=True)

    return app


async def risorse_postgres(impostazioni: Impostazioni) -> AsyncIterator[Risorse]:
    """Pool, client HTTP, gestori ed esecutori della coda, chiusi all'uscita."""
    # Due connessioni per esecutore (coda e raccolta) più una per i controlli di salute.
    pool = crea_pool(impostazioni.url_database(), 2 * impostazioni.coda_concorrenza + 1)
    # wait=False: il worker parte anche se il database non è ancora pronto; /pronto lo segnala.
    await pool.open(wait=False)
    stato_http = StatoCondiviso()
    async with crea_client_httpx(20.0) as client:

        def crea_http(pagine_massime: int) -> ClientHttpConforme:
            return ClientHttpConforme(
                client,
                stato_http,
                user_agent=impostazioni.scraper_user_agent,
                pagine_massime=min(pagine_massime, impostazioni.scraper_pagine_massime),
                intervallo_minimo_s=impostazioni.scraper_intervallo_minimo_s,
            )

        raccolta = GestoreRaccolta(
            ArchivioRaccoltaPostgres(pool),
            crea_registro(impostazioni),
            crea_http,
            adesso=lambda: datetime.now(UTC),
        )
        flyer = GestoreFlyer(
            ArchivioFlyerPostgres(pool),
            ClientStorage(
                impostazioni.supabase_url,
                impostazioni.supabase_service_role_key.get_secret_value(),
            ),
            anthropic_api_key=impostazioni.anthropic_api_key.get_secret_value(),
            modello=impostazioni.claude_modello_flyer,
            lato_max=impostazioni.flyer_lato_max_px,
            adesso=lambda: datetime.now(UTC),
        )
        gestori: dict[TipoJob, GestoreJob] = {
            TipoJob.ESEGUI_FONTE: raccolta.esegui_fonte,
            TipoJob.DEDUPLICA_GREZZO: raccolta.applica_decisione,
            TipoJob.ANALIZZA_FLYER: flyer.analizza_flyer,
            TipoJob.COPIA_IMMAGINE_FLYER: flyer.copia_immagine_flyer,
            TipoJob.PULIZIA_FLYER: flyer.pulizia_flyer,
        }
        archivio_job = ArchivioJobPostgres(pool)
        esecutori = [
            EsecutoreCoda(archivio_job, gestori, adesso=lambda: datetime.now(UTC))
            for _ in range(impostazioni.coda_concorrenza)
        ]
        try:
            yield Risorse(verifica_con_pool(pool, impostazioni.timeout_database_s), esecutori)
        finally:
            await pool.close()


def __getattr__(nome: str) -> FastAPI:
    # `uvicorn noxa_worker.api:app` crea l'applicazione solo quando viene richiesta, così
    # importare il modulo nei test non legge le variabili d'ambiente.
    if nome == "app":
        return crea_app()
    raise AttributeError(nome)
