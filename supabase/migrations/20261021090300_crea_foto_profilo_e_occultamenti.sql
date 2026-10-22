-- Migrazione: foto profilo (bucket avatar), contenuti nascosti in attesa della revisione
-- (D-15, ADR-0023) e copertine sostitutive; avatar degli amici nelle ricerche degli eventi
-- Documentazione: docs/DATA_MODEL.md §5.1 (profili), §5.2 (contenuti_occultati), §5.3, §6;
-- ADR-0018, ADR-0023; regole: R-20, R-23, R-50, R-52, R-53, R-55, R-56

-- ---------------------------------------------------------------------------------------------
-- profili: foto profilo (R-52)
-- ---------------------------------------------------------------------------------------------
-- La foto sta sempre nella cartella del titolare (`<id>/<uuid>.webp`). avatar_nascosto lo
-- impostano solo i contenuti occultati (D-15): al posto della foto l'app mostra un'immagine
-- sostitutiva, e il bucket non la consegna a nessuno.
alter table public.profili
  add column avatar_nascosto boolean not null default false,
  add constraint profili_avatar_percorso
    check (avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.webp$'));
create index profili_avatar_path_idx on public.profili (avatar_path) where avatar_path is not null;

-- ---------------------------------------------------------------------------------------------
-- contenuti_occultati (D-15, ADR-0023, R-55): immagini rese inaccessibili in attesa della
-- decisione di un moderatore, o come prova in un'escalation
-- ---------------------------------------------------------------------------------------------
create table public.contenuti_occultati (
  tipo_oggetto         public.tipo_oggetto_segnalabile not null
                       constraint contenuti_occultati_tipo
                       check (tipo_oggetto in ('foto_profilo', 'evento', 'immagine_locale')),
  oggetto_id           uuid not null,
  segnalazione_id      uuid references public.segnalazioni (id) on delete set null,
  -- true: nascosto in automatico (D-15); false: da un moderatore (escalation R-55).
  automatico           boolean not null,
  conservazione_legale boolean not null default false,
  creato_il            timestamptz not null default now(),
  primary key (tipo_oggetto, oggetto_id)
);
comment on table public.contenuti_occultati is
  'Immagini nascoste in attesa della revisione (D-15) o conservate come prova (R-55).';

alter table public.contenuti_occultati enable row level security;
revoke all on public.contenuti_occultati from anon, authenticated;
grant select on public.contenuti_occultati to authenticated;

-- Gli utenti non leggono la tabella: l'effetto si vede nelle copertine e nell'avatar.
create policy "contenuti_occultati: i moderatori li vedono"
  on public.contenuti_occultati for select to authenticated
  using ((select private.e_moderatore()));

create or replace function private.e_occultato(tipo public.tipo_oggetto_segnalabile, oggetto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.contenuti_occultati c
                 where c.tipo_oggetto = tipo and c.oggetto_id = oggetto);
$$;

-- L'avatar nascosto si legge da profili senza esporre la tabella.
create or replace function private.sincronizza_avatar_nascosto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.tipo_oggetto = 'foto_profilo' then
    update public.profili p set avatar_nascosto = true where p.id = new.oggetto_id;
  elsif tg_op = 'DELETE' and old.tipo_oggetto = 'foto_profilo' then
    update public.profili p set avatar_nascosto = false where p.id = old.oggetto_id;
  end if;
  return null;
end;
$$;

create trigger contenuti_occultati_avatar
  after insert or delete on public.contenuti_occultati
  for each row execute function private.sincronizza_avatar_nascosto();

-- ---------------------------------------------------------------------------------------------
-- Storage: bucket avatar (DATA_MODEL.md §6, R-52)
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatar', 'avatar', false, 2 * 1024 * 1024, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- R-52: la foto in uso si legge come il profilo (la sottoquery è soggetta alla RLS di profili,
-- quindi a private.puo_vedere_profilo), mai se è nascosta.
create policy "avatar: foto visibili come il profilo"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatar'
    and exists (select 1 from public.profili p
                where p.avatar_path = name and not p.avatar_nascosto)
  );

