-- amicizie, ricerca degli utenti e blocchi (DATA_MODEL.md §5.2, §5.10).
-- Regole: R-10, R-11, R-12, R-13, R-14, R-17. Relazioni del seed: minore_15–minore_16 e
-- adulto_20–adulto_21 amici, adulto_18–minore_17 amici da codice, minore_14 → minore_15 in attesa.
begin;
select plan(48);

-- ---------------------------------------------------------------------------------------------
-- Ricerca (R-10): solo stessa fascia, almeno 3 caratteri, niente bloccati né sospesi
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select results_eq(
  $$ select username, relazione from public.cerca_utenti('min') order by username $$,
  $$ values ('minore_14', 'nessuna'), ('minore_15', 'amici'), ('minore_17', 'nessuna') $$,
  'R-10: minore_16 trova i minorenni (fascia unica 14–17, ADR-0017) con il rapporto'
);
select is_empty($$ select 1 from public.cerca_utenti('adu') $$,
                'R-10: un minorenne non trova adulti');
select is_empty($$ select 1 from public.cerca_utenti('mod') $$,
                'R-10: un minorenne non trova i moderatori adulti');
select is_empty($$ select 1 from public.cerca_utenti('mi') $$,
                'R-10: servono almeno 3 caratteri');
select is_empty($$ select 1 from public.cerca_utenti('%%%') $$,
                'R-10: nessun carattere jolly per elencare tutti');
select results_eq(
  $$ select username from public.cerca_utenti('@minore_1') order by username $$,
  array['minore_14', 'minore_15', 'minore_17'],
  'La ricerca toglie la @ e tratta il trattino basso come carattere, non come jolly'
);

select tests.autentica_come('minore_14');
select results_eq(
  $$ select relazione from public.cerca_utenti('minore_15') $$,
  array['inviata'],
  'Il rapporto "inviata" per la richiesta in attesa di chi cerca'
);
select is_empty($$ select 1 from public.cerca_utenti('adulto') $$,
                'R-10: minore_14 non trova adulti');

select tests.autentica_come('adulto_18');
select results_eq(
  $$ select username from public.cerca_utenti('adu') order by username $$,
  array['adulto_20', 'adulto_21'],
  'R-10: un adulto trova solo adulti'
);
select is_empty($$ select 1 from public.cerca_utenti('min') $$,
                'R-10: adulto_18 non trova minorenni, nemmeno l''amico minore_17');
select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.cerca_utenti('minore') $$,
                'R-10: adulto_21 non trova minorenni');

-- Bloccati e sospesi esclusi
select tests.esci();
insert into public.blocchi (bloccante_id, bloccato_id) values (tests.id('minore_14'), tests.id('minore_17'));
update public.profili set stato_account = 'sospeso' where id = tests.id('adulto_20');
select tests.autentica_come('minore_17');
select is_empty($$ select 1 from public.cerca_utenti('minore_14') $$,
                'R-17: chi è stato bloccato non trova chi l''ha bloccato');
select tests.autentica_come('minore_14');
select is_empty($$ select 1 from public.cerca_utenti('minore_17') $$,
                'R-17: chi blocca non trova il bloccato');
select tests.autentica_come('adulto_18');
select is_empty($$ select 1 from public.cerca_utenti('adulto_20') $$,
                'R-10: gli account sospesi non compaiono');
select tests.esci();
delete from public.blocchi where bloccante_id = tests.id('minore_14');
update public.profili set stato_account = 'attivo' where id = tests.id('adulto_20');

