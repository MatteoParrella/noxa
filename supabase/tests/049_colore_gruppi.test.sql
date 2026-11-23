-- Colore dei gruppi (DATA_MODEL.md §5.4): stesse policy del nome.
begin;
select plan(5);

select tests.autentica_come('minore_16');
select lives_ok(
  $$ insert into public.gruppi (id, nome, creato_da, colore)
     values ('00000000-0000-4000-8000-0000000c0101', 'Colori', tests.id('minore_16'), 'viola') $$,
  'Chi crea un gruppo ne sceglie il colore'
);
select throws_ok(
  $$ update public.gruppi set colore = 'oro' where id = '00000000-0000-4000-8000-0000000c0101' $$,
  '23514', null, 'Il colore viene solo dalla tavolozza'
);
select lives_ok(
  $$ update public.gruppi set colore = 'verde' where id = '00000000-0000-4000-8000-0000000c0101' $$,
  'Un admin cambia il colore del gruppo'
);
select is((select colore from public.gruppi where id = '00000000-0000-4000-8000-0000000c0101'),
          'verde', 'Il colore cambiato si legge');

-- Chi non è admin non lo cambia: la policy di update non trova righe.
select tests.autentica_come('minore_17');
update public.gruppi set colore = 'rosso' where id = '00000000-0000-4000-8000-0000000c0101';
select tests.esci();
select is((select colore from public.gruppi where id = '00000000-0000-4000-8000-0000000c0101'),
          'verde', 'Chi non è admin del gruppo non ne cambia il colore');

select * from finish();
rollback;
