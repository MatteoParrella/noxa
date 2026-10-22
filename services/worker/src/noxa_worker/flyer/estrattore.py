"""Estrazione degli eventi dai flyer con Claude API (EVENT_INGESTION.md §5, ADR-0007).

Skill `flyer-parser`: prima di modificare prompt, schema o modello leggere quella skill.
"""

from __future__ import annotations

import base64
from datetime import date
from io import BytesIO
from typing import TYPE_CHECKING

import anthropic
import structlog
from PIL import Image, ImageOps
from pydantic import ValidationError

from noxa_worker.flyer.prompt import (
    PROMPT_SISTEMA,
    PROMPT_UTENTE,
    PROMPT_UTENTE_TESTO,
    PROMPT_VERSIONE,
)
from noxa_worker.flyer.schema import FlyerEstratto

if TYPE_CHECKING:
    pass

log = structlog.get_logger(__name__)

# Prezzi approssimativi in EUR (1 USD ≈ 0.92 EUR, 2026-10) per la stima del costo.
_PREZZI_EUR: dict[str, tuple[float, float]] = {
    "claude-opus-5-5": (3.68, 18.40),
    "claude-opus-5": (4.60, 23.00),
    "claude-sonnet-5-5": (1.84, 9.20),
    "claude-haiku-5-5": (0.092, 0.46),
}
_PREZZO_DEFAULT = (3.68, 18.40)


class ErroreEstrazione(Exception):
    """Errore nell'estrazione del flyer: con `recuperabile=False` il job fallisce subito."""

    def __init__(self, messaggio: str, *, recuperabile: bool) -> None:
        super().__init__(messaggio)
        self.recuperabile = recuperabile


def crea_client(chiave: str) -> anthropic.AsyncAnthropic:
    """Client asincrono Anthropic dalla chiave API."""
    return anthropic.AsyncAnthropic(api_key=chiave)


def prepara_immagine(dati: bytes, lato_max: int) -> tuple[bytes, str]:
    """Rimuove EXIF, orienta, ridimensiona e converte in JPEG.

    Restituisce (dati_jpeg, "image/jpeg").
    """
    try:
        img = Image.open(BytesIO(dati))
    except Exception as errore:
        raise ErroreEstrazione(f"immagine non leggibile: {errore}", recuperabile=False) from errore

    img_lavoro: Image.Image = ImageOps.exif_transpose(img)
    if img_lavoro.mode not in ("RGB", "RGBA"):
        img_lavoro = img_lavoro.convert("RGB")
    elif img_lavoro.mode == "RGBA":
        sfondo: Image.Image = Image.new("RGB", img_lavoro.size, (255, 255, 255))
        sfondo.paste(img_lavoro, mask=img_lavoro.split()[3])
        img_lavoro = sfondo

    w, h = img_lavoro.size
    if max(w, h) > lato_max:
        scala = lato_max / max(w, h)
        img_lavoro = img_lavoro.resize((int(w * scala), int(h * scala)), Image.Resampling.LANCZOS)

    output = BytesIO()
    # exif=b"" rimuove tutti i metadati EXIF (Pillow 9+).
    img_lavoro.save(output, format="JPEG", quality=92, exif=b"")
    return output.getvalue(), "image/jpeg"


def calcola_phash(dati: bytes) -> str:
    """Impronta percettiva di 64 bit come 16 caratteri esadecimali (dHash).

    Usa differenze orizzontali su una griglia 9×8: due immagini visivamente simili
    hanno distanza di Hamming bassa. Solo Pillow, senza dipendenze aggiuntive.
    """
    img = Image.open(BytesIO(dati)).convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    # tobytes() su mode "L" restituisce un bytes con un byte per pixel (0-255).
    pixel: bytes = img.tobytes()
    bits = "".join(
        "1" if pixel[riga * 9 + col] > pixel[riga * 9 + col + 1] else "0"
        for riga in range(8)
        for col in range(8)
    )
    return f"{int(bits, 2):016x}"


def stima_costo_eur(usage: anthropic.types.Usage, modello: str) -> float:
    """Costo stimato in EUR dalla risposta dell'API."""
    p_in, p_out = _PREZZI_EUR.get(modello, _PREZZO_DEFAULT)
    return (usage.input_tokens * p_in + usage.output_tokens * p_out) / 1_000_000


async def estrai_da_immagine(
    client: anthropic.AsyncAnthropic,
    modello: str,
    dati_jpeg: bytes,
    oggi_iso: str,
) -> tuple[FlyerEstratto, float]:
    """Estrae i dati dell'evento dal flyer. Restituisce (FlyerEstratto, costo_eur).

    - `anthropic.RateLimitError`, `anthropic.APIConnectionError`: riprova con backoff.
    - `ErroreEstrazione(recuperabile=False)`: il job fallisce subito.
    """
    immagine_b64 = base64.b64encode(dati_jpeg).decode()
    try:
        risposta = await client.messages.parse(
            model=modello,
            max_tokens=4096,
            system=PROMPT_SISTEMA,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": immagine_b64,
                            },
                        },
                        {"type": "text", "text": PROMPT_UTENTE.format(oggi=oggi_iso)},
                    ],
                }
            ],
            output_format=FlyerEstratto,
        )
    except anthropic.BadRequestError as errore:
        raise ErroreEstrazione(
            f"richiesta rifiutata dall'API: {errore}", recuperabile=False
        ) from errore
    except ValidationError as errore:
        raise ErroreEstrazione(
            f"risposta non valida rispetto allo schema: {errore}", recuperabile=False
        ) from errore

    if risposta.stop_reason == "refusal":
        raise ErroreEstrazione("rifiuto del modello (contenuto inappropriato)", recuperabile=False)

    estratto = risposta.parsed_output
    if estratto is None:
        raise ErroreEstrazione("risposta vuota dal modello", recuperabile=False)
    costo = stima_costo_eur(risposta.usage, modello)
    return estratto, costo


async def estrai_da_testo(
    client: anthropic.AsyncAnthropic,
    modello: str,
    testo: str,
    oggi_iso: str,
) -> tuple[FlyerEstratto, float]:
    """Estrae i dati dalla didascalia Instagram. Restituisce (FlyerEstratto, costo_eur)."""
    try:
        risposta = await client.messages.parse(
            model=modello,
            max_tokens=4096,
            system=PROMPT_SISTEMA,
            messages=[
                {
                    "role": "user",
                    "content": PROMPT_UTENTE_TESTO.format(oggi=oggi_iso, testo=testo),
                }
            ],
            output_format=FlyerEstratto,
        )
    except anthropic.BadRequestError as errore:
        raise ErroreEstrazione(
            f"richiesta rifiutata dall'API: {errore}", recuperabile=False
        ) from errore
    except ValidationError as errore:
        raise ErroreEstrazione(
            f"risposta non valida rispetto allo schema: {errore}", recuperabile=False
        ) from errore

    if risposta.stop_reason == "refusal":
        raise ErroreEstrazione("rifiuto del modello", recuperabile=False)

    estratto = risposta.parsed_output
    if estratto is None:
        raise ErroreEstrazione("risposta vuota dal modello", recuperabile=False)
    costo = stima_costo_eur(risposta.usage, modello)
    return estratto, costo


def oggi_iso(adesso: date) -> str:
    """Formatta la data come `AAAA-MM-GG` per il prompt."""
    return adesso.isoformat()


VERSIONE_PROMPT = PROMPT_VERSIONE
