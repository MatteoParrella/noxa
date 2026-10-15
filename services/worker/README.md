# services/worker

Worker Python di Noxa: raccolta eventi, estrazione dei flyer con Claude API,
deduplicazione (ADR-0003, `docs/EVENT_INGESTION.md`).

Dipendenze in `pyproject.toml` e `uv.lock` (uv). Organizzazione di `src/noxa_worker/`:

| Modulo | Contenuto |
|---|---|
| `api.py` | FastAPI interna: `/salute` (liveness), `/pronto` (database raggiungibile); dall'iterazione 5 avvia gli esecutori della coda nel lifespan |
| `configurazione.py` | Impostazioni validate dalle variabili d'ambiente (`.env.example`) |
| `osservabilita.py` | Log JSON con structlog |
| `database.py` | Pool di connessioni con il ruolo `noxa_worker` |
| `coda.py` | Esecutore dei job: lease di 10 minuti, timeout, retry con backoff esponenziale (massimo 5 tentativi), errori definitivi; accesso alla tabella `coda_job` tramite il protocollo `ArchivioJob` |
| `fonti/` | `ClientHttpConforme`, adattatori, registro, bootstrap dei locali |
| `flyer/` | Schema `FlyerEstratto`, prompt versionato, estrattore, valutazione |
| `normalizzazione/` | Date, età minima, riferimenti all'alcol, generi |
| `dedup/` | Normalizzazione dei titoli, confronto, fusione |

Strumenti da riga di comando (da `services/worker`): `uv run python -m noxa_worker.fonti.prova`,
`uv run python -m noxa_worker.fonti.salva_fixture`, `uv run python -m noxa_worker.flyer.valuta`
(vedi le skill).

Il worker non pianifica nulla: i job sono accodati da `pg_cron` e dai trigger. Comandi in
`CLAUDE.md`; procedure nelle skill `add-event-source` e `flyer-parser`.