-- ---------------------------------------------------------------------------------------------
-- Richieste dalla ricerca (R-10, R-11, R-12)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select lives_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale)
     values (tests.id('minore_14'), tests.id('minore_16'), 'ricerca') $$,
  'R-11: un minorenne chiede l''amicizia a un minorenne'
);
select throws_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale)
     values (tests.id('minore_14'), tests.id('adulto_20'), 'ricerca') $$,
  '42501', null,
  'R-12: dalla ricerca non si chiede l''amicizia a un adulto'
);
select tests.autentica_come('adulto_18');
select throws_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale)
     values (tests.id('adulto_18'), tests.id('minore_14'), 'ricerca') $$,
  '42501', null,
  'R-12: un adulto non chiede l''amicizia a un minorenne senza codice'
);
select throws_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale)
     values (tests.id('adulto_18'), tests.id('minore_14'), 'codice_invito') $$,
  '42501', null,
  'R-12: il canale codice_invito si usa solo con la RPC'
);
select throws_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale)
     values (tests.id('adulto_21'), tests.id('moderatore'), 'ricerca') $$,
  '42501', null,
  'Non si inviano richieste a nome di altri'
);
select throws_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale, stato)
     values (tests.id('adulto_18'), tests.id('adulto_20'), 'ricerca', 'accettata') $$,
  '42501', null,
  'R-11: una richiesta non nasce già accettata'
);
select tests.autentica_come('minore_16');
select throws_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale)
     values (tests.id('minore_16'), tests.id('minore_14'), 'ricerca') $$,
  'NX014', null,
  'Una seconda richiesta tra le stesse persone è rifiutata'
);

-- Accettazione (R-11)
select tests.autentica_come('minore_14');
select is_empty(
  $$ update public.amicizie set stato = 'accettata'
     where destinatario_id = tests.id('minore_16') and richiedente_id = tests.id('minore_14')
     returning 1 $$,
  'R-11: chi chiede non accetta da solo'
);
select tests.autentica_come('minore_16');
select isnt_empty(
  $$ update public.amicizie set stato = 'accettata'
     where richiedente_id = tests.id('minore_14') and destinatario_id = tests.id('minore_16')
     returning 1 $$,
  'R-11: il destinatario accetta'
);
select ok(
  (select accettata_il is not null from public.amicizie
   where richiedente_id = tests.id('minore_14') and destinatario_id = tests.id('minore_16')),
  'La data di accettazione la imposta il database'
);
select ok(private.sono_amici(tests.id('minore_14'), tests.id('minore_16')), 'Ora sono amici');
select is_empty(
  $$ update public.amicizie set stato = 'in_attesa'
     where richiedente_id = tests.id('minore_14') and destinatario_id = tests.id('minore_16')
     returning 1 $$,
  'Un''amicizia accettata non torna in attesa'
);

-- Visibilità delle amicizie
select tests.autentica_come('adulto_21');
select is_empty(
  $$ select 1 from public.amicizie where tests.id('minore_14') in (richiedente_id, destinatario_id) $$,
  'R-13: un adulto non vede le amicizie dei minorenni'
);
select tests.autentica_come('minore_17');
select is((select count(*) from public.amicizie), 1::bigint,
          'Ognuno vede solo le proprie amicizie e richieste');

-- Rimozione
select tests.autentica_come('adulto_21');
select is_empty(
  $$ delete from public.amicizie where richiedente_id = tests.id('minore_14') returning 1 $$,
  'Un estraneo non rimuove amicizie altrui'
);
select tests.autentica_come('minore_16');
select isnt_empty(
  $$ delete from public.amicizie
     where richiedente_id = tests.id('minore_14') and destinatario_id = tests.id('minore_16')
     returning 1 $$,
  'Ognuno dei due rimuove l''amicizia'
);

-- ---------------------------------------------------------------------------------------------
-- Limiti anti-abuso (R-14)
-- ---------------------------------------------------------------------------------------------
select tests.esci();
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000',
       ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid,
       'authenticated', 'authenticated', 'adulto.' || n || '@example.com',
       jsonb_build_object(
         'username', 'adulto.prova' || n, 'nome_visualizzato', 'Prova ' || n,
         'data_nascita', '1995-01-01',
         'consensi', jsonb_build_object('termini', '2026-10', 'privacy', '2026-10'))
from generate_series(1, 52) n;

-- 19 richieste nelle ultime 24 ore (più quella del seed di adulto_20, già accettata).
insert into public.amicizie (richiedente_id, destinatario_id, canale)
select tests.id('adulto_20'), ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid, 'ricerca'
from generate_series(1, 19) n;
update public.amicizie set creata_il = now() where richiedente_id = tests.id('adulto_20');
select tests.autentica_come('adulto_20');
select throws_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale)
     values (tests.id('adulto_20'), '00000000-0000-4000-9000-000000000020', 'ricerca') $$,
  'NX008', null,
  'R-14: al massimo 20 richieste ogni 24 ore'
);