-- Il titolare vede i file della propria cartella (anteprima prima del salvataggio).
create policy "avatar: il titolare vede i propri file"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatar' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- R-69: un moderatore vede la foto solo di un profilo segnalato.
create policy "avatar: i moderatori vedono le foto segnalate"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatar'
    and (select private.e_moderatore())
    and exists (select 1 from public.segnalazioni s
                where s.tipo_oggetto in ('profilo', 'foto_profilo')
                  and s.oggetto_id::text = (storage.foldername(name))[1])
  );

create policy "avatar: il titolare carica nella propria cartella"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatar' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatar: il titolare elimina i propri file"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatar' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------------------------
-- Immagini degli eventi e dei locali: una copertina nascosta non si consegna (D-15)
-- ---------------------------------------------------------------------------------------------
drop policy "flyer-pubblicati: immagini degli eventi visibili" on storage.objects;
create policy "flyer-pubblicati: immagini degli eventi visibili"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'flyer-pubblicati'
    and exists (select 1 from public.eventi e
                where e.immagine_path = name and not private.e_occultato('evento', e.id))
  );

-- Revisione delle segnalazioni: i moderatori vedono anche le copertine nascoste.
create policy "flyer-pubblicati: i moderatori vedono le immagini"
  on storage.objects for select to authenticated
  using (bucket_id = 'flyer-pubblicati' and (select private.e_moderatore()));

drop policy "immagini-locali: foto dei locali visibili" on storage.objects;
create policy "immagini-locali: foto dei locali visibili"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'immagini-locali'
    and exists (select 1 from public.locali l
                where l.immagine_path = name and not private.e_occultato('immagine_locale', l.id))
  );

-- ---------------------------------------------------------------------------------------------
-- Ricerca e dettaglio degli eventi: copertina sostitutiva al posto di un'immagine nascosta
-- (ADR-0023) e foto degli amici che partecipano (R-52: sono amici, quindi visibili)
-- ---------------------------------------------------------------------------------------------
create or replace function private.copertina_evento(
  evento uuid,
  locale uuid,
  immagine_locale text,
  immagine_evento text,
  attribuzione text
)
returns table (tipo text, percorso text, attribuzione_copertina text)
language sql
stable
security definer
set search_path = ''
as $$
  -- ADR-0018: foto del locale, poi flyer approvato; se una delle due è nascosta (D-15) e non
  -- c'è un'alternativa, l'immagine sostitutiva; altrimenti il fondo tipografico.
  select case when immagine_locale is not null and not lo then 'locale'
              when immagine_evento is not null and not eo then 'flyer'
              when lo or eo then 'sostitutiva'
              else 'tipografica' end,
         case when immagine_locale is not null and not lo then immagine_locale
              when immagine_evento is not null and not eo then immagine_evento end,
         case when immagine_locale is not null and not lo then attribuzione end
  from (select immagine_locale is not null and private.e_occultato('immagine_locale', locale) as lo,
               immagine_evento is not null and private.e_occultato('evento', evento) as eo) o;
$$;

create or replace function public.cerca_eventi(
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
  mia_partecipazione public.stato_partecipazione_evento
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
          where p.evento_id = e.id and p.utente_id = auth.uid())
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

create or replace function public.dettaglio_evento(evento uuid)
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
  mia_visibilita boolean
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
         mia.visibile_agli_amici
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

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function private.e_occultato(public.tipo_oggetto_segnalabile, uuid) from public;
revoke all on function private.sincronizza_avatar_nascosto() from public;
revoke all on function private.copertina_evento(uuid, uuid, text, text, text) from public;
grant execute on function private.e_occultato(public.tipo_oggetto_segnalabile, uuid) to authenticated;
grant execute on function private.copertina_evento(uuid, uuid, text, text, text) to authenticated;
