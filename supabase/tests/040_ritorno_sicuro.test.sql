-- ritorni_sicuri, ritorni_destinatari, posizioni_ritorno (DATA_MODEL.md §5.5) e RPC
-- avvia_ritorno, proroga_ritorno, invia_posizione_ritorno, ritorni_vivi, suggerimenti_ritorno;
-- job verifica_ritorni_scaduti; canale realtime ritorno:<id>.
-- Regole: R-17, R-31, R-32, R-34, R-55, R-64, R-65, R-69.
-- Amici del seed: 15-16, 20-21, 18-17 (codice invito); richiesta in attesa 14 → 15.
begin;
select plan(96);

delete from public.ritorni_sicuri;
delete from public.notifiche where tipo like 'ritorno\_%';

-- Ritorno attivo di un utente del seed, letto senza passare dalla RLS.
create function tests.ritorno_di(nome text) returns uuid language sql stable security definer
set search_path = '' as $$
  select r.id from public.ritorni_sicuri r
  where r.utente_id = tests.id(nome) order by r.avviato_il desc limit 1;
$$;
grant execute on function tests.ritorno_di(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Struttura (R-31, R-32)
-- ---------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.ritorni_sicuri'::regclass),
          'RLS su ritorni_sicuri');
select ok((select relrowsecurity from pg_class where oid = 'public.ritorni_destinatari'::regclass),
          'RLS su ritorni_destinatari');
select ok((select relrowsecurity from pg_class where oid = 'public.posizioni_ritorno'::regclass),
          'RLS su posizioni_ritorno');
select ok(not exists (select 1 from information_schema.columns
                      where table_schema = 'public'
                        and table_name in ('ritorni_sicuri', 'ritorni_destinatari', 'profili',
                                           'profili_privati')
                        and column_name ~ '(indirizzo|casa|destinazione|area)'),
          'R-32: nessuna colonna per l''indirizzo di casa o l''area di arrivo');
select ok(exists (select 1 from cron.job where jobname = 'verifica_ritorni_scaduti' and schedule = '* * * * *'),
          'R-31: verifica_ritorni_scaduti è pianificata ogni minuto');

-- ---------------------------------------------------------------------------------------------
-- Avvio: solo amici confermati, da 1 a 5, per ogni età (R-31)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select throws_ok($$ select public.avvia_ritorno(now() + interval '1 hour', array[tests.id('minore_15')]) $$,
                 'NX056', null, '14 anni: una richiesta in attesa non è un destinatario');
select tests.autentica_come('moderatore');
select throws_ok($$ select public.avvia_ritorno(now() + interval '1 hour', array[tests.id('adulto_18')]) $$,
                 'NX056', null, 'Moderatore: nessun destinatario senza amicizia (R-69)');
select tests.autentica_come('adulto_21');
select throws_ok($$ select public.avvia_ritorno(now() + interval '1 hour', '{}') $$,
                 'NX056', null, 'Serve almeno un destinatario');
select throws_ok($$ select public.avvia_ritorno(now() + interval '5 minutes', array[tests.id('adulto_20')]) $$,
                 'NX058', null, 'R-31: l''arrivo previsto è almeno 10 minuti dopo');
select throws_ok($$ select public.avvia_ritorno(now() + interval '4 hours 1 minute', array[tests.id('adulto_20')]) $$,
                 'NX058', null, 'R-31: l''arrivo previsto è al massimo 4 ore dopo');
select throws_ok($$ insert into public.ritorni_sicuri (utente_id, arrivo_previsto)
                    values (tests.id('adulto_20'), now() + interval '1 hour') $$,
                 '42501', null, 'Nessuno avvia un ritorno a nome di altri');

select tests.autentica_come('minore_15');
select is((public.avvia_ritorno(now() + interval '1 hour',
                                array[tests.id('minore_16'), tests.id('adulto_21')]) -> 'esclusi'),
          jsonb_build_array(tests.id('adulto_21')),
          '15 anni: avvia il ritorno; un adulto non amico viene escluso e restituito');
select throws_ok($$ select public.avvia_ritorno(now() + interval '1 hour', array[tests.id('minore_16')]) $$,
                 'NX055', null, 'R-31: un solo ritorno attivo alla volta');
