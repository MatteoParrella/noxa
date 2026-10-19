"""Operazioni sul database usate dalla raccolta, dietro un protocollo: la pipeline è
verificabile senza database (`tests/unit/raccolta`) e l'implementazione Postgres è in
`raccolta/postgres.py` (test di integrazione in `tests/integrazione`)."""

from __future__ import annotations

from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Literal, Protocol
from uuid import UUID

from pydantic import JsonValue

from noxa_worker.dedup.fusione import EventoEsistente
from noxa_worker.fonti.base import Fonte
from noxa_worker.normalizzazione.modelli import EventoNormalizzato

StatoGrezzo = Literal["nuovo", "normalizzato", "unito", "in_revisione_dedup", "scartato", "errore"]


@dataclass(frozen=True)
class FonteDaEseguire:
    fonte: Fonte
    stato_conformita: str
    attiva: bool


@dataclass
class EsitoEsecuzione:
    """Conteggi di un'esecuzione (EVENT_INGESTION.md §8), salvati in `esecuzioni_fonte` e in
    `fonti.ultimo_esito`."""

    iniziata_il: datetime
    prova: bool
    durata_ms: int = 0
    pagine_lette: int = 0
    eventi_letti: int = 0
    eventi_nuovi: int = 0
    eventi_uniti: int = 0
    eventi_in_revisione: int = 0
    eventi_scartati: int = 0
    eventi_invariati: int = 0
    codice_errore: str | None = None
    messaggio_errore: str | None = None
    confermati: set[UUID] = field(default_factory=set)

    def come_json(self) -> dict[str, JsonValue]:
        return {
            "prova": self.prova,
            "pagine_lette": self.pagine_lette,
            "eventi_letti": self.eventi_letti,
            "eventi_nuovi": self.eventi_nuovi,
            "eventi_uniti": self.eventi_uniti,
            "eventi_in_revisione": self.eventi_in_revisione,
            "eventi_scartati": self.eventi_scartati,
            "eventi_invariati": self.eventi_invariati,
            "codice_errore": self.codice_errore,
        }


@dataclass(frozen=True)
class GrezzoDeciso:
    """Grezzo con la decisione del moderatore da applicare (job deduplica_grezzo)."""

    id: UUID
    payload: dict[str, JsonValue]
    decisione: Literal["stesso_evento", "distinti"]
    evento_candidato_id: UUID | None


class TransazioneRaccolta(Protocol):
    async def grezzo_esistente(
        self, fonte_id: UUID, hash_contenuto: str
    ) -> tuple[bool, UUID | None]:
        """Se il grezzo con questa impronta esiste già e l'evento a cui ha portato."""
        ...

    async def inserisci_grezzo(
        self,
        *,
        fonte_id: UUID,
        payload: dict[str, JsonValue],
        hash_contenuto: str,
        stato: StatoGrezzo,
        evento_id: UUID | None = None,
        errore: str | None = None,
    ) -> UUID: ...

    async def aggiorna_grezzo(
        self,
        grezzo_id: UUID,
        *,
        stato: StatoGrezzo,
        evento_id: UUID | None = None,
        errore: str | None = None,
    ) -> None: ...

    async def segna_revisione(
        self,
        grezzo_id: UUID,
        evento_candidato_id: UUID | None,
        punteggio: float | None,
        nota: str | None,
    ) -> None:
        """Il grezzo entra nella coda dei duplicati con il candidato, il punteggio e il motivo."""
        ...

    async def evento_per_riferimento(
        self, fonte_id: UUID, id_esterno: str | None
    ) -> EventoEsistente | None:
        """Evento già collegato a questa fonte con lo stesso identificativo esterno."""
        ...

    async def carica_evento(self, evento_id: UUID) -> EventoEsistente | None: ...

    async def eventi_del_blocco(self, locale_id: UUID, data_serata: date) -> list[EventoEsistente]:
        """Eventi dello stesso locale e della stessa serata, esclusi rifiutati e annullati."""
        ...

    async def crea_evento(self, evento: EventoNormalizzato, stato: str) -> UUID: ...

    async def aggiorna_evento(
        self, evento_id: UUID, modifiche: dict[str, object], generi: tuple[str, ...] | None
    ) -> None: ...

    async def collega_fonte(self, evento_id: UUID, evento: EventoNormalizzato) -> None:
        """Aggiunge o aggiorna la riga di `eventi_fonti` per la fonte del grezzo."""
        ...


class ArchivioRaccolta(Protocol):
    async def carica_fonte(self, fonte_id: UUID) -> FonteDaEseguire | None: ...

    def transazione(self) -> AbstractAsyncContextManager[TransazioneRaccolta]: ...

    async def registra_esito(self, fonte_id: UUID, esito: EsitoEsecuzione) -> bool:
        """Registra l'esecuzione e aggiorna la fonte; restituisce True se la fonte è stata
        disattivata perché ha raggiunto 5 errori di fila."""
        ...

    async def aggiorna_assenze(self, fonte_id: UUID, confermati: set[UUID]) -> None:
        """Conferme e assenze degli eventi futuri della fonte (possibili annullamenti, §7)."""
        ...

    async def carica_grezzo_deciso(self, grezzo_id: UUID) -> GrezzoDeciso | None: ...
