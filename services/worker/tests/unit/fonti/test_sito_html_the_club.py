"""Adattatore del sito di The Club su una pagina reale salvata il 2026-11-11."""

from datetime import datetime
from uuid import UUID

import jsonschema
import pytest

from noxa_worker.errori import ErroreConformita, ErroreFonte
from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from noxa_worker.fonti.sito_html import AdattatoreSitoHtml
from noxa_worker.fonti.sito_html_the_club import AdattatoreSitoHtmlTheClub, entro_il_limite
from noxa_worker.normalizzazione.date import FUSO_ROMA
from tests.supporto import Orologio, SitoFinto, client_conforme, leggi_dato
from tests.unit.test_schema_evento import SCHEMA

BASE = "https://www.theclubmilano.com"
FONTE = Fonte(
    id=UUID("00000000-0000-4000-8000-00000000f010"),
    locale_id=UUID("00000000-0000-4000-8000-00000000c010"),
    locale_nome="The Club",
    tipo=TipoFonte.SITO_LOCALE,
    url=f"{BASE}/events",
    adattatore="sito_html_the_club",
    pagine_massime=5,
)


def _sito(robots: str = "User-agent: * \nCrawl-Delay: 20\n") -> SitoFinto:
    sito = SitoFinto()
    sito.aggiungi(f"{BASE}/robots.txt", robots, tipo="text/plain")
    sito.aggiungi(
        FONTE.url, leggi_dato("pagine/sito_html_the_club/2026-11-11.html"), tipo="text/html"
    )
    return sito


async def _tutti() -> list[EventoGrezzo]:
    """Tutte le schede, senza il filtro dei 180 giorni che dipende dalla data di oggi."""
    adattatore = AdattatoreSitoHtmlTheClub()
    return await AdattatoreSitoHtml.raccogli(adattatore, FONTE, client_conforme(_sito()))


async def test_tutte_le_schede_con_titolo_pulito_e_link() -> None:
    grezzi = await _tutti()
    assert len(grezzi) == 207
    assert [g.dati["titolo"] for g in grezzi[:5]] == [
        "ONE TWO",
        "ATLANTA",
        "FIRST CLASS",
        "GIRLS REPUBLIC",
        "SUPERBE",
    ]
    assert grezzi[0].url == f"{BASE}/event/one-two-wednesday-11-november"
    # ADR-0030: solo il link, per i colori della copertina; l'immagine non si scarica qui.
    immagine = grezzi[0].dati["immagine_url"]
    assert isinstance(immagine, str)
    assert immagine.startswith(f"{BASE}/upload/event/")
    assert len({g.id_esterno for g in grezzi}) == 207


async def test_inizio_e_fine_dopo_mezzanotte() -> None:
    adattatore = AdattatoreSitoHtmlTheClub()
    evento = adattatore.normalizza((await _tutti())[0], FONTE)
    assert evento.inizio.astimezone(FUSO_ROMA).strftime("%d/%m/%Y %H:%M") == "11/11/2026 23:30"
    assert evento.fine is not None
    assert evento.fine.astimezone(FUSO_ROMA).strftime("%d/%m/%Y %H:%M") == "12/11/2026 05:30"
    # Senza indicazioni del sito: età sconosciuta = 18 (R-21).
    assert evento.eta_minima is None or evento.eta_minima >= 18
    assert evento.origine.url == f"{BASE}/event/one-two-wednesday-11-november"


async def test_eventi_validi_per_lo_schema_condiviso() -> None:
    adattatore = AdattatoreSitoHtmlTheClub()
    for grezzo in (await _tutti())[:20]:
        evento = adattatore.normalizza(grezzo, FONTE)
        jsonschema.validate(evento.model_dump(mode="json"), SCHEMA)


async def test_fine_anno_e_cambio_di_anno() -> None:
    adattatore = AdattatoreSitoHtmlTheClub()
    inizi = [adattatore.normalizza(g, FONTE).inizio for g in await _tutti()]
    assert inizi == sorted(inizi)
    assert inizi[-1].astimezone(FUSO_ROMA).strftime("%d/%m/%Y") == "29/08/2027"


async def test_solo_entro_180_giorni() -> None:
    grezzi = await _tutti()
    adesso = datetime(2026, 11, 11, 9, 0, tzinfo=FUSO_ROMA)
    entro = entro_il_limite(grezzi, adesso)
    assert 0 < len(entro) < len(grezzi)
    ultimo = datetime.fromisoformat(str(entro[-1].dati["inizio"]))
    assert (ultimo - adesso).days < 180


async def test_una_sola_pagina_e_crawl_delay_rispettato() -> None:
    sito = _sito()
    orologio = Orologio()
    http = client_conforme(sito, orologio=orologio)
    await AdattatoreSitoHtmlTheClub().raccogli(FONTE, http)
    await http.get_testo(FONTE.url)
    assert sito.percorsi() == ["/robots.txt", "/events", "/events"]
    # Tra due pagine dello stesso dominio passano i 20 secondi di robots.txt, non i 5 minimi.
    assert sum(orologio.attese) >= 20


async def test_robots_che_vieta_blocca_senza_leggere_la_pagina() -> None:
    sito = _sito(robots="User-agent: *\nDisallow: /\n")
    with pytest.raises(ErroreConformita):
        await AdattatoreSitoHtmlTheClub().raccogli(FONTE, client_conforme(sito))
    assert sito.percorsi() == ["/robots.txt"]


async def test_struttura_cambiata_errore_esplicito() -> None:
    sito = _sito()
    sito.aggiungi(FONTE.url, "<html><body><main>Nuovo sito</main></body></html>", tipo="text/html")
    with pytest.raises(ErroreFonte) as errore:
        await AdattatoreSitoHtmlTheClub().raccogli(FONTE, client_conforme(sito))
    assert errore.value.codice == "STRUTTURA"


async def test_pagina_senza_eventi_ma_con_la_lista() -> None:
    sito = _sito()
    sito.aggiungi(FONTE.url, '<div class="event-list"></div>', tipo="text/html")
    assert await AdattatoreSitoHtmlTheClub().raccogli(FONTE, client_conforme(sito)) == []
