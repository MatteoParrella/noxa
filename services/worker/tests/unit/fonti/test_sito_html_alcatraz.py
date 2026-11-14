"""Adattatore del sito di Alcatraz su una pagina reale salvata il 2026-11-14.

Dalla fixture sono stati tolti `<script>`, `<style>` e gli `<svg>` in linea (quasi 1 MB):
l'adattatore legge solo le schede degli eventi, rimaste identiche all'originale.
"""

from datetime import datetime
from uuid import UUID

import jsonschema
import pytest

from noxa_worker.errori import ErroreConformita, ErroreFonte
from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from noxa_worker.fonti.sito_html import AdattatoreSitoHtml, entro_il_limite
from noxa_worker.fonti.sito_html_alcatraz import AdattatoreSitoHtmlAlcatraz
from noxa_worker.normalizzazione.date import FUSO_ROMA
from noxa_worker.normalizzazione.modelli import EventoNormalizzato
from tests.supporto import SitoFinto, client_conforme, leggi_dato
from tests.unit.test_schema_evento import SCHEMA

BASE = "https://alcatrazmilano.it"
FONTE = Fonte(
    id=UUID("00000000-0000-4000-8000-00000000f011"),
    locale_id=UUID("00000000-0000-4000-8000-00000000c011"),
    locale_nome="Alcatraz",
    tipo=TipoFonte.SITO_LOCALE,
    url=f"{BASE}/calendario/",
    adattatore="sito_html_alcatraz",
    pagine_massime=5,
)

SCHEDA_PICCOLA = """
<section class="ud_block ud_block__event-grid"><div class="ud_event _upcoming __sm"
  title="{giorno} {ora}"><a class="ud_event__date" href="{BASE}/eventi/prova/"
  title="{data}"><span class="day_name">Sab</span></a>
  <a class="ud_event__header_i" href="{BASE}/eventi/prova/">
  <div class="ud_event__category">{categoria}</div>
  <div class="ud_event__title"><div>{titolo}</div></div></a>
  <div class="ud_event__link"><a href="https://dice.fm/event/prova">Biglietti</a></div>
</div></section>
"""


def _sito(robots: str = "User-agent: *\nDisallow:\n") -> SitoFinto:
    sito = SitoFinto()
    sito.aggiungi(f"{BASE}/robots.txt", robots, tipo="text/plain")
    sito.aggiungi(
        FONTE.url, leggi_dato("pagine/sito_html_alcatraz/2026-11-14.html"), tipo="text/html"
    )
    return sito


async def _tutti(sito: SitoFinto | None = None) -> list[EventoGrezzo]:
    """Tutte le schede, senza il filtro dei 180 giorni che dipende dalla data di oggi."""
    adattatore = AdattatoreSitoHtmlAlcatraz()
    return await AdattatoreSitoHtml.raccogli(adattatore, FONTE, client_conforme(sito or _sito()))


async def _eventi() -> list[EventoNormalizzato]:
    adattatore = AdattatoreSitoHtmlAlcatraz()
    return [adattatore.normalizza(g, FONTE) for g in await _tutti()]


def _scheda(**campi: str) -> SitoFinto:
    valori = {
        "giorno": "21/11",
        "ora": "23:00",
        "data": "21/11/2026",
        "categoria": "Live",
        "titolo": "Concerto di prova",
        "BASE": BASE,
    } | campi
    sito = _sito()
    sito.aggiungi(FONTE.url, SCHEDA_PICCOLA.format(**valori), tipo="text/html")
    return sito


def _ora(evento: EventoNormalizzato) -> str:
    return evento.inizio.astimezone(FUSO_ROMA).strftime("%d/%m/%Y %H:%M")


async def test_tutte_le_schede_dei_due_formati() -> None:
    grezzi = await _tutti()
    assert len(grezzi) == 62
    assert len({g.id_esterno for g in grezzi}) == 62
    assert [g.dati["titolo"] for g in grezzi[:3]] == [
        "Cristina D’avena / Gem Boy live + Rebel Night",
        "Rebel Night Party + Cristina D’Avena",
        "Andrea Cerrato",
    ]
    assert grezzi[0].url == f"{BASE}/eventi/cristina-davena-gem-boy-live-rebel-night/"
    # ADR-0030: solo il link dell'immagine caricata in differita, per i colori.
    immagine = grezzi[0].dati["immagine_url"]
    assert isinstance(immagine, str)
    assert immagine.startswith(f"{BASE}/wp-content/uploads/")
    assert grezzi[0].dati["url_biglietti"] == (
        "https://dice.fm/event/ww9xox-cristina-davena-live-rebel-night-14th-nov-"
        "alcatraz-milano-milano-tickets"
    )


