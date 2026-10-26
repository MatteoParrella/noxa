-- gruppi e membri_gruppo (DATA_MODEL.md §5.4): inviti, ruoli, limite di 30 membri, invariante
-- delle fasce con i trigger su amicizie e blocchi e il job dei compleanni, visibilità dei
-- profili tra membri. Regole: R-11, R-13, R-15, R-17, R-69.
-- Relazioni del seed: minore_15–minore_16 e adulto_20–adulto_21 amici, adulto_18–minore_17
-- amici da codice, minore_14 → minore_15 in attesa.
begin;
select plan(80);

-- Amicizie in più per i casi di prova.
select tests.rendi_amici('minore_15', 'minore_17');
select tests.rendi_amici('minore_16', 'minore_17');
select tests.rendi_amici('minore_14', 'minore_16');
select tests.rendi_amici('adulto_18', 'adulto_20');

create function tests.membro(gruppo text, utente text) returns text language sql security definer as $$
  select m.ruolo::text || '/' || m.stato::text from public.membri_gruppo m
  where m.gruppo_id = tests.gruppo(gruppo) and m.utente_id = tests.id(utente);
$$;
grant execute on function tests.membro(text, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Creazione e inviti tra minorenni
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select isnt(public.crea_gruppo('Terza B', array[tests.id('minore_15')]), null,
            'Un minorenne crea un gruppo e invita un amico');
select is(tests.membro('Terza B', 'minore_16'), 'admin/attivo', 'Chi crea il gruppo ne è admin');
select is(tests.membro('Terza B', 'minore_15'), 'membro/invitato', 'L''amico invitato è in attesa');

select tests.autentica_come('minore_15');
select results_eq($$ select nome from public.gruppi $$, array['Terza B'],
                  'R-11: chi è invitato vede il gruppo per decidere');
select results_eq($$ select count(*)::integer from public.membri_gruppo $$, array[1],
                  'R-13: chi è invitato vede solo la propria riga dei membri');
select results_eq(
  $$ select stato, membri, altri, jsonb_array_length(conosciuti)
     from public.anteprima_invito_gruppo(tests.gruppo('Terza B')) $$,
  $$ values ('valido', 2, 0, 1) $$,
  'L''anteprima dell''invito mostra le persone che si conoscono già'
);
select isnt_empty(
  $$ select 1 from public.notifiche where tipo = 'invito_gruppo'
       and dati @> jsonb_build_object('gruppo_id', tests.gruppo('Terza B')) $$,
  'L''invito arriva come notifica'
);
select throws_ok(
  $$ update public.membri_gruppo set stato = 'attivo', ruolo = 'admin'
     where gruppo_id = tests.gruppo('Terza B') and utente_id = tests.id('minore_15') $$,
  'NX044', null,
  'Chi accetta un invito non si nomina admin'
);
select lives_ok(
  $$ update public.membri_gruppo set stato = 'attivo'
     where gruppo_id = tests.gruppo('Terza B') and utente_id = tests.id('minore_15') $$,
  'R-11: l''invitato accetta esplicitamente'
);
select is_empty(
  $$ select 1 from public.notifiche where tipo = 'invito_gruppo'
       and dati @> jsonb_build_object('gruppo_id', tests.gruppo('Terza B')) $$,
  'Dopo l''accettazione la notifica dell''invito sparisce'
);
select results_eq($$ select count(*)::integer from public.membri_gruppo $$, array[2],
                  'Un membro attivo vede tutti i membri');
select lives_ok(
  $$ select public.invita_nel_gruppo(tests.gruppo('Terza B'), array[tests.id('minore_17')]) $$,
  'Anche un membro che non è admin invita un amico'
);

select tests.autentica_come('minore_16');
select throws_ok(
  $$ select public.invita_nel_gruppo(tests.gruppo('Terza B'), array[tests.id('adulto_21')]) $$,
  'NX038', null,
  'R-11, R-15: si invita solo un amico confermato'
);
select throws_ok(
  $$ insert into public.membri_gruppo (gruppo_id, utente_id, stato, invitato_da)
     values (tests.gruppo('Terza B'), tests.id('minore_14'), 'attivo', tests.id('minore_16')) $$,
  '42501', null,
  'R-11: nessuno entra in un gruppo senza un invito accettato'
);

select tests.autentica_come('minore_14');
select throws_ok(
  $$ insert into public.membri_gruppo (gruppo_id, utente_id, invitato_da)
     values (tests.gruppo('Terza B'), tests.id('minore_14'), tests.id('minore_14')) $$,
  'NX038', null,
  'Chi non è membro non si invita da solo'
);
select is_empty($$ select 1 from public.gruppi $$, 'Chi non è membro non vede il gruppo');

select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.gruppi where nome = 'Terza B' $$,
                'R-15: un adulto non vede i gruppi di minorenni');
