-- locali, generi_musicali e storage delle copertine (DATA_MODEL.md §5.3, §6). Regole: R-06,
-- R-50, R-56; ADR-0018.
-- Locali del seed: c001…c005 attivi, c006 non attivo.
begin;
select plan(46);

create function tests.l(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000c' || n)::uuid;
$$;

-- ---------------------------------------------------------------------------------------------
-- Lettura
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select is((select count(*)::int from public.locali), 5, 'Chi ha 14 anni vede i locali attivi');
select is_empty($$ select 1 from public.locali where id = tests.l('006') $$,
                'Un locale non attivo non si vede');
select tests.autentica_come('adulto_21');
select is((select count(*)::int from public.locali), 5, 'Chi ha 21 anni vede gli stessi locali');
select tests.autentica_come('moderatore_senza_mfa');
select is((select count(*)::int from public.locali), 5,
          'R-06: senza due fattori un moderatore vede solo i locali attivi');
select tests.autentica_come('moderatore');
select is((select count(*)::int from public.locali), 6, 'Un moderatore vede anche i locali non attivi');

-- ---------------------------------------------------------------------------------------------
-- Scrittura dei locali (R-06)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_21');
select throws_ok(
  $$ insert into public.locali (nome, indirizzo, comune, provincia, posizione)
     values ('Locale finto', 'Via X 1', 'Monza', 'MB', 'SRID=4326;POINT(9.27 45.58)') $$,
  '42501', null,
  'Un utente non crea locali'
);
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok(
  $$ insert into public.locali (nome, indirizzo, comune, provincia, posizione)
     values ('Locale finto', 'Via X 1', 'Monza', 'MB', 'SRID=4326;POINT(9.27 45.58)') $$,
  '42501', null,
  'R-06: senza due fattori un moderatore non crea locali'
);
select tests.autentica_come('moderatore');
select lives_ok(
  $$ insert into public.locali (nome, indirizzo, comune, provincia, posizione)
     values ('Caffè Ünico & C.', 'Via X 1', 'Monza', 'MB', 'SRID=4326;POINT(9.27 45.58)') $$,
  'Un moderatore con due fattori crea un locale'
);
select is(
  (select nome_normalizzato from public.locali where nome = 'Caffè Ünico & C.'),
  'caffe unico c',
  'Il nome normalizzato lo calcola il database'
);
select throws_ok(
  $$ update public.locali set nome_normalizzato = 'altro' where id = tests.l('001') $$,
  '42501', null,
  'Il nome normalizzato non si scrive a mano'
);

-- ---------------------------------------------------------------------------------------------
-- Foto (R-56): i dati della foto si cambiano solo con le RPC, che registrano l'azione
-- ---------------------------------------------------------------------------------------------
select tests.esci();
select throws_ok(
  $$ update public.locali set immagine_path = id::text || '.webp', immagine_fonte = 'licenza_libera',
       immagine_approvata_il = now() where id = tests.l('001') $$,
  '23514', null,
  'R-56: una foto con licenza libera richiede l''attribuzione'
);
select throws_ok(
  $$ update public.locali set immagine_path = id::text || '.webp',
       immagine_fonte = 'autorizzazione_locale', immagine_approvata_il = now()
     where id = tests.l('001') $$,
  '23514', null,
  'R-56: una foto autorizzata dal locale richiede il riferimento all''autorizzazione'
);
select throws_ok(
  $$ update public.locali set immagine_path = 'altro.webp', immagine_fonte = 'noxa',
       immagine_approvata_il = now() where id = tests.l('001') $$,
  '23514', null,
  'R-56: la foto sta nel percorso previsto per il locale'
);
select throws_ok(
  $$ update public.locali set immagine_attribuzione = 'Qualcuno' where id = tests.l('001') $$,
  '23514', null,
  'R-56: niente attribuzione senza foto'
);

select tests.autentica_come('adulto_21');
select throws_ok(
  $$ update public.locali set immagine_path = id::text || '.webp', immagine_fonte = 'noxa'
     where id = tests.l('001') $$,
  '42501', null,
  'R-56: un utente non cambia la foto di un locale'
);
select throws_ok(
  $$ select public.salva_foto_locale(tests.l('001'), tests.l('001')::text || '.webp', 'noxa', true, true, null, null) $$,
  '42501', null,
  'R-56: un utente non salva la foto di un locale'
);
select tests.autentica_come('moderatore');
select throws_ok(
  $$ update public.locali set immagine_path = id::text || '.webp', immagine_fonte = 'noxa'
     where id = tests.l('001') $$,
  '42501', null,
  'R-56: anche un moderatore cambia la foto solo con la RPC che la registra'
);
select throws_ok(
  $$ select public.salva_foto_locale(tests.l('001'), tests.l('001')::text || '.webp', 'noxa', true, true, null, null) $$,
  'NX024', null,
  'R-56: senza il file caricato la foto non si salva'
);

-- File nel bucket: la foto di c001 (attivo), di c006 (non attivo) e un file non collegato.
select tests.esci();
insert into storage.objects (bucket_id, name)
values ('immagini-locali', tests.l('001')::text || '.webp'),
       ('immagini-locali', tests.l('006')::text || '.webp'),
       ('immagini-locali', 'non-collegata.webp');

select tests.autentica_come('moderatore_senza_mfa');
select throws_ok(
  $$ select public.salva_foto_locale(tests.l('001'), tests.l('001')::text || '.webp', 'noxa', true, true, null, null) $$,
  '42501', null,
  'R-06, R-56: senza due fattori un moderatore non salva le foto'
);
select tests.autentica_come('moderatore');
select throws_ok(
  $$ select public.salva_foto_locale(tests.l('001'), tests.l('001')::text || '.webp', 'noxa', true, false, null, null) $$,
  'NX023', null,
  'R-56: senza la conferma "niente alcolici in evidenza" la foto non si salva'
);
select throws_ok(
  $$ select public.salva_foto_locale(tests.l('001'), tests.l('001')::text || '.webp', 'noxa', false, true, null, null) $$,
  'NX023', null,
  'R-56: senza la conferma "niente persone riconoscibili" la foto non si salva'
);
select throws_ok(
  $$ select public.salva_foto_locale(tests.l('001'), tests.l('001')::text || '.webp', 'licenza_libera', true, true, ' ', null) $$,
  '23514', null,
  'R-56: una licenza libera senza attribuzione non si salva'
);
select lives_ok(
  $$ select public.salva_foto_locale(tests.l('001'), tests.l('001')::text || '.webp', 'licenza_libera', true, true, 'Laura Bassi, CC BY 4.0', null) $$,
  'R-56: un moderatore con due fattori salva una foto con licenza libera e attribuzione'
);
select is(
  (select immagine_approvata_da from public.locali where id = tests.l('001')),
  tests.id('moderatore'),
  'R-56: la foto risulta approvata dal moderatore che l''ha caricata'
);
select is(
  (select count(*)::int from public.azioni_moderazione
   where oggetto_id = tests.l('001') and azione = 'approva_immagine_locale'
     and moderatore_id = tests.id('moderatore')),
  1,
  'R-56: il caricamento è registrato una sola volta in azioni_moderazione'
);
select lives_ok(
  $$ select public.salva_foto_locale(tests.l('006'), tests.l('006')::text || '.webp', 'autorizzazione_locale', true, true, null, 'AUT-2026-014') $$,
  'Un moderatore salva la foto di un locale non attivo, autorizzata dal locale'
);

select tests.autentica_come('minore_14');
select is(
  (select array_agg(name order by name) from storage.objects where bucket_id = 'immagini-locali'),
  array[tests.l('001')::text || '.webp'],
  'R-56: si legge solo la foto approvata di un locale attivo'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('immagini-locali', 'mia.webp') $$,
  '42501', null,
  'R-56: un utente non carica foto dei locali'
);
select tests.autentica_come('moderatore');
select is((select count(*)::int from storage.objects where bucket_id = 'immagini-locali'), 3,
          'Un moderatore vede tutte le foto, anche quelle da eliminare');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('immagini-locali', '00000000-0000-4000-8000-00000000c002.webp') $$,
  'R-56: un moderatore con due fattori carica una foto'
);
select tests.autentica_come('moderatore_senza_mfa');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('immagini-locali', '00000000-0000-4000-8000-00000000c003.webp') $$,
  '42501', null,
  'R-06: senza due fattori un moderatore non carica foto'
);

