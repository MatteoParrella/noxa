"""Tavolozza dalle immagini (ADR-0030): colori validi per il database e contrasto garantito."""

import io
import re
from datetime import UTC, datetime

import pytest
from PIL import Image

from noxa_worker.copertine.colori import (
    TESTO_CHIARO,
    TESTO_SCURO,
    ImmagineNonValida,
    contrasto,
    tavolozza,
    tinta_dominante,
)
from noxa_worker.copertine.seme import normalizza_titolo

ADESSO = datetime(2026, 11, 11, 10, 0, tzinfo=UTC)
ESADECIMALE = re.compile(r"^#[0-9A-F]{6}$")


def _immagine(colore: tuple[int, int, int], formato: str = "PNG", sfondo: bool = True) -> bytes:
    """Locandina finta: fondo quasi nero con un riquadro del colore dato."""
    immagine = Image.new("RGB", (400, 500), (12, 12, 14) if sfondo else colore)
    immagine.paste(colore, (60, 80, 340, 380))
    buffer = io.BytesIO()
    immagine.save(buffer, format=formato)
    return buffer.getvalue()


@pytest.mark.parametrize(
    ("colore", "tinta_attesa"),
    [((230, 40, 40), 0.0), ((40, 200, 90), 0.39), ((60, 90, 230), 0.64), ((240, 190, 40), 0.12)],
)
def test_tinta_dal_colore_caratteristico(colore: tuple[int, int, int], tinta_attesa: float) -> None:
    tinta, saturazione = tinta_dominante(_immagine(colore))
    assert abs(tinta - tinta_attesa) < 0.04 or abs(tinta - tinta_attesa) > 0.96
    assert 0.35 <= saturazione <= 0.85


def test_formato_del_database_e_contrasto() -> None:
    risultato = tavolozza(_immagine((230, 40, 40), "JPEG"), ADESSO)
    assert set(risultato) == {"scuro", "chiaro", "calcolata_il"}
    assert risultato["calcolata_il"] == "2026-11-11T10:00:00Z"
    for tema, testo in (("scuro", TESTO_SCURO), ("chiaro", TESTO_CHIARO)):
        colori = risultato[tema]
        assert isinstance(colori, dict)
        assert set(colori) == {"fondo", "1", "2", "bagliore"}
        assert all(isinstance(c, str) and ESADECIMALE.match(c) for c in colori.values())
        assert contrasto(str(colori["fondo"]), testo) >= 13


@pytest.mark.parametrize(
    "colore", [(255, 255, 0), (0, 255, 255), (255, 255, 255), (0, 0, 0), (128, 128, 128)]
)
def test_contrasto_anche_con_colori_estremi(colore: tuple[int, int, int]) -> None:
    risultato = tavolozza(_immagine(colore, sfondo=False), ADESSO)
    scuro, chiaro = risultato["scuro"], risultato["chiaro"]
    assert isinstance(scuro, dict)
    assert isinstance(chiaro, dict)
    assert contrasto(str(scuro["fondo"]), TESTO_SCURO) >= 13
    assert contrasto(str(chiaro["fondo"]), TESTO_CHIARO) >= 13


def test_immagine_in_bianco_e_nero_quasi_neutra() -> None:
    _, saturazione = tinta_dominante(_immagine((128, 128, 128)))
    assert saturazione < 0.1


@pytest.mark.parametrize(
    "dati", [b"", b"<svg xmlns='http://www.w3.org/2000/svg'/>", b"GIF89a corrotto", b"\x00" * 64]
)
def test_contenuti_non_validi(dati: bytes) -> None:
    with pytest.raises(ImmagineNonValida):
        tavolozza(dati, ADESSO)


def test_formato_non_ammesso() -> None:
    buffer = io.BytesIO()
    Image.new("RGB", (10, 10), (200, 0, 0)).save(buffer, format="BMP")
    with pytest.raises(ImmagineNonValida):
        tavolozza(buffer.getvalue(), ADESSO)


def test_contrasto_wcag() -> None:
    assert round(contrasto("#000000", "#FFFFFF"), 1) == 21.0
    assert round(contrasto("#777777", "#777777"), 1) == 1.0


@pytest.mark.parametrize(
    ("titolo", "seme"),
    [
        ("ONE TWO", "one two"),
        ("ONE TWO 25.11", "one two"),
        ("One Two - 12/11/2026", "one two"),
        ("PERREO 21 novembre", "perreo"),
        ("Città — Notte #3", "citta notte 3"),
    ],
)
def test_seme_come_nel_design(titolo: str, seme: str) -> None:
    assert normalizza_titolo(titolo) == seme
