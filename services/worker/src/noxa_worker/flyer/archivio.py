"""Operazioni sul database per il modulo flyer (EVENT_INGESTION.md §5).

Protocollo `ArchivioFlyer` + implementazione `ArchivioFlyerPostgres` con il ruolo
`noxa_worker` (ADR-0003). Solo le tabelle e le colonne concesse dalle migrazioni
della raccolta e dei flyer.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol
from uuid import UUID

import structlog
from psycopg.types.json import Jsonb
from pydantic import JsonValue

from noxa_worker.database import PoolDatabase

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class CaricoFlyer:
    id: UUID
    storage_path: str
    stato: str


@dataclass(frozen=True)
class ImmagineElimina:
    bucket: str
    percorso: str


class ArchivioFlyer(Protocol):
    async def carica_caricamento(self, caricamento_id: UUID) -> CaricoFlyer | None:
        """Restituisce il caricamento se esiste, altrimenti None."""
        ...

    async def aggiorna_analisi(
        self,
        caricamento_id: UUID,
        *,
        stato: str,
        risultato: dict[str, JsonValue] | None,
        phash: str | None,
        modello: str | None,
        versione_prompt: str | None,
        confidenza: float | None,
        costo_eur: float | None,
        contenuto_sospetto: bool,
        evento_id: UUID | None,
        evento_candidato_id: UUID | None,
    ) -> None: ...

    async def trova_duplicato_phash(self, phash: str, esclude: UUID) -> UUID | None:
        """Cerca un caricamento con lo stesso pHash (escludendo quello corrente)."""
        ...

    async def risolvi_locale(self, nome: str | None, comune: str | None) -> UUID | None:
        """Cerca il locale per nome e comune; restituisce l'id oppure None."""
        ...

    async def crea_evento_revisione(
        self,
        locale_id: UUID,
        caricamento_id: UUID,
        *,
        titolo: str,
        inizio: datetime,
        fine: datetime | None,
        eta_minima: int,
        eta_minima_dichiarata: bool,
        riferimenti_alcol: bool,
        artisti: list[str],
        prezzo_min_centesimi: int | None,
    ) -> UUID:
        """Crea un evento in stato `in_revisione` e collega il caricamento."""
        ...

    async def immagini_da_eliminare(self) -> list[ImmagineElimina]:
        """Chiama `private.immagini_da_eliminare()` e restituisce i file da cancellare."""
        ...

    async def segna_immagini_eliminate(self, storage_paths: list[str]) -> None:
        """Segna `immagine_eliminata_il = now()` per i caricamenti flyer elencati."""
        ...

    async def pubblica_immagine_flyer(self, evento_id: UUID, immagine_path: str) -> None:
        """Aggiorna `eventi.immagine_path` e `immagine_fonte` dopo la copia del flyer."""
        ...


