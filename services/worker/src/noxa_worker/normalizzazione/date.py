"""Date e ore nel fuso `Europe/Rome` (EVENT_INGESTION.md §3.1, passo 3).

Le fonti scrivono date in forme diverse: ISO 8601 (dati strutturati), "sabato 17 ottobre",
"17/10", "17.10.2026"; ore come "23:30", "23.30", "h 23". Una data senza fuso è un orario di
Milano.
"""

from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

FUSO_ROMA = ZoneInfo("Europe/Rome")

MESI = {
    "gennaio": 1,
    "gen": 1,
    "febbraio": 2,
    "feb": 2,
    "marzo": 3,
    "mar": 3,
    "aprile": 4,
    "apr": 4,
    "maggio": 5,
    "mag": 5,
    "giugno": 6,
    "giu": 6,
    "luglio": 7,
    "lug": 7,
    "agosto": 8,
    "ago": 8,
    "settembre": 9,
    "set": 9,
    "sett": 9,
    "ottobre": 10,
    "ott": 10,
    "novembre": 11,
    "nov": 11,
    "dicembre": 12,
    "dic": 12,
}

_ISO = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?"
    r"(Z|[+-]\d{2}:?\d{2})?)?$"
)
_NOMI_MESI = "|".join(sorted(MESI, key=len, reverse=True))
_DATA_TESTO = re.compile(
    rf"\b(\d{{1,2}})(?:°|º)?\s+({_NOMI_MESI})\.?(?:\s+(\d{{4}}))?\b", re.IGNORECASE
)
_DATA_NUMERI = re.compile(r"\b(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?\b")
_ORA = re.compile(
    r"(?:\b(?:h|ore|dalle|alle|from|start)\s*)?\b([01]?\d|2[0-3])[:.]([0-5]\d)\b"
    r"|\b(?:h|ore|dalle|alle)\s*([01]?\d|2[0-3])\b",
    re.IGNORECASE,
)


def interpreta_iso(testo: str) -> datetime:
    """ISO 8601 con o senza fuso; senza ora vale le 00:00. Senza fuso è un orario di Milano."""
    valore = testo.strip()
    trovato = _ISO.match(valore)
    if not trovato:
        raise ValueError(f"data non in formato ISO: {valore[:40]!r}")
    anno, mese, giorno, ore, minuti, secondi, fuso = trovato.groups()
    if fuso:
        normalizzato = valore.replace("Z", "+00:00")
        if re.search(r"[+-]\d{4}$", normalizzato):
            normalizzato = normalizzato[:-2] + ":" + normalizzato[-2:]
        return datetime.fromisoformat(normalizzato.replace(" ", "T"))
    return datetime(
        int(anno),
        int(mese),
        int(giorno),
        int(ore or 0),
        int(minuti or 0),
        int(secondi or 0),
        tzinfo=FUSO_ROMA,
    )


def ha_ora(testo: str) -> bool:
    """Vero se la stringa ISO contiene un orario."""
    return bool(re.search(r"[T ]\d{2}:\d{2}", testo))


def trova_data(testo: str, riferimento: date) -> date | None:
    """Prima data nel testo. Senza anno si sceglie la prossima occorrenza a partire da
    `riferimento` meno 7 giorni (un post può parlare della sera prima)."""
    candidati: list[tuple[int, date]] = []
    for trovato in _DATA_TESTO.finditer(testo):
        giorno, mese, anno = trovato.groups()
        valore = _componi(int(giorno), MESI[mese.lower()], anno, riferimento)
        if valore:
            candidati.append((trovato.start(), valore))
    for trovato in _DATA_NUMERI.finditer(testo):
        giorno, mese, anno = trovato.groups()
        # "23.30" è un orario, non il 23 del mese 30.
        if int(mese) > 12 or int(giorno) > 31:
            continue
        valore = _componi(int(giorno), int(mese), anno, riferimento)
        if valore:
            candidati.append((trovato.start(), valore))
    if not candidati:
        return None
    return min(candidati)[1]


def trova_ora(testo: str) -> time | None:
    """Prima ora nel testo (23:30, 23.30, h 23, dalle 22)."""
    for trovato in _ORA.finditer(testo):
        ore, minuti, sole_ore = trovato.groups()
        if ore is not None:
            # "17.10" dopo un giorno o seguito da un anno è una data, non un'ora.
            dopo = testo[trovato.end() : trovato.end() + 5]
            if re.match(r"[/.\-]\d{2,4}", dopo):
                continue
            return time(int(ore), int(minuti))
        if sole_ore is not None:
            return time(int(sole_ore), 0)
    return None


def combina(giorno: date, ora: time | None, ora_predefinita: time = time(22, 0)) -> datetime:
    """Data e ora a Milano. Un orario tra le 00:00 e le 06:00 appartiene alla notte dopo il
    giorno indicato (la "serata" di quel giorno, DATA_MODEL.md §5.3)."""
    effettiva = ora or ora_predefinita
    giorno_effettivo = giorno + timedelta(days=1) if effettiva < time(6, 0) else giorno
    return datetime.combine(giorno_effettivo, effettiva, tzinfo=FUSO_ROMA)


def _componi(giorno: int, mese: int, anno: str | None, riferimento: date) -> date | None:
    try:
        if anno:
            valore_anno = int(anno) + (2000 if len(anno) == 2 else 0)
            return date(valore_anno, mese, giorno)
        candidata = date(riferimento.year, mese, giorno)
    except ValueError:
        return None
    if candidata < riferimento - timedelta(days=7):
        try:
            candidata = date(riferimento.year + 1, mese, giorno)
        except ValueError:
            return None
    return candidata