select tests.autentica_come('minore_16');
select is((select count(*)::int from public.ritorni_sicuri where utente_id = tests.id('minore_15')), 1,
          '16 anni: il destinatario amico vede il ritorno');
select tests.autentica_come('adulto_21');
select is((select count(*)::int from public.ritorni_sicuri where utente_id = tests.id('minore_15')), 0,
          'R-31: un adulto escluso non vede il ritorno di un minorenne');
select tests.autentica_come('minore_14');
select is((select count(*)::int from public.ritorni_sicuri), 0, '14 anni non vede ritorni di non amici');
select tests.autentica_come('minore_17');
select is((select count(*)::int from public.ritorni_sicuri), 0, '17 anni non vede ritorni di non amici');
select tests.autentica_come('adulto_18');
select is((select count(*)::int from public.ritorni_sicuri), 0, '18 anni non vede ritorni di non amici');
select tests.autentica_come('adulto_20');
select is((select count(*)::int from public.ritorni_sicuri), 0, '20 anni non vede ritorni di non amici');
select tests.autentica_come('moderatore');
select is((select count(*)::int from public.ritorni_sicuri), 0, 'R-69: il moderatore non vede i ritorni');
select is((select count(*)::int from public.ritorni_destinatari), 0, 'R-69: il moderatore non vede i destinatari');
select is((select count(*)::int from public.posizioni_ritorno), 0, 'R-69: il moderatore non vede le posizioni');
select tests.autentica_come('moderatore_senza_mfa');
select is((select count(*)::int from public.ritorni_sicuri), 0,
          'R-69: nemmeno il moderatore senza due fattori vede i ritorni');
select throws_ok($$ select public.avvia_ritorno(now() + interval '1 hour', array[tests.id('adulto_18')]) $$,
                 'NX056', null, 'Moderatore senza due fattori: nessun destinatario senza amicizia');

select tests.autentica_come('adulto_18');
select lives_ok($$ select public.avvia_ritorno(now() + interval '30 minutes', array[tests.id('minore_17')]) $$,
                '18 anni: ritorno con un amico minorenne da codice invito');
select tests.autentica_come('minore_17');
select is((select count(*)::int from public.ritorni_sicuri where utente_id = tests.id('adulto_18')), 1,
          '17 anni: vede il ritorno dell''amico adulto');
select lives_ok($$ select public.avvia_ritorno(now() + interval '2 hours', array[tests.id('adulto_18')]) $$,
                '17 anni: ritorno con l''amico adulto');
select tests.autentica_come('adulto_20');
select lives_ok($$ select public.avvia_ritorno(now() + interval '4 hours', array[tests.id('adulto_21')]) $$,
                '20 anni: ritorno di 4 ore con un amico');
select tests.autentica_come('adulto_21');
select is((select count(*)::int from public.ritorni_sicuri where utente_id = tests.id('adulto_20')), 1,
          '21 anni: vede il ritorno dell''amico');
select tests.autentica_come('minore_14');
select is((select count(*)::int from public.ritorni_sicuri), 0,
          '14 anni: ancora nessun ritorno visibile');

-- Al massimo 5 destinatari (R-31): amici di prova del 21enne.
select tests.esci();
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
select '00000000-0000-0000-0000-000000000000',
       ('00000000-0000-4000-9100-' || lpad(n::text, 12, '0'))::uuid,
       'authenticated', 'authenticated', 'ritorno.' || n || '@example.com',
       jsonb_build_object(
         'username', 'ritorno_' || n, 'nome_visualizzato', 'Ritorno ' || n,
         'data_nascita', '1995-01-01',
         'consensi', jsonb_build_object('termini', '2026-10', 'privacy', '2026-11'))
from generate_series(1, 6) n;
insert into public.amicizie (richiedente_id, destinatario_id, canale, stato, accettata_il)
select tests.id('adulto_21'), p.id, 'ricerca', 'accettata', now()
from public.profili p where p.username::text like 'ritorno\_%';
select is((select count(*)::int from public.profili where username::text like 'ritorno\_%'), 6,
          'Sei amici adulti di prova per il limite di 5');
select tests.autentica_come('adulto_21');
select throws_ok($$ select public.avvia_ritorno(now() + interval '1 hour',
                      (select array_agg(p.id) from public.profili p where p.username::text like 'ritorno\_%')) $$,
                 'NX057', null, 'R-31: al massimo 5 amici per ritorno');
