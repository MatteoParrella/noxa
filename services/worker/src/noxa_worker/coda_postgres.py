"""`ArchivioJob` sulla tabella `coda_job` (ADR-0003, DATA_MODEL.md §5.7).

Il prelievo usa `for update skip locked`, così più esecutori e più istanze non prendono lo
stesso job; recupera i job con il lease scaduto (istanza fermata a metà lavoro) e salta quelli
del dominio già in esecuzione. L'indice unico `coda_job_concorrenza_idx` garantisce comunque
un solo job in esecuzione per dominio: se due esecutori ci provano insieme, il secondo
rinuncia e riprova al giro successivo.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import psycopg
import structlog

from noxa_worker.coda import Job, TipoJob
from noxa_worker.database import PoolDatabase

log = structlog.get_logger(__name__)

_PRELIEVO = """
update public.coda_job j
set stato = 'in_esecuzione', bloccato_fino = now() + %(lease)s
where j.id = (
  select c.id from public.coda_job c
  where c.tipo = any(%(tipi)s::public.tipo_job[])
    and c.esegui_dopo <= now()
    and (c.stato = 'in_coda' or (c.stato = 'in_esecuzione' and c.bloccato_fino < now()))
    and (c.chiave_concorrenza is null or not exists (
          select 1 from public.coda_job a
          where a.chiave_concorrenza = c.chiave_concorrenza and a.id <> c.id
            and a.stato = 'in_esecuzione' and a.bloccato_fino >= now()))
  order by c.esegui_dopo, c.id
  limit 1
  for update skip locked
)
returning j.id, j.tipo::text as tipo, j.payload, j.tentativi, j.chiave_idempotenza,
          j.chiave_concorrenza
"""


class ArchivioJobPostgres:
    def __init__(self, pool: PoolDatabase) -> None:
        self._pool = pool

    async def preleva(self, tipi: frozenset[TipoJob], durata_lease: timedelta) -> Job | None:
        try:
            async with self._pool.connection() as c:
                cursore = await c.execute(
                    _PRELIEVO, {"lease": durata_lease, "tipi": [t.value for t in tipi]}
                )
                riga = await cursore.fetchone()
        except psycopg.errors.UniqueViolation:
            # Un altro esecutore ha preso nello stesso istante un job dello stesso dominio.
            log.debug("prelievo_concorrente")
            return None
        if riga is None:
            return None
        return Job(
            id=riga["id"],
            tipo=TipoJob(riga["tipo"]),
            payload=riga["payload"],
            tentativi=riga["tentativi"],
            chiave_idempotenza=riga["chiave_idempotenza"],
            chiave_concorrenza=riga["chiave_concorrenza"],
        )

    async def completa(self, job_id: int) -> None:
        async with self._pool.connection() as c:
            await c.execute(
                """update public.coda_job
                   set stato = 'completato', completato_il = now(), bloccato_fino = null,
                       errore = null
                   where id = %s""",
                (job_id,),
            )

    async def rinvia(self, job_id: int, esegui_dopo: datetime, errore: str) -> None:
        async with self._pool.connection() as c:
            await c.execute(
                """update public.coda_job
                   set stato = 'in_coda', tentativi = tentativi + 1, esegui_dopo = %s,
                       bloccato_fino = null, errore = %s
                   where id = %s""",
                (esegui_dopo, errore[:500], job_id),
            )

    async def fallisci(self, job_id: int, errore: str) -> None:
        async with self._pool.connection() as c:
            await c.execute(
                """update public.coda_job
                   set stato = 'fallito', tentativi = least(tentativi + 1, 5),
                       completato_il = now(), bloccato_fino = null, errore = %s
                   where id = %s""",
                (errore[:500], job_id),
            )
