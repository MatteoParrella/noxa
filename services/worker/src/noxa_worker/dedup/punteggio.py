"""Punteggio e decisione della deduplicazione (EVENT_INGESTION.md §6.2, §6.3)."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from rapidfuzz import fuzz

from noxa_worker.dedup import configurazione as soglie
from noxa_worker.dedup.testi import normalizza_artista, normalizza_titolo


class EsitoDedup(StrEnum):
    STESSO_EVENTO = "stesso_evento"
    REVISIONE = "revisione"
    DISTINTI = "distinti"


@dataclass(frozen=True)
class EventoConfronto:
    """Campi usati nel confronto, per il grezzo e per gli eventi del blocco."""

    titolo: str
    inizio: datetime | None
    artisti: tuple[str, ...]
    id: UUID | None = None


@dataclass(frozen=True)
class Decisione:
    esito: EsitoDedup
    evento_id: UUID | None = None
    punteggio: float | None = None
    motivo: str | None = None


def confronta(
    nuovo: EventoConfronto, candidato: EventoConfronto, nome_locale: str | None
) -> tuple[float, int, float]:
    """`s_titolo` (0–100), artisti in comune e differenza degli inizi in minuti."""
    s_titolo = float(
        fuzz.token_set_ratio(
            normalizza_titolo(nuovo.titolo, nome_locale),
            normalizza_titolo(candidato.titolo, nome_locale),
        )
    )
    artisti_nuovo = {normalizza_artista(a) for a in nuovo.artisti} - {""}
    artisti_candidato = {normalizza_artista(a) for a in candidato.artisti} - {""}
    comuni = len(artisti_nuovo & artisti_candidato)
    if nuovo.inizio is None or candidato.inizio is None:
        delta = float("inf")
    else:
        delta = abs((nuovo.inizio - candidato.inizio).total_seconds()) / 60
    return s_titolo, comuni, delta


def descrivi(s_titolo: float, comuni: int, delta: float) -> str:
    """Motivo leggibile mostrato nella coda dei duplicati."""
    parti = ["Stesso locale"]
    if delta != float("inf"):
        parti.append("stesso orario" if delta < 1 else f"orario a {round(delta)} minuti")
    if comuni:
        parti.append("1 artista in comune" if comuni == 1 else f"{comuni} artisti in comune")
    if s_titolo >= soglie.SOGLIA_STESSO:
        parti.append("titolo quasi identico")
    elif s_titolo >= soglie.SOGLIA_SIMILE:
        parti.append("titolo simile")
    else:
        parti.append("titolo diverso")
    return ", ".join(parti)


def decidi(
    nuovo: EventoConfronto,
    candidati: Sequence[EventoConfronto],
    nome_locale: str | None,
    *,
    da_flyer: bool = False,
) -> Decisione:
    """Decisione per un grezzo rispetto agli eventi dello stesso blocco (stesso locale e
    stessa serata, esclusi rifiutati e annullati)."""
    migliori: list[tuple[int, float, float, EventoConfronto, str]] = []
    unico = len(candidati) == 1
    for candidato in candidati:
        s_titolo, comuni, delta = confronta(nuovo, candidato, nome_locale)
        if s_titolo >= soglie.SOGLIA_STESSO:
            esito = 2
        elif s_titolo >= soglie.SOGLIA_SIMILE:
            simili = comuni >= 1 or delta <= soglie.DELTA_STESSO_MINUTI
            # Un flyer si unisce da solo solo con il titolo quasi identico (R-51).
            esito = 2 if simili and not da_flyer else 1
        elif unico and (comuni >= 1 or delta <= soglie.DELTA_UNICO_MINUTI):
            esito = 1
        else:
            continue
        migliori.append((esito, s_titolo, -delta, candidato, descrivi(s_titolo, comuni, delta)))
    if not migliori:
        return Decisione(EsitoDedup.DISTINTI)
    # Prima l'esito più forte, poi il titolo più simile, poi l'orario più vicino.
    esito, s_titolo, _, scelto, motivo = max(migliori, key=lambda m: (m[0], m[1], m[2]))
    return Decisione(
        EsitoDedup.STESSO_EVENTO if esito == 2 else EsitoDedup.REVISIONE,
        evento_id=scelto.id,
        punteggio=round(s_titolo, 2),
        motivo=motivo,
    )
