-- serate_gruppo e partecipazioni_serata (DATA_MODEL.md §5.4): evento adatto a tutto il gruppo,
-- testi brevi, risposte, trasporto e passaggi, stati della serata, notifiche e Realtime.
-- Regole: R-16, R-17, R-20, R-23, R-24, R-69. Trigger: verifica_trasporto.
begin;
select plan(61);

-- Eventi di prova da domani, indipendenti dalla data del seed.
insert into public.eventi (id, locale_id, titolo, inizio, fine, eta_minima, eta_minima_dichiarata,
                           riferimenti_alcol, url_biglietti, stato)
values
  ('00000000-0000-4000-8000-00000000f714', '00000000-0000-4000-8000-00000000c002', 'Prova 14',
   now() + interval '1 day', now() + interval '1 day 4 hours', 14, true, false, null, 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f716', '00000000-0000-4000-8000-00000000c001', 'Prova 16',
   now() + interval '1 day', now() + interval '1 day 4 hours', 16, true, false,
   'https://binario7.example/biglietti/prova', 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f718', '00000000-0000-4000-8000-00000000c001', 'Prova 18',
   now() + interval '1 day', now() + interval '1 day 4 hours', 18, true, false, null, 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f719', '00000000-0000-4000-8000-00000000c005', 'Prova alcol',
   now() + interval '1 day', now() + interval '1 day 4 hours', 16, true, true, null, 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f721', '00000000-0000-4000-8000-00000000c004', 'Prova 21',
   now() + interval '2 days', now() + interval '2 days 4 hours', 21, true, false, null, 'pubblicato'),
  ('00000000-0000-4000-8000-00000000f799', '00000000-0000-4000-8000-00000000c002', 'Prova in revisione',
   now() + interval '1 day', now() + interval '1 day 4 hours', 14, true, false, null, 'in_revisione');

