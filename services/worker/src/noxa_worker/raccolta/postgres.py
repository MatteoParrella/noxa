"""`ArchivioRaccolta` su Postgres con il ruolo `noxa_worker` (ADR-0003): solo le tabelle e le
colonne concesse dalla migrazione della raccolta; il trigger `private.proteggi_eta_evento`
vieta comunque di abbassare un'età dichiarata o togliere l'alcol (R-22)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import date
from typing import Any, cast
from uuid import UUID

from psycopg import AsyncConnection, sql
from psycopg.rows import DictRow
from psycopg.types.json import Jsonb
from pydantic import JsonValue

from noxa_worker.database import PoolDatabase
from noxa_worker.dedup.fusione import EventoEsistente
from noxa_worker.fonti.base import Fonte, TipoFonte
from noxa_worker.normalizzazione.modelli import EventoNormalizzato
from noxa_worker.raccolta.archivio import (
    EsitoEsecuzione,
    FonteDaEseguire,
    GrezzoDeciso,
    StatoGrezzo,
)

_EVENTO = sql.SQL("""
select e.id, e.locale_id, e.titolo, e.descrizione, e.inizio, e.fine, e.eta_minima,
       e.eta_minima_dichiarata, e.riferimenti_alcol,
       coalesce((select array_agg(g.genere_codice order by g.genere_codice)
                 from public.eventi_generi g where g.evento_id = e.id), '{}') as generi,
       e.artisti, e.prezzo_min_centesimi, e.url_biglietti, e.stato::text as stato,
       coalesce((select max(case ef.tipo_origine when 'sito_locale' then 4
                                                 when 'instagram' then 3
                                                 when 'flyer' then 1 else 2 end)
                 from public.eventi_fonti ef where ef.evento_id = e.id), 0) as priorita_migliore
