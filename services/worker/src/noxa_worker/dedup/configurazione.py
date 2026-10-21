"""Soglie della deduplicazione (EVENT_INGESTION.md §6.3), calibrate sul golden set
`tests/dati/dedup_golden.jsonl`: il test `test_dedup_golden.py` fallisce se una modifica
porta la precisione sotto il 98% o il richiamo sotto il 90%."""

from __future__ import annotations

from datetime import timedelta

SOGLIA_STESSO = 90.0
SOGLIA_SIMILE = 75.0
DELTA_STESSO_MINUTI = 60
DELTA_UNICO_MINUTI = 90
# Una modifica dell'inizio oltre questa soglia la applica solo un moderatore (§7).
MODIFICA_RILEVANTE_INIZIO = timedelta(hours=2)
MASSIMO_GENERI = 5
MASSIMO_ARTISTI = 20
