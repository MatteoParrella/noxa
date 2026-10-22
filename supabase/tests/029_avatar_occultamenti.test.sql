-- Foto profilo (bucket avatar), contenuti_occultati e occultamento automatico (DATA_MODEL.md
-- §5.1, §5.2, §6; ADR-0023). Regole: R-10, R-13, R-17, R-50, R-52, R-53, R-69.
-- Amici del seed: 15-16, 20-21, 18-17 (codice invito); richiesta in attesa 14 → 15.
begin;
select plan(45);

create function tests.foto(utente text) returns text language sql stable as $$
  select tests.id(utente)::text || '/00000000-0000-4000-8000-0000000a0001.webp';
$$;
-- Solo le foto create da questo test: il database locale può avere foto caricate a mano.
create function tests.foto_visibili() returns text[] language sql as $$
  select coalesce(array_agg(name order by name), '{}') from storage.objects
  where bucket_id = 'avatar' and created_at = now();
$$;
grant execute on function tests.foto(text), tests.foto_visibili() to authenticated;

-- Una foto per minore_15, minore_16, minore_17, adulto_18 e adulto_21.
insert into storage.objects (bucket_id, name)
select 'avatar', tests.foto(u) from unnest(array['minore_15', 'minore_16', 'minore_17', 'adulto_18', 'adulto_21']) u;
update public.profili set avatar_path = tests.foto(username::text)
where username in ('minore_15', 'minore_16', 'minore_17', 'adulto_18', 'adulto_21');

-- ---------------------------------------------------------------------------------------------
-- Lettura (R-52): solo chi può vedere il profilo
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select is(tests.foto_visibili(), array[tests.foto('minore_15')],
          'R-52: a 14 anni si vede solo la foto di chi ha una richiesta in corso con te');
select tests.autentica_come('minore_15');
select is(tests.foto_visibili(), array[tests.foto('minore_15'), tests.foto('minore_16')],
          'R-52: a 15 anni si vede la propria foto e quella dell''amico');
select tests.autentica_come('minore_17');
select is(tests.foto_visibili(), array[tests.foto('minore_17'), tests.foto('adulto_18')],
          'R-12, R-52: un amico di un''altra fascia (codice invito) vede la foto');
select tests.autentica_come('adulto_18');
select is(tests.foto_visibili(), array[tests.foto('minore_17'), tests.foto('adulto_18')],
          'R-10, R-52: un adulto vede la foto di un minorenne solo se è un amico confermato');
select tests.autentica_come('adulto_20');
select is(tests.foto_visibili(), array[tests.foto('adulto_21')],
          'R-52: a 20 anni si vede la foto dell''amico');
select tests.autentica_come('adulto_21');
select ok(not (tests.foto('minore_16') = any (tests.foto_visibili())),
          'R-10: un adulto non vede la foto di un minorenne sconosciuto');
select tests.autentica_come('moderatore');
select is(tests.foto_visibili(), '{}'::text[],
          'R-69: un moderatore non vede le foto dei profili non segnalati');

-- R-17: il blocco nasconde la foto in entrambe le direzioni.
select tests.autentica_come('minore_16');
insert into public.blocchi (bloccante_id, bloccato_id) values (tests.id('minore_16'), tests.id('minore_15'));
select is(tests.foto_visibili(), array[tests.foto('minore_16')], 'R-17: chi blocca non vede più la foto');
select tests.autentica_come('minore_15');
select is(tests.foto_visibili(), array[tests.foto('minore_15')], 'R-17: chi è bloccato non vede più la foto');
select tests.esci();
delete from public.blocchi where bloccante_id = tests.id('minore_16');
insert into public.amicizie (richiedente_id, destinatario_id, canale, stato, accettata_il)
values (tests.id('minore_15'), tests.id('minore_16'), 'ricerca', 'accettata', now());

-- ---------------------------------------------------------------------------------------------
-- Scrittura: solo nella propria cartella (R-52)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatar', tests.foto('minore_14')) $$,
  'R-52: si carica la foto nella propria cartella (14 anni)'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatar', tests.id('minore_15')::text || '/altra.webp') $$,
  '42501', null,
  'R-52: non si carica nella cartella di un altro'
);
select lives_ok(
  $$ update public.profili set avatar_path = tests.foto('minore_14') where id = tests.id('minore_14') $$,
  'Il titolare usa la foto caricata'
);
select throws_ok(
  $$ update public.profili set avatar_path = tests.foto('minore_15') where id = tests.id('minore_14') $$,
  '23514', null,
  'R-52: la foto del profilo sta sempre nella cartella del titolare'
);
-- Come fa l'API Storage, che consente le cancellazioni per la propria richiesta.
select set_config('storage.allow_delete_query', 'true', true);
select is_empty(
  $$ delete from storage.objects where bucket_id = 'avatar' and name = tests.foto('minore_15') returning 1 $$,
  'Non si eliminano le foto degli altri'
);
select tests.autentica_come('adulto_20');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('avatar', tests.foto('adulto_20')) $$,
  'R-52: si carica la foto nella propria cartella (20 anni)'
);
select is(tests.foto_visibili(), array[tests.foto('adulto_20'), tests.foto('adulto_21')],
          'Il titolare vede i file della propria cartella prima di usarli');

