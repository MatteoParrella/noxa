"""Colori delle copertine dopo l'esecuzione di una fonte (ADR-0030).

Per ogni serata futura del locale (titolo normalizzato) senza colori recenti: se un'altra data
della stessa serata li ha già, si copiano; altrimenti si legge in memoria l'immagine indicata
dalla fonte, si estrae la tavolozza e la si salva su tutte le date della serata. Al massimo
`IMMAGINI_PER_ESECUZIONE` immagini per volta; un errore salta la serata e non tocca la fonte.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol
from uuid import UUID

import structlog
from pydantic import JsonValue

from noxa_worker.copertine.colori import ImmagineNonValida, tavolozza
from noxa_worker.copertine.seme import normalizza_titolo
from noxa_worker.errori import ErroreRaccolta
from noxa_worker.fonti.base import EventoGrezzo, Fonte
from noxa_worker.fonti.http import ClientHttpConforme

log = structlog.get_logger(__name__)

IMMAGINI_PER_ESECUZIONE = 10
VALIDITA = timedelta(days=30)


@dataclass(frozen=True)
class EventoColori:
    id: UUID
    titolo: str
    colori: dict[str, JsonValue] | None


class ArchivioColori(Protocol):
    async def eventi_futuri(self, locale_id: UUID) -> list[EventoColori]:
        """Eventi del locale non ancora finiti, con i colori attuali."""
        ...

    async def imposta_colori(
        self, eventi: Sequence[UUID], colori: dict[str, JsonValue]
    ) -> None: ...


def _recenti(colori: dict[str, JsonValue] | None, adesso: datetime) -> bool:
    data = colori.get("calcolata_il") if colori else None
    if not isinstance(data, str):
        return False
    try:
        calcolata = datetime.fromisoformat(data.replace("Z", "+00:00"))
    except ValueError:
        return False
    return adesso - calcolata < VALIDITA


class ColoriCopertine:
    def __init__(
        self,
        archivio: ArchivioColori,
        crea_http: Callable[[int], ClientHttpConforme],
        *,
        adesso: Callable[[], datetime],
    ) -> None:
        self._archivio = archivio
        self._crea_http = crea_http
        self._adesso = adesso

    async def aggiorna(self, fonte: Fonte, grezzi: Sequence[EventoGrezzo]) -> int:
        """Restituisce il numero di serate a cui sono stati dati i colori."""
        immagini: dict[str, str] = {}
        for grezzo in grezzi:
            titolo, link = grezzo.dati.get("titolo"), grezzo.dati.get("immagine_url")
            if isinstance(titolo, str) and isinstance(link, str):
                immagini.setdefault(normalizza_titolo(titolo), link)

        adesso = self._adesso()
        serate: dict[str, list[EventoColori]] = {}
        for evento in await self._archivio.eventi_futuri(fonte.locale_id):
            serate.setdefault(normalizza_titolo(evento.titolo), []).append(evento)

        http = self._crea_http(IMMAGINI_PER_ESECUZIONE)
        colorate = 0
        for seme, eventi in serate.items():
            senza = [e.id for e in eventi if not _recenti(e.colori, adesso)]
            if not senza:
                continue
            gia = next((e.colori for e in eventi if _recenti(e.colori, adesso)), None)
            if gia is None:
                link = immagini.get(seme)
                if link is None or http.pagine_rimanenti <= 0:
                    continue
                gia = await self._da_immagine(http, link, fonte)
                if gia is None:
                    continue
            await self._archivio.imposta_colori(senza, gia)
            colorate += 1
        return colorate

    async def _da_immagine(
        self, http: ClientHttpConforme, link: str, fonte: Fonte
    ) -> dict[str, JsonValue] | None:
        try:
            dati = await http.get_immagine(link)
            return tavolozza(dati, self._adesso())
        except (ErroreRaccolta, ImmagineNonValida) as errore:
            log.info("colori_saltati", fonte_id=str(fonte.id), motivo=str(errore)[:120])
            return None
