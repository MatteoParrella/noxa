"""Adattatore del sito di Alcatraz, Milano (https://alcatrazmilano.it/calendario/).

Verifica di conformità del 2026-11-14 (skill `add-event-source` §2): robots.txt consente
tutto a ogni user agent; il sito non ha pagine di termini d'uso e il regolamento
(https://alcatrazmilano.it/regolamento/) non parla di raccolta automatica. Si legge solo la
pagina del calendario: una richiesta per esecuzione, nessuna pagina di dettaglio, nessuna
immagine (il link serve solo ai colori della copertina, ADR-0030).

Le pagine degli eventi hanno un JSON-LD `Event` con la data sbagliata (1970): per questo si
usa l'HTML del calendario e non `sito_jsonld`.

Le schede hanno due impaginazioni: quelle grandi mostrano "Sab 14 Nov" e l'ora, quelle
piccole solo il giorno, con la data completa nell'attributo `title` del link ("21/11/2026").
Tutte hanno data e ora nell'attributo `title` della scheda ("21/11 23:00"), senza l'anno.

Età (regolamento, letto il 2026-11-14): le serate della categoria "Club Alcatraz" sono
riservate ai maggiorenni; ai concerti i minori entrano con regole decise dall'organizzatore
di ciascun evento, quindi per i concerti l'età resta non dichiarata (18, R-21).
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import ClassVar
from urllib.parse import urljoin

from bs4 import Tag
from pydantic import JsonValue

from noxa_worker.fonti.base import EventoGrezzo, Fonte
from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.fonti.sito_html import AdattatoreSitoHtml, SelettoriHtml, entro_il_limite
from noxa_worker.normalizzazione.date import combina, trova_data, trova_ora
from noxa_worker.normalizzazione.testo import pulisci

CATEGORIA_CLUB = "club alcatraz"
NOTA_CLUB = "Serata club riservata ai maggiorenni"
_SOLD_OUT = re.compile(r"\s*[-–]\s*sold\s*out\s*$", re.IGNORECASE)


class AdattatoreSitoHtmlAlcatraz(AdattatoreSitoHtml):
    nome: ClassVar[str] = "sito_html_alcatraz"
    selettori: ClassVar[SelettoriHtml] = SelettoriHtml(
        evento="section.ud_block__event-grid div.ud_event",
        titolo=".ud_event__title",
        data=".ud_event__date",
        link="a[href*='/eventi/']",
        generi=".ud_event__category",
        immagine="source[data-srcset]",
    )

    async def raccogli(self, fonte: Fonte, http: ClientHttpConforme) -> list[EventoGrezzo]:
        grezzi = await super().raccogli(fonte, http)
        return entro_il_limite(grezzi, datetime.now(UTC))

    def _grezzo(self, nodo: Tag, base: str) -> EventoGrezzo | None:
        grezzo = super()._grezzo(nodo, base)
        if grezzo is None:
            return None
        dati: dict[str, JsonValue] = dict(grezzo.dati)
        titolo = dati["titolo"]
        if isinstance(titolo, str):
            dati["titolo"] = _SOLD_OUT.sub("", titolo) or titolo
        categorie = dati["etichette"]
        if isinstance(categorie, list) and any(
            isinstance(c, str) and c.casefold() == CATEGORIA_CLUB for c in categorie
        ):
            dati["note_ingresso"] = [NOTA_CLUB]
        dati["url_biglietti"] = _biglietti(nodo)
        return grezzo.model_copy(update={"dati": dati})

    def _inizio(self, nodo: Tag) -> datetime | None:
        attributo = nodo.get("title")
        if not isinstance(attributo, str):
            return None
        ora = trova_ora(attributo)
        # La data completa del link, se c'è; altrimenti "21/11" con l'anno dedotto da oggi.
        link_data = nodo.select_one(".ud_event__date[title]")
        completa = link_data.get("title") if link_data else None
        testo_data = completa if isinstance(completa, str) else attributo.split(" ")[0]
        giorno = trova_data(pulisci(testo_data), datetime.now(UTC).date())
        if giorno is None or ora is None:
            return None
        # `combina` porta al giorno dopo gli orari prima delle 6: "14/11 00:00" è la notte
        # tra sabato 14 e domenica 15, come mostra la scheda ("Sab 14 Nov").
        return combina(giorno, ora)

    def _immagine(self, nodo: Tag, base: str) -> str | None:
        """Immagini caricate in differita: il link è in `data-srcset`, non in `src`."""
        sorgente = nodo.select_one("source[data-srcset]")
        valore = sorgente.get("data-srcset") if sorgente else None
        if not isinstance(valore, str) or not valore.strip():
            return None
        link = urljoin(base, valore.strip().split(" ")[0])
        return link if link.startswith(("http://", "https://")) else None


def _biglietti(nodo: Tag) -> str | None:
    link = nodo.select_one(".ud_event__link a[href]")
    href = link.get("href") if link else None
    return href if isinstance(href, str) and href.startswith("https://") else None