async def test_date_e_orari_con_e_senza_anno() -> None:
    eventi = await _eventi()
    # Scheda grande ("Sab 14 Nov", senza anno) e scheda piccola ("21/11/2026").
    assert _ora(eventi[0]) == "14/11/2026 20:30"
    assert _ora(eventi[9]) == "21/11/2026 23:00"
    # Il calendario arriva al novembre successivo: l'anno viene dalla data completa.
    assert eventi[-1].titolo == "TILL LINDEMANN"
    assert _ora(eventi[-1]) == "02/11/2027 19:00"
    inizi = [e.inizio for e in eventi]
    assert inizi == sorted(inizi)


async def test_serata_dopo_mezzanotte() -> None:
    evento = (await _eventi())[1]
    # "14/11 00:00" sulla scheda di sabato 14: la notte tra sabato e domenica.
    assert _ora(evento) == "15/11/2026 00:00"


async def test_eta_club_maggiorenni_concerti_non_dichiarata() -> None:
    eventi = {e.titolo: e for e in await _eventi()}
    # Regolamento: le serate club sono riservate ai maggiorenni.
    assert eventi["BANGERS 90s VS 2000s PARTY"].eta_minima == 18
    assert eventi["🐸🎄Perreo XXXXL"].eta_minima == 18
    # Concerti: regole dell'organizzatore, età non dichiarata = 18 (R-21).
    assert eventi["José González"].eta_minima is None
    assert "live" in eventi["José González"].generi
    assert not any(e.riferimenti_alcol for e in eventi.values())


async def test_titolo_senza_sold_out() -> None:
    titoli = {e.titolo for e in await _eventi()}
    assert "KNEECAP" in titoli
    assert "AFTERHOURS" in titoli
    assert not any("sold out" in t.lower() for t in titoli)


async def test_eventi_validi_per_lo_schema_condiviso() -> None:
    for evento in await _eventi():
        jsonschema.validate(evento.model_dump(mode="json"), SCHEMA)


async def test_solo_entro_180_giorni() -> None:
    grezzi = await _tutti()
    adesso = datetime(2026, 11, 14, 9, 0, tzinfo=FUSO_ROMA)
    entro = entro_il_limite(grezzi, adesso)
    assert 0 < len(entro) < len(grezzi)
    assert all(g.dati["titolo"] != "TILL LINDEMANN" for g in entro)


async def test_open_bar_nel_titolo() -> None:
    sito = _scheda(categoria="Club Alcatraz", titolo="Reggaeton night con open bar")
    adattatore = AdattatoreSitoHtmlAlcatraz()
    (grezzo,) = await _tutti(sito)
    evento = adattatore.normalizza(grezzo, FONTE)
    assert evento.riferimenti_alcol is True
    assert evento.eta_minima == 18


async def test_scheda_senza_ora_scartata_dalla_validazione() -> None:
    sito = _scheda(ora="")
    (grezzo,) = await _tutti(sito)
    assert grezzo.dati["inizio"] is None


async def test_una_sola_pagina() -> None:
    sito = _sito()
    await AdattatoreSitoHtmlAlcatraz().raccogli(FONTE, client_conforme(sito))
    assert sito.percorsi() == ["/robots.txt", "/calendario/"]


async def test_robots_che_vieta_blocca_senza_leggere_la_pagina() -> None:
    sito = _sito(robots="User-agent: *\nDisallow: /\n")
    with pytest.raises(ErroreConformita):
        await AdattatoreSitoHtmlAlcatraz().raccogli(FONTE, client_conforme(sito))
    assert sito.percorsi() == ["/robots.txt"]


async def test_struttura_cambiata_errore_esplicito() -> None:
    sito = _sito()
    sito.aggiungi(FONTE.url, "<html><body><main>Nuovo sito</main></body></html>", tipo="text/html")
    with pytest.raises(ErroreFonte) as errore:
        await AdattatoreSitoHtmlAlcatraz().raccogli(FONTE, client_conforme(sito))
    assert errore.value.codice == "STRUTTURA"


async def test_pagina_senza_eventi_ma_con_la_griglia() -> None:
    sito = _sito()
    sito.aggiungi(FONTE.url, '<section class="ud_block__event-grid"></section>', tipo="text/html")
    assert await AdattatoreSitoHtmlAlcatraz().raccogli(FONTE, client_conforme(sito)) == []
