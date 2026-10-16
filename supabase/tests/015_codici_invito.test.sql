-- codici_invito e amicizie tra fasce diverse (DATA_MODEL.md §5.2, §5.10). Regole: R-12, R-13,
-- R-14, R-17.
begin;
select plan(32);

-- ---------------------------------------------------------------------------------------------
-- Creazione (R-12, R-14)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_21');
create temporary table codice_adulto as select * from public.crea_codice_invito();
grant select on codice_adulto to authenticated;
select matches((select codice from codice_adulto), '^[A-HJKMNP-Z2-9]{10}$',
               'R-12: 10 caratteri casuali senza caratteri ambigui');
select ok((select scade_il between now() + interval '14 minutes' and now() + interval '15 minutes'
           from codice_adulto),
          'R-12: il codice vale 15 minuti');
select results_eq($$ select codice from public.codici_invito $$,
                  $$ select codice from codice_adulto $$,
                  'Il titolare vede i propri codici');
select tests.autentica_come('adulto_20');
select is_empty($$ select 1 from public.codici_invito $$, 'Nessuno vede i codici degli altri');
select throws_ok(
  $$ insert into public.codici_invito (codice, creato_da) values ('ABCDEFGHJK', tests.id('adulto_20')) $$,
  '42501', null,
  'I codici si creano solo con la RPC'
);

-- ---------------------------------------------------------------------------------------------
-- Anteprima (R-12)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select results_eq(
  $$ select stato, username, avviso_fasce from public.anteprima_codice_invito((select codice from codice_adulto)) $$,
  $$ values ('valido', 'adulto_21', true) $$,
  'R-12: un minorenne vede chi ha creato il codice e riceve l''avviso sulla persona maggiorenne'
);
select results_eq(
  $$ select stato from public.anteprima_codice_invito(
       lower(substr((select codice from codice_adulto), 1, 4)) || '-' ||
       substr((select codice from codice_adulto), 5)) $$,
  array['valido'],
  'Il codice scritto a mano si accetta in minuscolo e con i trattini'
);
select results_eq(
  $$ select stato, username from public.anteprima_codice_invito('ZZZZZZZZZZ') $$,
  $$ values ('non_valido', null::text) $$,
  'Un codice inesistente non dice nulla'
);
select tests.autentica_come('adulto_20');
select results_eq(
  $$ select avviso_fasce from public.anteprima_codice_invito((select codice from codice_adulto)) $$,
  array[false],
  'R-12: tra adulti nessun avviso'
);
select tests.autentica_come('adulto_21');
select results_eq(
  $$ select stato from public.anteprima_codice_invito((select codice from codice_adulto)) $$,
  array['non_valido'],
  'Il proprio codice non si usa'
);

-- Il blocco dà lo stesso esito di un codice inesistente (R-17)
select tests.esci();
insert into public.blocchi values (tests.id('adulto_21'), tests.id('minore_15'), now());
select tests.autentica_come('minore_15');
select results_eq(
  $$ select stato, username from public.anteprima_codice_invito((select codice from codice_adulto)) $$,
  $$ values ('non_valido', null::text) $$,
  'R-17: chi è bloccato vede "non valido" e nessuna identità'
);
select throws_ok($$ select public.usa_codice_invito((select codice from codice_adulto)) $$,
                 'NX011', null, 'R-17: chi è bloccato non usa il codice');

-- ---------------------------------------------------------------------------------------------
-- Uso del codice (R-12): richiesta verso il titolare, che deve accettarla
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select lives_ok($$ select public.usa_codice_invito((select codice from codice_adulto)) $$,
                'R-12: un minorenne usa il codice di un adulto');
select results_eq(
  $$ select richiedente_id, destinatario_id, stato::text, canale::text from public.amicizie
     where destinatario_id = tests.id('adulto_21') $$,
  $$ values (tests.id('minore_14'), tests.id('adulto_21'), 'in_attesa', 'codice_invito') $$,
  'R-12: nasce una richiesta in attesa verso il titolare del codice'
);
select results_eq(
  $$ select stato from public.anteprima_codice_invito((select codice from codice_adulto)) $$,
  array['in_attesa'],
  'Dopo l''uso l''anteprima dice che la richiesta c''è già'
);
select isnt_empty($$ select 1 from public.profili where id = tests.id('adulto_21') $$,
                  'R-13: con la richiesta da codice in attesa il minorenne vede il profilo');
