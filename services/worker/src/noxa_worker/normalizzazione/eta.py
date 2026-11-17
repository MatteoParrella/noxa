"""Età minima dichiarata da una fonte (EVENT_INGESTION.md §3.1, R-21, R-22).

Si riconoscono espressioni come "14+", "+16", "dai 16 anni", "18 anni compiuti", "over 21",
"vietato ai minori", "riservato ai maggiori di 16 anni", "non sono ammessi minorenni",
"under 18 not allowed", "solo maggiorenni". «Vietato ai minori di 16 anni» vale 16, non 18;
«ingresso da 15 €» è un prezzo e non un'età. Se il testo ne contiene più d'una vale la più
alta (R-22); se non ne contiene nessuna il risultato è `None` e l'evento resta 18+ non
dichiarato (R-21).
"""

from __future__ import annotations

import re

ETA_MINIMA_SCHEMA = 14
ETA_MASSIMA_SCHEMA = 30

_NUMERO = r"(1[0-9]|2[0-9]|30)"
# «da 15 €», «minimo 20 euro», «da 12,50»: un importo, non un'età.
_NON_PREZZO = r"(?!\s?(?:€|euro\b|eur\b)|[.,]\d)"
_ESPRESSIONI = [
    re.compile(rf"(?<![\d+])\+\s?{_NUMERO}\b"),
    re.compile(rf"\b{_NUMERO}\s?\+(?![\d])"),
    re.compile(
        rf"\b(?:dai|dagli|da|over|età minima|eta minima|minimo|min\.?)\s*{_NUMERO}\b{_NON_PREZZO}",
        re.I,
    ),
    re.compile(rf"\b{_NUMERO}\s*anni\s*(?:compiuti|in su)\b", re.I),
    re.compile(rf"\bingresso\s*(?:consentito\s*)?(?:ai|dai)\s*{_NUMERO}\b", re.I),
    re.compile(rf"\bminor[ie]\s*di\s*{_NUMERO}\b", re.I),
    # «Ingresso riservato ai maggiori di 16 anni» (Live Club): l'età scritta, come «16+».
    re.compile(rf"\bmaggior[ie]\s*di\s*{_NUMERO}\b", re.I),
    re.compile(
        rf"\b(?:no\s+)?under\s*{_NUMERO}\s*(?:are\s+|is\s+)?not\s+(?:allowed|admitted)", re.I
    ),
    re.compile(rf"\bno\s+under\s*{_NUMERO}\b", re.I),
]
# «Vietato ai minori di 16 anni»: l'età è scritta, il 18 generico non vale.
_MINORI_DI = re.compile(rf"\bminor[ie]\s*di\s*{_NUMERO}\b", re.I)
_MAGGIORENNI = re.compile(
    r"\b(?:vietato ai minori|solo maggiorenni|riservat[oi] ai maggiorenni|maggiore età|"
    r"maggiorenni|non sono ammessi (?:i )?minor(?:enn)?i|minor(?:enn)?i non ammessi|"
    r"non (?:è|e) consentito l'ingresso ai minor(?:enn)?i|adults only)\b",
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
        if _MAGGIORENNI.search(testo) and not _MINORI_DI.search(testo):
            trovate.append(18)
    if not trovate:
        return None
    return min(max(max(trovate), ETA_MINIMA_SCHEMA), ETA_MASSIMA_SCHEMA)
