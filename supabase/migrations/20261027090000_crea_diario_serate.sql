-- Migrazione: diario delle serate (tracker personale) con spese, DJ e amici presenti, RPC di
-- lettura, salvataggio idempotente per la coda offline e ricerca di eventi passati e locali
-- Documentazione: docs/DATA_MODEL.md §4, §5.6, §5.10; regole: R-40, R-43, R-69
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX046 data della serata nel futuro: il diario è per le serate già passate

-- R-40: `alcolici` esiste solo per i maggiorenni (trigger private.verifica_categoria_spesa).
create type public.categoria_spesa as enum (
  'ingresso', 'prevendita', 'trasporto', 'cibo', 'bevande_analcoliche', 'alcolici',
  'guardaroba', 'altro'
);

-- ---------------------------------------------------------------------------------------------
-- serate_tracker (F-30)
-- ---------------------------------------------------------------------------------------------
create table public.serate_tracker (
  -- Creato sul dispositivo: la stessa voce salvata due volte dalla coda offline resta una.
  id                 uuid primary key default gen_random_uuid(),
  utente_id          uuid not null default auth.uid() references public.profili (id) on delete cascade,
  data_serata        date not null
                     constraint serate_tracker_data_minima check (data_serata >= date '2000-01-01'),
  evento_id          uuid references public.eventi (id) on delete set null,
  locale_id          uuid references public.locali (id) on delete set null,
  nome_locale_libero text
                     constraint serate_tracker_nome_locale
                     check (char_length(nome_locale_libero) between 1 and 80
                            and nome_locale_libero = btrim(nome_locale_libero)),
  voto               smallint constraint serate_tracker_voto check (voto between 1 and 5),
  note               text constraint serate_tracker_note check (char_length(note) <= 1000),
  creato_il          timestamptz not null default now(),
  aggiornato_il      timestamptz not null default now(),
  constraint serate_tracker_locale_o_nome check (locale_id is null or nome_locale_libero is null)
);
comment on table public.serate_tracker is
  'Diario personale delle serate: lo vede solo il titolare, mai gli amici indicati né i moderatori (F-30, R-69).';
create index serate_tracker_utente_data_idx on public.serate_tracker (utente_id, data_serata desc);
create index serate_tracker_evento_idx on public.serate_tracker (evento_id) where evento_id is not null;

alter table public.serate_tracker enable row level security;
revoke all on public.serate_tracker from anon, authenticated;
grant select, delete on public.serate_tracker to authenticated;
grant insert (id, data_serata, evento_id, locale_id, nome_locale_libero, voto, note)
  on public.serate_tracker to authenticated;
grant update (data_serata, evento_id, locale_id, nome_locale_libero, voto, note)
  on public.serate_tracker to authenticated;

-- R-69: solo il titolare; nessuna policy per i moderatori.
create policy "serate_tracker: il titolare vede le sue serate"
  on public.serate_tracker for select to authenticated
  using (utente_id = (select auth.uid()));

-- R-20, R-23: si annota solo un evento che si può vedere.
create policy "serate_tracker: il titolare aggiunge una serata"
  on public.serate_tracker for insert to authenticated
  with check (
    utente_id = (select auth.uid())
    and (evento_id is null or private.evento_visibile_a(evento_id, (select auth.uid())))
  );

create policy "serate_tracker: il titolare modifica le sue serate"
  on public.serate_tracker for update to authenticated
  using (utente_id = (select auth.uid()))
  with check (utente_id = (select auth.uid()));

create policy "serate_tracker: il titolare elimina le sue serate"
  on public.serate_tracker for delete to authenticated
  using (utente_id = (select auth.uid()));