select is_empty($$ select 1 from public.membri_gruppo where gruppo_id = tests.gruppo('Terza B') $$,
                'R-15: un adulto non vede i membri minorenni di un gruppo altrui');
select tests.autentica_come('moderatore');
select is_empty($$ select 1 from public.gruppi $$, 'R-69: i moderatori non vedono i gruppi');
select is_empty($$ select 1 from public.membri_gruppo $$, 'R-69: né i loro membri');

-- ---------------------------------------------------------------------------------------------
-- Ruoli e nome
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
select is_empty(
  $$ update public.membri_gruppo set ruolo = 'membro'
     where gruppo_id = tests.gruppo('Terza B') and utente_id = tests.id('minore_16') returning 1 $$,
  'Un membro non cambia i ruoli'
);
select is_empty($$ update public.gruppi set nome = 'Altro nome' where nome = 'Terza B' returning 1 $$,
                'Un membro non rinomina il gruppo');
select tests.autentica_come('minore_16');
select lives_ok(
  $$ update public.membri_gruppo set ruolo = 'admin'
     where gruppo_id = tests.gruppo('Terza B') and utente_id = tests.id('minore_15') $$,
  'Un admin nomina un altro admin'
);
select is(tests.membro('Terza B', 'minore_15'), 'admin/attivo', 'minore_15 è admin');
select is_empty(
  $$ update public.membri_gruppo set ruolo = 'admin'
     where gruppo_id = tests.gruppo('Terza B') and utente_id = tests.id('minore_17') returning 1 $$,
  'Un invitato non può essere nominato admin'
);
select throws_ok($$ update public.gruppi set nome = repeat('x', 41) where nome = 'Terza B' $$,
                 '23514', null, 'Il nome ha al massimo 40 caratteri');
select isnt_empty($$ update public.gruppi set nome = 'Terza B' where nome = 'Terza B' returning 1 $$,
                  'Un admin rinomina il gruppo');

-- ---------------------------------------------------------------------------------------------
-- Gruppi misti (R-15): valido e rifiutato
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_18');
select isnt(public.crea_gruppo('Quelli del sabato', array[tests.id('minore_17')]), null,
            'R-15: un adulto crea un gruppo con un minorenne suo amico confermato');
select tests.autentica_come('minore_17');
select lives_ok(
  $$ update public.membri_gruppo set stato = 'attivo'
     where gruppo_id = tests.gruppo('Quelli del sabato') and utente_id = tests.id('minore_17') $$,
  'Il minorenne accetta'
);
select tests.autentica_come('adulto_18');
select throws_ok(
  $$ select public.invita_nel_gruppo(tests.gruppo('Quelli del sabato'), array[tests.id('adulto_20')]) $$,
  'NX038', null,
  'R-15: gruppo misto rifiutato, un adulto non amico del minorenne del gruppo non entra'
);
select results_eq(
  $$ select motivo from public.amici_invitabili(tests.gruppo('Quelli del sabato'))
     where id = tests.id('adulto_20') $$,
  array['fasce'],
  'R-15: nel selettore l''amico non invitabile ha il motivo, senza dire chi'
);
select results_eq(
  $$ select motivo from public.amici_invitabili(null, array[tests.id('minore_17')])
     where id = tests.id('adulto_20') $$,
  array['fasce'],
  'R-15: il motivo tiene conto delle persone già selezionate'
);
select results_eq(
  $$ select motivo from public.amici_invitabili(null, array[tests.id('minore_14')])
     where id = tests.id('adulto_20') $$,
  array[null::text],
  'Chi non è amico non conta tra i selezionati: nessuna informazione su estranei'
);
select tests.autentica_come('minore_17');
select throws_ok(
  $$ select public.invita_nel_gruppo(tests.gruppo('Quelli del sabato'), array[tests.id('minore_16')]) $$,
  'NX038', null,
  'R-15: un minorenne non amico dell''adulto del gruppo non entra'
);
select tests.rendi_amici('minore_16', 'adulto_18');
select lives_ok(
  $$ select public.invita_nel_gruppo(tests.gruppo('Quelli del sabato'), array[tests.id('minore_16')]) $$,
  'R-15: gruppo misto valido, il minorenne è amico confermato dell''adulto'
);

