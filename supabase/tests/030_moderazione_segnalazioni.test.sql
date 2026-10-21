-- Coda, dettaglio e decisioni delle segnalazioni; escalation (DATA_MODEL.md §5.2, §5.10;
-- SAFETY_PRIVACY.md §11). Regole: R-06, R-50, R-53, R-55, R-69; D-15 (ADR-0022).
-- Amici del seed: 15-16, 20-21, 18-17 (codice invito).
begin;
select plan(52);

create function tests.s(motivo text, segnalante text) returns uuid language sql stable as $$
  select x.id from public.segnalazioni x
  where x.motivo::text = $1 and x.segnalante_id = tests.id($2)
  order by x.stato = 'chiusa', x.creata_il desc limit 1;
$$;
grant execute on function tests.s(text, text) to authenticated;

-- Account non nuovi (D-15) e segnalazioni di esempio.
update public.profili set creato_il = now() - interval '30 days';
insert into storage.objects (bucket_id, name)
values ('avatar', tests.id('minore_16')::text || '/00000000-0000-4000-8000-0000000a0002.webp'),
       ('avatar', tests.id('adulto_18')::text || '/00000000-0000-4000-8000-0000000a0003.webp');
update public.profili set avatar_path = id::text || '/00000000-0000-4000-8000-0000000a0002.webp'
where id = tests.id('minore_16');
update public.profili set avatar_path = id::text || '/00000000-0000-4000-8000-0000000a0003.webp'
where id = tests.id('adulto_18');

select tests.autentica_come('minore_15');
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo, dettagli)
values (tests.id('minore_15'), 'profilo', tests.id('minore_16'), 'molestie', 'Messaggi offensivi'),
       (tests.id('minore_15'), 'foto_profilo', tests.id('minore_16'), 'adescamento_o_rischio_minore', null);
select tests.autentica_come('adulto_20');
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
values (tests.id('adulto_20'), 'profilo', tests.id('adulto_21'), 'spam'),
       (tests.id('adulto_20'), 'evento', '00000000-0000-4000-8000-00000000e001', 'evento_falso');
select tests.autentica_come('adulto_18');
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
values (tests.id('adulto_18'), 'evento', '00000000-0000-4000-8000-00000000e001', 'dati_errati');
select tests.autentica_come('minore_17');
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
values (tests.id('minore_17'), 'profilo', tests.id('adulto_18'), 'adescamento_o_rischio_minore');

-- ---------------------------------------------------------------------------------------------
-- Scadenze (R-53)
-- ---------------------------------------------------------------------------------------------
select tests.esci();
select is(private.scadenza_segnalazione(1::smallint, '2026-10-21 03:00 Europe/Rome'),
          '2026-10-21 10:00 Europe/Rome'::timestamptz,
          'R-53: una segnalazione urgente ricevuta di notte si gestisce entro le 10:00');
select is(private.scadenza_segnalazione(1::smallint, '2026-10-21 23:30 Europe/Rome'),
          '2026-10-22 03:30 Europe/Rome'::timestamptz,
          'R-53: una segnalazione urgente ricevuta di sera si gestisce entro 4 ore');
select is(private.scadenza_segnalazione(2::smallint, '2026-10-21 12:00 Europe/Rome'),
          '2026-10-22 12:00 Europe/Rome'::timestamptz, 'R-53: priorità 2 entro 24 ore');
select is(private.scadenza_segnalazione(3::smallint, '2026-10-21 12:00 Europe/Rome'),
          '2026-10-24 12:00 Europe/Rome'::timestamptz, 'R-53: priorità 3 entro 72 ore');

-- ---------------------------------------------------------------------------------------------
-- Accesso riservato (R-06)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_21');
select throws_ok($$ select public.coda_segnalazioni() $$, '42501', null,
                 'R-06: la coda delle segnalazioni è dei moderatori');
