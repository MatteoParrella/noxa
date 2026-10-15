import asyncio
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import pytest

from noxa_worker.coda import (
    DURATA_LEASE,
    MASSIMO_TENTATIVI,
    ErroreJobDefinitivo,
    EsecutoreCoda,
    GestoreJob,
    Job,
    TipoJob,
    calcola_backoff,
    descrivi_errore,
)

ADESSO = datetime(2026, 10, 15, 22, 0, tzinfo=UTC)


@dataclass
class ArchivioFinto:
    """Archivio in memoria che registra le chiamate dell'esecutore."""

    job: list[Job] = field(default_factory=list)
    completati: list[int] = field(default_factory=list)
    rinviati: list[tuple[int, datetime, str]] = field(default_factory=list)
    falliti: list[tuple[int, str]] = field(default_factory=list)
    tipi_richiesti: list[frozenset[TipoJob]] = field(default_factory=list)
    lease_richiesti: list[timedelta] = field(default_factory=list)

    async def preleva(self, tipi: frozenset[TipoJob], durata_lease: timedelta) -> Job | None:
        self.tipi_richiesti.append(tipi)
        self.lease_richiesti.append(durata_lease)
        for indice, job in enumerate(self.job):
            if job.tipo in tipi:
                return self.job.pop(indice)
        return None

    async def completa(self, job_id: int) -> None:
        self.completati.append(job_id)

    async def rinvia(self, job_id: int, esegui_dopo: datetime, errore: str) -> None:
        self.rinviati.append((job_id, esegui_dopo, errore))

    async def fallisci(self, job_id: int, errore: str) -> None:
        self.falliti.append((job_id, errore))


def _job(tentativi: int = 0, tipo: TipoJob = TipoJob.ESEGUI_FONTE) -> Job:
    return Job(
        id=7,
        tipo=tipo,
        payload={"fonte_id": "3f1c2d4e-0000-4000-8000-000000000001"},
        tentativi=tentativi,
        chiave_idempotenza="esegui_fonte:3f1c2d4e-0000-4000-8000-000000000001",
    )


def _esecutore(archivio: ArchivioFinto, gestore: GestoreJob, **opzioni: object) -> EsecutoreCoda:
    return EsecutoreCoda(
        archivio,
        {TipoJob.ESEGUI_FONTE: gestore},
        adesso=lambda: ADESSO,
        casuale=lambda: 0.5,
        **opzioni,  # type: ignore[arg-type]
    )


async def _ok(_: Job) -> None:
    return None


class TestBackoff:
    @pytest.mark.parametrize(
        ("tentativi", "secondi"), [(1, 30), (2, 60), (3, 120), (4, 240), (8, 3600), (20, 3600)]
    )
    def test_raddoppia_fino_a_un_ora(self, tentativi: int, secondi: int) -> None:
        assert calcola_backoff(tentativi, lambda: 0.5) == timedelta(seconds=secondi)

    def test_variazione_massima_del_dieci_per_cento(self) -> None:
        assert calcola_backoff(1, lambda: 0.0) == timedelta(seconds=27)
        assert calcola_backoff(1, lambda: 1.0) == timedelta(seconds=33)

    def test_rifiuta_zero_tentativi(self) -> None:
        with pytest.raises(ValueError, match="almeno 1"):
            calcola_backoff(0)


