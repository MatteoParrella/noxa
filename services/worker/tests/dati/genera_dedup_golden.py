"""Genera la prima versione di `dedup_golden.jsonl` (EVENT_INGESTION.md §6.3).

Prima che esistano dati reali, il golden set è costruito con locali, titoli e artisti di
fantasia e con le varianti che le fonti producono per lo stesso evento (maiuscole, emoji,
nome del locale o data nel titolo, sottotitoli, refusi, orari diversi di qualche minuto) e
con coppie di eventi distinti nello stesso locale e nella stessa serata. L'etichetta deriva
dalla costruzione. Con la raccolta reale il file si estende con ogni coppia decisa in
moderazione (§6.4): le nuove righe si aggiungono in fondo, senza rigenerare il file.

Uso (da services/worker): `uv run python tests/dati/genera_dedup_golden.py`.
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

FUSO = ZoneInfo("Europe/Rome")
DESTINAZIONE = Path(__file__).parent / "dedup_golden.jsonl"

LOCALI = [
    "Club Binario 7",
    "Officina Lambro",
    "Cascina Torretta",
    "Sala Ventuno",
    "Magazzino Nove",
    "Spazio Navile",
    "Capannone Ortica",
    "Corte delle Rose",
    "Spazio Vetrina",
    "Teatro Fornace",
    "Villa Brughiera",
    "Dock Sette",
]
TITOLI = [
    "Notte Ferrovia",
    "Bassi Lunghi",
    "Open Decks",
    "Cortile Live",
    "Reggaeton Night",
    "Anni Zero",
    "Elettronica al Magazzino",
    "Indie al Binario",
    "Sotto Cassa",
    "Techno Marathon",
    "Hip Hop Society",
    "Latin Fever",
    "Drum Session",
    "House Arrest",
    "Glitter Disco",
    "Rave in Cascina",
    "Venerdì Elettrico",
    "Fuori Orario",
    "Luna Storta",
    "Ritmo Sommerso",
    "Halloween Ball",
    "Afro Sunset",
    "Rock della Brianza",
    "Ninety Revival",
    "Notte Bianca Club",
    "Underground Lab",
    "Vinili e Cassette",
    "Basement Tapes",
    "Città Notturna",
    "Grande Festa Latina",
    "Trap Nation",
    "Synth Wave Party",
    "Jazz al Fornace",
    "Electro Swing",
    "Minimal Monday",
    "Deep Inside",
    "Acid Sunday",
    "Disco Inferno",
    "Hard Groove",
    "Soul Kitchen",
]
SOTTOTITOLI = [
    "techno all night",
    "la festa",
    "special edition",
    "closing party",
    "opening season",
    "vol. 3",
    "dalle 23 all'alba",
    "sala grande",
    "edizione d'autunno",
    "first anniversary",
]
ARTISTI = [
    "Nera Vale",
    "Corrado B.",
    "Otto Fili",
    "Selva Mc",
    "Duo Brina",
    "Lanterna",
    "Mare di Brughiera",
    "I Fili Scoperti",
    "Neve",
    "Kappa Sette",
    "Lumi",
    "Ferro & Rame",
    "Sara Notte",
    "Tommi Volt",
    "Gemma Rossa",
    "Polvere",
]
GIORNI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"]
MESI = [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
]
EMOJI = ["🔥", "🎶", "✨", "🔊", "🖤"]


def _evento(titolo: str, inizio: datetime, artisti: list[str]) -> dict[str, object]:
    return {"titolo": titolo, "inizio": inizio.isoformat(), "artisti": artisti}


def _refuso(caso: random.Random, titolo: str) -> str:
    parole = titolo.split()
    lunghe = [i for i, p in enumerate(parole) if len(p) > 5]
    if not lunghe:
        return titolo
    i = caso.choice(lunghe)
    j = caso.randrange(1, len(parole[i]) - 1)
    parole[i] = parole[i][:j] + parole[i][j + 1 :]
    return " ".join(parole)


def _variante(caso: random.Random, titolo: str, locale: str, inizio: datetime) -> str:
    """Lo stesso evento come lo scriverebbe un'altra fonte."""
    tipo = caso.randrange(9)
    if tipo == 0:
        return titolo.upper() + " " + caso.choice(EMOJI)
    if tipo == 1:
        return f"{locale} presents {titolo}"
    if tipo == 2:
        giorno = GIORNI[inizio.weekday()]
        return f"{titolo} – {giorno} {inizio.day} {MESI[inizio.month - 1]}"
    if tipo == 3:
        return f"{caso.choice(EMOJI)} {titolo.lower()} {caso.choice(EMOJI)}"
    if tipo == 4:
        return f"{titolo}: {caso.choice(SOTTOTITOLI)}"
    if tipo == 5:
        return _refuso(caso, titolo)
    if tipo == 6:
        return f"{titolo} @ {locale}"
    if tipo == 7:
        return f"{titolo} | {inizio.day:02d}.{inizio.month:02d} h{inizio.hour}"
    return f"{titolo} party night"


