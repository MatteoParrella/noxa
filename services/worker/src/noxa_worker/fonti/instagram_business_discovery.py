"""Adattatore `instagram_business_discovery`: post pubblici degli account Business o Creator
dei locali con l'Instagram Graph API ufficiale, endpoint Business Discovery
(EVENT_INGESTION.md §2.5, ADR-0008). Nessuno scraping, nessuna storia, nessuna immagine
salvata: si leggono solo didascalia, link e data del post."""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import ClassVar

from pydantic import JsonValue, SecretStr

from noxa_worker.errori import ErroreFonte
from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from noxa_worker.fonti.comuni import evento_da_campi, testo_o_none
from noxa_worker.fonti.didascalie import leggi_didascalia
from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.normalizzazione.date import interpreta_iso
from noxa_worker.normalizzazione.modelli import EventoNormalizzato, TipoOrigine

URL_GRAPH = "https://graph.facebook.com"
VERSIONE_GRAPH = "v23.0"
POST_PER_RICHIESTA = 20
FINESTRA_POST = timedelta(days=14)


class AdattatoreInstagramBusinessDiscovery:
    nome: ClassVar[str] = "instagram_business_discovery"
    tipo: ClassVar[TipoFonte] = TipoFonte.INSTAGRAM

    def __init__(self, ig_user_id: str, token: SecretStr) -> None:
        self._ig_user_id = ig_user_id
        self._token = token

    async def raccogli(self, fonte: Fonte, http: ClientHttpConforme) -> list[EventoGrezzo]:
        if not self._ig_user_id or not self._token.get_secret_value():
            raise ErroreFonte(
                "Instagram Graph API non configurata (App Review di Meta)",
                codice="META_NON_CONFIGURATA",
            )
        campi = (
            f"business_discovery.username({fonte.url})"
            f"{{media.limit({POST_PER_RICHIESTA}){{id,caption,permalink,timestamp}}}}"
        )
        # Il token va nell'intestazione, non nell'URL: così non finisce in nessun log.
        risposta = await http.get_json_api(
            f"{URL_GRAPH}/{VERSIONE_GRAPH}/{self._ig_user_id}",
            {"fields": campi},
            intestazioni={"Authorization": f"Bearer {self._token.get_secret_value()}"},
        )
        return grezzi_da_risposta(risposta, datetime.now(UTC))

    def normalizza(self, grezzo: EventoGrezzo, fonte: Fonte) -> EventoNormalizzato:
        return evento_da_campi(grezzo, fonte, TipoOrigine.INSTAGRAM)


def grezzi_da_risposta(risposta: JsonValue, adesso: datetime) -> list[EventoGrezzo]:
    """Post degli ultimi 14 giorni con una didascalia che descrive un evento."""
    if not isinstance(risposta, dict):
        raise ErroreFonte("risposta di Business Discovery inattesa", codice="STRUTTURA")
    scoperta = risposta.get("business_discovery")
    media = scoperta.get("media") if isinstance(scoperta, dict) else None
    elenco = media.get("data") if isinstance(media, dict) else None
    if not isinstance(elenco, list):
        raise ErroreFonte("risposta di Business Discovery senza post", codice="STRUTTURA")

    grezzi: list[EventoGrezzo] = []
    for post in elenco:
        if not isinstance(post, dict):
            continue
        didascalia = testo_o_none(post.get("caption"))
        permalink = testo_o_none(post.get("permalink"))
        identificativo = testo_o_none(post.get("id"))
        data_testo = testo_o_none(post.get("timestamp"))
        if not (didascalia and permalink and identificativo and data_testo):
            continue
        try:
            pubblicato_il = interpreta_iso(data_testo)
        except ValueError:
            continue
        if pubblicato_il < adesso - FINESTRA_POST:
            continue
        evento = leggi_didascalia(didascalia, pubblicato_il)
        if evento is None:
            continue
        grezzi.append(
            EventoGrezzo(
                url=permalink,
                id_esterno=identificativo[:200],
                dati={
                    "titolo": evento.titolo,
                    "inizio": evento.inizio.isoformat(),
                    "ha_ora": True,
                    "fine": None,
                    "fine_ha_ora": False,
                    "descrizione": None,
                    "artisti": list(evento.artisti),
                    "etichette": [*re.findall(r"#(\w+)", didascalia)],
                    # La didascalia serve solo a cercare età, alcol e generi: non si salva.
                    "note_ingresso": [didascalia],
                    "prezzo_centesimi": None,
                    "url_biglietti": None,
                },
            )
        )
    return grezzi
