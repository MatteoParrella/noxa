# Noxa

Noxa è l'app per chi ha tra i 14 e i 25 anni ed esce la sera a Milano e in Brianza.
Accompagna tutta la serata:

- **Scopri**: eventi su elenco e mappa, filtrati per data, distanza, genere ed età, con in
  evidenza quelli a cui vanno i tuoi amici.
- **Organizza**: gruppi di amici, serate di gruppo con conferme, prevendite e liste, chi
  guida e come si torna.
- **Vivi**: check-in "sono qui" per i soli amici scelti e ritorno sicuro con posizione
  condivisa finché non arrivi a casa.
- **Ricorda**: tracker personale delle serate, badge e riepilogo annuale condivisibile.

La sicurezza dei minorenni è un requisito del prodotto, applicato nel database con Row Level
Security: vedi [docs/SAFETY_PRIVACY.md](docs/SAFETY_PRIVACY.md).

> **Stato**: progettazione completata, sviluppo non ancora iniziato. Il prossimo passo è la
> Fase 0 di [docs/ROADMAP.md](docs/ROADMAP.md), che inizializza `apps/web`,
> `services/worker` e `supabase/`. Fino ad allora i comandi qui sotto non funzionano.

## Architettura in breve

| Componente | Tecnologia | Cartella |
|---|---|---|
| App (PWA, iOS, Android) | Next.js export statico, TypeScript, Tailwind, Capacitor, MapLibre | `apps/web` |
| Backend | Supabase UE: Postgres + PostGIS, RLS, Auth, Storage, Realtime, Edge Functions, `pg_cron` | `supabase` |
| Worker | Python, FastAPI, Playwright, rapidfuzz, Claude API, Docker | `services/worker` |
| Contratti condivisi | JSON Schema | `packages/schemas` |
| Design | Claude Design | `design` |

Dettagli in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Documentazione

| File | Contenuto |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Regole di lavoro, convenzioni, vincoli di sicurezza, comandi |
| [docs/PRD.md](docs/PRD.md) | Requisiti di prodotto |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architettura e flussi |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Modello dati e policy RLS |
| [docs/EVENT_INGESTION.md](docs/EVENT_INGESTION.md) | Raccolta degli eventi |
| [docs/SAFETY_PRIVACY.md](docs/SAFETY_PRIVACY.md) | Sicurezza dei minorenni e privacy |
| [docs/GUIDA_OPERATIVA.md](docs/GUIDA_OPERATIVA.md) | **Da leggere per primo**: come lavorare con Claude Code, iterazioni e Claude Design |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fasi, iterazioni e criteri di completamento |
| [docs/REGISTRO_ITERAZIONI.md](docs/REGISTRO_ITERAZIONI.md) | Avanzamento delle iterazioni |
| [docs/DESIGN.md](docs/DESIGN.md) | Design system e accessibilità |
| [docs/DECISIONI_APERTE.md](docs/DECISIONI_APERTE.md) | Decisioni ancora da prendere |
| [docs/decisions/](docs/decisions/) | ADR |

## Requisiti per lo sviluppo

Sviluppo su Windows con WSL 2 (Ubuntu) oppure su Linux o macOS.

| Strumento | Versione |
|---|---|
| WSL 2 + Ubuntu | 22.04 o successiva |
| Docker Desktop (integrazione WSL attiva) o Docker Engine | 24 o successiva |
| Node.js | 22 LTS (fissata in `.nvmrc`) |
| pnpm | tramite Corepack, versione fissata in `package.json` |
| Python | 3.12 (fissata in `services/worker/.python-version`) |
| uv | ultima versione stabile |
| Supabase CLI | ultima versione stabile |
| Android Studio / Xcode | solo per le build native (Xcode richiede macOS) |

Su WSL clona il repository nel filesystem Linux (per esempio `~/progetti/noxa`), non in
`/mnt/c/...`: il file watching e le prestazioni sono molto migliori (ADR-0015).

## Avvio in locale

```bash
# 1. Variabili d'ambiente
cp .env.example .env            # compila i valori: vedi i commenti nel file

# 2. Database locale (Postgres, Auth, Storage, Realtime in container gestiti dalla CLI)
supabase start
supabase db reset               # applica migrazioni e seed con gli utenti di test

# 3. App
corepack enable
pnpm install
supabase gen types typescript --local > apps/web/src/lib/database.types.ts
pnpm --filter web dev           # http://localhost:3000

# 4. Worker
docker compose up --build worker   # http://localhost:8000/salute
```

Il worker in Docker raggiunge il database e le API di Supabase della CLI tramite
`host.docker.internal` (vedi `docker-compose.yml`).

Utenti di test (solo in locale, creati da `supabase/seed.sql`): `minore_14`, `minore_15`,
`minore_16`, `minore_17`, `adulto_18`, `adulto_20`, `adulto_21`, `moderatore`,
`moderatore_senza_mfa`, con email
`<nome>@test.noxa.local`. La password è indicata in `supabase/seed.sql`.

## Test

```bash
python3 scripts/verifica_documentazione.py   # coerenza della documentazione (già disponibile)
supabase test db                    # policy RLS e regole di sicurezza (pgTAP)
pnpm --filter web test              # unitari app
pnpm --filter web test:e2e          # percorsi end-to-end con verifica di accessibilità
cd services/worker && uv run pytest # worker, adattatori, deduplicazione
```

## App native

```bash
pnpm --filter web build                 # export statico in apps/web/out
pnpm --filter web exec cap sync         # copia l'export nei progetti iOS e Android
pnpm --filter web exec cap open android # oppure ios (solo macOS)
```

## Mappe

Mappe gratuite con la basemap Protomaps auto-ospitata (ADR-0016). Il file dell'area si
estrae dalla build mondiale di Protomaps con la CLI `pmtiles`:

```bash
pmtiles extract https://build.protomaps.com/<AAAAMMGG>.pmtiles milano-brianza.pmtiles \
  --bbox=8.65,45.15,9.60,45.80
```

Poi si carica il file nel bucket `mappe`, insieme a font e icone di Protomaps
(`basemaps-assets`) in `mappe/assets/`. L'aggiornamento è trimestrale.

## Contribuire

1. Leggi [CLAUDE.md](CLAUDE.md).
2. Lo sviluppo procede per iterazioni: `/iterazione <numero>` (docs/GUIDA_OPERATIVA.md).
   Per le funzionalità fuori dalle iterazioni segui la skill `new-feature` (`.claude/skills/new-feature/SKILL.md`).
3. Nessuna PR viene unita senza CI verde ed esito di `safety-review` nella descrizione.
