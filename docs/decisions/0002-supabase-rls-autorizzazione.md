# ADR-0002: Supabase con Row Level Security come unico punto di autorizzazione

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Le regole sui minorenni devono valere qualunque client venga usato, compreso chi chiama
direttamente l'API. Servono anche autenticazione, storage, tempo reale e dati geografici.

## Decisione
- Supabase gestito (Postgres + PostGIS, Auth, Storage, Realtime, Edge Functions, `pg_cron`).
- Ogni regola di accesso è applicata con RLS, vincoli, trigger e funzioni SQL, testata con
  pgTAP. Il frontend non è mai considerato una protezione.
- Funzioni di supporto `security definer` nello schema non esposto `private`, con
  `search_path` vuoto.
- RLS abilitata su ogni tabella; un test fallisce se ne manca una.

## Alternative considerate
- **Backend applicativo proprio (NestJS, FastAPI) con ORM**: autorizzazione nel codice, più
  facile da aggirare per errore e più infrastruttura da mantenere.
- **Firebase**: regole di sicurezza meno espressive per relazioni complesse (amicizie,
  invariante dei gruppi) e nessun PostGIS.

## Conseguenze
- Le policy diventano codice critico: ogni migrazione segue la skill `db-migration`.
- Le prestazioni delle policy vanno curate (funzioni `stable`, indici, test di carico).
- Dipendenza da Supabase, mitigata dal fatto che è Postgres standard ed è disponibile anche
  in self-hosting.
