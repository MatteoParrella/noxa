-- Migrazione: colori della copertina generata letti dalle immagini delle fonti (ADR-0030).
-- Documentazione: docs/DATA_MODEL.md §5.3 (`eventi`); regole: R-20, R-23 (visibilità invariata).
-- Si salva solo una tavolozza di colori, mai l'immagine: il formato è controllato qui.

create or replace function private.tavolozza_valida(t jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(t) = 'object'
     and (select count(*) from jsonb_object_keys(t)) = 4
     and coalesce(t ->> 'fondo', '') ~ '^#[0-9A-F]{6}$'
     and coalesce(t ->> '1', '') ~ '^#[0-9A-F]{6}$'
     and coalesce(t ->> '2', '') ~ '^#[0-9A-F]{6}$'
     and coalesce(t ->> 'bagliore', '') ~ '^#[0-9A-F]{6}$';
$$;

create or replace function private.copertina_colori_valida(c jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select c is null
      or (jsonb_typeof(c) = 'object'
          and (select count(*) from jsonb_object_keys(c)) = 3
          and private.tavolozza_valida(c -> 'scuro')
          and private.tavolozza_valida(c -> 'chiaro')
          and coalesce(c ->> 'calcolata_il', '') ~ '^\d{4}-\d{2}-\d{2}T');
$$;

revoke all on function private.tavolozza_valida(jsonb) from public;
revoke all on function private.copertina_colori_valida(jsonb) from public;
-- Il vincolo si valuta con i permessi di chi scrive: il worker e i moderatori.
grant execute on function private.tavolozza_valida(jsonb) to authenticated, noxa_worker;
grant execute on function private.copertina_colori_valida(jsonb) to authenticated, noxa_worker;

alter table public.eventi
  add column copertina_colori jsonb
  constraint eventi_copertina_colori check (private.copertina_colori_valida(copertina_colori));
comment on column public.eventi.copertina_colori is
  'Tavolozza della copertina generata (scuro/chiaro: fondo, 1, 2, bagliore; calcolata_il), '
  'estratta in memoria da un''immagine della fonte e mai l''immagine stessa (ADR-0030).';

-- Le RPC restituiscono la tavolozza: cambia il tipo restituito, quindi drop e create.
drop function public.cerca_eventi(double precision, double precision, numeric, date, date, text[],
                                  smallint, boolean);
drop function public.dettaglio_evento(uuid);

create function public.cerca_eventi(
  lat double precision default null,
  lon double precision default null,
  raggio_km numeric default null,
  dal date default null,
  al date default null,
  generi text[] default null,
  eta_minima_max smallint default null,
  solo_amici boolean default false
)
returns table (
  id uuid,
  titolo text,
  inizio timestamptz,
  fine timestamptz,
  data_serata date,
  eta_minima smallint,
  eta_minima_dichiarata boolean,
  stato public.stato_evento,
  prezzo_min_centesimi integer,
  generi_evento text[],
  locale_id uuid,
  locale_nome text,
  locale_comune text,
  locale_lat double precision,
  locale_lon double precision,
  distanza_m integer,
  copertina_tipo text,
  copertina_path text,
  copertina_attribuzione text,
  amici_partecipano integer,
  amici_interessati integer,
  amici jsonb,
  mia_partecipazione public.stato_partecipazione_evento,
  copertina_colori jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  oggi date := ((now() at time zone 'Europe/Rome') - interval '6 hours')::date;
  v_dal date := coalesce(dal, oggi);
  v_al date := coalesce(al, dal, oggi);
  punto extensions.geography;
begin
  if (lat is null) <> (lon is null)
     or lat not between -90 and 90 or lon not between -180 and 180 then
    raise exception using errcode = '22023', message = 'Coordinate non valide.';
  end if;
  if raggio_km is not null and raggio_km not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Distanza non valida.';
  end if;
  if v_al < v_dal or v_al - v_dal > 62 then
    raise exception using errcode = '22023', message = 'Intervallo di date non valido.';
  end if;
  if lat is not null then
    punto := extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography;
  end if;

  -- Prima si scelgono i (al massimo) 300 eventi da restituire, poi si calcolano generi e amici
  -- solo per quelli: con un mese di eventi la ricerca resta sotto gli 800 ms (PRD F-01).
  return query
  with scelti as (
    select e.id
    from public.eventi e
    join public.locali l on l.id = e.locale_id
    where e.data_serata between v_dal and v_al
      and coalesce(e.fine, e.inizio + interval '6 hours') > now()
      and (eta_minima_max is null or e.eta_minima <= eta_minima_max)
      and (generi is null or cardinality(generi) = 0
           or exists (select 1 from public.eventi_generi g
                      where g.evento_id = e.id and g.genere_codice = any (generi)))
      and (punto is null or raggio_km is null
           or extensions.st_dwithin(l.posizione, punto, raggio_km * 1000))
      -- R-67: la RLS lascia solo le partecipazioni visibili degli amici confermati.
      and (not solo_amici
           or exists (select 1 from public.partecipazioni_evento p
                      join public.profili pr on pr.id = p.utente_id
                      where p.evento_id = e.id and p.utente_id <> auth.uid()))
    order by e.inizio, e.titolo, e.id
    limit 300
  )
  select e.id, e.titolo, e.inizio, e.fine, e.data_serata, e.eta_minima,
         e.eta_minima_dichiarata, e.stato, e.prezzo_min_centesimi,
         coalesce((select array_agg(g.genere_codice order by g.genere_codice)
                   from public.eventi_generi g where g.evento_id = e.id), '{}'),
         l.id, l.nome, l.comune,
         extensions.st_y(l.posizione::extensions.geometry),
         extensions.st_x(l.posizione::extensions.geometry),
         case when punto is not null
              then round(extensions.st_distance(l.posizione, punto))::integer end,
         c.tipo, c.percorso, c.attribuzione_copertina,
         coalesce(a.partecipano, 0),
         coalesce(a.interessati, 0),
         coalesce(a.primi, '[]'::jsonb),
         (select p.stato from public.partecipazioni_evento p
          where p.evento_id = e.id and p.utente_id = auth.uid()),
         e.copertina_colori
  from scelti s
  join public.eventi e on e.id = s.id
  join public.locali l on l.id = e.locale_id
  cross join lateral private.copertina_evento(e.id, l.id, l.immagine_path, e.immagine_path,
                                              l.immagine_attribuzione) c
  left join lateral (
    select count(*) filter (where p.stato = 'partecipo')::integer as partecipano,
           count(*) filter (where p.stato = 'interessato')::integer as interessati,
           to_jsonb((array_agg(jsonb_build_object('id', pr.id,
                                                  'nome_visualizzato', pr.nome_visualizzato,
                                                  'avatar_path', case when not pr.avatar_nascosto
                                                                      then pr.avatar_path end,
                                                  'avatar_nascosto', pr.avatar_nascosto,
                                                  'stato', p.stato)
                               order by p.stato desc, pr.nome_visualizzato))[1:3]) as primi
    from public.partecipazioni_evento p
    join public.profili pr on pr.id = p.utente_id
    where p.evento_id = e.id and p.utente_id <> auth.uid()
  ) a on true
  order by e.inizio, e.titolo, e.id;
end;
$$;

create function public.dettaglio_evento(evento uuid)
returns table (
  id uuid,
  titolo text,
  descrizione text,
  inizio timestamptz,
  fine timestamptz,
  data_serata date,
  eta_minima smallint,
  eta_minima_dichiarata boolean,
  stato public.stato_evento,
  artisti text[],
  prezzo_min_centesimi integer,
  url_biglietti text,
  generi_evento text[],
  locale_id uuid,
  locale_nome text,
  locale_indirizzo text,
  locale_comune text,
  locale_lat double precision,
  locale_lon double precision,
  copertina_tipo text,
  copertina_path text,
  copertina_attribuzione text,
  fonte_tipo text,
  fonte_url text,
  amici jsonb,
  mia_partecipazione public.stato_partecipazione_evento,
  mia_visibilita boolean,
  copertina_colori jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.id, e.titolo, e.descrizione, e.inizio, e.fine, e.data_serata, e.eta_minima,
         e.eta_minima_dichiarata, e.stato, e.artisti, e.prezzo_min_centesimi, e.url_biglietti,
         coalesce((select array_agg(g.genere_codice order by g.genere_codice)
                   from public.eventi_generi g where g.evento_id = e.id), '{}'),
         l.id, l.nome, l.indirizzo, l.comune,
         extensions.st_y(l.posizione::extensions.geometry),
         extensions.st_x(l.posizione::extensions.geometry),
         c.tipo, c.percorso, c.attribuzione_copertina,
         -- Fonte più affidabile con un link (EVENT_INGESTION.md §7); per i soli flyer il sito o
         -- l'Instagram del locale.
         coalesce(f.tipo_origine,
                  case when l.sito_web is not null then 'sito_locale'
                       when l.instagram_username is not null then 'instagram' end),
         coalesce(f.url_originale, l.sito_web,
                  'https://www.instagram.com/' || l.instagram_username || '/'),
         coalesce((
           select jsonb_agg(jsonb_build_object('id', pr.id,
                                               'username', pr.username,
                                               'nome_visualizzato', pr.nome_visualizzato,
                                               'avatar_path', case when not pr.avatar_nascosto
                                                                   then pr.avatar_path end,
                                               'avatar_nascosto', pr.avatar_nascosto,
                                               'stato', p.stato)
                            order by p.stato desc, pr.nome_visualizzato)
           from public.partecipazioni_evento p
           join public.profili pr on pr.id = p.utente_id
           where p.evento_id = e.id and p.utente_id <> auth.uid()
         ), '[]'::jsonb),
         mia.stato,
         mia.visibile_agli_amici,
         e.copertina_colori
  from public.eventi e
  join public.locali l on l.id = e.locale_id
  cross join lateral private.copertina_evento(e.id, l.id, l.immagine_path, e.immagine_path,
                                              l.immagine_attribuzione) c
  left join lateral (
    select ef.tipo_origine, ef.url_originale
    from public.eventi_fonti ef
    where ef.evento_id = e.id and ef.url_originale is not null
    order by case ef.tipo_origine when 'sito_locale' then 1 when 'instagram' then 2 else 3 end,
             ef.raccolto_il desc
    limit 1
  ) f on true
  left join public.partecipazioni_evento mia
    on mia.evento_id = e.id and mia.utente_id = auth.uid()
  where e.id = evento;
$$;

revoke all on function public.cerca_eventi(double precision, double precision, numeric, date, date,
                                           text[], smallint, boolean) from public, anon;
revoke all on function public.dettaglio_evento(uuid) from public, anon;
grant execute on function public.cerca_eventi(double precision, double precision, numeric, date,
                                              date, text[], smallint, boolean) to authenticated;
grant execute on function public.dettaglio_evento(uuid) to authenticated;
