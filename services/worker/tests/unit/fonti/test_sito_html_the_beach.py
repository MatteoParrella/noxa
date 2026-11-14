"""Adattatore del sito di The Beach su pagine reali salvate il 2026-11-14: il calendario del
mese e le pagine delle 8 serate da quel giorno in poi."""

from datetime import date
from pathlib import Path
from uuid import UUID

import jsonschema
import pytest

from noxa_worker.errori import ErroreConformita, ErroreFonte
from noxa_worker.fonti import sito_html_the_beach
from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from noxa_worker.fonti.sito_html_the_beach import AdattatoreSitoHtmlTheBeach
from noxa_worker.normalizzazione.date import FUSO_ROMA
from noxa_worker.normalizzazione.modelli import EventoNormalizzato
from tests.supporto import SitoFinto, client_conforme, leggi_dato
from tests.unit.test_schema_evento import SCHEMA

BASE = "https://www.thebeachmilano.it"
CARTELLA = "pagine/sito_html_the_beach"
FONTE = Fonte(
    id=UUID("00000000-0000-4000-8000-00000000f012"),
    locale_id=UUID("00000000-0000-4000-8000-00000000c012"),
    locale_nome="The Beach Milano",
    tipo=TipoFonte.SITO_LOCALE,
    url=f"{BASE}/events",
    adattatore="sito_html_the_beach",
    pagine_massime=10,
)
SERATE = [
    "saturday-apericena-dinner-party-3",
    "aperitivo-karaoke-lgbtq-party-54",
    "aperitivo-kantabeach-fing-beach-party-5",
    "saturday-apericena-dinner-party-4",
    "aperitivo-karaoke-lgbtq-party-55",
    "aperitivo-kantabeach-fing-beach-party-6",
    "saturday-apericena-dinner-party-5",
    "aperitivo-karaoke-lgbtq-party-56",
]


@pytest.fixture(autouse=True)
def _oggi(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sito_html_the_beach, "oggi", lambda: date(2026, 11, 14))


def _sito(robots: str = "User-agent: *\nDisallow: /*calendar_timestamp=\n") -> SitoFinto:
    sito = SitoFinto()
    sito.aggiungi(f"{BASE}/robots.txt", robots, tipo="text/plain")
    sito.aggiungi(FONTE.url, leggi_dato(f"{CARTELLA}/2026-11-14-calendario.html"), tipo="text/html")
    for serata in SERATE:
        sito.aggiungi(
            f"{BASE}/event/{serata}",
            leggi_dato(f"{CARTELLA}/2026-11-14-{serata}.html"),
            tipo="text/html",
        )
    return sito


async def _grezzi(sito: SitoFinto | None = None, pagine: int = 10) -> list[EventoGrezzo]:
    fonte = FONTE.model_copy(update={"pagine_massime": pagine})
    return await AdattatoreSitoHtmlTheBeach().raccogli(
        fonte, client_conforme(sito or _sito(), pagine_massime=pagine)
    )


async def _eventi() -> list[EventoNormalizzato]:
    adattatore = AdattatoreSitoHtmlTheBeach()
    return [adattatore.normalizza(g, FONTE) for g in await _grezzi()]


def _ora(evento: EventoNormalizzato) -> str:
    return evento.inizio.astimezone(FUSO_ROMA).strftime("%a %d/%m/%Y %H:%M")


def test_fixture_presenti() -> None:
    cartella = Path(__file__).parents[2] / "dati" / CARTELLA
    assert len(list(cartella.glob("*.html"))) == len(SERATE) + 1


async def test_calendario_e_solo_le_serate_da_oggi() -> None:
    sito = _sito()
    grezzi = await _grezzi(sito)
    assert len(grezzi) == 8
    # Le serate passate del mese (Halloween, 1 e 6–8 novembre) non si aprono.
    assert sito.percorsi() == ["/robots.txt", "/events", *(f"/event/{s}" for s in SERATE)]
    assert grezzi[0].url == f"{BASE}/event/{SERATE[0]}"
    assert len({g.id_esterno for g in grezzi}) == 8
    immagine = grezzi[0].dati["immagine_url"]
    assert isinstance(immagine, str)
    assert immagine.startswith(f"{BASE}/sites/default/files/")


