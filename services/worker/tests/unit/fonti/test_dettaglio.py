"""Arricchimento dalla pagina della serata, su tre pagine reali salvate il 2026-11-15
(The Club, Magazzini Generali, Live Club) con contatti sostituiti."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from bs4 import BeautifulSoup

from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from noxa_worker.fonti.comuni import evento_da_campi
from noxa_worker.fonti.dettaglio import (
    DETTAGLI_PER_ESECUZIONE,
    DatiDettaglio,
    applica,
    arricchisci,
    leggi_dettaglio,
    prezzo_ingresso,
    scegli_da_arricchire,
)
from noxa_worker.fonti.sito_html_the_club import AdattatoreSitoHtmlTheClub
from noxa_worker.fonti.sito_jsonld import AdattatoreSitoJsonLd
from noxa_worker.normalizzazione.eta import estrai_eta_minima
from tests.supporto import SitoFinto, client_conforme, leggi_dato

ADESSO = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)
CLUB = "https://www.theclubmilano.com"
URL_CLUB = f"{CLUB}/event/first-class-friday-20-november-2026"
URL_MG = "https://www.magazzinigenerali.org/event/leap/"
URL_LIVE = "https://www.liveclub.it/events/messa-11-novembre/"


def _fonte(url: str, completi: frozenset[str] = frozenset(), pagine: int = 20) -> Fonte:
    return Fonte(
        id=UUID("00000000-0000-4000-8000-00000000f020"),
        locale_id=UUID("00000000-0000-4000-8000-00000000c020"),
        locale_nome="Locale di prova",
        tipo=TipoFonte.SITO_LOCALE,
        url=url,
        adattatore="sito_jsonld",
        pagine_massime=pagine,
        url_completi=completi,
    )


def _pagina(nome: str) -> BeautifulSoup:
    return BeautifulSoup(leggi_dato(f"pagine/dettaglio/2026-11-15-{nome}.html"), "html.parser")


def _grezzo(url: str, giorni: float = 5, **campi: object) -> EventoGrezzo:
    inizio = ADESSO + timedelta(days=giorni)
    dati = {
        "titolo": "Serata di prova",
        "inizio": inizio.isoformat(),
        "ha_ora": True,
        "fine": None,
        "fine_ha_ora": False,
        "descrizione": None,
        "artisti": [],
        "etichette": [],
        "note_ingresso": [],
        "prezzo_centesimi": None,
        "url_biglietti": None,
        "immagine_url": None,
    } | campi
    return EventoGrezzo(url=url, id_esterno=url, dati=dati)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------------------------
# Lettura delle pagine reali
# ---------------------------------------------------------------------------------------------


def test_the_club_prezzo_della_prevendita_e_non_dei_tavoli() -> None:
    letto = AdattatoreSitoHtmlTheClub().dettaglio(_pagina("club"), URL_CLUB)
    # «Prevendita: 20€ donna - 25€ uomo»; i tavoli da 400 € non sono il prezzo d'ingresso.
    assert letto.prezzo_centesimi == 2000
    # La prevendita si compra sulla pagina della serata.
    assert letto.url_biglietti == URL_CLUB
    assert any("Hip Hop" in etichetta for etichetta in letto.etichette)


def test_the_club_eta_dichiarata_diciotto_e_non_ventuno() -> None:
    letto = AdattatoreSitoHtmlTheClub().dettaglio(_pagina("club"), URL_CLUB)
    # «Non sono ammessi minorenni» dichiara i 18 anni; «Superprivè solo per gruppi dai 21
    # anni» riguarda un tavolo e non l'ingresso.
    assert estrai_eta_minima(*letto.note_ingresso) == 18
    evento = evento_da_campi(applica(_grezzo(URL_CLUB), letto), _fonte(f"{CLUB}/events"))
    assert evento.eta_minima == 18
    assert evento.prezzo_min_centesimi == 2000
    assert evento.url_biglietti == URL_CLUB
    assert {"hip_hop", "house"} & set(evento.generi)


def test_magazzini_generali_link_alla_biglietteria_e_non_al_menu() -> None:
    letto = leggi_dettaglio(_pagina("mg"), URL_MG)
    assert letto.url_biglietti is not None
    assert letto.url_biglietti.startswith("https://www.ticketone.it/event/leap-magazzini-generali")
    # Il concerto non dichiara un'età: resta non dichiarata (R-21), niente età inventate.
    assert estrai_eta_minima(*letto.note_ingresso) is None


def test_live_club_biglietteria_e_prezzo_in_cassa() -> None:
    letto = leggi_dettaglio(_pagina("live"), URL_LIVE)
    assert letto.url_biglietti == "https://www.vivaticket.com/it/ticket/messa/296076"
    assert letto.prezzo_centesimi == 3700
    assert estrai_eta_minima(*letto.note_ingresso) is None


def test_nessun_dato_personale_o_testo_lungo_nelle_note() -> None:
    for nome, url in (("club", URL_CLUB), ("mg", URL_MG), ("live", URL_LIVE)):
        letto = leggi_dettaglio(_pagina(nome), url)
        assert all(len(nota) <= 300 for nota in letto.note_ingresso)
        assert len(letto.note_ingresso) <= 12
        assert not any("@" in nota for nota in letto.note_ingresso)


# ---------------------------------------------------------------------------------------------
# Regole di lettura
# ---------------------------------------------------------------------------------------------


def test_link_interni_social_e_non_https_non_sono_biglietti() -> None:
    html = """<main>
      <a href="/buy-tickets/">Buy tickets</a>
      <a href="https://www.instagram.com/locale">Biglietti su Instagram</a>
      <a href="http://www.ticketone.it/evento">Biglietti</a>
      <a href="https://utente:segreto@dice.fm/evento">Biglietti</a>
    </main>"""
    letto = leggi_dettaglio(BeautifulSoup(html, "html.parser"), "https://locale.example/evento")
    assert letto.url_biglietti is None


def test_link_esterno_riconosciuto_dal_testo() -> None:
    html = '<main><a href="https://prevendite.example/serata-1">Acquista i biglietti</a></main>'
    letto = leggi_dettaglio(BeautifulSoup(html, "html.parser"), "https://locale.example/evento")
    assert letto.url_biglietti == "https://prevendite.example/serata-1"


def test_prezzo_minimo_gratis_e_assente() -> None:
    assert prezzo_ingresso(["Ingresso: 15 € in lista, 20 € alla porta"]) == 1500
    assert prezzo_ingresso(["BIGLIETTI", "Intero", "€ 12,50", "Tavolo 200 €"]) == 1250
    assert prezzo_ingresso(["Ingresso libero fino a esaurimento posti"]) == 0
    assert prezzo_ingresso(["Tavoli da 300 € con bottiglia"]) is None
    assert prezzo_ingresso(["Una serata lunga 20 anni"]) is None


def test_un_prezzo_non_e_un_eta() -> None:
    assert estrai_eta_minima("Ingresso da 15 €") is None
    assert estrai_eta_minima("Ingresso da 20 euro con drink") is None
    assert estrai_eta_minima("Ingresso dai 16 anni") == 16
    assert estrai_eta_minima("Vietato ai minori di 16 anni") == 16
    assert estrai_eta_minima("Under 18 are not allowed") == 18
    assert estrai_eta_minima("Non sono ammessi minorenni") == 18


def test_applica_non_sostituisce_i_campi_gia_letti() -> None:
    grezzo = _grezzo(URL_MG, prezzo_centesimi=1000, url_biglietti="https://dice.fm/a")
    dettaglio = DatiDettaglio(
        url_biglietti="https://www.ticketone.it/b", prezzo_centesimi=500, note_ingresso=("18+",)
    )
    dati = applica(grezzo, dettaglio).dati
    assert dati["prezzo_centesimi"] == 1000
    assert dati["url_biglietti"] == "https://dice.fm/a"
    assert dati["note_ingresso"] == ["18+"]
    assert applica(grezzo, DatiDettaglio()) is grezzo


# ---------------------------------------------------------------------------------------------
# Scelta delle pagine e limiti
# ---------------------------------------------------------------------------------------------


def test_scelta_solo_serate_vicine_dello_stesso_sito_ancora_senza_biglietti() -> None:
    base = "https://locale.example"
    fonte = _fonte(f"{base}/eventi", completi=frozenset({f"{base}/e/completa/"}))
    grezzi = [
        _grezzo(f"{base}/e/vicina", 2),
        _grezzo(f"{base}/e/completa", 3),
        _grezzo(f"{base}/e/con-link", 4, url_biglietti="https://dice.fm/x"),
        _grezzo(f"{base}/e/lontana", 60),
        _grezzo(f"{base}/e/passata", -2),
        _grezzo("https://altro.example/e/esterna", 2),
        _grezzo(f"{base}/eventi", 2),
        _grezzo(f"{base}/e/senza-ora", 2, ha_ora=False),
    ]
    scelti = scegli_da_arricchire(grezzi, fonte, ADESSO, 8)
    assert [g.url for g in scelti] == [f"{base}/e/vicina"]


def test_scelta_meta_alle_piu_vicine_e_il_resto_a_rotazione() -> None:
    base = "https://locale.example"
    fonte = _fonte(f"{base}/eventi")
    grezzi = [_grezzo(f"{base}/e/{numero}", numero + 1) for numero in range(30)]
    scelti = scegli_da_arricchire(grezzi, fonte, ADESSO, 8)
    assert len(scelti) == 8
    assert [g.url for g in scelti[:4]] == [f"{base}/e/{numero}" for numero in range(4)]
    dopo = scegli_da_arricchire(grezzi, fonte, ADESSO + timedelta(hours=6), 8)
    assert [g.url for g in dopo[:4]] == [g.url for g in scelti[:4]]
    assert {g.url for g in dopo[4:]} != {g.url for g in scelti[4:]}
    assert scegli_da_arricchire(grezzi, fonte, ADESSO, 0) == []


async def test_arricchisci_rispetta_il_limite_e_lascia_gli_altri_come_sono() -> None:
    base = "https://locale.example"
    sito = SitoFinto()
    sito.aggiungi(f"{base}/robots.txt", "User-agent: *\nAllow: /\n", tipo="text/plain")
    pagina = '<main><p>Ingresso 10 €</p><a href="https://dice.fm/serata">Biglietti</a></main>'
    grezzi = [_grezzo(f"{base}/e/{numero}", numero + 1) for numero in range(12)]
    for grezzo in grezzi:
        sito.aggiungi(grezzo.url, pagina, tipo="text/html")
    http = client_conforme(sito)
    esito = await arricchisci(
        AdattatoreSitoJsonLd(), grezzi, _fonte(f"{base}/eventi"), http, ADESSO
    )
    completi = [g for g in esito if g.dati["url_biglietti"] == "https://dice.fm/serata"]
    assert len(esito) == 12
    assert len(completi) == DETTAGLI_PER_ESECUZIONE
    assert all(g.dati["prezzo_centesimi"] == 1000 for g in completi)
    assert http.pagine_lette == DETTAGLI_PER_ESECUZIONE


async def test_arricchisci_si_ferma_con_403_e_salta_gli_altri_errori() -> None:
    base = "https://locale.example"
    sito = SitoFinto()
    sito.aggiungi(f"{base}/robots.txt", "User-agent: *\nAllow: /\n", tipo="text/plain")
    pagina = '<main><a href="https://dice.fm/serata">Biglietti</a></main>'
    grezzi = [_grezzo(f"{base}/e/{numero}", numero + 1) for numero in range(4)]
    # 0: manca (404, si salta); 1: letta; 2: 403 (ci si ferma); 3: non si chiede più.
    sito.aggiungi(grezzi[1].url, pagina, tipo="text/html")
    sito.aggiungi(grezzi[2].url, "vietato", stato=403)
    sito.aggiungi(grezzi[3].url, pagina, tipo="text/html")
    http = client_conforme(sito)
    esito = await arricchisci(
        AdattatoreSitoJsonLd(), grezzi, _fonte(f"{base}/eventi"), http, ADESSO
    )
    assert [bool(g.dati["url_biglietti"]) for g in esito] == [False, True, False, False]
    assert "/e/3" not in sito.percorsi()


async def test_arricchisci_rispetta_robots_e_il_limite_di_pagine_della_fonte() -> None:
    base = "https://locale.example"
    sito = SitoFinto()
    sito.aggiungi(f"{base}/robots.txt", "User-agent: *\nDisallow: /e/\n", tipo="text/plain")
    grezzi = [_grezzo(f"{base}/e/{numero}", numero + 1) for numero in range(3)]
    http = client_conforme(sito)
    esito = await arricchisci(
        AdattatoreSitoJsonLd(), grezzi, _fonte(f"{base}/eventi"), http, ADESSO
    )
    assert esito == grezzi
    assert not any(percorso.startswith("/e/") for percorso in sito.percorsi())

    senza_pagine = client_conforme(SitoFinto(), pagine_massime=1)
    senza_pagine.pagine_lette = 1  # l'elenco ha già usato l'unica pagina
    assert (
        await arricchisci(
            AdattatoreSitoJsonLd(), grezzi, _fonte(f"{base}/eventi"), senza_pagine, ADESSO
        )
        == grezzi
    )