create function tests.ev(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000f' || n)::uuid;
$$;
grant execute on function tests.ev(text) to authenticated;

-- Gruppi: «Misto» (adulto_18 admin, minore_16, minore_17), «Ventuno» (adulto_21),
-- «Quindici» (minore_15, minore_16), «Da solo» (minore_14).
select tests.rendi_amici('minore_16', 'adulto_18');
select tests.rendi_amici('minore_16', 'minore_17');
select tests.autentica_come('adulto_18');
select public.crea_gruppo('Misto', array[tests.id('minore_16'), tests.id('minore_17')]);
select tests.autentica_come('minore_16');
update public.membri_gruppo set stato = 'attivo' where gruppo_id = tests.gruppo('Misto') and utente_id = tests.id('minore_16');
select tests.autentica_come('minore_17');
update public.membri_gruppo set stato = 'attivo' where gruppo_id = tests.gruppo('Misto') and utente_id = tests.id('minore_17');
select tests.autentica_come('adulto_21');
select public.crea_gruppo('Ventuno');
select tests.autentica_come('minore_15');
select public.crea_gruppo('Quindici', array[tests.id('minore_16')]);
select tests.autentica_come('minore_16');
update public.membri_gruppo set stato = 'attivo' where gruppo_id = tests.gruppo('Quindici') and utente_id = tests.id('minore_16');
select tests.autentica_come('minore_14');
select public.crea_gruppo('Da solo');

-- ---------------------------------------------------------------------------------------------
-- R-24: evento adatto a tutti i membri attivi
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_18');
select throws_ok(
  $$ insert into public.serate_gruppo (gruppo_id, evento_id, creata_da)
     values (tests.gruppo('Misto'), tests.ev('718'), tests.id('adulto_18')) $$,
  '42501', null,
  'R-20, R-24: un evento 18+ non si propone in un gruppo con minorenni'
);
select throws_ok(
  $$ insert into public.serate_gruppo (gruppo_id, evento_id, creata_da)
     values (tests.gruppo('Misto'), tests.ev('719'), tests.id('adulto_18')) $$,
  '42501', null,
  'R-23, R-24: un evento con riferimenti all''alcol non si propone in un gruppo con minorenni'
);
select lives_ok(
  $$ insert into public.serate_gruppo (gruppo_id, evento_id, creata_da, ora_ritrovo, luogo_ritrovo)
     values (tests.gruppo('Misto'), tests.ev('716'), tests.id('adulto_18'), '21:30', 'Stazione di Monza') $$,
  'R-24: un evento 16+ è adatto a un gruppo di 16, 17 e 18 anni'
);
select results_eq(
  $$ select url_prevendita, data_serata = (select data_serata from public.eventi where id = tests.ev('716'))
     from public.serate_gruppo where evento_id = tests.ev('716') $$,
  $$ values ('https://binario7.example/biglietti/prova', true) $$,
  'Data e link alla prevendita arrivano dall''evento'
);
select results_eq(
  $$ select titolo from public.eventi_adatti_al_gruppo(tests.gruppo('Misto'), 'prova') order by titolo $$,
  array['Prova 14', 'Prova 16'],
  'R-24: il selettore mostra solo gli eventi adatti a tutto il gruppo'
);
select tests.autentica_come('minore_16');
select throws_ok(
  $$ insert into public.serate_gruppo (gruppo_id, evento_id, creata_da)
     values (tests.gruppo('Misto'), tests.ev('799'), tests.id('minore_16')) $$,
  'NX043', null,
  'Un evento in revisione non si propone'
);
select tests.autentica_come('adulto_20');
select throws_ok($$ select * from public.eventi_adatti_al_gruppo(tests.gruppo('Misto')) $$, '42501', null,
                 'Chi non è nel gruppo non cerca eventi per il gruppo');

select tests.autentica_come('adulto_21');
select lives_ok(
  $$ insert into public.serate_gruppo (gruppo_id, evento_id, creata_da)
     values (tests.gruppo('Ventuno'), tests.ev('721'), tests.id('adulto_21')) $$,
  'Un ventunenne propone un evento 21+ nel suo gruppo'
);
select lives_ok(
  $$ insert into public.serate_gruppo (gruppo_id, titolo, data_serata, creata_da)
     values (tests.gruppo('Ventuno'), 'Cena da Sara', current_date + 1, tests.id('adulto_21')) $$,
  'Serata libera nel gruppo Ventuno'
);
select lives_ok(
  $$ select public.invita_nel_gruppo(tests.gruppo('Ventuno'), array[tests.id('adulto_20')]) $$,
  'adulto_21 invita adulto_20'
);
select tests.autentica_come('adulto_20');
select is_empty($$ select 1 from public.serate_gruppo where gruppo_id = tests.gruppo('Ventuno') $$,
                'Chi è solo invitato non vede le serate del gruppo');
update public.membri_gruppo set stato = 'attivo'
where gruppo_id = tests.gruppo('Ventuno') and utente_id = tests.id('adulto_20');
select results_eq(
  $$ select titolo from public.serate_gruppo where gruppo_id = tests.gruppo('Ventuno') $$,
  array['Cena da Sara'],
  'R-24: entrato nel gruppo, un ventenne vede la serata libera ma non quella 21+'
);
select is_empty($$ select 1 from public.dettaglio_serata(tests.serata('Prova 21')) $$,
                'R-24: il dettaglio della serata 21+ non c''è per lui');
select tests.autentica_come('adulto_21');
select throws_ok(
  $$ insert into public.serate_gruppo (gruppo_id, evento_id, creata_da)
     values (tests.gruppo('Ventuno'), tests.ev('721'), tests.id('adulto_21')) $$,
  '42501', null,
  'R-24: con un ventenne nel gruppo l''evento 21+ non è più proponibile'
);

-- ---------------------------------------------------------------------------------------------
-- Serata libera e testi brevi (R-16)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
select lives_ok(
  $$ insert into public.serate_gruppo (gruppo_id, titolo, data_serata, luogo_ritrovo, note, creata_da)
     values (tests.gruppo('Misto'), 'Pizza e poi da Marco', current_date + 1, 'Pizzeria in piazza',
             repeat('n', 500), tests.id('minore_16')) $$,
  'Serata libera con note di 500 caratteri'
);
select throws_ok(
  $$ insert into public.serate_gruppo (gruppo_id, titolo, data_serata, note, creata_da)
     values (tests.gruppo('Misto'), 'Troppo', current_date + 1, repeat('n', 501), tests.id('minore_16')) $$,
  '23514', null, 'R-16: le note hanno al massimo 500 caratteri'
);
select throws_ok(
  $$ insert into public.serate_gruppo (gruppo_id, titolo, data_serata, creata_da)
     values (tests.gruppo('Misto'), repeat('t', 81), current_date + 1, tests.id('minore_16')) $$,
  '23514', null, 'R-16: il titolo ha al massimo 80 caratteri'
);
select throws_ok(
  $$ insert into public.serate_gruppo (gruppo_id, data_serata, creata_da)
     values (tests.gruppo('Misto'), current_date + 1, tests.id('minore_16')) $$,
  '23514', null, 'Una serata libera ha un titolo'
);
select throws_ok(
  $$ insert into public.serate_gruppo (gruppo_id, titolo, data_serata, url_lista, creata_da)
     values (tests.gruppo('Misto'), 'Lista', current_date + 1, 'http://lista.example', tests.id('minore_16')) $$,
  '23514', null, 'I link a prevendita e lista sono solo https'
);
select throws_ok(
  $$ insert into public.serate_gruppo (gruppo_id, titolo, data_serata, creata_da)
     values (tests.gruppo('Misto'), 'Ieri', current_date - 2, tests.id('minore_16')) $$,
  'NX042', null, 'Non si propone una serata nel passato'
);
select throws_ok(
  $$ insert into public.serate_gruppo (gruppo_id, titolo, data_serata, creata_da)
     values (tests.gruppo('Misto'), 'A nome di altri', current_date + 1, tests.id('minore_17')) $$,
  '42501', null, 'Si propone una serata solo a proprio nome'
);
select tests.autentica_come('minore_17');
select isnt_empty(
  $$ select 1 from public.notifiche where tipo = 'nuova_serata'
       and dati @> jsonb_build_object('serata_id', tests.serata('Pizza e poi da Marco')) $$,
  'Gli altri membri ricevono la notifica della nuova serata'
);
select tests.autentica_come('minore_16');
select is_empty(
  $$ select 1 from public.notifiche where tipo = 'nuova_serata'
       and dati @> jsonb_build_object('serata_id', tests.serata('Pizza e poi da Marco')) $$,
  'Chi propone non riceve la propria notifica'
);

-- ---------------------------------------------------------------------------------------------
-- Visibilità (R-69 e chi non è nel gruppo)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_21');
select is_empty($$ select 1 from public.serate_gruppo where gruppo_id = tests.gruppo('Misto') $$,
                'Chi non è nel gruppo non vede le serate');
select throws_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta)
     values (tests.serata('Prova 16'), tests.id('adulto_21'), 'si') $$,
  '42501', null, 'Chi non è nel gruppo non risponde'
);
select tests.autentica_come('moderatore');
select is_empty($$ select 1 from public.serate_gruppo $$, 'R-69: i moderatori non vedono le serate');
select is_empty($$ select 1 from public.partecipazioni_serata $$, 'R-69: né le risposte');

