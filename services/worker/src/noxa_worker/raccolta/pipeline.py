"""Gestori dei job `esegui_fonte` e `deduplica_grezzo` (EVENT_INGESTION.md §3, §6, §7).

Per ogni evento raccolto: normalizzazione e validazione, impronta (una pagina riletta senza
modifiche non produce lavoro), collegamento con l'evento già noto della stessa fonte,
deduplicazione nel blocco locale + serata, fusione o creazione. Un evento nuovo da una fonte
consentita è pubblicato; i casi incerti vanno nella coda dei duplicati.

"Esegui ora" su una fonte non attiva è una prova: legge e conta, ma non scrive eventi.
"""

from __future__ import annotations

import hashlib
import json
import time
from collections.abc import Callable, Mapping
from datetime import date, datetime, timedelta
from uuid import UUID

import structlog
from pydantic import JsonValue, ValidationError

from noxa_worker.coda import ErroreJobDefinitivo, Job
from noxa_worker.dedup.fusione import EventoEsistente, fondi
from noxa_worker.dedup.punteggio import EsitoDedup, EventoConfronto, decidi
from noxa_worker.errori import ErroreRaccolta, ErroreValidazione
from noxa_worker.fonti.base import Adattatore, EventoGrezzo, Fonte
from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.normalizzazione.date import FUSO_ROMA
from noxa_worker.normalizzazione.evento import calcola_hash, valida_regole
from noxa_worker.normalizzazione.modelli import EventoNormalizzato
from noxa_worker.raccolta.archivio import (
    ArchivioRaccolta,
    EsitoEsecuzione,
    TransazioneRaccolta,
)

log = structlog.get_logger(__name__)

# Errori di validazione che non sono un problema della fonte: eventi passati o troppo lontani.
_SCARTI_ATTESI = frozenset({"EVENTO_PASSATO", "INIZIO_TROPPO_LONTANO"})
STATO_PUBBLICATO = "pubblicato"


def data_serata(inizio: datetime) -> date:
    """Serata a cui appartiene un inizio: data a Milano meno 6 ore (DATA_MODEL.md §5.3)."""
    return (inizio.astimezone(FUSO_ROMA) - timedelta(hours=6)).date()


def _confronto(evento: EventoEsistente | EventoNormalizzato) -> EventoConfronto:
    identificativo = evento.id if isinstance(evento, EventoEsistente) else None
    return EventoConfronto(
        titolo=evento.titolo,
        inizio=evento.inizio,
        artisti=tuple(evento.artisti),
        id=identificativo,
    )


