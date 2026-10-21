-- reclami (DATA_MODEL.md §5.2; DSA art. 20). Regole: R-06, R-53, R-69.
-- Amici del seed: 15-16, 20-21, 18-17 (codice invito).
begin;
select plan(30);

-- Letta senza la RLS: gli utenti non vedono il registro, ma il reclamo ne riceve l'id dalla
-- notifica o da mie_segnalazioni.
create function tests.azione(motivazione text) returns uuid language sql stable security definer
set search_path = '' as $$
  select a.id from public.azioni_moderazione a where a.motivazione = $1 limit 1;
$$;
grant execute on function tests.azione(text) to authenticated;
grant noxa_worker to postgres;

-- Decisioni di esempio: una segnalazione senza violazione decisa da "moderatore", una
-- sospensione decisa da "moderatore_senza_mfa" (scritta direttamente nel registro) e un
-- flyer rifiutato in automatico dal worker.
select tests.autentica_come('adulto_20');
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
values (tests.id('adulto_20'), 'profilo', tests.id('adulto_21'), 'spam');
select tests.autentica_come('moderatore');
select public.decidi_segnalazione(
  (select id from public.segnalazioni where motivo = 'spam'), 'nessuna_violazione', 'Nessuna violazione A.'
);
select tests.esci();

insert into public.segnalazioni (id, segnalante_id, tipo_oggetto, oggetto_id, motivo, stato, chiusa_il)
values ('00000000-0000-4000-8000-0000000d0001', tests.id('minore_15'), 'profilo', tests.id('minore_16'),
        'molestie', 'chiusa', now());
update public.profili set stato_account = 'sospeso' where id = tests.id('minore_16');
insert into public.azioni_moderazione (moderatore_id, segnalazione_id, tipo_oggetto, oggetto_id, azione, motivazione)
values (tests.id('moderatore_senza_mfa'), '00000000-0000-4000-8000-0000000d0001', 'profilo',
        tests.id('minore_16'), 'sospendi_account', 'Sospensione B.');

insert into public.caricamenti_flyer (id, utente_id, storage_path)
values ('00000000-0000-4000-8000-0000000c0100', tests.id('minore_14'),
        tests.id('minore_14')::text || '/00000000-0000-4000-8000-0000000c0100.jpg');
set local role noxa_worker;
update public.caricamenti_flyer set stato = 'rifiutato', motivo_rifiuto = 'Non è un flyer C.'
where id = '00000000-0000-4000-8000-0000000c0100';
reset role;

-- ---------------------------------------------------------------------------------------------
-- Presentazione (DSA art. 20)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_21');
select throws_ok(
  $$ select public.presenta_reclamo(tests.azione('Nessuna violazione A.'), 'Non sono d''accordo') $$,
  'NX030', null,
  'Chi non ha ricevuto la decisione non la reclama'
);
select tests.autentica_come('adulto_20');
select throws_ok(
  $$ select public.presenta_reclamo(tests.azione('Nessuna violazione A.'), '   ') $$,
  '22023', null,
  'Il reclamo spiega perché'
);
select throws_ok(
  $$ select public.presenta_reclamo(tests.azione('Nessuna violazione A.'), repeat('a', 1001)) $$,
  '22001', null,
  'Il reclamo ha al massimo 1000 caratteri'
);
select lives_ok(
  $$ select public.presenta_reclamo(tests.azione('Nessuna violazione A.'), 'Il profilo manda spam a tutti.') $$,
  'Chi ha segnalato presenta reclamo sulla decisione'
);
select throws_ok(
  $$ select public.presenta_reclamo(tests.azione('Nessuna violazione A.'), 'Di nuovo') $$,
  'NX029', null,
  'Un reclamo per decisione'
);
select is(
  (select reclamo_stato::text || ':' || reclabile from (
     select reclamo_stato, reclamabile::text as reclabile from public.mie_segnalazioni() where motivo = 'spam') x),
  'inviato:false',
  'Dopo l''invio lo stato si vede e il reclamo non si ripresenta'
);
select is((select count(*)::int from public.reclami), 1, 'Si vede il proprio reclamo');

select tests.autentica_come('minore_16');
select lives_ok(
  $$ select public.presenta_reclamo(tests.azione('Sospensione B.'), 'Non ho fatto niente.') $$,
  'La persona sospesa presenta reclamo'
);
select tests.autentica_come('minore_15');
select is_empty($$ select 1 from public.reclami $$, 'Non si vedono i reclami degli altri (15 anni)');
select throws_ok(
  $$ select public.presenta_reclamo(tests.azione('Non è un flyer C.'), 'Non è mio') $$,
  'NX030', null,
  'Non si reclama la decisione su un flyer altrui'
);
select tests.autentica_come('minore_14');
select is(
  (select reclamabile from public.miei_flyer() where stato = 'rifiutato'),
  true,
  'Il flyer rifiutato in automatico si può reclamare'
);
select lives_ok(
  $$ select public.presenta_reclamo(tests.azione('Decisione automatica: Non è un flyer C.'), 'È un flyer vero.') $$,
  'Chi ha caricato reclama il rifiuto automatico'
);

