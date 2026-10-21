"""Base degli adattatori `sito_html_<locale>` (EVENT_INGESTION.md §2.2; skill
`add-event-source` §3b): siti senza dati strutturati, letti con selettori CSS stabili.

Un adattatore specifico dichiara solo il nome e i selettori; la base legge le pagine con
`ClientHttpConforme` (seguendo la paginazione entro il limite di pagine), estrae i campi e li
normalizza con le funzioni comuni. Nessun dato oltre lo schema evento, nessuna immagine.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import ClassVar
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag
from pydantic import JsonValue

from noxa_worker.errori import ErroreFonte
from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from noxa_worker.fonti.comuni import evento_da_campi, id_esterno_da, prezzo_in_centesimi
from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.normalizzazione.date import combina, interpreta_iso, trova_data, trova_ora
from noxa_worker.normalizzazione.modelli import EventoNormalizzato
from noxa_worker.normalizzazione.testo import pulisci


@dataclass(frozen=True)
class SelettoriHtml:
    """Selettori CSS di un sito. `data` è il testo della data ("sab 17 ottobre", "17/10")
    oppure, con `attributo_data`, un attributo ISO 8601 (`datetime` di <time>)."""

    evento: str
    titolo: str
    data: str
    ora: str | None = None
    attributo_data: str | None = None
    descrizione: str | None = None
    link: str | None = None
    artisti: str | None = None
    generi: str | None = None
    prezzo: str | None = None
    note_ingresso: str | None = None
    pagina_successiva: str | None = None


def _testo(nodo: Tag, selettore: str | None) -> str | None:
    if selettore is None:
        return None
    trovato = nodo.select_one(selettore)
    return pulisci(trovato.get_text(" ")) or None if trovato else None


def _testi(nodo: Tag, selettore: str | None) -> list[JsonValue]:
    if selettore is None:
        return []
    return [t for el in nodo.select(selettore) if (t := pulisci(el.get_text(" ")))]


class AdattatoreSitoHtml:
    """Da estendere con `nome` e `selettori` (es. `sito_html_club_binario_7`)."""

    nome: ClassVar[str]
    tipo: ClassVar[TipoFonte] = TipoFonte.SITO_LOCALE
    selettori: ClassVar[SelettoriHtml]

    async def raccogli(self, fonte: Fonte, http: ClientHttpConforme) -> list[EventoGrezzo]:
        grezzi: list[EventoGrezzo] = []
        url: str | None = fonte.url
        visitate: set[str] = set()
        while url and url not in visitate and http.pagine_rimanenti > 0:
            visitate.add(url)
            risposta, pagina = await http.get_html(url)
            nodi = pagina.select(self.selettori.evento)
            if not nodi and not grezzi and self._sembra_cambiata(pagina):
                raise ErroreFonte(
                    "struttura della pagina cambiata: nessun evento con i selettori",
                    codice="STRUTTURA",
                )
            grezzi.extend(g for nodo in nodi if (g := self._grezzo(nodo, risposta.url)))
            url = self._successiva(pagina, risposta.url)
        return grezzi

    def normalizza(self, grezzo: EventoGrezzo, fonte: Fonte) -> EventoNormalizzato:
        return evento_da_campi(grezzo, fonte)

    def _sembra_cambiata(self, pagina: BeautifulSoup) -> bool:
        """Una pagina senza eventi va bene se lo dice; senza nemmeno il contenitore della
        lista è probabilmente cambiata (EVENT_INGESTION.md §8)."""
        return pagina.select_one(self.selettori.evento.split(" ")[0]) is None

    def _successiva(self, pagina: BeautifulSoup, base: str) -> str | None:
        if not self.selettori.pagina_successiva:
            return None
        link = pagina.select_one(self.selettori.pagina_successiva)
        destinazione = link.get("href") if link else None
        return urljoin(base, destinazione) if isinstance(destinazione, str) else None

    def _grezzo(self, nodo: Tag, base: str) -> EventoGrezzo | None:
        s = self.selettori
        titolo = _testo(nodo, s.titolo)
        if not titolo:
            return None
        inizio = self._inizio(nodo)
        link = nodo.select_one(s.link) if s.link else None
        href = link.get("href") if link else None
        url = urljoin(base, href) if isinstance(href, str) else base
        prezzo = prezzo_in_centesimi(_testo(nodo, s.prezzo))
        dati: dict[str, JsonValue] = {
            "titolo": titolo,
            "inizio": inizio.isoformat() if inizio else None,
            "ha_ora": inizio is not None,
            "fine": None,
            "fine_ha_ora": False,
            "descrizione": _testo(nodo, s.descrizione),
            "artisti": _testi(nodo, s.artisti),
            "etichette": _testi(nodo, s.generi),
            "note_ingresso": _testi(nodo, s.note_ingresso),
            "prezzo_centesimi": prezzo,
            "url_biglietti": None,
        }
        return EventoGrezzo(
            url=url,
            id_esterno=(url if url != base else id_esterno_da(titolo, str(dati["inizio"])))[:200],
            dati=dati,
        )

    def _inizio(self, nodo: Tag) -> datetime | None:
        s = self.selettori
        elemento = nodo.select_one(s.data)
        if elemento is None:
            return None
        if s.attributo_data:
            valore = elemento.get(s.attributo_data)
            if isinstance(valore, str):
                try:
                    letta = interpreta_iso(valore)
                except ValueError:
                    return None
                return letta if "T" in valore else None
            return None
        testo = pulisci(elemento.get_text(" "))
        giorno = trova_data(testo, datetime.now(UTC).date())
        ora = trova_ora(_testo(nodo, s.ora) or testo)
        if giorno is None or ora is None:
            return None
        return combina(giorno, ora)
