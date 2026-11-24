"""Arricchimento dalla pagina della serata (EVENT_INGESTION.md §2.2).

Gli elenchi dei siti dicono titolo, data e ora; il link ai biglietti, il prezzo d'ingresso,
l'età minima e il genere stanno quasi sempre nella pagina della singola serata. Dopo la
lettura dell'elenco si leggono quindi alcune pagine di dettaglio dello stesso sito, sempre
con `ClientHttpConforme` (robots.txt, intervallo per dominio, limite di pagine della fonte):

- solo le serate dei prossimi 45 giorni che non hanno ancora un link ai biglietti;
- al massimo `DETTAGLI_PER_ESECUZIONE` pagine per esecuzione: metà alle serate più vicine,
  metà a rotazione tra le altre, così nessuna resta indietro;
- un 403 o un 429 fermano subito la lettura dei dettagli; ogni altro errore salta la pagina.

Dalla pagina si prendono solo campi dello schema evento: link ai biglietti, prezzo minimo
d'ingresso, e le righe che parlano dell'ingresso (per età e alcol) e della musica (per i
generi). Il testo della pagina non si salva. I dati letti completano il grezzo dell'elenco e
non sostituiscono mai un campo già presente.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import ClassVar, Protocol
from urllib.parse import urljoin, urlsplit

import structlog
from bs4 import BeautifulSoup
from pydantic import JsonValue

from noxa_worker.errori import ErroreConformita, ErroreFonte
from noxa_worker.fonti.base import EventoGrezzo, Fonte
from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.normalizzazione.date import interpreta_iso
from noxa_worker.normalizzazione.eta import estrai_eta_minima
from noxa_worker.normalizzazione.modelli import in_https
from noxa_worker.normalizzazione.testo import pulisci

log = structlog.get_logger(__name__)

DETTAGLI_PER_ESECUZIONE = 8
ORIZZONTE = timedelta(days=45)
PASSATO_TOLLERATO = timedelta(hours=12)
PREZZO_MASSIMO_CENTESIMI = 30_000
_ROTAZIONE_S = 900
_CODICI_DI_ARRESTO = frozenset({"HTTP_403", "HTTP_429"})

# Biglietterie riconosciute dal dominio (D-05: si salva solo il link pubblicato dal locale).
BIGLIETTERIE = (
    "ticketone.it",
    "vivaticket.com",
    "dice.fm",
    "xceed.me",
    "ticketmaster.it",
    "mailticket.it",
    "ticketsms.it",
    "eventbrite.it",
    "eventbrite.com",
    "ra.co",
    "shotgun.live",
    "ciaotickets.com",
    "boxol.it",
    "ticketswap.it",
    "oooh.events",
)
# Domini che non sono mai una biglietteria, anche se il testo del link parla di biglietti.
_NON_BIGLIETTERIE = (
    "facebook.com",
    "instagram.com",
    "tiktok.com",
    "youtube.com",
    "youtu.be",
    "spotify.com",
    "google.com",
    "apple.com",
    "whatsapp.com",
    "wa.me",
    "t.me",
    "outlook.com",
    "live.com",
    "office.com",
    "x.com",
    "twitter.com",
)
_TESTO_BIGLIETTI = re.compile(r"bigliett|ticket|acquista|prevendit|compra|\bbuy\b", re.IGNORECASE)

_RIGA_INGRESSO = re.compile(
    r"ingress|entrata|prevendit|bigliett|ticket|presale|prezzo|\bprice\b", re.IGNORECASE
)
_RIGA_TAVOLI = re.compile(
    r"tavol|\btables?\b|priv[eéè]|bottigli|bottle|guardaroba|cloakroom|divanett", re.IGNORECASE
)
_RIGA_ETA = re.compile(
    r"ingress|ammess|vietat|minor|maggiorenn|\bunder\b|\bover\b|\bet[aà]\b|riservat|"
    r"\ballowed\b|\d{2}\s?\+|\+\s?\d{2}",
    re.IGNORECASE,
)
_RIGA_MUSICA = re.compile(r"^(?:musica|music|genere|generi|sound)\s*:\s*(.+)$", re.IGNORECASE)
_GRATIS = re.compile(
    r"ingresso\s+(?:libero|gratuito|gratis)|entrata\s+(?:libera|gratuita)|free\s+entry",
    re.IGNORECASE,
)
_EURO = re.compile(
    r"(?:€|eur(?:o)?)\s?(\d{1,3}(?:[.,]\d{1,2})?)(?!\d)|"
    r"(?<!\d)(\d{1,3}(?:[.,]\d{1,2})?)\s?(?:€|euro\b)",
    re.IGNORECASE,
)
_CIFRE = re.compile(r"\d+")
# Righe dopo la parola «ingresso» in cui cercare ancora il prezzo ("INGRESSO:" e sotto "20 €").
_RIGHE_DOPO_INGRESSO = 3
_LUNGHEZZA_MASSIMA_RIGA = 300
_RIGHE_MASSIME = 12


@dataclass(frozen=True)
class DatiDettaglio:
    """Campi letti dalla pagina di una serata."""

    url_biglietti: str | None = None
    prezzo_centesimi: int | None = None
    note_ingresso: tuple[str, ...] = ()
    etichette: tuple[str, ...] = ()

    @property
    def vuoto(self) -> bool:
        return (
            self.url_biglietti is None
            and self.prezzo_centesimi is None
            and not self.note_ingresso
            and not self.etichette
        )


class AdattatoreConDettaglio(Protocol):
    """Adattatore che sa leggere la pagina della singola serata."""

    arricchisce_dal_dettaglio: ClassVar[bool]

    def dettaglio(self, pagina: BeautifulSoup, url: str) -> DatiDettaglio: ...


def _dominio(url: str) -> str:
    """Dominio registrabile approssimato: le ultime due etichette dell'host."""
    host = (urlsplit(url).hostname or "").lower()
    return ".".join(host.split(".")[-2:])


