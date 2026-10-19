-- Migrazione: catalogo degli eventi (locali, generi, eventi, fonti, partecipazioni), foto dei
-- locali e immagini dei flyer pubblicati, RPC di ricerca e di dettaglio
-- Documentazione: docs/DATA_MODEL.md §3, §4, §5.3, §5.4, §5.10, §6; ADR-0016, ADR-0018;
-- regole: R-20, R-21, R-22, R-23, R-33, R-50, R-56, R-67

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------------------------
create type public.stato_evento as enum ('in_revisione', 'pubblicato', 'rifiutato', 'annullato');
create type public.stato_partecipazione_evento as enum ('interessato', 'partecipo');
create type public.fonte_immagine_locale as enum ('autorizzazione_locale', 'noxa', 'licenza_libera');
-- Motivo per le segnalazioni di orari, luogo o età sbagliati di un evento (F-03).
alter type public.motivo_segnalazione add value if not exists 'dati_errati';

-- ---------------------------------------------------------------------------------------------
-- locali (ADR-0018, R-56)
-- ---------------------------------------------------------------------------------------------
create table public.locali (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null
                        constraint locali_nome_lunghezza check (char_length(btrim(nome)) between 1 and 120),
  nome_normalizzato     text not null,
  indirizzo             text not null,
  comune                text not null,
  provincia             text not null constraint locali_provincia check (provincia in ('MI', 'MB')),
  posizione             extensions.geography(Point, 4326) not null,
  osm_id                text unique,
  google_place_id       text unique,
  sito_web              text constraint locali_sito_web check (sito_web ~ '^https?://\S+$'),
  instagram_username    text constraint locali_instagram check (instagram_username ~ '^[A-Za-z0-9_.]{1,30}$'),
  immagine_path         text,
  immagine_fonte        public.fonte_immagine_locale,
  immagine_attribuzione text,
  immagine_riferimento  text,
  immagine_approvata_da uuid references public.profili (id) on delete set null,
  immagine_approvata_il timestamptz,
  attivo                boolean not null default true,
  creato_il             timestamptz not null default now(),
  aggiornato_il         timestamptz not null default now(),
  -- R-56: una foto ha sempre il percorso previsto, una fonte lecita e l'approvazione; la
  -- licenza libera chiede l'attribuzione, l'autorizzazione del locale il riferimento.
  constraint locali_immagine_coerente check (
    (immagine_path is null and immagine_fonte is null and immagine_attribuzione is null
     and immagine_riferimento is null and immagine_approvata_il is null)
    or (immagine_path = id::text || '.webp'
        and immagine_fonte is not null
        and immagine_approvata_il is not null
        and (immagine_fonte <> 'licenza_libera'
             or char_length(btrim(coalesce(immagine_attribuzione, ''))) > 0)
        and (immagine_fonte <> 'autorizzazione_locale'
             or char_length(btrim(coalesce(immagine_riferimento, ''))) > 0))
  )
);
comment on table public.locali is
  'Locali di Milano e Brianza; la foto principale fa da copertina dei loro eventi (ADR-0018, R-56).';
create index locali_posizione_idx on public.locali using gist (posizione);

alter table public.locali enable row level security;
revoke all on public.locali from anon, authenticated;
grant select, insert, update on public.locali to authenticated;
grant select on public.locali to noxa_worker;

create policy "locali: visibili se attivi, ai moderatori tutti"
  on public.locali for select to authenticated
  using (attivo or (select private.e_moderatore()));

create policy "locali: i moderatori li creano"
  on public.locali for insert to authenticated
  with check ((select private.e_moderatore()));

-- R-56: solo i moderatori cambiano i locali e la loro foto.
create policy "locali: i moderatori li modificano"
  on public.locali for update to authenticated
  using ((select private.e_moderatore()))
  with check ((select private.e_moderatore()));

create policy "locali: il worker li legge"
  on public.locali for select to noxa_worker
  using (true);

-- R-56: chi carica una nuova foto è il moderatore che la approva, ora.
create or replace function private.registra_approvazione_immagine()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.immagine_path is null then
    new.immagine_approvata_da := null;
    new.immagine_approvata_il := null;
  elsif tg_op = 'INSERT' or new.immagine_path is distinct from old.immagine_path
        or new.immagine_fonte is distinct from old.immagine_fonte then
    new.immagine_approvata_da := auth.uid();
    new.immagine_approvata_il := now();
  end if;
  return new;
end;
$$;

