# ADR-0015: Monorepo con pnpm e uv

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
App web, worker, migrazioni e schema condiviso evolvono insieme: una modifica allo schema
evento tocca worker, database e app.

## Decisione
- Un solo repository con `apps/web` (pnpm workspace), `services/worker` (uv, `pyproject.toml`
  e `uv.lock`), `supabase/` (CLI Supabase), `packages/schemas` (JSON Schema condivisi).
- Versioni bloccate: Node in `.nvmrc`, pnpm tramite `packageManager` in `package.json`,
  Python in `.python-version`.
- Sviluppo su Windows con WSL (Ubuntu): il repository va tenuto nel filesystem Linux
  (`~/progetti/noxa`), non in `/mnt/c`, per prestazioni e file watching.

## Alternative considerate
- **Repository separati**: modifiche coordinate più difficili e contratti che divergono.
- **Turborepo/Nx**: utili con molti pacchetti; per ora gli script di pnpm bastano.

## Conseguenze
- La CI esegue i job solo per le cartelle modificate (filtri sui percorsi).
