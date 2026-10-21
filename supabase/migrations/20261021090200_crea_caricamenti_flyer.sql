-- Migrazione: caricamenti dei flyer, bucket flyer-caricati, limite di R-54, accodamento del
-- job analizza_flyer, chiavi esterne da eventi_grezzi ed eventi_fonti
-- Documentazione: docs/DATA_MODEL.md §5.3 (caricamenti_flyer), §6; docs/EVENT_INGESTION.md §5;
-- regole: R-51, R-54, R-55, R-66, R-69
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX027 troppi flyer nelle ultime 24 ore (R-54)
--   NX036 account sospeso (codice definito con la migrazione limita_account_sospesi)
--   NX035 solo un moderatore approva un flyer, e lo si unisce solo a un evento pubblicato (R-51)

-- ---------------------------------------------------------------------------------------------
-- caricamenti_flyer
-- ---------------------------------------------------------------------------------------------
create table public.caricamenti_flyer (
  id                    uuid primary key default gen_random_uuid(),
  utente_id             uuid references public.profili (id) on delete set null,
  storage_path          text not null unique
                        constraint caricamenti_flyer_percorso
                        check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  stato                 public.stato_caricamento not null default 'caricato',
  risultato_estrazione  jsonb,
  modello               text constraint caricamenti_flyer_modello check (char_length(modello) <= 100),
  versione_prompt       text constraint caricamenti_flyer_prompt check (char_length(versione_prompt) <= 40),
  confidenza            numeric(3, 2) constraint caricamenti_flyer_confidenza check (confidenza between 0 and 1),
  phash                 text constraint caricamenti_flyer_phash check (phash ~ '^[0-9a-f]{16}$'),
  -- Evento creato in revisione dal flyer, oppure l'evento a cui è stato unito o con cui è
  -- stato pubblicato. Resta null finché il locale non è risolto (EVENT_INGESTION.md §3.1).
  evento_id             uuid references public.eventi (id) on delete set null,
  -- Possibile corrispondenza con un evento già pubblicato, mostrata nella revisione.
  evento_candidato_id   uuid references public.eventi (id) on delete set null,
  -- Il modello ha indicato contenuti inadatti: in cima alla coda, immagine sfocata.
  contenuto_sospetto    boolean not null default false,
  nota_revisione        text constraint caricamenti_flyer_nota check (char_length(nota_revisione) <= 200),
  motivo_rifiuto        text constraint caricamenti_flyer_motivo check (char_length(motivo_rifiuto) <= 500),
  costo_stimato_eur     numeric(8, 4) constraint caricamenti_flyer_costo check (costo_stimato_eur >= 0),
  -- R-55: prova da conservare; l'immagine non si elimina e la richiesta non si cancella.
  conservazione_legale  boolean not null default false,
  deciso_il             timestamptz,
  immagine_eliminata_il timestamptz,
  creato_il             timestamptz not null default now(),
  aggiornato_il         timestamptz not null default now(),
  constraint caricamenti_flyer_rifiuto check (stato <> 'rifiutato' or motivo_rifiuto is not null)
);
comment on table public.caricamenti_flyer is
  'Flyer caricati dagli utenti; pubblicati solo dopo la revisione di un moderatore (R-51).';
create index caricamenti_flyer_utente_idx on public.caricamenti_flyer (utente_id, creato_il desc);
create index caricamenti_flyer_coda_idx on public.caricamenti_flyer (creato_il)
  where stato in ('in_revisione', 'errore');
create index caricamenti_flyer_phash_idx on public.caricamenti_flyer (phash, creato_il)
  where phash is not null;
create index caricamenti_flyer_evento_idx on public.caricamenti_flyer (evento_id);

alter table public.caricamenti_flyer enable row level security;
revoke all on public.caricamenti_flyer from anon, authenticated;
-- L'utente vede lo stato e la propria immagine, non l'output del modello. I moderatori leggono
-- i flyer solo con le RPC coda_flyer e dettaglio_segnalazione, senza utente_id (R-69).
grant select (id, storage_path, stato, evento_id, motivo_rifiuto, creato_il)
  on public.caricamenti_flyer to authenticated;
-- L'app genera l'id, lo stesso del nome del file nella cartella dell'utente.
grant insert (id, utente_id, storage_path) on public.caricamenti_flyer to authenticated;
grant delete on public.caricamenti_flyer to authenticated;
grant select on public.caricamenti_flyer to noxa_worker;
grant update (stato, risultato_estrazione, modello, versione_prompt, confidenza, phash, evento_id,
              evento_candidato_id, contenuto_sospetto, nota_revisione, motivo_rifiuto,
              costo_stimato_eur, immagine_eliminata_il)
  on public.caricamenti_flyer to noxa_worker;

