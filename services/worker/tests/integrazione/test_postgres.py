"""Coda e pipeline sul database locale di Supabase, con il ruolo `noxa_worker` (ADR-0003).

Richiedono `supabase start` (o `supabase db start`) e le variabili:
- `NOXA_TEST_DATABASE_URL`: connessione come `noxa_worker` (password del seed);
- `NOXA_TEST_DATABASE_URL_ADMIN`: connessione come `postgres`, per preparare e pulire i dati.
Senza le variabili i test sono saltati; in CI girano nel job del database.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest

from noxa_worker.coda import TipoJob
from noxa_worker.coda_postgres import ArchivioJobPostgres
from noxa_worker.database import PoolDatabase, crea_pool
from noxa_worker.fonti.base import EventoGrezzo
from noxa_worker.raccolta.pipeline import GestoreRaccolta
from noxa_worker.raccolta.postgres import ArchivioRaccoltaPostgres
from tests.supporto import SitoFinto, client_conforme
from tests.unit.raccolta.test_pipeline import AdattatoreFinto, _job

URL = os.environ.get("NOXA_TEST_DATABASE_URL")
URL_ADMIN = os.environ.get("NOXA_TEST_DATABASE_URL_ADMIN")
pytestmark = pytest.mark.skipif(
    not URL or not URL_ADMIN, reason="servono NOXA_TEST_DATABASE_URL e NOXA_TEST_DATABASE_URL_ADMIN"
)

FONTE_ID = UUID("00000000-0000-4000-8000-00000000f0f1")
LOCALE_ID = UUID("00000000-0000-4000-8000-00000000c001")


async def _admin(query: str, *parametri: object) -> None:
    assert URL_ADMIN is not None
    async with await psycopg.AsyncConnection.connect(URL_ADMIN, autocommit=True) as c:
        await c.execute(query, parametri)


async def _pulisci() -> None:
    await _admin(
        "delete from public.coda_job where chiave_idempotenza like 'prova-integrazione:%%'"
    )
    await _admin(
        """delete from public.eventi where id in (
             select evento_id from public.eventi_fonti where fonte_id = %s)""",
        FONTE_ID,
    )
    await _admin("delete from public.fonti where id = %s", FONTE_ID)


@pytest.fixture
async def pool() -> AsyncIterator[PoolDatabase]:
    assert URL is not None
    await _pulisci()
    await _admin(
        """insert into public.fonti (id, locale_id, tipo, url, adattatore, stato_conformita,
                                     robots_esito, termini_url, termini_letti_il, attiva,
                                     ultima_esecuzione_il)
           values (%s, %s, 'sito_locale', 'https://binario7.example/agenda', 'finto',
                   'consentita', 'consentito', 'https://binario7.example/t', current_date, true,
                   now())""",
        FONTE_ID,
        LOCALE_ID,
    )
    risorsa = crea_pool(URL, 4)
    await risorsa.open()
    try:
        yield risorsa
    finally:
        await risorsa.close()
        await _pulisci()


async def _accoda(chiave: str, concorrenza: str | None = None) -> None:
    await _admin(
        """insert into public.coda_job (tipo, payload, chiave_idempotenza, chiave_concorrenza)
           values ('esegui_fonte', '{}', %s, %s)""",
        f"prova-integrazione:{chiave}",
        concorrenza,
    )


async def test_prelievo_con_lease_e_un_job_per_dominio(pool: PoolDatabase) -> None:
    await _accoda("a", "dominio:prova.example")
    await _accoda("b", "dominio:prova.example")
    await _accoda("c", "dominio:altro.example")
    archivio = ArchivioJobPostgres(pool)
    tipi = frozenset({TipoJob.ESEGUI_FONTE})
    primo = await archivio.preleva(tipi, timedelta(minutes=10))
    secondo = await archivio.preleva(tipi, timedelta(minutes=10))
    terzo = await archivio.preleva(tipi, timedelta(minutes=10))
    assert primo is not None
    assert secondo is not None
    chiavi = {primo.chiave_idempotenza, secondo.chiave_idempotenza}
    # Il secondo job dello stesso dominio aspetta che il primo finisca.
    assert chiavi == {"prova-integrazione:a", "prova-integrazione:c"}
    assert terzo is None
    await archivio.completa(primo.id)
    successivo = await archivio.preleva(tipi, timedelta(minutes=10))
    assert successivo is not None
    assert successivo.chiave_idempotenza == "prova-integrazione:b"
    await archivio.rinvia(successivo.id, datetime.now(UTC) + timedelta(hours=1), "Errore: prova")
    await archivio.fallisci(secondo.id, "Errore: definitivo")
    assert await archivio.preleva(tipi, timedelta(minutes=10)) is None


async def test_lease_scaduto_recuperato(pool: PoolDatabase) -> None:
    await _accoda("lease")
    archivio = ArchivioJobPostgres(pool)
    tipi = frozenset({TipoJob.ESEGUI_FONTE})
    preso = await archivio.preleva(tipi, timedelta(seconds=-1))
    assert preso is not None
    ripreso = await archivio.preleva(tipi, timedelta(minutes=10))
    assert ripreso is not None
    assert ripreso.id == preso.id


async def test_pipeline_scrive_eventi_fonti_ed_esito(pool: PoolDatabase) -> None:
    inizio = (datetime.now(UTC) + timedelta(days=5)).replace(hour=21, minute=0, microsecond=0)
    adattatore = AdattatoreFinto(
        [
            EventoGrezzo(
                url="https://binario7.example/eventi/integrazione",
                id_esterno=f"integrazione-{uuid4()}",
                dati={
                    "titolo": "Serata di integrazione",
                    "inizio": inizio.isoformat(),
                    "ha_ora": True,
                    "descrizione": "Ingresso 16+, techno.",
                },
            )
        ]
    )
    sito = SitoFinto()
    sito.aggiungi("https://binario7.example/agenda", "<html></html>")
    gestore = GestoreRaccolta(
        ArchivioRaccoltaPostgres(pool),
        {"finto": adattatore},
        lambda pagine: client_conforme(sito, pagine_massime=pagine),
        adesso=lambda: datetime.now(UTC),
    )
    job = _job()
    job = job.model_copy(update={"payload": {"fonte_id": str(FONTE_ID), "prova": False}})
    await gestore.esegui_fonte(job)
    await gestore.esegui_fonte(job)

    async with pool.connection() as c:
        cursore = await c.execute(
            """select e.titolo, e.stato::text as stato, e.eta_minima, e.eta_minima_dichiarata,
                      (select array_agg(genere_codice) from public.eventi_generi g
                       where g.evento_id = e.id) as generi,
                      ef.url_originale
               from public.eventi e join public.eventi_fonti ef on ef.evento_id = e.id
               where ef.fonte_id = %s""",
            (FONTE_ID,),
        )
        eventi = await cursore.fetchall()
        cursore = await c.execute(
            """select eventi_nuovi, pagine_lette from public.esecuzioni_fonte
               where fonte_id = %s order by id""",
            (FONTE_ID,),
        )
        esecuzioni = await cursore.fetchall()
        cursore = await c.execute(
            "select errori_consecutivi, ultimo_esito from public.fonti where id = %s", (FONTE_ID,)
        )
        fonte = await cursore.fetchone()
    assert len(eventi) == 1
    assert eventi[0]["titolo"] == "Serata di integrazione"
    assert eventi[0]["stato"] == "pubblicato"
    assert (eventi[0]["eta_minima"], eventi[0]["eta_minima_dichiarata"]) == (16, True)
    assert eventi[0]["generi"] == ["techno"]
    assert eventi[0]["url_originale"] == "https://binario7.example/eventi/integrazione"
    assert [e["eventi_nuovi"] for e in esecuzioni] == [1, 0]
    assert fonte is not None
    assert fonte["errori_consecutivi"] == 0
    assert fonte["ultimo_esito"]["eventi_invariati"] == 1


async def test_il_worker_non_abbassa_l_eta(pool: PoolDatabase) -> None:
    async with pool.connection() as c:
        with pytest.raises(psycopg.Error, match="abbassa solo un moderatore"):
            await c.execute(
                "update public.eventi set eta_minima = 14 where id = %s",
                (UUID("00000000-0000-4000-8000-00000000e001"),),
            )
