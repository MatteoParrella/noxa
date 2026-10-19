"""Unico punto da cui il worker fa richieste HTTP alle fonti (EVENT_INGESTION.md §2.4, §4;
ADR-0008).

`ClientHttpConforme` applica in un solo posto:

- user agent `NoxaBot` dichiarato, senza rotazioni;
- robots.txt riletto ogni 24 ore per dominio, per `NoxaBot` e `*`, anche a ogni redirect;
  un percorso vietato solleva `ErroreConformita` senza fare la richiesta;
- al massimo una richiesta ogni 5 secondi per dominio (o il `Crawl-delay` se più lungo);
- al massimo `pagine_massime` pagine per esecuzione (mai oltre 50);
- arresto su 403 e 429, che il sito usa per dire di fermarsi;
- `ETag` e `If-Modified-Since` quando il sito li supporta;
- timeout espliciti e un limite di 5 MB per risposta.

Gli adattatori non importano `httpx` (lo verifica `tests/unit/test_architettura.py`).
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from email.message import Message
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx
import structlog
from bs4 import BeautifulSoup
from pydantic import JsonValue, TypeAdapter, ValidationError

from noxa_worker.errori import ErroreConformita, ErroreFonte

log = structlog.get_logger(__name__)

PAGINE_MASSIME_ASSOLUTE = 50
DURATA_CACHE_ROBOTS_S = 24 * 3600
DIMENSIONE_MASSIMA = 5 * 1024 * 1024
REDIRECT_MASSIMI = 5
NOME_AGENTE = "NoxaBot"

_JSON = TypeAdapter(JsonValue)


def crea_client_httpx(timeout_s: float = 20.0) -> httpx.AsyncClient:
    """Client httpx condiviso da `ClientHttpConforme`: l'unico punto in cui si crea."""
    return httpx.AsyncClient(timeout=httpx.Timeout(timeout_s, connect=10.0))


@dataclass(frozen=True)
class RispostaHttp:
    """Risposta letta: URL finale dopo i redirect, stato, testo e tipo di contenuto."""

    url: str
    stato: int
    testo: str
    tipo_contenuto: str


@dataclass(frozen=True)
class _RispostaGrezza:
    stato: int
    intestazioni: httpx.Headers
    corpo: bytes

    @property
    def e_redirect(self) -> bool:
        return self.stato in (301, 302, 303, 307, 308)

    @property
    def testo(self) -> str:
        messaggio = Message()
        messaggio["content-type"] = self.intestazioni.get("content-type", "")
        codifica = messaggio.get_content_charset() or "utf-8"
        try:
            return self.corpo.decode(codifica, errors="replace")
        except LookupError:
            return self.corpo.decode("utf-8", errors="replace")


@dataclass
class _VoceCache:
    etag: str | None
    ultima_modifica: str | None
    risposta: RispostaHttp


@dataclass
class StatoCondiviso:
    """Stato condiviso tra le esecuzioni del processo: robots.txt, ultimo accesso per dominio
    e cache condizionale. Le esecuzioni dello stesso dominio sono già serializzate dalla coda
    (`chiave_concorrenza`); il lucchetto protegge comunque l'intervallo minimo."""

    robots: dict[str, tuple[float, RobotFileParser | None]] = field(default_factory=dict)
    ultimo_accesso: dict[str, float] = field(default_factory=dict)
    lucchetti: dict[str, asyncio.Lock] = field(default_factory=dict)
    cache: dict[str, _VoceCache] = field(default_factory=dict)

    def lucchetto(self, dominio: str) -> asyncio.Lock:
        return self.lucchetti.setdefault(dominio, asyncio.Lock())


