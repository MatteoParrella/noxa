-- Sveglia del worker da pg_cron con workflow_dispatch di GitHub (ADR-0031).
begin;
select plan(12);

select ok(exists (select 1 from cron.job where jobname = 'sveglia-worker' and schedule = '*/15 * * * *'),
          'pg_cron sveglia il worker ogni 15 minuti');

-- Nessun utente dell'app può chiamare la funzione (né leggere i segreti che usa).
select ok(not has_function_privilege('authenticated', 'private.sveglia_worker()', 'execute'),
          'authenticated non esegue sveglia_worker');
select ok(not has_function_privilege('anon', 'private.sveglia_worker()', 'execute'),
          'anon non esegue sveglia_worker');
select ok(not has_function_privilege('noxa_worker', 'private.sveglia_worker()', 'execute'),
          'noxa_worker non esegue sveglia_worker');

-- Stato di partenza: coda vuota per questo test.
delete from public.coda_job;
create temporary table richieste_prima as select count(*) as n from net.http_request_queue;

select is(private.sveglia_worker(), null, 'Coda vuota: nessuna sveglia');

insert into public.coda_job (tipo, payload, chiave_idempotenza)
values ('esegui_fonte', '{}', 'prova:pronto');
select is(private.sveglia_worker(), null, 'Senza segreti nel Vault la sveglia resta spenta');
select is((select count(*) from net.http_request_queue), (select n from richieste_prima),
          'Senza segreti nessuna richiesta parte');

select vault.create_secret('token-di-prova', 'github_worker_token');
select vault.create_secret('MatteoParrella/noxa', 'github_worker_repository');
select vault.create_secret('staging', 'github_worker_ambiente');

-- Job programmato nel futuro: non è ancora pronto.
update public.coda_job set esegui_dopo = now() + interval '1 hour';
select is(private.sveglia_worker(), null, 'Un job non ancora pronto non sveglia il worker');
update public.coda_job set esegui_dopo = now();

-- Un esecutore già al lavoro finisce la coda da solo.
insert into public.coda_job (tipo, payload, chiave_idempotenza, stato, bloccato_fino)
values ('esegui_fonte', '{}', 'prova:in-corso', 'in_esecuzione', now() + interval '5 minutes');
select is(private.sveglia_worker(), null, 'Con un esecutore attivo nessuna sveglia');

-- Blocco scaduto: l'esecutore è morto, serve una nuova esecuzione.
update public.coda_job set bloccato_fino = now() - interval '1 minute' where chiave_idempotenza = 'prova:in-corso';
select isnt(private.sveglia_worker(), null, 'Con job pronti e nessun esecutore attivo parte la sveglia');
select is((select url from net.http_request_queue order by id desc limit 1),
          'https://api.github.com/repos/MatteoParrella/noxa/actions/workflows/worker.yml/dispatches',
          'La richiesta va all''API workflow_dispatch di worker.yml');
select is((select convert_from(body, 'UTF8')::jsonb from net.http_request_queue order by id desc limit 1),
          '{"ref": "main", "inputs": {"ambiente": "staging"}}'::jsonb,
          'La richiesta contiene solo branch e ambiente');

select * from finish();
rollback;
