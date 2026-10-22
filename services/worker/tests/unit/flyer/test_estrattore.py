"""Test unitari per noxa_worker.flyer.estrattore (nessuna chiamata di rete reale)."""

from __future__ import annotations

from datetime import date
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock

import pytest
from PIL import Image

from noxa_worker.flyer.estrattore import (
    ErroreEstrazione,
    calcola_phash,
    estrai_da_immagine,
    oggi_iso,
    prepara_immagine,
    stima_costo_eur,
)
from noxa_worker.flyer.schema import ConfidenzaCampi, FlyerEstratto

# ─── Fixture immagini sintetiche ────────────────────────────────────────────


def _jpeg(w: int = 100, h: int = 100) -> bytes:
    """Immagine JPEG RGB sintetica."""
    img = Image.new("RGB", (w, h), color=(200, 100, 50))
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _png_rgba(w: int = 100, h: int = 100) -> bytes:
    img = Image.new("RGBA", (w, h), color=(200, 100, 50, 128))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _risposta_modello(estratto: FlyerEstratto) -> MagicMock:
    """Risposta mock di `client.messages.parse()`."""
    mock = MagicMock()
    mock.stop_reason = "end_turn"
    mock.parsed_output = estratto
    mock.usage = MagicMock(input_tokens=100, output_tokens=50)
    return mock


def _flyer_evento() -> FlyerEstratto:
    return FlyerEstratto(
        e_un_evento=True,
        contenuto_inappropriato=False,
        titolo="Notte Techno",
        nome_locale="Magazzini Generali",
        comune="Milano",
        indirizzo="Via Pietrasanta 14",
        data=date(2026, 11, 15),
        ora_inizio=None,
        ora_fine=None,
        anno_inferito=False,
        eta_minima=18,
        riferimenti_alcol=False,
        generi=["techno"],
        artisti=["DJ Marco"],
        prezzo_min_centesimi=1500,
        confidenza=ConfidenzaCampi(
            titolo=0.9, nome_locale=0.95, data=0.9, ora_inizio=0.0, eta_minima=0.8
        ),
    )


# ─── prepara_immagine ────────────────────────────────────────────────────────


def test_prepara_immagine_jpeg_invariato() -> None:
    dati, mime = prepara_immagine(_jpeg(400, 300), 1568)
    assert mime == "image/jpeg"
    assert len(dati) > 0
    img = Image.open(BytesIO(dati))
    assert img.size == (400, 300)


def test_prepara_immagine_ridimensiona() -> None:
    dati, _ = prepara_immagine(_jpeg(3000, 2000), 1568)
    img = Image.open(BytesIO(dati))
    # Rounding integer può dare 1568 o 1567; il vincolo è <= lato_max.
    assert max(img.size) <= 1568
    assert max(img.size) >= 1566


def test_prepara_immagine_rgba_converte_rgb() -> None:
    dati, _ = prepara_immagine(_png_rgba(), 1568)
    img = Image.open(BytesIO(dati))
    assert img.mode == "RGB"


def test_prepara_immagine_dati_corrotti() -> None:
    with pytest.raises(ErroreEstrazione) as exc:
        prepara_immagine(b"non-un-immagine", 1568)
    assert not exc.value.recuperabile


# ─── calcola_phash ────────────────────────────────────────────────────────────


def test_calcola_phash_formato() -> None:
    ph = calcola_phash(_jpeg())
    assert len(ph) == 16
    assert all(c in "0123456789abcdef" for c in ph)


def test_calcola_phash_identico() -> None:
    dati = _jpeg()
    assert calcola_phash(dati) == calcola_phash(dati)


def test_calcola_phash_immagini_diverse_hash_diverso() -> None:
    # Scacchiera vs grigio uniforme: hashes sicuramente diversi.
    scacchiera = Image.new("L", (100, 100))
    for x in range(100):
        for y in range(100):
            scacchiera.putpixel((x, y), 255 if (x // 10 + y // 10) % 2 == 0 else 0)
    grigio = Image.new("L", (100, 100), color=128)
    buf1, buf2 = BytesIO(), BytesIO()
    scacchiera.save(buf1, format="PNG")
    grigio.save(buf2, format="PNG")
    assert calcola_phash(buf1.getvalue()) != calcola_phash(buf2.getvalue())


# ─── stima_costo_eur ──────────────────────────────────────────────────────────


def test_stima_costo_eur_opus() -> None:
    uso = MagicMock(input_tokens=1_000_000, output_tokens=1_000_000)
    costo = stima_costo_eur(uso, "claude-opus-5-5")
    assert costo == pytest.approx(22.08, rel=0.01)


def test_stima_costo_eur_modello_sconosciuto_usa_default() -> None:
    uso = MagicMock(input_tokens=0, output_tokens=0)
    assert stima_costo_eur(uso, "modello-inesistente") == 0.0


# ─── estrai_da_immagine ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_estrai_da_immagine_ok() -> None:
    atteso = _flyer_evento()
    client = AsyncMock()
    client.messages.parse = AsyncMock(return_value=_risposta_modello(atteso))

    estratto, costo = await estrai_da_immagine(client, "claude-opus-5-5", _jpeg(), "2026-11-01")

    assert estratto.e_un_evento is True
    assert estratto.titolo == "Notte Techno"
    assert costo >= 0.0
    client.messages.parse.assert_called_once()


@pytest.mark.asyncio
async def test_estrai_da_immagine_refusal() -> None:
    client = AsyncMock()
    mock_risp = MagicMock(stop_reason="refusal", parsed_output=None)
    mock_risp.usage = MagicMock(input_tokens=10, output_tokens=0)
    client.messages.parse = AsyncMock(return_value=mock_risp)

    with pytest.raises(ErroreEstrazione) as exc:
        await estrai_da_immagine(client, "claude-opus-5-5", _jpeg(), "2026-11-01")
    assert not exc.value.recuperabile


@pytest.mark.asyncio
async def test_estrai_da_immagine_bad_request() -> None:
    import anthropic

    client = AsyncMock()
    client.messages.parse = AsyncMock(
        side_effect=anthropic.BadRequestError(
            message="moderation", response=MagicMock(status_code=400), body={}
        )
    )

    with pytest.raises(ErroreEstrazione) as exc:
        await estrai_da_immagine(client, "claude-opus-5-5", _jpeg(), "2026-11-01")
    assert not exc.value.recuperabile


@pytest.mark.asyncio
async def test_estrai_da_immagine_rate_limit_propagato() -> None:
    import anthropic

    client = AsyncMock()
    client.messages.parse = AsyncMock(
        side_effect=anthropic.RateLimitError(
            message="rate limit", response=MagicMock(status_code=429), body={}
        )
    )

    with pytest.raises(anthropic.RateLimitError):
        await estrai_da_immagine(client, "claude-opus-5-5", _jpeg(), "2026-11-01")


# ─── oggi_iso ────────────────────────────────────────────────────────────────


def test_oggi_iso_formato() -> None:
    assert oggi_iso(date(2026, 11, 1)) == "2026-11-01"
