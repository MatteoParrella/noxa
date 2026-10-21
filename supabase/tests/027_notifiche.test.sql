-- notifiche (DATA_MODEL.md §5.1, §7). Regole: R-17, R-53, R-65.
-- Amici del seed: 15-16, 20-21, 18-17 (codice invito); richiesta in attesa 14 → 15.
begin;
select plan(19);

select ok(
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifiche'),
  'Le notifiche arrivano in tempo reale (Realtime)'
);

-- La richiesta del seed 14 → 15 ha creato la notifica per il destinatario.
select is(
  (select count(*)::int from public.notifiche
   where utente_id = tests.id('minore_15') and tipo = 'richiesta_amicizia'
     and dati ->> 'utente_id' = tests.id('minore_14')::text),
  1,
  'Una richiesta di amicizia crea la notifica per il destinatario'
);

-- ---------------------------------------------------------------------------------------------
-- Lettura e scrittura: solo il titolare, solo letta_il
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
select is((select count(*)::int from public.notifiche), 1, 'Il titolare vede le proprie notifiche');
select lives_ok(
  $$ update public.notifiche set letta_il = now() $$,
  'Il titolare segna le notifiche come lette'
);
select is((select count(*)::int from public.notifiche where letta_il is not null), 1,
          'La notifica risulta letta');
select throws_ok(
  $$ update public.notifiche set dati = '{}' $$,
  '42501', null,
  'Il titolare non cambia il contenuto di una notifica'
);
select throws_ok(
  $$ insert into public.notifiche (utente_id, tipo) values (tests.id('minore_15'), 'badge_ottenuto') $$,
  '42501', null,
  'Nessun utente crea notifiche'
);
select throws_ok(
  $$ delete from public.notifiche $$,
  '42501', null,
  'Le notifiche non si cancellano dall''app'
);

select tests.autentica_come('minore_14');
select is_empty($$ select 1 from public.notifiche where utente_id <> tests.id('minore_14') $$,
                'Non si vedono le notifiche degli altri (14 anni)');
select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.notifiche where utente_id <> tests.id('adulto_21') $$,
                'Non si vedono le notifiche degli altri (21 anni)');
select tests.autentica_come('moderatore');
select is_empty($$ select 1 from public.notifiche $$,
                'R-69: i moderatori non leggono le notifiche degli utenti');
select tests.esci();

-- ---------------------------------------------------------------------------------------------
-- Ciclo di vita delle notifiche delle amicizie
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
update public.amicizie set stato = 'accettata'
where richiedente_id = tests.id('minore_14') and destinatario_id = tests.id('minore_15');
select tests.esci();
select is(
  (select count(*)::int from public.notifiche
   where utente_id = tests.id('minore_14') and tipo = 'amicizia_accettata'
     and dati ->> 'utente_id' = tests.id('minore_15')::text),
  1,
  'Un''amicizia accettata crea la notifica per chi aveva chiesto'
);
select is(
  (select count(*)::int from public.notifiche
   where utente_id = tests.id('minore_15') and tipo = 'richiesta_amicizia'),
  0,
  'La richiesta accettata non resta tra le notifiche'
);

select tests.autentica_come('minore_14');
delete from public.amicizie
where least(richiedente_id, destinatario_id) = least(tests.id('minore_14'), tests.id('minore_15'))
  and greatest(richiedente_id, destinatario_id) = greatest(tests.id('minore_14'), tests.id('minore_15'));
select tests.esci();
select is(
  (select count(*)::int from public.notifiche
   where dati ->> 'utente_id' in (tests.id('minore_14')::text, tests.id('minore_15')::text)
     and tipo in ('richiesta_amicizia', 'amicizia_accettata')),
  0,
  'Un''amicizia rimossa porta via le sue notifiche'
);

-- R-17: dopo un blocco nessuna notifica collega le due persone.
select tests.autentica_come('adulto_20');
insert into public.amicizie (richiedente_id, destinatario_id, canale)
values (tests.id('adulto_20'), tests.id('adulto_18'), 'ricerca');
select tests.esci();
select is(
  (select count(*)::int from public.notifiche where utente_id = tests.id('adulto_18')
     and dati ->> 'utente_id' = tests.id('adulto_20')::text),
  1,
  'La nuova richiesta arriva a chi la riceve'
);
select tests.autentica_come('adulto_18');
insert into public.blocchi (bloccante_id, bloccato_id) values (tests.id('adulto_18'), tests.id('adulto_20'));
select tests.esci();
select is(
  (select count(*)::int from public.notifiche
   where (utente_id = tests.id('adulto_18') and dati ->> 'utente_id' = tests.id('adulto_20')::text)
      or (utente_id = tests.id('adulto_20') and dati ->> 'utente_id' = tests.id('adulto_18')::text)),
  0,
  'R-17: il blocco toglie le notifiche tra le due persone, in entrambe le direzioni'
);

-- ---------------------------------------------------------------------------------------------
-- Conservazione: 90 giorni (R-65)
-- ---------------------------------------------------------------------------------------------
insert into public.notifiche (utente_id, tipo, creata_il)
values (tests.id('adulto_21'), 'badge_ottenuto', now() - interval '91 days'),
       (tests.id('adulto_21'), 'badge_ottenuto', now() - interval '89 days');
select private.applica_conservazione();
select is(
  (select count(*)::int from public.notifiche
   where utente_id = tests.id('adulto_21') and tipo = 'badge_ottenuto'),
  1,
  'R-65: le notifiche più vecchie di 90 giorni si eliminano'
);
select throws_ok(
  $$ insert into public.notifiche (utente_id, tipo) values (tests.id('adulto_21'), 'messaggio_libero') $$,
  '23514', null,
  'Solo i tipi di notifica previsti'
);
select throws_ok(
  $$ insert into public.notifiche (utente_id, tipo, dati) values (tests.id('adulto_21'), 'badge_ottenuto', '[]') $$,
  '23514', null,
  'I dati di una notifica sono un oggetto'
);

select * from finish();
rollback;
