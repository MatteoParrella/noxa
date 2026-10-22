"""Test unitari per noxa_worker.flyer.jobs (archivio e storage in memoria)."""

from __future__ import annotations

from datetime import UTC, date, datetime
from io import BytesIO
from typing import Any
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from PIL import Image

from noxa_worker.coda import ErroreJobDefinitivo, Job, TipoJob
from noxa_worker.flyer.archivio import CaricoFlyer, ImmagineElimina
from noxa_worker.flyer.jobs import GestoreFlyer
from noxa_worker.flyer.schema import ConfidenzaCampi, FlyerEstratto

# ─── Costanti di test ────────────────────────────────────────────────────────

ADESSO = datetime(2026, 11, 15, 21, 0, tzinfo=UTC)
CARICAMENTO_ID = UUID("00000000-0000-4000-8000-000000000001")
EVENTO_ID = UUID("00000000-0000-4000-8000-000000000002")
LOCALE_ID = UUID("00000000-0000-4000-8000-000000000003")


# ─── Fixture ─────────────────────────────────────────────────────────────────


def _jpeg(w: int = 200, h: int = 200) -> bytes:
    img = Image.new("RGB", (w, h), color=(50, 100, 150))
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _webp(w: int = 200, h: int = 200) -> bytes:
    img = Image.new("RGB", (w, h), color=(50, 100, 150))
    buf = BytesIO()
    img.save(buf, format="WEBP")
    return buf.getvalue()


def _carico(stato: str = "caricato") -> CaricoFlyer:
    return CaricoFlyer(
        id=CARICAMENTO_ID,
        storage_path=f"uploads/{CARICAMENTO_ID}.jpg",
        stato=stato,
    )


def _flyer_estratto() -> FlyerEstratto:
    return FlyerEstratto(
        e_un_evento=True,
        contenuto_inappropriato=False,
        titolo="Evento test",
        nome_locale="Locale test",
        comune="Milano",
        indirizzo=None,
        data=date(2026, 11, 15),
        ora_inizio=None,
        ora_fine=None,
        anno_inferito=False,
        eta_minima=18,
        riferimenti_alcol=False,
        generi=[],
        artisti=[],
        prezzo_min_centesimi=None,
        confidenza=ConfidenzaCampi(
            titolo=0.9, nome_locale=0.9, data=0.9, ora_inizio=0.0, eta_minima=0.9
        ),
    )


def _job(tipo: TipoJob, payload: dict[str, Any]) -> Job:
    return Job(id=1, tipo=tipo, payload=payload, tentativi=0, chiave_idempotenza="test")


def _gestore(
    *,
    archivio: Any = None,
    storage: Any = None,
    api_key: str = "",
) -> GestoreFlyer:
    arch = archivio or AsyncMock()
    stor = storage or AsyncMock()
    return GestoreFlyer(
        arch,
        stor,
        anthropic_api_key=api_key,
        modello="claude-opus-5-5",
        lato_max=1568,
        adesso=lambda: ADESSO,
    )


# ─── analizza_flyer ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_analizza_flyer_senza_api_key() -> None:
    """Senza API key il flyer viene messo in_revisione con solo il pHash."""
    archivio = AsyncMock()
    archivio.carica_caricamento.return_value = _carico()
    archivio.trova_duplicato_phash.return_value = None
    storage = AsyncMock()
    storage.scarica.return_value = _jpeg()

    gestore = _gestore(archivio=archivio, storage=storage, api_key="")
    job = _job(TipoJob.ANALIZZA_FLYER, {"caricamento_id": str(CARICAMENTO_ID)})
    await gestore.analizza_flyer(job)

    archivio.aggiorna_analisi.assert_called_once()
    kw = archivio.aggiorna_analisi.call_args.kwargs
    assert kw["stato"] == "in_revisione"
    assert kw["phash"] is not None
    assert len(kw["phash"]) == 16


@pytest.mark.asyncio
async def test_analizza_flyer_saltato_se_non_caricato() -> None:
    archivio = AsyncMock()
    archivio.carica_caricamento.return_value = _carico(stato="in_revisione")
    gestore = _gestore(archivio=archivio)
    job = _job(TipoJob.ANALIZZA_FLYER, {"caricamento_id": str(CARICAMENTO_ID)})
    await gestore.analizza_flyer(job)
    archivio.aggiorna_analisi.assert_not_called()


@pytest.mark.asyncio
async def test_analizza_flyer_caricamento_inesistente() -> None:
    archivio = AsyncMock()
    archivio.carica_caricamento.return_value = None
    gestore = _gestore(archivio=archivio)
    job = _job(TipoJob.ANALIZZA_FLYER, {"caricamento_id": str(CARICAMENTO_ID)})
    with pytest.raises(ErroreJobDefinitivo):
        await gestore.analizza_flyer(job)


