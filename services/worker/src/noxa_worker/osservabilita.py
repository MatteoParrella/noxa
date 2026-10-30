"""Log strutturati con structlog e Sentry (ARCHITECTURE.md §8, ADR-0014).

I log contengono identificativi tecnici (`job_id`, `tipo`, `fonte_id`), durata ed esito; mai
payload personali, coordinate o segreti. Sentry riceve solo il tipo di errore e lo stack,
senza variabili locali, richieste, utenti né breadcrumb (R-62).
"""

from __future__ import annotations

import logging
import re
import sys
from typing import TYPE_CHECKING, Any, Literal

import sentry_sdk
import structlog

if TYPE_CHECKING:
    from sentry_sdk.types import Event, Hint

    from noxa_worker.configurazione import Impostazioni

_EMAIL = re.compile(r"[^\s@\"'<>]+@[^\s@\"'<>]+\.[a-z]{2,}", re.IGNORECASE)
_COORDINATE = re.compile(r"-?\d{1,3}\.\d{3,}")
_TRA_VIRGOLETTE = re.compile(r"([\"'«“])(?:(?!\1).){1,}?([\"'»”])")
_URL = re.compile(r"https?://\S+")


def pulisci_testo(testo: str) -> str:
    """Toglie da un messaggio email, coordinate, URL e testi tra virgolette."""
    testo = _EMAIL.sub("[email]", testo)
    testo = _URL.sub("[url]", testo)
    testo = _COORDINATE.sub("[numero]", testo)
    return _TRA_VIRGOLETTE.sub("[testo]", testo)


def pulisci_evento(evento: Event, _suggerimento: Hint) -> Event:
    """`before_send` di Sentry: niente dati personali né contenuti dei job (R-62)."""
    for chiave in ("user", "request", "breadcrumbs", "extra"):
        evento.pop(chiave, None)  # type: ignore[misc]
    messaggio: Any = evento.get("message")
    if isinstance(messaggio, str):
        evento["message"] = pulisci_testo(messaggio)
    logentry: Any = evento.get("logentry")
    if isinstance(logentry, dict):
        logentry.pop("params", None)
        if isinstance(logentry.get("message"), str):
            logentry["message"] = pulisci_testo(logentry["message"])
    eccezioni: Any = evento.get("exception", {})
    for eccezione in eccezioni.get("values", []) if isinstance(eccezioni, dict) else []:
        if isinstance(eccezione.get("value"), str):
            eccezione["value"] = pulisci_testo(eccezione["value"])
        for riquadro in (eccezione.get("stacktrace") or {}).get("frames", []):
            riquadro.pop("vars", None)
    return evento


def configura_sentry(impostazioni: Impostazioni) -> None:
    """Avvia Sentry solo se è configurato il DSN (regione UE)."""
    dsn = impostazioni.sentry_dsn_worker.get_secret_value()
    if not dsn:
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=impostazioni.ambiente,
        send_default_pii=False,
        include_local_variables=False,
        max_breadcrumbs=0,
        traces_sample_rate=0.0,
        before_send=pulisci_evento,
    )


def configura_log(
    formato: Literal["json", "console"], livello: Literal["DEBUG", "INFO", "WARNING", "ERROR"]
) -> None:
    """Configura structlog e il logging standard (uvicorn, httpx) con lo stesso formato."""
    processori_comuni: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
    ]
    renderer: structlog.types.Processor
    if formato == "json":
        processori_comuni.append(structlog.processors.format_exc_info)
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[*processori_comuni, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    gestore = logging.StreamHandler(sys.stdout)
    gestore.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=processori_comuni,
            processors=[structlog.stdlib.ProcessorFormatter.remove_processors_meta, renderer],
        )
    )
    radice = logging.getLogger()
    radice.handlers.clear()
    radice.addHandler(gestore)
    radice.setLevel(livello)
    for nome in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        registro = logging.getLogger(nome)
        registro.handlers.clear()
        registro.propagate = True
    # httpx registra ogni URL richiesto a livello INFO: niente URL nei log, solo gli avvisi.
    for nome in ("httpx", "httpcore"):
        logging.getLogger(nome).setLevel(logging.WARNING)
