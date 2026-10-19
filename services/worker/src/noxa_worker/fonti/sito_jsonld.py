"""Adattatore `sito_jsonld`: dati strutturati schema.org `Event` nelle pagine dei locali
(JSON-LD o microdata) e feed iCal collegati (EVENT_INGESTION.md §2.2). È il primo da provare
per ogni sito: non richiede codice specifico."""

from __future__ import annotations

import json
from typing import ClassVar
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag
from pydantic import JsonValue

from noxa_worker.errori import ErroreConformita
from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from noxa_worker.fonti.comuni import (
    data_ora_iso,
    evento_da_campi,
    id_esterno_da,
    prezzo_in_centesimi,
)
from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.fonti.ical import e_ical, leggi_ical
from noxa_worker.normalizzazione.date import ha_ora
from noxa_worker.normalizzazione.modelli import EventoNormalizzato

TIPI_EVENTO = frozenset(
    {
        "Event",
        "MusicEvent",
        "DanceEvent",
        "Festival",
        "SocialEvent",
        "TheaterEvent",
        "ComedyEvent",
        "LiteraryEvent",
    }
)
# Proprietà che contengono altri oggetti in cui cercare eventi (Organization, Place, ItemList).
_CONTENITORI = ("@graph", "event", "events", "subEvent", "itemListElement", "item")
_ANNULLATO = ("EventCancelled", "EventPostponed")


class AdattatoreSitoJsonLd:
    nome: ClassVar[str] = "sito_jsonld"
    tipo: ClassVar[TipoFonte] = TipoFonte.SITO_LOCALE

    async def raccogli(self, fonte: Fonte, http: ClientHttpConforme) -> list[EventoGrezzo]:
        risposta = await http.get_testo(fonte.url)
        if e_ical(risposta.testo) or "text/calendar" in risposta.tipo_contenuto:
            return _da_ical(risposta.testo, risposta.url)

        pagina = BeautifulSoup(risposta.testo, "html.parser")
        grezzi = _da_json_ld(pagina, risposta.url) or _da_microdata(pagina, risposta.url)
        if grezzi:
            return grezzi

        # Nessun dato strutturato nella pagina: un feed iCal dichiarato con <link rel=alternate>.
        collegamento = pagina.find("link", attrs={"rel": "alternate", "type": "text/calendar"})
        if isinstance(collegamento, Tag) and isinstance(collegamento.get("href"), str):
            if http.pagine_rimanenti <= 0:
                raise ErroreConformita("limite di pagine raggiunto", codice="LIMITE_PAGINE")
            feed = await http.get_testo(urljoin(risposta.url, str(collegamento["href"])))
            if e_ical(feed.testo):
                return _da_ical(feed.testo, risposta.url)
        return []

    def normalizza(self, grezzo: EventoGrezzo, fonte: Fonte) -> EventoNormalizzato:
        return evento_da_campi(grezzo, fonte)


# ---------------------------------------------------------------------------------------------
# JSON-LD
# ---------------------------------------------------------------------------------------------


def _da_json_ld(pagina: BeautifulSoup, url_pagina: str) -> list[EventoGrezzo]:
    eventi: list[EventoGrezzo] = []
    for script in pagina.find_all("script", attrs={"type": "application/ld+json"}):
        contenuto = script.string or script.get_text()
        try:
            dati: JsonValue = json.loads(contenuto, strict=False)
        except json.JSONDecodeError:
            continue
        for oggetto in _oggetti_evento(dati):
            grezzo = _grezzo_da_oggetto(oggetto, url_pagina)
            if grezzo is not None:
                eventi.append(grezzo)
    return _senza_doppioni(eventi)


def _oggetti_evento(dati: JsonValue, profondita: int = 0) -> list[dict[str, JsonValue]]:
    if profondita > 6:
        return []
    if isinstance(dati, list):
        return [o for elemento in dati for o in _oggetti_evento(elemento, profondita + 1)]
    if not isinstance(dati, dict):
        return []
    trovati: list[dict[str, JsonValue]] = []
    tipi = dati.get("@type")
    lista_tipi = tipi if isinstance(tipi, list) else [tipi]
    if any(isinstance(t, str) and t.rsplit("/", 1)[-1] in TIPI_EVENTO for t in lista_tipi):
        trovati.append(dati)
    for chiave in _CONTENITORI:
        if chiave in dati:
            trovati.extend(_oggetti_evento(dati[chiave], profondita + 1))
    return trovati


