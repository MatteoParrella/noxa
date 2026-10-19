from datetime import UTC, datetime
from uuid import UUID

import jsonschema
import pytest

from noxa_worker.errori import ErroreConformita, ErroreValidazione
from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from noxa_worker.fonti.sito_jsonld import AdattatoreSitoJsonLd
from noxa_worker.normalizzazione.date import FUSO_ROMA
from noxa_worker.normalizzazione.modelli import EventoNormalizzato
from tests.supporto import SitoFinto, client_conforme, leggi_dato
from tests.unit.test_schema_evento import SCHEMA

FONTE = Fonte(
    id=UUID("00000000-0000-4000-8000-00000000f001"),
    locale_id=UUID("00000000-0000-4000-8000-00000000c001"),
    locale_nome="Club Binario 7",
    locale_comune="Monza",
    tipo=TipoFonte.SITO_LOCALE,
    url="https://binario7.example/agenda",
    adattatore="sito_jsonld",
    pagine_massime=5,
)
ADATTATORE = AdattatoreSitoJsonLd()


def _sito(pagina: str, url: str = FONTE.url) -> SitoFinto:
    sito = SitoFinto()
    sito.aggiungi(url, leggi_dato(f"pagine/sito_jsonld/{pagina}"), tipo="text/html")
    return sito


async def _raccogli(pagina: str, fonte: Fonte = FONTE) -> list[EventoGrezzo]:
    return await ADATTATORE.raccogli(fonte, client_conforme(_sito(pagina, fonte.url)))


def _normalizzati(grezzi: list[EventoGrezzo]) -> dict[str, EventoNormalizzato]:
    risultato = {}
    for grezzo in grezzi:
        try:
            evento = ADATTATORE.normalizza(grezzo, FONTE)
        except ErroreValidazione:
            continue
        risultato[evento.titolo] = evento
    return risultato


async def test_json_ld_con_graph_e_eventi_annidati() -> None:
    grezzi = await _raccogli("agenda_jsonld.html")
    titoli = [g.dati["titolo"] for g in grezzi]
    # L'evento annullato non viene raccolto; il JSON non valido viene ignorato.
    assert titoli == [
        "Notte Ferrovia &amp; friends",
        "Indie al Binario",
        "After Hours",
        "Data senza orario",
    ]


async def test_campi_normalizzati() -> None:
    eventi = _normalizzati(await _raccogli("agenda_jsonld.html"))
    notte = eventi["Notte Ferrovia & friends"]
    assert notte.inizio == datetime(2026, 10, 17, 23, 0, tzinfo=FUSO_ROMA)
    assert notte.fine == datetime(2026, 10, 18, 5, 0, tzinfo=FUSO_ROMA)
    assert notte.descrizione == "Techno e house fino all'alba nella sala grande."
    assert notte.generi == ("techno",)
    assert notte.artisti == ("Nera Vale", "DJ Corrado B.")
    assert notte.prezzo_min_centesimi == 1500
    assert notte.url_biglietti == "https://binario7.example/biglietti/nf"
    assert notte.origine.url == "https://binario7.example/eventi/notte-ferrovia"
    assert notte.origine.id_esterno == "https://binario7.example/eventi/notte-ferrovia"
    assert notte.eta_minima is None  # R-21: non dichiarata, diventa 18
    assert not notte.riferimenti_alcol

    indie = eventi["Indie al Binario"]
    assert indie.eta_minima == 16
    assert indie.generi == ("indie", "live")
    assert indie.inizio == datetime(2026, 10, 23, 21, 30, tzinfo=FUSO_ROMA)


async def test_evento_dopo_mezzanotte_e_alcol() -> None:
    after = _normalizzati(await _raccogli("agenda_jsonld.html"))["After Hours"]
    assert after.inizio.astimezone(UTC) == datetime(2026, 10, 25, 0, 0, tzinfo=UTC)
    assert after.riferimenti_alcol  # R-23: "open bar"
    assert after.origine.url == FONTE.url  # senza URL proprio vale la pagina


async def test_data_senza_orario_non_diventa_evento() -> None:
    grezzi = await _raccogli("agenda_jsonld.html")
    senza_orario = next(g for g in grezzi if g.dati["titolo"] == "Data senza orario")
    with pytest.raises(ErroreValidazione) as errore:
        ADATTATORE.normalizza(senza_orario, FONTE)
    assert errore.value.codice == "ORARIO_MANCANTE"


async def test_eventi_validi_per_lo_schema_condiviso() -> None:
    for evento in _normalizzati(await _raccogli("agenda_jsonld.html")).values():
        jsonschema.validate(evento.model_dump(mode="json"), SCHEMA)


async def test_microdata() -> None:
    fonte = FONTE.model_copy(update={"url": "https://cascinatorretta.example/eventi"})
    grezzi = await _raccogli("agenda_microdata.html", fonte)
    eventi = _normalizzati(grezzi)
    cortile = eventi["Cortile Live"]
    assert cortile.eta_minima == 14
    assert cortile.prezzo_min_centesimi == 800
    assert cortile.fine == datetime(2026, 10, 25, 1, 0, tzinfo=FUSO_ROMA)
    assert cortile.origine.url == "https://cascinatorretta.example/eventi/cortile-live"
    assert "Pomeriggio in Cascina" in eventi


async def test_feed_ical_collegato() -> None:
    fonte = FONTE.model_copy(update={"url": "https://salaventuno.example/calendario"})
    sito = _sito("agenda_ical.html", fonte.url)
    sito.aggiungi(
        "https://salaventuno.example/calendario.ics",
        leggi_dato("pagine/sito_jsonld/calendario.ics"),
        tipo="text/calendar",
    )
    grezzi = await ADATTATORE.raccogli(fonte, client_conforme(sito))
    # L'evento annullato non c'è; quello senza orario c'è ma non si normalizza.
    assert [g.id_esterno for g in grezzi] == [
        "sv-2026-10-24@salaventuno.example",
        "sv-2026-11-01@salaventuno.example",
    ]
    reggaeton = ADATTATORE.normalizza(grezzi[0], fonte)
    assert reggaeton.titolo == "Reggaeton Night, edizione d autunno"
    assert reggaeton.inizio == datetime(2026, 10, 24, 23, 0, tzinfo=FUSO_ROMA)
    assert reggaeton.eta_minima == 18
    assert reggaeton.generi == ("reggaeton", "commerciale")
    assert reggaeton.origine.url == "https://salaventuno.example/eventi/reggaeton"


async def test_pagina_senza_eventi() -> None:
    assert await _raccogli("pagina_vuota.html") == []


async def test_robots_che_vieta_blocca_l_adattatore() -> None:
    sito = _sito("agenda_jsonld.html")
    sito.aggiungi(
        "https://binario7.example/robots.txt", leggi_dato("pagine/sito_jsonld/robots_vietato.txt")
    )
    with pytest.raises(ErroreConformita):
        await ADATTATORE.raccogli(FONTE, client_conforme(sito))
    assert sito.percorsi() == ["/robots.txt"]
