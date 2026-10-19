"""Evento dalla didascalia di un post Instagram (EVENT_INGESTION.md §2.5).

Dall'iterazione 5 la didascalia si legge con regole: data, ora, titolo (prima riga
significativa) e line-up. Un post senza data o senza ora non diventa un evento; l'analisi
dell'immagine con l'estrattore dei flyer arriva con l'iterazione 6.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime

from noxa_worker.normalizzazione.date import combina, trova_data, trova_ora

_SIMBOLI_INIZIALI = re.compile(r"^[^\w\"'«(#@]+")
_SIMBOLI_FINALI = re.compile(r"[^\w\"')»!?.]+$")
_LINE_UP = re.compile(r"^\s*(?:line\s*-?\s*up|lineup|con|feat\.?|dj set)\s*[:\-–]\s*(.*)$", re.I)
_SEPARATORI_ARTISTI = re.compile(r"\s*(?:,|\bb2b\b|&|\+|\bx\b|/)\s*", re.I)
_DATA_O_ORA = re.compile(
    r"\b(?:lun|mar|mer|gio|ven|sab|dom)[a-zì]*\.?\s*\d{1,2}(?:[/.]\d{1,2}(?:[/.]\d{2,4})?)?"
    r"|\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b"
    r"|\b(?:h|ore|dalle|alle)\s*\d{1,2}(?:[:.]\d{2})?\b",
    re.I,
)


@dataclass(frozen=True)
class EventoDaDidascalia:
    titolo: str
    inizio: datetime
    artisti: tuple[str, ...]


def leggi_didascalia(didascalia: str, pubblicato_il: datetime) -> EventoDaDidascalia | None:
    """Evento descritto dalla didascalia, oppure None se mancano data, ora o titolo."""
    riferimento: date = pubblicato_il.date()
    giorno = trova_data(didascalia, riferimento)
    ora = trova_ora(didascalia)
    if giorno is None or ora is None:
        return None
    titolo = _titolo(didascalia)
    if not titolo:
        return None
    return EventoDaDidascalia(
        titolo=titolo, inizio=combina(giorno, ora), artisti=_artisti(didascalia)
    )


def _titolo(didascalia: str) -> str | None:
    for riga in didascalia.splitlines():
        pulita = _SIMBOLI_INIZIALI.sub("", riga.strip())
        if not pulita or pulita.startswith(("#", "@")) or _LINE_UP.match(pulita):
            continue
        senza_date = _DATA_O_ORA.sub(" ", pulita)
        senza_date = re.sub(r"[#@][\w.]+", " ", senza_date)
        senza_date = _SIMBOLI_FINALI.sub("", senza_date)
        senza_date = re.sub(r"\s+", " ", senza_date).strip(" -–|·•,:")
        if sum(c.isalpha() for c in senza_date) >= 3:
            return senza_date
    return None


def _artisti(didascalia: str) -> tuple[str, ...]:
    for riga in didascalia.splitlines():
        trovato = _LINE_UP.match(riga)
        if trovato and trovato.group(1).strip():
            nomi = [n.strip(" .") for n in _SEPARATORI_ARTISTI.split(trovato.group(1))]
            return tuple(n for n in nomi if sum(c.isalpha() for c in n) >= 2)
    return ()