-- ---------------------------------------------------------------------------------------------
-- Visibilità dei profili tra membri (R-13, R-17)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_20');
select isnt(public.crea_gruppo('Calcetto del giovedì', array[tests.id('adulto_21'), tests.id('adulto_18')]),
            null, 'Un adulto crea un gruppo con due amici che non si conoscono');
select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.profili where id = tests.id('adulto_18') $$,
                'R-13: chi è solo invitato non vede gli altri membri che non conosce');
select results_eq(
  $$ select membri, altri, jsonb_array_length(conosciuti)
     from public.anteprima_invito_gruppo(tests.gruppo('Calcetto del giovedì')) $$,
  $$ values (3, 1, 1) $$,
  'L''anteprima conta le persone che non si conoscono senza mostrarle'
);
select lives_ok(
  $$ update public.membri_gruppo set stato = 'attivo'
     where gruppo_id = tests.gruppo('Calcetto del giovedì') and utente_id = tests.id('adulto_21') $$,
  'adulto_21 accetta'
);
select isnt_empty($$ select 1 from public.profili where id = tests.id('adulto_18') $$,
                  'R-10: un membro attivo vede il profilo degli altri membri');
select results_eq(
  $$ select membri_totale, altri, jsonb_array_length(membri)
     from public.dettaglio_gruppo(tests.gruppo('Calcetto del giovedì')) $$,
  $$ values (3, 0, 3) $$,
  'Il dettaglio del gruppo mostra tutti i membri'
);
select tests.autentica_come('adulto_18');
select lives_ok(
  $$ update public.membri_gruppo set stato = 'attivo'
     where gruppo_id = tests.gruppo('Calcetto del giovedì') and utente_id = tests.id('adulto_18') $$,
  'adulto_18 accetta'
);
select tests.autentica_come('minore_14');
select is_empty($$ select 1 from public.profili where id = tests.id('adulto_18') $$,
                'Chi non è nel gruppo non vede i profili dei membri');
select is_empty($$ select 1 from public.dettaglio_gruppo(tests.gruppo('Calcetto del giovedì')) $$,
                'Né il dettaglio del gruppo');

select tests.autentica_come('adulto_21');
select lives_ok(
  $$ insert into public.blocchi (bloccante_id, bloccato_id) values (tests.id('adulto_21'), tests.id('adulto_18')) $$,
  'adulto_21 blocca un membro della stessa fascia'
);
select is_empty($$ select 1 from public.profili where id = tests.id('adulto_18') $$,
                'R-17: il blocco nasconde il profilo anche tra membri');
select results_eq(
  $$ select altri, jsonb_array_length(membri)
     from public.dettaglio_gruppo(tests.gruppo('Calcetto del giovedì')) $$,
  $$ values (1, 2) $$,
  'R-17: il membro bloccato è solo contato'
);
select is(tests.membro('Calcetto del giovedì', 'adulto_18'), 'membro/attivo',
          'Nella stessa fascia il blocco non toglie dal gruppo');

-- ---------------------------------------------------------------------------------------------
-- Invariante dopo un'amicizia rimossa e un blocco (R-15)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_17');
select lives_ok(
  $$ delete from public.amicizie where tests.id('adulto_18') in (richiedente_id, destinatario_id)
       and tests.id('minore_17') in (richiedente_id, destinatario_id) $$,
  'minore_17 rimuove l''amicizia con adulto_18'
);
select is(tests.membro('Quelli del sabato', 'adulto_18'), null,
          'R-15: l''adulto non più amico del minorenne è tolto dal gruppo');