def genera(seme: int = 2026) -> list[dict[str, object]]:
    caso = random.Random(seme)  # noqa: S311 - dati di prova, non crittografia
    righe: list[dict[str, object]] = []
    base = datetime(2026, 10, 2, 22, 0, tzinfo=FUSO)

    # Stesso evento: 180 coppie.
    for numero in range(180):
        locale = caso.choice(LOCALI)
        titolo = caso.choice(TITOLI)
        inizio = base + timedelta(days=numero % 60, minutes=caso.choice([0, 30, 60, 90, 120]))
        artisti = caso.sample(ARTISTI, caso.randrange(0, 4))
        spostamento = caso.choice([0, 0, 0, 15, 30, 45, 60])
        altri_artisti = (
            [("DJ " + a) if caso.random() < 0.3 else a for a in artisti[: caso.randrange(0, 4)]]
            if artisti
            else []
        )
        righe.append(
            {
                "locale": locale,
                "a": _evento(titolo, inizio, artisti),
                "b": _evento(
                    _variante(caso, titolo, locale, inizio),
                    inizio + timedelta(minutes=spostamento),
                    altri_artisti,
                ),
                "altri_nel_blocco": caso.choice([0, 0, 1, 2]),
                "stesso_evento": True,
                "origine": "sintetica",
            }
        )

    # Eventi distinti nello stesso locale e nella stessa serata: 140 coppie.
    for numero in range(140):
        locale = caso.choice(LOCALI)
        titolo_a, titolo_b = caso.sample(TITOLI, 2)
        inizio = base + timedelta(days=numero % 60)
        tipo = caso.randrange(4)
        if tipo == 0:
            # Due sale in contemporanea.
            inizio_b = inizio
        elif tipo == 1:
            # Pomeriggio e notte.
            inizio, inizio_b = inizio - timedelta(hours=5), inizio + timedelta(hours=1)
        else:
            inizio_b = inizio + timedelta(minutes=caso.choice([120, 150, 180, 240]))
        artisti_a = caso.sample(ARTISTI, caso.randrange(0, 3))
        artisti_b = caso.sample([a for a in ARTISTI if a not in artisti_a], caso.randrange(0, 3))
        righe.append(
            {
                "locale": locale,
                "a": _evento(titolo_a, inizio, artisti_a),
                "b": _evento(
                    titolo_b if caso.random() < 0.7 else f"{titolo_b}: {caso.choice(SOTTOTITOLI)}",
                    inizio_b,
                    artisti_b,
                ),
                "altri_nel_blocco": caso.choice([0, 1, 1, 2]),
                "stesso_evento": False,
                "origine": "sintetica",
            }
        )
    # Casi difficili.
    serie = ["Notte Ferrovia", "Notte Latina", "Notte Bianca Club", "Notte Indie", "Notte Rock"]
    for numero in range(20):
        # Eventi distinti che condividono una parola del titolo, a orari diversi.
        locale = caso.choice(LOCALI)
        titolo_a, titolo_b = caso.sample(serie, 2)
        inizio = base + timedelta(days=numero)
        righe.append(
            {
                "locale": locale,
                "a": _evento(titolo_a, inizio, caso.sample(ARTISTI, 1)),
                "b": _evento(titolo_b, inizio + timedelta(hours=3), []),
                "altri_nel_blocco": 1,
                "stesso_evento": False,
                "origine": "sintetica",
            }
        )
    for numero in range(10):
        # Lo stesso evento con un titolo riscritto da Instagram: lo si riconosce solo
        # dall'artista e dall'orario, quindi va in revisione e non si unisce da solo.
        locale = caso.choice(LOCALI)
        titolo = caso.choice(TITOLI)
        artista = caso.choice(ARTISTI)
        inizio = base + timedelta(days=numero)
        righe.append(
            {
                "locale": locale,
                "a": _evento(titolo, inizio, [artista]),
                "b": _evento(f"Stasera al {locale.split()[-1]} con {artista}", inizio, [artista]),
                "altri_nel_blocco": 0,
                "stesso_evento": True,
                "origine": "sintetica",
            }
        )
    return righe


if __name__ == "__main__":
    with DESTINAZIONE.open("w", encoding="utf-8") as file:
        for riga in genera():
            file.write(json.dumps(riga, ensure_ascii=False) + "\n")
