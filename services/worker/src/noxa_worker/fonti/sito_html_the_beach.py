"""Adattatore del sito di The Beach, Milano (https://www.thebeachmilano.it/events).

Verifica di conformità del 2026-11-14 (skill `add-event-source` §2): robots.txt consente
`/events` e `/event/` a ogni user agent e vieta `/*calendar_timestamp=`, cioè la
navigazione tra i mesi del calendario, che quindi non si segue; le note legali
(https://www.thebeachmilano.it/note-legali) hanno solo i dati societari e il sito non ha
termini d'uso. Nessuna immagine scaricata: il link serve solo ai colori (ADR-0030).

Il calendario del mese mostra per ogni giorno solo l'immagine e un link «mostra»: titolo,
data e programma sono nella pagina della serata. Si leggono quindi il calendario e le
pagine delle serate da oggi in poi (il sito ne pubblica circa due settimane, 1 + 6–8
richieste per esecuzione), entro `pagine_massime` della fonte.

Il programma è testo libero con più orari ("apericena dalle ore 20:00 … club da 00:00"):
l'inizio è il primo "dalle HH:MM". Le pagine dicono "I nostri eventi sono riservati ai
MAGGIORENNI" e citano drink e bottiglie: età e alcol escono dal testo con le funzioni comuni.
"Target +30" indica il pubblico di una sala, non un limite d'età, e si toglie dal testo.
Il testo completo non si salva; la descrizione è solo il primo paragrafo.
"""

from __future__ import annotations

import re
from datetime import date, datetime, time
from typing import ClassVar
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag
from pydantic import JsonValue

from noxa_worker.errori import ErroreFonte
from noxa_worker.fonti.base import EventoGrezzo, Fonte
from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.fonti.sito_html import AdattatoreSitoHtml, SelettoriHtml
from noxa_worker.normalizzazione.date import FUSO_ROMA, combina, trova_data
from noxa_worker.normalizzazione.testo import pulisci

_ORA_INIZIO = re.compile(r"\bdall[ea]\s+(?:ore\s+)?(\d{1,2})[:.](\d{2})\b", re.IGNORECASE)
_GIORNO = re.compile(r"^(\d{4}-\d{2}-\d{2})")
# "Target +30": il pubblico a cui si rivolge una sala, non un limite d'età.
_TARGET = re.compile(r"\btarget\s*\+?\s*\d{2}\s*\+?", re.IGNORECASE)


def oggi() -> date:
    return datetime.now(FUSO_ROMA).date()


def link_delle_serate(calendario: BeautifulSoup, base: str, dal: date) -> list[str]:
    """Link delle serate del calendario dal giorno indicato, in ordine e senza ripetizioni."""
    giorni = calendario.select(".calendar-view-day")
    if not giorni:
        raise ErroreFonte(
            "struttura della pagina cambiata: nessun giorno nel calendario", codice="STRUTTURA"
        )
    link: list[str] = []
    for giorno in giorni:
        numero = giorno.select_one("time[datetime]")
        valore = numero.get("datetime") if numero else None
        trovato = _GIORNO.match(valore) if isinstance(valore, str) else None
        if trovato is None or date.fromisoformat(trovato.group(1)) < dal:
            continue
        for a in giorno.select("a[href*='/event/']"):
            href = a.get("href")
            if isinstance(href, str) and (url := urljoin(base, href)) not in link:
                link.append(url)
    return link


class AdattatoreSitoHtmlTheBeach(AdattatoreSitoHtml):
    nome: ClassVar[str] = "sito_html_the_beach"
    selettori: ClassVar[SelettoriHtml] = SelettoriHtml(
        evento="#block-tb-content",
        titolo=".txts-box-title",
        data=".txts-box-date",
        descrizione=".body-serata p",
        immagine=".block-header img",
    )

    async def raccogli(self, fonte: Fonte, http: ClientHttpConforme) -> list[EventoGrezzo]:
        risposta, calendario = await http.get_html(fonte.url)
        grezzi: list[EventoGrezzo] = []
        for url in link_delle_serate(calendario, risposta.url, oggi()):
            if http.pagine_rimanenti <= 0:
                break
            risposta_serata, pagina = await http.get_html(url)
            nodo = pagina.select_one(self.selettori.evento)
            if nodo is None or nodo.select_one(self.selettori.titolo) is None:
                raise ErroreFonte(
                    "struttura della pagina della serata cambiata", codice="STRUTTURA"
                )
            if grezzo := self._grezzo(nodo, risposta_serata.url):
                grezzi.append(grezzo)
        return grezzi

    def _grezzo(self, nodo: Tag, base: str) -> EventoGrezzo | None:
        grezzo = super()._grezzo(nodo, base)
        if grezzo is None:
            return None
        corpo = nodo.select_one(".body-serata")
        testo = pulisci(corpo.get_text(" ")) if corpo else ""
        dati: dict[str, JsonValue] = dict(grezzo.dati)
        # Solo per età, alcol e generi: il testo completo non si salva.
        dati["note_ingresso"] = [_TARGET.sub("", testo)] if testo else []
        dati["etichette"] = [testo] if testo else []
        return grezzo.model_copy(update={"dati": dati})

    def _inizio(self, nodo: Tag) -> datetime | None:
        data = nodo.select_one(self.selettori.data)
        corpo = nodo.select_one(".body-serata")
        if data is None or corpo is None:
            return None
        giorno = trova_data(pulisci(data.get_text(" ")), oggi())
        ora = _ORA_INIZIO.search(corpo.get_text(" "))
        if giorno is None or ora is None:
            return None
        ore, minuti = int(ora.group(1)), int(ora.group(2))
        if ore > 23 or minuti > 59:
            return None
        return combina(giorno, time(ore, minuti))
