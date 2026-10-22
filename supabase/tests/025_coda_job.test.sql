-- coda_job: nessun accesso per gli utenti, idempotenza e un job per dominio (DATA_MODEL.md
-- §5.7; ADR-0003). Conservazione dei dati della raccolta (SAFETY_PRIVACY.md §10).
begin;
select plan(13);

-- I dati di esempio della raccolta nel seed non entrano nei conteggi dei test (rollback finale).
update public.eventi_fonti set fonte_id = null where fonte_id is not null;
delete from public.eventi_grezzi;
delete from public.esecuzioni_fonte;
delete from public.fonti;
delete from public.candidati_locali;

select tests.autentica_come('minore_14');
select throws_ok($$ select 1 from public.coda_job $$, '42501', null, 'Chi ha 14 anni non legge la coda');
select tests.autentica_come('adulto_21');
select throws_ok($$ select 1 from public.coda_job $$, '42501', null, 'Chi ha 21 anni non legge la coda');
select throws_ok(
  $$ insert into public.coda_job (tipo, chiave_idempotenza) values ('esegui_fonte', 'x') $$,
  '42501', null,
  'Un utente non inserisce job'
);
select tests.autentica_come('moderatore');
select throws_ok($$ select 1 from public.coda_job $$, '42501', null,
                 'Anche i moderatori passano dalle RPC, non dalla coda');

select tests.esci();
grant noxa_worker to postgres;
set local role noxa_worker;
select lives_ok(
  $$ insert into public.coda_job (tipo, payload, chiave_idempotenza, chiave_concorrenza)
     values ('esegui_fonte', '{"fonte_id": "a"}', 'esegui_fonte:a', 'dominio:uno.example'),
            ('esegui_fonte', '{"fonte_id": "b"}', 'esegui_fonte:b', 'dominio:uno.example') $$,
  'Il worker inserisce job'
);
select throws_ok(
  $$ insert into public.coda_job (tipo, chiave_idempotenza) values ('esegui_fonte', 'esegui_fonte:a') $$,
  '23505', null,
  'Un solo job non concluso per chiave di idempotenza'
);
select lives_ok(
  $$ update public.coda_job set stato = 'in_esecuzione', bloccato_fino = now() + interval '10 minutes'
     where chiave_idempotenza = 'esegui_fonte:a' $$,
  'Il worker prende un job con il lease'
);
select throws_ok(
  $$ update public.coda_job set stato = 'in_esecuzione', bloccato_fino = now() + interval '10 minutes'
     where chiave_idempotenza = 'esegui_fonte:b' $$,
  '23505', null,
  'EVENT_INGESTION §2.4: un solo job in esecuzione per dominio'
);
select lives_ok(
  $$ update public.coda_job set stato = 'completato', completato_il = now() - interval '15 days'
     where chiave_idempotenza = 'esegui_fonte:a' $$,
  'Il worker completa il job'
);
select lives_ok(
  $$ insert into public.coda_job (tipo, chiave_idempotenza) values ('esegui_fonte', 'esegui_fonte:a') $$,
  'Dopo il completamento la stessa chiave si può accodare di nuovo'
);
select throws_ok($$ delete from public.coda_job $$, '42501', null, 'Il worker non elimina i job');
reset role;

-- Conservazione: job conclusi da più di 14 giorni, grezzi da più di 30.
insert into public.caricamenti_flyer (id, utente_id, storage_path)
values ('00000000-0000-4000-8000-0000000c0001', tests.id('adulto_20'),
        tests.id('adulto_20') || '/00000000-0000-4000-8000-0000000c0001.jpg'),
       ('00000000-0000-4000-8000-0000000c0002', tests.id('adulto_20'),
        tests.id('adulto_20') || '/00000000-0000-4000-8000-0000000c0002.jpg');
insert into public.eventi_grezzi (fonte_id, caricamento_flyer_id, payload, hash_contenuto, stato, creato_il)
values (null, '00000000-0000-4000-8000-0000000c0001', '{}', repeat('e', 64), 'errore', now() - interval '31 days'),
       (null, '00000000-0000-4000-8000-0000000c0002', '{}', repeat('f', 64), 'errore', now() - interval '29 days');
select private.applica_conservazione();
select is(
  (select count(*)::int from public.coda_job where chiave_idempotenza = 'esegui_fonte:a'),
  1,
  'I job conclusi da più di 14 giorni si eliminano'
);
select is(
  (select count(*)::int from public.eventi_grezzi where hash_contenuto in (repeat('e', 64), repeat('f', 64))),
  1,
  'I grezzi più vecchi di 30 giorni si eliminano'
);

select * from finish();
rollback;
