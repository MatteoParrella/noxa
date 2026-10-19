"""Generi musicali: sinonimi delle fonti → codici di `generi_musicali` (EVENT_INGESTION.md
§3.1)."""

from __future__ import annotations

import re
from collections.abc import Iterable

from noxa_worker.normalizzazione.testo import senza_accenti

MASSIMO_GENERI = 5

SINONIMI: dict[str, str] = {
    "techno": "techno",
    "minimal": "techno",
    "minimal techno": "techno",
    "hard techno": "techno",
    "acid": "techno",
    "industrial": "techno",
    "house": "house",
    "deep house": "house",
    "tech house": "house",
    "afro house": "house",
    "disco": "house",
    "nu disco": "house",
    "hip hop": "hip_hop",
    "hip-hop": "hip_hop",
    "hiphop": "hip_hop",
    "rap": "hip_hop",
    "trap": "hip_hop",
    "drill": "hip_hop",
    "r&b": "hip_hop",
    "rnb": "hip_hop",
    "reggaeton": "reggaeton",
    "regueton": "reggaeton",
    "dembow": "reggaeton",
    "commerciale": "commerciale",
    "commercial": "commerciale",
    "pop": "commerciale",
    "revival": "commerciale",
    "anni 90": "commerciale",
    "anni 2000": "commerciale",
    "latino": "latino",
    "latin": "latino",
    "salsa": "latino",
    "bachata": "latino",
    "kizomba": "latino",
    "drum and bass": "drum_and_bass",
    "drum & bass": "drum_and_bass",
    "drum'n'bass": "drum_and_bass",
    "drum n bass": "drum_and_bass",
    "dnb": "drum_and_bass",
    "jungle": "drum_and_bass",
    "elettronica": "elettronica",
    "electronic": "elettronica",
    "electronica": "elettronica",
    "edm": "elettronica",
    "trance": "elettronica",
    "dubstep": "elettronica",
    "ambient": "elettronica",
    "indie": "indie",
    "indie rock": "indie",
    "alternative": "indie",
    "rock": "indie",
    "punk": "indie",
    "post punk": "indie",
    "live": "live",
    "concerto": "live",
    "concert": "live",
    "band": "live",
    "dal vivo": "live",
    "jazz": "live",
    "cantautorato": "live",
}

_ESPRESSIONE = re.compile(
    r"(?<![\w&'])(?:"
    + "|".join(re.escape(s) for s in sorted(SINONIMI, key=len, reverse=True))
    + r")(?![\w&'])"
)


def mappa_generi(testi: Iterable[str | None]) -> tuple[str, ...]:
    """Codici dei generi nell'ordine in cui compaiono, senza ripetizioni, al massimo 5."""
    risultato: list[str] = []
    for testo in testi:
        if not testo:
            continue
        for trovato in _ESPRESSIONE.findall(senza_accenti(testo)):
            codice = SINONIMI[trovato]
            if codice not in risultato:
                risultato.append(codice)
    return tuple(risultato[:MASSIMO_GENERI])