create trigger locali_approvazione_immagine
  before insert or update on public.locali
  for each row execute function private.registra_approvazione_immagine();

create trigger locali_aggiornato_il
  before update on public.locali
  for each row execute function private.imposta_aggiornato_il();

-- ---------------------------------------------------------------------------------------------
-- generi_musicali: elenco chiuso, si cambia solo con le migrazioni
-- ---------------------------------------------------------------------------------------------
create table public.generi_musicali (
  codice text primary key constraint generi_musicali_codice check (codice ~ '^[a-z_]{2,30}$'),
  nome   text not null
);
comment on table public.generi_musicali is 'Generi musicali degli eventi; si modificano solo con le migrazioni.';

alter table public.generi_musicali enable row level security;
revoke all on public.generi_musicali from anon, authenticated;
grant select on public.generi_musicali to authenticated, noxa_worker;

create policy "generi_musicali: visibili a tutti gli utenti"
  on public.generi_musicali for select to authenticated
  using (true);

create policy "generi_musicali: il worker li legge"
  on public.generi_musicali for select to noxa_worker
  using (true);

insert into public.generi_musicali (codice, nome) values
  ('techno', 'techno'),
  ('house', 'house'),
  ('hip_hop', 'hip hop'),
  ('reggaeton', 'reggaeton'),
  ('commerciale', 'commerciale'),
  ('latino', 'latino'),
  ('drum_and_bass', 'drum and bass'),
  ('elettronica', 'elettronica'),
  ('indie', 'indie'),
  ('live', 'live'),
  ('altro', 'altro');

-- ---------------------------------------------------------------------------------------------
-- eventi (R-20, R-21, R-22, R-23)
-- ---------------------------------------------------------------------------------------------
create table public.eventi (
  id                    uuid primary key default gen_random_uuid(),
  locale_id             uuid not null references public.locali (id),
  titolo                text not null
                        constraint eventi_titolo_lunghezza check (char_length(btrim(titolo)) between 1 and 200),
  descrizione           text constraint eventi_descrizione_lunghezza check (char_length(descrizione) <= 500),
  inizio                timestamptz not null,
  fine                  timestamptz,
  data_serata           date not null,
  eta_minima            smallint not null default 18
                        constraint eventi_eta_minima check (eta_minima between 14 and 30),
  eta_minima_dichiarata boolean not null default false,
  riferimenti_alcol     boolean not null default false,
  artisti               text[] not null default '{}'
                        constraint eventi_artisti check (cardinality(artisti) <= 20),
  prezzo_min_centesimi  integer constraint eventi_prezzo check (prezzo_min_centesimi >= 0),
  url_biglietti         text constraint eventi_url_biglietti check (url_biglietti ~ '^https?://\S+$'),
  immagine_path         text,
  stato                 public.stato_evento not null default 'in_revisione',
  ultima_verifica_il    timestamptz not null default now(),
  creato_il             timestamptz not null default now(),
  aggiornato_il         timestamptz not null default now(),
  constraint eventi_fine_dopo_inizio check (fine > inizio),
  -- R-21: un'età non dichiarata è sempre quella predefinita, 18.
  constraint eventi_eta_predefinita check (eta_minima_dichiarata or eta_minima = 18),
  -- Immagine del flyer approvato nel bucket flyer-pubblicati (ADR-0018).
  constraint eventi_immagine_path check (immagine_path = 'eventi/' || id::text || '.webp')
);
comment on table public.eventi is
  'Eventi del catalogo; visibili secondo l''età di chi guarda (R-20, R-21, R-23).';
create index eventi_data_serata_idx on public.eventi (data_serata);
create index eventi_locale_data_idx on public.eventi (locale_id, data_serata);
create index eventi_artisti_idx on public.eventi using gin (artisti);
create index eventi_titolo_trgm_idx on public.eventi using gin (titolo extensions.gin_trgm_ops);

alter table public.eventi enable row level security;
revoke all on public.eventi from anon, authenticated;
grant select, update on public.eventi to authenticated;
grant select, insert, update on public.eventi to noxa_worker;

-- R-20, R-21, R-23: si vede un evento pubblicato (o annullato, per avvisare chi voleva
-- andarci) solo con l'età per entrare; gli eventi con riferimenti all'alcol solo da
-- maggiorenni. Le funzioni sono valutate una volta per query; la stessa regola per un singolo
-- evento è private.evento_visibile_a.
create policy "eventi: visibili a chi ha l'età per entrare"
  on public.eventi for select to authenticated
  using (
    stato in ('pubblicato', 'annullato')
    and eta_minima <= (select private.eta_di((select auth.uid())))
    and (not riferimenti_alcol or (select not private.e_minorenne((select auth.uid()))))
  );

