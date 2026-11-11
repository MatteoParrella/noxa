"""Tavolozza della copertina generata da un'immagine della fonte (ADR-0030).

L'immagine arriva in memoria, si riduce a 64×64 e se ne cerca la tinta dominante: il colore
più presente tra quelli abbastanza saturi, con un peso per la saturazione. Dalla tinta si
costruiscono le due tavolozze con le stesse luminosità delle famiglie del design
(design/F-01-copertine-generate/ALGORITMO.md §4), quindi il contrasto del testo è sempre quello
previsto; lo si verifica comunque. L'immagine non si salva e non si analizza in altro modo.
"""

from __future__ import annotations

import colorsys
import io
import warnings
from datetime import datetime

from PIL import Image
from pydantic import JsonValue

LATO = 64
FORMATI = {"JPEG", "PNG", "WEBP", "GIF"}
PIXEL_MASSIMI = 40_000_000
TESTO_SCURO = "#F4F1EB"  # --copertina-testo nel tema scuro
TESTO_CHIARO = "#15181E"  # --copertina-testo nel tema chiaro
CONTRASTO_MINIMO = 13.0  # sul fondo; con la velatura del design resta ≥ 12,7:1

# Luminosità (HLS) e fattore di saturazione per ruolo, come nelle famiglie del design.
_SCURO = {"fondo": (0.075, 0.45), "1": (0.68, 1.0), "2": (0.30, 0.6), "bagliore": (0.24, 0.6)}
_CHIARO = {"fondo": (0.93, 0.6), "1": (0.28, 1.0), "2": (0.66, 0.6), "bagliore": (0.84, 0.6)}


class ImmagineNonValida(ValueError):
    """Il contenuto non è un'immagine leggibile e sicura da analizzare."""


def tinta_dominante(dati: bytes) -> tuple[float, float]:
    """Tinta e saturazione (HLS, 0–1) del colore che caratterizza l'immagine."""
    Image.MAX_IMAGE_PIXELS = PIXEL_MASSIMI
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(dati)) as immagine:
                if immagine.format not in FORMATI:
                    raise ImmagineNonValida(f"formato {immagine.format}")
                immagine.draft("RGB", (LATO * 4, LATO * 4))
                ridotta = immagine.convert("RGB")
                ridotta.thumbnail((LATO, LATO))
    except (OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as errore:
        raise ImmagineNonValida(str(errore)[:100]) from errore

    quantizzata = ridotta.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    tavolozza = quantizzata.getpalette() or []
    migliore: tuple[float, float, float] | None = None  # punteggio, tinta, saturazione
    piu_presente: tuple[int, float, float] | None = None
    for conteggio, indice in quantizzata.getcolors() or []:
        if not isinstance(indice, int):
            continue  # immagine in modalità P: l'indice è sempre un intero
        r, g, b = (tavolozza[indice * 3 + k] / 255 for k in range(3))
        tinta, luce, saturazione = colorsys.rgb_to_hls(r, g, b)
        if piu_presente is None or conteggio > piu_presente[0]:
            piu_presente = (conteggio, tinta, saturazione)
        if saturazione < 0.18 or not 0.12 < luce < 0.9:
            continue  # quasi grigio, nero o bianco: non caratterizza
        punteggio = conteggio * (0.3 + saturazione)
        if migliore is None or punteggio > migliore[0]:
            migliore = (punteggio, tinta, saturazione)
    if migliore is not None:
        return migliore[1], min(max(migliore[2], 0.35), 0.85)
    # Immagine in bianco e nero: tinta del colore più presente, quasi neutra.
    return (piu_presente[1] if piu_presente else 0.0), 0.06


def tavolozza(dati: bytes, adesso: datetime) -> dict[str, JsonValue]:
    """Valore di `eventi.copertina_colori` per l'immagine (formato del vincolo nel database)."""
    tinta, saturazione = tinta_dominante(dati)
    scuro = _tema(tinta, saturazione, _SCURO, TESTO_SCURO, scurisci=True)
    chiaro = _tema(tinta, saturazione, _CHIARO, TESTO_CHIARO, scurisci=False)
    return {
        "scuro": dict(scuro),
        "chiaro": dict(chiaro),
        "calcolata_il": adesso.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def _tema(
    tinta: float,
    saturazione: float,
    ruoli: dict[str, tuple[float, float]],
    testo: str,
    *,
    scurisci: bool,
) -> dict[str, JsonValue]:
    colori: dict[str, JsonValue] = {
        ruolo: _esadecimale(tinta, luce, saturazione * fattore)
        for ruolo, (luce, fattore) in ruoli.items()
    }
    luce, fattore = ruoli["fondo"]
    # Il fondo si sposta verso il nero (o il bianco) finché il testo non ha il contrasto voluto.
    while contrasto(str(colori["fondo"]), testo) < CONTRASTO_MINIMO:
        luce = luce - 0.01 if scurisci else luce + 0.01
        colori["fondo"] = _esadecimale(tinta, luce, saturazione * fattore)
    return colori


def _esadecimale(tinta: float, luce: float, saturazione: float) -> str:
    r, g, b = colorsys.hls_to_rgb(tinta, min(max(luce, 0.0), 1.0), min(saturazione, 1.0))
    return "#" + "".join(f"{round(c * 255):02X}" for c in (r, g, b))


def contrasto(primo: str, secondo: str) -> float:
    """Rapporto di contrasto WCAG 2.2 tra due colori #RRGGBB."""
    chiaro, scuro = sorted((_luminanza(primo), _luminanza(secondo)), reverse=True)
    return (chiaro + 0.05) / (scuro + 0.05)


def _luminanza(colore: str) -> float:
    canali = [int(colore[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    lineari = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in canali]
    return 0.2126 * lineari[0] + 0.7152 * lineari[1] + 0.0722 * lineari[2]
