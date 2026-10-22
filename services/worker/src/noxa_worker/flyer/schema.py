"""Output del modello per un flyer (skill `flyer-parser`, contratto `FlyerEstratto`).

Tutti i campi dell'evento sono nullable perché il flyer può non riportarli. I vincoli
numerici (`ge`, `le`) li verifica Pydantic quando l'SDK valida la risposta, anche se lo
schema inviato all'API non li supporta tutti.
"""

from __future__ import annotations

from datetime import date, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Codici di `generi_musicali` (stessi di `normalizzazione.modelli.GENERI_AMMESSI`).
GenereMusicale = Literal[
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
]


class ConfidenzaCampi(BaseModel):
    """Confidenza 0-1 per i campi critici. Campi fissi (non un dizionario libero) perché
    l'output strutturato richiede oggetti con proprietà dichiarate."""

    model_config = ConfigDict(extra="forbid")

    titolo: float = Field(ge=0, le=1)
    nome_locale: float = Field(ge=0, le=1)
    data: float = Field(ge=0, le=1)
    ora_inizio: float = Field(ge=0, le=1)
    eta_minima: float = Field(ge=0, le=1)


class FlyerEstratto(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # False: l'immagine non è il flyer di un evento.
    e_un_evento: bool
    # Nudità, violenza, odio, contenuti sessuali che coinvolgono minori.
    contenuto_inappropriato: bool
    titolo: str | None
    nome_locale: str | None
    comune: str | None
    indirizzo: str | None
    # Giorno della serata come scritto sul flyer.
    data: date | None
    ora_inizio: time | None
    ora_fine: time | None
    # True se l'anno non è scritto sul flyer.
    anno_inferito: bool
    # None se non scritta.
    eta_minima: int | None = Field(ge=14, le=30)
    riferimenti_alcol: bool
    generi: list[GenereMusicale] = Field(max_length=5)
    artisti: list[str] = Field(max_length=20)
    prezzo_min_centesimi: int | None = Field(ge=0, le=100000)
    confidenza: ConfidenzaCampi

    def confidenza_complessiva(self) -> float:
        """Confidenza salvata in `caricamenti_flyer.confidenza`: il minimo tra titolo, locale
        e data."""
        return min(self.confidenza.titolo, self.confidenza.nome_locale, self.confidenza.data)