def _appartiene(host: str, domini: tuple[str, ...]) -> bool:
    return any(host == dominio or host.endswith(f".{dominio}") for dominio in domini)


def _corpo(pagina: BeautifulSoup) -> BeautifulSoup:
    """Copia della pagina senza script, stili, navigazione, testata e piè di pagina."""
    copia = BeautifulSoup(str(pagina), "html.parser")
    for nodo in copia.select("script, style, noscript, nav, header, footer, form"):
        nodo.decompose()
    return copia


def link_biglietti(pagina: BeautifulSoup, url: str) -> str | None:
    """Link https a una biglietteria esterna nel corpo della pagina; `None` se non c'è.

    Vale un dominio dell'elenco `BIGLIETTERIE` oppure un link verso un altro sito il cui
    testo parla di biglietti. I link interni al sito ("/eventi/", "/buy-tickets/") non sono
    il biglietto della serata."""
    proprio = _dominio(url)
    per_testo: str | None = None
    for a in pagina.select("a[href]"):
        href = a.get("href")
        if not isinstance(href, str):
            continue
        destinazione = urljoin(url, href.strip())
        parti = urlsplit(destinazione)
        host = (parti.hostname or "").lower()
        if parti.scheme != "https" or not host or parti.username or parti.password:
            continue
        if _dominio(destinazione) == proprio or _appartiene(host, _NON_BIGLIETTERIE):
            continue
        if _appartiene(host, BIGLIETTERIE):
            return destinazione[:500]
        if per_testo is None and _TESTO_BIGLIETTI.search(pulisci(a.get_text(" "))):
            per_testo = destinazione[:500]
    return per_testo


def righe_di(pagina: BeautifulSoup) -> list[str]:
    """Righe di testo del corpo, pulite e senza ripetizioni consecutive."""
    righe: list[str] = []
    for grezza in pagina.get_text("\n").split("\n"):
        riga = pulisci(grezza)
        if riga and (not righe or righe[-1] != riga):
            righe.append(riga)
    return righe


def _importi(riga: str) -> list[int]:
    centesimi: list[int] = []
    for prima, dopo in _EURO.findall(riga):
        euro, _, decimali = (prima or dopo).replace(",", ".").partition(".")
        valore = int(euro) * 100 + int(decimali.ljust(2, "0")[:2] or "0")
        if 0 < valore <= PREZZO_MASSIMO_CENTESIMI:
            centesimi.append(valore)
    return centesimi


