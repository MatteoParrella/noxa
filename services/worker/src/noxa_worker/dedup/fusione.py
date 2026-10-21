"""Fusione di un grezzo in un evento esistente (EVENT_INGESTION.md §7; R-21, R-22, R-23).

La fusione non abbassa mai un'età dichiarata e non toglie mai i riferimenti all'alcol: il
trigger `private.proteggi_eta_evento` lo vieterebbe comunque al worker (NX017, NX018).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from noxa_worker.dedup import configurazione as soglie
from noxa_worker.dedup.testi import normalizza_artista
from noxa_worker.normalizzazione.modelli import EventoNormalizzato


@dataclass(frozen=True)
class EventoEsistente:
    """Evento già nel catalogo, con la priorità della fonte migliore che lo ha confermato."""

    id: UUID
    locale_id: UUID
    titolo: str
    descrizione: str | None
    inizio: datetime
    fine: datetime | None
    eta_minima: int
    eta_minima_dichiarata: bool
    riferimenti_alcol: bool
    generi: tuple[str, ...]
    artisti: tuple[str, ...]
    prezzo_min_centesimi: int | None
    url_biglietti: str | None
    stato: str
    priorita_migliore: int


@dataclass(frozen=True)
class Fusione:
    """Esito: i campi da aggiornare oppure la revisione per una modifica rilevante."""

    modifiche: dict[str, object] = field(default_factory=dict)
    generi: tuple[str, ...] | None = None
    modifica_rilevante: str | None = None


def fondi(
    esistente: EventoEsistente, nuovo: EventoNormalizzato, *, consenti_rilevanti: bool = False
) -> Fusione:
    """Campi dell'evento dopo la fusione con il grezzo.

    Le modifiche dell'inizio oltre 2 ore e i cambi di locale si applicano solo con
    `consenti_rilevanti`, cioè dopo la decisione di un moderatore.
    """
    cambia_locale = nuovo.locale.id is not None and nuovo.locale.id != esistente.locale_id
    if cambia_locale and not consenti_rilevanti:
        return Fusione(modifica_rilevante="Modifica rilevante: locale diverso")
    spostamento = abs(nuovo.inizio - esistente.inizio)
    if spostamento > soglie.MODIFICA_RILEVANTE_INIZIO and not consenti_rilevanti:
        ore = round(spostamento.total_seconds() / 3600, 1)
        return Fusione(modifica_rilevante=f"Modifica rilevante: inizio spostato di {ore} ore")

    modifiche: dict[str, object] = {}
    if cambia_locale:
        modifiche["locale_id"] = nuovo.locale.id
    # Campi descrittivi: vince la fonte più affidabile; a parità il dato più recente, cioè
    # quello appena raccolto.
    if nuovo.priorita >= esistente.priorita_migliore:
        candidati: dict[str, object] = {
            "titolo": nuovo.titolo,
            "descrizione": nuovo.descrizione,
            "inizio": nuovo.inizio,
            "fine": nuovo.fine,
            "prezzo_min_centesimi": nuovo.prezzo_min_centesimi,
            "url_biglietti": nuovo.url_biglietti,
        }
        attuali: dict[str, object] = {
            "titolo": esistente.titolo,
            "descrizione": esistente.descrizione,
            "inizio": esistente.inizio,
            "fine": esistente.fine,
            "prezzo_min_centesimi": esistente.prezzo_min_centesimi,
            "url_biglietti": esistente.url_biglietti,
        }
        for campo, valore in candidati.items():
            if valore is not None and valore != attuali[campo]:
                modifiche[campo] = valore
        nuovo_inizio = modifiche.get("inizio", esistente.inizio)
        fine = modifiche.get("fine", esistente.fine)
        if (
            isinstance(fine, datetime)
            and isinstance(nuovo_inizio, datetime)
            and fine <= nuovo_inizio
        ):
            modifiche["fine"] = None

    # R-21, R-22: vale l'età più alta tra quelle dichiarate; la prima età dichiarata
    # sostituisce il 18 predefinito.
    if nuovo.eta_minima is not None:
        eta = (
            max(esistente.eta_minima, nuovo.eta_minima)
            if esistente.eta_minima_dichiarata
            else nuovo.eta_minima
        )
        if eta != esistente.eta_minima or not esistente.eta_minima_dichiarata:
            modifiche["eta_minima"] = eta
            modifiche["eta_minima_dichiarata"] = True

    # R-23: basta una fonte che citi l'alcol.
    if nuovo.riferimenti_alcol and not esistente.riferimenti_alcol:
        modifiche["riferimenti_alcol"] = True

    artisti = list(esistente.artisti)
    noti = {normalizza_artista(a) for a in artisti}
    for nome in nuovo.artisti:
        chiave = normalizza_artista(nome)
        if chiave and chiave not in noti and len(artisti) < soglie.MASSIMO_ARTISTI:
            artisti.append(nome)
            noti.add(chiave)
    if tuple(artisti) != esistente.artisti:
        modifiche["artisti"] = artisti

    generi = list(esistente.generi)
    for codice in nuovo.generi:
        if codice not in generi and len(generi) < soglie.MASSIMO_GENERI:
            generi.append(codice)
    return Fusione(
        modifiche=modifiche,
        generi=tuple(generi) if tuple(generi) != esistente.generi else None,
    )
