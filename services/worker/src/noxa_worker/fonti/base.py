"""Interfaccia comune degli adattatori (EVENT_INGESTION.md §4)."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import ClassVar, Protocol
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, JsonValue

from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.normalizzazione.modelli import EventoNormalizzato


class TipoFonte(StrEnum):
    """Valori dell'enum `tipo_fonte` (DATA_MODEL.md §3)."""

    SITO_LOCALE = "sito_locale"
    INSTAGRAM = "instagram"
    RESIDENT_ADVISOR = "resident_advisor"
    XCEED = "xceed"
    DICE = "dice"


class Fonte(BaseModel):
    """Fonte da leggere, con i dati del suo locale."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: UUID
    locale_id: UUID
    locale_nome: str
    locale_comune: str | None = None
    tipo: TipoFonte
    # URL della pagina; per Instagram l'username senza @.
    url: str
    adattatore: str
    pagine_massime: int = Field(ge=1, le=50)


class EventoGrezzo(BaseModel):
    """Evento come lo descrive la fonte, prima della normalizzazione: un dizionario fedele ai
    campi letti e il link alla pagina originale."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    url: str
    id_esterno: str | None = Field(default=None, max_length=200)
    dati: dict[str, JsonValue]
    raccolto_il: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Adattatore(Protocol):
    nome: ClassVar[str]
    tipo: ClassVar[TipoFonte]

    async def raccogli(self, fonte: Fonte, http: ClientHttpConforme) -> list[EventoGrezzo]:
        """Legge la fonte e restituisce gli eventi trovati, senza scrivere nel database.

        Solleva ErroreConformita se robots.txt o i limiti lo impediscono, ErroreFonte per
        errori di rete o di struttura della pagina.
        """
        ...

    def normalizza(self, grezzo: EventoGrezzo, fonte: Fonte) -> EventoNormalizzato:
        """Converte un grezzo nello schema v1. Solleva ErroreValidazione se mancano dati."""
        ...
