"""Pipeline della raccolta con un archivio in memoria (EVENT_INGESTION.md §3, §6, §7)."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field, replace
from datetime import date, datetime, timedelta
from typing import ClassVar
from uuid import UUID, uuid4

import pytest
from pydantic import JsonValue

from noxa_worker.coda import ErroreJobDefinitivo, Job, TipoJob
from noxa_worker.dedup.fusione import EventoEsistente
from noxa_worker.errori import ErroreFonte
from noxa_worker.fonti.base import EventoGrezzo, Fonte, TipoFonte
from noxa_worker.fonti.comuni import evento_da_campi
from noxa_worker.fonti.http import ClientHttpConforme
from noxa_worker.normalizzazione.date import FUSO_ROMA
from noxa_worker.normalizzazione.modelli import PRIORITA_ORIGINE, EventoNormalizzato
from noxa_worker.raccolta.archivio import (
    EsitoEsecuzione,
    FonteDaEseguire,
    GrezzoDeciso,
    StatoGrezzo,
)
from noxa_worker.raccolta.pipeline import GestoreRaccolta, data_serata
from tests.supporto import SitoFinto, client_conforme

ADESSO = datetime(2026, 10, 15, 12, 0, tzinfo=FUSO_ROMA)
SABATO = datetime(2026, 10, 17, 23, 0, tzinfo=FUSO_ROMA)
FONTE = Fonte(
    id=UUID("00000000-0000-4000-8000-00000000f001"),
    locale_id=UUID("00000000-0000-4000-8000-00000000c001"),
    locale_nome="Club Binario 7",
    tipo=TipoFonte.SITO_LOCALE,
    url="https://binario7.example/agenda",
    adattatore="finto",
    pagine_massime=5,
)


@dataclass
class Grezzo:
    id: UUID
    fonte_id: UUID
    payload: dict[str, JsonValue]
    hash_contenuto: str
    stato: StatoGrezzo
    evento_id: UUID | None = None
    evento_candidato_id: UUID | None = None
    punteggio: float | None = None
    nota: str | None = None
    errore: str | None = None
    decisione: str | None = None


@dataclass
class Collegamento:
    evento_id: UUID
    fonte_id: UUID | None
    id_esterno: str | None
    url: str | None
    priorita: int


@dataclass
class ArchivioMemoria:
    """Implementa ArchivioRaccolta e TransazioneRaccolta in memoria."""

    fonti: dict[UUID, FonteDaEseguire] = field(default_factory=dict)
    eventi: dict[UUID, EventoEsistente] = field(default_factory=dict)
    stati: dict[UUID, str] = field(default_factory=dict)
    grezzi: dict[UUID, Grezzo] = field(default_factory=dict)
    collegamenti: list[Collegamento] = field(default_factory=list)
    esiti: list[EsitoEsecuzione] = field(default_factory=list)
    assenze: dict[UUID, int] = field(default_factory=dict)
    errori_consecutivi: int = 0

    # ArchivioRaccolta

    async def carica_fonte(self, fonte_id: UUID) -> FonteDaEseguire | None:
        return self.fonti.get(fonte_id)

    @asynccontextmanager
    async def transazione(self) -> AsyncIterator[ArchivioMemoria]:
        yield self

    async def registra_esito(self, fonte_id: UUID, esito: EsitoEsecuzione) -> bool:
        self.esiti.append(esito)
        if esito.prova:
            return False
        self.errori_consecutivi = self.errori_consecutivi + 1 if esito.codice_errore else 0
        return self.errori_consecutivi == 5

    async def aggiorna_assenze(self, fonte_id: UUID, confermati: set[UUID]) -> None:
        for collegamento in self.collegamenti:
            if collegamento.fonte_id == fonte_id:
                evento = collegamento.evento_id
                self.assenze[evento] = (
                    0 if evento in confermati else self.assenze.get(evento, 0) + 1
                )

    async def carica_grezzo_deciso(self, grezzo_id: UUID) -> GrezzoDeciso | None:
        grezzo = self.grezzi.get(grezzo_id)
        if grezzo is None or grezzo.stato != "in_revisione_dedup" or grezzo.decisione is None:
            return None
        return GrezzoDeciso(
            id=grezzo.id,
            payload=grezzo.payload,
            decisione=grezzo.decisione,  # type: ignore[arg-type]
            evento_candidato_id=grezzo.evento_candidato_id,
        )

    # TransazioneRaccolta

    async def grezzo_esistente(
        self, fonte_id: UUID, hash_contenuto: str
    ) -> tuple[bool, UUID | None]:
        for grezzo in self.grezzi.values():
            if grezzo.fonte_id == fonte_id and grezzo.hash_contenuto == hash_contenuto:
                return True, grezzo.evento_id
        return False, None

    async def inserisci_grezzo(
        self,
        *,
        fonte_id: UUID,
        payload: dict[str, JsonValue],
        hash_contenuto: str,
        stato: StatoGrezzo,
        evento_id: UUID | None = None,
        errore: str | None = None,
    ) -> UUID:
        identificativo = uuid4()
        self.grezzi[identificativo] = Grezzo(
            identificativo, fonte_id, payload, hash_contenuto, stato, evento_id, errore=errore
        )
        return identificativo

    async def aggiorna_grezzo(
        self,
        grezzo_id: UUID,
        *,
        stato: StatoGrezzo,
        evento_id: UUID | None = None,
        errore: str | None = None,
    ) -> None:
        grezzo = self.grezzi[grezzo_id]
        grezzo.stato = stato
        grezzo.evento_id = evento_id or grezzo.evento_id
        grezzo.errore = errore

    async def segna_revisione(
        self,
        grezzo_id: UUID,
        evento_candidato_id: UUID | None,
        punteggio: float | None,
        nota: str | None,
    ) -> None:
        grezzo = self.grezzi[grezzo_id]
        grezzo.stato = "in_revisione_dedup"
        grezzo.evento_candidato_id = evento_candidato_id
        grezzo.punteggio = punteggio
        grezzo.nota = nota

    async def evento_per_riferimento(
        self, fonte_id: UUID, id_esterno: str | None
    ) -> EventoEsistente | None:
        for collegamento in self.collegamenti:
            if id_esterno and (collegamento.fonte_id, collegamento.id_esterno) == (
                fonte_id,
                id_esterno,
            ):
                return self.eventi[collegamento.evento_id]
        return None

    async def carica_evento(self, evento_id: UUID) -> EventoEsistente | None:
        return self.eventi.get(evento_id)

    async def eventi_del_blocco(self, locale_id: UUID, serata: date) -> list[EventoEsistente]:
        return [
            e
            for e in self.eventi.values()
            if e.locale_id == locale_id
            and data_serata(e.inizio) == serata
            and e.stato in ("pubblicato", "in_revisione")
        ]

    async def crea_evento(self, evento: EventoNormalizzato, stato: str) -> UUID:
        identificativo = uuid4()
        assert evento.locale.id is not None
        self.eventi[identificativo] = EventoEsistente(
            id=identificativo,
            locale_id=evento.locale.id,
            titolo=evento.titolo,
            descrizione=evento.descrizione,
            inizio=evento.inizio,
            fine=evento.fine,
            eta_minima=evento.eta_minima if evento.eta_minima is not None else 18,
            eta_minima_dichiarata=evento.eta_minima is not None,
            riferimenti_alcol=evento.riferimenti_alcol,
            generi=evento.generi,
            artisti=evento.artisti,
            prezzo_min_centesimi=evento.prezzo_min_centesimi,
            url_biglietti=evento.url_biglietti,
            stato=stato,
            priorita_migliore=0,
        )
        return identificativo

    async def aggiorna_evento(
        self, evento_id: UUID, modifiche: dict[str, object], generi: tuple[str, ...] | None
    ) -> None:
        aggiornamento = {k: tuple(v) if isinstance(v, list) else v for k, v in modifiche.items()}
        if generi is not None:
            aggiornamento["generi"] = generi
        self.eventi[evento_id] = replace(self.eventi[evento_id], **aggiornamento)  # type: ignore[arg-type]

    async def collega_fonte(self, evento_id: UUID, evento: EventoNormalizzato) -> None:
        priorita = PRIORITA_ORIGINE[evento.origine.tipo]
        self.collegamenti.append(
            Collegamento(
                evento_id,
                evento.origine.fonte_id,
                evento.origine.id_esterno,
                evento.origine.url,
                priorita,
            )
        )
        corrente = self.eventi[evento_id]
        self.eventi[evento_id] = replace(
            corrente, priorita_migliore=max(corrente.priorita_migliore, priorita)
        )


@dataclass
class AdattatoreFinto:
    nome: ClassVar[str] = "finto"
    tipo: ClassVar[TipoFonte] = TipoFonte.SITO_LOCALE
    grezzi: list[EventoGrezzo] = field(default_factory=list)
    errore: Exception | None = None

    async def raccogli(self, fonte: Fonte, http: ClientHttpConforme) -> list[EventoGrezzo]:
        if self.errore:
            raise self.errore
        await http.get_testo(fonte.url)
        return self.grezzi

    def normalizza(self, grezzo: EventoGrezzo, fonte: Fonte) -> EventoNormalizzato:
        return evento_da_campi(grezzo, fonte)


def grezzo(
    titolo: str,
    inizio: datetime = SABATO,
    *,
    id_esterno: str | None = None,
    descrizione: str | None = None,
    artisti: list[JsonValue] | None = None,
) -> EventoGrezzo:
    return EventoGrezzo(
        url=f"https://binario7.example/eventi/{(id_esterno or titolo).replace(' ', '-').lower()}",
        id_esterno=id_esterno or titolo,
        dati={
            "titolo": titolo,
            "inizio": inizio.isoformat(),
            "ha_ora": True,
            "descrizione": descrizione,
            "artisti": artisti or [],
        },
        raccolto_il=ADESSO,
    )


def _ambiente(
    adattatore: AdattatoreFinto, *, attiva: bool = True, conformita: str = "consentita"
) -> tuple[GestoreRaccolta, ArchivioMemoria, SitoFinto]:
    archivio = ArchivioMemoria()
    archivio.fonti[FONTE.id] = FonteDaEseguire(FONTE, conformita, attiva)
    sito = SitoFinto()
    sito.aggiungi(FONTE.url, "<html></html>")
    gestore = GestoreRaccolta(
        archivio,
        {"finto": adattatore},
        lambda pagine: client_conforme(sito, pagine_massime=pagine),
        adesso=lambda: ADESSO,
    )
    return gestore, archivio, sito


def _job(prova: bool = False, **payload: JsonValue) -> Job:
    return Job(
        id=1,
        tipo=TipoJob.ESEGUI_FONTE,
        payload={"fonte_id": str(FONTE.id), "prova": prova, **payload},
        tentativi=0,
        chiave_idempotenza=f"esegui_fonte:{FONTE.id}",
    )


async def test_eventi_nuovi_pubblicati_da_una_fonte_consentita() -> None:
    adattatore = AdattatoreFinto(
        [grezzo("Notte Ferrovia"), grezzo("Indie al Binario", SABATO + timedelta(days=6))]
    )
    gestore, archivio, _ = _ambiente(adattatore)
    await gestore.esegui_fonte(_job())
    assert {e.titolo: e.stato for e in archivio.eventi.values()} == {
        "Notte Ferrovia": "pubblicato",
        "Indie al Binario": "pubblicato",
    }
    esito = archivio.esiti[-1]
    assert (esito.eventi_letti, esito.eventi_nuovi, esito.pagine_lette) == (2, 2, 1)
    assert all(g.stato == "normalizzato" for g in archivio.grezzi.values())
    assert len(archivio.collegamenti) == 2


async def test_pagina_riletta_senza_modifiche_non_produce_lavoro() -> None:
    adattatore = AdattatoreFinto([grezzo("Notte Ferrovia")])
    gestore, archivio, _ = _ambiente(adattatore)
    await gestore.esegui_fonte(_job())
    await gestore.esegui_fonte(_job())
    assert len(archivio.eventi) == 1
    assert len(archivio.grezzi) == 1
    assert archivio.esiti[-1].eventi_invariati == 1
    assert archivio.esiti[-1].confermati == set(archivio.eventi)


async def test_aggiornamento_dello_stesso_evento_della_fonte() -> None:
    adattatore = AdattatoreFinto([grezzo("Notte Ferrovia", id_esterno="nf")])
    gestore, archivio, _ = _ambiente(adattatore)
    await gestore.esegui_fonte(_job())
    adattatore.grezzi = [
        grezzo("Notte Ferrovia (sala grande)", id_esterno="nf", descrizione="Ingresso 16+")
    ]
    await gestore.esegui_fonte(_job())
    (evento,) = archivio.eventi.values()
    assert evento.titolo == "Notte Ferrovia (sala grande)"
    assert (evento.eta_minima, evento.eta_minima_dichiarata) == (16, True)
    assert archivio.esiti[-1].eventi_uniti == 1


async def test_spostamento_rilevante_va_in_revisione() -> None:
    adattatore = AdattatoreFinto([grezzo("Notte Ferrovia", id_esterno="nf")])
    gestore, archivio, _ = _ambiente(adattatore)
    await gestore.esegui_fonte(_job())
    adattatore.grezzi = [grezzo("Notte Ferrovia", SABATO + timedelta(hours=3), id_esterno="nf")]
    await gestore.esegui_fonte(_job())
    revisione = next(g for g in archivio.grezzi.values() if g.stato == "in_revisione_dedup")
    assert revisione.nota == "Modifica rilevante: inizio spostato di 3.0 ore"
    (evento,) = archivio.eventi.values()
    assert evento.inizio == SABATO  # invariato finché un moderatore non decide


async def test_alcol_e_eta_mai_ridotti_dalla_fusione() -> None:
    adattatore = AdattatoreFinto(
        [grezzo("Notte Ferrovia", id_esterno="nf", descrizione="18+ open bar")]
    )
    gestore, archivio, _ = _ambiente(adattatore)
    await gestore.esegui_fonte(_job())
    adattatore.grezzi = [grezzo("Notte Ferrovia", id_esterno="nf", descrizione="dai 14 anni")]
    await gestore.esegui_fonte(_job())
    (evento,) = archivio.eventi.values()
    assert (evento.eta_minima, evento.riferimenti_alcol) == (18, True)


async def test_possibile_duplicato_da_un_altra_fonte_in_revisione() -> None:
    adattatore = AdattatoreFinto([grezzo("Notte Ferrovia techno all night", id_esterno="a")])
    gestore, archivio, _ = _ambiente(adattatore)
    await gestore.esegui_fonte(_job())
    adattatore.grezzi = [
        grezzo("Notte Ferrovia techno all night", id_esterno="a"),
        grezzo("Notte Ferrovia: la festa", SABATO + timedelta(hours=3), id_esterno="b"),
        grezzo("Altra cosa", SABATO + timedelta(hours=2, minutes=30), id_esterno="c"),
    ]
    await gestore.esegui_fonte(_job())
    revisione = next(g for g in archivio.grezzi.values() if g.stato == "in_revisione_dedup")
    assert revisione.punteggio is not None
    assert revisione.punteggio >= 75
    assert archivio.esiti[-1].eventi_in_revisione == 1


async def test_eventi_passati_scartati_senza_dati_della_fonte() -> None:
    adattatore = AdattatoreFinto(
        [grezzo("Ieri", ADESSO - timedelta(days=2), descrizione="testo lungo")]
    )
    gestore, archivio, _ = _ambiente(adattatore)
    await gestore.esegui_fonte(_job())
    (scartato,) = archivio.grezzi.values()
    assert scartato.stato == "scartato"
    assert scartato.errore is not None
    assert scartato.errore.startswith("EVENTO_PASSATO")
    assert "descrizione" not in scartato.payload
    assert archivio.eventi == {}


async def test_prova_legge_ma_non_scrive() -> None:
    adattatore = AdattatoreFinto([grezzo("Notte Ferrovia")])
    gestore, archivio, _ = _ambiente(adattatore, attiva=False)
    await gestore.esegui_fonte(_job(prova=True))
    assert archivio.eventi == {}
    assert archivio.grezzi == {}
    assert archivio.esiti[-1].prova
    assert archivio.esiti[-1].eventi_nuovi == 1


async def test_fonte_non_attiva_senza_prova_non_si_legge() -> None:
    adattatore = AdattatoreFinto([grezzo("Notte Ferrovia")])
    gestore, archivio, sito = _ambiente(adattatore, attiva=False)
    await gestore.esegui_fonte(_job())
    assert sito.richieste == []
    assert archivio.esiti == []


@pytest.mark.parametrize("conformita", ["da_verificare", "vietata"])
async def test_fonte_non_consentita_mai_letta(conformita: str) -> None:
    gestore, archivio, sito = _ambiente(AdattatoreFinto(), conformita=conformita)
    await gestore.esegui_fonte(_job(prova=True))
    assert sito.richieste == []
    assert archivio.esiti == []


async def test_errore_della_fonte_registrato_e_disattivazione_dopo_5() -> None:
    adattatore = AdattatoreFinto(errore=ErroreFonte("HTTP 503", codice="HTTP_503"))
    gestore, archivio, _ = _ambiente(adattatore)
    for _ in range(5):
        await gestore.esegui_fonte(_job())
    assert archivio.esiti[-1].codice_errore == "HTTP_503"
    assert archivio.errori_consecutivi == 5


async def test_assenze_per_i_possibili_annullamenti() -> None:
    adattatore = AdattatoreFinto(
        [grezzo("Notte Ferrovia"), grezzo("Cortile Live", SABATO + timedelta(days=7))]
    )
    gestore, archivio, _ = _ambiente(adattatore)
    await gestore.esegui_fonte(_job())
    adattatore.grezzi = adattatore.grezzi[:1]
    await gestore.esegui_fonte(_job())
    await gestore.esegui_fonte(_job())
    assenze = {archivio.eventi[k].titolo: v for k, v in archivio.assenze.items()}
    assert assenze == {"Notte Ferrovia": 0, "Cortile Live": 2}


async def test_fonte_inesistente_job_definitivo() -> None:
    gestore, archivio, _ = _ambiente(AdattatoreFinto())
    archivio.fonti.clear()
    with pytest.raises(ErroreJobDefinitivo):
        await gestore.esegui_fonte(_job())


async def test_decisione_stesso_evento_applica_anche_le_modifiche_rilevanti() -> None:
    adattatore = AdattatoreFinto([grezzo("Notte Ferrovia", id_esterno="nf")])
    gestore, archivio, _ = _ambiente(adattatore)
    await gestore.esegui_fonte(_job())
    adattatore.grezzi = [grezzo("Notte Ferrovia", SABATO + timedelta(hours=3), id_esterno="nf")]
    await gestore.esegui_fonte(_job())
    revisione = next(g for g in archivio.grezzi.values() if g.stato == "in_revisione_dedup")
    revisione.decisione = "stesso_evento"
    await gestore.applica_decisione(
        Job(
            id=2,
            tipo=TipoJob.DEDUPLICA_GREZZO,
            payload={"grezzo_id": str(revisione.id)},
            tentativi=0,
            chiave_idempotenza="d",
        )
    )
    (evento,) = archivio.eventi.values()
    assert evento.inizio == SABATO + timedelta(hours=3)
    assert revisione.stato == "unito"


async def test_decisione_eventi_distinti_crea_un_evento() -> None:
    adattatore = AdattatoreFinto([grezzo("Notte Ferrovia", id_esterno="nf")])
    gestore, archivio, _ = _ambiente(adattatore)
    await gestore.esegui_fonte(_job())
    adattatore.grezzi = [grezzo("Notte Ferrovia", SABATO + timedelta(hours=3), id_esterno="nf")]
    await gestore.esegui_fonte(_job())
    revisione = next(g for g in archivio.grezzi.values() if g.stato == "in_revisione_dedup")
    revisione.decisione = "distinti"
    job = Job(
        id=2,
        tipo=TipoJob.DEDUPLICA_GREZZO,
        payload={"grezzo_id": str(revisione.id)},
        tentativi=0,
        chiave_idempotenza="d",
    )
    await gestore.applica_decisione(job)
    assert len(archivio.eventi) == 2
    assert revisione.stato == "normalizzato"
    # Rieseguito (job ripetuto): la decisione è già applicata, nessun altro evento.
    await gestore.applica_decisione(job)
    assert len(archivio.eventi) == 2
