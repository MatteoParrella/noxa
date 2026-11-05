-- checkin, checkin_destinatari (DATA_MODEL.md §5.5) e RPC fai_checkin, suggerimenti_checkin.
-- Regole: R-17, R-20, R-30, R-55, R-65, R-69. Trigger: verifica_checkin, proteggi_checkin,
-- notifica_checkin, dopo_rimozione_destinatario, rimuovi_destinatari_checkin,
-- dopo_disattivazione_checkin.
-- Amici del seed: 15-16, 20-21, 18-17 (codice invito); richiesta in attesa 14 → 15.
begin;
select plan(66);

-- Si parte senza check-in, anche dopo una corsa dei test e2e di integrazione (tutto torna
-- com'era con il rollback finale).
delete from public.checkin;
delete from public.notifiche where tipo = 'checkin_amico';
update public.profili_privati set checkin_abilitato = false;

-- Eventi e locali di prova, indipendenti dalla data del seed.
insert into public.eventi (id, locale_id, titolo, inizio, fine, eta_minima, eta_minima_dichiarata,
                           riferimenti_alcol, stato)
values
  ('00000000-0000-4000-8000-00000000f914', '00000000-0000-4000-8000-00000000c002', 'Check-in 14',
   now(), now() + interval '4 hours', 14, true, false, 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f918', '00000000-0000-4000-8000-00000000c001', 'Check-in 18',
   now(), now() + interval '4 hours', 18, true, false, 'pubblicato');
insert into public.locali (id, nome, nome_normalizzato, indirizzo, comune, provincia, posizione, attivo)
values ('00000000-0000-4000-8000-00000000c999', 'Locale chiuso', 'locale chiuso', 'Via Chiusa 1',
        'Monza', 'MB', 'SRID=4326;POINT(9.27 45.58)', false);

create function tests.loc(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000c' || n)::uuid;
$$;
create function tests.ev9(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000f9' || n)::uuid;
$$;
-- Check-in attivo di un utente del seed, letto senza passare dalla RLS.
create function tests.checkin_di(nome text) returns uuid language sql stable security definer
set search_path = '' as $$
  select c.id from public.checkin c
  where c.utente_id = tests.id(nome) and c.terminato_il is null and c.scade_il > now()
  order by c.creato_il desc limit 1;
$$;
grant execute on function tests.loc(text) to authenticated;
grant execute on function tests.ev9(text) to authenticated;
grant execute on function tests.checkin_di(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Struttura e default (R-30)
-- ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.checkin'::regclass), 'RLS su checkin');
select ok((select relrowsecurity from pg_class where oid = 'public.checkin_destinatari'::regclass),
          'RLS su checkin_destinatari');
select ok(not exists (select 1 from public.profili_privati where checkin_abilitato),
          'R-30: il check-in è spento per tutti gli utenti del seed');
select ok(not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'checkin'
                        and column_name in ('posizione', 'latitudine', 'longitudine')),
          'R-30: il check-in non ha colonne di coordinate');

-- Spento: nessuna età riesce a fare check-in.
select tests.autentica_come('minore_14');
select throws_ok($$ select public.fai_checkin(tests.loc('001'), null, array[tests.id('minore_15')]) $$,
                 'NX049', null, 'R-30: 14 anni, check-in spento');
select tests.autentica_come('minore_15');
select throws_ok($$ select public.fai_checkin(tests.loc('001'), null, array[tests.id('minore_16')]) $$,
                 'NX049', null, 'R-30: 15 anni, check-in spento');
select tests.autentica_come('minore_16');
select throws_ok($$ select public.fai_checkin(tests.loc('001'), null, array[tests.id('minore_15')]) $$,
                 'NX049', null, 'R-30: 16 anni, check-in spento');
select tests.autentica_come('minore_17');
select throws_ok($$ select public.fai_checkin(tests.loc('001'), null, array[tests.id('adulto_18')]) $$,
                 'NX049', null, 'R-30: 17 anni, check-in spento');
select tests.autentica_come('adulto_18');
select throws_ok($$ select public.fai_checkin(tests.loc('001'), null, array[tests.id('minore_17')]) $$,
                 'NX049', null, 'R-30: 18 anni, check-in spento');
select tests.autentica_come('adulto_20');
select throws_ok($$ select public.fai_checkin(tests.loc('001'), null, array[tests.id('adulto_21')]) $$,
                 'NX049', null, 'R-30: 20 anni, check-in spento');
select tests.autentica_come('adulto_21');
select throws_ok($$ select public.fai_checkin(tests.loc('001'), null, array[tests.id('adulto_20')]) $$,
                 'NX049', null, 'R-30: 21 anni, check-in spento');
select tests.autentica_come('moderatore');
select throws_ok($$ select public.fai_checkin(tests.loc('001'), null, array[tests.id('adulto_20')]) $$,
                 'NX049', null, 'R-30: moderatore, check-in spento');

-- Ognuno lo accende da sé (colonna modificabile dal titolare).
select tests.autentica_come('minore_15');
select lives_ok($$ update public.profili_privati set checkin_abilitato = true $$,
                'Il titolare accende il check-in nelle impostazioni');
select tests.esci();
update public.profili_privati set checkin_abilitato = true;

-- ---------------------------------------------------------------------------------------------
-- Destinatari: solo amici confermati, per ogni età (R-30, R-12)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select throws_ok($$ select public.fai_checkin(tests.loc('002'), null, array[tests.id('minore_15')]) $$,
                 'NX051', null, '14 anni: una richiesta in attesa non è un destinatario');
select tests.autentica_come('moderatore');
select throws_ok($$ select public.fai_checkin(tests.loc('002'), null, array[tests.id('adulto_18')]) $$,
                 'NX051', null, 'Moderatore: nessun destinatario senza amicizia (R-69)');
select tests.autentica_come('adulto_21');
select throws_ok($$ select public.fai_checkin(tests.loc('002'), null, '{}') $$,
                 'NX051', null, 'Serve almeno un destinatario');

select tests.autentica_come('minore_15');
select is((public.fai_checkin(tests.loc('001'), null,
                              array[tests.id('minore_16'), tests.id('adulto_21')]) -> 'esclusi'),
          jsonb_build_array(tests.id('adulto_21')),
          '15 anni: fa check-in; un adulto non amico viene escluso e restituito');
select tests.autentica_come('minore_16');
select is((select count(*)::int from public.checkin where utente_id = tests.id('minore_15')), 1,
          '16 anni: il destinatario amico vede il check-in');
select is((select l.nome::text from public.checkin c join public.locali l on l.id = c.locale_id
           where c.utente_id = tests.id('minore_15')), 'Club Binario 7'::text,
          'Il destinatario vede il locale');
select tests.autentica_come('adulto_21');
select is((select count(*)::int from public.checkin where utente_id = tests.id('minore_15')), 0,
          'R-30: un adulto escluso non vede il check-in di un minorenne');
select tests.autentica_come('minore_14');
select is((select count(*)::int from public.checkin), 0, 'R-30: 14 anni non vede check-in di non amici');
select tests.autentica_come('minore_17');
select is((select count(*)::int from public.checkin), 0, 'R-30: 17 anni non vede check-in di non amici');
select tests.autentica_come('moderatore');
select is((select count(*)::int from public.checkin), 0, 'R-69: il moderatore non vede i check-in');
select is((select count(*)::int from public.checkin_destinatari), 0,
          'R-69: il moderatore non vede i destinatari');
select tests.autentica_come('moderatore_senza_mfa');
select is((select count(*)::int from public.checkin), 0,
          'R-69: nemmeno il moderatore senza due fattori vede i check-in');

select tests.autentica_come('adulto_18');
select lives_ok($$ select public.fai_checkin(tests.loc('001'), tests.ev9('18'), array[tests.id('minore_17')]) $$,
                '18 anni: check-in a un evento con un amico minorenne da codice invito');
select tests.autentica_come('minore_17');
select is((select count(*)::int from public.checkin where utente_id = tests.id('adulto_18')), 1,
          '17 anni: vede il check-in dell''amico adulto');
select is((select count(*)::int from public.checkin c join public.eventi e on e.id = c.evento_id
           where c.utente_id = tests.id('adulto_18')), 0,
          'R-20: l''evento 18+ resta invisibile al minorenne, il locale no');
select lives_ok($$ select public.fai_checkin(tests.loc('002'), tests.ev9('14'), array[tests.id('adulto_18')]) $$,
                '17 anni: check-in a un evento adatto con un amico adulto');
select throws_ok($$ select public.fai_checkin(tests.loc('003'), null, array[tests.id('adulto_18')]) $$,
                 'NX050', null, 'Un solo check-in attivo alla volta');
select tests.autentica_come('adulto_20');
select lives_ok($$ select public.fai_checkin(tests.loc('004'), null, array[tests.id('adulto_21')]) $$,
                '20 anni: check-in con un amico');
select tests.autentica_come('adulto_21');
select is((select count(*)::int from public.checkin where utente_id = tests.id('adulto_20')), 1,
          '21 anni: vede il check-in dell''amico');
select tests.autentica_come('minore_16');
select throws_ok($$ select public.fai_checkin(tests.loc('001'), tests.ev9('18'), array[tests.id('minore_15')]) $$,
                 '42501', null, 'R-20: 16 anni non fa check-in a un evento 18+');
select throws_ok($$ select public.fai_checkin(tests.loc('999'), null, array[tests.id('minore_15')]) $$,
                 'NX053', null, 'Un locale disattivato non è disponibile');
select throws_ok($$ select public.fai_checkin(tests.loc('001'), tests.ev9('14'), array[tests.id('minore_15')]) $$,
                 'NX053', null, 'L''evento deve essere nel locale scelto');
select throws_ok($$ insert into public.checkin (utente_id, locale_id) values (tests.id('minore_15'), tests.loc('001')) $$,
                 '42501', null, 'Nessuno crea un check-in a nome di altri');

-- ---------------------------------------------------------------------------------------------
-- Notifica, destinatari e scrittura
-- ---------------------------------------------------------------------------------------------
select tests.esci();
select is((select dati from public.notifiche
           where utente_id = tests.id('minore_16') and tipo = 'checkin_amico'),
          jsonb_build_object('checkin_id', tests.checkin_di('minore_15'), 'utente_id', tests.id('minore_15')),
          'La notifica checkin_amico contiene solo identificativi, nessun testo né locale');

select tests.autentica_come('minore_16');
select is((select count(*)::int from public.checkin_destinatari), 1,
          'Il destinatario vede solo la propria riga di destinatario');
update public.checkin set terminato_il = now() where utente_id = tests.id('minore_15');
delete from public.checkin_destinatari where amico_id = tests.id('minore_16');
delete from public.checkin where utente_id = tests.id('minore_15');
select isnt(tests.checkin_di('minore_15'), null::uuid,
            'Il destinatario non termina né elimina il check-in di altri');
select is((select count(*)::int from public.checkin_destinatari), 1,
          'Il destinatario non si toglie dalle righe del titolare');
select throws_ok($$ update public.checkin set locale_id = tests.loc('002') $$,
                 '42501', null, 'Il locale di un check-in non si cambia');

select tests.autentica_come('minore_15');
select throws_ok(
  $$ insert into public.checkin_destinatari (checkin_id, amico_id)
     values (tests.checkin_di('minore_15'), tests.id('adulto_21')) $$,
  '42501', null, 'R-30: il titolare non aggiunge un non amico');
select is((select count(*)::int from public.checkin_destinatari), 1,
          'Il titolare vede i propri destinatari');

-- ---------------------------------------------------------------------------------------------
-- Fine: un tocco, ultimo destinatario tolto, impostazione spenta, blocco (R-17)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
update public.checkin set terminato_il = '2000-01-01' where utente_id = tests.id('minore_15');
select ok((select terminato_il > now() - interval '1 minute' from public.checkin
           where utente_id = tests.id('minore_15')),
          '"Sono andato via": l''ora di fine è quella del database');
select tests.autentica_come('minore_16');
select is((select count(*)::int from public.checkin), 0, 'Un check-in terminato sparisce per i destinatari');
select is((select count(*)::int from public.notifiche where tipo = 'checkin_amico'), 1,
          'La notifica resta e l''app la mostra come terminata');
select tests.autentica_come('minore_15');
select lives_ok($$ select public.fai_checkin(tests.loc('002'), null, array[tests.id('minore_16')]) $$,
                'Dopo la fine si fa un nuovo check-in');
select lives_ok($$ delete from public.checkin_destinatari where amico_id = tests.id('minore_16') $$,
                'Il titolare toglie un destinatario');
select ok((select terminato_il is not null from public.checkin
           where utente_id = tests.id('minore_15') order by creato_il desc limit 1),
          'Togliere l''ultimo destinatario termina il check-in');
select tests.esci();
select is((select count(*)::int from public.notifiche
           where utente_id = tests.id('minore_16') and tipo = 'checkin_amico'
             and dati ->> 'checkin_id' = (select c.id::text from public.checkin c
                                          where c.utente_id = tests.id('minore_15')
                                          order by c.creato_il desc limit 1)), 0,
          'Il destinatario tolto perde anche la notifica');

select tests.autentica_come('minore_17');
select lives_ok($$ update public.profili_privati set checkin_abilitato = false $$,
                '17 anni spegne il check-in');
select tests.esci();
select is(tests.checkin_di('minore_17'), null::uuid, 'R-30: spegnere l''impostazione termina il check-in attivo');
select tests.autentica_come('minore_17');
select throws_ok($$ select public.fai_checkin(tests.loc('002'), null, array[tests.id('adulto_18')]) $$,
                 'NX049', null, 'Con l''impostazione spenta il check-in non riparte');

select tests.autentica_come('adulto_21');
select lives_ok($$ insert into public.blocchi (bloccante_id, bloccato_id)
                   values (tests.id('adulto_21'), tests.id('adulto_20')) $$,
                '21 anni blocca 20 anni');
select is((select count(*)::int from public.checkin where utente_id = tests.id('adulto_20')), 0,
          'R-17: dopo il blocco il check-in non si vede più');
select tests.esci();
select is((select count(*)::int from public.checkin_destinatari d join public.checkin c on c.id = d.checkin_id
           where c.utente_id = tests.id('adulto_20') and d.amico_id = tests.id('adulto_21')), 0,
          'R-17: il blocco toglie la persona dai destinatari');
select is(tests.checkin_di('adulto_20'), null::uuid, 'R-17: senza destinatari il check-in termina');

-- Amicizia rimossa: 18 e 17 non sono più amici.
delete from public.amicizie where least(richiedente_id, destinatario_id) = least(tests.id('adulto_18'), tests.id('minore_17'))
  and greatest(richiedente_id, destinatario_id) = greatest(tests.id('adulto_18'), tests.id('minore_17'));
select is((select count(*)::int from public.checkin_destinatari d join public.checkin c on c.id = d.checkin_id
           where c.utente_id = tests.id('adulto_18')), 0,
          'Un''amicizia rimossa toglie la persona dai destinatari');

-- ---------------------------------------------------------------------------------------------
-- Scadenza, conservazione e limite giornaliero
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select lives_ok($$ select public.fai_checkin(tests.loc('003'), null, array[tests.id('minore_15')]) $$,
                '16 anni fa check-in');
select tests.esci();
update public.checkin set creato_il = now() - interval '7 hours', scade_il = now() - interval '1 hour'
where utente_id = tests.id('minore_16');
select tests.autentica_come('minore_15');
select is((select count(*)::int from public.checkin where utente_id = tests.id('minore_16')), 0,
          'R-30: dopo 6 ore il check-in sparisce per i destinatari');
select tests.esci();
update public.checkin set creato_il = now() - interval '31 hours', scade_il = now() - interval '25 hours'
where utente_id = tests.id('minore_16');
update public.checkin set creato_il = now() - interval '10 hours', scade_il = now() - interval '4 hours',
                          terminato_il = null
where utente_id = tests.id('adulto_20');
select private.applica_conservazione();
select is((select count(*)::int from public.checkin where utente_id = tests.id('minore_16')), 0,
          'R-30, R-65: cancellato 24 ore dopo la scadenza');
select is((select count(*)::int from public.checkin where utente_id = tests.id('adulto_20')), 1,
          'Un check-in scaduto da meno di 24 ore resta');

select tests.rendi_amici('adulto_18', 'adulto_21');
set local session_replication_role = replica;
insert into public.checkin (utente_id, locale_id)
select tests.id('adulto_21'), tests.loc('001') from generate_series(1, 10);
set local session_replication_role = origin;
update public.checkin set terminato_il = now() where utente_id = tests.id('adulto_21');
select tests.autentica_come('adulto_21');
select throws_ok($$ select public.fai_checkin(tests.loc('002'), null, array[tests.id('adulto_18')]) $$,
                 'NX052', null, 'Al massimo 10 check-in in 24 ore');

-- ---------------------------------------------------------------------------------------------
-- Suggerimenti e Realtime
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
insert into public.partecipazioni_evento (utente_id, evento_id, stato)
values (tests.id('minore_15'), tests.ev9('14'), 'partecipo');
select is((public.suggerimenti_checkin() -> 'eventi' -> 0 ->> 'evento_id')::uuid, tests.ev9('14'),
          'Suggerito l''evento a cui partecipi stasera');
select ok(private.puo_ascoltare('vivi:' || tests.id('minore_15')::text), 'Si ascolta il proprio canale vivi');
select ok(not private.puo_ascoltare('vivi:' || tests.id('minore_16')::text), 'Non si ascolta il canale vivi di altri');

select * from finish();
rollback;
