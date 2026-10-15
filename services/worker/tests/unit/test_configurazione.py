import pytest
from pydantic import SecretStr, ValidationError

from noxa_worker.configurazione import Impostazioni


def test_la_password_del_database_non_compare_nella_rappresentazione() -> None:
    impostazioni = Impostazioni(
        ambiente="locale",
        worker_database_url=SecretStr("postgresql://noxa_worker:segreta@db:5432/postgres"),
    )
    assert "segreta" not in repr(impostazioni)
    assert "segreta" not in str(impostazioni.model_dump())


def test_url_database_non_valido_rifiutato() -> None:
    impostazioni = Impostazioni(ambiente="locale", worker_database_url=SecretStr("non-un-url"))
    with pytest.raises(ValidationError):
        impostazioni.url_database()


def test_ambiente_sconosciuto_rifiutato() -> None:
    with pytest.raises(ValidationError):
        Impostazioni(
            ambiente="sviluppo",  # type: ignore[arg-type]
            worker_database_url=SecretStr("postgresql://u:p@db/postgres"),
        )


def test_lettura_da_variabili_d_ambiente(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AMBIENTE", "staging")
    monkeypatch.setenv("WORKER_DATABASE_URL", "postgresql://u:p@db/postgres")
    monkeypatch.setenv("CODA_CONCORRENZA", "2")
    impostazioni = Impostazioni()
    assert impostazioni.ambiente == "staging"
    assert impostazioni.coda_concorrenza == 2
