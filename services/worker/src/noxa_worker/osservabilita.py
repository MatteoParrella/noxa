"""Log strutturati con structlog (ARCHITECTURE.md §8).

I log contengono identificativi tecnici (`job_id`, `tipo`, `fonte_id`), durata ed esito; mai
payload personali, coordinate o segreti.
"""

from __future__ import annotations

import logging
import sys
from typing import Literal

import structlog


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
