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

Iterazioni completate: 1 su 15.

| N | Stato | Inizio | Fine | Cicli di revisione | Branch | Note |
|---|---|---|---|---|---|---|
| 0 | completata con attese esterne | 2026-10-15 | 2026-10-15 | 3 | `iterazione-00-fondamenta` | Manca il repository GitHub remoto per la CI e i progetti di staging, produzione e deploy |
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

**Cicli di revisione**
- Ciclo 1: `supabase db lint` falliva sulle funzioni interne di PostGIS nello schema
  `extensions` → corretto limitando il lint a `public` e `private`. In CI l'e2e avrebbe
  rifatto la build già eseguita → corretto (`webServer` serve solo l'export in CI). Il
  `Dockerfile` non copia `README.md`, citato da `pyproject.toml` → corretto rimuovendo il
  campo `readme`. Errori di Ruff e mypy (convenzione dei nomi delle eccezioni, `Any` nel
  calcolo del backoff, confronti tra tipi diversi nei test) → corretti.
- Ciclo 2: `pnpm audit` ha segnalato 2 vulnerabilità "high" in dipendenze di sviluppo →
  `compression` forzata a `>=1.8.2` con un override; `braces` (dentro il plugin ESLint di
  Next, nessuna versione corretta disponibile) non viene pubblicata, quindi la CI blocca su
  `pnpm audit --prod` e mostra l'audit completo come informativo. I tipi globali dei test
  (`vitest/globals`) erano visibili anche al codice dell'app → i test importano le funzioni
  da `vitest` e il `tsconfig` include solo i tipi di Node.
- Ciclo 3: tutti i controlli verdi, nessun problema nuovo.

**Esito dei test**
- `scripts/verifica_documentazione.py`: 0 problemi; `scripts/verifica_migrazioni.py`: verde.
- pgTAP (`supabase test db`): 9/9. `supabase db lint` su `public` e `private`: nessun errore.
- App: lint, typecheck e Prettier verdi; Vitest 1/1; Playwright con axe 4/4 (mobile e desktop);
  `pnpm --filter web build` produce l'export statico in `apps/web/out`.
- Worker: Ruff, formattazione e mypy strict verdi; pytest 29/29.
- Docker: `docker compose up --build worker` → `/salute` 200, `/pronto` 200 con il database
  locale e il ruolo `noxa_worker`.
- Dipendenze: `pnpm audit --prod` e `pip-audit` senza vulnerabilità.
- Prova della RLS: una migrazione temporanea con una tabella senza RLS fa fallire sia
  `001_rls_abilitata` (1/9 fallito) sia `scripts/verifica_migrazioni.py`; dopo la rimozione i
  test tornano verdi. È la stessa sequenza che esegue la CI.

**Criteri di completamento**
| Criterio | Esito | Evidenza |
|---|---|---|
| `pnpm --filter web build` produce l'export statico | SÌ | `apps/web/out/index.html` |
| `docker compose up worker` risponde su `/salute` | SÌ | risposta `{"stato":"ok"}` 200 |
| `supabase start` e `supabase test db` funzionano | SÌ | 9/9 |
| CI verde su una PR di prova e rossa con una tabella senza RLS | Verificato in locale con gli stessi comandi della CI | `.github/workflows/ci.yml`; prova della RLS sopra. Da confermare su GitHub (attesa esterna) |

**Safety review — Iterazione 0 (infrastruttura)**
Esito: SUPERATA

| Sezione | Esito | Evidenza |
|---|---|---|
| A. Autorizzazione | SÌ | Nessuna tabella; `001_rls_abilitata` controlla RLS su tabelle, viste `security_invoker`, assenza di viste materializzate in `public`, nessun accesso di `anon` a `private`; `noxa_worker` senza `BYPASSRLS` né privilegi amministrativi; `execute` sulle funzioni di `private` revocato per default; nessun `service_role` in `apps/web` (grep) |
| B. Contatti tra utenti | N/A | Nessuna funzionalità utente |
| C. Eventi e contenuti | N/A | Nessun evento né testo per gli utenti oltre al titolo dell'app |
| D. Posizione | N/A | Nessun dato di posizione |
| E. Contenuti caricati | N/A | Nessun caricamento |
| F. Privacy | SÌ | Nessun dato personale, nessun SDK di terze parti; la password del database è `SecretStr` e non compare nei log né in `repr` (test `test_la_password_del_database_non_compare_nella_rappresentazione`); `openapi`/`docs` del worker disattivati |
| G. Documentazione | SÌ | DATA_MODEL §9, SAFETY_PRIVACY R-68, ARCHITECTURE §3.3, DESIGN §2, ROADMAP (iterazioni 2 e 5), CLAUDE.md e README aggiornati |

**Scelte fatte durante l'iterazione**
- TypeScript 6.0 invece della 7.0: `typescript-eslint` supporta solo versioni inferiori alla
  6.1. ESLint 9 invece del 10: i plugin di `eslint-config-next` non supportano ancora il 10.
- Tailwind 4: la configurazione sta nel CSS (`@theme inline`), DESIGN.md §2 aggiornato.
- CLI Supabase come dipendenza di sviluppo (`pnpm exec supabase`), così la versione è
  bloccata dal lockfile.
- Il modulo `coda` contiene l'esecutore e il protocollo `ArchivioJob`; l'implementazione
  Postgres e l'avvio degli esecutori arrivano con la tabella `coda_job` nell'iterazione 5
  (ROADMAP.md aggiornato).

**Attese esterne**
- Repository GitHub remoto e prima esecuzione della CI (PR di prova verde e PR con una tabella
  senza RLS rossa).
- Progetti Supabase `staging` e `produzione` (Francoforte), Vercel (UE) e Fly.io (`fra`).
