"""Modalità a esaurimento del worker (ADR-0021): `python -m noxa_worker.esaurisci`.

Il workflow `worker.yml` di GitHub Actions avvia questo comando ogni 15 minuti. Gli
esecutori prelevano i job pronti da `coda_job` finché la coda è vuota o finché non passa la
durata massima, poi il processo termina. `pg_cron` resta l'unico scheduler: qui non si
pianifica nulla, si consuma soltanto la coda (ADR-0003).
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import time
from collections.abc import Awaitable, Callable, Sequence

import structlog

from noxa_worker.api import risorse_postgres
from noxa_worker.configurazione import Impostazioni, leggi_impostazioni
from noxa_worker.database import VerificaDatabase
from noxa_worker.osservabilita import configura_log, configura_sentry

log = structlog.get_logger(__name__)

DURATA_MASSIMA_S = 600.0

# Attese tra un tentativo e l'altro di raggiungere il database all'avvio. Il pool si apre senza
# aspettare la prima connessione e, dal runner di GitHub al pooler di Supabase nell'UE, TCP,
# TLS e autenticazione superano a volte il timeout della verifica: un errore transitorio non
# deve far perdere l'esecuzione. Al massimo ~13 s di attesa più i timeout delle verifiche.
ATTESE_DATABASE_S: tuple[float, ...] = (1.0, 3.0, 9.0)


async def attendi_database(
    verifica: VerificaDatabase,
    attese_s: Sequence[float] = ATTESE_DATABASE_S,
    dormi: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> bool:
    """Verifica il database e, se non risponde, riprova dopo ciascuna attesa."""
    tentativi = len(attese_s) + 1
    for tentativo in range(1, tentativi + 1):
        if await verifica():
            if tentativo > 1:
                log.info("database_raggiunto", tentativo=tentativo)
            return True
        if tentativo < tentativi:
            attesa = attese_s[tentativo - 1]
            log.warning("database_nuovo_tentativo", tentativo=tentativo, attesa_s=attesa)
            await dormi(attesa)
    return False


async def esaurisci(impostazioni: Impostazioni, durata_massima_s: float) -> int:
    """Esegue i job pronti con tutti gli esecutori; restituisce quanti ne ha eseguiti."""
    scadenza = time.monotonic() + durata_massima_s
    totale = 0
    async for risorse in risorse_postgres(impostazioni):
        if not await attendi_database(risorse.verifica):
            log.error("database_non_raggiungibile", tentativi=len(ATTESE_DATABASE_S) + 1)
            raise SystemExit(1)
        risultati = await asyncio.gather(
            *(esecutore.esegui_fino_a_esaurimento(scadenza) for esecutore in risorse.esecutori)
        )
        totale = sum(risultati)
    return totale


def principale(argomenti: list[str] | None = None) -> int:
    lettore = argparse.ArgumentParser(description=__doc__)
    lettore.add_argument(
        "--durata-massima",
        type=float,
        default=DURATA_MASSIMA_S,
        help="secondi dopo i quali non si prelevano altri job (predefinito 600)",
    )
    opzioni = lettore.parse_args(argomenti)
    impostazioni = leggi_impostazioni()
    configura_log(impostazioni.log_formato, impostazioni.log_livello)
    configura_sentry(impostazioni)
    inizio = time.monotonic()
    eseguiti = asyncio.run(esaurisci(impostazioni, opzioni.durata_massima))
    log.info(
        "esaurimento_completato",
        ambiente=impostazioni.ambiente,
        job=eseguiti,
        durata_s=round(time.monotonic() - inizio, 1),
    )
    return 0


if __name__ == "__main__":
    sys.exit(principale())