select lives_ok($$ select public.avvia_ritorno(now() + interval '1 hour',
                     (select array_agg(p.id) from (select id from public.profili
                       where username::text like 'ritorno\_%' order by username limit 5) p)) $$,
                '21 anni: ritorno con 5 amici');
select throws_ok($$ insert into public.ritorni_destinatari (ritorno_id, amico_id)
                    values (tests.ritorno_di('adulto_21'), tests.id('adulto_20')) $$,
                 'NX057', null, 'R-31: il sesto destinatario non entra');

-- ---------------------------------------------------------------------------------------------
-- Notifiche e destinatari
-- ---------------------------------------------------------------------------------------------
select tests.esci();
select is((select dati from public.notifiche
           where utente_id = tests.id('minore_16') and tipo = 'ritorno_avviato'),
          jsonb_build_object('ritorno_id', tests.ritorno_di('minore_15'), 'utente_id', tests.id('minore_15')),
          'La notifica ritorno_avviato contiene solo identificativi');
select is((select count(*)::int from public.notifiche
           where utente_id = tests.id('adulto_21') and tipo = 'ritorno_avviato'
             and dati ->> 'utente_id' = tests.id('minore_15')::text), 0,
          'Chi è stato escluso non riceve la notifica');

select tests.autentica_come('minore_16');
select is((select count(*)::int from public.ritorni_destinatari), 1,
          'Il destinatario vede solo la propria riga');
select throws_ok($$ insert into public.ritorni_destinatari (ritorno_id, amico_id)
                    values (tests.ritorno_di('minore_15'), tests.id('minore_16')) $$,
                 '42501', null, 'Il destinatario non aggiunge persone al ritorno di altri');
update public.ritorni_sicuri set stato = 'arrivato' where utente_id = tests.id('minore_15');
delete from public.ritorni_destinatari where amico_id = tests.id('minore_16');
select tests.esci();
select is((select stato::text from public.ritorni_sicuri where id = tests.ritorno_di('minore_15')), 'attivo',
          'Il destinatario non conclude né cambia il ritorno di altri');
select is((select count(*)::int from public.ritorni_destinatari where ritorno_id = tests.ritorno_di('minore_15')), 1,
          'Il destinatario non si toglie dalle righe del titolare');

-- ---------------------------------------------------------------------------------------------
-- Posizioni (R-31, R-34)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select throws_ok($$ select public.invia_posizione_ritorno(tests.ritorno_di('minore_15'), 45.58, 9.27, 20) $$,
                 '42501', null, 'Solo il titolare invia posizioni');
select tests.autentica_come('minore_15');
select lives_ok($$ select public.invia_posizione_ritorno(tests.ritorno_di('minore_15'), 45.58, 9.27, 20) $$,
                'Il titolare invia la posizione');
select throws_ok($$ select public.invia_posizione_ritorno(tests.ritorno_di('minore_15'), 45.581, 9.271, 20) $$,
                 'NX060', null, 'R-31: al massimo una posizione ogni 30 secondi');
select throws_ok($$ select public.invia_posizione_ritorno(tests.ritorno_di('minore_15'), 95, 9.27, 20) $$,
                 '22023', null, 'Una latitudine fuori scala è rifiutata');
select throws_ok($$ insert into public.posizioni_ritorno (ritorno_id, posizione, precisione_m, registrata_il)
                    values (tests.ritorno_di('minore_15'), 'SRID=4326;POINT(9.27 45.58)', 20, now() - interval '1 day') $$,
                 '42501', null, 'L''ora della posizione la decide il database');
select isnt((select ultima_posizione_il from public.ritorni_sicuri where id = tests.ritorno_di('minore_15')),
            null::timestamptz, 'ultima_posizione_il si aggiorna');
select tests.autentica_come('minore_16');
select is((select count(*)::int from public.posizioni_ritorno), 1, 'Il destinatario vede la posizione');
select is((public.ritorni_vivi() -> 'ricevuti' -> 0 -> 'posizione' ->> 'precisione_m')::real, 20::real,
          'ritorni_vivi: il destinatario vede l''ultima posizione con la precisione');
