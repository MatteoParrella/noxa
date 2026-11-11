import pytest
from pydantic import JsonValue

from noxa_worker.fonti.bootstrap_locali import (
    Candidato,
    candidati_da_overpass,
    candidati_da_places,
    candidati_importabili,
    motivo_esclusione,
    normalizza_nome,
    query_overpass,
)


def test_query_overpass_per_area_amministrativa() -> None:
    query = query_overpass("IT-MB")
    assert '"ISO3166-2"="IT-MB"' in query
    assert 'nwr["amenity"="nightclub"]' in query


def test_candidati_osm() -> None:
    risposta: JsonValue = {
        "elements": [
            {
                "type": "node",
                "id": 101,
                "lat": 45.58,
                "lon": 9.27,
                "tags": {
                    "amenity": "nightclub",
                    "name": "Club Binario Sette",
                    "addr:street": "Via dei Cantieri",
                    "addr:housenumber": "12",
                    "addr:city": "Monza",
                    "website": "https://binario7.example",
                    "phone": "+39 000",
                },
            },
            {"type": "way", "id": 7, "center": {"lat": 45.6, "lon": 9.2}, "tags": {"name": "Dock"}},
            {"type": "node", "id": 8, "tags": {"amenity": "nightclub"}},
        ]
    }
    binario, dock = candidati_da_overpass(risposta, "MB")
    assert binario.osm_id == "node/101"
    assert binario.indirizzo == "Via dei Cantieri 12"
    assert binario.comune == "Monza"
    assert binario.provincia == "MB"
    assert binario.sito_web == "https://binario7.example"
    assert (dock.osm_id, dock.lat, dock.lon) == ("way/7", 45.6, 9.2)


def test_da_google_solo_il_place_id() -> None:
    (candidato,) = candidati_da_places(
        {"places": [{"id": "ChIJ-prova", "displayName": {"text": "Non salvato"}}]}
    )
    assert candidato.google_place_id == "ChIJ-prova"
    assert candidato.nome is None
    assert candidato.indirizzo is None
    assert candidato.lat is None


def test_nome_normalizzato_come_nel_database() -> None:
    assert normalizza_nome("Caffè Ünico & C.") == "caffe unico c"


@pytest.mark.parametrize(
    ("tag", "nome", "atteso"),
    [
        ({"amenity": "stripclub"}, "Il Salotto", "tag amenity=stripclub"),
        ({"leisure": "sauna"}, "Metro", "tag leisure=sauna"),
        ({"amenity": "nightclub", "adult": "yes"}, "Velvet", "tag adult=yes"),
        ({"amenity": "nightclub"}, "Extasià Disco Topless", "nome: topless"),
        ({"amenity": "nightclub"}, "Venus Night Club", "nome: night club"),
        ({"amenity": "nightclub"}, "Luna NightClub", "nome: nightclub"),
        ({"amenity": "nightclub"}, "Sauna Centrale", "nome: sauna"),
        ({"amenity": "nightclub"}, "Club Scambisti", "nome: scambisti"),
        ({"amenity": "nightclub"}, "Lap-Dance Club", "nome: lap dance"),
    ],
)
def test_locali_per_adulti_esclusi(tag: dict[str, JsonValue], nome: str, atteso: str) -> None:
    """R-44: strip club, locali topless, saune e club per scambisti non diventano candidati."""
    assert motivo_esclusione(tag, nome) == atteso


def test_locale_per_adulti_dal_sito() -> None:
    assert (
        motivo_esclusione(
            {"amenity": "nightclub"}, "Extasià", "https://www.extasiadiscotopless.com/"
        )
        == "sito: topless"
    )
    assert motivo_esclusione({}, "Exotica") == "nome: exotica"
    assert motivo_esclusione({}, "Alcatraz", "https://alcatrazmilano.it/") is None


@pytest.mark.parametrize(
    "nome",
    ["Alcatraz", "Magazzini Generali", "Armani Privè", "Gate", "Club Plastic", "Stripes Bar"],
)
def test_locali_ordinari_non_esclusi(nome: str) -> None:
    assert motivo_esclusione({"amenity": "nightclub", "adult": "no"}, nome) is None


def test_esclusi_nel_csv_ma_non_importati() -> None:
    risposta: JsonValue = {
        "elements": [
            {"type": "node", "id": 1, "tags": {"amenity": "nightclub", "name": "Dock"}},
            {"type": "node", "id": 2, "tags": {"amenity": "nightclub", "name": "Disco Topless"}},
        ]
    }
    dock, topless = candidati_da_overpass(risposta, "MI")
    assert dock.esclusione is None
    assert topless.esclusione == "nome: topless"
    assert candidati_importabili([dock, topless]) == [dock]
    assert candidati_importabili([Candidato(origine="google", google_place_id="x")])