class ArchivioFlyerPostgres:
    def __init__(self, pool: PoolDatabase) -> None:
        self._pool = pool

    async def carica_caricamento(self, caricamento_id: UUID) -> CaricoFlyer | None:
        async with self._pool.connection() as c:
            riga: dict[str, Any] | None = await (
                await c.execute(
                    "SELECT id, storage_path, stato::text FROM public.caricamenti_flyer"
                    " WHERE id = %s",
                    (caricamento_id,),
                )
            ).fetchone()
        if riga is None:
            return None
        return CaricoFlyer(id=riga["id"], storage_path=riga["storage_path"], stato=riga["stato"])

    async def aggiorna_analisi(
        self,
        caricamento_id: UUID,
        *,
        stato: str,
        risultato: dict[str, JsonValue] | None,
        phash: str | None,
        modello: str | None,
        versione_prompt: str | None,
        confidenza: float | None,
        costo_eur: float | None,
        contenuto_sospetto: bool,
        evento_id: UUID | None,
        evento_candidato_id: UUID | None,
    ) -> None:
        async with self._pool.connection() as c:
            await c.execute(
                """UPDATE public.caricamenti_flyer
                   SET stato = %s::public.stato_caricamento,
                       risultato_estrazione = %s,
                       phash = %s,
                       modello = %s,
                       versione_prompt = %s,
                       confidenza = %s,
                       costo_stimato_eur = %s,
                       contenuto_sospetto = %s,
                       evento_id = %s,
                       evento_candidato_id = %s
                   WHERE id = %s""",
                (
                    stato,
                    Jsonb(risultato) if risultato is not None else None,
                    phash,
                    modello,
                    versione_prompt,
                    confidenza,
                    costo_eur,
                    contenuto_sospetto,
                    evento_id,
                    evento_candidato_id,
                    caricamento_id,
                ),
            )

    async def trova_duplicato_phash(self, phash: str, esclude: UUID) -> UUID | None:
        async with self._pool.connection() as c:
            riga: dict[str, Any] | None = await (
                await c.execute(
                    """SELECT id FROM public.caricamenti_flyer
                       WHERE phash = %s AND id != %s
                         AND stato IN ('in_revisione', 'approvato', 'unito')
                       ORDER BY creato_il DESC
                       LIMIT 1""",
                    (phash, esclude),
                )
            ).fetchone()
        return riga["id"] if riga else None

    async def risolvi_locale(self, nome: str | None, comune: str | None) -> UUID | None:
        if not nome:
            return None
        async with self._pool.connection() as c:
            if comune:
                riga: dict[str, Any] | None = await (
                    await c.execute(
                        """SELECT id FROM public.locali
                           WHERE lower(nome) = lower(%s)
                             AND lower(comune) = lower(%s)
                             AND stato = 'attivo'
                           LIMIT 1""",
                        (nome, comune),
                    )
                ).fetchone()
            else:
                riga = await (
                    await c.execute(
                        """SELECT id FROM public.locali
                           WHERE lower(nome) = lower(%s)
                             AND stato = 'attivo'
                           LIMIT 1""",
                        (nome,),
                    )
                ).fetchone()
        return riga["id"] if riga else None

    async def crea_evento_revisione(
        self,
        locale_id: UUID,
        caricamento_id: UUID,
        *,
        titolo: str,
        inizio: datetime,
        fine: datetime | None,
        eta_minima: int,
        eta_minima_dichiarata: bool,
        riferimenti_alcol: bool,
        artisti: list[str],
        prezzo_min_centesimi: int | None,
    ) -> UUID:
        async with self._pool.connection() as c, c.transaction():
            riga_ev: dict[str, Any] | None = await (
                await c.execute(
                    """INSERT INTO public.eventi
                       (locale_id, titolo, inizio, fine, eta_minima,
                        eta_minima_dichiarata, riferimenti_alcol,
                        artisti, prezzo_min_centesimi, stato)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'in_revisione')
                       RETURNING id""",
                    (
                        locale_id,
                        titolo,
                        inizio,
                        fine,
                        eta_minima,
                        eta_minima_dichiarata,
                        riferimenti_alcol,
                        artisti,
                        prezzo_min_centesimi,
                    ),
                )
            ).fetchone()
            if riga_ev is None:
                raise RuntimeError("INSERT eventi non ha restituito righe")
            evento_id: UUID = riga_ev["id"]
            await c.execute(
                """INSERT INTO public.eventi_fonti
                   (evento_id, caricamento_flyer_id, tipo_origine)
                   VALUES (%s, %s, 'flyer')
                   ON CONFLICT DO NOTHING""",
                (evento_id, caricamento_id),
            )
        return evento_id

    async def immagini_da_eliminare(self) -> list[ImmagineElimina]:
        async with self._pool.connection() as c:
            righe: list[dict[str, Any]] = await (
                await c.execute("SELECT bucket, percorso FROM private.immagini_da_eliminare()")
            ).fetchall()
        return [ImmagineElimina(bucket=r["bucket"], percorso=r["percorso"]) for r in righe]

    async def segna_immagini_eliminate(self, storage_paths: list[str]) -> None:
        if not storage_paths:
            return
        async with self._pool.connection() as c:
            await c.execute(
                """UPDATE public.caricamenti_flyer
                   SET immagine_eliminata_il = now()
                   WHERE storage_path = ANY(%s)
                     AND immagine_eliminata_il IS NULL""",
                (storage_paths,),
            )

    async def pubblica_immagine_flyer(self, evento_id: UUID, immagine_path: str) -> None:
        async with self._pool.connection() as c:
            await c.execute(
                """UPDATE public.eventi
                   SET immagine_path = %s, immagine_fonte = 'flyer'
                   WHERE id = %s""",
                (immagine_path, evento_id),
            )