async def test_titolo_data_e_primo_orario_dalle() -> None:
    eventi = await _eventi()
    assert eventi[0].titolo == "THE SATURDAY: Apericena - Dinner - Party"
    assert _ora(eventi[0]) == "Sat 14/11/2026 20:00"  # "Dalle ore 20:00 apericena"
    assert _ora(eventi[1]) == "Sun 15/11/2026 20:30"
    # Venerdì: "entro 00:45" viene prima nel testo, ma l'inizio è "Ingresso dalle 21:00".
    assert eventi[2].titolo == "APERITIVO - KANTABEACH & F***ING BEACH PARTY"
    assert _ora(eventi[2]) == "Fri 20/11/2026 21:00"
    assert _ora(eventi[4]) == "Sun 22/11/2026 19:30"


async def test_maggiorenni_e_alcol() -> None:
    eventi = await _eventi()
    sabato, domenica, venerdi = eventi[0], eventi[1], eventi[2]
    # "I nostri eventi sono riservati ai MAGGIORENNI"; "Target +30" non è un limite.
    assert sabato.eta_minima == 18
    assert venerdi.eta_minima == 18
    # La domenica non lo scrive: età non dichiarata = 18 (R-21).
    assert domenica.eta_minima is None
    # Drink inclusi e "tavolo 150€ a bottiglia": invisibili ai minorenni (R-23).
    assert all(e.riferimenti_alcol for e in eventi)


async def test_generi_e_descrizione_breve() -> None:
    sabato = (await _eventi())[0]
    assert {"commerciale", "reggaeton"} <= set(sabato.generi)
    assert sabato.descrizione is not None
    assert sabato.descrizione.startswith("Inizia la serata come preferisci")
    # Solo il primo paragrafo: niente prezzi né numeri di telefono del programma.
    assert "351" not in sabato.descrizione


async def test_eventi_validi_per_lo_schema_condiviso() -> None:
    for evento in await _eventi():
        jsonschema.validate(evento.model_dump(mode="json"), SCHEMA)


async def test_limite_di_pagine() -> None:
    sito = _sito()
    grezzi = await _grezzi(sito, pagine=3)
    assert len(grezzi) == 2
    assert len(sito.percorsi()) == 4  # robots.txt, calendario e 2 serate


async def test_serata_senza_orario_dalle() -> None:
    sito = _sito()
    sito.aggiungi(
        f"{BASE}/event/{SERATE[0]}",
        '<div id="block-tb-content"><h1 class="txts-box-date">Saturday, 14th NOVEMBER 2026'
        '</h1><h1 class="txts-box-title">Serata</h1><div class="body-serata"><p>Vi aspettiamo'
        "</p></div></div>",
        tipo="text/html",
    )
    grezzo = (await _grezzi(sito))[0]
    assert grezzo.dati["inizio"] is None


async def test_robots_che_vieta_blocca_senza_leggere_la_pagina() -> None:
    sito = _sito(robots="User-agent: *\nDisallow: /\n")
    with pytest.raises(ErroreConformita):
        await _grezzi(sito)
    assert sito.percorsi() == ["/robots.txt"]


async def test_calendario_cambiato() -> None:
    sito = _sito()
    sito.aggiungi(FONTE.url, "<html><body><main>Nuovo sito</main></body></html>", tipo="text/html")
    with pytest.raises(ErroreFonte) as errore:
        await _grezzi(sito)
    assert errore.value.codice == "STRUTTURA"


async def test_pagina_della_serata_cambiata() -> None:
    sito = _sito()
    sito.aggiungi(f"{BASE}/event/{SERATE[0]}", "<html><body>Nuovo</body></html>", tipo="text/html")
    with pytest.raises(ErroreFonte) as errore:
        await _grezzi(sito)
    assert errore.value.codice == "STRUTTURA"