-- Sostituzione (R-56): la foto nuova si carica accanto a quella approvata e resta invisibile
-- agli utenti finché il moderatore non la approva con fonte e conferme.
select tests.esci();
insert into storage.objects (bucket_id, name)
values ('immagini-locali', tests.l('001')::text || '-nuova2026.webp');
select tests.autentica_come('minore_14');
select is_empty(
  $$ select 1 from storage.objects where bucket_id = 'immagini-locali' and name like '%-nuova2026.webp' $$,
  'R-56: una foto caricata ma non ancora approvata non si vede'
);
select tests.autentica_come('moderatore');
select throws_ok(
  $$ select public.salva_foto_locale(tests.l('001'), tests.l('002')::text || '.webp', 'noxa', true, true) $$,
  '22023', null,
  'R-56: il percorso della foto è quello del suo locale'
);
select is(
  public.salva_foto_locale(tests.l('001'), tests.l('001')::text || '-nuova2026.webp', 'noxa', true, true),
  tests.l('001')::text || '.webp',
  'R-56: approvata la nuova foto, la RPC indica quella precedente da eliminare'
);
select tests.autentica_come('minore_14');
select is(
  (select array_agg(name order by name) from storage.objects where bucket_id = 'immagini-locali'),
  array[tests.l('001')::text || '-nuova2026.webp'],
  'R-56: dopo l''approvazione gli utenti vedono solo la nuova foto'
);

