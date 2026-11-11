"""Archivio dei colori delle copertine su Postgres, con il ruolo `noxa_worker`."""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from psycopg.types.json import Jsonb
from pydantic import JsonValue

from noxa_worker.copertine.servizio import EventoColori
from noxa_worker.database import PoolDatabase


class ArchivioColoriPostgres:
    def __init__(self, pool: PoolDatabase) -> None:
        self._pool = pool

    async def eventi_futuri(self, locale_id: UUID) -> list[EventoColori]:
        async with self._pool.connection() as c:
            cursore = await c.execute(
                """select id, titolo, copertina_colori
                   from public.eventi
                   where locale_id = %s
                     and stato in ('pubblicato', 'in_revisione')
                     and coalesce(fine, inizio + interval '6 hours') > now()""",
                (locale_id,),
            )
            righe = await cursore.fetchall()
        return [
            EventoColori(id=r["id"], titolo=r["titolo"], colori=r["copertina_colori"])
            for r in righe
        ]

    async def imposta_colori(self, eventi: Sequence[UUID], colori: dict[str, JsonValue]) -> None:
        async with self._pool.connection() as c, c.transaction():
            await c.execute(
                "update public.eventi set copertina_colori = %s where id = any(%s)",
                (Jsonb(colori), list(eventi)),
            )
