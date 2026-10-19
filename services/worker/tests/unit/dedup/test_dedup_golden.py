"""Precisione e richiamo della deduplicazione sul golden set (EVENT_INGESTION.md §6.3).

Precisione: tra le coppie unite automaticamente, quante sono davvero lo stesso evento
(≥ 98%). Richiamo: tra le coppie che sono lo stesso evento, quante vengono unite
automaticamente (≥ 90%). Le coppie mandate in revisione non contano come unite.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from noxa_worker.dedup.punteggio import EsitoDedup, EventoConfronto, decidi

GOLDEN = Path(__file__).parents[2] / "dati/dedup_golden.jsonl"
PRECISIONE_MINIMA = 0.98
RICHIAMO_MINIMO = 0.90


def _confronto(dati: dict[str, Any]) -> EventoConfronto:
    return EventoConfronto(
        titolo=dati["titolo"],
        inizio=datetime.fromisoformat(dati["inizio"]),
        artisti=tuple(dati["artisti"]),
        id=uuid4(),
    )


def _coppie() -> list[dict[str, Any]]:
    return [json.loads(riga) for riga in GOLDEN.read_text(encoding="utf-8").splitlines() if riga]


def test_golden_set_abbastanza_grande() -> None:
    coppie = _coppie()
    assert len(coppie) >= 300
    assert sum(c["stesso_evento"] for c in coppie) >= 100
    assert sum(not c["stesso_evento"] for c in coppie) >= 100


def test_precisione_e_richiamo() -> None:
    vere_unite = false_unite = vere_mancate = 0
    for coppia in _coppie():
        esistente = _confronto(coppia["a"])
        # Altri eventi della stessa serata nel locale, con titoli e orari estranei.
        altri = [
            EventoConfronto(
                f"Serata ospite {n} zeta",
                esistente.inizio + timedelta(hours=3 + n) if esistente.inizio else None,
                (),
                uuid4(),
            )
            for n in range(coppia["altri_nel_blocco"])
        ]
        decisione = decidi(_confronto(coppia["b"]), [esistente, *altri], coppia["locale"])
        unita = decisione.esito is EsitoDedup.STESSO_EVENTO and decisione.evento_id == esistente.id
        if unita and coppia["stesso_evento"]:
            vere_unite += 1
        elif unita:
            false_unite += 1
        elif coppia["stesso_evento"]:
            vere_mancate += 1
    precisione = vere_unite / (vere_unite + false_unite)
    richiamo = vere_unite / (vere_unite + vere_mancate)
    assert precisione >= PRECISIONE_MINIMA, f"precisione {precisione:.3f}"
    assert richiamo >= RICHIAMO_MINIMO, f"richiamo {richiamo:.3f}"