-- Rimozione con motivazione (R-56)
select tests.autentica_come('moderatore');
select throws_ok(
  $$ select public.rimuovi_foto_locale(tests.l('006'), '  ') $$,
  'NX021', null,
  'R-56: la rimozione della foto chiede la motivazione'
);
select lives_ok(
  $$ select public.rimuovi_foto_locale(tests.l('006'), 'Il locale ha ritirato l''autorizzazione.') $$,
  'R-56: un moderatore rimuove la foto con la motivazione'
);
select ok(
  (select immagine_path is null and immagine_fonte is null and immagine_riferimento is null
          and immagine_approvata_il is null
   from public.locali where id = tests.l('006'))
  and exists (select 1 from public.azioni_moderazione
              where oggetto_id = tests.l('006') and azione = 'rimuovi_immagine_locale'
                and motivazione = 'Il locale ha ritirato l''autorizzazione.'),
  'R-56: la foto rimossa non lascia dati e la motivazione resta nel registro'
);
select throws_ok(
  $$ select public.rimuovi_foto_locale(tests.l('006'), 'Di nuovo.') $$,
  'NX025', null,
  'Non si rimuove una foto che non c''è'
);

-- ---------------------------------------------------------------------------------------------
-- flyer-pubblicati: si legge come l'evento (R-20, R-23)
-- ---------------------------------------------------------------------------------------------
select tests.esci();
update public.eventi set immagine_path = 'eventi/' || id::text || '.webp'
where id = '00000000-0000-4000-8000-00000000e001';
insert into storage.objects (bucket_id, name)
values ('flyer-pubblicati', 'eventi/00000000-0000-4000-8000-00000000e001.webp');

select tests.autentica_come('minore_17');
select is_empty($$ select 1 from storage.objects where bucket_id = 'flyer-pubblicati' $$,
                'R-20: chi ha 17 anni non vede il flyer di un evento 18+');
select tests.autentica_come('adulto_18');
select isnt_empty($$ select 1 from storage.objects where bucket_id = 'flyer-pubblicati' $$,
                  'Chi ha 18 anni vede il flyer di un evento 18+');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('flyer-pubblicati', 'eventi/x.webp') $$,
  '42501', null,
  'Solo il worker scrive i flyer pubblicati'
);

-- ---------------------------------------------------------------------------------------------
-- Segnalazione delle foto (R-50, ADR-0018)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('minore_14');
select lives_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_14'), 'immagine_locale', tests.l('001'), 'contenuto_inappropriato') $$,
  'R-50: si segnala la foto di un locale'
);
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_14'), 'immagine_locale', tests.l('003'), 'contenuto_inappropriato') $$,
  '42501', null,
  'Non si segnala la foto di un locale che non ne ha'
);
select throws_ok(
  $$ insert into public.segnalazioni (segnalante_id, tipo_oggetto, oggetto_id, motivo)
     values (tests.id('minore_14'), 'immagine_locale', tests.l('006'), 'contenuto_inappropriato') $$,
  '42501', null,
  'Non si segnala la foto di un locale che non si vede'
);
select is(
  (select descrizione from public.mie_segnalazioni() where tipo_oggetto = 'immagine_locale'),
  'Club Binario 7',
  'Le mie segnalazioni mostrano il nome del locale della foto'
);

select * from finish();
rollback;
