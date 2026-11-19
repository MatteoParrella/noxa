-- Migrazione: statistiche personali, catalogo e assegnazione dei badge, riepilogo annuale
-- Documentazione: docs/DATA_MODEL.md §5.6, §5.10, §8; regole: R-40, R-41, R-42, R-43, R-64, R-69
--
-- Tutto si calcola dentro il database dai dati del diario, che non ne esce mai (ADR-0003).
-- Nessuna policy per i moderatori su badge_utente e riepiloghi_annuali (R-69).
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX062 riepilogo dell'anno non ancora disponibile (si apre il 1° dicembre, fino al 31 gennaio)
--   NX063 riepilogo già aggiornato oggi

-- ---------------------------------------------------------------------------------------------
-- Statistiche personali (F-31)
-- ---------------------------------------------------------------------------------------------

-- Statistiche di chi chiama per un anno solare (serate per mese) o per sempre (`anno` null:
-- serate per anno). Security invoker: valgono la RLS del diario (solo il titolare, R-69) e
-- quella di eventi e locali. Classifiche per numero di serate, poi in ordine alfabetico; nessun
-- confronto con altri utenti o con periodi precedenti (R-43).
create or replace function public.mie_statistiche(anno smallint default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with serate as (
    select s.id, s.data_serata, s.evento_id, s.locale_id, s.nome_locale_libero
    from public.serate_tracker s
    where s.utente_id = (select auth.uid())
      and (mie_statistiche.anno is null
           or s.data_serata between make_date(mie_statistiche.anno, 1, 1)
                                and make_date(mie_statistiche.anno, 12, 31))
  ),
  locali as (
    select min(coalesce(l.nome, s.nome_locale_libero) collate "C") as nome, count(*) as n
    from serate s
    left join public.locali l on l.id = s.locale_id
    where l.id is not null or s.nome_locale_libero is not null
    group by coalesce(l.id::text, 'libero:' || lower(s.nome_locale_libero))
  ),
  generi as (
    select g.codice, g.nome, count(distinct s.id) as n
    from serate s
    join public.eventi_generi eg on eg.evento_id = s.evento_id
    join public.generi_musicali g on g.codice = eg.genere_codice
    group by g.codice, g.nome
  ),
  dj as (
    select min(d.nome_dj collate "C") as nome, count(*) as n
    from serate s
    join public.tracker_dj d on d.serata_tracker_id = s.id
    group by lower(d.nome_dj)
  ),
  spese as (
    select sp.categoria, sum(sp.importo_centesimi)::bigint as importo
    from serate s
    join public.tracker_spese sp on sp.serata_tracker_id = s.id
    group by sp.categoria
  )
  select jsonb_build_object(
    'anno', mie_statistiche.anno,
    'serate', (select count(*) from serate),
    'per_mese', case when mie_statistiche.anno is not null then (
      select jsonb_agg(coalesce(x.n, 0) order by m.mese)
      from generate_series(1, 12) as m (mese)
      left join (select extract(month from s.data_serata)::int as mese, count(*) as n
                 from serate s group by 1) x on x.mese = m.mese) end,
    'per_anno', case when mie_statistiche.anno is null then (
      select coalesce(jsonb_agg(jsonb_build_object('anno', x.a, 'serate', x.n) order by x.a), '[]'::jsonb)
      from (select extract(year from s.data_serata)::int as a, count(*) as n
            from serate s group by 1) x) end,
    'locali', (select coalesce(jsonb_agg(jsonb_build_object('nome', x.nome, 'serate', x.n)
                                         order by x.n desc, x.nome), '[]'::jsonb)
               from (select * from locali order by n desc, nome limit 5) x),
    'generi', (select coalesce(jsonb_agg(jsonb_build_object('codice', x.codice, 'nome', x.nome,
                                                            'serate', x.n)
                                         order by x.n desc, x.nome), '[]'::jsonb)
               from (select * from generi order by n desc, nome limit 5) x),
    'dj', (select coalesce(jsonb_agg(jsonb_build_object('nome', x.nome, 'serate', x.n)
                                     order by x.n desc, x.nome), '[]'::jsonb)
           from (select * from dj order by n desc, nome limit 5) x),
    'spese', jsonb_build_object(
      'totale_centesimi', (select coalesce(sum(importo), 0) from spese),
      'per_categoria', (select coalesce(jsonb_agg(jsonb_build_object('categoria', x.categoria,
                                                                     'importo_centesimi', x.importo)
                                                  order by x.importo desc, x.categoria), '[]'::jsonb)
                        from spese x))
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- badge (F-32)
-- ---------------------------------------------------------------------------------------------
-- R-41: il criterio ha solo un tipo tra quelli implementati in private.assegna_badge() e una
-- soglia; non esistono finestre di tempo, spesa, alcol o orari, quindi nessun badge può
-- premiare molte serate in poco tempo, la spesa o il rientro tardi.
create table public.badge (
  codice           text primary key
                   constraint badge_codice check (codice ~ '^[a-z0-9_]{2,40}$'),
  nome             text not null constraint badge_nome check (char_length(nome) between 1 and 40),
  descrizione      text not null
                   constraint badge_descrizione check (char_length(descrizione) between 1 and 160),
  criterio         jsonb not null
                   constraint badge_criterio check (
                     criterio ->> 'tipo' in ('serate', 'locali_diversi', 'generi_diversi',
                                             'dj_diversi', 'serate_con_note', 'quattro_stagioni',
                                             'stesso_locale', 'serate_con_amici')
                     and jsonb_typeof(criterio -> 'soglia') = 'number'
                     and (criterio ->> 'soglia')::numeric between 1 and 1000
                     and (criterio - 'tipo' - 'soglia') = '{}'::jsonb),
  solo_maggiorenni boolean not null default false,
  ordine           smallint not null default 0
);
comment on table public.badge is
  'Catalogo dei badge (F-32): criteri conformi a R-41, modificabile solo con una migrazione revisionata.';

alter table public.badge enable row level security;
revoke all on public.badge from anon, authenticated;
grant select on public.badge to authenticated;

-- R-41: i badge per soli maggiorenni non si mostrano ai minorenni.
create policy "badge: catalogo visibile secondo l'età"
  on public.badge for select to authenticated
  using (not solo_maggiorenni or not (select private.e_minorenne((select auth.uid()))));

-- Catalogo del brief design/F-32-badge, rivisto con la safety-review dell'iterazione 11.
insert into public.badge (codice, nome, descrizione, criterio, ordine) values
  ('prima_pagina', 'Prima pagina', 'Hai annotato la prima serata nel tuo diario.',
   '{"tipo": "serate", "soglia": 1}', 1),
  ('esploratore_1', 'Esploratore I', 'Hai annotato serate in 5 locali diversi.',
   '{"tipo": "locali_diversi", "soglia": 5}', 2),
  ('esploratore_2', 'Esploratore II', 'Hai annotato serate in 10 locali diversi.',
   '{"tipo": "locali_diversi", "soglia": 10}', 3),
  ('esploratore_3', 'Esploratore III', 'Hai annotato serate in 25 locali diversi.',
   '{"tipo": "locali_diversi", "soglia": 25}', 4),
  ('orecchio_curioso', 'Orecchio curioso', 'Hai ascoltato 5 generi musicali diversi.',
   '{"tipo": "generi_diversi", "soglia": 5}', 5),
  ('cacciatore_dj', 'Cacciatore di DJ', 'Hai annotato 10 DJ e artisti diversi.',
   '{"tipo": "dj_diversi", "soglia": 10}', 6),
  ('cronista', 'Cronista', 'Hai scritto le note di 10 serate.',
   '{"tipo": "serate_con_note", "soglia": 10}', 7),
  ('quattro_stagioni', 'Quattro stagioni',
   'Hai annotato una serata in ognuna delle quattro stagioni dello stesso anno.',
   '{"tipo": "quattro_stagioni", "soglia": 4}', 8),
  ('di_casa', 'Di casa', 'Hai annotato 5 serate nello stesso locale.',
   '{"tipo": "stesso_locale", "soglia": 5}', 9),
  ('in_compagnia', 'In compagnia', 'Hai annotato 10 serate con almeno un amico.',
   '{"tipo": "serate_con_amici", "soglia": 10}', 10);

-- ---------------------------------------------------------------------------------------------
-- badge_utente (F-32)
-- ---------------------------------------------------------------------------------------------
create table public.badge_utente (
  utente_id    uuid not null references public.profili (id) on delete cascade,
  badge_codice text not null references public.badge (codice) on delete cascade,
  ottenuto_il  timestamptz not null default now(),
  primary key (utente_id, badge_codice)
);
comment on table public.badge_utente is
  'Badge ottenuti: li vede solo il titolare; li scrive solo private.assegna_badge() (R-41, R-69).';

alter table public.badge_utente enable row level security;
revoke all on public.badge_utente from anon, authenticated;
grant select on public.badge_utente to authenticated;

-- R-69: solo il titolare, nessuna policy per i moderatori né per gli amici.
create policy "badge_utente: il titolare vede i suoi badge"
  on public.badge_utente for select to authenticated
  using (utente_id = (select auth.uid()));

-- Valori del diario usati dai criteri, per tutti gli utenti con almeno una serata.
-- Luoghi diversi: locali del catalogo e nomi scritti a mano (senza distinzione di maiuscole).
-- Stagioni nello stesso anno solare: inverno (dicembre, gennaio, febbraio), primavera,
-- estate, autunno.
create or replace function private.assegna_badge()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  notificati integer;
begin
  with serate as (
    select s.id, s.utente_id, s.data_serata, s.evento_id, s.note,
           case when s.locale_id is not null then s.locale_id::text
                when s.nome_locale_libero is not null then 'libero:' || lower(s.nome_locale_libero)
           end as luogo
    from public.serate_tracker s
  ),
  base as (
    select s.utente_id,
           count(*) as serate,
           count(distinct s.luogo) as locali_diversi,
           count(*) filter (where nullif(btrim(s.note), '') is not null) as serate_con_note,
           count(*) filter (where exists (select 1 from public.tracker_amici a
                                          where a.serata_tracker_id = s.id)) as serate_con_amici
    from serate s
    group by s.utente_id
  ),
  generi as (
    select s.utente_id, count(distinct eg.genere_codice) as n
    from serate s join public.eventi_generi eg on eg.evento_id = s.evento_id
    group by s.utente_id
  ),
  dj as (
    select s.utente_id, count(distinct lower(d.nome_dj)) as n
    from serate s join public.tracker_dj d on d.serata_tracker_id = s.id
    group by s.utente_id
  ),
  stagioni as (
    select x.utente_id, max(x.n) as n
    from (select s.utente_id, extract(year from s.data_serata) as anno,
                 count(distinct case when extract(month from s.data_serata) in (12, 1, 2) then 1
                                     when extract(month from s.data_serata) in (3, 4, 5) then 2
                                     when extract(month from s.data_serata) in (6, 7, 8) then 3
                                     else 4 end) as n
          from serate s group by 1, 2) x
    group by x.utente_id
  ),
  stesso as (
    select x.utente_id, max(x.n) as n
    from (select s.utente_id, s.luogo, count(*) as n
          from serate s where s.luogo is not null group by 1, 2) x
    group by x.utente_id
  ),
  valori as (
    select b.utente_id,
           jsonb_build_object(
             'serate', b.serate,
             'locali_diversi', b.locali_diversi,
             'generi_diversi', coalesce(g.n, 0),
             'dj_diversi', coalesce(d.n, 0),
             'serate_con_note', b.serate_con_note,
             'quattro_stagioni', coalesce(st.n, 0),
             'stesso_locale', coalesce(so.n, 0),
             'serate_con_amici', b.serate_con_amici) as v
    from base b
    left join generi g on g.utente_id = b.utente_id
    left join dj d on d.utente_id = b.utente_id
    left join stagioni st on st.utente_id = b.utente_id
    left join stesso so on so.utente_id = b.utente_id
  ),
  inseriti as (
    insert into public.badge_utente (utente_id, badge_codice)
    select v.utente_id, c.codice
    from valori v
    cross join public.badge c
    where (v.v ->> (c.criterio ->> 'tipo'))::numeric >= (c.criterio ->> 'soglia')::numeric
      -- R-41: nessun badge per soli maggiorenni a un minorenne.
      and (not c.solo_maggiorenni or not private.e_minorenne(v.utente_id))
    on conflict do nothing
    returning utente_id, badge_codice
  ),
  per_utente as (
    select i.utente_id, count(*) as quanti,
           (array_agg(i.badge_codice order by c.ordine desc))[1] as codice
    from inseriti i join public.badge c on c.codice = i.badge_codice
    group by i.utente_id
  )
  -- Una sola notifica per persona e per giro, con il badge più alto e il numero dei nuovi.
  insert into public.notifiche (utente_id, tipo, dati)
  select p.utente_id, 'badge_ottenuto',
         jsonb_build_object('badge_codice', p.codice, 'nome', c.nome, 'quanti', p.quanti)
  from per_utente p join public.badge c on c.codice = p.codice;
  get diagnostics notificati = row_count;
  return notificati;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- riepiloghi_annuali (F-33)
-- ---------------------------------------------------------------------------------------------
-- R-42: `dati` ammette solo le chiavi del formato del riepilogo; nessuna è pensata per altri
-- utenti (gli amici sono solo conteggi). R-43: nessuna spesa.
create table public.riepiloghi_annuali (
  utente_id   uuid not null references public.profili (id) on delete cascade,
  anno        smallint not null constraint riepiloghi_annuali_anno check (anno between 2000 and 2100),
  dati        jsonb not null
              constraint riepiloghi_annuali_formato check (
                jsonb_typeof(dati) = 'object'
                and (dati - array['anno', 'serate', 'per_mese', 'mese_top', 'locali_diversi',
                                  'locali_top', 'genere_top', 'dj_top', 'serate_con_amici',
                                  'amici_diversi', 'badge', 'voto_top']) = '{}'::jsonb),
  generato_il timestamptz not null default now(),
  primary key (utente_id, anno)
);
comment on table public.riepiloghi_annuali is
  'Riepilogo annuale (F-33): solo conteggi e classifiche personali, mai altri utenti (R-42).';

alter table public.riepiloghi_annuali enable row level security;
revoke all on public.riepiloghi_annuali from anon, authenticated;
grant select on public.riepiloghi_annuali to authenticated;

-- R-69: solo il titolare.
create policy "riepiloghi_annuali: il titolare vede i suoi riepiloghi"
  on public.riepiloghi_annuali for select to authenticated
  using (utente_id = (select auth.uid()));

-- Riepilogo di una persona per un anno solare, o null con meno di 3 serate. Per nome compaiono
-- solo i locali del catalogo, i generi e i DJ: i nomi di luoghi scritti a mano potrebbero
-- contenere nomi di persone e restano solo contati (R-42). Gli amici sono solo numeri. Nessuna
-- spesa (R-43), nessun titolo di evento, nessuna nota.
create or replace function private.calcola_riepilogo(utente uuid, anno smallint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with serate as (
    select s.id, s.data_serata, s.evento_id, s.locale_id, s.nome_locale_libero, s.voto
    from public.serate_tracker s
    where s.utente_id = calcola_riepilogo.utente
      and s.data_serata between make_date(calcola_riepilogo.anno, 1, 1)
                            and make_date(calcola_riepilogo.anno, 12, 31)
  ),
  mesi as (
    select extract(month from s.data_serata)::int as mese, count(*) as n from serate s group by 1
  ),
  locali as (
    select l.nome, count(*) as n
    from serate s join public.locali l on l.id = s.locale_id
    group by l.id, l.nome
  ),
  generi as (
    select g.codice, g.nome, count(distinct s.id) as n
    from serate s
    join public.eventi_generi eg on eg.evento_id = s.evento_id
    join public.generi_musicali g on g.codice = eg.genere_codice
    where g.codice <> 'altro'
    group by g.codice, g.nome
  ),
  dj as (
    select min(d.nome_dj collate "C") as nome, count(*) as n
    from serate s join public.tracker_dj d on d.serata_tracker_id = s.id
    group by lower(d.nome_dj)
  )
  select case when (select count(*) from serate) < 3 then null else jsonb_build_object(
    'anno', calcola_riepilogo.anno,
    'serate', (select count(*) from serate),
    'per_mese', (select jsonb_agg(coalesce(x.n, 0) order by m.mese)
                 from generate_series(1, 12) as m (mese) left join mesi x on x.mese = m.mese),
    'mese_top', (select jsonb_build_object('mese', x.mese, 'serate', x.n)
                 from mesi x order by x.n desc, x.mese desc limit 1),
    'locali_diversi', (select count(distinct coalesce(s.locale_id::text,
                                                      'libero:' || lower(s.nome_locale_libero)))
                       from serate s
                       where s.locale_id is not null or s.nome_locale_libero is not null),
    'locali_top', (select coalesce(jsonb_agg(jsonb_build_object('nome', x.nome, 'serate', x.n)
                                             order by x.n desc, x.nome), '[]'::jsonb)
                   from (select * from locali order by n desc, nome limit 3) x),
    'genere_top', (select jsonb_build_object('codice', x.codice, 'nome', x.nome, 'serate', x.n)
                   from generi x order by x.n desc, x.nome limit 1),
    'dj_top', (select coalesce(jsonb_agg(jsonb_build_object('nome', x.nome, 'serate', x.n)
                                         order by x.n desc, x.nome), '[]'::jsonb)
               from (select * from dj order by n desc, nome limit 3) x),
    'serate_con_amici', (select count(*) from serate s
                         where exists (select 1 from public.tracker_amici a
                                       where a.serata_tracker_id = s.id)),
    'amici_diversi', (select count(distinct a.amico_id)
                      from serate s join public.tracker_amici a on a.serata_tracker_id = s.id),
    'badge', (select coalesce(jsonb_agg(b.badge_codice order by b.ottenuto_il, b.badge_codice),
                              '[]'::jsonb)
              from public.badge_utente b
              where b.utente_id = calcola_riepilogo.utente
                and extract(year from b.ottenuto_il at time zone 'Europe/Rome') = calcola_riepilogo.anno),
    'voto_top', (select jsonb_build_object('data_serata', s.data_serata, 'locale', l.nome,
                                           'voto', s.voto)
                 from serate s left join public.locali l on l.id = s.locale_id
                 where s.voto is not null
                 order by s.voto desc, s.data_serata desc limit 1)
  ) end;
$$;

-- Scrive (o toglie, sotto le 3 serate) il riepilogo di una persona; true se è nuovo.
create or replace function private.scrivi_riepilogo(utente uuid, anno smallint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  contenuto jsonb := private.calcola_riepilogo(utente, anno);
  nuovo boolean;
begin
  if contenuto is null then
    delete from public.riepiloghi_annuali r
    where r.utente_id = scrivi_riepilogo.utente and r.anno = scrivi_riepilogo.anno;
    return false;
  end if;
  insert into public.riepiloghi_annuali as r (utente_id, anno, dati, generato_il)
  values (scrivi_riepilogo.utente, scrivi_riepilogo.anno, contenuto, now())
  on conflict on constraint riepiloghi_annuali_pkey
  do update set dati = excluded.dati, generato_il = excluded.generato_il
  returning (r.xmax = 0) into nuovo;
  return nuovo;
end;
$$;

-- Riepiloghi di un anno per tutte le persone con almeno una serata, a blocchi di 1.000 in
-- ordine di identificativo; notifica `riepilogo_pronto` solo per i riepiloghi nuovi. Toglie i
-- riepiloghi di chi è sceso sotto le 3 serate.
create or replace function private.genera_riepiloghi(anno smallint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ultimo uuid := '00000000-0000-0000-0000-000000000000';
  blocco uuid[];
  persona uuid;
  scritti integer := 0;
begin
  loop
    select array_agg(x.utente_id order by x.utente_id) into blocco
    from (select distinct s.utente_id
          from public.serate_tracker s
          where s.utente_id > ultimo
            and s.data_serata between make_date(genera_riepiloghi.anno, 1, 1)
                                  and make_date(genera_riepiloghi.anno, 12, 31)
          order by s.utente_id
          limit 1000) x;
    exit when blocco is null;
    foreach persona in array blocco loop
      if private.scrivi_riepilogo(persona, genera_riepiloghi.anno) then
        perform private.crea_notifica(persona, 'riepilogo_pronto',
                                      jsonb_build_object('anno', genera_riepiloghi.anno));
      end if;
    end loop;
    scritti := scritti + cardinality(blocco);
    ultimo := blocco[cardinality(blocco)];
  end loop;
  delete from public.riepiloghi_annuali r
  where r.anno = genera_riepiloghi.anno
    and not exists (select 1 from public.serate_tracker s
                    where s.utente_id = r.utente_id
                      and s.data_serata between make_date(genera_riepiloghi.anno, 1, 1)
                                            and make_date(genera_riepiloghi.anno, 12, 31));
  return scritti;
end;
$$;

-- Aggiornamento richiesto dalla persona, con la data di oggi passata da fuori (i test la
-- scelgono). Il riepilogo dell'anno si apre il 1° dicembre e si aggiorna fino al 31 gennaio,
-- una volta al giorno. Restituisce i dati, o null se le serate sono meno di 3.
create or replace function private.rigenera_riepilogo(utente uuid, oggi date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  anno_riepilogo smallint;
  ultimo timestamptz;
begin
  if utente is null then
    raise exception using errcode = '42501', message = 'Accesso richiesto.';
  end if;
  if extract(month from oggi) = 12 then
    anno_riepilogo := extract(year from oggi)::smallint;
  elsif extract(month from oggi) = 1 then
    anno_riepilogo := (extract(year from oggi) - 1)::smallint;
  else
    raise exception using errcode = 'NX062', message = 'Il riepilogo dell''anno si apre il 1° dicembre.';
  end if;
  select r.generato_il into ultimo
  from public.riepiloghi_annuali r
  where r.utente_id = utente and r.anno = anno_riepilogo;
  if ultimo is not null and (ultimo at time zone 'Europe/Rome')::date >= oggi then
    raise exception using errcode = 'NX063', message = 'Puoi aggiornarlo di nuovo domani.';
  end if;
  perform private.scrivi_riepilogo(utente, anno_riepilogo);
  return (select r.dati from public.riepiloghi_annuali r
          where r.utente_id = utente and r.anno = anno_riepilogo);
end;
$$;

create or replace function public.rigenera_mio_riepilogo()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.rigenera_riepilogo(auth.uid(), (now() at time zone 'Europe/Rome')::date);
$$;

-- ---------------------------------------------------------------------------------------------
-- Esportazione dei dati (R-64): si aggiungono badge e riepiloghi
-- ---------------------------------------------------------------------------------------------
alter function public.esporta_miei_dati() set schema private;
alter function private.esporta_miei_dati() rename to esporta_dati_vivi;
revoke all on function private.esporta_dati_vivi() from public, anon, authenticated;

create or replace function public.esporta_miei_dati()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := auth.uid();
begin
  return private.esporta_dati_vivi() || jsonb_build_object(
    'badge', coalesce((
      select jsonb_agg(jsonb_build_object('codice', b.badge_codice, 'nome', c.nome,
                                          'ottenuto_il', b.ottenuto_il)
                       order by b.ottenuto_il)
      from public.badge_utente b join public.badge c on c.codice = b.badge_codice
      where b.utente_id = io), '[]'::jsonb),
    'riepiloghi_annuali', coalesce((
      select jsonb_agg(jsonb_build_object('anno', r.anno, 'dati', r.dati,
                                          'generato_il', r.generato_il)
                       order by r.anno)
      from public.riepiloghi_annuali r where r.utente_id = io), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Job pianificati (orari in UTC): badge ogni giorno, riepiloghi il 1° dicembre e, per
-- includere dicembre, di nuovo il 1° gennaio per l'anno appena chiuso
-- ---------------------------------------------------------------------------------------------
select cron.schedule('assegna-badge', '0 4 * * *', $$select private.assegna_badge()$$);
select cron.schedule('genera-riepiloghi', '0 3 1 12 *',
  $$select private.genera_riepiloghi(extract(year from now())::smallint)$$);
select cron.schedule('chiudi-riepiloghi', '0 3 1 1 *',
  $$select private.genera_riepiloghi((extract(year from now()) - 1)::smallint)$$);

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function public.mie_statistiche(smallint) from public, anon;
grant execute on function public.mie_statistiche(smallint) to authenticated;
revoke all on function private.assegna_badge() from public;
revoke all on function private.calcola_riepilogo(uuid, smallint) from public;
revoke all on function private.scrivi_riepilogo(uuid, smallint) from public;
revoke all on function private.genera_riepiloghi(smallint) from public;
revoke all on function private.rigenera_riepilogo(uuid, date) from public;
revoke all on function public.rigenera_mio_riepilogo() from public, anon;
grant execute on function public.rigenera_mio_riepilogo() to authenticated;
revoke all on function public.esporta_miei_dati() from public, anon;
grant execute on function public.esporta_miei_dati() to authenticated;