create policy "eventi: i moderatori li vedono tutti"
  on public.eventi for select to authenticated
  using ((select private.e_moderatore()));

create policy "eventi: i moderatori li approvano, correggono e annullano"
  on public.eventi for update to authenticated
  using ((select private.e_moderatore()))
  with check ((select private.e_moderatore()));

create policy "eventi: il worker li legge"
  on public.eventi for select to noxa_worker
  using (true);

create policy "eventi: il worker li crea"
  on public.eventi for insert to noxa_worker
  with check (true);

create policy "eventi: il worker li aggiorna"
  on public.eventi for update to noxa_worker
  using (true)
  with check (true);

-- Data della serata a cui appartiene l'evento: chi inizia alle 02:00 di sabato fa parte della
-- serata di venerdì (inizio meno 6 ore, nel fuso Europe/Rome).
create or replace function private.calcola_data_serata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.data_serata := ((new.inizio at time zone 'Europe/Rome') - interval '6 hours')::date;
  return new;
end;
$$;

create trigger eventi_data_serata
  before insert or update of inizio on public.eventi
  for each row execute function private.calcola_data_serata();

-- R-22: un'età dichiarata non si abbassa e i riferimenti all'alcol non si tolgono in
-- automatico; solo un moderatore può farlo. L'età predefinita 18 (R-21) si sostituisce con la
-- prima età dichiarata, anche più bassa.
create or replace function private.proteggi_eta_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.e_moderatore() then
    return new;
  end if;
  if old.eta_minima_dichiarata
     and (not new.eta_minima_dichiarata or new.eta_minima < old.eta_minima) then
    raise exception using
      errcode = 'NX017',
      message = 'L''età minima dichiarata di un evento la abbassa solo un moderatore.';
  end if;
  if old.riferimenti_alcol and not new.riferimenti_alcol then
    raise exception using
      errcode = 'NX018',
      message = 'I riferimenti all''alcol di un evento li toglie solo un moderatore.';
  end if;
  return new;
end;
$$;

create trigger eventi_proteggi_eta
  before update on public.eventi
  for each row execute function private.proteggi_eta_evento();

create trigger eventi_aggiornato_il
  before update on public.eventi
  for each row execute function private.imposta_aggiornato_il();

-- R-20, R-21, R-23 per un singolo evento e un utente qualsiasi (partecipazioni, gruppi).
create or replace function private.evento_visibile_a(evento uuid, utente uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.eventi e
    where e.id = evento
      and e.stato in ('pubblicato', 'annullato')
      and e.eta_minima <= private.eta_di(utente)
      and (not e.riferimenti_alcol or not private.e_minorenne(utente))
  );
$$;

