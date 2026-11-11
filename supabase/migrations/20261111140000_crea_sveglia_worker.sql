-- Migrazione: sveglia del worker da pg_cron (ADR-0031, che modifica ADR-0021)
-- Documentazione: docs/DATA_MODEL.md §8 (job pianificati), docs/ARCHITECTURE.md §6
--
-- Il trigger `schedule` di GitHub Actions non è puntuale: con il carico di GitHub un workflow
-- "ogni 15 minuti" parte anche ogni 5-6 ore. pg_cron, che è già l'unico scheduler (ADR-0003),
-- avvia il workflow worker.yml con l'API workflow_dispatch di GitHub solo quando in coda ci
-- sono job pronti e nessun esecutore li sta già lavorando. La richiesta contiene solo il
-- branch e il nome dell'ambiente: nessun dato degli utenti esce dal database.

create or replace function private.sveglia_worker()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
  repository text;
  ambiente text;
begin
  -- Niente da fare: nessun job pronto.
  if not exists (
    select 1 from public.coda_job j
    where j.stato = 'in_coda' and j.esegui_dopo <= now()
  ) then
    return null;
  end if;
  -- Un esecutore è già al lavoro (blocco non scaduto): finirà lui la coda.
  if exists (
    select 1 from public.coda_job j
    where j.stato = 'in_esecuzione' and j.bloccato_fino > now()
  ) then
    return null;
  end if;

  select s.decrypted_secret into token from vault.decrypted_secrets s
  where s.name = 'github_worker_token';
  select s.decrypted_secret into repository from vault.decrypted_secrets s
  where s.name = 'github_worker_repository';
  select s.decrypted_secret into ambiente from vault.decrypted_secrets s
  where s.name = 'github_worker_ambiente';
  -- In locale e finché lo script non ha scritto i segreti la sveglia resta spenta.
  if token is null or repository is null or ambiente is null then
    return null;
  end if;

  return net.http_post(
    url := 'https://api.github.com/repos/' || repository || '/actions/workflows/worker.yml/dispatches',
    body := jsonb_build_object('ref', 'main', 'inputs', jsonb_build_object('ambiente', ambiente)),
    headers := jsonb_build_object(
      'Accept', 'application/vnd.github+json',
      'Authorization', 'Bearer ' || token,
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'NoxaBot',
      'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
end;
$$;

comment on function private.sveglia_worker() is
  'ADR-0031: avvia worker.yml con workflow_dispatch se ci sono job pronti e nessun esecutore attivo.';

revoke all on function private.sveglia_worker() from public;

select cron.schedule('sveglia-worker', '*/15 * * * *', $$select private.sveglia_worker()$$);