def prezzo_ingresso(righe: list[str]) -> int | None:
    """Prezzo minimo d'ingresso in centesimi.

    Si guardano solo le righe che parlano di ingresso o biglietti e le poche che seguono,
    fermandosi a tavoli, privé e guardaroba: «Pista 400 € con 2 bottiglie» non è il prezzo
    della serata. «Ingresso libero» vale 0 quando non c'è nessun importo."""
    importi: list[int] = []
    gratis = False
    finestra = 0
    for riga in righe:
        if _RIGA_TAVOLI.search(riga):
            finestra = 0
            continue
        if _RIGA_INGRESSO.search(riga):
            finestra = _RIGHE_DOPO_INGRESSO + 1
            gratis = gratis or bool(_GRATIS.search(riga))
        if finestra > 0:
            finestra -= 1
            importi.extend(_importi(riga))
    if importi:
        return min(importi)
    return 0 if gratis else None


def note_ingresso(righe: list[str]) -> tuple[str, ...]:
    """Righe utili a età minima e riferimenti all'alcol, senza il resto della pagina.

    Le righe sull'ingresso restano come sono. Da quelle su tavoli e privé si tolgono i
    numeri: «privé solo per gruppi dai 21 anni» non è l'età minima della serata, ma le
    bottiglie restano un riferimento all'alcol (R-23)."""
    note: list[str] = []
    for riga in righe:
        if len(riga) > _LUNGHEZZA_MASSIMA_RIGA:
            continue
        if _RIGA_TAVOLI.search(riga):
            note.append(pulisci(_CIFRE.sub("", riga)))
        elif _RIGA_ETA.search(riga):
            note.append(riga)
        if len(note) >= _RIGHE_MASSIME:
            break
    return tuple(nota for nota in note if nota)


def etichette_musica(righe: list[str]) -> tuple[str, ...]:
    """Generi dichiarati con «Musica: …» o «Music: …»."""
    trovate: list[str] = []
    for riga in righe:
        corrispondenza = _RIGA_MUSICA.match(riga)
        if corrispondenza and (testo := pulisci(corrispondenza.group(1))[:120]):
            trovate.append(testo)
    return tuple(dict.fromkeys(trovate))[:4]


def leggi_dettaglio(pagina: BeautifulSoup, url: str) -> DatiDettaglio:
    """Lettura generica della pagina di una serata."""
    corpo = _corpo(pagina)
    righe = righe_di(corpo)
    return DatiDettaglio(
        url_biglietti=link_biglietti(corpo, url),
        prezzo_centesimi=prezzo_ingresso(righe),
        note_ingresso=note_ingresso(righe),
        etichette=etichette_musica(righe),
    )


def applica(grezzo: EventoGrezzo, dettaglio: DatiDettaglio) -> EventoGrezzo:
    """Grezzo completato con i dati del dettaglio: i campi già letti dall'elenco restano."""
    if dettaglio.vuoto:
        return grezzo
    dati: dict[str, JsonValue] = dict(grezzo.dati)
    if not dati.get("url_biglietti") and dettaglio.url_biglietti:
        dati["url_biglietti"] = dettaglio.url_biglietti
    if dati.get("prezzo_centesimi") is None and dettaglio.prezzo_centesimi is not None:
        dati["prezzo_centesimi"] = dettaglio.prezzo_centesimi
    if dettaglio.note_ingresso:
        esistenti = dati.get("note_ingresso")
        note: list[JsonValue] = list(esistenti) if isinstance(esistenti, list) else []
        dati["note_ingresso"] = [*note, *dettaglio.note_ingresso]
    if dettaglio.etichette and not dati.get("etichette"):
        dati["etichette"] = list(dettaglio.etichette)
    return grezzo.model_copy(update={"dati": dati})


def _senza_barra(url: str) -> str:
    """Forma di confronto: nel catalogo i link sono già in `https` (`in_https`)."""
    return str(in_https(url)).rstrip("/")