-- Ci si segna a un evento visibile e pubblicato (non annullato) (F-05).
create or replace function private.evento_partecipabile(evento uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.evento_visibile_a(evento, auth.uid())
    and exists (select 1 from public.eventi e where e.id = evento and e.stato = 'pubblicato');
$$;

-- ---------------------------------------------------------------------------------------------
-- eventi_generi
-- ---------------------------------------------------------------------------------------------
create table public.eventi_generi (
  evento_id     uuid not null references public.eventi (id) on delete cascade,
  genere_codice text not null references public.generi_musicali (codice),
  primary key (evento_id, genere_codice)
);
comment on table public.eventi_generi is 'Generi musicali di ogni evento; visibili come l''evento.';
create index eventi_generi_genere_idx on public.eventi_generi (genere_codice, evento_id);

alter table public.eventi_generi enable row level security;
revoke all on public.eventi_generi from anon, authenticated;
grant select on public.eventi_generi to authenticated;
grant select, insert, delete on public.eventi_generi to noxa_worker;

-- La sottoquery è soggetta alla RLS di eventi (R-20, R-23).
create policy "eventi_generi: visibili come l'evento"
  on public.eventi_generi for select to authenticated
  using (exists (select 1 from public.eventi e where e.id = evento_id));

create policy "eventi_generi: il worker li legge"
  on public.eventi_generi for select to noxa_worker
  using (true);

create policy "eventi_generi: il worker li aggiunge"
  on public.eventi_generi for insert to noxa_worker
  with check (true);

create policy "eventi_generi: il worker li toglie"
  on public.eventi_generi for delete to noxa_worker
  using (true);

-- ---------------------------------------------------------------------------------------------
-- eventi_fonti: provenienza di ogni evento. Le chiavi esterne verso fonti e
-- caricamenti_flyer arrivano con quelle tabelle (iterazioni 5 e 6).
-- ---------------------------------------------------------------------------------------------
create table public.eventi_fonti (
  id                   uuid primary key default gen_random_uuid(),
  evento_id            uuid not null references public.eventi (id) on delete cascade,
  fonte_id             uuid,
  caricamento_flyer_id uuid,
  tipo_origine         text not null constraint eventi_fonti_tipo check (
                         tipo_origine in ('sito_locale', 'instagram', 'resident_advisor', 'xceed',
                                          'dice', 'flyer')),
  url_originale        text constraint eventi_fonti_url check (url_originale ~ '^https?://\S+$'),
  id_esterno           text,
  raccolto_il          timestamptz not null default now(),
  constraint eventi_fonti_origine check (num_nonnulls(fonte_id, caricamento_flyer_id) <= 1),
  -- Il link alla fonte originale c'è sempre, tranne per i flyer (CLAUDE.md, ADR-0008).
  constraint eventi_fonti_link check (tipo_origine = 'flyer' or url_originale is not null)
);
comment on table public.eventi_fonti is
  'Fonti che hanno confermato ogni evento; chi ha caricato un flyer resta anonimo.';
create index eventi_fonti_evento_idx on public.eventi_fonti (evento_id);

alter table public.eventi_fonti enable row level security;
revoke all on public.eventi_fonti from anon, authenticated;
-- Senza caricamento_flyer_id: chi ha caricato un flyer resta anonimo.
grant select (id, evento_id, fonte_id, tipo_origine, url_originale, id_esterno, raccolto_il)
  on public.eventi_fonti to authenticated;
grant select, insert on public.eventi_fonti to noxa_worker;

create policy "eventi_fonti: visibili come l'evento"
  on public.eventi_fonti for select to authenticated
  using (exists (select 1 from public.eventi e where e.id = evento_id));

create policy "eventi_fonti: il worker le legge"
  on public.eventi_fonti for select to noxa_worker
  using (true);

create policy "eventi_fonti: il worker le aggiunge"
  on public.eventi_fonti for insert to noxa_worker
  with check (true);

-- ---------------------------------------------------------------------------------------------
-- partecipazioni_evento (F-04, F-05, R-67)
-- ---------------------------------------------------------------------------------------------
create table public.partecipazioni_evento (
  utente_id           uuid not null references public.profili (id) on delete cascade,
  evento_id           uuid not null references public.eventi (id) on delete cascade,
  stato               public.stato_partecipazione_evento not null,
  -- Senza un valore esplicito vale l'impostazione generale dell'utente (trigger sotto).
  visibile_agli_amici boolean not null,
  creato_il           timestamptz not null default now(),
  aggiornato_il       timestamptz not null default now(),
  primary key (utente_id, evento_id)
);
comment on table public.partecipazioni_evento is
  '"Mi interessa" e "Partecipo"; visibili solo agli amici confermati e se l''utente lo sceglie (R-67).';
create index partecipazioni_evento_evento_idx on public.partecipazioni_evento (evento_id);

alter table public.partecipazioni_evento enable row level security;
revoke all on public.partecipazioni_evento from anon, authenticated;
grant select, delete on public.partecipazioni_evento to authenticated;
grant insert (utente_id, evento_id, stato, visibile_agli_amici)
  on public.partecipazioni_evento to authenticated;
grant update (stato, visibile_agli_amici) on public.partecipazioni_evento to authenticated;

-- Amici confermati dell'utente con la sessione aperta, senza blocchi (R-17): calcolati una
-- volta per query nelle policy.
create or replace function private.miei_amici()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(case when f.richiedente_id = auth.uid()
                                 then f.destinatario_id else f.richiedente_id end), '{}')
  from public.amicizie f
  where f.stato = 'accettata'
    and (f.richiedente_id = auth.uid() or f.destinatario_id = auth.uid())
    and not private.c_e_blocco(f.richiedente_id, f.destinatario_id);
$$;