select tests.autentica_come('minore_16');
select throws_ok($$ select public.usa_codice_invito((select codice from codice_adulto)) $$,
                 'NX013', null, 'R-12: il codice è monouso');
select results_eq(
  $$ select stato, username from public.anteprima_codice_invito((select codice from codice_adulto)) $$,
  $$ values ('usato', null::text) $$,
  'Un codice usato non mostra più l''identità del titolare'
);

-- Il titolare adulto vede la richiesta del minorenne e la accetta
select tests.autentica_come('adulto_21');
select isnt_empty($$ select 1 from public.profili where id = tests.id('minore_14') $$,
                  'R-13: l''adulto vede il minorenne solo per decidere sulla richiesta');
select is(public.avviso_richiesta((select id from public.amicizie where richiedente_id = tests.id('minore_14'))),
          false, 'R-12: nessun avviso a un destinatario adulto');
select isnt_empty(
  $$ update public.amicizie set stato = 'accettata'
     where richiedente_id = tests.id('minore_14') and destinatario_id = tests.id('adulto_21') returning 1 $$,
  'R-11: il titolare del codice accetta'
);
select ok(private.sono_amici(tests.id('minore_14'), tests.id('adulto_21')),
          'R-12: amicizia tra fasce diverse nata dal codice');

-- Un adulto usa il codice di un minorenne: il minorenne riceve l'avviso prima di accettare
select tests.autentica_come('minore_16');
create temporary table codice_minore as select * from public.crea_codice_invito();
grant select on codice_minore to authenticated;
select tests.autentica_come('adulto_20');
select results_eq(
  $$ select stato, avviso_fasce from public.anteprima_codice_invito((select codice from codice_minore)) $$,
  $$ values ('valido', false) $$,
  'R-12: l''avviso in anteprima è solo per i minorenni'
);
select lives_ok($$ select public.usa_codice_invito((select codice from codice_minore)) $$,
                'R-12: un adulto usa il codice ricevuto di persona da un minorenne');
select is(public.avviso_richiesta((select id from public.amicizie where richiedente_id = tests.id('adulto_20') and destinatario_id = tests.id('minore_16'))),
          false, 'L''avviso si chiede solo come destinatario');
select tests.autentica_come('minore_16');
select is(public.avviso_richiesta((select id from public.amicizie where richiedente_id = tests.id('adulto_20') and destinatario_id = tests.id('minore_16'))),
          true, 'R-12: il minorenne vede l''avviso prima di accettare la richiesta di un adulto');

-- Codici scaduti, già amici, limiti
select tests.esci();
update public.codici_invito set scade_il = now() - interval '1 minute' where creato_da = tests.id('minore_16');
insert into public.codici_invito (codice, creato_da) values ('MMMMMMMMMM', tests.id('minore_17'));
update public.codici_invito set scade_il = now() - interval '1 minute' where codice = 'MMMMMMMMMM';
insert into public.codici_invito (codice, creato_da) values ('NNNNNNNNNN', tests.id('minore_16'));
select tests.autentica_come('minore_14');
select results_eq($$ select stato from public.anteprima_codice_invito('MMMMMMMMMM') $$,
                  array['scaduto'], 'Un codice scaduto si riconosce');
select throws_ok($$ select public.usa_codice_invito('MMMMMMMMMM') $$, 'NX012', null,
                 'R-12: un codice scaduto non si usa');
select tests.autentica_come('minore_15');
select throws_ok($$ select public.usa_codice_invito('NNNNNNNNNN') $$, 'NX014', null,
                 'Chi è già amico non usa il codice');

select tests.esci();
insert into public.codici_invito (codice, creato_da, creato_il)
select private.nuovo_codice_invito(), tests.id('adulto_18'), now() from generate_series(1, 10);
select tests.autentica_come('adulto_18');
select throws_ok($$ select public.crea_codice_invito() $$, 'NX010', null,
                 'R-14: al massimo 10 codici ogni 24 ore');

-- Conservazione e accesso anonimo
select tests.esci();
update public.codici_invito set scade_il = now() - interval '25 hours' where codice = 'MMMMMMMMMM';
select is(private.elimina_codici_invito_scaduti(), 1,
          'SAFETY_PRIVACY §10: i codici spariscono 24 ore dopo la scadenza');
set local role anon;
select throws_ok($$ select public.crea_codice_invito() $$, '42501', null,
                 'R-07: anon non crea codici');
reset role;

select * from finish();
rollback;
