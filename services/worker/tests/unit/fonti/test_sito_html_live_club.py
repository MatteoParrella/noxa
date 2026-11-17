"""Adattatore del sito di Live Club su una pagina reale salvata il 2026-11-17."""

from uuid import UUID

import jsonschema
import pytest

from noxa_worker.errori import ErroreConformita, ErroreFonte, ErroreValidazione
from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from noxa_worker.fonti.sito_html import AdattatoreSitoHtml
from noxa_worker.fonti.sito_html_live_club import AdattatoreSitoHtmlLiveClub
from noxa_worker.normalizzazione.date import FUSO_ROMA
from tests.supporto import SitoFinto, client_conforme, leggi_dato
from tests.unit.test_schema_evento import SCHEMA

BASE = "https://www.liveclub.it"
FONTE = Fonte(
    id=UUID("00000000-0000-4000-8000-00000000f020"),
    locale_id=UUID("00000000-0000-4000-8000-00000000c020"),
    locale_nome="Live Club",
    tipo=TipoFonte.SITO_LOCALE,
    url=f"{BASE}/tutti-gli-eventi/",
    adattatore="sito_html_live_club",
    pagine_massime=10,
)


def _sito(robots: str = "User-agent: *\nDisallow: /wp-admin/\n") -> SitoFinto:
    sito = SitoFinto()
    sito.aggiungi(f"{BASE}/robots.txt", robots, tipo="text/plain")
    sito.aggiungi(
        FONTE.url, leggi_dato("pagine/sito_html_live_club/2026-11-17.html"), tipo="text/html"
    )
    return sito


async def _tutti() -> list[EventoGrezzo]:
    """Tutte le schede, senza il filtro dei 180 giorni che dipende dalla data di oggi."""
    adattatore = AdattatoreSitoHtmlLiveClub()
    return await AdattatoreSitoHtml.raccogli(adattatore, FONTE, client_conforme(_sito()))


def _per_titolo(grezzi: list[EventoGrezzo], titolo: str) -> EventoGrezzo:
    return next(g for g in grezzi if g.dati["titolo"] == titolo)


async def test_schede_senza_le_serate_annullate() -> None:
    grezzi = await _tutti()
    # 16 schede, una annullata (Steve 'n' Seagulls).
    assert len(grezzi) == 15
    assert all("Seagulls" not in str(g.dati["titolo"]) for g in grezzi)
    assert len({g.id_esterno for g in grezzi}) == 15
    assert grezzi[0].id_esterno == "liveclub-81013"
    assert grezzi[0].url == f"{BASE}/tutti-gli-eventi/#kamelot-17-novembre"


async def test_concerto_con_apertura_porte_prezzo_e_biglietti() -> None:
    adattatore = AdattatoreSitoHtmlLiveClub()
    evento = adattatore.normalizza(_per_titolo(await _tutti(), "Kamelot"), FONTE)
    # Apertura porte (18:30), non il primo orario della scheda (17:00, meet & greet).
    assert evento.inizio.astimezone(FUSO_ROMA).strftime("%d/%m/%Y %H:%M") == "17/11/2026 18:30"
    assert evento.prezzo_min_centesimi == 4500
    assert evento.url_biglietti == "https://www.vivaticket.com/it/ticket/kamelot/296226"
    # Nessuna età scritta: resta sconosciuta, quindi 18+ (R-21).
    assert evento.eta_minima is None


async def test_serata_con_eta_dichiarata_dal_locale() -> None:
    adattatore = AdattatoreSitoHtmlLiveClub()
    evento = adattatore.normalizza(_per_titolo(await _tutti(), "Puro Perreo"), FONTE)
    assert evento.eta_minima == 16
    # Apertura alle 23:00 del sabato 5 dicembre.
    assert evento.inizio.astimezone(FUSO_ROMA).strftime("%d/%m/%Y %H:%M") == "05/12/2026 23:00"
    assert evento.url_biglietti is not None
    assert evento.url_biglietti.startswith("https://www.ticketsms.it/event/Puro-Perreo")


async def test_senza_orari_la_serata_si_scarta() -> None:
    adattatore = AdattatoreSitoHtmlLiveClub()
    grezzo = _per_titolo(await _tutti(), "Chelsea Wolfe")
    assert grezzo.dati["ha_ora"] is False
    with pytest.raises(ErroreValidazione) as errore:
        adattatore.normalizza(grezzo, FONTE)
    assert errore.value.codice == "ORARIO_MANCANTE"


async def test_eventi_validi_per_lo_schema_condiviso() -> None:
    adattatore = AdattatoreSitoHtmlLiveClub()
    validi = [adattatore.normalizza(g, FONTE) for g in await _tutti() if g.dati["ha_ora"]]
    assert len(validi) == 8
    for evento in validi:
        jsonschema.validate(evento.model_dump(mode="json"), SCHEMA)


async def test_una_sola_pagina_senza_pagine_delle_serate() -> None:
    sito = _sito()
    await AdattatoreSitoHtmlLiveClub().raccogli(FONTE, client_conforme(sito))
    assert sito.percorsi() == ["/robots.txt", "/tutti-gli-eventi/"]
    assert AdattatoreSitoHtmlLiveClub.arricchisce_dal_dettaglio is False


async def test_robots_che_vieta_blocca_senza_leggere_la_pagina() -> None:
    sito = _sito(robots="User-agent: *\nDisallow: /\n")
    with pytest.raises(ErroreConformita):
        await AdattatoreSitoHtmlLiveClub().raccogli(FONTE, client_conforme(sito))
    assert sito.percorsi() == ["/robots.txt"]


async def test_struttura_cambiata_errore_esplicito() -> None:
    sito = _sito()
    sito.aggiungi(FONTE.url, "<html><body><main>Nuovo sito</main></body></html>", tipo="text/html")
    with pytest.raises(ErroreFonte) as errore:
        await AdattatoreSitoHtmlLiveClub().raccogli(FONTE, client_conforme(sito))
    assert errore.value.codice == "STRUTTURA"


async def test_pagina_senza_eventi_ma_con_la_griglia() -> None:
    sito = _sito()
    sito.aggiungi(FONTE.url, '<div class="bufev-grid"></div>', tipo="text/html")
    assert await AdattatoreSitoHtmlLiveClub().raccogli(FONTE, client_conforme(sito)) == []