-- R-67: la propria partecipazione, oppure quella visibile di un amico confermato a un evento
-- che si può vedere (la sottoquery è soggetta alla RLS di eventi).
create policy "partecipazioni_evento: il titolare e gli amici se visibile"
  on public.partecipazioni_evento for select to authenticated
  using (
    utente_id = (select auth.uid())
    or (
      visibile_agli_amici
      and utente_id = any ((select private.miei_amici())::uuid[])
      and exists (select 1 from public.eventi e where e.id = evento_id)
    )
  );

-- R-20, R-23: ci si segna solo a eventi visibili e pubblicati.
create policy "partecipazioni_evento: ci si segna a un evento visibile"
  on public.partecipazioni_evento for insert to authenticated
  with check (utente_id = (select auth.uid()) and private.evento_partecipabile(evento_id));

create policy "partecipazioni_evento: il titolare cambia scelta o visibilità"
  on public.partecipazioni_evento for update to authenticated
  using (utente_id = (select auth.uid()))
  with check (utente_id = (select auth.uid()) and private.evento_partecipabile(evento_id));

create policy "partecipazioni_evento: il titolare toglie la scelta"
  on public.partecipazioni_evento for delete to authenticated
  using (utente_id = (select auth.uid()));

-- R-67: la visibilità predefinita è quella scelta nelle impostazioni di privacy.
create or replace function private.imposta_visibilita_partecipazione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibile_agli_amici is null then
    select pp.partecipazioni_visibili into new.visibile_agli_amici
    from public.profili_privati pp
    where pp.utente_id = new.utente_id;
    new.visibile_agli_amici := coalesce(new.visibile_agli_amici, false);
  end if;
  return new;
end;
$$;

create trigger partecipazioni_evento_visibilita
  before insert on public.partecipazioni_evento
  for each row execute function private.imposta_visibilita_partecipazione();

create trigger partecipazioni_evento_aggiornato_il
  before update on public.partecipazioni_evento
  for each row execute function private.imposta_aggiornato_il();

