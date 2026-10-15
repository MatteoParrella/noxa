from collections.abc import AsyncIterator

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from noxa_worker.api import crea_app
from noxa_worker.configurazione import Impostazioni
from noxa_worker.database import VerificaDatabase


def _impostazioni() -> Impostazioni:
    return Impostazioni(
        ambiente="locale",
        worker_database_url=SecretStr("postgresql://noxa_worker:segreta@127.0.0.1:54322/postgres"),
        log_formato="console",
    )


def _client(database_raggiungibile: bool) -> TestClient:
    async def fabbrica(_: Impostazioni) -> AsyncIterator[VerificaDatabase]:
        async def verifica() -> bool:
            return database_raggiungibile

        yield verifica

    return TestClient(crea_app(_impostazioni(), fabbrica))


def test_salute_risponde_sempre_ok() -> None:
    with _client(database_raggiungibile=False) as client:
        risposta = client.get("/salute")
    assert risposta.status_code == 200
    assert risposta.json() == {"stato": "ok"}


@pytest.mark.parametrize(
    ("raggiungibile", "codice", "corpo"),
    [
        (True, 200, {"stato": "pronto", "database": True}),
        (False, 503, {"stato": "non_pronto", "database": False}),
    ],
)
def test_pronto_dipende_dal_database(
    raggiungibile: bool, codice: int, corpo: dict[str, object]
) -> None:
    with _client(database_raggiungibile=raggiungibile) as client:
        risposta = client.get("/pronto")
    assert risposta.status_code == codice
    assert risposta.json() == corpo


def test_documentazione_openapi_non_esposta() -> None:
    with _client(database_raggiungibile=True) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/openapi.json").status_code == 404
