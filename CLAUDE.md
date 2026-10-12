# CLAUDE.md — Noxa

Istruzioni per Claude Code e per chiunque sviluppi su questo repository. Leggerle prima di
ogni attività. In caso di conflitto con altri documenti vale
[docs/SAFETY_PRIVACY.md](docs/SAFETY_PRIVACY.md) per le regole di sicurezza; per tutto il
resto valgono gli ADR accettati.

## Il progetto

Noxa è un'app (PWA + iOS + Android) per ragazzi dai 14 ai 25 anni che escono la sera a
Milano e in Brianza. Copre il ciclo **scopri → organizza → vivi → ricorda**: eventi su
elenco e mappa, gruppi e serate di gruppo, check-in e ritorno sicuro, tracker personale con
badge e riepilogo annuale. È un prodotto destinato al lancio pubblico, non un prototipo.

| Documento | Contenuto |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Obiettivi, utenti tipo, funzionalità `F-xx` con priorità, fuori perimetro, matrice di tracciabilità |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Componenti, flussi, diagrammi, deployment |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Tabelle, funzioni `private.*`, policy RLS, storage, realtime, job |
| [docs/EVENT_INGESTION.md](docs/EVENT_INGESTION.md) | Fonti, pipeline, schema evento, flyer, deduplicazione, fusione |
| [docs/SAFETY_PRIVACY.md](docs/SAFETY_PRIVACY.md) | Regole `R-xx` sui minorenni e la privacy, con i motivi |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fasi, 15 iterazioni, criteri di completamento, definizione di completato |
| [docs/REGISTRO_ITERAZIONI.md](docs/REGISTRO_ITERAZIONI.md) | Stato delle iterazioni e cicli di revisione (aggiornato dalla skill `iterazione`) |
| [docs/GUIDA_OPERATIVA.md](docs/GUIDA_OPERATIVA.md) | Come lavorare: iterazioni, skill, calendario di Claude Design |
| [docs/DESIGN.md](docs/DESIGN.md) | Flusso con Claude Design, token, accessibilità, tono |
| [docs/DECISIONI_APERTE.md](docs/DECISIONI_APERTE.md) | **Unico** elenco delle decisioni aperte `D-xx` |
| [docs/decisions/](docs/decisions/) | ADR |

## Stack

- **App**: Next.js (App Router) in **export statico** + TypeScript strict + Tailwind; PWA
  (Workbox) e app iOS/Android con Capacitor (ADR-0001). TanStack Query, Zod, MapLibre GL JS
  con la basemap Protomaps auto-ospitata in PMTiles, senza servizi di mappe a pagamento
  (ADR-0016).
- **Backend**: Supabase in UE (Postgres + PostGIS, Auth, Storage, Realtime, Edge Functions
  Deno, `pg_cron`). **La RLS è l'unico punto di autorizzazione** (ADR-0002).
- **Worker**: Python 3.12, FastAPI, httpx, Playwright, rapidfuzz, Pydantic, structlog, SDK
  `anthropic`; Docker; coda su Postgres; `pg_cron` è l'unico scheduler (ADR-0003).
- **Hosting**: Supabase Francoforte, Vercel UE (statico), Fly.io `fra`, Sentry UE (ADR-0012).
- **Sviluppo**: Windows + WSL Ubuntu, repository nel filesystem Linux, docker-compose per il
  worker, CLI Supabase per il database locale.

## Struttura delle cartelle

```
.
├── CLAUDE.md, README.md, docker-compose.yml, .env.example
├── .claude/skills/          skill del progetto (vedi sotto)
├── .github/workflows/       CI
├── apps/web/                app Next.js + Capacitor
│   ├── src/app/             route (statiche; dettagli con ?id=)
│   ├── src/features/<area>/ scopri, organizza, vivi, ricorda, account, moderazione
│   ├── src/components/ui/   componenti del design system
│   ├── src/lib/             client Supabase, tipi generati, errori, messaggi
│   ├── src/styles/          tokens.css
│   └── tests/{unit,e2e}/
├── services/worker/
│   ├── src/noxa_worker/     coda, fonti/, flyer/, normalizzazione/, dedup/, api
│   └── tests/{unit,integrazione,dati}/
├── supabase/
│   ├── migrations/          migrazioni SQL con RLS
│   ├── tests/               test pgTAP
│   ├── functions/           Edge Functions
│   └── seed.sql             utenti di test per età
├── packages/schemas/        JSON Schema condivisi (evento.schema.json)
├── scripts/                 strumenti di repository (verifica_documentazione.py)
├── design/F-xx-nome/        brief ed esportazioni da Claude Design
└── docs/                    documentazione
```

