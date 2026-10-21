"""Il modello Pydantic dell'evento e lo schema JSON condiviso con l'app coincidono."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import jsonschema
import pytest
from pydantic import ValidationError

from noxa_worker.normalizzazione.date import FUSO_ROMA
from noxa_worker.normalizzazione.modelli import (
    GENERI_AMMESSI,
    EventoNormalizzato,
    LocaleEvento,
    Origine,
    TipoOrigine,
)

SCHEMA: dict[str, Any] = json.loads(
    (Path(__file__).parents[4] / "packages/schemas/evento.schema.json").read_text(encoding="utf-8")
)


def _evento(**modifiche: object) -> EventoNormalizzato:
    dati: dict[str, object] = {
        "origine": Origine(
            tipo=TipoOrigine.SITO_LOCALE,
            fonte_id=UUID("00000000-0000-4000-8000-00000000f001"),
            url="https://binario7.example/eventi/x",
            raccolto_il=datetime(2026, 10, 15, 12, tzinfo=FUSO_ROMA),
        ),
        "locale": LocaleEvento(id=UUID("00000000-0000-4000-8000-00000000c001"), nome="Club"),
        "titolo": "Notte",
        "inizio": datetime(2026, 10, 17, 23, tzinfo=FUSO_ROMA),
        "riferimenti_alcol": False,
    }
    dati.update(modifiche)
    return EventoNormalizzato.model_validate(dati)


def test_evento_minimo_valido_per_lo_schema() -> None:
    jsonschema.validate(_evento().model_dump(mode="json"), SCHEMA)


def test_evento_completo_valido_per_lo_schema() -> None:
    evento = _evento(
        fine=datetime(2026, 10, 18, 5, tzinfo=FUSO_ROMA),
        eta_minima=16,
        generi=("techno", "indie"),
        artisti=("Nera Vale",),
        prezzo_min_centesimi=1500,
        url_biglietti="https://binario7.example/b",
        descrizione="Testo",
    )
    jsonschema.validate(evento.model_dump(mode="json"), SCHEMA)


def test_generi_coincidono_con_lo_schema() -> None:
    assert set(SCHEMA["properties"]["generi"]["items"]["enum"]) == GENERI_AMMESSI


@pytest.mark.parametrize(
    "modifiche",
    [
        {"eta_minima": 12},
        {"generi": ("polka",)},
        {"titolo": ""},
        {"inizio": datetime(2026, 10, 17, 23)},  # noqa: DTZ001 - di proposito senza fuso
        {"url_biglietti": "http://insicuro.example"},
    ],
)
def test_dati_non_validi_rifiutati(modifiche: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        _evento(**modifiche)


def test_origine_di_una_fonte_richiede_fonte_e_url() -> None:
    with pytest.raises(ValidationError):
        Origine(tipo=TipoOrigine.SITO_LOCALE, raccolto_il=datetime(2026, 1, 1, tzinfo=FUSO_ROMA))