select throws_ok($$ select public.dettaglio_segnalazione(tests.s('spam', 'adulto_20')) $$, '42501', null,
                 'R-06: un utente non apre le segnalazioni');
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok(
  $$ select public.decidi_segnalazione(tests.s('spam', 'adulto_20'), 'nessuna_violazione', 'Ok') $$,
  '42501', null,
  'R-06: senza due fattori non si decide'
);
select throws_ok(
  $$ select public.escalation_segnalazione(tests.s('spam', 'adulto_20'), 'x', 'ESCALATION') $$,
  '42501', null,
  'R-06: senza due fattori nessuna escalation'
);

-- ---------------------------------------------------------------------------------------------
-- Coda e dettaglio (R-53, R-69)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('moderatore');
select ok(
  pg_get_function_result('public.coda_segnalazioni()'::regprocedure) !~ 'segnalante'
  and pg_get_function_result('public.dettaglio_segnalazione(uuid)'::regprocedure) !~ 'segnalante',
  'R-69: coda e dettaglio non restituiscono chi ha segnalato'
);
select is(
  (select array_agg(priorita order by n) from (
     select priorita, row_number() over () as n from public.coda_segnalazioni()) c),
  array[1, 1, 2, 3, 3, 3]::smallint[],
  'R-53: la coda è ordinata per priorità'
);
select is(
  (select stesso_oggetto from public.coda_segnalazioni() where motivo = 'evento_falso'),
  2,
  'La coda conta le segnalazioni sullo stesso oggetto'
);
select is(
  (select dettagli from public.dettaglio_segnalazione(tests.s('molestie', 'minore_15'))),
  'Messaggi offensivi',
  'Il dettaglio mostra il testo di chi ha segnalato'
);
select is(
  (select oggetto ->> 'username' from public.dettaglio_segnalazione(tests.s('molestie', 'minore_15'))),
  'minore_16',
  'Il dettaglio mostra il profilo segnalato'
);
select tests.esci();
select is(
  (select count(*)::int from public.azioni_moderazione
   where segnalazione_id = tests.s('molestie', 'minore_15') and azione = 'accesso_segnalazione'
     and moderatore_id = tests.id('moderatore')),
  2,
  'R-69: ogni apertura del dettaglio è registrata'
);

-- ---------------------------------------------------------------------------------------------
-- Presa in carico
-- ---------------------------------------------------------------------------------------------
update public.segnalazioni set gestita_da = tests.id('moderatore_senza_mfa'), stato = 'in_lavorazione'
where id = tests.s('dati_errati', 'adulto_18');
select tests.autentica_come('moderatore');
select throws_ok(
  $$ select public.prendi_in_carico_segnalazione(tests.s('dati_errati', 'adulto_18')) $$,
  'NX033', null,
  'Una segnalazione in carico a un altro moderatore non si prende'
);
select throws_ok(
  $$ select public.decidi_segnalazione(tests.s('dati_errati', 'adulto_18'), 'modifica_evento', 'Orari corretti') $$,
  'NX033', null,
  'Né si decide'
);
select lives_ok(
  $$ select public.prendi_in_carico_segnalazione(tests.s('spam', 'adulto_20')) $$,
  'Il moderatore prende in carico una segnalazione'
);
select is((select presa_da_me from public.coda_segnalazioni() where motivo = 'spam'), true,
          'La segnalazione risulta in carico a chi l''ha presa');

