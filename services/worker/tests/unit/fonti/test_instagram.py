import json
from datetime import UTC, datetime
from uuid import UUID

import pytest
from pydantic import SecretStr

from noxa_worker.errori import ErroreFonte
from noxa_worker.fonti.base import Fonte, TipoFonte
from noxa_worker.fonti.didascalie import leggi_didascalia
from noxa_worker.fonti.instagram_business_discovery import (
    AdattatoreInstagramBusinessDiscovery,
    grezzi_da_risposta,
)
from noxa_worker.normalizzazione.date import FUSO_ROMA
from noxa_worker.normalizzazione.modelli import TipoOrigine
from tests.supporto import SitoFinto, client_conforme, leggi_dato

FONTE = Fonte(
    id=UUID("00000000-0000-4000-8000-00000000f002"),
    locale_id=UUID("00000000-0000-4000-8000-00000000c002"),
    locale_nome="Officina Lambro",
    tipo=TipoFonte.INSTAGRAM,
    url="officinalambro",
    adattatore="instagram_business_discovery",
    pagine_massime=1,
)
ADESSO = datetime(2026, 10, 16, 9, 0, tzinfo=UTC)
RISPOSTA = json.loads(leggi_dato("instagram/business_discovery.json"))


def test_post_con_evento_negli_ultimi_14_giorni() -> None:
    grezzi = grezzi_da_risposta(RISPOSTA, ADESSO)
    assert [g.id_esterno for g in grezzi] == ["17900000000000001", "17900000000000003"]
    assert grezzi[0].url == "https://www.instagram.com/p/AAAA0001/"


def test_normalizzazione_della_didascalia() -> None:
    adattatore = AdattatoreInstagramBusinessDiscovery("1", SecretStr("t"))
    bassi, decks = (adattatore.normalizza(g, FONTE) for g in grezzi_da_risposta(RISPOSTA, ADESSO))
    assert bassi.titolo == "BASSI LUNGHI"
    assert bassi.inizio == datetime(2026, 10, 23, 22, 30, tzinfo=FUSO_ROMA)
    assert bassi.eta_minima == 16
    assert bassi.artisti == ("Selva Mc", "Duo Brina", "DJ Neve")
    assert bassi.generi == ("hip_hop", "reggaeton")
    assert bassi.origine.tipo is TipoOrigine.INSTAGRAM
    assert bassi.descrizione is None  # la didascalia non si salva
    assert decks.titolo == "OPEN DECKS VOL. 3"
    assert decks.inizio == datetime(2026, 10, 24, 21, 30, tzinfo=FUSO_ROMA)
    assert decks.riferimenti_alcol


async def test_token_nell_intestazione_e_mai_nell_url() -> None:
    sito = SitoFinto()
    sito.aggiungi("https://graph.facebook.com/v23.0/1784", json.dumps(RISPOSTA))
    adattatore = AdattatoreInstagramBusinessDiscovery("1784", SecretStr("token-segreto"))
    await adattatore.raccogli(FONTE, client_conforme(sito))
    richiesta = sito.richieste[0]
    assert "token-segreto" not in str(richiesta.url)
    assert richiesta.headers["authorization"] == "Bearer token-segreto"
    assert "business_discovery.username(officinalambro)" in richiesta.url.params["fields"]
    # Solo i campi necessari: niente immagini né dati di altri utenti.
    assert "media_url" not in richiesta.url.params["fields"]


async def test_senza_configurazione_errore_esplicito() -> None:
    adattatore = AdattatoreInstagramBusinessDiscovery("", SecretStr(""))
    with pytest.raises(ErroreFonte) as errore:
        await adattatore.raccogli(FONTE, client_conforme(SitoFinto()))
    assert errore.value.codice == "META_NON_CONFIGURATA"


async def test_account_non_business_ferma_la_fonte() -> None:
    sito = SitoFinto()
    sito.aggiungi("https://graph.facebook.com/v23.0/1784", '{"error": {"code": 110}}', stato=400)
    adattatore = AdattatoreInstagramBusinessDiscovery("1784", SecretStr("t"))
    with pytest.raises(ErroreFonte):
        await adattatore.raccogli(FONTE, client_conforme(sito))


def test_risposta_senza_post() -> None:
    with pytest.raises(ErroreFonte):
        grezzi_da_risposta({"business_discovery": {}}, ADESSO)


@pytest.mark.parametrize(
    "didascalia",
    ["Grazie a tutti per ieri!", "Sabato 24 ottobre", "dalle 23:00", "#techno #milano 24/10 h 23"],
)
def test_didascalie_senza_evento(didascalia: str) -> None:
    assert leggi_didascalia(didascalia, ADESSO) is None