def _impronta_grezzo(grezzo: EventoGrezzo) -> str:
    testo = json.dumps(
        {"url": grezzo.url, "id": grezzo.id_esterno, "dati": grezzo.dati},
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(testo.encode("utf-8")).hexdigest()


class GestoreRaccolta:
    """Esegue le fonti e applica le decisioni dei moderatori sui duplicati."""

    def __init__(
        self,
        archivio: ArchivioRaccolta,
        adattatori: Mapping[str, Adattatore],
        crea_http: Callable[[int], ClientHttpConforme],
        *,
        adesso: Callable[[], datetime],
    ) -> None:
        self._archivio = archivio
        self._adattatori = dict(adattatori)
        self._crea_http = crea_http
        self._adesso = adesso

    # -----------------------------------------------------------------------------------------
    # esegui_fonte
    # -----------------------------------------------------------------------------------------

    async def esegui_fonte(self, job: Job) -> None:
        fonte_id = _uuid(job.payload.get("fonte_id"))
        prova = job.payload.get("prova") is True
        contesto = log.bind(job_id=job.id, fonte_id=str(fonte_id), prova=prova)
        voce = await self._archivio.carica_fonte(fonte_id)
        if voce is None:
            raise ErroreJobDefinitivo("fonte inesistente")
        # ADR-0008: si legge solo una fonte consentita; senza prova, solo se attiva.
        if voce.stato_conformita != "consentita" or not (voce.attiva or prova):
            contesto.info("fonte_saltata", conformita=voce.stato_conformita, attiva=voce.attiva)
            return

        fonte = voce.fonte
        esito = EsitoEsecuzione(iniziata_il=self._adesso(), prova=prova)
        inizio = time.monotonic()
        adattatore = self._adattatori.get(fonte.adattatore)
        http = self._crea_http(fonte.pagine_massime)
        if adattatore is None:
            esito.codice_errore = "ADATTATORE_SCONOSCIUTO"
            esito.messaggio_errore = f"adattatore {fonte.adattatore!r} non registrato"
        else:
            try:
                grezzi = await adattatore.raccogli(fonte, http)
            except ErroreRaccolta as errore:
                esito.codice_errore = errore.codice
                esito.messaggio_errore = str(errore)[:500]
            else:
                esito.eventi_letti = len(grezzi)
                for grezzo in grezzi:
                    await self._elabora(grezzo, fonte, adattatore, esito, scrivi=not prova)
        esito.pagine_lette = http.pagine_lette
        esito.durata_ms = round((time.monotonic() - inizio) * 1000)

        if not prova and esito.codice_errore is None and esito.eventi_letti > 0:
            await self._archivio.aggiorna_assenze(fonte.id, esito.confermati)
        disattivata = await self._archivio.registra_esito(fonte.id, esito)

        dati_log = esito.come_json() | {"durata_ms": esito.durata_ms}
        if esito.codice_errore:
            contesto.warning("fonte_errore", **dati_log)
        else:
            contesto.info("fonte_eseguita", **dati_log)
        if disattivata:
            contesto.error("fonte_disattivata", motivo="5 errori consecutivi")
        if esito.codice_errore is None and esito.eventi_letti == 0 and not prova:
            contesto.warning("fonte_senza_eventi")

    async def _elabora(
        self,
        grezzo: EventoGrezzo,
        fonte: Fonte,
        adattatore: Adattatore,
        esito: EsitoEsecuzione,
        *,
        scrivi: bool,
    ) -> None:
        async with self._archivio.transazione() as tx:
            try:
                evento = adattatore.normalizza(grezzo, fonte)
                valida_regole(evento, self._adesso())
            except ErroreValidazione as errore:
                esito.eventi_scartati += 1
                if scrivi:
                    await self._registra_scarto(tx, fonte, grezzo, errore)
                return

            impronta = calcola_hash(evento)
            esiste, evento_id = await tx.grezzo_esistente(fonte.id, impronta)
            if esiste:
                esito.eventi_invariati += 1
                if evento_id is not None:
                    esito.confermati.add(evento_id)
                return

            grezzo_id = None
            if scrivi:
                grezzo_id = await tx.inserisci_grezzo(
                    fonte_id=fonte.id,
                    payload=_payload(evento),
                    hash_contenuto=impronta,
                    stato="nuovo",
                )

            # Lo stesso evento già raccolto da questa fonte (stesso identificativo esterno):
            # un aggiornamento, non un possibile duplicato.
            gia_noto = await tx.evento_per_riferimento(fonte.id, evento.origine.id_esterno)
            if gia_noto is not None and gia_noto.stato != "rifiutato":
                await self._unisci(tx, grezzo_id, gia_noto, evento, esito, scrivi=scrivi)
                return

            candidati = await tx.eventi_del_blocco(fonte.locale_id, data_serata(evento.inizio))
            decisione = decidi(
                _confronto(evento), [_confronto(c) for c in candidati], fonte.locale_nome
            )
            if decisione.esito is EsitoDedup.STESSO_EVENTO:
                scelto = next(c for c in candidati if c.id == decisione.evento_id)
                await self._unisci(tx, grezzo_id, scelto, evento, esito, scrivi=scrivi)
            elif decisione.esito is EsitoDedup.REVISIONE:
                esito.eventi_in_revisione += 1
                if grezzo_id is not None:
                    await tx.segna_revisione(
                        grezzo_id, decisione.evento_id, decisione.punteggio, decisione.motivo
                    )
            else:
                esito.eventi_nuovi += 1
                if grezzo_id is not None:
                    nuovo_id = await tx.crea_evento(evento, STATO_PUBBLICATO)
                    await tx.collega_fonte(nuovo_id, evento)
                    await tx.aggiorna_grezzo(grezzo_id, stato="normalizzato", evento_id=nuovo_id)
                    esito.confermati.add(nuovo_id)

    async def _unisci(
        self,
        tx: TransazioneRaccolta,
        grezzo_id: UUID | None,
        esistente: EventoEsistente,
        evento: EventoNormalizzato,
        esito: EsitoEsecuzione,
        *,
        scrivi: bool,
    ) -> None:
        fusione = fondi(esistente, evento)
        if fusione.modifica_rilevante is not None:
            esito.eventi_in_revisione += 1
            if scrivi and grezzo_id is not None:
                await tx.segna_revisione(grezzo_id, esistente.id, None, fusione.modifica_rilevante)
            esito.confermati.add(esistente.id)
            return
        esito.eventi_uniti += 1
        esito.confermati.add(esistente.id)
        if scrivi and grezzo_id is not None:
            await tx.aggiorna_evento(esistente.id, fusione.modifiche, fusione.generi)
            await tx.collega_fonte(esistente.id, evento)
            await tx.aggiorna_grezzo(grezzo_id, stato="unito", evento_id=esistente.id)

    async def _registra_scarto(
        self,
        tx: TransazioneRaccolta,
        fonte: Fonte,
        grezzo: EventoGrezzo,
        errore: ErroreValidazione,
    ) -> None:
        impronta = _impronta_grezzo(grezzo)
        esiste, _ = await tx.grezzo_esistente(fonte.id, impronta)
        if esiste:
            return
        titolo = grezzo.dati.get("titolo")
        # Solo i dati necessari a capire lo scarto: nessun testo libero della fonte.
        await tx.inserisci_grezzo(
            fonte_id=fonte.id,
            payload={
                "url": grezzo.url,
                "id_esterno": grezzo.id_esterno,
                "titolo": titolo if isinstance(titolo, str) else None,
                "inizio": grezzo.dati.get("inizio"),
            },
            hash_contenuto=impronta,
            stato="scartato" if errore.codice in _SCARTI_ATTESI else "errore",
            errore=f"{errore.codice}: {errore}"[:500],
        )

    # -----------------------------------------------------------------------------------------
    # deduplica_grezzo: decisione del moderatore (RPC decidi_duplicato)
    # -----------------------------------------------------------------------------------------

    async def applica_decisione(self, job: Job) -> None:
        grezzo_id = _uuid(job.payload.get("grezzo_id"))
        contesto = log.bind(job_id=job.id, grezzo_id=str(grezzo_id))
        deciso = await self._archivio.carica_grezzo_deciso(grezzo_id)
        if deciso is None:
            contesto.info("decisione_gia_applicata")
            return
        try:
            evento = EventoNormalizzato.model_validate(deciso.payload)
        except ValidationError as errore:
            raise ErroreJobDefinitivo("payload del grezzo non valido") from errore

        async with self._archivio.transazione() as tx:
            if deciso.decisione == "stesso_evento" and deciso.evento_candidato_id is not None:
                esistente = await tx.carica_evento(deciso.evento_candidato_id)
                if esistente is None or esistente.stato in ("rifiutato", "annullato"):
                    await tx.aggiorna_grezzo(
                        grezzo_id, stato="errore", errore="evento candidato non più disponibile"
                    )
                    contesto.warning("candidato_non_disponibile")
                    return
                fusione = fondi(esistente, evento, consenti_rilevanti=True)
                await tx.aggiorna_evento(esistente.id, fusione.modifiche, fusione.generi)
                await tx.collega_fonte(esistente.id, evento)
                await tx.aggiorna_grezzo(grezzo_id, stato="unito", evento_id=esistente.id)
                contesto.info("duplicato_unito", evento_id=str(esistente.id))
                return
            nuovo_id = await tx.crea_evento(evento, STATO_PUBBLICATO)
            await tx.collega_fonte(nuovo_id, evento)
            await tx.aggiorna_grezzo(grezzo_id, stato="normalizzato", evento_id=nuovo_id)
            contesto.info("duplicato_separato", evento_id=str(nuovo_id))


def _payload(evento: EventoNormalizzato) -> dict[str, JsonValue]:
    payload: dict[str, JsonValue] = evento.model_dump(mode="json")
    return payload


def _uuid(valore: JsonValue | None) -> UUID:
    try:
        return UUID(str(valore))
    except ValueError as errore:
        raise ErroreJobDefinitivo("identificativo non valido nel payload") from errore
