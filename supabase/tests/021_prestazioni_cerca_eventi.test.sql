-- Prestazioni di cerca_eventi (ROADMAP.md §5, iterazione 4; PRD F-01): con 5.000 eventi futuri
-- sintetici la ricerca risponde in meno di 800 ms al 95° percentile. Tutto si annulla alla
-- fine della transazione.
begin;
select plan(2);

-- 120 locali tra Milano e Brianza, 5.000 eventi nei prossimi 60 giorni con età e generi
-- diversi, partecipazioni degli amici di adulto_21 e di minore_16.
insert into public.locali (id, nome, nome_normalizzato, indirizzo, comune, provincia, posizione)
select ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid,
       'Locale sintetico ' || n, 'locale sintetico ' || n, 'Via Prova ' || n,
       case when n % 2 = 0 then 'Milano' else 'Monza' end,
       case when n % 2 = 0 then 'MI' else 'MB' end,
       extensions.st_setsrid(extensions.st_makepoint(9.05 + (n % 12) * 0.03,
                                                     45.40 + (n / 12) * 0.025), 4326)::extensions.geography
from generate_series(1, 120) n;

insert into public.eventi (id, locale_id, titolo, inizio, fine, eta_minima, eta_minima_dichiarata,
                           riferimenti_alcol, prezzo_min_centesimi, stato)
select ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid,
       ('00000000-0000-4000-9000-' || lpad((n % 120 + 1)::text, 12, '0'))::uuid,
       'Evento sintetico ' || n,
       (((now() at time zone 'Europe/Rome')::date + (n % 60)) + time '21:00'
        + make_interval(mins => (n % 8) * 30)) at time zone 'Europe/Rome',
       (((now() at time zone 'Europe/Rome')::date + (n % 60) + 1) + time '04:00') at time zone 'Europe/Rome',
       (array[14, 16, 18, 18, 18, 21])[n % 6 + 1], n % 6 <> 2, n % 17 = 0, (n % 5) * 500,
       'pubblicato'
from generate_series(1, 5000) n;

insert into public.eventi_generi (evento_id, genere_codice)
select e.id, g.codice
from public.eventi e
cross join lateral (
  select codice from public.generi_musicali
  order by md5(e.id::text || codice) limit 2
) g
where e.titolo like 'Evento sintetico %';

insert into public.partecipazioni_evento (utente_id, evento_id, stato, visibile_agli_amici)
select u.id, e.id, case when e.n % 2 = 0 then 'partecipo' else 'interessato' end::public.stato_partecipazione_evento, true
from (select id, row_number() over (order by id) n from public.eventi
      where titolo like 'Evento sintetico %' and eta_minima <= 16) e
cross join (select tests.id('adulto_20') id union all select tests.id('minore_15')) u
where e.n % 7 = 0;

analyze public.locali;
analyze public.eventi;
analyze public.eventi_generi;
analyze public.partecipazioni_evento;

-- Tempi in millisecondi di 60 ricerche tipiche (serata, domani, weekend, distanza, generi, età,
-- solo con amici, un mese intero) per un utente adulto e per uno minorenne.
create function tests.tempi_ricerca() returns double precision[] language plpgsql as $$
declare
  oggi date := ((now() at time zone 'Europe/Rome') - interval '6 hours')::date;
  tempi double precision[] := '{}';
  inizio timestamptz;
  giro int;
  utente text;
begin
  foreach utente in array array['adulto_21', 'minore_16'] loop
    perform tests.autentica_come(utente);
    for giro in 1..3 loop
      inizio := clock_timestamp();
      perform count(*) from public.cerca_eventi(null, null, null, oggi, oggi);
      tempi := tempi || extract(epoch from clock_timestamp() - inizio) * 1000;
      inizio := clock_timestamp();
      perform count(*) from public.cerca_eventi(null, null, null, oggi + 1, oggi + 1);
      tempi := tempi || extract(epoch from clock_timestamp() - inizio) * 1000;
      inizio := clock_timestamp();
      perform count(*) from public.cerca_eventi(null, null, null, oggi + 4, oggi + 6);
      tempi := tempi || extract(epoch from clock_timestamp() - inizio) * 1000;
      inizio := clock_timestamp();
      perform count(*) from public.cerca_eventi(45.5845, 9.2744, 10, oggi, oggi + 2);
      tempi := tempi || extract(epoch from clock_timestamp() - inizio) * 1000;
      inizio := clock_timestamp();
      perform count(*) from public.cerca_eventi(45.4642, 9.19, 25, oggi, oggi + 6,
                                                array['techno', 'house']);
      tempi := tempi || extract(epoch from clock_timestamp() - inizio) * 1000;
      inizio := clock_timestamp();
      perform count(*) from public.cerca_eventi(null, null, null, oggi, oggi + 6, null, 16::smallint);
      tempi := tempi || extract(epoch from clock_timestamp() - inizio) * 1000;
      inizio := clock_timestamp();
      perform count(*) from public.cerca_eventi(null, null, null, oggi, oggi + 13, null, null, true);
      tempi := tempi || extract(epoch from clock_timestamp() - inizio) * 1000;
      inizio := clock_timestamp();
      perform count(*) from public.cerca_eventi(null, null, null, oggi, oggi + 30);
      tempi := tempi || extract(epoch from clock_timestamp() - inizio) * 1000;
      inizio := clock_timestamp();
      perform count(*) from public.cerca_eventi(45.5845, 9.2744, 50, oggi, oggi + 59);
      tempi := tempi || extract(epoch from clock_timestamp() - inizio) * 1000;
      inizio := clock_timestamp();
      perform count(*) from public.cerca_eventi(null, null, null, oggi, oggi + 59, null, null, true);
      tempi := tempi || extract(epoch from clock_timestamp() - inizio) * 1000;
    end loop;
  end loop;
  perform tests.esci();
  return tempi;
end;
$$;

create temporary table tempi_misurati as select unnest(tests.tempi_ricerca()) as ms;

select is((select count(*)::int from tempi_misurati), 60, 'Sono state misurate 60 ricerche');
select cmp_ok(
  (select percentile_cont(0.95) within group (order by ms) from tempi_misurati)::numeric,
  '<', 800::numeric,
  format('F-01: cerca_eventi con 5.000 eventi risponde in meno di 800 ms al 95° percentile '
         || '(misurato: %s ms, massimo %s ms)',
         (select round(percentile_cont(0.95) within group (order by ms)::numeric, 1) from tempi_misurati),
         (select round(max(ms)::numeric, 1) from tempi_misurati))
);

select * from finish();
rollback;