## Comandi

Disponibili dal completamento della Fase 0, quando `apps/web`, `services/worker` e
`supabase/` sono inizializzati (ROADMAP.md).

| Scopo | Comando |
|---|---|
| Dipendenze JS | `corepack enable && pnpm install` |
| Database locale | `supabase start` · `supabase db reset` (migrazioni + seed) · `supabase stop` |
| Nuova migrazione | `supabase migration new <nome_in_italiano>` |
| Test database | `supabase test db` |
| Tipi TypeScript dal DB | `supabase gen types typescript --local > apps/web/src/lib/database.types.ts` |
| App in sviluppo | `pnpm --filter web dev` |
| Controlli app | `pnpm --filter web lint` · `pnpm --filter web typecheck` · `pnpm --filter web test` |
| Test e2e | `pnpm --filter web test:e2e` |
| Build ed app native | `pnpm --filter web build && pnpm --filter web exec cap sync` |
| Worker (dipendenze) | `cd services/worker && uv sync` |
| Controlli worker | `uv run ruff check .` · `uv run ruff format --check .` · `uv run mypy src` · `uv run pytest` |
| Worker in Docker | `docker compose up --build worker` |
| Valutazione flyer (da `services/worker`) | `uv run python -m noxa_worker.flyer.valuta --golden tests/dati/flyer_golden` |
| Coerenza documentazione | `python3 scripts/verifica_documentazione.py` (già disponibile) |

## Regole di sicurezza dei minorenni — vincoli sempre validi

Queste regole valgono per **ogni** modifica, anche se la richiesta non le cita. Il dettaglio
e i motivi sono in SAFETY_PRIVACY.md. Se una richiesta le viola, **fermati e segnalalo**
invece di implementarla.

1. **Autorizzazione solo nel database.** Ogni nuova tabella ha RLS abilitata, policy per ogni
   operazione consentita e test pgTAP positivi e negativi per tutte le età del seed (14, 15,
   16, 17, 18, 20, 21, moderatore). Il controllo nel frontend non è mai sufficiente.
2. **Età calcolata nel database** con `private.eta_di(auth.uid())`; mai accettare età o
   fascia dal client. La data di nascita non è modificabile e non è visibile ad altri.
3. **Nessun adulto trova, vede o contatta un minorenne** che non sia già suo amico
   confermato: la ricerca è limitata alla propria fascia; le amicizie tra fasce diverse
   nascono solo con codice invito; nei gruppi vale l'invariante delle fasce (R-10…R-15).
4. **Amicizie solo con accettazione esplicita**; il blocco nasconde tutto in entrambe le
   direzioni.
5. **Eventi**: visibili solo se età ≥ `eta_minima`; età sconosciuta = 18; tra fonti
   discordanti vale il massimo; eventi con `riferimenti_alcol` invisibili ai minorenni.
6. **Posizione**: check-in e ritorno sicuro disattivati di default, visibili solo ad amici
   confermati scelti, a scadenza, cancellati dopo 24 ore; nessun indirizzo di casa sul
   server; nessuna posizione salvata per la ricerca degli eventi.
7. **Niente alcol per i minorenni**: nessuna categoria di spesa, badge, testo o evento legato
   all'alcol.
8. **Ogni contenuto caricato è segnalabile e moderabile**; i flyer sono pubblicati solo dopo
   una revisione umana.
9. **Nessuna pubblicità, nessun tracciamento di terze parti, dati minimi**; nessun nuovo
   dato personale senza aggiornare SAFETY_PRIVACY.md (tabella di conservazione compresa).
10. **Niente chat libera** e niente funzioni fuori perimetro (PRD §6) senza un ADR.
11. La chiave `service_role` non va mai nel codice dell'app né in variabili `NEXT_PUBLIC_*`.

## Regole per scraping e API esterne

- Solo fonti con `stato_conformita = 'consentita'`, verificate su robots.txt **e** termini
  d'uso (ADR-0008, skill `add-event-source`).
- Ogni richiesta HTTP del worker passa da `ClientHttpConforme`: user agent `NoxaBot`,
  robots.txt, 1 richiesta ogni 5 secondi per dominio, massimo 50 pagine per esecuzione,
  stop su 403 e 429. Vietati login, aggiramento di CAPTCHA o paywall, rotazione di IP.
- Si salvano solo i campi di `packages/schemas/evento.schema.json`; nessun dato personale;
  nessuna immagine ripubblicata; link alla fonte sempre presente.