-- ---------------------------------------------------------------------------------------------
-- RPC: ricerca e dettaglio (F-01…F-05). Entrambe security invoker: ereditano la RLS di
-- eventi, partecipazioni_evento e profili. Le coordinate sono solo parametri (R-33).
-- ---------------------------------------------------------------------------------------------
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
         -- ADR-0018: foto del locale, poi flyer approvato, poi fondo tipografico.
         case when l.immagine_path is not null then 'locale'
              when e.immagine_path is not null then 'flyer'
              else 'tipografica' end,
         coalesce(l.immagine_path, e.immagine_path),
         case when l.immagine_path is not null then l.immagine_attribuzione end,
         coalesce(a.partecipano, 0),
         coalesce(a.interessati, 0),
         coalesce(a.primi, '[]'::jsonb),
         (select p.stato from public.partecipazioni_evento p
          where p.evento_id = e.id and p.utente_id = auth.uid())
  from scelti s
  join public.eventi e on e.id = s.id
  join public.locali l on l.id = e.locale_id
  left join lateral (
    select count(*) filter (where p.stato = 'partecipo')::integer as partecipano,
           count(*) filter (where p.stato = 'interessato')::integer as interessati,
           to_jsonb((array_agg(jsonb_build_object('id', pr.id,
                                                  'nome_visualizzato', pr.nome_visualizzato,
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
         case when l.immagine_path is not null then 'locale'
              when e.immagine_path is not null then 'flyer'
              else 'tipografica' end,
         coalesce(l.immagine_path, e.immagine_path),
         case when l.immagine_path is not null then l.immagine_attribuzione end,
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
-- Segnalazioni di eventi e foto dei locali (R-50, ADR-0018)
-- ---------------------------------------------------------------------------------------------
drop policy "segnalazioni: si segnala un profilo visibile" on public.segnalazioni;

-- R-50: si segnala un profilo che si può vedere o che si è bloccato, un evento visibile o la
-- foto di un locale visibile. Gli altri tipi arrivano con le loro tabelle (flyer, gruppi).
create policy "segnalazioni: si segnala un profilo, un evento o una foto visibile"
  on public.segnalazioni for insert to authenticated
  with check (
    segnalante_id = (select auth.uid())
    and (
      (tipo_oggetto = 'profilo'
       and oggetto_id <> (select auth.uid())
       and ((select private.puo_vedere_profilo(oggetto_id))
            or exists (select 1 from public.blocchi b
                       where b.bloccante_id = (select auth.uid()) and b.bloccato_id = oggetto_id)))
      or (tipo_oggetto = 'evento'
          and exists (select 1 from public.eventi e where e.id = oggetto_id))
      or (tipo_oggetto = 'immagine_locale'
          and exists (select 1 from public.locali l
                      where l.id = oggetto_id and l.immagine_path is not null))
    )
  );

-- Le proprie segnalazioni: il profilo è indicato con l'username, l'evento con il titolo e la
-- foto con il nome del locale, che chi segnala conosceva già.
create or replace function public.mie_segnalazioni()
returns table (
  id uuid,
  tipo_oggetto public.tipo_oggetto_segnalabile,
  descrizione text,
  motivo public.motivo_segnalazione,
  stato public.stato_segnalazione,
  creata_il timestamptz,
  chiusa_il timestamptz,
  decisione text,
  decisa_il timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.tipo_oggetto,
         case s.tipo_oggetto
           when 'profilo'
             then (select '@' || p.username::text from public.profili p where p.id = s.oggetto_id)
           when 'evento'
             then (select e.titolo from public.eventi e where e.id = s.oggetto_id)
           when 'immagine_locale'
             then (select l.nome from public.locali l where l.id = s.oggetto_id)
         end,
         s.motivo, s.stato, s.creata_il, s.chiusa_il, d.motivazione, d.creata_il
  from public.segnalazioni s
  left join lateral (
    select a.motivazione, a.creata_il
    from public.azioni_moderazione a
    where a.segnalazione_id = s.id and a.azione <> 'accesso_segnalazione'
    order by a.creata_il desc
    limit 1
  ) d on true
  where s.segnalante_id = auth.uid()
  order by s.creata_il desc;
$$;

-- ---------------------------------------------------------------------------------------------
-- Storage: foto dei locali e immagini dei flyer pubblicati (DATA_MODEL.md §6)
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('immagini-locali', 'immagini-locali', false, 1024 * 1024, array['image/webp']),
  ('flyer-pubblicati', 'flyer-pubblicati', false, 2 * 1024 * 1024, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- R-56: si legge solo la foto approvata di un locale visibile (attivo); la sottoquery è
-- soggetta alla RLS di locali, che mostra ai moderatori anche i locali non attivi.
create policy "immagini-locali: foto dei locali visibili"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'immagini-locali'
    and exists (select 1 from public.locali l where l.immagine_path = name)
  );

create policy "immagini-locali: i moderatori vedono tutte le foto"
  on storage.objects for select to authenticated
  using (bucket_id = 'immagini-locali' and (select private.e_moderatore()));

-- R-56: caricano, sostituiscono ed eliminano le foto solo i moderatori.
create policy "immagini-locali: i moderatori caricano le foto"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'immagini-locali' and (select private.e_moderatore()));

create policy "immagini-locali: i moderatori sostituiscono le foto"
  on storage.objects for update to authenticated
  using (bucket_id = 'immagini-locali' and (select private.e_moderatore()))
  with check (bucket_id = 'immagini-locali' and (select private.e_moderatore()));

create policy "immagini-locali: i moderatori eliminano le foto"
  on storage.objects for delete to authenticated
  using (bucket_id = 'immagini-locali' and (select private.e_moderatore()));

-- R-20, R-23: il flyer pubblicato si legge come il suo evento. Lo scrive solo il worker con la
-- chiave service_role (job copia_immagine_flyer, iterazione 6).
create policy "flyer-pubblicati: immagini degli eventi visibili"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'flyer-pubblicati'
    and exists (select 1 from public.eventi e where e.immagine_path = name)
  );

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function private.registra_approvazione_immagine() from public;
revoke all on function private.calcola_data_serata() from public;
revoke all on function private.proteggi_eta_evento() from public;
revoke all on function private.imposta_visibilita_partecipazione() from public;
revoke all on function private.evento_visibile_a(uuid, uuid) from public;
revoke all on function private.evento_partecipabile(uuid) from public;
revoke all on function private.miei_amici() from public;
grant execute on function private.evento_visibile_a(uuid, uuid) to authenticated;
grant execute on function private.evento_partecipabile(uuid) to authenticated;
grant execute on function private.miei_amici() to authenticated;

revoke all on function public.cerca_eventi(double precision, double precision, numeric, date, date,
                                           text[], smallint, boolean) from public, anon;
revoke all on function public.dettaglio_evento(uuid) from public, anon;
grant execute on function public.cerca_eventi(double precision, double precision, numeric, date,
                                              date, text[], smallint, boolean) to authenticated;
grant execute on function public.dettaglio_evento(uuid) to authenticated;