-- ---------------------------------------------------------------------------------------------
-- Trasporto (F-16): "guido" solo per i maggiorenni, per ogni età del seed
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
insert into public.serate_gruppo (gruppo_id, titolo, data_serata, creata_da)
values (tests.gruppo('Da solo'), 'Giro in centro', current_date + 1, tests.id('minore_14'));
select throws_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, trasporto_andata)
     values (tests.serata('Giro in centro'), tests.id('minore_14'), 'si', 'auto_guido') $$,
  'NX040', null, 'A 14 anni "guido" non è ammesso'
);
select tests.autentica_come('minore_15');
insert into public.serate_gruppo (gruppo_id, titolo, data_serata, creata_da)
values (tests.gruppo('Quindici'), 'Cinema', current_date + 1, tests.id('minore_15'));
select throws_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, trasporto_ritorno)
     values (tests.serata('Cinema'), tests.id('minore_15'), 'si', 'auto_guido') $$,
  'NX040', null, 'A 15 anni "guido" non è ammesso'
);
select tests.autentica_come('minore_16');
select throws_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, trasporto_andata)
     values (tests.serata('Prova 16'), tests.id('minore_16'), 'si', 'auto_guido') $$,
  'NX040', null, 'A 16 anni "guido" non è ammesso'
);
select tests.autentica_come('minore_17');
select throws_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, trasporto_ritorno)
     values (tests.serata('Prova 16'), tests.id('minore_17'), 'si', 'auto_guido') $$,
  'NX040', null, 'A 17 anni "guido" non è ammesso'
);
select tests.autentica_come('adulto_20');
select lives_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, trasporto_andata, posti_liberi)
     values (tests.serata('Cena da Sara'), tests.id('adulto_20'), 'si', 'auto_guido', 3) $$,
  'A 20 anni si guida'
);
select tests.autentica_come('adulto_21');
select lives_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, trasporto_ritorno)
     values (tests.serata('Cena da Sara'), tests.id('adulto_21'), 'si', 'auto_guido') $$,
  'A 21 anni si guida'
);
select results_eq(
  $$ select posti_liberi from public.partecipazioni_serata
     where serata_id = tests.serata('Cena da Sara') and utente_id = tests.id('adulto_21') $$,
  array[0::smallint], 'Chi guida senza indicare i posti ne ha 0'
);
select tests.autentica_come('adulto_18');
select lives_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, biglietto,
                                              trasporto_andata, trasporto_ritorno, posti_liberi)
     values (tests.serata('Prova 16'), tests.id('adulto_18'), 'si', 'prevendita',
             'auto_guido', 'auto_guido', 1) $$,
  'A 18 anni si guida e si offrono posti'
);
select throws_ok(
  $$ update public.partecipazioni_serata set posti_liberi = 9
     where serata_id = tests.serata('Prova 16') and utente_id = tests.id('adulto_18') $$,
  '23514', null, 'Al massimo 8 posti liberi'
);

