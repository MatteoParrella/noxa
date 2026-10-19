from datetime import datetime
from typing import ClassVar
from uuid import UUID

import pytest

from noxa_worker.errori import ErroreFonte, ErroreValidazione
from noxa_worker.fonti.base import Fonte, TipoFonte
from noxa_worker.fonti.sito_html import AdattatoreSitoHtml, SelettoriHtml
from noxa_worker.normalizzazione.date import FUSO_ROMA
from tests.supporto import SitoFinto, client_conforme, leggi_dato


class AdattatoreEsempio(AdattatoreSitoHtml):
    """Adattatore di prova su una pagina di fantasia (non registrato)."""

    nome: ClassVar[str] = "sito_html_esempio"
    selettori: ClassVar[SelettoriHtml] = SelettoriHtml(
        evento="section.programma article.evento",
        titolo=".evento-titolo",
        data=".evento-data",
        ora=".evento-ora",
        descrizione=".evento-testo",
        link="a.evento-link",
        artisti=".evento-lineup li",
        prezzo=".evento-prezzo",
        note_ingresso=".evento-testo",
        pagina_successiva="a.pagina-successiva",
    )


FONTE = Fonte(
    id=UUID("00000000-0000-4000-8000-00000000f005"),
    locale_id=UUID("00000000-0000-4000-8000-00000000c002"),
    locale_nome="Officina Lambro",
    tipo=TipoFonte.SITO_LOCALE,
    url="https://officinalambro.example/programma",
    adattatore="sito_html_esempio",
    pagine_massime=5,
)


def _sito() -> SitoFinto:
    sito = SitoFinto()
    sito.aggiungi(FONTE.url, leggi_dato("pagine/sito_html_esempio/agenda_1.html"))
    sito.aggiungi(
        "https://officinalambro.example/programma?pagina=2",
        leggi_dato("pagine/sito_html_esempio/agenda_2.html"),
    )
    return sito


async def test_eventi_da_piu_pagine_con_i_selettori() -> None:
    adattatore = AdattatoreEsempio()
    grezzi = await adattatore.raccogli(FONTE, client_conforme(_sito()))
    assert [g.dati["titolo"] for g in grezzi] == [
        "Bassi Lunghi",
        "Open Decks Vol. 3",
        "Domenica senza orario",
    ]
    bassi = adattatore.normalizza(grezzi[0], FONTE)
    assert bassi.inizio.astimezone(FUSO_ROMA).strftime("%d/%m %H:%M") == "23/10 22:30"
    assert bassi.eta_minima == 16
    assert bassi.artisti == ("Selva Mc", "Duo Brina")
    assert bassi.prezzo_min_centesimi == 1000
    assert bassi.generi == ("hip_hop", "reggaeton")
    assert bassi.origine.url == "https://officinalambro.example/programma/bassi-lunghi"
    decks = adattatore.normalizza(grezzi[1], FONTE)
    assert decks.riferimenti_alcol
    assert isinstance(decks.inizio, datetime)


async def test_senza_orario_non_diventa_evento() -> None:
    adattatore = AdattatoreEsempio()
    grezzi = await adattatore.raccogli(FONTE, client_conforme(_sito()))
    with pytest.raises(ErroreValidazione):
        adattatore.normalizza(grezzi[2], FONTE)


async def test_limite_di_pagine_rispettato() -> None:
    sito = _sito()
    grezzi = await AdattatoreEsempio().raccogli(FONTE, client_conforme(sito, pagine_massime=1))
    assert len(grezzi) == 2
    assert "/programma?pagina=2" not in [r.url.raw_path.decode() for r in sito.richieste]


async def test_struttura_cambiata_errore_esplicito() -> None:
    sito = SitoFinto()
    sito.aggiungi(FONTE.url, leggi_dato("pagine/sito_html_esempio/cambiata.html"))
    with pytest.raises(ErroreFonte) as errore:
        await AdattatoreEsempio().raccogli(FONTE, client_conforme(sito))
    assert errore.value.codice == "STRUTTURA"
