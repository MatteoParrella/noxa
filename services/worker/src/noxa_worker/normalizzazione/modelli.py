"""Evento normalizzato, schema v1 (`packages/schemas/evento.schema.json`, EVENT_INGESTION.md
§3.3). Il test `test_schema_evento.py` verifica che i dati prodotti siano validi per lo schema
JSON condiviso con l'app.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

VERSIONE_SCHEMA: Literal[1] = 1

# Codici di `generi_musicali` (migrazione del catalogo, DATA_MODEL.md §5.3).
GENERI_AMMESSI = frozenset(
    {
        "techno",
        "house",
        "hip_hop",
        "reggaeton",
        "commerciale",
        "latino",
        "drum_and_bass",
        "elettronica",
        "indie",
        "live",
        "altro",
    }
)


class TipoOrigine(StrEnum):
    """`origine.tipo` dello schema: un valore di `tipo_fonte` oppure `flyer`."""

    SITO_LOCALE = "sito_locale"
    INSTAGRAM = "instagram"
    RESIDENT_ADVISOR = "resident_advisor"
    XCEED = "xceed"
    DICE = "dice"
    FLYER = "flyer"


# Priorità delle fonti nella fusione (EVENT_INGESTION.md §7).
PRIORITA_ORIGINE: dict[TipoOrigine, int] = {
    TipoOrigine.SITO_LOCALE: 4,
    TipoOrigine.INSTAGRAM: 3,
    TipoOrigine.RESIDENT_ADVISOR: 2,
    TipoOrigine.XCEED: 2,
    TipoOrigine.DICE: 2,
    TipoOrigine.FLYER: 1,
}


def _con_fuso(valore: datetime) -> datetime:
    if valore.tzinfo is None or valore.utcoffset() is None:
        raise ValueError("data e ora senza fuso orario")
    return valore


DataOra = Annotated[datetime, AfterValidator(_con_fuso)]
UrlHttp = Annotated[str, Field(pattern=r"^https?://\S+$", max_length=2000)]


class Origine(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    tipo: TipoOrigine
    fonte_id: UUID | None = None
    caricamento_flyer_id: UUID | None = None
    url: UrlHttp | None = None
    id_esterno: str | None = Field(default=None, max_length=200)
    raccolto_il: DataOra

    @model_validator(mode="after")
    def _coerente(self) -> Origine:
        if self.tipo is TipoOrigine.FLYER:
            if self.caricamento_flyer_id is None or self.fonte_id is not None:
                raise ValueError("un flyer ha solo caricamento_flyer_id")
        elif self.fonte_id is None or self.url is None or self.caricamento_flyer_id is not None:
            raise ValueError("una fonte ha fonte_id e url")
        return self


class LocaleEvento(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    id: UUID | None = None
    nome: str = Field(min_length=1, max_length=120)
    comune: str | None = Field(default=None, max_length=80)
    indirizzo: str | None = Field(default=None, max_length=200)


class Estrazione(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    modello: str
    versione_prompt: str
    confidenza: float = Field(ge=0, le=1)
    confidenza_campi: dict[str, Annotated[float, Field(ge=0, le=1)]] = Field(default_factory=dict)
    anno_inferito: bool


class EventoNormalizzato(BaseModel):
    """Evento nel formato comune, prima della deduplicazione."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    versione_schema: Literal[1] = VERSIONE_SCHEMA
    origine: Origine
    locale: LocaleEvento
    titolo: str = Field(min_length=1, max_length=200)
    descrizione: str | None = Field(default=None, max_length=500)
    inizio: DataOra
    fine: DataOra | None = None
    # None = non indicata: diventa 18 (R-21).
    eta_minima: int | None = Field(default=None, ge=14, le=30)
    riferimenti_alcol: bool
    generi: tuple[str, ...] = Field(default=(), max_length=5)
    artisti: tuple[Annotated[str, Field(min_length=1, max_length=80)], ...] = Field(
        default=(), max_length=20
    )
    prezzo_min_centesimi: int | None = Field(default=None, ge=0, le=100_000)
    url_biglietti: Annotated[str, Field(pattern=r"^https://\S+$", max_length=2000)] | None = None
    estrazione: Estrazione | None = None

    @model_validator(mode="after")
    def _generi_validi(self) -> EventoNormalizzato:
        sconosciuti = set(self.generi) - GENERI_AMMESSI
        if sconosciuti:
            raise ValueError(f"generi non previsti: {sorted(sconosciuti)}")
        if len(set(self.generi)) != len(self.generi):
            raise ValueError("generi ripetuti")
        return self

    @property
    def priorita(self) -> int:
        return PRIORITA_ORIGINE[self.origine.tipo]

    def come_payload(self) -> dict[str, object]:
        """Payload JSON salvato in `eventi_grezzi.payload`, conforme allo schema."""
        return self.model_dump(mode="json", exclude_none=False)