-- Passaggi
select tests.autentica_come('minore_17');
select lives_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, trasporto_andata,
                                              trasporto_ritorno, passaggio_da)
     values (tests.serata('Prova 16'), tests.id('minore_17'), 'si', 'mezzi_pubblici', 'passaggio',
             tests.id('adulto_18')) $$,
  'Un minorenne sceglie il passaggio da chi guida'
);
select tests.autentica_come('minore_16');
select throws_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, trasporto_ritorno, passaggio_da)
     values (tests.serata('Prova 16'), tests.id('minore_16'), 'si', 'passaggio', tests.id('adulto_18')) $$,
  'NX041', null, 'Finiti i posti, il passaggio non si sceglie'
);
select throws_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, trasporto_ritorno, passaggio_da)
     values (tests.serata('Prova 16'), tests.id('minore_16'), 'si', 'passaggio', tests.id('minore_17')) $$,
  'NX039', null, 'Il passaggio si chiede solo a chi guida'
);
select lives_ok(
  $$ insert into public.partecipazioni_serata (serata_id, utente_id, risposta, trasporto_ritorno)
     values (tests.serata('Prova 16'), tests.id('minore_16'), 'forse', 'a_piedi') $$,
  'minore_16 risponde forse'
);
select is_empty(
  $$ update public.partecipazioni_serata set risposta = 'no'
     where serata_id = tests.serata('Prova 16') and utente_id = tests.id('minore_17') returning 1 $$,
  'Ognuno cambia solo la propria risposta'
);
select results_eq(
  $$ select count(*)::integer, count(*) filter (where risposta = 'si')::integer
     from public.partecipazioni_serata where serata_id = tests.serata('Prova 16') $$,
  $$ values (3, 2) $$,
  'I membri vedono le risposte di tutti'
);
select tests.autentica_come('adulto_18');
select throws_ok(
  $$ update public.partecipazioni_serata set posti_liberi = 0
     where serata_id = tests.serata('Prova 16') and utente_id = tests.id('adulto_18') $$,
  'NX041', null, 'Chi guida non scende sotto i posti già occupati'
);
select lives_ok(
  $$ update public.partecipazioni_serata set trasporto_andata = 'mezzi_pubblici', trasporto_ritorno = 'mezzi_pubblici'
     where serata_id = tests.serata('Prova 16') and utente_id = tests.id('adulto_18') $$,
  'Chi guidava sceglie i mezzi pubblici'
);
select results_eq(
  $$ select passaggio_da, posti_liberi from public.partecipazioni_serata
     where serata_id = tests.serata('Prova 16') and utente_id in (tests.id('minore_17'), tests.id('adulto_18'))
     order by utente_id $$,
  $$ values (null::uuid, null::smallint), (null::uuid, null::smallint) $$,
  'I passaggi che offriva si liberano e i posti spariscono'
);

