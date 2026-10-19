"""Costruzione, validazione e impronta dell'evento normalizzato (EVENT_INGESTION.md §3)."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable
from datetime import datetime, timedelta

from pydantic import ValidationError

from noxa_worker.errori import ErroreValidazione
from noxa_worker.normalizzazione.alcol import contiene_riferimenti_alcol
from noxa_worker.normalizzazione.eta import estrai_eta_minima
from noxa_worker.normalizzazione.generi import mappa_generi
from noxa_worker.normalizzazione.modelli import EventoNormalizzato, LocaleEvento, Origine
from noxa_worker.normalizzazione.testo import pulisci, tronca

FUTURO_MASSIMO = timedelta(days=180)
PASSATO_MASSIMO = timedelta(hours=12)
DURATA_MASSIMA = timedelta(hours=24)
MASSIMO_ARTISTI = 20


def costruisci_evento(
    *,
    origine: Origine,
    locale: LocaleEvento,
    titolo: str | None,
    inizio: datetime,
    fine: datetime | None = None,
    descrizione: str | None = None,
    testi_aggiuntivi: Iterable[str | None] = (),
    etichette_generi: Iterable[str | None] = (),
    artisti: Iterable[str | None] = (),
    prezzo_min_centesimi: int | None = None,
    url_biglietti: str | None = None,
) -> EventoNormalizzato:
    """Evento nello schema v1 a partire dai campi letti dalla fonte.

    Età minima e riferimenti all'alcol si cercano in titolo, descrizione e `testi_aggiuntivi`
    (per esempio le note sull'ingresso); i generi nelle etichette, poi nel titolo e nella
    descrizione. Solleva `ErroreValidazione` se i dati non rispettano lo schema.
    """
    titolo_pulito = tronca(pulisci(titolo), 200)
    descrizione_completa = pulisci(descrizione)
    aggiuntivi = [pulisci(t) for t in testi_aggiuntivi]
    tutti = [titolo_pulito, descrizione_completa, *aggiuntivi]
    generi = mappa_generi([*etichette_generi]) or mappa_generi(
        [titolo_pulito, descrizione_completa]
    )
    nomi_artisti: list[str] = []
    for nome in artisti:
        pulito = tronca(pulisci(nome), 80)
        if pulito and pulito.casefold() not in {a.casefold() for a in nomi_artisti}:
            nomi_artisti.append(pulito)
    biglietti = url_biglietti if url_biglietti and url_biglietti.startswith("https://") else None
    try:
        return EventoNormalizzato(
            origine=origine,
            locale=locale,
            titolo=titolo_pulito,
            descrizione=tronca(descrizione_completa, 500) or None,
            inizio=inizio,
            fine=fine,
            eta_minima=estrai_eta_minima(*tutti),
            riferimenti_alcol=contiene_riferimenti_alcol(*tutti),
            generi=generi,
            artisti=tuple(nomi_artisti[:MASSIMO_ARTISTI]),
            prezzo_min_centesimi=prezzo_min_centesimi,
            url_biglietti=biglietti,
        )
    except ValidationError as errore:
        campi = ", ".join(sorted({str(e["loc"][0]) for e in errore.errors() if e["loc"]}))
        raise ErroreValidazione(f"dati non validi per lo schema evento: {campi}") from errore


def valida_regole(evento: EventoNormalizzato, adesso: datetime) -> None:
    """Regole del passo 4 (EVENT_INGESTION.md §3.1) oltre allo schema."""
    if evento.inizio > adesso + FUTURO_MASSIMO:
        raise ErroreValidazione("inizio oltre 180 giorni", codice="INIZIO_TROPPO_LONTANO")
    if evento.inizio < adesso - PASSATO_MASSIMO:
        raise ErroreValidazione("evento già passato", codice="EVENTO_PASSATO")
    if evento.fine is not None:
        if evento.fine <= evento.inizio:
            raise ErroreValidazione("la fine precede l'inizio", codice="FINE_NON_VALIDA")
        if evento.fine - evento.inizio > DURATA_MASSIMA:
            raise ErroreValidazione("durata oltre 24 ore", codice="FINE_NON_VALIDA")


def calcola_hash(evento: EventoNormalizzato) -> str:
    """SHA-256 del payload senza `raccolto_il` (§3.2): la stessa pagina riletta senza
    modifiche dà la stessa impronta."""
    payload = evento.model_dump(mode="json", exclude={"origine": {"raccolto_il"}})
    testo = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(testo.encode("utf-8")).hexdigest()