-- ---------------------------------------------------------------------------------------------
-- Segnalazione della foto (R-50, R-52)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_15');
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_15'), 'foto_profilo', tests.id('minore_16'), 'contenuto_inappropriato') $$,
  'R-50: si segnala la foto di un profilo che si vede'
);
select is((select priorita from public.segnalazioni where tipo_oggetto = 'foto_profilo'), 2::smallint,
          'R-53: la foto di un minorenne ha priorità 2');
select tests.autentica_come('adulto_21');
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('adulto_21'), 'foto_profilo', tests.id('minore_16'), 'altro') $$,
  '42501', null,
  'R-13: non si segnala la foto di un profilo che non si vede'
);
select tests.autentica_come('adulto_20');
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('adulto_20'), 'foto_profilo', tests.id('adulto_20'), 'altro') $$,
  '42501', null,
  'Non si segnala la propria foto'
);
select tests.autentica_come('moderatore');
select is(tests.foto_visibili(), array[tests.foto('minore_16')],
          'R-69: un moderatore vede la foto di un profilo segnalato');
select tests.autentica_come('moderatore_senza_mfa');
select is(tests.foto_visibili(), '{}'::text[], 'R-06: senza due fattori nessuna foto');

-- ---------------------------------------------------------------------------------------------
-- Occultamento automatico (D-15, ADR-0023)
-- ---------------------------------------------------------------------------------------------
-- Un account appena creato non nasconde nulla: si limita l'abuso delle segnalazioni.
select tests.autentica_come('adulto_20');
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
values (tests.id('adulto_20'), 'profilo', tests.id('adulto_21'), 'adescamento_o_rischio_minore');
select tests.esci();
select ok(not (select avatar_nascosto from public.profili where id = tests.id('adulto_21')),
          'D-15: la segnalazione di un account con meno di 7 giorni non nasconde la foto');

update public.profili set creato_il = now() - interval '8 days'
where id in (tests.id('adulto_20'), tests.id('minore_17'));
select tests.autentica_come('adulto_20');
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
values (tests.id('adulto_20'), 'profilo', tests.id('adulto_21'), 'spam');
select tests.esci();
select ok(not (select avatar_nascosto from public.profili where id = tests.id('adulto_21')),
          'D-15: un motivo diverso dal rischio per un minore non nasconde la foto');

select tests.autentica_come('minore_17');
insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
values (tests.id('minore_17'), 'profilo', tests.id('adulto_18'), 'adescamento_o_rischio_minore');
select tests.esci();
select ok((select avatar_nascosto from public.profili where id = tests.id('adulto_18')),
          'D-15: il rischio per un minore segnalato da un account non nuovo nasconde subito la foto');
select is(
  (select automatico from public.contenuti_occultati
   where tipo_oggetto = 'foto_profilo' and oggetto_id = tests.id('adulto_18')),
  true,
  'D-15: l''occultamento è registrato come automatico'
);
select is(
  (select motivazione like '%mezzo automatico%' from public.azioni_moderazione
   where tipo_oggetto = 'foto_profilo' and oggetto_id = tests.id('adulto_18') and azione = 'occulta_contenuto'
     and moderatore_id is null),
  true,
  'DSA art. 17: il registro dichiara il mezzo automatico'
);
select is(
  (select dati ->> 'esito' from public.notifiche
   where utente_id = tests.id('adulto_18') and tipo = 'esito_moderazione'),
  'contenuto_nascosto',
  'D-15: la persona sa che la sua foto è nascosta in attesa del controllo'
);
select tests.autentica_come('minore_17');
select ok(not (tests.foto('adulto_18') = any (tests.foto_visibili())),
          'D-15: la foto nascosta non si consegna agli amici');
select is(
  (select avatar_nascosto from public.profili where id = tests.id('adulto_18')),
  true,
  'L''app sa che deve mostrare l''immagine sostitutiva'
);
select tests.autentica_come('adulto_18');
select ok(tests.foto('adulto_18') = any (tests.foto_visibili()),
          'Il titolare continua a leggere i file della propria cartella');