select is(tests.membro('Quelli del sabato', 'minore_17'), 'admin/attivo',
          'Uscito l''ultimo admin, diventa admin il membro attivo da più tempo');
select is(tests.membro('Quelli del sabato', 'minore_16'), 'membro/invitato',
          'Il minorenne invitato resta');
select tests.autentica_come('adulto_18');
select isnt_empty(
  $$ select 1 from public.notifiche where tipo = 'rimozione_gruppo'
       and dati @> jsonb_build_object('gruppo_id', tests.gruppo('Quelli del sabato'),
                                      'motivo', 'fasce')
       and not dati ? 'nome_gruppo' $$,
  'R-15: l''adulto tolto riceve una notifica con il motivo, senza il nome scritto da altri'
);
select is_empty($$ select 1 from public.gruppi where nome = 'Quelli del sabato' $$,
                'L''adulto tolto non vede più il gruppo');

select tests.autentica_come('minore_16');
select isnt(public.crea_gruppo('Squadra', array[tests.id('adulto_18')]), null,
            'Gruppo misto per la prova del blocco');
select tests.autentica_come('adulto_18');
select lives_ok(
  $$ update public.membri_gruppo set stato = 'attivo'
     where gruppo_id = tests.gruppo('Squadra') and utente_id = tests.id('adulto_18') $$,
  'adulto_18 accetta'
);
select tests.autentica_come('minore_16');
select lives_ok(
  $$ insert into public.blocchi (bloccante_id, bloccato_id) values (tests.id('minore_16'), tests.id('adulto_18')) $$,
  'Il minorenne blocca l''adulto'
);
select is(tests.membro('Squadra', 'adulto_18'), null,
          'R-15, R-17: dopo un blocco tra fasce diverse l''adulto esce dal gruppo');
select is(tests.membro('Squadra', 'minore_16'), 'admin/attivo', 'Il minorenne resta');

select tests.autentica_come('minore_15');
select lives_ok(
  $$ insert into public.blocchi (bloccante_id, bloccato_id) values (tests.id('minore_15'), tests.id('minore_17')) $$,
  'minore_15 blocca minore_17, invitato in Terza B'
);
select is(tests.membro('Terza B', 'minore_17'), null,
          'R-17: il blocco toglie gli inviti in attesa nei gruppi dell''altra persona');
select tests.autentica_come('minore_17');
select is_empty(
  $$ select 1 from public.notifiche where tipo in ('rimozione_gruppo', 'invito_gruppo')
       and dati @> jsonb_build_object('gruppo_id', tests.gruppo('Terza B')) $$,
  'R-17: nessuna notifica rivela il blocco'
);

-- ---------------------------------------------------------------------------------------------
-- Compimento dei 18 anni (job giornaliero)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select lives_ok(
  $$ select public.invita_nel_gruppo(tests.gruppo('Terza B'), array[tests.id('minore_14')]) $$,
  'minore_14, amico di minore_16, è invitato in Terza B (non è amico di minore_15)'
);
select tests.esci();
select set_config('noxa.correzione_data_nascita', 'consentita', true);
update public.profili_privati
set data_nascita = ((now() at time zone 'Europe/Rome')::date - interval '18 years')::date
where utente_id = tests.id('minore_15');
select set_config('noxa.correzione_data_nascita', '', true);
select is(private.verifica_invariante_gruppi(), 1,
          'R-15: il job toglie chi ha compiuto 18 anni e non è amico di un minorenne del gruppo');
select is(tests.membro('Terza B', 'minore_15'), null, 'Il neo maggiorenne è tolto');
select isnt_empty(
  $$ select 1 from public.notifiche where utente_id = tests.id('minore_15') and tipo = 'rimozione_gruppo'
       and dati @> jsonb_build_object('gruppo_id', tests.gruppo('Terza B'), 'motivo', 'compleanno') $$,
  'La notifica dice che il motivo è il compleanno'
);
select is(private.verifica_invariante_gruppi(), 0, 'Il job non trova altro da correggere');
select isnt_empty($$ select 1 from cron.job where jobname = 'verifica_invariante_gruppi' $$,
                  'Il job è pianificato con pg_cron');