create policy "caricamenti_flyer: il titolare vede i propri"
  on public.caricamenti_flyer for select to authenticated
  using (utente_id = (select auth.uid()));

-- R-54: solo nella propria cartella e con lo stato iniziale; il limite giornaliero è nel
-- trigger private.limita_caricamenti_flyer.
create policy "caricamenti_flyer: si carica nella propria cartella"
  on public.caricamenti_flyer for insert to authenticated
  with check (
    utente_id = (select auth.uid())
    and stato = 'caricato'
    and storage_path like (select auth.uid())::text || '/%'
  );

-- R-55: una richiesta conservata come prova non si cancella.
create policy "caricamenti_flyer: il titolare cancella la propria richiesta"
  on public.caricamenti_flyer for delete to authenticated
  using (utente_id = (select auth.uid()) and not conservazione_legale);

create policy "caricamenti_flyer: il worker li legge"
  on public.caricamenti_flyer for select to noxa_worker
  using (true);

create policy "caricamenti_flyer: il worker registra l'analisi"
  on public.caricamenti_flyer for update to noxa_worker
  using (true)
  with check (true);

create trigger caricamenti_flyer_aggiornato_il
  before update on public.caricamenti_flyer
  for each row execute function private.imposta_aggiornato_il();

-- Chiavi esterne rimandate dalle iterazioni 4 e 5.
alter table public.eventi_grezzi
  add constraint eventi_grezzi_caricamento_flyer_id_fkey
  foreign key (caricamento_flyer_id) references public.caricamenti_flyer (id) on delete cascade;
alter table public.eventi_fonti
  add constraint eventi_fonti_caricamento_flyer_id_fkey
  foreign key (caricamento_flyer_id) references public.caricamenti_flyer (id) on delete set null;
create index eventi_grezzi_caricamento_idx on public.eventi_grezzi (caricamento_flyer_id);
create index eventi_fonti_caricamento_idx on public.eventi_fonti (caricamento_flyer_id);

-- ---------------------------------------------------------------------------------------------
-- R-54: al massimo 10 flyer ogni 24 ore. Il conteggio usa un registro che la cancellazione
-- di una richiesta non svuota, così cancellare e ricaricare non aggira il limite.
-- ---------------------------------------------------------------------------------------------
create table private.registro_caricamenti_flyer (
  utente_id uuid not null,
  creato_il timestamptz not null default now()
);
create index registro_caricamenti_flyer_idx on private.registro_caricamenti_flyer (utente_id, creato_il);
revoke all on private.registro_caricamenti_flyer from public, anon, authenticated;