-- Data mai nel futuro; con un evento valgono la sua data e il suo locale. Un evento o un
-- locale nuovo deve essere visibile a chi scrive: in modifica si può tenere quello già
-- annotato anche se nel frattempo è stato ritirato (R-20, R-23).
create or replace function private.prepara_serata_tracker()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  evento record;
begin
  if new.evento_id is not null then
    if (tg_op = 'INSERT' or new.evento_id is distinct from old.evento_id)
       and not private.evento_visibile_a(new.evento_id, new.utente_id) then
      raise exception using errcode = '42501', message = 'Evento non disponibile.';
    end if;
    select e.data_serata, e.locale_id into evento from public.eventi e where e.id = new.evento_id;
    new.data_serata := evento.data_serata;
    new.locale_id := evento.locale_id;
    new.nome_locale_libero := null;
  elsif new.locale_id is not null
        and (tg_op = 'INSERT' or new.locale_id is distinct from old.locale_id)
        and not exists (select 1 from public.locali l where l.id = new.locale_id and l.attivo) then
    raise exception using errcode = '42501', message = 'Locale non disponibile.';
  end if;
  if new.data_serata > (now() at time zone 'Europe/Rome')::date then
    raise exception using errcode = 'NX046', message = 'La data della serata è nel futuro.';
  end if;
  return new;
end;
$$;

create trigger serate_tracker_prepara
  before insert or update on public.serate_tracker
  for each row execute function private.prepara_serata_tracker();

create trigger serate_tracker_aggiornato_il
  before update on public.serate_tracker
  for each row execute function private.imposta_aggiornato_il();