-- ---------------------------------------------------------------------------------------------
-- Decisioni (SAFETY_PRIVACY.md §11)
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.decidi_segnalazione(tests.s('spam', 'adulto_20'), 'nessuna_violazione', '  ') $$,
  'NX021', null,
  'Ogni decisione è motivata'
);
select throws_ok(
  $$ select public.decidi_segnalazione(tests.s('spam', 'adulto_20'), 'modifica_evento', 'Corretto') $$,
  '22023', null,
  '"Correggi evento" vale solo per gli eventi'
);
select throws_ok(
  $$ select public.decidi_segnalazione(tests.s('spam', 'adulto_20'), 'rimuovi_contenuto', 'Via') $$,
  '22023', null,
  'Per un profilo si sceglie cosa rimuovere'
);
select lives_ok(
  $$ select public.decidi_segnalazione(tests.s('spam', 'adulto_20'), 'nessuna_violazione',
                                       'Il profilo non viola le regole.') $$,
  'Nessuna violazione'
);
select throws_ok(
  $$ select public.decidi_segnalazione(tests.s('spam', 'adulto_20'), 'sospendi_account', 'Ripensato') $$,
  'NX025', null,
  'Una segnalazione chiusa non si decide di nuovo'
);
select lives_ok(
  $$ select public.decidi_segnalazione(tests.s('evento_falso', 'adulto_20'), 'nessuna_violazione',
                                       'L''evento è confermato dal sito del locale.') $$,
  'Decisione su un evento segnalato'
);
select lives_ok(
  $$ select public.decidi_segnalazione(tests.s('molestie', 'minore_15'), 'rimuovi_contenuto',
                                       'Nome visualizzato offensivo.', 'nome') $$,
  'Rimozione del nome di un profilo'
);
select tests.esci();
select is((select stato::text from public.segnalazioni where id = tests.s('dati_errati', 'adulto_18')),
          'chiusa', 'La decisione chiude tutte le segnalazioni sullo stesso oggetto');
select is((select nome_visualizzato from public.profili where id = tests.id('minore_16')), 'Utente Noxa',
          'Il nome rimosso torna generico');
select is(
  (select array_agg(dati ->> 'esito' order by dati ->> 'esito') from public.notifiche
   where tipo = 'esito_moderazione' and utente_id = tests.id('adulto_20')),
  array['segnalazione_decisa', 'segnalazione_decisa'],
  'DSA art. 17: chi ha segnalato riceve la decisione motivata'
);
select is_empty(
  $$ select 1 from public.notifiche where tipo = 'esito_moderazione' and utente_id = tests.id('adulto_21') $$,
  'Chi è stato segnalato senza violazioni non lo viene a sapere'
);
select is(
  (select dati ->> 'esito' || ':' || (dati ->> 'contenuto') from public.notifiche
   where tipo = 'esito_moderazione' and utente_id = tests.id('minore_16')
     and dati ->> 'esito' = 'contenuto_rimosso'),
  'contenuto_rimosso:nome',
  'R-53: la persona coinvolta riceve la motivazione della rimozione'
);
select tests.autentica_come('adulto_20');
select is(
  (select decisione || '|' || decisione_azione::text || '|' || reclamabile::text
   from public.mie_segnalazioni() where motivo = 'spam'),
  'Il profilo non viola le regole.|nessuna_violazione|true',
  'Chi ha segnalato vede la decisione motivata e può presentare reclamo'
);

-- D-15: la foto nascosta in automatico torna visibile senza violazione...
select tests.esci();
select ok((select avatar_nascosto from public.profili where id = tests.id('adulto_18')),
          'D-15: la segnalazione urgente ha nascosto la foto');
select tests.autentica_come('moderatore');
select lives_ok(
  $$ select public.decidi_segnalazione(tests.s('adescamento_o_rischio_minore', 'minore_17'),
                                       'nessuna_violazione', 'Nessun elemento di rischio.') $$,
  'Decisione sulla segnalazione urgente'
);
select tests.esci();
select ok(not (select avatar_nascosto from public.profili where id = tests.id('adulto_18')),
          'D-15: senza violazione la foto torna visibile');
select isnt_empty(
  $$ select 1 from public.notifiche
     where utente_id = tests.id('adulto_18') and dati ->> 'esito' = 'contenuto_ripristinato' $$,
  'D-15: la persona sa che la foto è di nuovo visibile'
);

-- ...e con la rimozione la foto sparisce dal profilo.
select ok((select avatar_nascosto from public.profili where id = tests.id('minore_16')),
          'D-15: anche la foto di minore_16 era nascosta');
