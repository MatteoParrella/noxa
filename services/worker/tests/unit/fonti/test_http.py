import httpx
import pytest

from noxa_worker.errori import ErroreConformita, ErroreFonte
from noxa_worker.fonti.http import ClientHttpConforme, StatoCondiviso
from tests.supporto import USER_AGENT, Orologio, SitoFinto, client_conforme, leggi_dato

BASE = "https://binario7.example"


def _sito(robots: str | None = "robots_consentito.txt") -> SitoFinto:
    sito = SitoFinto()
    if robots:
        sito.aggiungi(f"{BASE}/robots.txt", leggi_dato(f"pagine/sito_jsonld/{robots}"))
    sito.aggiungi(f"{BASE}/eventi", "<html>eventi</html>", tipo="text/html")
    sito.aggiungi(f"{BASE}/altra", "<html>altra</html>")
    return sito


async def test_user_agent_dichiarato_e_robots_letto_prima() -> None:
    sito = _sito()
    http = client_conforme(sito)
    risposta = await http.get_testo(f"{BASE}/eventi")
    assert risposta.testo == "<html>eventi</html>"
    assert sito.percorsi() == ["/robots.txt", "/eventi"]
    assert all(r.headers["user-agent"] == USER_AGENT for r in sito.richieste)
    assert http.pagine_lette == 1


async def test_robots_che_vieta_noxabot_blocca_senza_richiesta() -> None:
    sito = _sito("robots_vietato.txt")
    http = client_conforme(sito)
    with pytest.raises(ErroreConformita) as errore:
        await http.get_testo(f"{BASE}/eventi")
    assert errore.value.codice == "ROBOTS"
    assert sito.percorsi() == ["/robots.txt"]


async def test_percorso_vietato_per_tutti() -> None:
    sito = _sito()
    sito.aggiungi(f"{BASE}/area-riservata/x", "segreto")
    with pytest.raises(ErroreConformita):
        await client_conforme(sito).get_testo(f"{BASE}/area-riservata/x")
    assert "/area-riservata/x" not in sito.percorsi()


async def test_robots_assente_consente_tutto() -> None:
    sito = _sito(robots=None)
    risposta = await client_conforme(sito).get_testo(f"{BASE}/eventi")
    assert risposta.stato == 200


async def test_robots_403_vieta_tutto() -> None:
    sito = _sito(robots=None)
    sito.aggiungi(f"{BASE}/robots.txt", "", stato=403)
    with pytest.raises(ErroreConformita):
        await client_conforme(sito).get_testo(f"{BASE}/eventi")


async def test_robots_non_disponibile_ferma_la_fonte() -> None:
    sito = _sito(robots=None)
    sito.aggiungi(f"{BASE}/robots.txt", "", stato=503)
    with pytest.raises(ErroreFonte) as errore:
        await client_conforme(sito).get_testo(f"{BASE}/eventi")
    assert errore.value.codice == "HTTP_503"


async def test_robots_riletto_solo_dopo_24_ore() -> None:
    sito = _sito()
    stato = StatoCondiviso()
    orologio = Orologio()
    await client_conforme(sito, stato=stato, orologio=orologio).get_testo(f"{BASE}/eventi")
    await client_conforme(sito, stato=stato, orologio=orologio).get_testo(f"{BASE}/altra")
    assert sito.percorsi().count("/robots.txt") == 1
    orologio.adesso += 24 * 3600 + 1
    await client_conforme(sito, stato=stato, orologio=orologio).get_testo(f"{BASE}/eventi")
    assert sito.percorsi().count("/robots.txt") == 2


async def test_una_richiesta_ogni_5_secondi_per_dominio() -> None:
    sito = _sito(robots=None)
    orologio = Orologio()
    http = client_conforme(sito, orologio=orologio)
    await http.get_testo(f"{BASE}/eventi")
    await http.get_testo(f"{BASE}/altra")
    # robots.txt, poi /eventi dopo 5 s, poi /altra dopo altri 5 s.
    assert orologio.attese == [5.0, 5.0]


async def test_crawl_delay_piu_lungo_rispettato() -> None:
    sito = _sito(robots=None)
    sito.aggiungi(f"{BASE}/robots.txt", "User-agent: *\nCrawl-delay: 12\n")
    orologio = Orologio()
    await client_conforme(sito, orologio=orologio).get_testo(f"{BASE}/eventi")
    assert orologio.attese == [12.0]


@pytest.mark.parametrize("stato", [403, 429])
async def test_403_e_429_fermano_la_fonte(stato: int) -> None:
    sito = _sito()
    sito.aggiungi(f"{BASE}/eventi", "", stato=stato)
    with pytest.raises(ErroreFonte) as errore:
        await client_conforme(sito).get_testo(f"{BASE}/eventi")
    assert errore.value.codice == f"HTTP_{stato}"


async def test_limite_di_pagine_per_esecuzione() -> None:
    sito = _sito()
    http = client_conforme(sito, pagine_massime=1)
    await http.get_testo(f"{BASE}/eventi")
    assert http.pagine_rimanenti == 0
    with pytest.raises(ErroreConformita) as errore:
        await http.get_testo(f"{BASE}/altra")
    assert errore.value.codice == "LIMITE_PAGINE"


async def test_mai_oltre_50_pagine() -> None:
    assert client_conforme(_sito(), pagine_massime=500).pagine_rimanenti == 50


async def test_redirect_verso_percorso_vietato() -> None:
    sito = _sito()
    sito.aggiungi(f"{BASE}/eventi", "", stato=301, location="/area-riservata/agenda")
    with pytest.raises(ErroreConformita):
        await client_conforme(sito).get_testo(f"{BASE}/eventi")


async def test_cache_condizionale_con_etag() -> None:
    sito = _sito()
    sito.aggiungi(f"{BASE}/eventi", "<html>v1</html>", etag='"abc"')
    stato = StatoCondiviso()
    orologio = Orologio()
    await client_conforme(sito, stato=stato, orologio=orologio).get_testo(f"{BASE}/eventi")
    sito.aggiungi(f"{BASE}/eventi", "", stato=304)
    risposta = await client_conforme(sito, stato=stato, orologio=orologio).get_testo(
        f"{BASE}/eventi"
    )
    assert risposta.testo == "<html>v1</html>"
    assert sito.richieste[-1].headers["if-none-match"] == '"abc"'


async def test_niente_credenziali_negli_url() -> None:
    with pytest.raises(ErroreConformita):
        await client_conforme(_sito()).get_testo("https://utente:segreta@binario7.example/eventi")


async def test_api_ufficiale_senza_robots_ma_con_limiti() -> None:
    sito = SitoFinto()
    sito.aggiungi("https://graph.facebook.com/v23.0/1", '{"ok": true}')
    http = client_conforme(sito)
    dati = await http.get_json_api(
        "https://graph.facebook.com/v23.0/1", {"fields": "x"}, intestazioni={"Authorization": "t"}
    )
    assert dati == {"ok": True}
    assert sito.percorsi() == ["/v23.0/1"]
    assert sito.richieste[0].headers["authorization"] == "t"


def test_user_agent_deve_dichiarare_noxabot() -> None:
    with pytest.raises(ValueError, match="NoxaBot"):
        ClientHttpConforme(
            httpx.AsyncClient(), StatoCondiviso(), user_agent="Mozilla/5.0", pagine_massime=1
        )