-- Titolare di una serata del diario, per le policy delle tabelle figlie senza ricorsione.
create or replace function private.e_titolare_serata_tracker(serata uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.serate_tracker s where s.id = serata and s.utente_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- tracker_spese (F-30, R-40)
-- ---------------------------------------------------------------------------------------------
create table public.tracker_spese (
  id                uuid primary key default gen_random_uuid(),
  serata_tracker_id uuid not null references public.serate_tracker (id) on delete cascade,
  categoria         public.categoria_spesa not null,
  importo_centesimi integer not null
                    constraint tracker_spese_importo check (importo_centesimi between 1 and 100000),
  constraint tracker_spese_categoria_unica unique (serata_tracker_id, categoria)
);
comment on table public.tracker_spese is
  'Spese di una serata del diario per categoria; alcolici solo per i maggiorenni (R-40).';

alter table public.tracker_spese enable row level security;
revoke all on public.tracker_spese from anon, authenticated;
grant select, delete on public.tracker_spese to authenticated;
grant insert (serata_tracker_id, categoria, importo_centesimi) on public.tracker_spese to authenticated;
grant update (importo_centesimi) on public.tracker_spese to authenticated;

create policy "tracker_spese: il titolare vede le spese"
  on public.tracker_spese for select to authenticated
  using ((select private.e_titolare_serata_tracker(serata_tracker_id)));

create policy "tracker_spese: il titolare aggiunge una spesa"
  on public.tracker_spese for insert to authenticated
  with check ((select private.e_titolare_serata_tracker(serata_tracker_id)));

create policy "tracker_spese: il titolare cambia un importo"
  on public.tracker_spese for update to authenticated
  using ((select private.e_titolare_serata_tracker(serata_tracker_id)))
  with check ((select private.e_titolare_serata_tracker(serata_tracker_id)));

create policy "tracker_spese: il titolare elimina una spesa"
  on public.tracker_spese for delete to authenticated
  using ((select private.e_titolare_serata_tracker(serata_tracker_id)));

-- R-40: la categoria alcolici non esiste per chi è minorenne, chiunque scriva la riga.
create or replace function private.verifica_categoria_spesa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.categoria = 'alcolici' and private.e_minorenne(
       (select s.utente_id from public.serate_tracker s where s.id = new.serata_tracker_id)) then
    raise exception using errcode = '23514', message = 'Categoria di spesa non disponibile.';
  end if;
  return new;
end;
$$;

create trigger tracker_spese_categoria
  before insert or update on public.tracker_spese
  for each row execute function private.verifica_categoria_spesa();

-- ---------------------------------------------------------------------------------------------
-- tracker_dj (F-30)
-- ---------------------------------------------------------------------------------------------
create table public.tracker_dj (
  serata_tracker_id uuid not null references public.serate_tracker (id) on delete cascade,
  nome_dj           text not null
                    constraint tracker_dj_nome
                    check (char_length(nome_dj) between 1 and 80 and nome_dj = btrim(nome_dj)),
  primary key (serata_tracker_id, nome_dj)
);
comment on table public.tracker_dj is 'DJ e artisti di una serata del diario (F-30).';

alter table public.tracker_dj enable row level security;
revoke all on public.tracker_dj from anon, authenticated;
grant select, insert, delete on public.tracker_dj to authenticated;

create policy "tracker_dj: il titolare vede i DJ"
  on public.tracker_dj for select to authenticated
  using ((select private.e_titolare_serata_tracker(serata_tracker_id)));

create policy "tracker_dj: il titolare aggiunge un DJ"
  on public.tracker_dj for insert to authenticated
  with check ((select private.e_titolare_serata_tracker(serata_tracker_id)));

create policy "tracker_dj: il titolare toglie un DJ"
  on public.tracker_dj for delete to authenticated
  using ((select private.e_titolare_serata_tracker(serata_tracker_id)));

-- ---------------------------------------------------------------------------------------------
-- tracker_amici (F-30)
-- ---------------------------------------------------------------------------------------------
create table public.tracker_amici (
  serata_tracker_id uuid not null references public.serate_tracker (id) on delete cascade,
  amico_id          uuid not null references public.profili (id) on delete cascade,
  primary key (serata_tracker_id, amico_id)
);
comment on table public.tracker_amici is
  'Amici presenti a una serata del diario: non ricevono notifiche e non vedono la voce (F-30).';
create index tracker_amici_amico_idx on public.tracker_amici (amico_id);

alter table public.tracker_amici enable row level security;
revoke all on public.tracker_amici from anon, authenticated;
grant select, delete on public.tracker_amici to authenticated;
grant insert (serata_tracker_id, amico_id) on public.tracker_amici to authenticated;

create policy "tracker_amici: il titolare vede gli amici indicati"
  on public.tracker_amici for select to authenticated
  using ((select private.e_titolare_serata_tracker(serata_tracker_id)));

-- R-11, R-17: si indicano solo amici confermati, senza blocchi.
create policy "tracker_amici: il titolare indica un amico confermato"
  on public.tracker_amici for insert to authenticated
  with check (
    (select private.e_titolare_serata_tracker(serata_tracker_id))
    and (select private.sono_amici((select auth.uid()), amico_id))
  );

create policy "tracker_amici: il titolare toglie un amico"
  on public.tracker_amici for delete to authenticated
  using ((select private.e_titolare_serata_tracker(serata_tracker_id)));

-- ---------------------------------------------------------------------------------------------
-- RPC del diario (security invoker: valgono le policy sopra e quelle di eventi, locali e
-- profili)
-- ---------------------------------------------------------------------------------------------

-- Tutto il diario di chi chiama, dalla serata più recente, con evento e locale se ancora
-- visibili e gli amici di cui si vede il profilo; gli altri sono solo contati.
create or replace function public.mio_diario()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(voce order by (voce ->> 'data_serata') desc, (voce ->> 'creato_il') desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', s.id,
      'data_serata', s.data_serata,
      'evento', case when e.id is not null then jsonb_build_object(
        'id', e.id, 'titolo', e.titolo, 'inizio', e.inizio, 'stato', e.stato) end,
      'locale', case when l.id is not null then jsonb_build_object(
        'id', l.id, 'nome', l.nome, 'comune', l.comune) end,
      'nome_locale_libero', s.nome_locale_libero,
      'voto', s.voto,
      'note', s.note,
      'spese', coalesce((
        select jsonb_agg(jsonb_build_object('categoria', sp.categoria,
                                            'importo_centesimi', sp.importo_centesimi)
                         order by sp.categoria)
        from public.tracker_spese sp where sp.serata_tracker_id = s.id), '[]'::jsonb),
      'dj', coalesce((
        select jsonb_agg(d.nome_dj order by d.nome_dj)
        from public.tracker_dj d where d.serata_tracker_id = s.id), '[]'::jsonb),
      'amici', coalesce((
        select jsonb_agg(private.persona_json(p) order by p.nome_visualizzato)
        from public.tracker_amici a join public.profili p on p.id = a.amico_id
        where a.serata_tracker_id = s.id), '[]'::jsonb),
      'amici_altri', (
        select count(*) from public.tracker_amici a
        where a.serata_tracker_id = s.id
          and not exists (select 1 from public.profili p where p.id = a.amico_id)),
      'creato_il', s.creato_il,
      'aggiornato_il', s.aggiornato_il
    ) as voce
    from public.serate_tracker s
    left join public.eventi e on e.id = s.evento_id
    left join public.locali l on l.id = s.locale_id
    order by s.data_serata desc, s.creato_il desc
    limit 1000
  ) voci;