select tests.autentica_come('moderatore');
select lives_ok(
  $$ select public.decidi_segnalazione(tests.s('adescamento_o_rischio_minore', 'minore_15'),
                                       'rimuovi_contenuto', 'Foto non adatta.') $$,
  'Rimozione della foto profilo segnalata'
);
select tests.esci();
select is(
  (select coalesce(avatar_path, 'nessuna') || ':' || avatar_nascosto::text from public.profili
   where id = tests.id('minore_16')),
  'nessuna:false',
  'R-52: la foto rimossa non è più nel profilo e non resta nascosta'
);

-- ---------------------------------------------------------------------------------------------
-- Escalation (R-55)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_17');
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo, dettagli)
values (tests.id('minore_17'), 'foto_profilo', tests.id('adulto_18'), 'adescamento_o_rischio_minore', 'Grave');
select tests.autentica_come('moderatore');
select throws_ok(
  $$ select public.escalation_segnalazione(tests.s('adescamento_o_rischio_minore', 'minore_17'),
                                           'Adescamento', 'ok') $$,
  'NX032', null,
  'R-55: serve la parola di conferma'
);
select lives_ok(
  $$ select public.escalation_segnalazione(tests.s('adescamento_o_rischio_minore', 'minore_17'),
                                           'Adescamento documentato.', 'Escalation') $$,
  'R-55: escalation alle autorità'
);
select is((select in_escalation from public.coda_segnalazioni()
           where id = (select x.id from public.segnalazioni x where x.dettagli = 'Grave')), true,
          'La coda mostra la segnalazione in escalation');
select tests.esci();
select is((select stato_account::text from public.profili where id = tests.id('adulto_18')), 'sospeso',
          'R-55: l''account è sospeso');
select is(
  (select conservazione_legale from public.contenuti_occultati
   where tipo_oggetto = 'foto_profilo' and oggetto_id = tests.id('adulto_18')),
  true,
  'R-55: la foto è inaccessibile e conservata come prova'
);
select ok(
  (select conservazione_legale from public.segnalazioni where id = (select x.id from public.segnalazioni x where x.dettagli = 'Grave'))
  and (select bool_and(conservazione_legale) from public.azioni_moderazione
       where segnalazione_id = (select x.id from public.segnalazioni x where x.dettagli = 'Grave') and azione = 'escalation_autorita'),
  'R-55: segnalazione e registro sono conservati'
);
select is(
  (select count(*)::int from public.notifiche
   where utente_id = tests.id('adulto_18') and dati ->> 'esito' in ('account_sospeso', 'contenuto_rimosso')),
  0,
  'R-55: nessuna comunicazione all''account coinvolto'
);
select tests.autentica_come('minore_17');
select is(
  (select decisione || '|' || reclamabile::text from public.mie_segnalazioni()
   where tipo_oggetto = 'foto_profilo'),
  'Abbiamo preso provvedimenti secondo le regole della comunità.|false',
  'R-55: chi ha segnalato riceve un esito generico, senza la motivazione interna'
);
select is_empty($$ select 1 from public.profili where id = tests.id('adulto_18') $$,
                'R-55: nessuno vede più l''account sospeso, nemmeno gli amici');
select tests.autentica_come('adulto_18');
select is_empty($$ select 1 from public.profili where id <> tests.id('adulto_18') $$,
                'R-55: l''account sospeso non vede più nessun profilo');
select isnt_empty($$ select 1 from public.profili where id = tests.id('adulto_18') $$,
                  'L''account sospeso vede il proprio profilo');
select throws_ok(
  $$ insert into public.amicizie (richiedente_id, destinatario_id, canale)
     values (tests.id('adulto_18'), tests.id('adulto_20'), 'ricerca') $$,
  'NX036', null,
  'R-55: l''account sospeso non invia richieste di amicizia'
);
select throws_ok($$ select public.crea_codice_invito() $$, 'NX036', null,
                 'R-55: l''account sospeso non crea codici invito');
select throws_ok(
  $$ insert into public.caricamenti_flyer (utente_id, storage_path)
     values (tests.id('adulto_18'), tests.id('adulto_18')::text || '/00000000-0000-4000-8000-0000000c0099.jpg') $$,
  'NX036', null,
  'R-55: l''account sospeso non carica flyer'
);

select * from finish();
rollback;
