"""Impostazioni del worker, lette dalle variabili d'ambiente (`.env.example`)."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Impostazioni(BaseSettings):
    """Configurazione validata all'avvio: un valore mancante o errato ferma il worker."""

    model_config = SettingsConfigDict(extra="ignore", frozen=True)

    ambiente: Literal["locale", "staging", "produzione"]
    # Connessione con il ruolo limitato noxa_worker (DATA_MODEL.md §1). Contiene la password:
    # non va mai nei log.
    worker_database_url: SecretStr
    log_formato: Literal["json", "console"] = "json"
    log_livello: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    # Esecutori paralleli della coda in ogni istanza (ARCHITECTURE.md §3.3).
    coda_concorrenza: int = Field(default=4, ge=1, le=32)
    # Tempo massimo per la verifica del database di /pronto.
    timeout_database_s: float = Field(default=2.0, gt=0, le=30)

    def url_database(self) -> str:
        """URL del database validato come DSN Postgres."""
        valore = self.worker_database_url.get_secret_value()
        PostgresDsn(valore)
        return valore


@lru_cache(maxsize=1)
def leggi_impostazioni() -> Impostazioni:
    """Impostazioni dall'ambiente, lette una sola volta per processo."""
    return Impostazioni()
