# services/worker

Worker Python di Noxa: raccolta eventi, estrazione dei flyer con Claude API,
deduplicazione (ADR-0003, `docs/EVENT_INGESTION.md`).

Viene inizializzato nella Fase 0 (`pyproject.toml` e `uv.lock` con uv). Organizzazione
prevista di `src/noxa_worker/`:

| Modulo | Contenuto |
|---|---|
| `api.py` | FastAPI interna: `/salute`, `/pronto`; avvia gli esecutori della coda nel lifespan |
| `coda.py` | Prelievo dei job da `coda_job` con `skip locked`, lease, retry, idempotenza |
| `fonti/` | `ClientHttpConforme`, adattatori, registro, bootstrap dei locali |
| `flyer/` | Schema `FlyerEstratto`, prompt versionato, estrattore, valutazione |
| `normalizzazione/` | Date, età minima, riferimenti all'alcol, generi |
| `dedup/` | Normalizzazione dei titoli, confronto, fusione |

Strumenti da riga di comando (da `services/worker`): `uv run python -m noxa_worker.fonti.prova`,
`uv run python -m noxa_worker.fonti.salva_fixture`, `uv run python -m noxa_worker.flyer.valuta`
(vedi le skill).

Il worker non pianifica nulla: i job sono accodati da `pg_cron` e dai trigger. Comandi in
`CLAUDE.md`; procedure nelle skill `add-event-source` e `flyer-parser`.
