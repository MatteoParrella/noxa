"""Registro degli adattatori, con il nome usato in `fonti.adattatore` (EVENT_INGESTION.md §4).

Un nuovo adattatore si aggiunge qui (skill `add-event-source`).
"""

from __future__ import annotations

from noxa_worker.configurazione import Impostazioni
from noxa_worker.fonti.base import Adattatore
from noxa_worker.fonti.instagram_business_discovery import AdattatoreInstagramBusinessDiscovery
from noxa_worker.fonti.sito_jsonld import AdattatoreSitoJsonLd


def crea_registro(impostazioni: Impostazioni) -> dict[str, Adattatore]:
    adattatori: list[Adattatore] = [
        AdattatoreSitoJsonLd(),
        AdattatoreInstagramBusinessDiscovery(
            impostazioni.meta_ig_user_id, impostazioni.meta_access_token
        ),
    ]
    return {adattatore.nome: adattatore for adattatore in adattatori}
