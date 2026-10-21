"""Riferimenti all'alcol (EVENT_INGESTION.md §3.1, R-23).

Basta un termine dell'elenco per segnare l'evento: un falso positivo nasconde l'evento ai
minorenni finché un moderatore non lo corregge con una motivazione (R-22), un falso negativo
mostrerebbe a un minorenne una promozione sugli alcolici. L'elenco si estende con ogni errore
trovato in moderazione.
"""

from __future__ import annotations

import re

from noxa_worker.normalizzazione.testo import senza_accenti

TERMINI_ALCOL = (
    # Promozioni
    "open bar",
    "openbar",
    "free drink",
    "drink incluso",
    "drink compreso",
    "drink omaggio",
    "drink gratis",
    "consumazione alcolica",
    "happy hour",
    "beer pong",
    "bottle service",
    "tavolo con bottiglia",
    "bottiglia omaggio",
    "shot",
    "shots",
    "shottino",
    "shottini",
    "cicchetto",
    # Bevande
    "alcol",
    "alcolici",
    "alcolico",
    "birra",
    "birre",
    "vino",
    "spritz",
    "prosecco",
    "champagne",
    "vodka",
    "gin tonic",
    "gin lemon",
    "rum",
    "tequila",
    "whisky",
    "whiskey",
    "cocktail",
    "mojito",
    "negroni",
    "sangria",
    "limoncello",
    # Marchi di alcolici
    "absolut",
    "aperol",
    "bacardi",
    "belvedere",
    "campari",
    "corona extra",
    "grey goose",
    "heineken",
    "jagermeister",
    "jager",
    "jack daniel",
    "malibu",
    "moet",
    "moretti",
    "peroni",
    "smirnoff",
    "tanqueray",
)

_ESPRESSIONE = re.compile(
    r"\b(?:" + "|".join(re.escape(t) for t in sorted(TERMINI_ALCOL, key=len, reverse=True)) + r")\b"
)


def termini_alcol(*testi: str | None) -> list[str]:
    """Termini dell'elenco trovati nei testi (minuscole, senza accenti)."""
    trovati: list[str] = []
    for testo in testi:
        if testo:
            trovati.extend(_ESPRESSIONE.findall(senza_accenti(testo)))
    return trovati


def contiene_riferimenti_alcol(*testi: str | None) -> bool:
    """Vero se almeno un testo contiene un termine legato all'alcol."""
    return bool(termini_alcol(*testi))