class TestEsecutore:
    async def test_coda_vuota(self) -> None:
        archivio = ArchivioFinto()
        assert await _esecutore(archivio, _ok).esegui_uno() is False
        assert archivio.completati == []

    async def test_preleva_solo_i_tipi_gestiti_con_il_lease_di_dieci_minuti(self) -> None:
        archivio = ArchivioFinto(job=[_job(tipo=TipoJob.ANALIZZA_FLYER)])
        assert await _esecutore(archivio, _ok).esegui_uno() is False
        assert archivio.tipi_richiesti == [frozenset({TipoJob.ESEGUI_FONTE})]
        assert archivio.lease_richiesti == [DURATA_LEASE] == [timedelta(minutes=10)]

    async def test_job_riuscito_completato(self) -> None:
        archivio = ArchivioFinto(job=[_job()])
        ricevuti: list[Job] = []

        async def gestore(job: Job) -> None:
            ricevuti.append(job)

        assert await _esecutore(archivio, gestore).esegui_uno() is True
        assert archivio.completati == [7]
        assert [j.id for j in ricevuti] == [7]
        assert archivio.rinviati == []
        assert archivio.falliti == []

    async def test_errore_temporaneo_rinviato_con_backoff(self) -> None:
        archivio = ArchivioFinto(job=[_job(tentativi=1)])

        async def gestore(_: Job) -> None:
            raise ConnectionError("risposta 503 dalla fonte")

        await _esecutore(archivio, gestore).esegui_uno()
        assert archivio.rinviati == [
            (7, ADESSO + timedelta(seconds=60), "ConnectionError: risposta 503 dalla fonte")
        ]
        assert archivio.completati == []
        assert archivio.falliti == []

    async def test_ultimo_tentativo_fallito_non_rinviato(self) -> None:
        archivio = ArchivioFinto(job=[_job(tentativi=MASSIMO_TENTATIVI - 1)])

        async def gestore(_: Job) -> None:
            raise ConnectionError("ancora giù")

        await _esecutore(archivio, gestore).esegui_uno()
        assert archivio.falliti == [(7, "ConnectionError: ancora giù")]
        assert archivio.rinviati == []

    async def test_errore_definitivo_non_ritentato(self) -> None:
        archivio = ArchivioFinto(job=[_job()])

        async def gestore(_: Job) -> None:
            raise ErroreJobDefinitivo("fonte non più consentita")

        await _esecutore(archivio, gestore).esegui_uno()
        assert archivio.falliti == [(7, "ErroreJobDefinitivo: fonte non più consentita")]
        assert archivio.rinviati == []

    async def test_timeout_trattato_come_errore_temporaneo(self) -> None:
        archivio = ArchivioFinto(job=[_job()])

        async def gestore(_: Job) -> None:
            await asyncio.sleep(1)

        esecutore = _esecutore(archivio, gestore, timeout_job=timedelta(milliseconds=10))
        await esecutore.esegui_uno()
        assert archivio.rinviati == [(7, ADESSO + timedelta(seconds=30), "Timeout del job")]

    async def test_cancellazione_lascia_il_job_al_lease(self) -> None:
        archivio = ArchivioFinto(job=[_job()])
        avviato = asyncio.Event()

        async def gestore(_: Job) -> None:
            avviato.set()
            await asyncio.sleep(10)

        compito = asyncio.create_task(_esecutore(archivio, gestore).esegui_uno())
        await avviato.wait()
        compito.cancel()
        with pytest.raises(asyncio.CancelledError):
            await compito
        assert archivio.completati == []
        assert archivio.rinviati == []
        assert archivio.falliti == []

    def test_timeout_non_inferiore_al_lease_rifiutato(self) -> None:
        with pytest.raises(ValueError, match="lease"):
            _esecutore(ArchivioFinto(), _ok, timeout_job=DURATA_LEASE)

    def test_senza_gestori_rifiutato(self) -> None:
        with pytest.raises(ValueError, match="gestore"):
            EsecutoreCoda(ArchivioFinto(), {}, adesso=lambda: ADESSO)

    async def test_ciclo_esegue_i_job_e_si_ferma_all_arresto(self) -> None:
        archivio = ArchivioFinto(job=[_job(), _job()])
        arresto = asyncio.Event()

        async def gestore(_: Job) -> None:
            if len(archivio.completati) == 1:
                arresto.set()

        esecutore = _esecutore(archivio, gestore, attesa_coda_vuota=timedelta(milliseconds=10))
        await asyncio.wait_for(esecutore.esegui(arresto), timeout=2)
        assert archivio.completati == [7, 7]

    async def test_ciclo_sopravvive_a_un_errore_dell_archivio(self) -> None:
        archivio = ArchivioFinto()
        arresto = asyncio.Event()
        chiamate = 0

        async def preleva_rotto(tipi: frozenset[TipoJob], durata_lease: timedelta) -> Job | None:
            nonlocal chiamate
            chiamate += 1
            if chiamate >= 2:
                arresto.set()
            raise OSError("connessione persa")

        archivio.preleva = preleva_rotto  # type: ignore[method-assign]
        esecutore = _esecutore(archivio, _ok, attesa_coda_vuota=timedelta(milliseconds=10))
        await asyncio.wait_for(esecutore.esegui(arresto), timeout=2)
        assert chiamate >= 2


def test_descrizione_errore_troncata_a_500_caratteri() -> None:
    assert len(descrivi_errore(RuntimeError("x" * 1000))) == 500
    assert descrivi_errore(RuntimeError()) == "RuntimeError"