select is(public.ritorni_vivi() -> 'mio', 'null'::jsonb, 'ritorni_vivi: il destinatario non ha un ritorno suo');
select ok(public.ritorni_vivi() -> 'ricevuti' -> 0 -> 'destinatari' is null,
          'ritorni_vivi: chi riceve non vede gli altri destinatari');
select tests.autentica_come('adulto_21');
select is((select count(*)::int from public.posizioni_ritorno p
           where p.ritorno_id = tests.ritorno_di('minore_15')), 0,
          'R-31: chi non è destinatario non vede le posizioni');
select is(jsonb_array_length(public.ritorni_vivi() -> 'ricevuti'), 1,
          'ritorni_vivi: il 21enne riceve solo il ritorno del 20enne');
select tests.autentica_come('minore_15');
select is(jsonb_array_length(public.ritorni_vivi() -> 'mio' -> 'destinatari'), 1,
          'ritorni_vivi: il titolare vede i propri destinatari');

-- Realtime: il canale del ritorno lo ascoltano solo titolare e destinatari.
select ok(private.puo_ascoltare('ritorno:' || tests.ritorno_di('minore_15')::text),
          'Il titolare ascolta il canale del proprio ritorno');
select tests.autentica_come('minore_16');
select ok(private.puo_ascoltare('ritorno:' || tests.ritorno_di('minore_15')::text),
          'Il destinatario ascolta il canale del ritorno');
select tests.autentica_come('adulto_21');
select ok(not private.puo_ascoltare('ritorno:' || tests.ritorno_di('minore_15')::text),
          'R-31: chi non è destinatario non ascolta il canale');
select tests.autentica_come('moderatore');
select ok(not private.puo_ascoltare('ritorno:' || tests.ritorno_di('minore_15')::text),
          'R-69: il moderatore non ascolta il canale');

-- ---------------------------------------------------------------------------------------------
-- Proroga e fine (R-31)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
select throws_ok($$ select public.proroga_ritorno(tests.ritorno_di('minore_15'), 20) $$,
                 '22023', null, 'Si proroga solo di 15 o 30 minuti');
select is(public.proroga_ritorno(tests.ritorno_di('minore_15'), 30),
          (select avviato_il + interval '90 minutes' from public.ritorni_sicuri where id = tests.ritorno_di('minore_15')),
          'Proroga di 30 minuti dall''arrivo previsto');
select tests.autentica_come('adulto_20');
select throws_ok($$ select public.proroga_ritorno(tests.ritorno_di('adulto_20'), 15) $$,
                 'NX058', null, 'R-31: oltre le 4 ore dall''avvio non si proroga');
select throws_ok($$ update public.ritorni_sicuri set arrivo_previsto = now() + interval '20 minutes'
                    where id = tests.ritorno_di('adulto_20') $$,
                 'NX058', null, 'L''arrivo previsto non si anticipa');
select throws_ok($$ update public.ritorni_sicuri set stato = 'scaduto' where id = tests.ritorno_di('adulto_20') $$,
                 '42501', null, 'Un ritorno scade solo da sé');
select throws_ok($$ select public.proroga_ritorno(tests.ritorno_di('minore_15'), 15) $$,
                 'NX059', null, 'Non si proroga il ritorno di altri');

select tests.autentica_come('minore_15');
select lives_ok($$ update public.ritorni_sicuri set stato = 'arrivato' where id = tests.ritorno_di('minore_15') $$,
                '"Sono arrivato" in un tocco');
select isnt((select concluso_il from public.ritorni_sicuri where id = tests.ritorno_di('minore_15')),
            null::timestamptz, 'La fine la scrive il database');
select throws_ok($$ update public.ritorni_sicuri set stato = 'annullato' where id = tests.ritorno_di('minore_15') $$,
                 'NX059', null, 'Un ritorno concluso non cambia più');
select throws_ok($$ select public.invia_posizione_ritorno(tests.ritorno_di('minore_15'), 45.58, 9.27, 20) $$,
                 'NX059', null, 'Nessuna posizione dopo la fine');
select tests.esci();
select is((select dati from public.notifiche
           where utente_id = tests.id('minore_16') and tipo = 'ritorno_arrivato'),
          jsonb_build_object('ritorno_id', tests.ritorno_di('minore_15'), 'utente_id', tests.id('minore_15')),
          'Notifica ritorno_arrivato con i soli identificativi');