select is_empty($$ select 1 from public.contenuti_occultati $$,
                'Gli utenti non leggono i contenuti occultati');
select throws_ok(
  $$ update public.profili set avatar_nascosto = false where id = tests.id('adulto_18') $$,
  '42501', null,
  'D-15: il titolare non toglie l''occultamento'
);
select throws_ok(
  $$ delete from public.contenuti_occultati $$,
  '42501', null,
  'D-15: nessun utente toglie un occultamento'
);
select tests.autentica_come('moderatore');
select is((select count(*)::int from public.contenuti_occultati), 1,
          'I moderatori vedono i contenuti occultati');
select ok(tests.foto('adulto_18') = any (tests.foto_visibili()),
          'Il moderatore vede la foto nascosta per decidere');

-- ---------------------------------------------------------------------------------------------
-- Copertine sostitutive degli eventi (ADR-0018, ADR-0023)
-- ---------------------------------------------------------------------------------------------
select tests.esci();
insert into storage.objects (bucket_id, name)
values ('flyer-pubblicati', 'eventi/00000000-0000-4000-8000-00000000e002.webp');
update public.eventi set immagine_path = 'eventi/00000000-0000-4000-8000-00000000e002.webp'
where id = '00000000-0000-4000-8000-00000000e002';
select tests.autentica_come('minore_14');
select is(
  (select copertina_tipo || ':' || coalesce(copertina_path, '')
   from public.dettaglio_evento('00000000-0000-4000-8000-00000000e002')),
  'flyer:eventi/00000000-0000-4000-8000-00000000e002.webp',
  'Senza occultamento la copertina è il flyer approvato'
);
select tests.esci();
insert into public.contenuti_occultati (tipo_oggetto, oggetto_id, automatico)
values ('evento', '00000000-0000-4000-8000-00000000e002', true);
select tests.autentica_come('minore_14');
select is(
  (select copertina_tipo || ':' || coalesce(copertina_path, '')
   from public.cerca_eventi(dal => (select data_serata from public.eventi
                                    where id = '00000000-0000-4000-8000-00000000e002'))
   where id = '00000000-0000-4000-8000-00000000e002'),
  coalesce((select 'sostitutiva:' from public.eventi
            where id = '00000000-0000-4000-8000-00000000e002' and coalesce(fine, inizio) > now()),
           null),
  'ADR-0023: una copertina nascosta diventa l''immagine sostitutiva nella ricerca'
);
select is(
  (select copertina_tipo from public.dettaglio_evento('00000000-0000-4000-8000-00000000e002')),
  'sostitutiva',
  'ADR-0023: anche nel dettaglio dell''evento'
);
select is_empty($$ select 1 from storage.objects where bucket_id = 'flyer-pubblicati' $$,
                'D-15: il file della copertina nascosta non si consegna');
select tests.autentica_come('moderatore');
select isnt_empty($$ select 1 from storage.objects where bucket_id = 'flyer-pubblicati' $$,
                  'Il moderatore vede la copertina nascosta');

-- Gli amici che partecipano portano la foto solo se non è nascosta.
select tests.esci();
insert into public.partecipazioni_evento (utente_id, evento_id, stato)
values (tests.id('adulto_18'), '00000000-0000-4000-8000-00000000e002', 'partecipo');
select tests.autentica_come('minore_17');
select is(
  (select amici -> 0 ->> 'avatar_nascosto' || ':' || coalesce(amici -> 0 ->> 'avatar_path', '')
   from public.dettaglio_evento('00000000-0000-4000-8000-00000000e002')),
  'true:',
  'La foto nascosta di un amico non arriva nel dettaglio dell''evento'
);
select tests.esci();
delete from public.contenuti_occultati where tipo_oggetto = 'foto_profilo' and oggetto_id = tests.id('adulto_18');
select tests.autentica_come('minore_17');
select is(
  (select amici -> 0 ->> 'avatar_path'
   from public.dettaglio_evento('00000000-0000-4000-8000-00000000e002')),
  tests.foto('adulto_18'),
  'R-52: la foto di un amico che partecipa arriva nel dettaglio dell''evento'
);
select ok(tests.foto('adulto_18') = any (tests.foto_visibili()),
          'Tolto l''occultamento la foto torna visibile');
select tests.esci();
select ok(not (select avatar_nascosto from public.profili where id = tests.id('adulto_18')),
          'avatar_nascosto segue i contenuti occultati');

select * from finish();
rollback;