-- ---------------------------------------------------------------------------------------------
-- Blocco tra membri (R-17)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_16');
insert into public.blocchi (bloccante_id, bloccato_id) values (tests.id('minore_16'), tests.id('minore_17'));
select is_empty(
  $$ select 1 from public.partecipazioni_serata
     where serata_id = tests.serata('Prova 16') and utente_id = tests.id('minore_17') $$,
  'R-17: la risposta di chi si è bloccato non si vede'
);
select results_eq(
  $$ select altri, jsonb_array_length(partecipanti) from public.dettaglio_serata(tests.serata('Prova 16')) $$,
  $$ values (1, 2) $$,
  'R-17: nel dettaglio la persona bloccata è solo contata'
);

-- ---------------------------------------------------------------------------------------------
-- Stati della serata
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_17');
select is_empty(
  $$ update public.serate_gruppo set stato = 'confermata' where id = tests.serata('Prova 16') returning 1 $$,
  'Solo chi ha proposto o un admin conferma la serata'
);
select tests.autentica_come('adulto_18');
select lives_ok($$ update public.serate_gruppo set stato = 'confermata' where id = tests.serata('Prova 16') $$,
                'Chi ha proposto conferma la serata');
select throws_ok($$ update public.serate_gruppo set stato = 'proposta' where id = tests.serata('Prova 16') $$,
                 'NX026', null, 'Una serata confermata non torna proposta');
select tests.autentica_come('minore_16');
select isnt_empty(
  $$ select 1 from public.notifiche where tipo = 'aggiornamento_serata'
       and dati @> jsonb_build_object('serata_id', tests.serata('Prova 16'), 'cambio', 'confermata') $$,
  'I membri ricevono la notifica della conferma'
);
select tests.autentica_come('adulto_18');
select lives_ok($$ update public.serate_gruppo set stato = 'annullata' where id = tests.serata('Prova 16') $$,
                'Chi ha proposto annulla la serata');
select throws_ok($$ update public.serate_gruppo set note = 'Ci ripensiamo' where id = tests.serata('Prova 16') $$,
                 'NX026', null, 'Una serata annullata è in sola lettura');
select tests.autentica_come('minore_16');
select throws_ok(
  $$ update public.partecipazioni_serata set risposta = 'si'
     where serata_id = tests.serata('Prova 16') and utente_id = tests.id('minore_16') $$,
  'NX026', null, 'A una serata annullata non si risponde più'
);
select lives_ok($$ update public.serate_gruppo set note = 'Portate le giacche' where id = tests.serata('Pizza e poi da Marco') $$,
                'Chi ha proposto modifica le note');
select tests.autentica_come('adulto_18');
select lives_ok($$ update public.serate_gruppo set luogo_ritrovo = 'Piazza Roma' where id = tests.serata('Pizza e poi da Marco') $$,
                'Un admin modifica la serata proposta da altri');
select results_eq(
  $$ select testi_scritti_da from public.serate_gruppo where id = tests.serata('Pizza e poi da Marco') $$,
  array[tests.id('adulto_18')], 'Si registra chi ha scritto gli ultimi testi'
);

-- ---------------------------------------------------------------------------------------------
-- Uscita dal gruppo, eliminazione, Realtime
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_17');
delete from public.membri_gruppo where gruppo_id = tests.gruppo('Misto') and utente_id = tests.id('minore_17');
select tests.esci();
select is_empty(
  $$ select 1 from public.partecipazioni_serata where utente_id = tests.id('minore_17')
       and serata_id in (select id from public.serate_gruppo where gruppo_id = tests.gruppo('Misto')) $$,
  'Chi esce dal gruppo non compare più nelle risposte'
);
select tests.autentica_come('adulto_18');
select lives_ok($$ delete from public.serate_gruppo where id = tests.serata('Pizza e poi da Marco') $$,
                'Un admin elimina una serata');
select tests.esci();
select is_empty(
  $$ select 1 from public.notifiche n
     where n.tipo in ('nuova_serata', 'aggiornamento_serata')
       and not exists (select 1 from public.serate_gruppo s where s.id = (n.dati ->> 'serata_id')::uuid) $$,
  'Le notifiche della serata eliminata spariscono'
);
-- Postgres Changes non applica la RLS ai DELETE: le serate usano Broadcast privato (035).
select is_empty(
  $$ select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and tablename in ('membri_gruppo', 'partecipazioni_serata', 'serate_gruppo') $$,
  'Le tabelle dei gruppi non sono pubblicate con Postgres Changes'
);

select * from finish();
rollback;
