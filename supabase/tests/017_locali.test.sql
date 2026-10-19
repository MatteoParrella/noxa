-- locali, generi_musicali e storage delle copertine (DATA_MODEL.md §5.3, §6). Regole: R-06,
-- R-50, R-56; ADR-0018.
-- Locali del seed: c001…c005 attivi, c006 non attivo.
begin;
select plan(27);

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
-- Scrittura e foto (R-56)
-- ---------------------------------------------------------------------------------------------
select tests.autentica_come('adulto_21');
select throws_ok(
  $$ insert into public.locali (nome, nome_normalizzato, indirizzo, comune, provincia, posizione)
     values ('Locale finto', 'locale finto', 'Via X 1', 'Monza', 'MB', 'SRID=4326;POINT(9.27 45.58)') $$,
  '42501', null,
  'Un utente non crea locali'
);
select is_empty(
  $$ update public.locali set immagine_path = id::text || '.webp', immagine_fonte = 'noxa'
     where id = tests.l('001') returning id $$,
  'R-56: un utente non cambia la foto di un locale'
);

select tests.autentica_come('moderatore_senza_mfa');
select is_empty(
  $$ update public.locali set immagine_path = id::text || '.webp', immagine_fonte = 'noxa'
     where id = tests.l('001') returning id $$,
  'R-06, R-56: senza due fattori un moderatore non cambia le foto'
);

select tests.autentica_come('moderatore');
select throws_ok(
  $$ update public.locali set immagine_path = id::text || '.webp', immagine_fonte = 'licenza_libera'
     where id = tests.l('001') $$,
  '23514', null,
  'R-56: una foto con licenza libera richiede l''attribuzione'
);
select throws_ok(
  $$ update public.locali set immagine_path = id::text || '.webp',
       immagine_fonte = 'autorizzazione_locale' where id = tests.l('001') $$,
  '23514', null,
  'R-56: una foto autorizzata dal locale richiede il riferimento all''autorizzazione'
);
select throws_ok(
  $$ update public.locali set immagine_path = 'altro.webp', immagine_fonte = 'noxa'
     where id = tests.l('001') $$,
  '23514', null,
  'R-56: la foto sta nel percorso previsto per il locale'
);
select throws_ok(
  $$ update public.locali set immagine_attribuzione = 'Qualcuno' where id = tests.l('001') $$,
  '23514', null,
  'R-56: niente attribuzione senza foto'
);
select lives_ok(
  $$ update public.locali set immagine_path = id::text || '.webp', immagine_fonte = 'licenza_libera',
       immagine_attribuzione = 'Laura Bassi, CC BY 4.0' where id = tests.l('001') $$,
  'R-56: un moderatore con due fattori carica una foto con licenza libera e attribuzione'
);
select is(
  (select immagine_approvata_da from public.locali where id = tests.l('001')),
  tests.id('moderatore'),
  'R-56: la foto risulta approvata dal moderatore che l''ha caricata'
);
select lives_ok(
  $$ update public.locali set immagine_path = id::text || '.webp', immagine_fonte = 'noxa'
     where id = tests.l('006') $$,
  'Un moderatore carica la foto di un locale non attivo'
);

-- File nel bucket: la foto di c001 (attivo), di c006 (non attivo) e un file non collegato.
select tests.esci();
insert into storage.objects (bucket_id, name)
values ('immagini-locali', tests.l('001')::text || '.webp'),
       ('immagini-locali', tests.l('006')::text || '.webp'),
       ('immagini-locali', 'non-collegata.webp');

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