select tests.autentica_come('minore_16');
select is((select stato::text from public.ritorni_sicuri where utente_id = tests.id('minore_15')), 'arrivato',
          'Il destinatario vede l''esito per 15 minuti');
select is((select count(*)::int from public.posizioni_ritorno), 0,
          'R-31: con l''esito la posizione non si vede più');
select tests.esci();
alter table public.ritorni_sicuri disable trigger ritorni_sicuri_proteggi;
update public.ritorni_sicuri set concluso_il = now() - interval '16 minutes'
where id = tests.ritorno_di('minore_15');
alter table public.ritorni_sicuri enable trigger ritorni_sicuri_proteggi;
select tests.autentica_come('minore_16');
select is((select count(*)::int from public.ritorni_sicuri where utente_id = tests.id('minore_15')), 0,
          'Dopo 15 minuti l''esito sparisce');

-- Conservazione: 24 ore dopo la fine il ritorno si cancella con le posizioni (R-31).
select tests.esci();
alter table public.ritorni_sicuri disable trigger ritorni_sicuri_proteggi;
update public.ritorni_sicuri set concluso_il = now() - interval '25 hours'
where id = tests.ritorno_di('minore_15');
alter table public.ritorni_sicuri enable trigger ritorni_sicuri_proteggi;
select private.applica_conservazione();
select is((select count(*)::int from public.ritorni_sicuri where utente_id = tests.id('minore_15')), 0,
          'R-31: un ritorno concluso da più di 24 ore si cancella');
select is((select count(*)::int from public.posizioni_ritorno), 0,
          'R-31: con il ritorno si cancellano le sue posizioni');

-- Si può avviare un nuovo ritorno dopo la fine del precedente.
select tests.autentica_come('minore_15');
select lives_ok($$ select public.avvia_ritorno(now() + interval '15 minutes', array[tests.id('minore_16')]) $$,
                'Un nuovo ritorno dopo la fine del precedente');

-- Togliere l'ultimo destinatario annulla il ritorno.
select lives_ok($$ delete from public.ritorni_destinatari
                   where ritorno_id = tests.ritorno_di('minore_15') and amico_id = tests.id('minore_16') $$,
                'Il titolare toglie un destinatario');
select is((select stato::text from public.ritorni_sicuri where id = tests.ritorno_di('minore_15')), 'annullato',
          'Togliere l''ultima persona annulla il ritorno');
select tests.esci();
select is((select count(*)::int from public.notifiche n
           where n.utente_id = tests.id('minore_16') and n.dati ->> 'ritorno_id' = tests.ritorno_di('minore_15')::text), 0,
          'Chi è tolto perde le notifiche di quel ritorno');

-- ---------------------------------------------------------------------------------------------
-- R-17: blocco e amicizia rimossa
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_17');
select is((select count(*)::int from public.ritorni_sicuri where utente_id = tests.id('adulto_18')), 1,
          'Prima del blocco il 17enne vede il ritorno del 18enne');
select lives_ok($$ insert into public.blocchi (bloccante_id, bloccato_id) values (tests.id('minore_17'), tests.id('adulto_18')) $$,
                '17 anni blocca il 18enne');
select is((select count(*)::int from public.ritorni_sicuri where utente_id = tests.id('adulto_18')), 0,
          'R-17: il blocco toglie subito il ritorno dell''altro');
select tests.esci();
select is((select count(*)::int from public.ritorni_destinatari d
           where d.ritorno_id in (tests.ritorno_di('adulto_18'), tests.ritorno_di('minore_17'))), 0,
          'R-17: il blocco toglie i destinatari nelle due direzioni');
select is((select count(*)::int from public.ritorni_sicuri
           where id in (tests.ritorno_di('adulto_18'), tests.ritorno_di('minore_17')) and stato = 'annullato'), 2,
          'Senza destinatari i due ritorni si annullano');

select tests.autentica_come('adulto_21');
select lives_ok($$ delete from public.amicizie
                   where least(richiedente_id, destinatario_id) = least(tests.id('adulto_20'), tests.id('adulto_21'))
                     and greatest(richiedente_id, destinatario_id) = greatest(tests.id('adulto_20'), tests.id('adulto_21')) $$,
                '21 anni rimuove l''amicizia con il 20enne');
