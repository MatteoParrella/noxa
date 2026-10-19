"""Normalizzazione di titoli e artisti per il confronto (EVENT_INGESTION.md §6.1)."""

from __future__ import annotations

import re

from noxa_worker.dedup.parole_vuote import GIORNI, MESI, PAROLE_VUOTE
from noxa_worker.normalizzazione.testo import senza_accenti

_NON_PAROLA = re.compile(r"[^a-z0-9]+")
# Numeri di date e orari: 17, 2026, 23h, h23, 23h30, 11pm.
_DATA_ORA = re.compile(r"^(?:h?\d{1,4}(?:h\d{0,2}|am|pm)?)$")
_PREFISSI_ARTISTA = ("dj", "mc", "b2b")


def _base(testo: str) -> str:
    """Passi 1 e 2: NFKD senza accenti, minuscole, niente punteggiatura né emoji."""
    return _NON_PAROLA.sub(" ", senza_accenti(testo)).strip()


def normalizza_titolo(titolo: str, nome_locale: str | None = None) -> str:
    """Titolo senza parole non distintive: nome del locale, giorni, mesi, numeri di date e
    orari, parole vuote. Se non resta nulla vale il titolo dopo i soli passi 1 e 2."""
    base = _base(titolo)
    parole_locale = set(_base(nome_locale).split()) if nome_locale else set()
    tenute = [
        parola
        for parola in base.split()
        if parola not in parole_locale
        and parola not in GIORNI
        and parola not in MESI
        and parola not in PAROLE_VUOTE
        and not _DATA_ORA.match(parola)
    ]
    return " ".join(tenute) or base


def normalizza_artista(nome: str) -> str:
    """Nome dell'artista senza i prefissi `dj`, `mc`, `b2b`."""
    parole = _base(nome).split()
    while parole and parole[0] in _PREFISSI_ARTISTA:
        parole = parole[1:]
    return " ".join(parole)
