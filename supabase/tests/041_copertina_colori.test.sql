-- Colori della copertina generata (DATA_MODEL.md §5.3, ADR-0030). La tavolozza segue la
-- visibilità dell'evento (R-20, R-23) e accetta solo colori: niente immagini né altri campi.
begin;
select plan(13);

create function tests.colori(fondo text default '#1A120B') returns jsonb language sql as $$
  select jsonb_build_object(
    'scuro', jsonb_build_object('fondo', fondo, '1', '#F2C94C', '2', '#7A6020', 'bagliore', '#5E4A14'),
    'chiaro', jsonb_build_object('fondo', '#F7EFD6', '1', '#6E5308', '2', '#D6B04A', 'bagliore', '#F0DC9C'),
    'calcolata_il', '2026-11-11T10:00:00Z');
$$;
grant execute on function tests.colori(text) to noxa_worker;

insert into public.eventi (id, locale_id, titolo, inizio, eta_minima, eta_minima_dichiarata, stato)
values
  ('00000000-0000-4000-8000-0000000c0101', '00000000-0000-4000-8000-00000000c001', 'Colori 14+',
   (((now() at time zone 'Europe/Rome') - interval '6 hours')::date + 10 + time '22:00')
     at time zone 'Europe/Rome', 14, true, 'pubblicato'),
  ('00000000-0000-4000-8000-0000000c0102', '00000000-0000-4000-8000-00000000c001', 'Colori 18+',
   (((now() at time zone 'Europe/Rome') - interval '6 hours')::date + 10 + time '23:00')
     at time zone 'Europe/Rome', 18, false, 'pubblicato');

-- Formato
select lives_ok(
  $$ update public.eventi set copertina_colori = tests.colori()
     where id = '00000000-0000-4000-8000-0000000c0101' $$,
  'Una tavolozza completa è accettata');
select throws_ok(
  $$ update public.eventi set copertina_colori = tests.colori('#1a120b')
     where id = '00000000-0000-4000-8000-0000000c0101' $$,
  '23514', null, 'Solo esadecimali maiuscoli #RRGGBB');
select throws_ok(
  $$ update public.eventi set copertina_colori = tests.colori() || '{"immagine": "https://x.example/a.jpg"}'
     where id = '00000000-0000-4000-8000-0000000c0101' $$,
  '23514', null, 'ADR-0030: nessun campo oltre la tavolozza (niente link o immagini)');
select throws_ok(
  $$ update public.eventi set copertina_colori = tests.colori() #- '{scuro,bagliore}'
     where id = '00000000-0000-4000-8000-0000000c0101' $$,
  '23514', null, 'Ogni tema ha i quattro colori');
select throws_ok(
  $$ update public.eventi set copertina_colori = jsonb_set(tests.colori(), '{chiaro,1}', '"rosso"')
     where id = '00000000-0000-4000-8000-0000000c0101' $$,
  '23514', null, 'Un colore non esadecimale è rifiutato');
select throws_ok(
  $$ update public.eventi set copertina_colori = tests.colori() - 'calcolata_il'
     where id = '00000000-0000-4000-8000-0000000c0101' $$,
  '23514', null, 'Serve la data del calcolo (si ricalcola dopo 30 giorni)');

-- Il worker scrive la tavolozza
grant noxa_worker to postgres;
set local role noxa_worker;
select lives_ok(
  $$ update public.eventi set copertina_colori = tests.colori()
     where id = '00000000-0000-4000-8000-0000000c0102' $$,
  'Il worker salva la tavolozza');
reset role;

-- Visibilità: come l'evento (R-20)
select tests.autentica_come('minore_14');
select is(
  (select copertina_colori -> 'scuro' ->> 'fondo' from public.dettaglio_evento('00000000-0000-4000-8000-0000000c0101')),
  '#1A120B', 'Un quattordicenne vede i colori di un evento 14+');
select is_empty(
  $$ select 1 from public.dettaglio_evento('00000000-0000-4000-8000-0000000c0102') $$,
  'R-20: un quattordicenne non vede l''evento 18+ né i suoi colori');
select is(
  (select count(*)::int from public.cerca_eventi(null, null, null,
     ((now() at time zone 'Europe/Rome') - interval '6 hours')::date + 10,
     ((now() at time zone 'Europe/Rome') - interval '6 hours')::date + 10)
   where titolo like 'Colori%' and copertina_colori is not null),
  1, 'R-20: in cerca_eventi un minorenne ha solo i colori degli eventi che vede');
select tests.autentica_come('minore_17');
select is_empty(
  $$ select 1 from public.dettaglio_evento('00000000-0000-4000-8000-0000000c0102') $$,
  'R-20: neanche a 17 anni');
select tests.autentica_come('adulto_18');
select is(
  (select copertina_colori -> 'chiaro' ->> '1' from public.dettaglio_evento('00000000-0000-4000-8000-0000000c0102')),
  '#6E5308', 'Un diciottenne vede i colori dell''evento 18+');
select tests.autentica_come('adulto_21');
select is(
  (select count(*)::int from public.cerca_eventi(null, null, null,
     ((now() at time zone 'Europe/Rome') - interval '6 hours')::date + 10,
     ((now() at time zone 'Europe/Rome') - interval '6 hours')::date + 10)
   where titolo like 'Colori%' and copertina_colori is not null),
  2, 'Un adulto ha i colori di entrambi gli eventi');

select * from finish();
rollback;
