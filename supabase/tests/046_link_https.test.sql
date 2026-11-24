-- Link solo https in eventi, eventi_fonti, locali e candidati_locali (DATA_MODEL.md §5.2, §5.3).
begin;
select plan(8);

select throws_ok(
  $$ update public.eventi set url_biglietti = 'http://binario7.example/biglietti'
     where id = '00000000-0000-4000-8000-00000000e001' $$,
  '23514', null, 'Un link ai biglietti in http è rifiutato'
);
select lives_ok(
  $$ update public.eventi set url_biglietti = 'https://binario7.example/biglietti'
     where id = '00000000-0000-4000-8000-00000000e001' $$,
  'Un link ai biglietti in https è accettato'
);
select throws_ok(
  $$ update public.eventi_fonti set url_originale = 'http://binario7.example/eventi'
     where evento_id = '00000000-0000-4000-8000-00000000e001' $$,
  '23514', null, 'Il link alla pagina della serata in http è rifiutato'
);
select throws_ok(
  $$ update public.locali set sito_web = 'http://binario7.example'
     where id = '00000000-0000-4000-8000-00000000c001' $$,
  '23514', null, 'Il sito di un locale in http è rifiutato'
);
select lives_ok(
  $$ update public.locali set sito_web = 'https://binario7.example'
     where id = '00000000-0000-4000-8000-00000000c001' $$,
  'Il sito di un locale in https è accettato'
);
select throws_ok(
  $$ update public.locali set sito_web = 'ftp://binario7.example'
     where id = '00000000-0000-4000-8000-00000000c001' $$,
  '23514', null, 'Un link che non è una pagina web è rifiutato'
);

-- Anche i moderatori passano dal vincolo.
select tests.autentica_come('moderatore');
select throws_ok(
  $$ update public.locali set sito_web = 'http://binario7.example'
     where id = '00000000-0000-4000-8000-00000000c001' $$,
  '23514', null, 'Un moderatore non salva il sito di un locale in http'
);
select tests.esci();

select is(
  (select count(*)::int from public.eventi_fonti where url_originale ilike 'http://%'),
  0, 'Nel seed non restano link in http'
);

select * from finish();
rollback;
