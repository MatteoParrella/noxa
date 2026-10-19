"""Eccezioni tipizzate della raccolta (ARCHITECTURE.md §5.2).

I messaggi finiscono in `esecuzioni_fonte`, `eventi_grezzi.errore` e nei log: non contengono
mai dati personali, solo codici, URL delle fonti e descrizioni tecniche.
"""

from __future__ import annotations


class ErroreRaccolta(Exception):
    """Base degli errori della raccolta, con un codice stabile (`^[A-Z0-9_]+$`)."""

    codice: str = "ERRORE"

    def __init__(self, messaggio: str, *, codice: str | None = None) -> None:
        super().__init__(messaggio)
        if codice is not None:
            self.codice = codice


class ErroreFonte(ErroreRaccolta):
    """Errore di rete o di struttura della pagina: la fonte si ferma per questa esecuzione."""

    codice = "ERRORE_FONTE"


class ErroreConformita(ErroreRaccolta):
    """robots.txt o i limiti di ADR-0008 vietano la richiesta: nessuna richiesta viene fatta."""

    codice = "CONFORMITA"


class ErroreValidazione(ErroreRaccolta):
    """Il dato raccolto non rispetta lo schema evento o le regole di EVENT_INGESTION.md §3.1."""

    codice = "VALIDAZIONE"