select tests.esci();
-- 50 richieste in attesa, create più di 24 ore fa: inserite senza trigger, così il limite
-- giornaliero non scatta durante la preparazione.
set local session_replication_role = replica;
insert into public.amicizie (richiedente_id, destinatario_id, canale)
select tests.id('adulto_21'), ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid, 'ricerca'
from generate_series(1, 50) n;
update public.amicizie set creata_il = now() - interval '2 days'
where richiedente_id = tests.id('adulto_21');
set local session_replication_role = origin;
select tests.autentica_come('adulto_21');
select throws_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale)
     values (tests.id('adulto_21'), '00000000-0000-4000-9000-000000000051', 'ricerca') $$,
  'NX009', null,
  'R-14: al massimo 50 richieste in attesa'
);

-- ---------------------------------------------------------------------------------------------
-- Blocchi (R-17)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
select lives_ok(
  $$ insert into public.blocchi (bloccante_id, bloccato_id)
     values (tests.id('minore_15'), tests.id('minore_16')) $$,
  'R-17: un utente blocca un amico'
);
select is_empty(
  $$ select 1 from public.amicizie
     where tests.id('minore_16') in (richiedente_id, destinatario_id)
       and tests.id('minore_15') in (richiedente_id, destinatario_id) $$,
  'R-17: il blocco toglie l''amicizia'
);
select is_empty($$ select 1 from public.profili where id = tests.id('minore_16') $$,
                'R-17: chi blocca non vede più il profilo del bloccato');
select ok(not private.sono_amici(tests.id('minore_15'), tests.id('minore_16')), 'Non sono più amici');
select tests.autentica_come('minore_16');
select is_empty($$ select 1 from public.blocchi $$, 'R-17: il bloccato non vede il blocco');
select is_empty($$ select 1 from public.profili where id = tests.id('minore_15') $$,
                'R-17: il bloccato non vede il profilo di chi l''ha bloccato');
select throws_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale)
     values (tests.id('minore_16'), tests.id('minore_15'), 'ricerca') $$,
  'NX016', null,
  'R-17: il bloccato non può mandare richieste (stesso errore di un account non disponibile)'
);
select throws_ok(
  $$ insert into public.blocchi (bloccante_id, bloccato_id)
     values (tests.id('minore_15'), tests.id('minore_14')) $$,
  '42501', null,
  'Non si blocca a nome di altri'
);
select throws_ok(
  $$ insert into public.blocchi (bloccante_id, bloccato_id)
     values (tests.id('minore_16'), tests.id('minore_16')) $$,
  '23514', null,
  'Non si blocca sé stessi'
);
select tests.autentica_come('minore_15');
select results_eq(
  $$ select username from public.miei_bloccati() $$,
  array['minore_16'],
  'F-42: chi blocca vede username e nome dei bloccati per poterli sbloccare'
);
select tests.autentica_come('minore_16');
select is_empty($$ select 1 from public.miei_bloccati() $$,
                'R-17: il bloccato non scopre il blocco nemmeno dalla RPC');
select tests.autentica_come('minore_15');
select isnt_empty(
  $$ delete from public.blocchi where bloccato_id = tests.id('minore_16') returning 1 $$,
  'Il bloccante sblocca'
);
select ok(not private.sono_amici(tests.id('minore_15'), tests.id('minore_16')),
          'Dopo lo sblocco non si torna amici da soli');

-- ---------------------------------------------------------------------------------------------
-- Nessun accesso anonimo (R-07)
-- ---------------------------------------------------------------------------------------------
select tests.esci();
set local role anon;
select throws_ok($$ select 1 from public.amicizie $$, '42501', null, 'R-07: anon non legge amicizie');
select throws_ok($$ select 1 from public.blocchi $$, '42501', null, 'R-07: anon non legge blocchi');
select throws_ok($$ select * from public.cerca_utenti('min') $$, '42501', null,
                 'R-07: anon non cerca utenti');
reset role;

select * from finish();
rollback;
