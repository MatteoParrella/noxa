"""Adattatore del sito di The Club, Milano (https://www.theclubmilano.com/events).

Verifica di conformità del 2026-11-11 (skill `add-event-source` §2): robots.txt consente
tutto con `Crawl-delay: 20`, rispettato da `ClientHttpConforme`; i termini
(https://www.theclubmilano.com/terms-and-conditions) regolano la vendita dei biglietti e non
vietano la raccolta automatica. Si legge la pagina dell'elenco e, per le serate dei
prossimi 45 giorni ancora senza biglietti, la loro pagina (al massimo 8 per esecuzione,
`fonti/dettaglio.py`): lì ci sono il prezzo della prevendita, la musica e la regola
d'ingresso («Non sono ammessi minorenni»). La prevendita si compra sulla pagina stessa
della serata, che quindi è anche il link ai biglietti. Nessuna immagine scaricata.

Le schede hanno data e ora in inglese ("Wed, 11th Nov 2026 | 23:30 - Thu, 12 Nov 05:30") e
il titolo ripete la data ("ONE TWO - Wednesday 11 November"): la data si toglie dal titolo e
l'ora dopo il trattino diventa la fine. Il sito pubblica le serate fisse per molti mesi:
quelle oltre il limite della validazione (180 giorni) non si raccolgono, per non riempire gli
scarti a ogni esecuzione.
"""

from __future__ import annotations

import re
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import ClassVar

from bs4 import BeautifulSoup, Tag

from noxa_worker.fonti.base import EventoGrezzo, Fonte
from noxa_worker.fonti.dettaglio import DatiDettaglio, leggi_dettaglio
from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.fonti.sito_html import AdattatoreSitoHtml, SelettoriHtml, entro_il_limite
from noxa_worker.normalizzazione.date import combina, interpreta_iso, trova_data, trova_ora
from noxa_worker.normalizzazione.testo import pulisci

_DATA_NEL_TITOLO = re.compile(
    r"\s*[-–]\s*(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*$",
    re.IGNORECASE,
)


class AdattatoreSitoHtmlTheClub(AdattatoreSitoHtml):
    nome: ClassVar[str] = "sito_html_the_club"
    selettori: ClassVar[SelettoriHtml] = SelettoriHtml(
        evento=".event-list .boxinner",
        titolo=".event-title",
        data=".event-date",
        link=".imgbox a",
        immagine=".imgbox img",
    )

    async def raccogli(self, fonte: Fonte, http: ClientHttpConforme) -> list[EventoGrezzo]:
        grezzi = await super().raccogli(fonte, http)
        return entro_il_limite(grezzi, datetime.now(UTC))

    def dettaglio(self, pagina: BeautifulSoup, url: str) -> DatiDettaglio:
        letto = leggi_dettaglio(pagina, url)
        # La prevendita si compra nella finestra «ticketModel» della pagina della serata.
        if letto.url_biglietti is None and pagina.select_one("#ticketModel") is not None:
            return replace(letto, url_biglietti=url if url.startswith("https://") else None)
        return letto

    def _grezzo(self, nodo: Tag, base: str) -> EventoGrezzo | None:
        grezzo = super()._grezzo(nodo, base)
        if grezzo is None:
            return None
        dati = dict(grezzo.dati)
        titolo = dati["titolo"]
        if isinstance(titolo, str):
            dati["titolo"] = _DATA_NEL_TITOLO.sub("", titolo) or titolo
        fine = _fine(nodo, dati["inizio"])
        if fine is not None:
            dati["fine"] = fine.isoformat()
            dati["fine_ha_ora"] = True
        return grezzo.model_copy(update={"dati": dati})


def _fine(nodo: Tag, inizio_iso: object) -> datetime | None:
    """La parte dopo " - " della data ("Thu, 12 Nov 05:30"), riferita all'inizio."""
    elemento = nodo.select_one(".event-date")
    if elemento is None or not isinstance(inizio_iso, str):
        return None
    _, separatore, coda = pulisci(elemento.get_text(" ")).partition(" - ")
    if not separatore:
        return None
    inizio = interpreta_iso(inizio_iso)
    giorno, ora = trova_data(coda, inizio.date()), trova_ora(coda)
    if giorno is None or ora is None:
        return None
    # `combina` sposta al giorno dopo gli orari prima delle 6, ma qui il giorno è già quello.
    fine = combina(giorno, ora) - (timedelta(days=1) if ora.hour < 6 else timedelta())
    return fine if fine > inizio else None