def _inizio(grezzo: EventoGrezzo) -> datetime | None:
    valore = grezzo.dati.get("inizio")
    if not isinstance(valore, str) or grezzo.dati.get("ha_ora") is False:
        return None
    try:
        return interpreta_iso(valore)
    except ValueError:
        return None


def scegli_da_arricchire(
    grezzi: list[EventoGrezzo], fonte: Fonte, adesso: datetime, massimo: int
) -> list[EventoGrezzo]:
    """Serate di cui leggere la pagina in questa esecuzione.

    Candidata è una serata dei prossimi 45 giorni con una pagina propria sullo stesso sito
    della fonte a cui manca ancora il link ai biglietti o l'età dichiarata, sia nel grezzo
    sia nel catalogo (`fonte.url_completi`): molti siti, come Gate, danno i biglietti
    nell'elenco e scrivono l'età solo nella pagina della serata. Metà dei posti va alle più
    vicine, il resto a rotazione."""
    if massimo <= 0:
        return []
    sito = _dominio(fonte.url)
    completi = {_senza_barra(url) for url in fonte.url_completi}
    candidati: list[tuple[datetime, EventoGrezzo]] = []
    visti: set[str] = set()
    for grezzo in grezzi:
        url = _senza_barra(grezzo.url)
        inizio = _inizio(grezzo)
        if (
            inizio is None
            or url in visti
            or url in completi
            or url == _senza_barra(fonte.url)
            or _dominio(url) != sito
            or _completo(grezzo)
            or not adesso - PASSATO_TOLLERATO <= inizio <= adesso + ORIZZONTE
        ):
            continue
        visti.add(url)
        candidati.append((inizio, grezzo))
    candidati.sort(key=lambda voce: voce[0])
    vicine = (massimo + 1) // 2
    scelti = [grezzo for _, grezzo in candidati[:vicine]]
    turno = int(adesso.timestamp()) // _ROTAZIONE_S
    resto = sorted(
        (grezzo for _, grezzo in candidati[vicine:]),
        key=lambda grezzo: hashlib.sha256(f"{turno}:{grezzo.url}".encode()).hexdigest(),
    )
    return [*scelti, *resto[: massimo - len(scelti)]]


def _completo(grezzo: EventoGrezzo) -> bool:
    """Il grezzo ha già il link ai biglietti e un'età dichiarata nei suoi testi."""
    if not grezzo.dati.get("url_biglietti"):
        return False
    note = grezzo.dati.get("note_ingresso")
    testi = [t for t in note if isinstance(t, str)] if isinstance(note, list) else []
    for campo in ("titolo", "descrizione"):
        valore = grezzo.dati.get(campo)
        if isinstance(valore, str):
            testi.append(valore)
    return estrai_eta_minima(*testi) is not None


async def arricchisci(
    adattatore: AdattatoreConDettaglio,
    grezzi: list[EventoGrezzo],
    fonte: Fonte,
    http: ClientHttpConforme,
    adesso: datetime,
) -> list[EventoGrezzo]:
    """Grezzi dell'elenco, con quelli scelti completati dalla loro pagina."""
    massimo = min(DETTAGLI_PER_ESECUZIONE, http.pagine_rimanenti)
    scelti = scegli_da_arricchire(grezzi, fonte, adesso, massimo)
    if not scelti:
        return grezzi
    contesto = log.bind(fonte_id=str(fonte.id))
    completati: dict[str, EventoGrezzo] = {}
    for grezzo in scelti:
        if http.pagine_rimanenti <= 0:
            break
        try:
            risposta, pagina = await http.get_html(grezzo.url)
        except ErroreConformita as errore:
            contesto.info("dettagli_fermati", codice=errore.codice)
            break
        except ErroreFonte as errore:
            if errore.codice in _CODICI_DI_ARRESTO:
                contesto.warning("dettagli_fermati", codice=errore.codice)
                break
            contesto.info("dettaglio_saltato", codice=errore.codice)
            continue
        completati[grezzo.url] = applica(grezzo, adattatore.dettaglio(pagina, risposta.url))
    contesto.info("dettagli_letti", scelti=len(scelti), letti=len(completati))
    return [completati.get(grezzo.url, grezzo) for grezzo in grezzi]
