"""Parole non distintive tolte dai titoli prima del confronto (EVENT_INGESTION.md §6.1)."""

from __future__ import annotations

PAROLE_VUOTE = frozenset(
    {
        "party",
        "night",
        "serata",
        "presents",
        "pres",
        "feat",
        "ft",
        "special",
        "guest",
        "free",
        "entry",
        "ingresso",
        "omaggio",
        "lista",
        "w",
        "with",
        "x",
        "vol",
        "edition",
        "ed",
    }
)

GIORNI = frozenset(
    {
        "lunedi",
        "martedi",
        "mercoledi",
        "giovedi",
        "venerdi",
        "sabato",
        "domenica",
        "lun",
        "mar",
        "mer",
        "gio",
        "ven",
        "sab",
        "dom",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    }
)

MESI = frozenset(
    {
        "gennaio",
        "febbraio",
        "marzo",
        "aprile",
        "maggio",
        "giugno",
        "luglio",
        "agosto",
        "settembre",
        "ottobre",
        "novembre",
        "dicembre",
        "gen",
        "feb",
        "apr",
        "mag",
        "giu",
        "lug",
        "ago",
        "set",
        "ott",
        "nov",
        "dic",
    }
)