-- ---------------------------------------------------------------------------------------------
-- Limiti: 30 membri, 10 gruppi al giorno
-- ---------------------------------------------------------------------------------------------
do $$
declare
  n integer;
  utente uuid;
begin
  for n in 1..28 loop
    utente := ('00000000-0000-4000-8000-000000000' || (100 + n)::text)::uuid;
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', utente, 'authenticated', 'authenticated',
            'extra_' || n || '@example.com', '', now(), '{"provider": "email"}'::jsonb,
            jsonb_build_object('username', 'extra_' || n, 'nome_visualizzato', 'Extra ' || n,
                               'data_nascita', ((now() at time zone 'Europe/Rome')::date - interval '25 years')::date,
                               'consensi', jsonb_build_object('termini', '2026-10', 'privacy', '2026-10')),
            now(), now());
    insert into public.amicizie (richiedente_id, destinatario_id, canale, stato, accettata_il)
    values (utente, tests.id('adulto_20'), 'codice_invito', 'accettata', now());
    if n <= 27 then
      insert into public.membri_gruppo (gruppo_id, utente_id, stato)
      values (tests.gruppo('Calcetto del giovedì'), utente, 'attivo');
    end if;
  end loop;
end
$$;
select tests.autentica_come('adulto_20');
select results_eq(
  $$ select motivo from public.amici_invitabili(tests.gruppo('Calcetto del giovedì'))
     where id = tests.id('extra_28') $$,
  array['pieno'],
  'Con 30 membri il selettore dice che il gruppo è pieno'
);
select throws_ok(
  $$ select public.invita_nel_gruppo(tests.gruppo('Calcetto del giovedì'), array[tests.id('extra_28')]) $$,
  'NX037', null,
  'Un gruppo ha al massimo 30 membri, compresi gli invitati'
);

select tests.autentica_come('minore_14');
select lives_ok($$ select public.crea_gruppo('Prova ' || n) from generate_series(1, 10) n $$,
                'Si creano 10 gruppi in un giorno');
select throws_ok($$ select public.crea_gruppo('Prova 11') $$, 'NX045', null,
                 'L''undicesimo gruppo del giorno è rifiutato');

-- ---------------------------------------------------------------------------------------------
-- Uscita, rimozione ed eliminazione
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_20');
select lives_ok(
  $$ delete from public.membri_gruppo
     where gruppo_id = tests.gruppo('Calcetto del giovedì') and utente_id = tests.id('adulto_20') $$,
  'L''unico admin esce dal gruppo'
);
select is(tests.membro('Calcetto del giovedì', 'adulto_18'), 'admin/attivo',
          'Diventa admin il membro attivo da più tempo');
select tests.autentica_come('adulto_18');
select lives_ok(
  $$ delete from public.membri_gruppo
     where gruppo_id = tests.gruppo('Calcetto del giovedì') and utente_id = tests.id('adulto_21') $$,
  'Un admin toglie un membro'
);
select tests.autentica_come('adulto_21');
select isnt_empty(
  $$ select 1 from public.notifiche where tipo = 'rimozione_gruppo'
       and dati @> jsonb_build_object('gruppo_id', tests.gruppo('Calcetto del giovedì'), 'motivo', 'tolto') $$,
  'Chi è tolto da un admin lo sa'
);
select tests.autentica_come('extra_1');
select is_empty(
  $$ delete from public.membri_gruppo
     where gruppo_id = tests.gruppo('Calcetto del giovedì') and utente_id = tests.id('extra_2') returning 1 $$,
  'Un membro non toglie gli altri'
);
select is_empty($$ delete from public.gruppi where nome = 'Calcetto del giovedì' returning 1 $$,
                'Un membro non elimina il gruppo');

select tests.autentica_come('minore_16');
select lives_ok(
  $$ delete from public.membri_gruppo
     where gruppo_id = tests.gruppo('Squadra') and utente_id = tests.id('minore_16') $$,
  'L''ultimo membro attivo esce'
);
select tests.esci();
select is_empty($$ select 1 from public.gruppi where nome = 'Squadra' $$,
                'Un gruppo senza membri attivi si elimina');

select * from finish();
rollback;
