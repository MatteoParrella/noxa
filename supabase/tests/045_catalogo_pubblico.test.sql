-- cerca_eventi_pubblici e generi_pubblici (DATA_MODEL.md §5.3, ADR-0036). Regole: R-07, R-20,
-- R-21, R-23. Eventi del seed come in 018_eventi: e008 ha riferimenti all'alcol, e010 è in
-- revisione, e011 è in un locale non attivo, e101…e103 sono già passati.
begin;
select plan(16);

create function tests.e(n text) returns uuid language sql immutable as $$
  select ('00000000-0000-4000-8000-00000000e' || n)::uuid;
$$;

-- Tutte le serate dei prossimi 31 giorni, come le vede il sito senza account.
set local role anon;

create temporary table pubblici on commit drop as
  select * from public.cerca_eventi_pubblici(
    ((now() at time zone 'Europe/Rome') - interval '6 hours')::date,
    ((now() at time zone 'Europe/Rome') - interval '6 hours')::date + 31);

select ok(
  (select count(*) from pubblici) > 0,
  'ADR-0036: senza account si vede l''elenco delle serate'
);
select ok(
  not exists (select 1 from pubblici where id = tests.e('010')),
  'R-07: le serate in revisione non sono nell''elenco pubblico'
);
select ok(
  not exists (select 1 from pubblici where id = tests.e('011')),
  'Le serate dei locali non attivi non sono nell''elenco pubblico'
);
select ok(
  not exists (select 1 from pubblici where id in (tests.e('101'), tests.e('102'), tests.e('103'))),
  'Le serate passate non sono nell''elenco pubblico'
);
select is(
  (select titolo from pubblici where id = tests.e('001')),
  'Notte Ferrovia',
  'Una serata 18+ senza alcol mostra il titolo'
);
select ok(
  (select riservato and titolo is null and generi_evento = '{}' and copertina_colori is null
   from pubblici where id = tests.e('008')),
  'R-23: una serata con riferimenti all''alcol non mostra titolo, generi né colori'
);
select ok(
  (select eta_minima >= 18 from pubblici where id = tests.e('008')),
  'R-23: una serata con riferimenti all''alcol risulta almeno 18+'
);
select is(
  (select stato::text from pubblici where id = tests.e('006')),
  'annullato',
  'Una serata annullata resta nell''elenco con il suo stato'
);
select ok(
  (select count(*) from pubblici where id = tests.e('003') and eta_minima = 18
     and not eta_minima_dichiarata) = 1,
  'R-21: una serata senza età dichiarata resta 18+ non dichiarata'
);

select throws_ok(
  $$ select * from public.cerca_eventi_pubblici(current_date, current_date + 60) $$,
  '22023', null,
  'L''elenco pubblico copre al massimo 31 giorni'
);
select throws_ok(
  $$ select * from public.cerca_eventi_pubblici(current_date - 30, current_date - 20) $$,
  '22023', null,
  'L''elenco pubblico non restituisce l''archivio delle serate passate'
);
select ok(
  (select count(*) from public.generi_pubblici()) > 0,
  'Senza account si leggono i nomi dei generi'
);

-- Il resto resta chiuso al ruolo anon (R-07).
select throws_ok($$ select 1 from public.eventi $$, '42501', null,
                 'R-07: anon continua a non leggere la tabella eventi');
select throws_ok($$ select 1 from public.locali $$, '42501', null,
                 'R-07: anon continua a non leggere la tabella locali');
reset role;

-- Gli iscritti usano cerca_eventi con la propria età (R-20): la funzione pubblica non li serve.
select tests.autentica_come('minore_16');
select throws_ok(
  $$ select * from public.cerca_eventi_pubblici() $$,
  '42501', null,
  'R-20: un iscritto minorenne non usa l''elenco pubblico per vedere i 18+'
);
select throws_ok(
  $$ select * from public.generi_pubblici() $$,
  '42501', null,
  'La funzione dei generi pubblici è solo per chi non ha un account'
);
select tests.esci();

select * from finish();
rollback;
