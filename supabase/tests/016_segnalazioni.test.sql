-- segnalazioni e azioni_moderazione (DATA_MODEL.md §5.2). Regole: R-06, R-50, R-53, R-69.
begin;
select plan(27);

-- ---------------------------------------------------------------------------------------------
-- Inserimento (R-50) e priorità (R-53)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_16'), 'profilo', tests.id('minore_15'), 'molestie') $$,
  'R-50: si segnala il profilo di un amico'
);
select is((select priorita from public.segnalazioni where segnalante_id = tests.id('minore_16')),
          2::smallint, 'R-53: una segnalazione che coinvolge minorenni ha priorità 2');
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_16'), 'profilo', tests.id('adulto_21'), 'molestie') $$,
  '42501', null,
  'R-13: non si segnala un profilo che non si può vedere'
);
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_16'), 'profilo', tests.id('minore_16'), 'altro') $$,
  '42501', null,
  'Non si segnala sé stessi'
);
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_15'), 'profilo', tests.id('minore_16'), 'altro') $$,
  '42501', null,
  'Non si segnala a nome di altri'
);
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_16'), 'evento', gen_random_uuid(), 'evento_falso') $$,
  '42501', null,
  'Gli altri tipi di oggetto arrivano con le loro tabelle'
);
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo, dettagli)
     values (tests.id('minore_16'), 'profilo', tests.id('minore_15'), 'altro', repeat('a', 1001)) $$,
  '23514', null,
  'I dettagli hanno al massimo 1000 caratteri'
);
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo, priorita)
     values (tests.id('minore_16'), 'profilo', tests.id('minore_15'), 'altro', 1) $$,
  '42501', null,
  'R-53: la priorità la decide il database'
);

select tests.autentica_come('adulto_20');
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('adulto_20'), 'profilo', tests.id('adulto_21'), 'spam') $$,
  'Un adulto segnala un amico adulto'
);
select is((select priorita from public.segnalazioni where motivo = 'spam'), 3::smallint,
          'R-53: tra adulti priorità 3');

select tests.autentica_come('adulto_18');
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('adulto_18'), 'profilo', tests.id('minore_17'), 'adescamento_o_rischio_minore') $$,
  'Si segnala un rischio per un minorenne'
);
select is((select priorita from public.segnalazioni where motivo = 'adescamento_o_rischio_minore'),
          1::smallint, 'R-53: adescamento o rischio per un minorenne ha priorità 1');

-- Si segnala anche chi si è bloccato
select tests.esci();
insert into public.blocchi values (tests.id('adulto_21'), tests.id('adulto_20'), now());
select tests.autentica_come('adulto_21');
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('adulto_21'), 'profilo', tests.id('adulto_20'), 'molestie') $$,
  'R-50: si segnala la persona appena bloccata'
);

-- Limite di frequenza
select tests.esci();
set local session_replication_role = replica;
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
select tests.id('minore_15'), 'profilo', tests.id('minore_16'), 'altro' from generate_series(1, 20);
set local session_replication_role = origin;
select tests.autentica_come('minore_15');
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_15'), 'profilo', tests.id('minore_16'), 'altro') $$,
  'NX015', null,
  'Al massimo 20 segnalazioni ogni 24 ore'
);

-- ---------------------------------------------------------------------------------------------
-- Visibilità (R-69) e gestione dei moderatori (R-06)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select is((select count(*) from public.segnalazioni), 1::bigint,
          'Chi segnala vede solo le proprie segnalazioni');
select tests.autentica_come('minore_17');
select is_empty($$ select 1 from public.segnalazioni $$,
                'R-50: chi è segnalato non vede la segnalazione');
select tests.autentica_come('moderatore_senza_mfa');
select is_empty($$ select 1 from public.segnalazioni $$,
                'R-06: senza due fattori un moderatore non vede la coda');
select tests.autentica_come('moderatore');
select ok((select count(*) from public.segnalazioni) >= 4, 'Il moderatore con aal2 vede la coda');
select isnt_empty(
  $$ update public.segnalazioni set stato = 'in_lavorazione', gestita_da = tests.id('moderatore')
     where motivo = 'molestie' and segnalante_id = tests.id('minore_16') returning 1 $$,
  'Il moderatore prende in carico una segnalazione'
);
select lives_ok(
  $$ insert into public.azioni_moderazione (moderatore_id, segnalazione_id, tipo_oggetto, oggetto_id, azione, motivazione)
     select tests.id('moderatore'), id, tipo_oggetto, oggetto_id, 'nessuna_violazione',
            'Abbiamo controllato il profilo: non viola i Termini.'
     from public.segnalazioni where segnalante_id = tests.id('minore_16') $$,
  'Il moderatore registra una decisione motivata'
);
select throws_ok(
  $$ insert into public.azioni_moderazione (moderatore_id, tipo_oggetto, oggetto_id, azione)
     values (tests.id('moderatore'), 'profilo', tests.id('minore_15'), 'rimuovi_contenuto') $$,
  '23514', null,
  'DSA art. 17: ogni decisione ha una motivazione'
);
select throws_ok(
  $$ delete from public.azioni_moderazione $$,
  '42501', null,
  'Il registro della moderazione non si cancella'
);

select tests.autentica_come('minore_16');
select is_empty(
  $$ update public.segnalazioni set stato = 'chiusa' returning 1 $$,
  'Chi segnala non cambia lo stato'
);
select is_empty($$ select 1 from public.azioni_moderazione $$,
                'R-69: gli utenti non leggono il registro della moderazione');
select results_eq(
  $$ select descrizione, stato::text, decisione from public.mie_segnalazioni() $$,
  $$ values ('@minore_15', 'in_lavorazione', 'Abbiamo controllato il profilo: non viola i Termini.') $$,
  'DSA art. 17: chi segnala vede stato e decisione motivata'
);
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok(
  $$ insert into public.azioni_moderazione (moderatore_id, tipo_oggetto, oggetto_id, azione, motivazione)
     values (tests.id('moderatore_senza_mfa'), 'profilo', tests.id('minore_15'), 'nessuna_violazione', 'x') $$,
  '42501', null,
  'R-06: senza due fattori nessuna azione di moderazione'
);

select tests.esci();
set local role anon;
select throws_ok($$ select 1 from public.segnalazioni $$, '42501', null,
                 'R-07: anon non legge le segnalazioni');
reset role;

select * from finish();
rollback;