$$;

-- Salva una serata del diario (nuova o modificata) in un'unica transazione. L'identificativo
-- arriva dal dispositivo, quindi ripetere il salvataggio dalla coda offline non crea doppioni.
-- Gli amici già indicati restano anche se nel frattempo l'amicizia è finita; quelli nuovi
-- devono essere amici confermati (policy di tracker_amici).
create or replace function public.salva_serata_diario(serata jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  voce uuid := (serata ->> 'id')::uuid;
  spese jsonb := coalesce(serata -> 'spese', '[]'::jsonb);
  dj jsonb := coalesce(serata -> 'dj', '[]'::jsonb);
  amici jsonb := coalesce(serata -> 'amici', '[]'::jsonb);
begin
  if voce is null then
    raise exception using errcode = '22023', message = 'Identificativo della serata mancante.';
  end if;
  if jsonb_typeof(spese) <> 'array' or jsonb_array_length(spese) > 8
     or jsonb_typeof(dj) <> 'array' or jsonb_array_length(dj) > 20
     or jsonb_typeof(amici) <> 'array' or jsonb_array_length(amici) > 30 then
    raise exception using errcode = '23514', message = 'Troppe voci nella serata.';
  end if;

  -- Prima la modifica e poi l'inserimento, non `on conflict`: il trigger before insert
  -- scatterebbe anche su una voce esistente e rifiuterebbe un evento poi ritirato.
  update public.serate_tracker s set
    data_serata = (serata ->> 'data_serata')::date,
    evento_id = (serata ->> 'evento_id')::uuid,
    locale_id = (serata ->> 'locale_id')::uuid,
    nome_locale_libero = nullif(btrim(serata ->> 'nome_locale_libero'), ''),
    voto = (serata ->> 'voto')::smallint,
    note = nullif(serata ->> 'note', '')
  where s.id = voce;
  if not found then
    begin
      insert into public.serate_tracker
        (id, data_serata, evento_id, locale_id, nome_locale_libero, voto, note)
      values (
        voce,
        (serata ->> 'data_serata')::date,
        (serata ->> 'evento_id')::uuid,
        (serata ->> 'locale_id')::uuid,
        nullif(btrim(serata ->> 'nome_locale_libero'), ''),
        (serata ->> 'voto')::smallint,
        nullif(serata ->> 'note', '')
      );
    exception when unique_violation then
      -- L'identificativo è di un'altra persona: la RLS ha nascosto la sua voce (R-69).
      raise exception using errcode = '42501', message = 'Serata non disponibile.';
    end;
  end if;

  delete from public.tracker_spese sp
  where sp.serata_tracker_id = voce
    and sp.categoria::text not in (select x ->> 'categoria' from jsonb_array_elements(spese) x);
  insert into public.tracker_spese as sp (serata_tracker_id, categoria, importo_centesimi)
  select voce, (x ->> 'categoria')::public.categoria_spesa, (x ->> 'importo_centesimi')::integer
  from jsonb_array_elements(spese) x
  on conflict (serata_tracker_id, categoria) do update set importo_centesimi = excluded.importo_centesimi;

  delete from public.tracker_dj d
  where d.serata_tracker_id = voce
    and d.nome_dj not in (select btrim(x) from jsonb_array_elements_text(dj) x);
  insert into public.tracker_dj (serata_tracker_id, nome_dj)
  select voce, btrim(x) from jsonb_array_elements_text(dj) x
  on conflict do nothing;

  delete from public.tracker_amici a
  where a.serata_tracker_id = voce
    and a.amico_id not in (select x::uuid from jsonb_array_elements_text(amici) x);
  insert into public.tracker_amici (serata_tracker_id, amico_id)
  select voce, x::uuid from jsonb_array_elements_text(amici) x
  where not exists (select 1 from public.tracker_amici a
                    where a.serata_tracker_id = voce and a.amico_id = x::uuid);

  return voce;
end;
$$;

-- Ricerca per il campo «Dove»: eventi pubblicati dell'ultimo anno fino a stasera, visibili a
-- chi cerca (RLS di eventi), e locali attivi del catalogo (RLS di locali).
create or replace function public.cerca_per_diario(testo text)
returns table (
  tipo text,
  id uuid,
  titolo text,
  data_serata date,
  inizio timestamptz,
  locale_id uuid,
  locale_nome text,
  comune text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtro as (
    select '%' || replace(replace(replace(btrim(testo), '\', '\\'), '%', '\%'), '_', '\_') || '%' as modello,
           (now() at time zone 'Europe/Rome')::date as oggi
    where char_length(btrim(coalesce(testo, ''))) >= 2
  )
  (select 'evento', e.id, e.titolo, e.data_serata, e.inizio, l.id, l.nome, l.comune
   from filtro f
   join public.eventi e on e.stato = 'pubblicato'
     and e.data_serata between f.oggi - 365 and f.oggi
   join public.locali l on l.id = e.locale_id
   where e.titolo ilike f.modello or l.nome ilike f.modello
   order by e.data_serata desc
   limit 10)
  union all
  (select 'locale', l.id, l.nome, null::date, null::timestamptz, l.id, l.nome, l.comune
   from filtro f
   join public.locali l on l.nome ilike f.modello
   order by l.nome
   limit 10);
$$;

-- Categorie di spesa disponibili per chi chiama: senza alcolici per i minorenni (R-40). L'app
-- mostra le categorie che riceve, senza controllare l'età da sé.
create or replace function public.categorie_spesa_disponibili()
returns setof public.categoria_spesa
language sql
stable
security definer
set search_path = ''
as $$
  select c
  from unnest(enum_range(null::public.categoria_spesa)) as c
  where auth.uid() is not null
    and (c <> 'alcolici' or not private.e_minorenne(auth.uid()));
$$;

revoke all on function private.prepara_serata_tracker() from public;
revoke all on function private.verifica_categoria_spesa() from public;
revoke all on function private.e_titolare_serata_tracker(uuid) from public;
grant execute on function private.e_titolare_serata_tracker(uuid) to authenticated;
revoke all on function public.mio_diario() from public, anon;
revoke all on function public.salva_serata_diario(jsonb) from public, anon;
revoke all on function public.cerca_per_diario(text) from public, anon;
grant execute on function public.mio_diario() to authenticated;
grant execute on function public.salva_serata_diario(jsonb) to authenticated;
grant execute on function public.cerca_per_diario(text) to authenticated;
revoke all on function public.categorie_spesa_disponibili() from public, anon;
grant execute on function public.categorie_spesa_disponibili() to authenticated;
