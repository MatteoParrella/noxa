"""API interna del worker: solo `/salute` e `/pronto` (ARCHITECTURE.md §3.3).

Il worker non è raggiungibile da internet; questi endpoint servono ai controlli di Fly.io e
di docker-compose.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Literal

import structlog
from fastapi import FastAPI, Response, status
from pydantic import BaseModel

from noxa_worker.configurazione import Impostazioni, leggi_impostazioni
from noxa_worker.database import VerificaDatabase, crea_pool, verifica_con_pool
from noxa_worker.osservabilita import configura_log

log = structlog.get_logger(__name__)


class RispostaSalute(BaseModel):
    stato: Literal["ok"]


class RispostaPronto(BaseModel):
    stato: Literal["pronto", "non_pronto"]
    database: bool


def crea_app(
    impostazioni: Impostazioni | None = None,
    crea_verifica: Callable[[Impostazioni], AsyncIterator[VerificaDatabase]] | None = None,
) -> FastAPI:
    """Crea l'applicazione. `crea_verifica` sostituisce l'accesso al database nei test."""
    impostazioni_effettive = impostazioni or leggi_impostazioni()
    fabbrica_verifica = crea_verifica or _verifica_postgres

    @asynccontextmanager
    async def ciclo_di_vita(app: FastAPI) -> AsyncIterator[None]:
        configura_log(impostazioni_effettive.log_formato, impostazioni_effettive.log_livello)
        async for verifica in fabbrica_verifica(impostazioni_effettive):
            app.state.verifica_database = verifica
            log.info("worker_avviato", ambiente=impostazioni_effettive.ambiente)
            yield
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


async def _verifica_postgres(impostazioni: Impostazioni) -> AsyncIterator[VerificaDatabase]:
    # Una connessione per esecutore della coda più una per i controlli di salute.
    pool = crea_pool(impostazioni.url_database(), impostazioni.coda_concorrenza + 1)
    # wait=False: il worker parte anche se il database non è ancora pronto; /pronto lo segnala.
    await pool.open(wait=False)
    try:
        yield verifica_con_pool(pool, impostazioni.timeout_database_s)
    finally:
        await pool.close()


def __getattr__(nome: str) -> FastAPI:
    # `uvicorn noxa_worker.api:app` crea l'applicazione solo quando viene richiesta, così
    # importare il modulo nei test non legge le variabili d'ambiente.
    if nome == "app":
        return crea_app()
    raise AttributeError(nome)
