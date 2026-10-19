from datetime import UTC, date, datetime, time

import pytest

from noxa_worker.normalizzazione.alcol import contiene_riferimenti_alcol, termini_alcol
from noxa_worker.normalizzazione.date import (
    FUSO_ROMA,
    combina,
    ha_ora,
    interpreta_iso,
    trova_data,
    trova_ora,
)
from noxa_worker.normalizzazione.eta import estrai_eta_minima
from noxa_worker.normalizzazione.generi import mappa_generi
from noxa_worker.normalizzazione.testo import pulisci, senza_accenti, tronca

# ---------------------------------------------------------------------------------------------
# Date e ore (fuso Europe/Rome)
# ---------------------------------------------------------------------------------------------


def test_iso_senza_fuso_e_un_orario_di_milano() -> None:
    valore = interpreta_iso("2026-10-17T23:30")
    assert valore == datetime(2026, 10, 17, 23, 30, tzinfo=FUSO_ROMA)
    assert valore.astimezone(UTC).hour == 21


@pytest.mark.parametrize(
    ("testo", "ore_utc"),
    [
        ("2026-10-17T23:30:00+02:00", 21),
        ("2026-10-17T21:30:00Z", 21),
        ("2026-10-17T23:30:00+0200", 21),
        # Dopo il cambio dell'ora (25 ottobre 2026) Milano è a UTC+1.
        ("2026-10-31T23:30", 22),
    ],
)
def test_iso_con_fuso(testo: str, ore_utc: int) -> None:
    assert interpreta_iso(testo).astimezone(UTC).hour == ore_utc


def test_iso_non_valido() -> None:
    with pytest.raises(ValueError, match="ISO"):
        interpreta_iso("sabato sera")


def test_ha_ora() -> None:
    assert ha_ora("2026-10-17T23:00")
    assert not ha_ora("2026-10-17")


@pytest.mark.parametrize(
    ("testo", "attesa"),
    [
        ("Sabato 17 ottobre — techno", date(2026, 10, 17)),
        ("ven 23 ott", date(2026, 10, 23)),
        ("il 17/10 al Binario", date(2026, 10, 17)),
        ("17.10.2026 ore 23", date(2026, 10, 17)),
        ("2 gennaio", date(2027, 1, 2)),
        ("ieri 14/10 è stato bello", date(2026, 10, 14)),
    ],
)
def test_trova_data(testo: str, attesa: date) -> None:
    assert trova_data(testo, date(2026, 10, 15)) == attesa


def test_trova_data_ignora_gli_orari() -> None:
    assert trova_data("dalle 23.30 fino a tardi", date(2026, 10, 15)) is None


@pytest.mark.parametrize(
    ("testo", "attesa"),
    [
        ("dalle 23:30", time(23, 30)),
        ("h 22", time(22, 0)),
        ("apertura 23.00", time(23, 0)),
        ("17/10 ore 21.30", time(21, 30)),
        ("17.10.2026 dalle 22", time(22, 0)),
    ],
)
def test_trova_ora(testo: str, attesa: time) -> None:
    assert trova_ora(testo) == attesa


def test_un_orario_dopo_mezzanotte_appartiene_alla_notte_dopo() -> None:
    assert combina(date(2026, 10, 17), time(1, 30)) == datetime(
        2026, 10, 18, 1, 30, tzinfo=FUSO_ROMA
    )
    assert combina(date(2026, 10, 17), time(23, 0)).day == 17


# ---------------------------------------------------------------------------------------------
# Età minima (R-21, R-22)
# ---------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("testo", "attesa"),
    [
        ("Ingresso 16+", 16),
        ("+18 con documento", 18),
        ("dai 16 anni", 16),
        ("18 anni compiuti", 18),
        ("over 21", 21),
        ("Evento vietato ai minori", 18),
        ("solo maggiorenni", 18),
        ("età minima 14", 14),
        ("aperto dai 12 anni", 14),
        ("serata techno", None),
        ("dalle 23:30 alle 05:00", None),
    ],
)
def test_eta_minima(testo: str, attesa: int | None) -> None:
    assert estrai_eta_minima(testo) == attesa


def test_eta_piu_alta_tra_le_dichiarate() -> None:
    assert estrai_eta_minima("16+ in sala piccola", "sala grande 18+") == 18


# ---------------------------------------------------------------------------------------------
# Alcol (R-23)
# ---------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "testo",
    [
        "Open bar fino all'una",
        "ingresso + drink incluso",
        "Free drink entro mezzanotte",
        "Shot omaggio",
        "Serata Jägermeister",
        "Gin tonic a 5 euro",
        "promo Heineken",
        "Spritz party",
    ],
)
def test_riferimenti_alcol(testo: str) -> None:
    assert contiene_riferimenti_alcol(testo)


@pytest.mark.parametrize(
    "testo",
    ["Techno fino all'alba", "Drink analcolici", "Shoot fotografico", "Rumore bianco", ""],
)
def test_nessun_riferimento_alcol(testo: str) -> None:
    assert not contiene_riferimenti_alcol(testo)


def test_termini_trovati() -> None:
    assert termini_alcol("Open bar e shot") == ["open bar", "shot"]


# ---------------------------------------------------------------------------------------------
# Generi e testi
# ---------------------------------------------------------------------------------------------


def test_generi_mappati_senza_ripetizioni() -> None:
    assert mappa_generi(["Minimal Techno, Deep House", "techno", "Hip-Hop / Trap"]) == (
        "techno",
        "house",
        "hip_hop",
    )


def test_generi_al_massimo_cinque() -> None:
    assert len(mappa_generi(["techno house rap reggaeton salsa dnb indie"])) == 5


def test_generi_sconosciuti_ignorati() -> None:
    assert mappa_generi(["polka", None]) == ()


def test_pulisci_toglie_html_e_spazi() -> None:
    assert pulisci("<p>Notte&nbsp;<b>Ferrovia</b></p>\n\n") == "Notte Ferrovia"
    assert pulisci(None) == ""


def test_tronca_sullo_spazio() -> None:
    assert tronca("Una serata molto lunga davvero", 20) == "Una serata molto…"
    assert tronca("breve", 20) == "breve"


def test_senza_accenti() -> None:
    assert senza_accenti("Città ÜBER") == "citta uber"