-- Termine di 6 mesi
select tests.esci();
insert into public.azioni_moderazione (moderatore_id, segnalazione_id, tipo_oggetto, oggetto_id, azione,
                                       motivazione, creata_il)
values (tests.id('moderatore_senza_mfa'), '00000000-0000-4000-8000-0000000d0001', 'profilo',
        tests.id('minore_16'), 'nessuna_violazione', 'Vecchia D.', now() - interval '7 months');
select tests.autentica_come('minore_15');
select throws_ok(
  $$ select public.presenta_reclamo(tests.azione('Vecchia D.'), 'Tardi') $$,
  'NX028', null,
  'DSA art. 20: il reclamo si presenta entro 6 mesi'
);

-- ---------------------------------------------------------------------------------------------
-- Coda e decisione: un moderatore diverso da chi ha deciso (R-06, DSA art. 20)
-- ---------------------------------------------------------------------------------------------
select throws_ok($$ select public.reclami_moderazione() $$, '42501', null,
                 'R-06: la coda dei reclami è dei moderatori');
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok(
  $$ select public.decidi_reclamo((select id from public.reclami limit 1), false, 'x') $$,
  '42501', null,
  'R-06: senza due fattori non si decide un reclamo'
);
select tests.autentica_come('moderatore');
select is_empty($$ select 1 from public.reclami $$, 'I moderatori leggono i reclami solo dalla coda');
select is((select count(*)::int from public.reclami_moderazione()), 3, 'La coda contiene i reclami');
select is(
  (select puo_decidere::text || ':' || ruolo from public.reclami_moderazione()
   where decisione_motivazione = 'Nessuna violazione A.'),
  'false:segnalante',
  'Chi ha preso la decisione non decide il reclamo'
);
select throws_ok(
  $$ select public.decidi_reclamo(
       (select id from public.reclami_moderazione() where decisione_motivazione = 'Nessuna violazione A.'),
       false, 'Confermo') $$,
  'NX031', null,
  'DSA art. 20: il reclamo lo decide un altro moderatore'
);
select lives_ok(
  $$ select public.esamina_reclamo(
       (select id from public.reclami_moderazione() where decisione_motivazione = 'Sospensione B.')) $$,
  'Un altro moderatore prende in esame il reclamo'
);
select is(
  (select stato::text from public.reclami_moderazione() where decisione_motivazione = 'Sospensione B.'),
  'in_esame',
  'Il reclamo risulta in esame'
);
select throws_ok(
  $$ select public.decidi_reclamo(
       (select id from public.reclami_moderazione() where decisione_motivazione = 'Sospensione B.'),
       true, '') $$,
  'NX021', null,
  'La decisione sul reclamo è motivata'
);
select lives_ok(
  $$ select public.decidi_reclamo(
       (select id from public.reclami_moderazione() where decisione_motivazione = 'Sospensione B.'),
       true, 'Le prove non bastano per una sospensione.') $$,
  'Il moderatore cambia la decisione'
);
select lives_ok(
  $$ select public.decidi_reclamo(
       (select id from public.reclami_moderazione() where decisione_motivazione like 'Decisione automatica%'),
       true, 'È un flyer: torna in revisione.') $$,
  'Il moderatore cambia il rifiuto automatico'
);
select throws_ok(
  $$ select public.decidi_reclamo(
       (select id from public.reclami_moderazione() where decisione_motivazione = 'Sospensione B.'),
       false, 'Di nuovo') $$,
  'NX025', null,
  'Un reclamo deciso non si decide di nuovo'
);
select tests.esci();
select is((select stato_account::text from public.profili where id = tests.id('minore_16')), 'attivo',
          'Cambiare la sospensione riattiva l''account');
select is(
  (select stato::text from public.caricamenti_flyer where id = '00000000-0000-4000-8000-0000000c0100'),
  'in_revisione',
  'Cambiare il rifiuto rimette il flyer in revisione'
);
select is(
  (select count(*)::int from public.notifiche
   where dati ->> 'esito' = 'reclamo_deciso' and utente_id in (tests.id('minore_16'), tests.id('minore_14'))),
  2,
  'DSA art. 20: chi ha presentato il reclamo riceve l''esito motivato'
);
select tests.autentica_come('minore_16');
select is(
  (select stato::text || ':' || esito || ':' || motivazione_esito from public.reclami),
  'deciso:cambiata:Le prove non bastano per una sospensione.',
  'Chi ha presentato il reclamo vede l''esito'
);
select throws_ok($$ select deciso_da from public.reclami $$, '42501', null,
                 'Chi ha presentato il reclamo non vede chi lo ha deciso');

select * from finish();
rollback;
