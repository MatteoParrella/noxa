"""Bootstrap dei locali (EVENT_INGESTION.md §2.1): candidati da OpenStreetMap (Overpass API)
e da Google Places, da verificare a mano nell'area di moderazione.

- OpenStreetMap: nome, indirizzo, comune, coordinate e sito presenti nei tag (licenza ODbL,
  attribuzione nell'app, D-07).
- Google Places: **solo il `place_id`** (Text Search con `X-Goog-FieldMask: places.id`),
  come consentono i termini di Google Maps Platform (ADR-0008).

Il comando scrive un CSV da rivedere; con `--importa` inserisce i candidati nuovi in
`candidati_locali` con il ruolo `noxa_worker`. Non scrive mai in `locali`.

Uso (da services/worker):
    uv run python -m noxa_worker.fonti.bootstrap_locali --csv candidati.csv [--importa]
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import psycopg
import structlog
from pydantic import JsonValue

from noxa_worker.configurazione import Impostazioni, leggi_impostazioni
from noxa_worker.errori import ErroreRaccolta
from noxa_worker.fonti.http import ClientHttpConforme, StatoCondiviso, crea_client_httpx
from noxa_worker.normalizzazione.testo import senza_accenti
from noxa_worker.osservabilita import configura_log

log = structlog.get_logger(__name__)

URL_OVERPASS = "https://overpass-api.de/api/interpreter"
URL_PLACES = "https://places.googleapis.com/v1/places:searchText"
PROVINCE = {"MI": "IT-MI", "MB": "IT-MB"}
RICERCHE_GOOGLE = ("discoteca", "club", "locale notturno")
AREE_GOOGLE = {"MI": "provincia di Milano", "MB": "provincia di Monza e della Brianza"}
DISTANZA_DOPPIONE_M = 200


@dataclass(frozen=True)
class Candidato:
    origine: str
    osm_id: str | None = None
    google_place_id: str | None = None
    nome: str | None = None
    indirizzo: str | None = None
    comune: str | None = None
    provincia: str | None = None
    lat: float | None = None
    lon: float | None = None
    sito_web: str | None = None


def normalizza_nome(nome: str) -> str:
    """Come `private.normalizza_nome` nel database."""
    return " ".join(re.sub(r"[^a-z0-9]+", " ", senza_accenti(nome)).split())


def query_overpass(codice_iso: str) -> str:
    """Locali notturni e sale da concerto dell'area amministrativa (§2.1)."""
    return f"""[out:json][timeout:60];
area["ISO3166-2"="{codice_iso}"]->.area;
(
  nwr["amenity"="nightclub"](area.area);
  nwr["amenity"="bar"]["club"](area.area);
  nwr["amenity"="bar"]["music_venue"](area.area);
  nwr["amenity"="events_venue"]["club"](area.area);
  nwr["amenity"="events_venue"]["music_venue"](area.area);
);
out center tags;"""


def candidati_da_overpass(risposta: JsonValue, provincia: str) -> list[Candidato]:
    elementi = risposta.get("elements") if isinstance(risposta, dict) else None
    candidati: list[Candidato] = []
    for elemento in elementi if isinstance(elementi, list) else []:
        if not isinstance(elemento, dict):
            continue
        tag = elemento.get("tags")
        tag = tag if isinstance(tag, dict) else {}
        nome = tag.get("name")
        if not isinstance(nome, str) or not nome.strip():
            continue
        centro = elemento.get("center")
        posizione = centro if isinstance(centro, dict) else elemento
        lat, lon = posizione.get("lat"), posizione.get("lon")
        via = " ".join(
            str(tag[c]) for c in ("addr:street", "addr:housenumber") if isinstance(tag.get(c), str)
        )
        sito = tag.get("website") or tag.get("contact:website")
        candidati.append(
            Candidato(
                origine="osm",
                osm_id=f"{elemento.get('type')}/{elemento.get('id')}",
                nome=nome.strip()[:120],
                indirizzo=via[:200] or None,
                comune=str(tag["addr:city"])[:80]
                if isinstance(tag.get("addr:city"), str)
                else None,
                provincia=provincia,
                lat=float(lat) if isinstance(lat, int | float) else None,
                lon=float(lon) if isinstance(lon, int | float) else None,
                sito_web=sito
                if isinstance(sito, str) and sito.startswith(("http://", "https://"))
                else None,
            )
        )
    return candidati


def candidati_da_places(risposta: JsonValue) -> list[Candidato]:
    luoghi = risposta.get("places") if isinstance(risposta, dict) else None
    candidati: list[Candidato] = []
    for luogo in luoghi if isinstance(luoghi, list) else []:
        identificativo = luogo.get("id") if isinstance(luogo, dict) else None
        if isinstance(identificativo, str):
            candidati.append(Candidato(origine="google", google_place_id=identificativo))
    return candidati


