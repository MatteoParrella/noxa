# ADR-0003: Worker Python separato con coda su Postgres

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Scraping (anche con browser headless), chiamate al modello per i flyer e deduplicazione
sono lavori lunghi, da ritentare e da scalare in modo
indipendente dall'app.

## Decisione
- Servizio `services/worker` in Python 3.12, FastAPI (solo endpoint interni di
  salute; il worker non è esposto su internet), Playwright solo quando serve il rendering JavaScript, httpx per il resto,
  rapidfuzz, Pydantic, structlog; impacchettato in Docker.
- **Coda su Postgres** (`coda_job`) con `for update skip locked`, lease, retry con backoff,
  chiavi di idempotenza e di concorrenza.
- **`pg_cron` è l'unico scheduler**: inserisce i job nella coda. Il worker non pianifica
  nulla, quindi più istanze non duplicano il lavoro.
- Accesso al database con il ruolo `noxa_worker` (senza `BYPASSRLS`, permessi solo sulle
  tabelle di ingestione). Badge e riepiloghi annuali, che leggono il tracker, sono calcolati
  da funzioni SQL eseguite da `pg_cron`: i dati personali del tracker non arrivano al worker. La chiave
  `service_role` è usata solo dal client Storage per i bucket dei flyer.

## Alternative considerate
- **Edge Functions per tutto**: limiti di durata ed esecuzione inadatti a Playwright e ai
  lavori lunghi.
- **Celery/Redis o un servizio di code esterno**: un componente in più da gestire, inutile ai
  volumi previsti; Postgres basta e mantiene tutto transazionale.
- **APScheduler nel worker**: avrebbe creato un secondo scheduler da coordinare con
  `pg_cron`.

## Conseguenze
- Il worker non vede dati personali oltre a quelli necessari (immagini dei flyer).
- Se il volume dei job cresce di ordini di grandezza, la coda andrà spostata su un servizio
  dedicato; l'interfaccia del modulo `coda` lo permette.