- **Instagram solo con l'API Graph ufficiale (Business Discovery). Mai scraping.**
- Google Places: si conserva solo il `place_id`.
- Claude API: SDK ufficiale `anthropic`, `client.messages.parse()` con schema Pydantic,
  modello da `CLAUDE_MODELLO_FLYER`, nessun dato dell'utente nella richiesta, gestione di
  `refusal`, prompt versionato (skill `flyer-parser`).
- I test non fanno richieste di rete reali: si usano fixture registrate.

## Convenzioni di codice

- **Lingua**: tutto in italiano, identificatori senza accenti (ADR-0010). `snake_case` in SQL
  e Python, `camelCase` per variabili e funzioni TS, `PascalCase` per tipi e componenti.
  Restano in inglese i nomi imposti dai framework.
- **TypeScript**: `strict`, `noUncheckedIndexedAccess`; niente `any` (usare `unknown` +
  Zod); tipi del DB solo da `database.types.ts` generato; errori convertiti in errori di
  dominio (`src/lib/errori.ts`); nessun `console.log` in produzione (logger + Sentry).
- **React**: componenti funzionali; dati con TanStack Query; stati di caricamento, vuoto,
  errore e offline sempre gestiti; solo token del design system, nessun valore di stile
  scritto a mano.
- **Python**: mypy strict, Ruff (lint e format), Pydantic per ogni dato in ingresso e uscita,
  eccezioni tipizzate, `structlog` con contesto (`job_id`, `fonte_id`), mai `print`; codice
  async con timeout espliciti.
- **SQL**: migrazioni piccole e idempotenti dove possibile; funzioni `security definer` solo
  in `private` (o RPC documentate in `public`) con `set search_path = ''` e nomi qualificati;
  policy separate per operazione e per ruolo; commento `-- R-xx` sulle policy che applicano
  una regola.
- **Accessibilità**: WCAG 2.2 AA (DESIGN.md §4); axe nei test e2e.
- **Git**: branch `feat/…`, `fix/…`, `docs/…`; commit in italiano all'imperativo
  ("aggiungi policy per …"); PR piccole con l'esito di `safety-review` nella descrizione.

## Skill del progetto

| Skill | Quando usarla |
|---|---|
| `iterazione` | `/iterazione <0-14>` esegue un'iterazione completa della roadmap (ROADMAP.md §5); `/iterazione stato` mostra l'avanzamento. Si avvia solo su richiesta esplicita |
| `new-feature` | Qualsiasi nuova funzionalità o modifica di comportamento: flusso PRD → piano → implementazione → test → documenti |
| `db-migration` | Ogni modifica allo schema, alle policy, alle funzioni SQL o allo storage |
| `safety-review` | Obbligatoria prima di considerare completa qualsiasi funzionalità |
| `add-event-source` | Nuovo locale con fonte, nuovo adattatore, modifica di un adattatore |
| `flyer-parser` | Modifica del prompt, dello schema o del modello di estrazione dei flyer |
| `implement-design` | Implementazione di una schermata o di un componente da Claude Design |

## Standard di qualità

Una funzionalità è **completa** solo se soddisfa la definizione di completato di
ROADMAP.md §6: documenti aggiornati, migrazioni con RLS e test, codice tipizzato con
gestione degli errori e logging, test unitari ed e2e verdi, accessibilità verificata,
**`safety-review` superata**, revisione del codice approvata. Non si lasciano `TODO`,
codice commentato o segnaposto nel codice e nei documenti: un lavoro rimandato diventa una
voce nella roadmap o in DECISIONI_APERTE.md.

## Come aggiornare la documentazione

- Funzionalità: PRD (sezione §4 e matrice §7) → ARCHITECTURE → DATA_MODEL → ROADMAP, nella
  stessa PR del codice (skill `new-feature`).
- Regole di sicurezza: si modificano solo con un ADR; aggiornare SAFETY_PRIVACY.md,
  DATA_MODEL.md, i test pgTAP e questo file se la regola è tra i vincoli sopra.
- Decisioni tecniche importanti: nuovo ADR da `docs/decisions/0000-modello-adr.md` e riga
  nell'indice `docs/decisions/README.md`.
- Decisioni non ancora prese: solo in `docs/DECISIONI_APERTE.md`.
- Schema evento: `packages/schemas/evento.schema.json` + EVENT_INGESTION.md §3.3 + modelli
  Pydantic e tipi TS nella stessa PR.
- Dopo ogni modifica ai documenti eseguire `python3 scripts/verifica_documentazione.py`
  (segnaposto, riferimenti `F-xx`/`R-xx`/`D-xx`/ADR, tabelle con policy e funzionalità,
  funzioni `private.*` documentate) e controllare a mano che nomi di tabelle e colonne siano
  coerenti (`grep -rn "<nome>" docs CLAUDE.md .claude`). Lo script gira anche in CI.
