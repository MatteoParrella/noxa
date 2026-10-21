"""Funzioni comuni agli adattatori dei siti: prezzi, identificativi e costruzione dell'evento
normalizzato dai campi raccolti."""

from __future__ import annotations

import hashlib
import re
from datetime import date, datetime

from pydantic import JsonValue

from noxa_worker.errori import ErroreValidazione
from noxa_worker.fonti.base import EventoGrezzo, Fonte
from noxa_worker.normalizzazione.date import interpreta_iso
from noxa_worker.normalizzazione.evento import costruisci_evento
from noxa_worker.normalizzazione.modelli import (
    EventoNormalizzato,
    LocaleEvento,
    Origine,
    TipoOrigine,
)

_PREZZO = re.compile(r"(\d{1,4})(?:[.,](\d{1,2}))?")


def prezzo_in_centesimi(valore: object) -> int | None:
    """Prezzo in centesimi da "15", "15,50 €" o 15.5; None se assente o non leggibile."""
    if isinstance(valore, bool) or valore is None:
        return None
    if isinstance(valore, int | float):
        return round(float(valore) * 100) if valore >= 0 else None
    if isinstance(valore, str):
        trovato = _PREZZO.search(valore)
        if trovato:
            euro, decimali = trovato.groups()
            return int(euro) * 100 + int((decimali or "0").ljust(2, "0"))
    return None


def id_esterno_da(*parti: str | None) -> str:
    """Identificativo stabile quando la fonte non ne ha uno: impronta dei campi indicati."""
    testo = "\x1f".join(p or "" for p in parti)
    return hashlib.sha256(testo.encode("utf-8")).hexdigest()[:24]


def testo_o_none(valore: JsonValue | None) -> str | None:
    return valore if isinstance(valore, str) and valore.strip() else None


def lista_testi(valore: JsonValue | None) -> list[str]:
    if isinstance(valore, list):
        return [v for v in valore if isinstance(v, str) and v.strip()]
    if isinstance(valore, str) and valore.strip():
        return [parte.strip() for parte in valore.split(",") if parte.strip()]
    return []


def data_ora_iso(valore: datetime | date) -> tuple[str, bool]:
    """Data in ISO 8601 e se contiene un orario."""
    if isinstance(valore, datetime):
        return valore.isoformat(), True
    return valore.isoformat(), False


def evento_da_campi(
    grezzo: EventoGrezzo, fonte: Fonte, tipo: TipoOrigine = TipoOrigine.SITO_LOCALE
) -> EventoNormalizzato:
    """Normalizza i campi comuni prodotti dagli adattatori dei siti:
    `titolo`, `inizio`, `fine`, `ha_ora`, `descrizione`, `artisti`, `etichette`,
    `note_ingresso`, `prezzo_centesimi`, `url_biglietti`."""
    dati = grezzo.dati
    inizio_testo = testo_o_none(dati.get("inizio"))
    if inizio_testo is None:
        raise ErroreValidazione("data di inizio mancante", codice="INIZIO_MANCANTE")
    if dati.get("ha_ora") is False:
        # Senza orario l'evento non è affidabile: serve un adattatore specifico (skill
        # add-event-source, §3a).
        raise ErroreValidazione("orario di inizio mancante", codice="ORARIO_MANCANTE")
    try:
        inizio = interpreta_iso(inizio_testo)
        fine_testo = testo_o_none(dati.get("fine"))
        fine = interpreta_iso(fine_testo) if fine_testo and dati.get("fine_ha_ora") else None
    except ValueError as errore:
        raise ErroreValidazione("data non leggibile", codice="DATA_NON_VALIDA") from errore
    prezzo = dati.get("prezzo_centesimi")
    return costruisci_evento(
        origine=Origine(
            tipo=tipo,
            fonte_id=fonte.id,
            url=grezzo.url,
            id_esterno=grezzo.id_esterno,
            raccolto_il=grezzo.raccolto_il,
        ),
        locale=LocaleEvento(id=fonte.locale_id, nome=fonte.locale_nome, comune=fonte.locale_comune),
        titolo=testo_o_none(dati.get("titolo")),
        inizio=inizio,
        fine=fine,
        descrizione=testo_o_none(dati.get("descrizione")),
        testi_aggiuntivi=lista_testi(dati.get("note_ingresso")),
        etichette_generi=lista_testi(dati.get("etichette")),
        artisti=lista_testi(dati.get("artisti")),
        prezzo_min_centesimi=prezzo if isinstance(prezzo, int) else None,
        url_biglietti=testo_o_none(dati.get("url_biglietti")),
    )
