"""Seme della copertina generata (design/F-01-copertine-generate/ALGORITMO.md §1): titolo
normalizzato senza date. Serve al worker per riconoscere la stessa serata in settimane
diverse e calcolare i colori una volta sola; l'app usa la stessa regola per il motivo."""

from __future__ import annotations

import re
import unicodedata

_MESI = (
    "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|"
    "dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic"
)
_DATE = re.compile(
    rf"\b\d{{1,2}}[./-]\d{{1,2}}(?:[./-]\d{{2,4}})?\b|\b\d{{1,2}}\s+(?:{_MESI})\b(?:\s+\d{{4}})?"
)


def normalizza_titolo(titolo: str) -> str:
    testo = unicodedata.normalize("NFD", titolo)
    testo = "".join(c for c in testo if not unicodedata.combining(c)).lower()
    testo = _DATE.sub(" ", testo)
    testo = re.sub(r"[^a-z0-9]+", " ", testo)
    return " ".join(testo.split())
