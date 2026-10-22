"""Estrazione degli eventi dai flyer caricati dagli utenti (EVENT_INGESTION.md §5, ADR-0007)."""

from noxa_worker.flyer.archivio import (
    ArchivioFlyer,
    ArchivioFlyerPostgres,
    CaricoFlyer,
    ImmagineElimina,
)
from noxa_worker.flyer.estrattore import (
    ErroreEstrazione,
    calcola_phash,
    crea_client,
    estrai_da_immagine,
    estrai_da_testo,
    oggi_iso,
    prepara_immagine,
    stima_costo_eur,
)
from noxa_worker.flyer.jobs import GestoreFlyer
from noxa_worker.flyer.schema import ConfidenzaCampi, FlyerEstratto, GenereMusicale
from noxa_worker.flyer.storage import ClientStorage

__all__ = [
    "ArchivioFlyer",
    "ArchivioFlyerPostgres",
    "CaricoFlyer",
    "ClientStorage",
    "ConfidenzaCampi",
    "ErroreEstrazione",
    "FlyerEstratto",
    "GenereMusicale",
    "GestoreFlyer",
    "ImmagineElimina",
    "calcola_phash",
    "crea_client",
    "estrai_da_immagine",
    "estrai_da_testo",
    "oggi_iso",
    "prepara_immagine",
    "stima_costo_eur",
]
