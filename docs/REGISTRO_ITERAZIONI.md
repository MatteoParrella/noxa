# Registro delle iterazioni

Stato di avanzamento delle 15 iterazioni definite in [ROADMAP.md](ROADMAP.md) §5. Il file è
aggiornato **dalla skill `iterazione`** all'inizio e alla fine di ogni iterazione; a mano si
modifica solo per correggere un errore, spiegandolo nelle note.

Stati possibili:

| Stato | Significato |
|---|---|
| `da iniziare` | Non ancora avviata |
| `in corso` | Avviata e non ancora chiusa |
| `completata` | Tutti i criteri di completamento verificati |
| `completata con attese esterne` | Tutto il lavoro locale è completo e verificato; mancano solo prerequisiti esterni (account, chiavi, accordi, revisioni degli store), elencati nel dettaglio. Si può passare all'iterazione successiva, ma la fase non si chiude finché le attese non sono risolte |
| `bloccata` | Ferma per un problema da risolvere (design mancante, decisione aperta, criterio non raggiungibile): il motivo è nel dettaglio |

## Riepilogo

Iterazioni completate: 0 su 15.

| N | Stato | Inizio | Fine | Cicli di revisione | Branch | Note |
|---|---|---|---|---|---|---|
| 0 | in corso | 2026-10-15 | — | 0 | `iterazione-00-fondamenta` | — |
| 1 | da iniziare | — | — | 0 | — | — |
| 2 | da iniziare | — | — | 0 | — | — |
| 3 | da iniziare | — | — | 0 | — | — |
| 4 | da iniziare | — | — | 0 | — | — |
| 5 | da iniziare | — | — | 0 | — | — |
| 6 | da iniziare | — | — | 0 | — | — |
| 7 | da iniziare | — | — | 0 | — | — |
| 8 | da iniziare | — | — | 0 | — | — |
| 9 | da iniziare | — | — | 0 | — | — |
| 10 | da iniziare | — | — | 0 | — | — |
| 11 | da iniziare | — | — | 0 | — | — |
| 12 | da iniziare | — | — | 0 | — | — |
| 13 | da iniziare | — | — | 0 | — | — |
| 14 | da iniziare | — | — | 0 | — | — |

## Dettaglio

Per ogni iterazione avviata la skill aggiunge qui una sezione con: piano eseguito, cicli di
revisione (cosa è stato trovato e corretto in ognuno), esito dei test, rapporto di
`safety-review`, attese esterne, commit.

### Iterazione 0 — Fondamenta del repository

**Piano**
- Funzionalità: nessuna (infrastruttura). Riferimenti: ROADMAP.md §5, ADR-0001, ADR-0002,
  ADR-0003, ADR-0013, ADR-0015.
- Database: `supabase init`; migrazione con estensioni (`postgis`, `citext`, `pg_cron`,
  `pg_net`), schema `private` vuoto senza accesso per `anon`, ruolo `noxa_worker` senza
  `BYPASSRLS`; seed con la password locale del worker; test `001_rls_abilitata` e
  `scripts/verifica_migrazioni.py`.
- Worker: `pyproject.toml` e `uv.lock`; configurazione validata, log structlog, API con
  `/salute` e `/pronto`, modulo `coda` (esecutore con lease, timeout, retry e backoff dietro
  il protocollo `ArchivioJob`); Ruff, mypy strict, pytest.
- App: monorepo pnpm; Next.js in export statico, TypeScript strict, Tailwind, ESLint,
  Prettier, Vitest, Playwright con axe.
- CI GitHub Actions: documentazione e migrazioni, app, worker con immagine Docker, database
  con pgTAP, controllo delle dipendenze.
- Criteri: build statica; `docker compose up worker` risponde su `/salute`; `supabase start`
  e `supabase test db` funzionano; CI verde su una PR di prova e rossa su una PR con una
  tabella senza RLS.