from public.eventi e
""")

# Colonne di `eventi` che la fusione può cambiare (EVENT_INGESTION.md §7).
_COLONNE_FUSIONE = frozenset(
    {
        "locale_id",
        "titolo",
        "descrizione",
        "inizio",
        "fine",
        "eta_minima",
        "eta_minima_dichiarata",
        "riferimenti_alcol",
        "artisti",
        "prezzo_min_centesimi",
        "url_biglietti",
    }
)


def _evento(riga: dict[str, Any]) -> EventoEsistente:
    return EventoEsistente(
        id=riga["id"],
        locale_id=riga["locale_id"],
        titolo=riga["titolo"],
        descrizione=riga["descrizione"],
        inizio=riga["inizio"],
        fine=riga["fine"],
        eta_minima=riga["eta_minima"],
        eta_minima_dichiarata=riga["eta_minima_dichiarata"],
        riferimenti_alcol=riga["riferimenti_alcol"],
        generi=tuple(riga["generi"]),
        artisti=tuple(riga["artisti"]),
        prezzo_min_centesimi=riga["prezzo_min_centesimi"],
        url_biglietti=riga["url_biglietti"],
        stato=riga["stato"],
        priorita_migliore=riga["priorita_migliore"],
    )


class TransazionePostgres:
    def __init__(self, connessione: AsyncConnection[DictRow]) -> None:
        self._c = connessione

    async def grezzo_esistente(
        self, fonte_id: UUID, hash_contenuto: str
    ) -> tuple[bool, UUID | None]:
        cursore = await self._c.execute(
            """select evento_id from public.eventi_grezzi
               where fonte_id = %s and hash_contenuto = %s""",
            (fonte_id, hash_contenuto),
        )
        riga = await cursore.fetchone()
        return (riga is not None, riga["evento_id"] if riga else None)

    async def inserisci_grezzo(
        self,
        *,
        fonte_id: UUID,
        payload: dict[str, JsonValue],
        hash_contenuto: str,
        stato: StatoGrezzo,
        evento_id: UUID | None = None,
        errore: str | None = None,
    ) -> UUID:
        cursore = await self._c.execute(
            """insert into public.eventi_grezzi (fonte_id, payload, hash_contenuto, stato,
                                                 evento_id, errore)
               values (%s, %s, %s, %s, %s, %s) returning id""",
            (fonte_id, Jsonb(payload), hash_contenuto, stato, evento_id, errore),
        )
        riga = await cursore.fetchone()
        assert riga is not None  # noqa: S101 - insert … returning restituisce sempre una riga
        return cast(UUID, riga["id"])

    async def aggiorna_grezzo(
        self,
        grezzo_id: UUID,
        *,
        stato: StatoGrezzo,
        evento_id: UUID | None = None,
        errore: str | None = None,
    ) -> None:
        await self._c.execute(
            """update public.eventi_grezzi
               set stato = %s, evento_id = coalesce(%s, evento_id), errore = %s
               where id = %s""",
            (stato, evento_id, errore, grezzo_id),
        )

    async def segna_revisione(
        self,
        grezzo_id: UUID,
        evento_candidato_id: UUID | None,
        punteggio: float | None,
        nota: str | None,
    ) -> None:
        await self._c.execute(
            """update public.eventi_grezzi
               set stato = 'in_revisione_dedup', evento_candidato_id = %s, punteggio_dedup = %s,
                   nota_revisione = left(coalesce(%s, 'Possibile duplicato'), 200)
               where id = %s""",
            (evento_candidato_id, punteggio, nota, grezzo_id),
        )

    async def evento_per_riferimento(
        self, fonte_id: UUID, id_esterno: str | None
    ) -> EventoEsistente | None:
        if id_esterno is None:
            return None
        cursore = await self._c.execute(
            _EVENTO
            + sql.SQL("""where e.id = (select ef.evento_id from public.eventi_fonti ef
                                       where ef.fonte_id = %s and ef.id_esterno = %s
                                       order by ef.raccolto_il desc limit 1)"""),
            (fonte_id, id_esterno),
        )
        riga = await cursore.fetchone()
        return _evento(riga) if riga else None

    async def carica_evento(self, evento_id: UUID) -> EventoEsistente | None:
        cursore = await self._c.execute(_EVENTO + sql.SQL("where e.id = %s"), (evento_id,))
        riga = await cursore.fetchone()
        return _evento(riga) if riga else None

    async def eventi_del_blocco(self, locale_id: UUID, data_serata: date) -> list[EventoEsistente]:
        cursore = await self._c.execute(
            _EVENTO
            + sql.SQL("""where e.locale_id = %s and e.data_serata = %s
                           and e.stato in ('pubblicato', 'in_revisione')
                         order by e.inizio, e.id"""),
            (locale_id, data_serata),
        )
        return [_evento(riga) for riga in await cursore.fetchall()]

    async def crea_evento(self, evento: EventoNormalizzato, stato: str) -> UUID:
        if evento.locale.id is None:
            raise ValueError("evento senza locale risolto")
        cursore = await self._c.execute(
            """insert into public.eventi
                 (locale_id, titolo, descrizione, inizio, fine, eta_minima, eta_minima_dichiarata,
                  riferimenti_alcol, artisti, prezzo_min_centesimi, url_biglietti, stato)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               returning id""",
            (
                evento.locale.id,
                evento.titolo,
                evento.descrizione,
                evento.inizio,
                evento.fine,
                evento.eta_minima if evento.eta_minima is not None else 18,
                evento.eta_minima is not None,
                evento.riferimenti_alcol,
                list(evento.artisti),
                evento.prezzo_min_centesimi,
                evento.url_biglietti,
                stato,
            ),
        )
        riga = await cursore.fetchone()
        assert riga is not None  # noqa: S101 - insert … returning restituisce sempre una riga
        evento_id = cast(UUID, riga["id"])
        await self._scrivi_generi(evento_id, evento.generi)
        return evento_id

    async def aggiorna_evento(
        self, evento_id: UUID, modifiche: dict[str, object], generi: tuple[str, ...] | None
    ) -> None:
        colonne = [c for c in modifiche if c in _COLONNE_FUSIONE]
        assegnazioni: list[sql.Composable] = [
            sql.SQL("{} = %s").format(sql.Identifier(colonna)) for colonna in colonne
        ]
        assegnazioni.append(sql.SQL("ultima_verifica_il = now()"))
        valori = [list(v) if isinstance(v := modifiche[c], tuple) else v for c in colonne]
        await self._c.execute(
            sql.SQL("update public.eventi set {} where id = %s").format(
                sql.SQL(", ").join(assegnazioni)
            ),
            (*valori, evento_id),
        )
        if generi is not None:
            await self._c.execute(
                "delete from public.eventi_generi where evento_id = %s", (evento_id,)
            )
            await self._scrivi_generi(evento_id, generi)

    async def collega_fonte(self, evento_id: UUID, evento: EventoNormalizzato) -> None:
        origine = evento.origine
        cursore = await self._c.execute(
            """update public.eventi_fonti
               set url_originale = %s, raccolto_il = %s, ultima_conferma_il = now(),
                   assenze_consecutive = 0
               where evento_id = %s and fonte_id = %s and id_esterno is not distinct from %s""",
            (origine.url, origine.raccolto_il, evento_id, origine.fonte_id, origine.id_esterno),
        )
        if cursore.rowcount == 0:
            await self._c.execute(
                """insert into public.eventi_fonti
                     (evento_id, fonte_id, tipo_origine, url_originale, id_esterno, raccolto_il)
                   values (%s, %s, %s, %s, %s, %s)""",
                (
                    evento_id,
                    origine.fonte_id,
                    origine.tipo.value,
                    origine.url,
                    origine.id_esterno,
                    origine.raccolto_il,
                ),
            )

    async def _scrivi_generi(self, evento_id: UUID, generi: tuple[str, ...]) -> None:
        for codice in generi:
            await self._c.execute(
                """insert into public.eventi_generi (evento_id, genere_codice) values (%s, %s)
                   on conflict do nothing""",
                (evento_id, codice),
            )


class ArchivioRaccoltaPostgres:
    def __init__(self, pool: PoolDatabase) -> None:
        self._pool = pool

    def _connessione(self) -> AbstractAsyncContextManager[AsyncConnection[DictRow]]:
        return self._pool.connection()

    async def carica_fonte(self, fonte_id: UUID) -> FonteDaEseguire | None:
        async with self._connessione() as c:
            cursore = await c.execute(
                """select f.id, f.locale_id, l.nome as locale_nome, l.comune as locale_comune,
                          f.tipo::text as tipo, f.url, coalesce(f.adattatore, '') as adattatore,
                          f.pagine_massime, f.stato_conformita::text as stato_conformita,
                          f.attiva
                   from public.fonti f join public.locali l on l.id = f.locale_id
                   where f.id = %s""",
                (fonte_id,),
            )
            riga = await cursore.fetchone()
        if riga is None:
            return None
        return FonteDaEseguire(
            fonte=Fonte(
                id=riga["id"],
                locale_id=riga["locale_id"],
                locale_nome=riga["locale_nome"],
                locale_comune=riga["locale_comune"],
                tipo=TipoFonte(riga["tipo"]),
                url=riga["url"],
                adattatore=riga["adattatore"],
                pagine_massime=riga["pagine_massime"],
            ),
            stato_conformita=riga["stato_conformita"],
            attiva=riga["attiva"],
        )

    @asynccontextmanager
    async def transazione(self) -> AsyncIterator[TransazionePostgres]:
        async with self._connessione() as c, c.transaction():
            yield TransazionePostgres(c)

    async def registra_esito(self, fonte_id: UUID, esito: EsitoEsecuzione) -> bool:
        errore = esito.codice_errore is not None
        async with self._connessione() as c, c.transaction():
            await c.execute(
                """insert into public.esecuzioni_fonte
                     (fonte_id, prova, iniziata_il, durata_ms, pagine_lette, eventi_letti,
                      eventi_nuovi, eventi_uniti, eventi_in_revisione, eventi_scartati,
                      codice_errore, messaggio_errore)
                   values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    fonte_id,
                    esito.prova,
                    esito.iniziata_il,
                    esito.durata_ms,
                    esito.pagine_lette,
                    esito.eventi_letti,
                    esito.eventi_nuovi,
                    esito.eventi_uniti,
                    esito.eventi_in_revisione,
                    esito.eventi_scartati,
                    esito.codice_errore,
                    esito.messaggio_errore,
                ),
            )
            if esito.prova:
                # Una prova non sposta la pianificazione né i contatori degli errori.
                await c.execute(
                    "update public.fonti set ultimo_esito = %s where id = %s",
                    (Jsonb(esito.come_json()), fonte_id),
                )
                return False
            cursore = await c.execute(
                """update public.fonti
                   set ultima_esecuzione_il = now(),
                       ultimo_esito = %(esito)s,
                       errori_consecutivi = case when %(errore)s then errori_consecutivi + 1
                                                 else 0 end,
                       ultimo_errore = case when %(errore)s then %(messaggio)s else null end,
                       esecuzioni_senza_eventi = case
                         when %(errore)s then esecuzioni_senza_eventi
                         when %(letti)s = 0 then esecuzioni_senza_eventi + 1
                         else 0 end,
                       attiva = case when %(errore)s and errori_consecutivi + 1 >= 5 then false
                                     else attiva end,
                       disattivata_automaticamente_il = case
                         when %(errore)s and errori_consecutivi + 1 >= 5 and attiva then now()
                         else disattivata_automaticamente_il end
                   where id = %(fonte)s
                   returning disattivata_automaticamente_il = now() as disattivata""",
                {
                    "esito": Jsonb(esito.come_json()),
                    "errore": errore,
                    "messaggio": f"{esito.codice_errore}: {esito.messaggio_errore or ''}"[:500],
                    "letti": esito.eventi_letti,
                    "fonte": fonte_id,
                },
            )
            riga = await cursore.fetchone()
        return bool(riga and riga["disattivata"])

    async def aggiorna_assenze(self, fonte_id: UUID, confermati: set[UUID]) -> None:
        async with self._connessione() as c, c.transaction():
            await c.execute(
                """update public.eventi_fonti ef
                   set assenze_consecutive = case when ef.evento_id = any(%(c)s::uuid[]) then 0
                                                  else ef.assenze_consecutive + 1 end,
                       ultima_conferma_il = case when ef.evento_id = any(%(c)s::uuid[]) then now()
                                                 else ef.ultima_conferma_il end
                   from public.eventi e
                   where e.id = ef.evento_id and ef.fonte_id = %(fonte)s and e.inizio > now()""",
                {"c": list(confermati), "fonte": fonte_id},
            )

    async def carica_grezzo_deciso(self, grezzo_id: UUID) -> GrezzoDeciso | None:
        async with self._connessione() as c:
            cursore = await c.execute(
                """select id, payload, decisione, evento_candidato_id
                   from public.eventi_grezzi
                   where id = %s and stato = 'in_revisione_dedup' and decisione is not null""",
                (grezzo_id,),
            )
            riga = await cursore.fetchone()
        if riga is None:
            return None
        return GrezzoDeciso(
            id=riga["id"],
            payload=riga["payload"],
            decisione=riga["decisione"],
            evento_candidato_id=riga["evento_candidato_id"],
        )