-- Caricamenti ancora disponibili oggi e ora in cui se ne libera uno (null se ne restano).
create or replace function public.flyer_disponibili()
returns table (rimasti integer, prossimo_il timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  usati integer;
begin
  if utente is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  select count(*)::integer into usati
  from private.registro_caricamenti_flyer r
  where r.utente_id = utente and r.creato_il > now() - interval '24 hours';
  return query
  select greatest(10 - usati, 0),
         case when usati >= 10 then (
           select min(r.creato_il) + interval '24 hours'
           from (select r2.creato_il from private.registro_caricamenti_flyer r2
                 where r2.utente_id = utente and r2.creato_il > now() - interval '24 hours'
                 order by r2.creato_il desc limit 10) r
         ) end;
end;
$$;

create or replace function private.limita_caricamenti_flyer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Un utente alla volta: due invii contemporanei non superano il limite.
  perform pg_advisory_xact_lock(hashtextextended('caricamenti_flyer:' || new.utente_id::text, 0));
  -- R-55: un account sospeso non carica flyer.
  if not exists (select 1 from public.profili p
                 where p.id = new.utente_id and p.stato_account = 'attivo') then
    raise exception using errcode = 'NX036', message = 'Account sospeso.';
  end if;
  if (select count(*) from private.registro_caricamenti_flyer r
      where r.utente_id = new.utente_id and r.creato_il > now() - interval '24 hours') >= 10 then
    raise exception using errcode = 'NX027', message = 'Hai già caricato 10 flyer nelle ultime 24 ore (R-54).';
  end if;
  insert into private.registro_caricamenti_flyer (utente_id) values (new.utente_id);
  return new;
end;
$$;

create trigger caricamenti_flyer_limita
  before insert on public.caricamenti_flyer
  for each row execute function private.limita_caricamenti_flyer();

-- EVENT_INGESTION.md §3.1, passo 1: il nuovo caricamento accoda la sua analisi.
create or replace function private.accoda_analisi_flyer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.coda_job (tipo, payload, chiave_idempotenza)
  values ('analizza_flyer', jsonb_build_object('caricamento_id', new.id),
          'analizza_flyer:' || new.id)
  on conflict (chiave_idempotenza) where stato in ('in_coda', 'in_esecuzione') do nothing;
  return null;
end;
$$;

create trigger caricamenti_flyer_accoda_analisi
  after insert on public.caricamenti_flyer
  for each row execute function private.accoda_analisi_flyer();

-- R-51: il worker non approva mai un flyer e lo unisce solo a un evento già pubblicato da una
-- fonte (EVENT_INGESTION.md §5, passo 5). Le decisioni dei moderatori passano da decidi_flyer.
create or replace function private.proteggi_caricamento_flyer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stato is distinct from old.stato and not private.e_moderatore() then
    if new.stato = 'approvato' then
      raise exception using errcode = 'NX035', message = 'Solo un moderatore approva un flyer (R-51).';
    end if;
    if new.stato = 'unito' and not exists (
      select 1 from public.eventi e where e.id = new.evento_id and e.stato = 'pubblicato'
    ) then
      raise exception using errcode = 'NX035',
        message = 'Un flyer si unisce in automatico solo a un evento pubblicato (R-51).';
    end if;
  end if;
  if new.stato in ('approvato', 'unito', 'rifiutato') and new.stato is distinct from old.stato then
    new.deciso_il := now();
  end if;
  return new;
end;
$$;

create trigger caricamenti_flyer_proteggi
  before update on public.caricamenti_flyer
  for each row execute function private.proteggi_caricamento_flyer();

-- Una richiesta cancellata dall'utente porta via l'evento in revisione nato solo da lei; un
-- evento già pubblicato resta (DATA_MODEL.md §5.3). Dopo la cancellazione, perché le chiavi
-- esterne che puntano alla richiesta sono già state azzerate.
create or replace function private.ritira_evento_del_flyer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.evento_id is not null then
    delete from public.eventi e
    where e.id = old.evento_id
      and e.stato = 'in_revisione'
      and not exists (select 1 from public.eventi_fonti ef
                      where ef.evento_id = e.id
                        and (ef.fonte_id is not null
                             or (ef.caricamento_flyer_id is not null
                                 and ef.caricamento_flyer_id <> old.id)))
      and not exists (select 1 from public.caricamenti_flyer c
                      where c.evento_id = e.id and c.id <> old.id);
  end if;
  return null;
end;
$$;

create trigger caricamenti_flyer_ritira_evento
  after delete on public.caricamenti_flyer
  for each row execute function private.ritira_evento_del_flyer();

-- ---------------------------------------------------------------------------------------------
-- Storage: bucket flyer-caricati (DATA_MODEL.md §6)
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flyer-caricati', 'flyer-caricati', false, 10 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- File caricati nelle ultime 24 ore nella propria cartella (R-54, anche per lo storage).
create or replace function private.file_flyer_recenti(utente uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from storage.objects o
  where o.bucket_id = 'flyer-caricati'
    and (storage.foldername(o.name))[1] = utente::text
    and o.created_at > now() - interval '24 hours';
$$;

create or replace function private.flyer_in_conservazione(percorso text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.caricamenti_flyer c
                 where c.storage_path = percorso and c.conservazione_legale);
$$;

-- R-54: solo nella propria cartella, al massimo 10 file al giorno.
create policy "flyer-caricati: il titolare carica nella propria cartella"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'flyer-caricati'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.file_flyer_recenti((select auth.uid()))) < 10
  );

create policy "flyer-caricati: il titolare vede i propri flyer"
  on storage.objects for select to authenticated
  using (bucket_id = 'flyer-caricati' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- R-51, R-69: i moderatori vedono le immagini per la revisione, senza sapere chi le ha
-- caricate (l'uuid della cartella non si collega a un profilo senza un'altra RPC).
create policy "flyer-caricati: i moderatori vedono i flyer"
  on storage.objects for select to authenticated
  using (bucket_id = 'flyer-caricati' and (select private.e_moderatore()));

-- R-55: un'immagine conservata come prova non si elimina.
create policy "flyer-caricati: il titolare elimina i propri flyer"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'flyer-caricati'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not private.flyer_in_conservazione(name)
  );

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function public.flyer_disponibili() from public, anon;
grant execute on function public.flyer_disponibili() to authenticated;
revoke all on function private.limita_caricamenti_flyer() from public;
revoke all on function private.accoda_analisi_flyer() from public;
revoke all on function private.proteggi_caricamento_flyer() from public;
revoke all on function private.ritira_evento_del_flyer() from public;
revoke all on function private.file_flyer_recenti(uuid) from public;
revoke all on function private.flyer_in_conservazione(text) from public;
grant execute on function private.file_flyer_recenti(uuid) to authenticated;
grant execute on function private.flyer_in_conservazione(text) to authenticated;