select is((select count(*)::int from public.ritorni_sicuri where utente_id = tests.id('adulto_20')), 0,
          'R-17: un''amicizia rimossa toglie il ritorno');

-- ---------------------------------------------------------------------------------------------
-- Allerta e scadenza dal server (ADR-0006, R-31)
-- ---------------------------------------------------------------------------------------------
select tests.esci();
alter table public.ritorni_sicuri disable trigger ritorni_sicuri_proteggi;
update public.ritorni_sicuri
set avviato_il = now() - interval '2 hours', arrivo_previsto = now() - interval '1 minute'
where id = tests.ritorno_di('adulto_21');
alter table public.ritorni_sicuri enable trigger ritorni_sicuri_proteggi;
select private.verifica_ritorni_scaduti();
select is((select count(*)::int from public.notifiche n
           where n.tipo = 'ritorno_allerta' and n.dati ->> 'ritorno_id' = tests.ritorno_di('adulto_21')::text), 5,
          'Arrivo previsto superato: allerta a tutti i 5 destinatari');
select isnt((select allerta_inviata_il from public.ritorni_sicuri where id = tests.ritorno_di('adulto_21')),
            null::timestamptz, 'L''allerta si registra');
select private.verifica_ritorni_scaduti();
select is((select count(*)::int from public.notifiche n
           where n.tipo = 'ritorno_allerta' and n.dati ->> 'ritorno_id' = tests.ritorno_di('adulto_21')::text), 5,
          'L''allerta parte una volta sola');
select is((select n.dati from public.notifiche n
           where n.tipo = 'ritorno_allerta' and n.dati ->> 'ritorno_id' = tests.ritorno_di('adulto_21')::text limit 1),
          jsonb_build_object('ritorno_id', tests.ritorno_di('adulto_21'), 'utente_id', tests.id('adulto_21')),
          'L''allerta non contiene coordinate (la posizione si legge con la RLS)');

select tests.autentica_come('adulto_21');
select lives_ok($$ select public.proroga_ritorno(tests.ritorno_di('adulto_21'), 15) $$,
                'Dopo l''allerta si può prorogare da adesso');
select is((select allerta_inviata_il from public.ritorni_sicuri where id = tests.ritorno_di('adulto_21')),
          null::timestamptz, 'La proroga riporta il ritorno in viaggio');

select tests.esci();
alter table public.ritorni_sicuri disable trigger ritorni_sicuri_proteggi;
update public.ritorni_sicuri
set avviato_il = now() - interval '3 hours 30 minutes', arrivo_previsto = now() - interval '2 hours 1 minute'
where id = tests.ritorno_di('adulto_21');
alter table public.ritorni_sicuri enable trigger ritorni_sicuri_proteggi;
select private.verifica_ritorni_scaduti();
select is((select stato::text from public.ritorni_sicuri where id = tests.ritorno_di('adulto_21')), 'scaduto',
          'R-31: 2 ore dopo l''arrivo previsto il ritorno scade da solo');
select isnt((select concluso_il from public.ritorni_sicuri where id = tests.ritorno_di('adulto_21')),
            null::timestamptz, 'Anche la scadenza registra la fine');

-- ---------------------------------------------------------------------------------------------
-- Conservazione: i ritorni conclusi da meno di 24 ore restano
-- ---------------------------------------------------------------------------------------------
select private.applica_conservazione();
select is((select count(*)::int from public.ritorni_sicuri where stato <> 'attivo'
           and concluso_il > now() - interval '24 hours'), 5,
          'I ritorni conclusi da meno di 24 ore restano');

-- ---------------------------------------------------------------------------------------------
-- Esportazione (R-64) e suggerimenti
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_21');
select is(jsonb_array_length(public.esporta_miei_dati() -> 'ritorni_sicuri'), 1,
          'R-64: l''esportazione contiene i propri ritorni');
select ok(public.suggerimenti_ritorno() ? 'serate', 'suggerimenti_ritorno risponde con le serate');
select tests.autentica_come('minore_14');
select is(public.esporta_miei_dati() -> 'ritorni_sicuri', '[]'::jsonb,
          'R-64: nessun ritorno di altri nell''esportazione');

select * from finish();
rollback;