class ClientHttpConforme:
    """Client di una singola esecuzione di una fonte, con il suo conteggio di pagine."""

    def __init__(
        self,
        client: httpx.AsyncClient,
        stato: StatoCondiviso,
        *,
        user_agent: str,
        pagine_massime: int,
        intervallo_minimo_s: float = 5.0,
        orologio: Callable[[], float] = time.monotonic,
        attendi: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        if NOME_AGENTE not in user_agent:
            raise ValueError("lo user agent deve dichiarare NoxaBot")
        self._client = client
        self._stato = stato
        self._user_agent = user_agent
        self._pagine_massime = max(1, min(pagine_massime, PAGINE_MASSIME_ASSOLUTE))
        self._intervallo = max(intervallo_minimo_s, 5.0)
        self._orologio = orologio
        self._attendi = attendi
        self.pagine_lette = 0

    @property
    def pagine_rimanenti(self) -> int:
        return self._pagine_massime - self.pagine_lette

    async def get_testo(self, url: str) -> RispostaHttp:
        """GET di una pagina della fonte, con tutte le regole di conformità."""
        if self.pagine_rimanenti <= 0:
            raise ErroreConformita(
                f"raggiunto il limite di {self._pagine_massime} pagine", codice="LIMITE_PAGINE"
            )
        corrente = url
        for _ in range(REDIRECT_MASSIMI + 1):
            _verifica_url(corrente)
            await self._verifica_robots(corrente)
            risposta = await self._richiedi(corrente)
            if risposta.e_redirect:
                destinazione = risposta.intestazioni.get("location")
                if not destinazione:
                    raise ErroreFonte("redirect senza destinazione", codice="REDIRECT")
                corrente = urljoin(corrente, destinazione)
                continue
            self.pagine_lette += 1
            return self._interpreta(corrente, risposta)
        raise ErroreFonte("troppi redirect", codice="REDIRECT")

    async def get_html(self, url: str) -> tuple[RispostaHttp, BeautifulSoup]:
        """Pagina HTML già analizzata."""
        risposta = await self.get_testo(url)
        return risposta, BeautifulSoup(risposta.testo, "html.parser")

    async def get_json_api(
        self,
        url: str,
        parametri: Mapping[str, str],
        *,
        intestazioni: Mapping[str, str] | None = None,
    ) -> JsonValue:
        """GET su un'API ufficiale con chiave (Instagram Graph API, Google Places, Overpass).

        robots.txt regola i crawler delle pagine web, non le API autorizzate dai termini del
        fornitore (ADR-0008): qui non si legge, ma valgono user agent, intervallo minimo,
        limite di pagine e arresto su 403 e 429. I parametri non finiscono nei log: possono
        contenere il token.
        """
        return await self._api("GET", url, parametri, intestazioni, None)

    async def post_json_api(
        self,
        url: str,
        corpo: JsonValue,
        *,
        intestazioni: Mapping[str, str] | None = None,
    ) -> JsonValue:
        """POST su un'API ufficiale che lo richiede (Google Places Text Search), con le stesse
        regole di `get_json_api`."""
        return await self._api("POST", url, None, intestazioni, corpo)

    async def _api(
        self,
        metodo: str,
        url: str,
        parametri: Mapping[str, str] | None,
        intestazioni: Mapping[str, str] | None,
        corpo: JsonValue | None,
    ) -> JsonValue:
        if self.pagine_rimanenti <= 0:
            raise ErroreConformita("raggiunto il limite di pagine", codice="LIMITE_PAGINE")
        _verifica_url(url)
        risposta = await self._richiedi(
            url, parametri=parametri, intestazioni=intestazioni, metodo=metodo, corpo=corpo
        )
        self.pagine_lette += 1
        letta = self._interpreta(url, risposta, usa_cache=False)
        try:
            return _JSON.validate_json(letta.testo)
        except ValidationError as errore:
            raise ErroreFonte("risposta JSON non valida", codice="JSON_NON_VALIDO") from errore

    # -----------------------------------------------------------------------------------------

    async def _verifica_robots(self, url: str) -> None:
        parti = urlsplit(url)
        dominio = parti.netloc.lower()
        adesso = self._orologio()
        voce = self._stato.robots.get(dominio)
        if voce is None or voce[0] <= adesso:
            regole = await self._leggi_robots(f"{parti.scheme}://{parti.netloc}/robots.txt")
            self._stato.robots[dominio] = (adesso + DURATA_CACHE_ROBOTS_S, regole)
            voce = self._stato.robots[dominio]
        regole = voce[1]
        if regole is not None and not regole.can_fetch(NOME_AGENTE, url):
            raise ErroreConformita(f"robots.txt vieta {parti.path or '/'}", codice="ROBOTS")

    async def _leggi_robots(self, url: str) -> RobotFileParser | None:
        """Regole di robots.txt; `None` se il file non esiste (tutto consentito).

        Come indicano le specifiche (RFC 9309): 404 = nessuna regola; 401 e 403 = tutto
        vietato; errori del server o di rete = la fonte non si legge in questa esecuzione.
        """
        risposta = await self._richiedi(url, segui_robots=False)
        regole = RobotFileParser()
        if 400 <= risposta.stato < 500 and risposta.stato not in (401, 403, 429):
            return None
        if risposta.stato in (401, 403):
            regole.parse(["User-agent: *", "Disallow: /"])
            return regole
        if risposta.stato != 200:
            raise ErroreFonte(
                f"robots.txt non disponibile (HTTP {risposta.stato})",
                codice=f"HTTP_{risposta.stato}",
            )
        regole.parse(risposta.testo.splitlines())
        return regole

    async def _richiedi(
        self,
        url: str,
        *,
        parametri: Mapping[str, str] | None = None,
        intestazioni: Mapping[str, str] | None = None,
        segui_robots: bool = True,
        metodo: str = "GET",
        corpo: JsonValue | None = None,
    ) -> _RispostaGrezza:
        dominio = urlsplit(url).netloc.lower()
        richiesta_intestazioni = {"User-Agent": self._user_agent, **(intestazioni or {})}
        voce = (
            self._stato.cache.get(url)
            if segui_robots and parametri is None and metodo == "GET"
            else None
        )
        if voce is not None:
            if voce.etag:
                richiesta_intestazioni["If-None-Match"] = voce.etag
            if voce.ultima_modifica:
                richiesta_intestazioni["If-Modified-Since"] = voce.ultima_modifica
        async with self._stato.lucchetto(dominio):
            await self._rispetta_intervallo(dominio)
            try:
                async with self._client.stream(
                    metodo,
                    url,
                    params=dict(parametri) if parametri else None,
                    headers=richiesta_intestazioni,
                    json=corpo,
                    follow_redirects=False,
                ) as risposta:
                    contenuto = bytearray()
                    async for blocco in risposta.aiter_bytes():
                        contenuto.extend(blocco)
                        if len(contenuto) > DIMENSIONE_MASSIMA:
                            raise ErroreFonte("risposta oltre 5 MB", codice="TROPPO_GRANDE")
                    letta = _RispostaGrezza(
                        risposta.status_code, risposta.headers, bytes(contenuto)
                    )
            except httpx.TimeoutException as errore:
                raise ErroreFonte(f"timeout su {dominio}", codice="TIMEOUT") from errore
            except httpx.HTTPError as errore:
                raise ErroreFonte(
                    f"errore di rete su {dominio}: {type(errore).__name__}", codice="RETE"
                ) from errore
            finally:
                self._stato.ultimo_accesso[dominio] = self._orologio()
        return letta

    async def _rispetta_intervallo(self, dominio: str) -> None:
        intervallo = self._intervallo
        voce = self._stato.robots.get(dominio)
        if voce is not None and voce[1] is not None:
            ritardo = voce[1].crawl_delay(NOME_AGENTE)
            if ritardo is not None:
                intervallo = max(intervallo, float(ritardo))
        precedente = self._stato.ultimo_accesso.get(dominio)
        if precedente is not None:
            attesa = precedente + intervallo - self._orologio()
            if attesa > 0:
                await self._attendi(attesa)

    def _interpreta(
        self, url: str, risposta: _RispostaGrezza, *, usa_cache: bool = True
    ) -> RispostaHttp:
        stato = risposta.stato
        if stato == 304 and usa_cache and url in self._stato.cache:
            return self._stato.cache[url].risposta
        if stato in (403, 429):
            # Il sito chiede di fermarsi: nessun altro tentativo in questa esecuzione.
            raise ErroreFonte(
                f"il sito ha risposto HTTP {stato}: fonte fermata", codice=f"HTTP_{stato}"
            )
        if stato >= 400:
            raise ErroreFonte(
                f"HTTP {stato} su {urlsplit(url).path or '/'}", codice=f"HTTP_{stato}"
            )
        letta = RispostaHttp(
            url=url,
            stato=stato,
            testo=risposta.testo,
            tipo_contenuto=risposta.intestazioni.get("content-type", ""),
        )
        etag = risposta.intestazioni.get("etag")
        ultima_modifica = risposta.intestazioni.get("last-modified")
        if usa_cache and (etag or ultima_modifica):
            self._stato.cache[url] = _VoceCache(
                etag=etag,
                ultima_modifica=ultima_modifica,
                risposta=letta,
            )
        return letta


def _verifica_url(url: str) -> None:
    parti = urlsplit(url)
    if parti.scheme not in ("http", "https") or not parti.netloc:
        raise ErroreFonte(f"URL non valido: {url[:80]}", codice="URL_NON_VALIDO")
    if parti.username or parti.password:
        # Niente accessi con credenziali (ADR-0008: vietati login e aree riservate).
        raise ErroreConformita("URL con credenziali", codice="CREDENZIALI")
