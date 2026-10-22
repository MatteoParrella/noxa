"""Gestori dei job `analizza_flyer`, `copia_immagine_flyer` e `pulizia_flyer`.

EVENT_INGESTION.md §5 (flyer), SAFETY_PRIVACY.md §10 (conservazione immagini).
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from io import BytesIO
from uuid import UUID

import anthropic
import structlog
from PIL import Image
from pydantic import JsonValue

from noxa_worker.coda import ErroreJobDefinitivo, Job
from noxa_worker.flyer.archivio import ArchivioFlyer
from noxa_worker.flyer.estrattore import (
    VERSIONE_PROMPT,
    ErroreEstrazione,
    calcola_phash,
    crea_client,
    estrai_da_immagine,
    oggi_iso,
    prepara_immagine,
)
from noxa_worker.flyer.schema import FlyerEstratto
from noxa_worker.flyer.storage import ClientStorage
from noxa_worker.normalizzazione.date import FUSO_ROMA, combina

log = structlog.get_logger(__name__)

# Lato massimo della miniatura per la copia nel bucket flyer-pubblicati (ADR-0018).
_LATO_MAX_PUBBLICATO = 1568


class GestoreFlyer:
    """Gestisce i tre job del modulo flyer."""

    def __init__(
        self,
        archivio: ArchivioFlyer,
        storage: ClientStorage,
        *,
        anthropic_api_key: str,
        modello: str,
        lato_max: int,
        adesso: Callable[[], datetime],
    ) -> None:
        self._archivio = archivio
        self._storage = storage
        self._client: anthropic.AsyncAnthropic | None = (
            crea_client(anthropic_api_key) if anthropic_api_key else None
        )
        self._modello = modello
        self._lato_max = lato_max
        self._adesso = adesso

    # ─────────────────────────────────────────────────────────────────────────
    # analizza_flyer
    # ─────────────────────────────────────────────────────────────────────────

    async def analizza_flyer(self, job: Job) -> None:
        """Scarica, analizza con Claude e aggiorna `caricamenti_flyer` (EVENT_INGESTION.md §5)."""
        caricamento_id = _uuid(job.payload.get("caricamento_id"))
        contesto = log.bind(job_id=job.id, caricamento_id=str(caricamento_id))

        carico = await self._archivio.carica_caricamento(caricamento_id)
        if carico is None:
            raise ErroreJobDefinitivo("caricamento inesistente")
        if carico.stato != "caricato":
            contesto.info("analisi_saltata", stato=carico.stato)
            return

        # Scarica l'immagine originale dallo storage privato.
        try:
            dati_originali = await self._storage.scarica("flyer-caricati", carico.storage_path)
        except Exception as errore:
            contesto.warning("scaricamento_fallito", errore=str(errore))
            await self._archivio.aggiorna_analisi(
                caricamento_id,
                stato="errore",
                risultato=None,
                phash=None,
                modello=None,
                versione_prompt=None,
                confidenza=None,
                costo_eur=None,
                contenuto_sospetto=False,
                evento_id=None,
                evento_candidato_id=None,
            )
            raise

        # Prepara l'immagine (rimuovi EXIF, ridimensiona, converti in JPEG).
        try:
            dati_jpeg, _ = prepara_immagine(dati_originali, self._lato_max)
        except ErroreEstrazione as errore:
            contesto.warning("preparazione_fallita", errore=str(errore))
            await self._archivio.aggiorna_analisi(
                caricamento_id,
                stato="errore",
                risultato=None,
                phash=None,
                modello=None,
                versione_prompt=None,
                confidenza=None,
                costo_eur=None,
                contenuto_sospetto=False,
                evento_id=None,
                evento_candidato_id=None,
            )
            raise ErroreJobDefinitivo(str(errore)) from errore

        phash = calcola_phash(dati_jpeg)
        duplicato_id = await self._archivio.trova_duplicato_phash(phash, caricamento_id)

        estratto: FlyerEstratto | None = None
        costo_eur: float | None = None
        stato_finale = "in_revisione"
        contenuto_sospetto = False

        if self._client is not None:
            oggi = oggi_iso(self._adesso().astimezone(FUSO_ROMA).date())
            try:
                estratto, costo_eur = await estrai_da_immagine(
                    self._client, self._modello, dati_jpeg, oggi
                )
                contenuto_sospetto = estratto.contenuto_inappropriato
            except ErroreEstrazione as errore:
                contesto.warning("estrazione_fallita", errore=str(errore))
                if not errore.recuperabile:
                    await self._archivio.aggiorna_analisi(
                        caricamento_id,
                        stato="errore",
                        risultato=None,
                        phash=phash,
                        modello=self._modello,
                        versione_prompt=VERSIONE_PROMPT,
                        confidenza=None,
                        costo_eur=costo_eur,
                        contenuto_sospetto=False,
                        evento_id=None,
                        evento_candidato_id=duplicato_id,
                    )
                    raise ErroreJobDefinitivo(str(errore)) from errore
                raise
            except (anthropic.RateLimitError, anthropic.APIConnectionError):
                raise
        else:
            contesto.info("analisi_senza_chiave_api")

        evento_id: UUID | None = None
        confidenza: float | None = None
        risultato: dict[str, JsonValue] | None = None

        if estratto is not None:
            confidenza = estratto.confidenza_complessiva()
            risultato = estratto.model_dump(mode="json")

            # Tenta di creare un evento in_revisione se il locale è noto.
            if estratto.e_un_evento and estratto.data is not None and estratto.titolo:
                locale_id = await self._archivio.risolvi_locale(
                    estratto.nome_locale, estratto.comune
                )
                if locale_id is not None:
                    inizio = combina(estratto.data, estratto.ora_inizio)
                    fine: datetime | None = None
                    if estratto.ora_fine is not None:
                        fine = combina(estratto.data, estratto.ora_fine)

                    eta = estratto.eta_minima if estratto.eta_minima is not None else 18
                    dichiarata = estratto.eta_minima is not None

                    try:
                        evento_id = await self._archivio.crea_evento_revisione(
                            locale_id,
                            caricamento_id,
                            titolo=estratto.titolo,
                            inizio=inizio,
                            fine=fine,
                            eta_minima=eta,
                            eta_minima_dichiarata=dichiarata,
                            riferimenti_alcol=estratto.riferimenti_alcol,
                            artisti=list(estratto.artisti),
                            prezzo_min_centesimi=estratto.prezzo_min_centesimi,
                        )
                        contesto.info("evento_creato", evento_id=str(evento_id))
                    except Exception as errore:  # noqa: BLE001
                        contesto.warning("creazione_evento_fallita", errore=str(errore))

        await self._archivio.aggiorna_analisi(
            caricamento_id,
            stato=stato_finale,
            risultato=risultato,
            phash=phash,
            modello=self._modello if estratto is not None else None,
            versione_prompt=VERSIONE_PROMPT if estratto is not None else None,
            confidenza=confidenza,
            costo_eur=costo_eur,
            contenuto_sospetto=contenuto_sospetto,
            evento_id=evento_id,
            evento_candidato_id=duplicato_id,
        )
        contesto.info(
            "flyer_analizzato",
            e_un_evento=estratto.e_un_evento if estratto else None,
            contenuto_sospetto=contenuto_sospetto,
            locale_risolto=evento_id is not None,
            duplicato=duplicato_id is not None,
        )

    # ─────────────────────────────────────────────────────────────────────────
    # copia_immagine_flyer
    # ─────────────────────────────────────────────────────────────────────────

    async def copia_immagine_flyer(self, job: Job) -> None:
        """Copia il flyer approvato in `flyer-pubblicati` come copertina dell'evento (ADR-0018)."""
        caricamento_id = _uuid(job.payload.get("caricamento_id"))
        evento_id = _uuid(job.payload.get("evento_id"))
        contesto = log.bind(
            job_id=job.id,
            caricamento_id=str(caricamento_id),
            evento_id=str(evento_id),
        )

        carico = await self._archivio.carica_caricamento(caricamento_id)
        if carico is None:
            raise ErroreJobDefinitivo("caricamento inesistente")

        dati = await self._storage.scarica("flyer-caricati", carico.storage_path)

        # Converti in WebP con lato max per la pubblicazione.
        img_orig: Image.Image = Image.open(BytesIO(dati))
        img_pub: Image.Image = (
            img_orig if img_orig.mode in ("RGB", "RGBA") else img_orig.convert("RGB")
        )
        w, h = img_pub.size
        if max(w, h) > _LATO_MAX_PUBBLICATO:
            scala = _LATO_MAX_PUBBLICATO / max(w, h)
            img_pub = img_pub.resize(
                (int(w * scala), int(h * scala)), Image.Resampling.LANCZOS
            )
        output = BytesIO()
        img_pub.convert("RGB").save(output, format="WEBP", quality=88, exif=b"")
        dati_webp = output.getvalue()

        immagine_path = f"{evento_id}.webp"
        await self._storage.carica("flyer-pubblicati", immagine_path, dati_webp, "image/webp")
        await self._archivio.pubblica_immagine_flyer(evento_id, immagine_path)
        contesto.info("immagine_copiata", path=immagine_path)

    # ─────────────────────────────────────────────────────────────────────────
    # pulizia_flyer
    # ─────────────────────────────────────────────────────────────────────────

    async def pulizia_flyer(self, _job: Job) -> None:
        """Elimina le immagini scadute dai bucket (SAFETY_PRIVACY.md §10)."""
        da_eliminare = await self._archivio.immagini_da_eliminare()
        if not da_eliminare:
            log.info("pulizia_flyer_nessuna_immagine")
            return

        per_bucket: dict[str, list[str]] = {}
        for img in da_eliminare:
            per_bucket.setdefault(img.bucket, []).append(img.percorso)

        flyer_caricati_eliminati: list[str] = []
        for bucket, percorsi in per_bucket.items():
            try:
                await self._storage.elimina(bucket, percorsi)
                if bucket == "flyer-caricati":
                    flyer_caricati_eliminati.extend(percorsi)
                log.info("immagini_eliminate", bucket=bucket, count=len(percorsi))
            except Exception as errore:  # noqa: BLE001
                log.warning("eliminazione_parziale", bucket=bucket, errore=str(errore))

        await self._archivio.segna_immagini_eliminate(flyer_caricati_eliminati)
        log.info("pulizia_flyer_completata", totale=len(da_eliminare))


def _uuid(valore: object) -> UUID:
    try:
        return UUID(str(valore))
    except ValueError as errore:
        raise ErroreJobDefinitivo("identificativo non valido nel payload") from errore
