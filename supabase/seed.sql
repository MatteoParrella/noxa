-- Dati solo per lo sviluppo locale: `supabase db reset` applica le migrazioni e poi questo
-- file. Non viene mai eseguito in staging o produzione.

-- Password locale del ruolo del worker, la stessa di WORKER_DB_PASSWORD_LOCALE in
-- .env.example (DATA_MODEL.md §1).
alter role noxa_worker with password 'sviluppo-locale';