@pytest.mark.asyncio
async def test_analizza_flyer_payload_non_valido() -> None:
    gestore = _gestore()
    job = _job(TipoJob.ANALIZZA_FLYER, {"caricamento_id": "non-un-uuid"})
    with pytest.raises(ErroreJobDefinitivo):
        await gestore.analizza_flyer(job)


@pytest.mark.asyncio
async def test_analizza_flyer_con_api_key_crea_evento() -> None:
    """Con API key e locale risolto viene creato un evento in_revisione."""
    archivio = AsyncMock()
    archivio.carica_caricamento.return_value = _carico()
    archivio.trova_duplicato_phash.return_value = None
    archivio.risolvi_locale.return_value = LOCALE_ID
    archivio.crea_evento_revisione.return_value = EVENTO_ID

    storage = AsyncMock()
    storage.scarica.return_value = _jpeg()

    gestore = _gestore(archivio=archivio, storage=storage, api_key="sk-test")

    estratto = _flyer_estratto()
    # L'estrattore restituisce il flyer pre-costruito: nessuna chiamata all'API.
    with pytest.MonkeyPatch().context() as mp:
        mp.setattr(
            "noxa_worker.flyer.jobs.estrai_da_immagine",
            AsyncMock(return_value=(estratto, 0.01)),
        )
        job = _job(TipoJob.ANALIZZA_FLYER, {"caricamento_id": str(CARICAMENTO_ID)})
        await gestore.analizza_flyer(job)

    kw = archivio.aggiorna_analisi.call_args.kwargs
    assert kw["stato"] == "in_revisione"
    assert kw["evento_id"] == EVENTO_ID


# ─── copia_immagine_flyer ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_copia_immagine_flyer_ok() -> None:
    archivio = AsyncMock()
    archivio.carica_caricamento.return_value = _carico(stato="approvato")

    storage = AsyncMock()
    storage.scarica.return_value = _jpeg(800, 600)

    gestore = _gestore(archivio=archivio, storage=storage)
    job = _job(
        TipoJob.COPIA_IMMAGINE_FLYER,
        {"caricamento_id": str(CARICAMENTO_ID), "evento_id": str(EVENTO_ID)},
    )
    await gestore.copia_immagine_flyer(job)

    storage.carica.assert_called_once()
    percorso = storage.carica.call_args.args[1]
    assert percorso == f"{EVENTO_ID}.webp"
    archivio.pubblica_immagine_flyer.assert_called_once_with(EVENTO_ID, f"{EVENTO_ID}.webp")


@pytest.mark.asyncio
async def test_copia_immagine_flyer_caricamento_inesistente() -> None:
    archivio = AsyncMock()
    archivio.carica_caricamento.return_value = None
    gestore = _gestore(archivio=archivio)
    job = _job(
        TipoJob.COPIA_IMMAGINE_FLYER,
        {"caricamento_id": str(CARICAMENTO_ID), "evento_id": str(EVENTO_ID)},
    )
    with pytest.raises(ErroreJobDefinitivo):
        await gestore.copia_immagine_flyer(job)


# ─── pulizia_flyer ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pulizia_flyer_nessuna_immagine() -> None:
    archivio = AsyncMock()
    archivio.immagini_da_eliminare.return_value = []
    gestore = _gestore(archivio=archivio)
    job = _job(TipoJob.PULIZIA_FLYER, {})
    await gestore.pulizia_flyer(job)
    archivio.segna_immagini_eliminate.assert_not_called()


@pytest.mark.asyncio
async def test_pulizia_flyer_elimina_e_segna() -> None:
    archivio = AsyncMock()
    archivio.immagini_da_eliminare.return_value = [
        ImmagineElimina(bucket="flyer-caricati", percorso="uploads/a.jpg"),
        ImmagineElimina(bucket="flyer-caricati", percorso="uploads/b.jpg"),
        ImmagineElimina(bucket="flyer-pubblicati", percorso="eventi/c.webp"),
    ]

    storage = AsyncMock()
    gestore = _gestore(archivio=archivio, storage=storage)
    job = _job(TipoJob.PULIZIA_FLYER, {})
    await gestore.pulizia_flyer(job)

    assert storage.elimina.call_count == 2
    segna_args = archivio.segna_immagini_eliminate.call_args.args[0]
    assert "uploads/a.jpg" in segna_args
    assert "uploads/b.jpg" in segna_args
    assert "eventi/c.webp" not in segna_args
