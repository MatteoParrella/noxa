"""Pulizia dei testi raccolti: niente HTML, spazi regolari, lunghezze dello schema."""

from __future__ import annotations

import html
import re
import unicodedata

from bs4 import BeautifulSoup

_SPAZI = re.compile(r"\s+")
_TAG = re.compile(r"<[^>]+>")


def pulisci(testo: str | None) -> str:
    """Testo semplice su una riga: entità HTML decodificate, tag tolti, spazi ridotti."""
    if not testo:
        return ""
    valore = html.unescape(testo)
    if _TAG.search(valore):
        valore = BeautifulSoup(valore, "html.parser").get_text(" ")
    valore = unicodedata.normalize("NFC", valore)
    return _SPAZI.sub(" ", valore).strip()


def tronca(testo: str, massimo: int) -> str:
    """Taglia a `massimo` caratteri sull'ultimo spazio utile, con i puntini."""
    if len(testo) <= massimo:
        return testo
    taglio = testo[: massimo - 1]
    spazio = taglio.rfind(" ")
    if spazio > massimo // 2:
        taglio = taglio[:spazio]
    return taglio.rstrip(" ,;:.-") + "…"


def senza_accenti(testo: str) -> str:
    """Minuscole senza accenti (Unicode NFKD), come `private.normalizza_nome`."""
    scomposto = unicodedata.normalize("NFKD", testo)
    return "".join(c for c in scomposto if not unicodedata.combining(c)).lower()
