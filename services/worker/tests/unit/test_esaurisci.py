from collections.abc import Iterator

import pytest
import structlog

from noxa_worker.esaurisci import ATTESE_DATABASE_S, attendi_database


class VerificaFinta:
    """Verifica del database che risponde secondo una sequenza di esiti."""

    def __init__(self, esiti: list[bool]) -> None:
        self._esiti: Iterator[bool] = iter(esiti)
        self.chiamate = 0

    async def __call__(self) -> bool:
        self.chiamate += 1
        return next(self._esiti)


class DormiFinto:
    def __init__(self) -> None:
        self.attese: list[float] = []

    async def __call__(self, secondi: float) -> None:
        self.attese.append(secondi)


async def test_database_subito_raggiungibile_senza_attese() -> None:
    verifica, dormi = VerificaFinta([True]), DormiFinto()
    assert await attendi_database(verifica, dormi=dormi)
    assert verifica.chiamate == 1
    assert dormi.attese == []


async def test_errore_transitorio_riprova_con_backoff() -> None:
    verifica, dormi = VerificaFinta([False, False, True]), DormiFinto()
    with structlog.testing.capture_logs() as log:
        assert await attendi_database(verifica, dormi=dormi)
    assert verifica.chiamate == 3
    assert dormi.attese == list(ATTESE_DATABASE_S[:2])
    assert [r["event"] for r in log] == [
        "database_nuovo_tentativo",
        "database_nuovo_tentativo",
        "database_raggiunto",
    ]


async def test_si_arrende_dopo_tutti_i_tentativi() -> None:
    verifica, dormi = VerificaFinta([False] * 4), DormiFinto()
    assert not await attendi_database(verifica, dormi=dormi)
    assert verifica.chiamate == len(ATTESE_DATABASE_S) + 1
    assert dormi.attese == list(ATTESE_DATABASE_S)


def test_attese_crescenti_e_limitate() -> None:
    assert list(ATTESE_DATABASE_S) == sorted(ATTESE_DATABASE_S)
    # L'esecuzione dura al massimo 10 minuti: l'attesa del database ne usa una parte minima.
    assert sum(ATTESE_DATABASE_S) <= 30


@pytest.mark.parametrize("attese", [(), (0.5,)])
async def test_attese_personalizzate(attese: tuple[float, ...]) -> None:
    verifica, dormi = VerificaFinta([False] * (len(attese) + 1)), DormiFinto()
    assert not await attendi_database(verifica, attese, dormi)
    assert dormi.attese == list(attese)
