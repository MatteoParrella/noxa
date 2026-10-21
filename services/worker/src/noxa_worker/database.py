"""Accesso a Postgres con il ruolo `noxa_worker` (ADR-0003)."""

from __future__ import annotations

import asyncio
from typing import Protocol

import psycopg
import structlog
from psycopg import AsyncConnection
from psycopg.rows import DictRow, dict_row
from psycopg_pool import AsyncConnectionPool

log = structlog.get_logger(__name__)


class VerificaDatabase(Protocol):
    """Controllo di raggiungibilità usato da `/pronto`."""

    async def __call__(self) -> bool: ...


PoolDatabase = AsyncConnectionPool[AsyncConnection[DictRow]]


def crea_pool(url: str, dimensione_massima: int) -> PoolDatabase:
    """Pool di connessioni non ancora aperto: si apre nel lifespan dell'API. Le righe sono
    dizionari con i nomi delle colonne."""
    return AsyncConnectionPool(
        conninfo=url,
        connection_class=AsyncConnection[DictRow],
        min_size=1,
        max_size=dimensione_massima,
        open=False,
        timeout=10.0,
        kwargs={
            "application_name": "noxa_worker",
            "connect_timeout": 5,
            "row_factory": dict_row,
        },
    )


def verifica_con_pool(pool: PoolDatabase, timeout_s: float) -> VerificaDatabase:
    """Restituisce una verifica che esegue `select 1` entro `timeout_s` secondi."""

    async def verifica() -> bool:
        try:
            async with asyncio.timeout(timeout_s):
                async with pool.connection() as connessione:
                    await connessione.execute("select 1")
        except (TimeoutError, psycopg.Error) as errore:
            log.warning("database_non_raggiungibile", errore=type(errore).__name__)
            return False
        return True

    return verifica
