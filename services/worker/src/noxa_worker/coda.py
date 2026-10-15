"""Esecuzione dei job della coda su Postgres (ADR-0003, ARCHITECTURE.md §3.3).

Il worker non pianifica nulla: i job sono inseriti in `coda_job` da `pg_cron`, dai trigger e
dalle RPC. Questo modulo li preleva con un lease, li passa al gestore del loro tipo e ne
registra l'esito:

- successo → `completato`;
- `ErroreJobDefinitivo` → `fallito` subito, senza altri tentativi;
- qualsiasi altro errore o un timeout → nuovo tentativo con backoff esponenziale, fino a
  `MASSIMO_TENTATIVI`, poi `fallito`.

L'accesso alla tabella è dietro il protocollo `ArchivioJob`, così la logica è verificabile
senza database e la coda può essere spostata su un altro sistema senza toccare i gestori.
"""

from __future__ import annotations

import asyncio
import random
import time
from collections.abc import Awaitable, Callable, Mapping
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Protocol

import structlog
from pydantic import BaseModel, ConfigDict, Field, JsonValue

log = structlog.get_logger(__name__)

MASSIMO_TENTATIVI = 5
DURATA_LEASE = timedelta(minutes=10)
BACKOFF_BASE = timedelta(seconds=30)
BACKOFF_MASSIMO = timedelta(hours=1)
# Variazione casuale del backoff (±10%) per non far ripartire insieme i job falliti insieme.
VARIAZIONE_BACKOFF = 0.1


class TipoJob(StrEnum):
    """Valori dell'enum `tipo_job` (DATA_MODEL.md §3)."""

    ESEGUI_FONTE = "esegui_fonte"
    ANALIZZA_FLYER = "analizza_flyer"
    DEDUPLICA_GREZZO = "deduplica_grezzo"
    COPIA_IMMAGINE_FLYER = "copia_immagine_flyer"
    PULIZIA_FLYER = "pulizia_flyer"


class Job(BaseModel):
    """Job prelevato dalla coda, con il lease già acquisito."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: int
    tipo: TipoJob
    payload: dict[str, JsonValue]
    # Tentativi già falliti prima di questo.
    tentativi: int = Field(ge=0, lt=MASSIMO_TENTATIVI)
    chiave_idempotenza: str
    chiave_concorrenza: str | None = None


class ErroreJobDefinitivo(Exception):
    """Errore non recuperabile: il job fallisce senza altri tentativi (ARCHITECTURE.md §5.2)."""


class ArchivioJob(Protocol):
    """Operazioni sulla tabella `coda_job` usate dall'esecutore."""

    async def preleva(self, tipi: frozenset[TipoJob], durata_lease: timedelta) -> Job | None:
        """Preleva il prossimo job eseguibile (`for update skip locked`) e ne acquisisce il
        lease; recupera anche i job con lease scaduto. `None` se non c'è nulla da fare."""
        ...

    async def completa(self, job_id: int) -> None:
        """Segna il job come `completato`."""
        ...

    async def rinvia(self, job_id: int, esegui_dopo: datetime, errore: str) -> None:
        """Rimette il job `in_coda`, incrementa i tentativi e rilascia il lease."""
        ...

    async def fallisci(self, job_id: int, errore: str) -> None:
        """Segna il job come `fallito` e rilascia il lease."""
        ...


GestoreJob = Callable[[Job], Awaitable[None]]


def calcola_backoff(
    tentativi_falliti: int, casuale: Callable[[], float] = random.random
) -> timedelta:
    """Attesa prima del prossimo tentativo: 30 s, 60 s, 120 s… fino a un'ora, ±10%."""
    if tentativi_falliti < 1:
        raise ValueError("tentativi_falliti deve essere almeno 1")
    base = min(BACKOFF_BASE * (1 << (tentativi_falliti - 1)), BACKOFF_MASSIMO)
    fattore = 1 + VARIAZIONE_BACKOFF * (2 * casuale() - 1)
    return base * fattore