def _grezzo_da_oggetto(oggetto: dict[str, JsonValue], url_pagina: str) -> EventoGrezzo | None:
    stato = oggetto.get("eventStatus")
    if isinstance(stato, str) and stato.rsplit("/", 1)[-1] in _ANNULLATO:
        return None
    titolo = _testo(oggetto.get("name"))
    inizio = _testo(oggetto.get("startDate"))
    if not titolo or not inizio:
        return None
    fine = _testo(oggetto.get("endDate"))
    url_evento = _testo(oggetto.get("url"))
    url = urljoin(url_pagina, url_evento) if url_evento else url_pagina
    identificativo = _testo(oggetto.get("@id")) or (url if url != url_pagina else None)
    offerte = _offerte(oggetto.get("offers"))
    artisti: list[JsonValue] = list(_nomi(oggetto.get("performer")))
    etichette: list[JsonValue] = [*_nomi(oggetto.get("genre")), *_nomi(oggetto.get("keywords"))]
    note: list[JsonValue] = [t for t in (_testo(oggetto.get("typicalAgeRange")),) if t]
    dati: dict[str, JsonValue] = {
        "titolo": titolo,
        "inizio": inizio,
        "ha_ora": ha_ora(inizio),
        "fine": fine,
        "fine_ha_ora": bool(fine and ha_ora(fine)),
        "descrizione": _testo(oggetto.get("description")),
        "artisti": artisti,
        "etichette": etichette,
        "note_ingresso": note,
        "prezzo_centesimi": offerte[0],
        "url_biglietti": offerte[1],
    }
    return EventoGrezzo(
        url=url,
        id_esterno=(identificativo or id_esterno_da(titolo, inizio))[:200],
        dati=dati,
    )


def _testo(valore: JsonValue | None) -> str | None:
    if isinstance(valore, str) and valore.strip():
        return valore.strip()
    if isinstance(valore, dict):
        return _testo(valore.get("@value") or valore.get("name"))
    return None


def _nomi(valore: JsonValue | None) -> list[str]:
    elementi = valore if isinstance(valore, list) else [valore]
    nomi: list[str] = []
    for elemento in elementi:
        if isinstance(elemento, str):
            nomi.extend(p.strip() for p in elemento.split(",") if p.strip())
        elif isinstance(elemento, dict):
            nome = _testo(elemento.get("name"))
            if nome:
                nomi.append(nome)
    return nomi


def _offerte(valore: JsonValue | None) -> tuple[int | None, str | None]:
    """Prezzo minimo in centesimi e link ai biglietti."""
    elementi = valore if isinstance(valore, list) else [valore]
    prezzi: list[int] = []
    link: str | None = None
    for offerta in elementi:
        if not isinstance(offerta, dict):
            continue
        for campo in ("lowPrice", "price"):
            prezzo = prezzo_in_centesimi(offerta.get(campo))
            if prezzo is not None:
                prezzi.append(prezzo)
                break
        link = link or _testo(offerta.get("url"))
    return (min(prezzi) if prezzi else None, link)


# ---------------------------------------------------------------------------------------------
# Microdata
# ---------------------------------------------------------------------------------------------


def _da_microdata(pagina: BeautifulSoup, url_pagina: str) -> list[EventoGrezzo]:
    eventi: list[EventoGrezzo] = []
    for nodo in pagina.find_all(itemtype=True):
        tipo = str(nodo.get("itemtype", "")).rsplit("/", 1)[-1]
        if tipo not in TIPI_EVENTO:
            continue
        oggetto: dict[str, JsonValue] = {"@type": tipo}
        for proprieta in nodo.find_all(itemprop=True):
            nome = str(proprieta.get("itemprop"))
            if nome in oggetto:
                continue
            valore = (
                proprieta.get("content")
                or proprieta.get("datetime")
                or proprieta.get("href")
                or proprieta.get_text(" ", strip=True)
            )
            oggetto[nome] = str(valore)
        if "lowPrice" in oggetto or "price" in oggetto:
            oggetto["offers"] = {"price": oggetto.get("lowPrice") or oggetto.get("price")}
        grezzo = _grezzo_da_oggetto(oggetto, url_pagina)
        if grezzo is not None:
            eventi.append(grezzo)
    return _senza_doppioni(eventi)


# ---------------------------------------------------------------------------------------------
# iCal
# ---------------------------------------------------------------------------------------------


def _da_ical(testo: str, url_pagina: str) -> list[EventoGrezzo]:
    eventi: list[EventoGrezzo] = []
    for evento in leggi_ical(testo):
        if evento.annullato or not evento.titolo or evento.inizio is None:
            continue
        inizio, con_ora = data_ora_iso(evento.inizio)
        fine, fine_con_ora = data_ora_iso(evento.fine) if evento.fine else (None, False)
        url = urljoin(url_pagina, evento.url) if evento.url else url_pagina
        eventi.append(
            EventoGrezzo(
                url=url,
                id_esterno=(evento.uid or id_esterno_da(evento.titolo, inizio))[:200],
                dati={
                    "titolo": evento.titolo,
                    "inizio": inizio,
                    "ha_ora": con_ora,
                    "fine": fine,
                    "fine_ha_ora": fine_con_ora,
                    "descrizione": evento.descrizione,
                    "artisti": [],
                    "etichette": [],
                    "note_ingresso": [],
                    "prezzo_centesimi": None,
                    "url_biglietti": None,
                },
            )
        )
    return _senza_doppioni(eventi)


def _senza_doppioni(eventi: list[EventoGrezzo]) -> list[EventoGrezzo]:
    visti: set[str | None] = set()
    unici: list[EventoGrezzo] = []
    for evento in eventi:
        if evento.id_esterno not in visti:
            visti.add(evento.id_esterno)
            unici.append(evento)
    return unici
