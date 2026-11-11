"""Date e ore nel fuso `Europe/Rome` (EVENT_INGESTION.md §3.1, passo 3).

Le fonti scrivono date in forme diverse: ISO 8601 (dati strutturati), "sabato 17 ottobre",
"17/10", "17.10.2026", e in inglese "Sat, 17th Oct 2026"; ore come "23:30", "23.30",
"h 23". Una data senza fuso è un orario di Milano.
"""

from __future__ import annotations

import re
from datetime import UTC, date, datetime, time, timedelta, timezone, tzinfo
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
# Molti siti dei locali di Milano sono in inglese ("Wed, 11th Nov 2026"). Le abbreviazioni
# uguali all'italiano ("feb", "mar", "apr", "nov") sono già sopra.
MESI_INGLESI = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "december": 12,
    "dec": 12,
}
MESI |= MESI_INGLESI

_ISO = re.compile(
    r"^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?"
    r"(Z|[+-]\d{2}:?\d{2}|[+-]\d:\d{2})?)?$"
)
_NOMI_MESI = "|".join(sorted(MESI, key=len, reverse=True))
_DATA_TESTO = re.compile(
    rf"\b(\d{{1,2}})(?:°|º|st|nd|rd|th)?\s+({_NOMI_MESI})\.?(?:\s+(\d{{4}}))?\b", re.IGNORECASE
)
_DATA_NUMERI = re.compile(r"\b(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?\b")
_ORA = re.compile(
    r"(?:\b(?:h|ore|dalle|alle|from|start)\s*)?\b([01]?\d|2[0-3])[:.]([0-5]\d)\b"
    r"|\b(?:h|ore|dalle|alle)\s*([01]?\d|2[0-3])\b",
    re.IGNORECASE,
)


def interpreta_iso(testo: str) -> datetime:
    """ISO 8601 con o senza fuso; senza ora vale le 00:00. Senza fuso è un orario di Milano.

    Si tollerano gli errori comuni dei siti WordPress: mese, giorno o ora senza lo zero
    ("2026-12-8T20:00") e fuso con un'ora a una cifra ("+1:00"). Un fuso così è scritto a mano
    e spesso è sbagliato (Live Club scrive "+1:00" anche d'estate): l'orario si legge come
    orario di Milano e il fuso si ignora."""
    valore = testo.strip()
    trovato = _ISO.match(valore)
    if not trovato:
        raise ValueError(f"data non in formato ISO: {valore[:40]!r}")
    anno, mese, giorno, ore, minuti, secondi, fuso = trovato.groups()
    fuso_esplicito: tzinfo = FUSO_ROMA
    if fuso and re.fullmatch(r"Z|[+-]\d{2}:?\d{2}", fuso):
        if fuso == "Z":
            fuso_esplicito = UTC
        else:
            segno = -1 if fuso[0] == "-" else 1
            cifre = fuso[1:].replace(":", "")
            fuso_esplicito = timezone(
                segno * timedelta(hours=int(cifre[:2]), minutes=int(cifre[2:]))
            )
    return datetime(
        int(anno),
        int(mese),
        int(giorno),
        int(ore or 0),
        int(minuti or 0),
        int(secondi or 0),
        tzinfo=fuso_esplicito,
    )


def correggi_fine(inizio: datetime, fine: datetime | None) -> datetime | None:
    """Errori comuni dei siti sulla fine di una serata. Una fine uguale all'inizio vuol dire
    "non indicata"; una fine prima dell'inizio ma entro 24 ore ha il giorno sbagliato (23:30 →
    04:00 dello stesso giorno) e passa al giorno dopo. Gli altri casi restano com'erano e la
    validazione li scarta."""
    if fine is None or fine == inizio:
        return None
    if fine < inizio < fine + timedelta(days=1):
        return fine + timedelta(days=1)
    return fine


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