def descrivi_errore(errore: BaseException) -> str:
    """Testo dell'errore salvato in `coda_job.errore`: tipo e messaggio, al massimo 500
    caratteri. I gestori non mettono dati personali nei messaggi delle eccezioni."""
    messaggio = str(errore).strip()
    testo = f"{type(errore).__name__}: {messaggio}" if messaggio else type(errore).__name__
    return testo[:500]


class EsecutoreCoda:
    """Preleva ed esegue i job dei tipi per cui ha un gestore."""

    def __init__(
        self,
        archivio: ArchivioJob,
        gestori: Mapping[TipoJob, GestoreJob],
        *,
        timeout_job: timedelta = timedelta(minutes=8),
        attesa_coda_vuota: timedelta = timedelta(seconds=5),
        adesso: Callable[[], datetime],
        casuale: Callable[[], float] = random.random,
    ) -> None:
        if not gestori:
            raise ValueError("serve almeno un gestore")
        # Il job deve finire prima che scada il lease, altrimenti un'altra istanza lo
        # riprenderebbe mentre è ancora in esecuzione.
        if timeout_job >= DURATA_LEASE:
            raise ValueError("timeout_job deve essere inferiore alla durata del lease")
        self._archivio = archivio
        self._gestori = dict(gestori)
        self._tipi = frozenset(gestori)
        self._timeout_job = timeout_job
        self._attesa_coda_vuota = attesa_coda_vuota
        self._adesso = adesso
        self._casuale = casuale

    async def esegui_uno(self) -> bool:
        """Esegue al massimo un job. Restituisce `False` se la coda era vuota."""
        job = await self._archivio.preleva(self._tipi, DURATA_LEASE)
        if job is None:
            return False

        contesto = log.bind(job_id=job.id, tipo=job.tipo.value, tentativo=job.tentativi + 1)
        gestore = self._gestori[job.tipo]
        inizio = time.monotonic()
        try:
            async with asyncio.timeout(self._timeout_job.total_seconds()):
                await gestore(job)
        except ErroreJobDefinitivo as errore:
            await self._archivio.fallisci(job.id, descrivi_errore(errore))
            contesto.warning("job_fallito", esito="definitivo", durata_s=_durata(inizio))
        except asyncio.CancelledError:
            # Arresto del worker: il lease scade e un'altra istanza riprende il job.
            contesto.info("job_interrotto", durata_s=_durata(inizio))
            raise
        except Exception as errore:  # noqa: BLE001 - qualsiasi errore del gestore va registrato
            await self._registra_errore_temporaneo(job, errore, contesto, inizio)
        else:
            await self._archivio.completa(job.id)
            contesto.info("job_completato", durata_s=_durata(inizio))
        return True

    async def esegui(self, arresto: asyncio.Event) -> None:
        """Ciclo dell'esecutore fino all'evento di arresto."""
        while not arresto.is_set():
            try:
                eseguito = await self.esegui_uno()
            except Exception:
                # Un errore dell'archivio (database non raggiungibile) non ferma il ciclo.
                log.exception("errore_coda")
                eseguito = False
            if not eseguito:
                try:
                    async with asyncio.timeout(self._attesa_coda_vuota.total_seconds()):
                        await arresto.wait()
                except TimeoutError:
                    pass

    async def _registra_errore_temporaneo(
        self,
        job: Job,
        errore: Exception,
        contesto: structlog.stdlib.BoundLogger,
        inizio: float,
    ) -> None:
        descrizione = (
            "Timeout del job" if isinstance(errore, TimeoutError) else descrivi_errore(errore)
        )
        tentativi_falliti = job.tentativi + 1
        if tentativi_falliti >= MASSIMO_TENTATIVI:
            await self._archivio.fallisci(job.id, descrizione)
            contesto.error(
                "job_fallito",
                esito="tentativi_esauriti",
                errore=type(errore).__name__,
                durata_s=_durata(inizio),
            )
            return
        attesa = calcola_backoff(tentativi_falliti, self._casuale)
        await self._archivio.rinvia(job.id, self._adesso() + attesa, descrizione)
        contesto.warning(
            "job_rinviato",
            errore=type(errore).__name__,
            attesa_s=round(attesa.total_seconds()),
            durata_s=_durata(inizio),
        )


def _durata(inizio: float) -> float:
    return round(time.monotonic() - inizio, 3)
