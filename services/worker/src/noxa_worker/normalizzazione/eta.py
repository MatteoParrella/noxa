"""Età minima dichiarata da una fonte (EVENT_INGESTION.md §3.1, R-21, R-22).

Si riconoscono espressioni come "14+", "+16", "dai 16 anni", "18 anni compiuti", "over 21",
"vietato ai minori", "solo maggiorenni". Se il testo ne contiene più d'una vale la più alta
(R-22); se non ne contiene nessuna il risultato è `None` e l'evento resta 18+ non dichiarato
(R-21).
"""

from __future__ import annotations

import re

ETA_MINIMA_SCHEMA = 14
ETA_MASSIMA_SCHEMA = 30

_NUMERO = r"(1[0-9]|2[0-9]|30)"
_ESPRESSIONI = [
    re.compile(rf"(?<![\d+])\+\s?{_NUMERO}\b"),
    re.compile(rf"\b{_NUMERO}\s?\+(?![\d])"),
    re.compile(rf"\b(?:dai|dagli|da|over|età minima|eta minima|minimo|min\.?)\s*{_NUMERO}\b", re.I),
    re.compile(rf"\b{_NUMERO}\s*anni\s*(?:compiuti|in su)\b", re.I),
    re.compile(rf"\bingresso\s*(?:consentito\s*)?(?:ai|dai)\s*{_NUMERO}\b", re.I),
]
_MAGGIORENNI = re.compile(
    r"\b(?:vietato ai minori|solo maggiorenni|riservato ai maggiorenni|maggiore età|"
    r"maggiorenni)\b",
    re.I,
)


def estrai_eta_minima(*testi: str | None) -> int | None:
    """Età minima più alta trovata nei testi, nell'intervallo 14–30 dello schema; `None` se
    non dichiarata. Un'età inferiore a 14 vale 14: Noxa non ha utenti più giovani."""
    trovate: list[int] = []
    for testo in testi:
        if not testo:
            continue
        for espressione in _ESPRESSIONI:
            trovate.extend(int(valore) for valore in espressione.findall(testo))
        if _MAGGIORENNI.search(testo):
            trovate.append(18)
    if not trovate:
        return None
    return min(max(max(trovate), ETA_MINIMA_SCHEMA), ETA_MASSIMA_SCHEMA)