async def raccogli_candidati(
    impostazioni: Impostazioni, http: ClientHttpConforme
) -> list[Candidato]:
    candidati: list[Candidato] = []
    for provincia, codice in PROVINCE.items():
        risposta = await http.get_json_api(URL_OVERPASS, {"data": query_overpass(codice)})
        trovati = candidati_da_overpass(risposta, provincia)
        log.info("candidati_osm", provincia=provincia, trovati=len(trovati))
        candidati.extend(trovati)

    chiave = impostazioni.google_places_api_key.get_secret_value()
    if not chiave:
        log.warning("google_places_non_configurato")
    else:
        for provincia, area in AREE_GOOGLE.items():
            for ricerca in RICERCHE_GOOGLE:
                risposta = await http.post_json_api(
                    URL_PLACES,
                    {"textQuery": f"{ricerca} {area}", "languageCode": "it", "regionCode": "IT"},
                    intestazioni={"X-Goog-Api-Key": chiave, "X-Goog-FieldMask": "places.id"},
                )
                trovati = candidati_da_places(risposta)
                log.info(
                    "candidati_google", provincia=provincia, ricerca=ricerca, trovati=len(trovati)
                )
                candidati.extend(trovati)

    unici: dict[str, Candidato] = {}
    for candidato in candidati:
        unici.setdefault(candidato.osm_id or candidato.google_place_id or "", candidato)
    return list(unici.values())


def scrivi_csv(candidati: list[Candidato], destinazione: Path) -> None:
    with destinazione.open("w", encoding="utf-8", newline="") as file:
        scrittore = csv.DictWriter(file, fieldnames=list(Candidato.__dataclass_fields__))
        scrittore.writeheader()
        for candidato in candidati:
            scrittore.writerow(asdict(candidato))


async def importa(candidati: list[Candidato], url_database: str) -> int:
    """Inserisce i candidati non ancora noti; segnala un possibile doppione entro 200 m o con
    lo stesso nome normalizzato. Restituisce il numero di candidati nuovi."""
    nuovi = 0
    async with await psycopg.AsyncConnection.connect(url_database) as connessione:
        for c in candidati:
            cursore = await connessione.execute(
                """insert into public.candidati_locali
                     (origine, osm_id, google_place_id, nome, indirizzo, comune, provincia,
                      posizione, sito_web, possibile_doppione_id)
                   select %(origine)s, %(osm)s, %(google)s, %(nome)s, %(indirizzo)s, %(comune)s,
                          %(provincia)s,
                          case when %(lat)s::float8 is null then null else
                            extensions.st_setsrid(extensions.st_makepoint(%(lon)s, %(lat)s), 4326)
                            ::extensions.geography end,
                          %(sito)s,
                          (select l.id from public.locali l
                           where (%(lat)s::float8 is not null and extensions.st_dwithin(
                                    l.posizione,
                                    extensions.st_setsrid(extensions.st_makepoint(%(lon)s, %(lat)s),
                                                          4326)::extensions.geography,
                                    %(distanza)s))
                              or l.nome_normalizzato = %(nome_normalizzato)s
                           limit 1)
                   where not exists (select 1 from public.locali l
                                     where l.osm_id = %(osm)s or l.google_place_id = %(google)s)
                   on conflict do nothing""",
                {
                    "origine": c.origine,
                    "osm": c.osm_id,
                    "google": c.google_place_id,
                    "nome": c.nome,
                    "nome_normalizzato": normalizza_nome(c.nome) if c.nome else None,
                    "indirizzo": c.indirizzo,
                    "comune": c.comune,
                    "provincia": c.provincia,
                    "lat": c.lat,
                    "lon": c.lon,
                    "sito": c.sito_web,
                    "distanza": DISTANZA_DOPPIONE_M,
                },
            )
            nuovi += cursore.rowcount
        await connessione.commit()
    return nuovi


async def principale(argomenti: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    parser.add_argument("--csv", type=Path, required=True, help="file CSV da scrivere")
    parser.add_argument("--importa", action="store_true", help="inserisce in candidati_locali")
    opzioni = parser.parse_args(argomenti)
    impostazioni = leggi_impostazioni()
    configura_log("console", impostazioni.log_livello)
    async with crea_client_httpx(90.0) as client:
        http = ClientHttpConforme(
            client,
            StatoCondiviso(),
            user_agent=impostazioni.scraper_user_agent,
            pagine_massime=50,
            intervallo_minimo_s=impostazioni.scraper_intervallo_minimo_s,
        )
        try:
            candidati = await raccogli_candidati(impostazioni, http)
        except ErroreRaccolta as errore:
            log.warning("bootstrap_fallito", codice=errore.codice, errore=str(errore))
            return 1
    scrivi_csv(candidati, opzioni.csv)
    log.info("csv_scritto", candidati=len(candidati), file=str(opzioni.csv))
    if opzioni.importa:
        nuovi = await importa(candidati, impostazioni.url_database())
        log.info("candidati_importati", nuovi=nuovi)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(principale()))
