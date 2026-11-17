"""Adattatore del sito di Live Club, Trezzo sull'Adda (https://www.liveclub.it/tutti-gli-eventi/).

Verifica di conformità del 2026-11-11, ricontrollata il 2026-11-17 (skill `add-event-source`
§2): robots.txt vieta solo /wp-admin/; il sito non ha termini d'uso, solo l'informativa sulla
privacy. A novembre 2026 il sito ha tolto i dati strutturati schema.org letti da
`sito_jsonld` e /eventi/ rimanda a /tutti-gli-eventi/, dove ogni serata è una scheda
`article.bufev-card` completa: giorno nell'attributo `data-day`, orari, prezzi in cassa, note
d'ingresso («Ingresso riservato ai maggiori di 16 anni») e link ai biglietti. Basta quindi
una pagina per esecuzione, senza leggere le pagine delle serate. Nessuna immagine scaricata.

L'ora d'inizio è quella dell'apertura porte; senza, il primo orario della scheda. Le serate
senza nessun orario restano senza ora e la normalizzazione le scarta (ORARIO_MANCANTE),
come per gli altri siti. Le serate annullate non si raccolgono.
"""

from __future__ import annotations

import re
from datetime import UTC, date, datetime, time
from typing import ClassVar

from bs4 import Tag
from pydantic import JsonValue

from noxa_worker.fonti.base import EventoGrezzo, Fonte
from noxa_worker.fonti.comuni import prezzo_in_centesimi
from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.fonti.sito_html import AdattatoreSitoHtml, SelettoriHtml, entro_il_limite
from noxa_worker.normalizzazione.date import combina, trova_ora
from noxa_worker.normalizzazione.testo import pulisci

_ANNULLATA = re.compile(r"\b(?:annullat[oa]|cancellat[oa]|rinviat[oa])\b", re.IGNORECASE)
_APERTURA = re.compile(r"\bapertura porte\b", re.IGNORECASE)


class AdattatoreSitoHtmlLiveClub(AdattatoreSitoHtml):
    nome: ClassVar[str] = "sito_html_live_club"
    selettori: ClassVar[SelettoriHtml] = SelettoriHtml(
        evento=".bufev-grid article.bufev-card",
        titolo=".bufev-title",
        data=".bufev-bar",
        descrizione=".bufev-sub",
        note_ingresso=".bufev-note",
        immagine=".bufev-media img",
    )
    # Le schede dell'elenco hanno già biglietti, prezzi ed età.
    arricchisce_dal_dettaglio: ClassVar[bool] = False

    async def raccogli(self, fonte: Fonte, http: ClientHttpConforme) -> list[EventoGrezzo]:
        grezzi = await super().raccogli(fonte, http)
        return entro_il_limite(grezzi, datetime.now(UTC))

    def _grezzo(self, nodo: Tag, base: str) -> EventoGrezzo | None:
        grezzo = super()._grezzo(nodo, base)
        if grezzo is None or _annullata(nodo):
            return None
        giorno = _giorno(nodo)
        if giorno is None:
            return None
        ora = _ora_di_inizio(nodo)
        inizio = combina(giorno, ora).isoformat() if ora else giorno.isoformat()
        biglietti = nodo.select_one(".bufev-actions a.bufev-btn[href^='https://']")
        href = biglietti.get("href") if biglietti else None
        identificativo = nodo.get("data-id")
        slug = nodo.get("data-slug")
        categorie = nodo.get("data-cats")
        dati: dict[str, JsonValue] = {
            **grezzo.dati,
            "inizio": inizio,
            "ha_ora": ora is not None,
            "etichette": [categorie] if isinstance(categorie, str) and categorie else [],
            "prezzo_centesimi": _prezzo_minimo(nodo),
            "url_biglietti": href if isinstance(href, str) else None,
        }
        return EventoGrezzo(
            url=f"{base}#{slug}" if isinstance(slug, str) and slug else base,
            id_esterno=(
                f"liveclub-{identificativo}"
                if isinstance(identificativo, str)
                else grezzo.id_esterno
            ),
            dati=dati,
        )

    def _inizio(self, nodo: Tag) -> datetime | None:
        """Calcolato in `_grezzo` dall'attributo `data-day` e dagli orari della scheda."""
        return None


def _annullata(nodo: Tag) -> bool:
    titoli = " ".join(pulisci(el.get_text(" ")) for el in nodo.select(".bufev-title, .bufev-sub"))
    return bool(_ANNULLATA.search(titoli))


def _giorno(nodo: Tag) -> date | None:
    valore = nodo.get("data-day")
    if not isinstance(valore, str):
        return None
    try:
        return date.fromisoformat(valore)
    except ValueError:
        return None


def _ora_di_inizio(nodo: Tag) -> time | None:
    """Apertura porte; altrimenti il primo orario della scheda."""
    righe = nodo.select(".bufev-schedule:not(.bufev-prices) li")
    for riga in righe:
        if _APERTURA.search(riga.get_text(" ")):
            ora = trova_ora(pulisci(riga.get_text(" ")))
            if ora is not None:
                return ora
    for riga in righe:
        ora = trova_ora(pulisci(riga.get_text(" ")))
        if ora is not None:
            return ora
    return None


def _prezzo_minimo(nodo: Tag) -> int | None:
    prezzi = [
        p
        for el in nodo.select(".bufev-prices li b")
        if (p := prezzo_in_centesimi(el.get_text(" "))) is not None
    ]
    return min(prezzi) if prezzi else None
