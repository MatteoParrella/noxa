-- Migrazione: ritorno sicuro (F-21)
-- Documentazione: docs/DATA_MODEL.md §5.5, §7, §8; docs/ARCHITECTURE.md §4.4; ADR-0006,
-- ADR-0027, ADR-0028; regole: R-17, R-31, R-32, R-34, R-43, R-55, R-64, R-65, R-69
--
-- Una sessione avviata a mano, al massimo una alla volta, con un arrivo previsto tra 10 minuti
-- e 4 ore e da 1 a 5 amici confermati scelti ogni volta. Le posizioni le vedono solo loro e
-- solo mentre il ritorno è attivo; si cancellano 24 ore dopo la fine. L'allerta parte dal
-- server (`verifica_ritorni_scaduti`, ogni minuto). Nessun indirizzo: l'area di arrivo resta
-- sul telefono (R-32). I moderatori non hanno policy (R-69).
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX055 c'è già un ritorno attivo
--   NX056 nessun destinatario tra gli amici confermati
--   NX057 più di 5 destinatari
--   NX058 arrivo previsto fuori dai limiti (da 10 minuti a 4 ore dall'avvio)
--   NX059 ritorno non più attivo
--   NX060 posizione inviata meno di 30 secondi dopo la precedente
--   NX061 troppi ritorni nelle ultime 24 ore

create type public.stato_ritorno as enum ('attivo', 'arrivato', 'annullato', 'scaduto');

-- ---------------------------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------------------------
create table public.ritorni_sicuri (
  id                  uuid primary key default gen_random_uuid(),
  utente_id           uuid not null default auth.uid() references public.profili (id) on delete cascade,
  stato               public.stato_ritorno not null default 'attivo',
  avviato_il          timestamptz not null default now(),
  arrivo_previsto     timestamptz not null,
  allerta_inviata_il  timestamptz,
  concluso_il         timestamptz,
  ultima_posizione_il timestamptz,
  constraint ritorni_sicuri_arrivo check (
    arrivo_previsto >= avviato_il + interval '10 minutes'
    and arrivo_previsto <= avviato_il + interval '4 hours'
  ),
  constraint ritorni_sicuri_concluso check ((stato = 'attivo') = (concluso_il is null))
);
comment on table public.ritorni_sicuri is
  'Ritorno sicuro: una sessione avviata a mano, al massimo 4 ore, da 1 a 5 amici (R-31).';
create unique index ritorni_sicuri_uno_attivo on public.ritorni_sicuri (utente_id) where stato = 'attivo';
create index ritorni_sicuri_utente_idx on public.ritorni_sicuri (utente_id, avviato_il desc);
create index ritorni_sicuri_attivi_idx on public.ritorni_sicuri (arrivo_previsto) where stato = 'attivo';
create index ritorni_sicuri_conclusi_idx on public.ritorni_sicuri (concluso_il) where stato <> 'attivo';

create table public.ritorni_destinatari (
  ritorno_id uuid not null references public.ritorni_sicuri (id) on delete cascade,
  amico_id   uuid not null references public.profili (id) on delete cascade,
  primary key (ritorno_id, amico_id)
);
comment on table public.ritorni_destinatari is
  'Amici confermati che vedono un ritorno sicuro, al massimo 5 (R-31).';
create index ritorni_destinatari_amico_idx on public.ritorni_destinatari (amico_id);

create table public.posizioni_ritorno (
  id            bigint generated always as identity primary key,
  ritorno_id    uuid not null references public.ritorni_sicuri (id) on delete cascade,
  posizione     extensions.geography(Point, 4326) not null,
  precisione_m  real not null constraint posizioni_ritorno_precisione check (precisione_m > 0 and precisione_m <= 10000),
  registrata_il timestamptz not null default now()
);
comment on table public.posizioni_ritorno is
  'Posizioni di un ritorno sicuro, al massimo una ogni 30 secondi; cancellate 24 ore dopo la fine (R-31).';
create index posizioni_ritorno_ritorno_idx on public.posizioni_ritorno (ritorno_id, registrata_il desc);

alter table public.ritorni_sicuri enable row level security;
alter table public.ritorni_destinatari enable row level security;
alter table public.posizioni_ritorno enable row level security;
revoke all on public.ritorni_sicuri, public.ritorni_destinatari, public.posizioni_ritorno
  from anon, authenticated;
grant select on public.ritorni_sicuri to authenticated;
grant insert (arrivo_previsto) on public.ritorni_sicuri to authenticated;
grant update (stato, arrivo_previsto) on public.ritorni_sicuri to authenticated;
grant select, insert, delete on public.ritorni_destinatari to authenticated;
grant select on public.posizioni_ritorno to authenticated;
grant insert (ritorno_id, posizione, precisione_m) on public.posizioni_ritorno to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Funzioni per le policy (evitano la ricorsione tra le tabelle)
-- ---------------------------------------------------------------------------------------------
create or replace function private.e_titolare_ritorno(ritorno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.ritorni_sicuri r where r.id = ritorno and r.utente_id = auth.uid());
$$;

-- Destinatario di un ritorno attivo, o concluso da meno di 15 minuti per vedere l'esito,
-- finché siete amici senza blocchi (R-17, R-31).
create or replace function private.e_destinatario_ritorno(ritorno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ritorni_destinatari d
    join public.ritorni_sicuri r on r.id = d.ritorno_id
    where d.ritorno_id = ritorno and d.amico_id = auth.uid()
      and (r.stato = 'attivo' or r.concluso_il > now() - interval '15 minutes')
      and private.sono_amici(auth.uid(), r.utente_id)
  );
$$;

-- Le posizioni si vedono solo mentre il ritorno è attivo: con l'esito la mappa sparisce.
create or replace function private.ritorno_attivo(ritorno uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.ritorni_sicuri r where r.id = ritorno and r.stato = 'attivo');
$$;

-- ---------------------------------------------------------------------------------------------
-- Policy
-- ---------------------------------------------------------------------------------------------
-- R-31, R-17: il titolare e i destinatari amici; un account sospeso non vede altri (R-55).
create policy "ritorni_sicuri: il titolare e i destinatari amici"
  on public.ritorni_sicuri for select to authenticated
  using (
    utente_id = (select auth.uid())
    or ((select private.e_destinatario_ritorno(id)) and (select private.account_attivo(auth.uid())))
  );

-- R-31: solo per sé e solo attivo; orari, limiti e serializzazione nel trigger verifica_ritorno.
create policy "ritorni_sicuri: si avvia per sé"
  on public.ritorni_sicuri for insert to authenticated
  with check (
    utente_id = (select auth.uid())
    and stato = 'attivo'
    and (select private.account_attivo(auth.uid()))
  );

-- R-31: "Sono arrivato", annullamento e proroga; le transizioni le controlla proteggi_ritorno.
create policy "ritorni_sicuri: il titolare lo conclude o lo proroga"
  on public.ritorni_sicuri for update to authenticated
  using (utente_id = (select auth.uid()))
  with check (utente_id = (select auth.uid()));

create policy "ritorni_destinatari: il titolare e il destinatario"
  on public.ritorni_destinatari for select to authenticated
  using ((select private.e_titolare_ritorno(ritorno_id)) or amico_id = (select auth.uid()));

-- R-31: solo amici confermati scelti dal titolare; al massimo 5 e solo a ritorno attivo
-- (trigger verifica_destinatario_ritorno).
create policy "ritorni_destinatari: il titolare sceglie amici confermati"
  on public.ritorni_destinatari for insert to authenticated
  with check (
    (select private.e_titolare_ritorno(ritorno_id))
    and (select private.sono_amici(auth.uid(), amico_id))
  );

create policy "ritorni_destinatari: il titolare toglie un destinatario"
  on public.ritorni_destinatari for delete to authenticated
  using ((select private.e_titolare_ritorno(ritorno_id)));

-- R-31, R-34: le posizioni le vede il titolare e, solo a ritorno attivo, i destinatari amici.
create policy "posizioni_ritorno: il titolare e i destinatari finché è attivo"
  on public.posizioni_ritorno for select to authenticated
  using (
    (select private.e_titolare_ritorno(ritorno_id))
    or ((select private.e_destinatario_ritorno(ritorno_id))
        and (select private.ritorno_attivo(ritorno_id))
        and (select private.account_attivo(auth.uid())))
  );

-- R-31: solo il titolare, solo a ritorno attivo; frequenza nel trigger verifica_posizione_ritorno.
create policy "posizioni_ritorno: il titolare durante il ritorno"
  on public.posizioni_ritorno for insert to authenticated
  with check (
    (select private.e_titolare_ritorno(ritorno_id))
    and (select private.ritorno_attivo(ritorno_id))
  );

-- ---------------------------------------------------------------------------------------------
-- Avvisi senza dati (ADR-0024, ADR-0028)
-- ---------------------------------------------------------------------------------------------
-- Il canale `ritorno:<id>` dice a chi guarda di ricaricare: nessuna coordinata viaggia su
-- Realtime, la posizione si rilegge con la RLS.
create or replace function private.avvisa_ritorno(ritorno uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send('{}'::jsonb, 'cambio', 'ritorno:' || ritorno::text, true);
end;
$$;

-- Avvisa il titolare e tutti i destinatari: aggiornano l'area Vivi.
create or replace function private.avvisa_persone_ritorno(ritorno uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  persona uuid;
begin
  perform private.avvisa_ritorno(ritorno);
  for persona in
    select r.utente_id from public.ritorni_sicuri r where r.id = ritorno
    union
    select d.amico_id from public.ritorni_destinatari d where d.ritorno_id = ritorno
  loop
    perform private.avvisa_vivi(persona);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Trigger di ritorni_sicuri
-- ---------------------------------------------------------------------------------------------
-- R-31: un ritorno attivo alla volta, al massimo 10 in 24 ore (ognuno avvisa gli amici),
-- arrivo previsto tra 10 minuti e 4 ore. Orari decisi dal database.
create or replace function private.verifica_ritorno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Il lock sulla riga delle impostazioni serializza gli avvii della stessa persona.
  perform 1 from public.profili_privati pp where pp.utente_id = new.utente_id for update;
  if exists (select 1 from public.ritorni_sicuri r where r.utente_id = new.utente_id and r.stato = 'attivo') then
    raise exception using errcode = 'NX055', message = 'Hai già un ritorno sicuro attivo.';
  end if;
  if (select count(*) from public.ritorni_sicuri r
      where r.utente_id = new.utente_id and r.avviato_il > now() - interval '24 hours') >= 10 then
    raise exception using errcode = 'NX061', message = 'Troppi ritorni nelle ultime 24 ore.';
  end if;
  if new.arrivo_previsto is null
     or new.arrivo_previsto < now() + interval '10 minutes'
     or new.arrivo_previsto > now() + interval '4 hours' then
    raise exception using errcode = 'NX058', message = 'L’arrivo previsto va da 10 minuti a 4 ore da adesso.';
  end if;
  new.stato := 'attivo';
  new.avviato_il := now();
  new.allerta_inviata_il := null;
  new.concluso_il := null;
  new.ultima_posizione_il := null;
  return new;
end;
$$;

create trigger ritorni_sicuri_verifica
  before insert on public.ritorni_sicuri
  for each row execute function private.verifica_ritorno();

-- R-31: dal telefono solo "Sono arrivato" o l'annullamento di un ritorno attivo, e la proroga
-- entro 4 ore dall'avvio. "Scaduto" lo scrive solo il job (nessuna sessione utente). La fine
-- si registra una volta sola con l'ora del database.
create or replace function private.proteggi_ritorno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.stato <> 'attivo' then
    raise exception using errcode = 'NX059', message = 'Il ritorno sicuro è già concluso.';
  end if;
  if new.stato = 'scaduto' and auth.uid() is not null then
    raise exception using errcode = '42501', message = 'Un ritorno scade solo da sé.';
  end if;
  if new.arrivo_previsto is distinct from old.arrivo_previsto then
    if new.stato <> 'attivo'
       or new.arrivo_previsto <= old.arrivo_previsto
       or new.arrivo_previsto <= now()
       or new.arrivo_previsto > old.avviato_il + interval '4 hours' then
      raise exception using errcode = 'NX058',
        message = 'La proroga deve restare entro 4 ore dall’avvio.';
    end if;
    -- Dopo un'allerta la proroga riporta il ritorno "in viaggio": se il nuovo orario passa,
    -- l'allerta riparte.
    new.allerta_inviata_il := null;
  end if;
  if new.stato <> 'attivo' then
    new.concluso_il := now();
  end if;
  return new;
end;
$$;

create trigger ritorni_sicuri_proteggi
  before update on public.ritorni_sicuri
  for each row execute function private.proteggi_ritorno();

-- "Sono arrivato": notifica ritorno_arrivato ai destinatari ancora amici. Ogni cambio avvisa
-- titolare e destinatari, che ricaricano.
create or replace function private.dopo_cambio_ritorno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  amico uuid;
begin
  if new.stato = 'arrivato' and old.stato = 'attivo' then
    for amico in
      select d.amico_id from public.ritorni_destinatari d
      where d.ritorno_id = new.id and private.sono_amici(new.utente_id, d.amico_id)
    loop
      perform private.crea_notifica(amico, 'ritorno_arrivato',
                                    jsonb_build_object('ritorno_id', new.id, 'utente_id', new.utente_id));
    end loop;
  end if;
  perform private.avvisa_persone_ritorno(new.id);
  return null;
end;
$$;

create trigger ritorni_sicuri_dopo_cambio
  after update of stato, arrivo_previsto on public.ritorni_sicuri
  for each row execute function private.dopo_cambio_ritorno();

-- ---------------------------------------------------------------------------------------------
-- Trigger di ritorni_destinatari
-- ---------------------------------------------------------------------------------------------
-- R-31: solo a un ritorno attivo, mai il titolare, al massimo 5 persone.
create or replace function private.verifica_destinatario_ritorno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Il lock sul ritorno serializza gli inserimenti concorrenti per il limite di 5.
  perform 1 from public.ritorni_sicuri r where r.id = new.ritorno_id for update;
  if not exists (select 1 from public.ritorni_sicuri r
                 where r.id = new.ritorno_id and r.stato = 'attivo' and r.utente_id <> new.amico_id) then
    raise exception using errcode = 'NX059', message = 'Il ritorno sicuro non è più attivo.';
  end if;
  if (select count(*) from public.ritorni_destinatari d where d.ritorno_id = new.ritorno_id) >= 5 then
    raise exception using errcode = 'NX057', message = 'Al massimo 5 amici per ritorno.';
  end if;
  return new;
end;
$$;

create trigger ritorni_destinatari_verifica
  before insert on public.ritorni_destinatari
  for each row execute function private.verifica_destinatario_ritorno();

-- Notifica ritorno_avviato con i soli identificativi (il testo push è di sistema, ADR-0026).
create or replace function private.notifica_ritorno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.crea_notifica(
    new.amico_id, 'ritorno_avviato',
    jsonb_build_object('ritorno_id', new.ritorno_id,
                       'utente_id', (select r.utente_id from public.ritorni_sicuri r where r.id = new.ritorno_id))
  );
  perform private.avvisa_vivi(new.amico_id);
  return null;
end;
$$;

create trigger ritorni_destinatari_notifica
  after insert on public.ritorni_destinatari
  for each row execute function private.notifica_ritorno();

-- Destinatario tolto: il ritorno sparisce subito dal suo telefono, con le notifiche. Se era
-- l'ultimo, il ritorno si annulla (design/F-21-ritorno-sicuro §4). Quando si elimina il
-- ritorno intero (conservazione, account eliminato) le notifiche restano senza posizione.
create or replace function private.dopo_rimozione_destinatario_ritorno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.ritorni_sicuri r where r.id = old.ritorno_id) then
    delete from public.notifiche n
    where n.utente_id = old.amico_id and n.tipo like 'ritorno\_%'
      and n.dati @> jsonb_build_object('ritorno_id', old.ritorno_id);
    if not exists (select 1 from public.ritorni_destinatari d where d.ritorno_id = old.ritorno_id) then
      update public.ritorni_sicuri r set stato = 'annullato'
      where r.id = old.ritorno_id and r.stato = 'attivo';
    end if;
    perform private.avvisa_ritorno(old.ritorno_id);
  end if;
  perform private.avvisa_vivi(old.amico_id);
  return null;
end;
$$;

create trigger ritorni_destinatari_rimozione
  after delete on public.ritorni_destinatari
  for each row execute function private.dopo_rimozione_destinatario_ritorno();

-- R-17: un blocco o un'amicizia rimossa tolgono la persona dai ritorni dell'altra, nelle due
-- direzioni (anche dai ritorni conclusi da poco, che mostrano l'esito).
create or replace function private.rimuovi_destinatari_ritorno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a uuid;
  b uuid;
begin
  if tg_table_name = 'blocchi' then
    a := new.bloccante_id;
    b := new.bloccato_id;
  else
    if old.stato <> 'accettata' then
      return null;
    end if;
    a := old.richiedente_id;
    b := old.destinatario_id;
  end if;
  delete from public.ritorni_destinatari d
  using public.ritorni_sicuri r
  where r.id = d.ritorno_id
    and ((r.utente_id = a and d.amico_id = b) or (r.utente_id = b and d.amico_id = a));
  return null;
end;
$$;

create trigger blocchi_rimuovi_destinatari_ritorno
  after insert on public.blocchi
  for each row execute function private.rimuovi_destinatari_ritorno();

create trigger amicizie_rimuovi_destinatari_ritorno
  after delete on public.amicizie
  for each row execute function private.rimuovi_destinatari_ritorno();

-- ---------------------------------------------------------------------------------------------
-- Trigger di posizioni_ritorno
-- ---------------------------------------------------------------------------------------------
-- R-31: al massimo una posizione ogni 30 secondi, con l'ora del database; aggiorna
-- `ultima_posizione_il` e avvisa chi guarda.
create or replace function private.verifica_posizione_ritorno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ultima timestamptz;
begin
  select r.ultima_posizione_il into ultima
  from public.ritorni_sicuri r where r.id = new.ritorno_id and r.stato = 'attivo'
  for update;
  if not found then
    raise exception using errcode = 'NX059', message = 'Il ritorno sicuro non è più attivo.';
  end if;
  if ultima is not null and ultima > now() - interval '30 seconds' then
    raise exception using errcode = 'NX060', message = 'Posizione troppo ravvicinata.';
  end if;
  new.registrata_il := now();
  update public.ritorni_sicuri r set ultima_posizione_il = now() where r.id = new.ritorno_id;
  return new;
end;
$$;

create trigger posizioni_ritorno_verifica
  before insert on public.posizioni_ritorno
  for each row execute function private.verifica_posizione_ritorno();

create or replace function private.dopo_posizione_ritorno()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.avvisa_ritorno(new.ritorno_id);
  return null;
end;
$$;

create trigger posizioni_ritorno_avvisa
  after insert on public.posizioni_ritorno
  for each row execute function private.dopo_posizione_ritorno();

-- ---------------------------------------------------------------------------------------------
-- Job: allerta e fine automatica (ADR-0006)
-- ---------------------------------------------------------------------------------------------
-- Ogni minuto: arrivo previsto superato senza conferma → notifiche ritorno_allerta ai
-- destinatari ancora amici (solo identificativi: l'ultima posizione si legge nell'app); 2 ore
-- dopo l'arrivo previsto → il ritorno scade (R-31).
create or replace function private.verifica_ritorni_scaduti()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ritorno record;
  amico uuid;
begin
  for ritorno in
    select r.id, r.utente_id from public.ritorni_sicuri r
    where r.stato = 'attivo' and r.arrivo_previsto < now() and r.allerta_inviata_il is null
    for update skip locked
  loop
    update public.ritorni_sicuri r set allerta_inviata_il = now() where r.id = ritorno.id;
    for amico in
      select d.amico_id from public.ritorni_destinatari d
      where d.ritorno_id = ritorno.id and private.sono_amici(ritorno.utente_id, d.amico_id)
    loop
      perform private.crea_notifica(amico, 'ritorno_allerta',
                                    jsonb_build_object('ritorno_id', ritorno.id, 'utente_id', ritorno.utente_id));
    end loop;
    perform private.avvisa_persone_ritorno(ritorno.id);
  end loop;

  update public.ritorni_sicuri r set stato = 'scaduto'
  where r.stato = 'attivo' and r.arrivo_previsto < now() - interval '2 hours';
end;
$$;

select cron.schedule('verifica_ritorni_scaduti', '* * * * *', $$select private.verifica_ritorni_scaduti()$$);

-- ---------------------------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------------------------
-- Avvia il ritorno con i destinatari in un'unica transazione. Security invoker: valgono le
-- policy. Chi non è più un amico confermato viene escluso e restituito; senza nessun amico
-- valido il ritorno non parte (NX056); più di 5 amici validi: NX057.
create or replace function public.avvia_ritorno(arrivo_previsto timestamptz, destinatari uuid[])
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  io uuid := auth.uid();
  validi uuid[];
  esclusi uuid[];
  nuovo public.ritorni_sicuri%rowtype;
begin
  if io is null then
    raise exception using errcode = '42501', message = 'Accesso richiesto.';
  end if;
  if cardinality(coalesce(destinatari, '{}')) > 50 then
    raise exception using errcode = 'NX057', message = 'Al massimo 5 amici per ritorno.';
  end if;
  select coalesce(array_agg(distinct d), '{}') into validi
  from unnest(coalesce(destinatari, '{}')) d
  where d is not null and d <> io and private.sono_amici(io, d);
  select coalesce(array_agg(distinct d), '{}') into esclusi
  from unnest(coalesce(destinatari, '{}')) d
  where d is not null and not d = any (validi);
  if cardinality(validi) = 0 then
    raise exception using errcode = 'NX056', message = 'Scegli almeno un amico confermato.';
  end if;
  if cardinality(validi) > 5 then
    raise exception using errcode = 'NX057', message = 'Al massimo 5 amici per ritorno.';
  end if;

  insert into public.ritorni_sicuri (arrivo_previsto) values (avvia_ritorno.arrivo_previsto)
  returning * into nuovo;
  insert into public.ritorni_destinatari (ritorno_id, amico_id)
  select nuovo.id, d from unnest(validi) d;

  return jsonb_build_object('id', nuovo.id, 'avviato_il', nuovo.avviato_il,
                            'arrivo_previsto', nuovo.arrivo_previsto,
                            'destinatari', to_jsonb(validi), 'esclusi', to_jsonb(esclusi));
end;
$$;

-- Proroga di 15 o 30 minuti dall'arrivo previsto (o da adesso, se è già passato), entro 4 ore
-- dall'avvio. Security invoker: l'aggiornamento passa da policy e proteggi_ritorno.
create or replace function public.proroga_ritorno(ritorno uuid, minuti integer)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nuovo timestamptz;
begin
  if minuti not in (15, 30) then
    raise exception using errcode = '22023', message = 'Si proroga di 15 o 30 minuti.';
  end if;
  update public.ritorni_sicuri r
  set arrivo_previsto = greatest(r.arrivo_previsto, now()) + make_interval(mins => minuti)
  where r.id = ritorno and r.utente_id = auth.uid() and r.stato = 'attivo'
  returning r.arrivo_previsto into nuovo;
  if nuovo is null then
    raise exception using errcode = 'NX059', message = 'Il ritorno sicuro non è più attivo.';
  end if;
  return nuovo;
end;
$$;

-- Invia una posizione del proprio ritorno attivo. Security invoker: policy e trigger decidono.
create or replace function public.invia_posizione_ritorno(
  ritorno uuid, latitudine double precision, longitudine double precision, precisione_m real)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if latitudine is null or longitudine is null
     or latitudine not between -90 and 90 or longitudine not between -180 and 180 then
    raise exception using errcode = '22023', message = 'Posizione non valida.';
  end if;
  insert into public.posizioni_ritorno (ritorno_id, posizione, precisione_m)
  values (ritorno,
          extensions.st_setsrid(extensions.st_makepoint(longitudine, latitudine), 4326)::extensions.geography,
          greatest(1, least(invia_posizione_ritorno.precisione_m, 10000)));
end;
$$;

-- Ritorni dell'area Vivi: il proprio attivo (con i destinatari) e quelli ricevuti, attivi o
-- conclusi da meno di 15 minuti, con l'ultima posizione solo se attivi. Security invoker: tutto
-- passa dalla RLS (R-17, R-31).
create or replace function public.ritorni_vivi()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with ultime as (
    select distinct on (p.ritorno_id) p.ritorno_id,
           extensions.st_y(p.posizione::extensions.geometry) as lat,
           extensions.st_x(p.posizione::extensions.geometry) as lon,
           p.precisione_m, p.registrata_il
    from public.posizioni_ritorno p
    order by p.ritorno_id, p.registrata_il desc
  ),
  righe as (
    select r.*, u.lat, u.lon, u.precisione_m, u.registrata_il
    from public.ritorni_sicuri r
    left join ultime u on u.ritorno_id = r.id
  )
  select jsonb_build_object(
    'mio', (
      select jsonb_build_object(
               'id', r.id, 'stato', r.stato, 'avviato_il', r.avviato_il,
               'arrivo_previsto', r.arrivo_previsto, 'allerta_inviata_il', r.allerta_inviata_il,
               'concluso_il', r.concluso_il,
               'posizione', case when r.lat is null then null else jsonb_build_object(
                 'lat', r.lat, 'lon', r.lon, 'precisione_m', r.precisione_m,
                 'registrata_il', r.registrata_il) end,
               'destinatari', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', p.id, 'username', p.username,
                          'nome_visualizzato', p.nome_visualizzato, 'avatar_path', p.avatar_path,
                          'avatar_nascosto', p.avatar_nascosto)
                        order by p.nome_visualizzato)
                 from public.ritorni_destinatari d
                 join public.profili p on p.id = d.amico_id
                 where d.ritorno_id = r.id), '[]'::jsonb))
      from righe r
      where r.utente_id = auth.uid() and r.stato = 'attivo'
      limit 1),
    'ricevuti', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'stato', r.stato, 'avviato_il', r.avviato_il,
               'arrivo_previsto', r.arrivo_previsto, 'allerta_inviata_il', r.allerta_inviata_il,
               'concluso_il', r.concluso_il,
               'posizione', case when r.lat is null then null else jsonb_build_object(
                 'lat', r.lat, 'lon', r.lon, 'precisione_m', r.precisione_m,
                 'registrata_il', r.registrata_il) end,
               'utente', jsonb_build_object(
                 'id', p.id, 'username', p.username,
                 'nome_visualizzato', p.nome_visualizzato, 'avatar_path', p.avatar_path,
                          'avatar_nascosto', p.avatar_nascosto))
             order by r.arrivo_previsto)
      from righe r
      join public.profili p on p.id = r.utente_id
      where r.utente_id <> auth.uid()), '[]'::jsonb)
  );
$$;

-- Suggerimenti dell'avvio (design/F-21-ritorno-sicuro §2): serate di gruppo di stasera a cui
-- non hai detto di no, con gli amici confermati del gruppo e chi torna con te (stesso
-- passaggio al ritorno, F-16), più il locale del check-in attivo per la tratta. Security
-- invoker: serate e partecipazioni passano dalla loro RLS (R-24).
create or replace function public.suggerimenti_ritorno()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with stasera as (
    select ((now() at time zone 'Europe/Rome') - interval '6 hours')::date as giorno
  ),
  mie as (
    select s.id, s.gruppo_id, coalesce(s.titolo, e.titolo) as titolo, l.nome as locale,
           ps.trasporto_ritorno, ps.passaggio_da
    from public.serate_gruppo s
    left join public.eventi e on e.id = s.evento_id
    left join public.locali l on l.id = e.locale_id and l.attivo
    left join public.partecipazioni_serata ps on ps.serata_id = s.id and ps.utente_id = auth.uid()
    cross join stasera
    where s.data_serata = stasera.giorno and s.stato <> 'annullata'
      and coalesce(ps.risposta::text, '') <> 'no'
  )
  select jsonb_build_object(
    'partenza', (
      select l.nome from public.checkin c join public.locali l on l.id = c.locale_id
      where c.utente_id = auth.uid() and c.terminato_il is null and c.scade_il > now()
      order by c.creato_il desc limit 1),
    'serate', coalesce((
      select jsonb_agg(jsonb_build_object(
               'serata_id', m.id, 'titolo', m.titolo, 'locale', m.locale,
               'amici', coalesce((
                 select jsonb_agg(x.utente_id)
                 from public.membri_gruppo x
                 where x.gruppo_id = m.gruppo_id and x.stato = 'attivo' and x.utente_id <> auth.uid()
                   and private.sono_amici(auth.uid(), x.utente_id)
                   and not exists (select 1 from public.partecipazioni_serata ps
                                   where ps.serata_id = m.id and ps.utente_id = x.utente_id
                                     and ps.risposta = 'no')), '[]'::jsonb),
               'torna_con_te', coalesce((
                 select jsonb_agg(ps.utente_id)
                 from public.partecipazioni_serata ps
                 where ps.serata_id = m.id and ps.utente_id <> auth.uid() and ps.risposta <> 'no'
                   and private.sono_amici(auth.uid(), ps.utente_id)
                   and ((m.trasporto_ritorno = 'passaggio' and m.passaggio_da = ps.utente_id)
                        or (ps.trasporto_ritorno = 'passaggio' and ps.passaggio_da = auth.uid())
                        or (m.trasporto_ritorno = 'passaggio' and ps.trasporto_ritorno = 'passaggio'
                            and m.passaggio_da is not null and ps.passaggio_da = m.passaggio_da))),
                 '[]'::jsonb))
             order by m.titolo)
      from mie m), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Realtime: il canale `ritorno:<id>` si aggiunge a quelli di ADR-0024
-- ---------------------------------------------------------------------------------------------
create or replace function private.puo_ascoltare(argomento text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when argomento = 'gruppi:' || auth.uid()::text then true
    when argomento = 'vivi:' || auth.uid()::text then true
    when argomento ~ '^serata:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      exists (select 1 from public.serate_gruppo s where s.id = substr(argomento, 8)::uuid)
    -- R-31: il titolare e i destinatari che vedono il ritorno (RLS di ritorni_sicuri).
    when argomento ~ '^ritorno:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      exists (select 1 from public.ritorni_sicuri r where r.id = substr(argomento, 9)::uuid)
    else false
  end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Conservazione (SAFETY_PRIVACY.md §10): si aggiungono i ritorni sicuri
-- ---------------------------------------------------------------------------------------------
create or replace function private.applica_conservazione()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.eventi_grezzi where creato_il < now() - interval '30 days';
  delete from public.coda_job
  where stato in ('completato', 'fallito') and completato_il < now() - interval '14 days';
  delete from public.esecuzioni_fonte where iniziata_il < now() - interval '90 days';
  delete from public.notifiche where creata_il < now() - interval '90 days';
  delete from private.registro_caricamenti_flyer where creato_il < now() - interval '24 hours';
  delete from public.reclami r
  where r.stato = 'deciso' and r.deciso_il < now() - interval '12 months'
    and not exists (select 1 from public.azioni_moderazione a
                    where a.id = r.azione_id and a.conservazione_legale);
  -- Registro della moderazione: 12 mesi dalla decisione, salvo le prove (R-55) e le decisioni
  -- con un reclamo ancora conservato.
  delete from public.azioni_moderazione a
  where a.creata_il < now() - interval '12 months'
    and not a.conservazione_legale
    and not exists (select 1 from public.reclami r where r.azione_id = a.id);
  delete from public.segnalazioni s
  where s.stato = 'chiusa' and s.chiusa_il < now() - interval '12 months'
    and not s.conservazione_legale;
  -- Foto dei locali disattivati da più di 7 giorni: il riferimento si toglie qui, il file lo
  -- elimina il job pulizia_flyer (private.immagini_da_eliminare). Le prove restano (R-55).
  update public.locali l
  set immagine_path = null, immagine_fonte = null, immagine_attribuzione = null,
      immagine_riferimento = null
  where not l.attivo and l.immagine_path is not null
    and l.aggiornato_il < now() - interval '7 days'
    and not exists (select 1 from public.contenuti_occultati x
                    where x.tipo_oggetto = 'immagine_locale' and x.oggetto_id = l.id
                      and x.conservazione_legale);
  delete from private.tentativi_eliminazione where tentato_il < now() - interval '24 hours';
  delete from private.esportazioni_dati where richiesta_il < now() - interval '24 hours';
  -- R-30: check-in cancellati 24 ore dopo la fine (scadenza o "Sono andato via").
  delete from public.checkin c
  where least(c.terminato_il, c.scade_il) < now() - interval '24 hours';
  -- R-31: ritorni sicuri (con destinatari e posizioni) cancellati 24 ore dopo la fine.
  delete from public.ritorni_sicuri r
  where r.stato <> 'attivo' and r.concluso_il < now() - interval '24 hours';
  -- Dispositivi su cui l'app non si apre da 90 giorni.
  delete from public.dispositivi_push where ultimo_uso_il < now() - interval '90 days';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Esportazione dei dati (R-64): si aggiungono i ritorni sicuri con le proprie posizioni
-- ---------------------------------------------------------------------------------------------
create or replace function public.esporta_miei_dati()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := auth.uid();
begin
  return private.esporta_dati_base() || jsonb_build_object(
    'checkin', coalesce((
      select jsonb_agg(jsonb_build_object(
               'locale', l.nome, 'evento', e.titolo, 'creato_il', c.creato_il,
               'scade_il', c.scade_il, 'terminato_il', c.terminato_il,
               -- R-17: chi è bloccato, in una delle due direzioni, non compare.
               'destinatari', coalesce((select jsonb_agg(p.username)
                                        from public.checkin_destinatari d
                                        join public.profili p on p.id = d.amico_id
                                        where d.checkin_id = c.id
                                          and not private.c_e_blocco(io, d.amico_id)), '[]'::jsonb))
             order by c.creato_il)
      from public.checkin c
      join public.locali l on l.id = c.locale_id
      left join public.eventi e on e.id = c.evento_id
      where c.utente_id = io), '[]'::jsonb),
    'ritorni_sicuri', coalesce((
      select jsonb_agg(jsonb_build_object(
               'stato', r.stato, 'avviato_il', r.avviato_il, 'arrivo_previsto', r.arrivo_previsto,
               'allerta_inviata_il', r.allerta_inviata_il, 'concluso_il', r.concluso_il,
               'destinatari', coalesce((select jsonb_agg(p.username)
                                        from public.ritorni_destinatari d
                                        join public.profili p on p.id = d.amico_id
                                        where d.ritorno_id = r.id
                                          and not private.c_e_blocco(io, d.amico_id)), '[]'::jsonb),
               'posizioni', coalesce((select jsonb_agg(jsonb_build_object(
                                        'latitudine', extensions.st_y(p.posizione::extensions.geometry),
                                        'longitudine', extensions.st_x(p.posizione::extensions.geometry),
                                        'precisione_m', p.precisione_m,
                                        'registrata_il', p.registrata_il) order by p.registrata_il)
                                      from public.posizioni_ritorno p where p.ritorno_id = r.id), '[]'::jsonb))
             order by r.avviato_il)
      from public.ritorni_sicuri r
      where r.utente_id = io), '[]'::jsonb),
    'dispositivi_push', coalesce((
      select jsonb_agg(jsonb_build_object('piattaforma', d.piattaforma, 'descrizione', d.descrizione,
                                          'creato_il', d.creato_il, 'ultimo_uso_il', d.ultimo_uso_il)
                       order by d.creato_il)
      from public.dispositivi_push d where d.utente_id = io), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function private.e_titolare_ritorno(uuid) from public;
revoke all on function private.e_destinatario_ritorno(uuid) from public;
revoke all on function private.ritorno_attivo(uuid) from public;
revoke all on function private.avvisa_ritorno(uuid) from public;
revoke all on function private.avvisa_persone_ritorno(uuid) from public;
revoke all on function private.verifica_ritorno() from public;
revoke all on function private.proteggi_ritorno() from public;
revoke all on function private.dopo_cambio_ritorno() from public;
revoke all on function private.verifica_destinatario_ritorno() from public;
revoke all on function private.notifica_ritorno() from public;
revoke all on function private.dopo_rimozione_destinatario_ritorno() from public;
revoke all on function private.rimuovi_destinatari_ritorno() from public;
revoke all on function private.verifica_posizione_ritorno() from public;
revoke all on function private.dopo_posizione_ritorno() from public;
revoke all on function private.verifica_ritorni_scaduti() from public;
revoke all on function private.applica_conservazione() from public;
grant execute on function private.e_titolare_ritorno(uuid) to authenticated;
grant execute on function private.e_destinatario_ritorno(uuid) to authenticated;
grant execute on function private.ritorno_attivo(uuid) to authenticated;
revoke all on function public.avvia_ritorno(timestamptz, uuid[]) from public, anon;
revoke all on function public.proroga_ritorno(uuid, integer) from public, anon;
revoke all on function public.invia_posizione_ritorno(uuid, double precision, double precision, real) from public, anon;
revoke all on function public.ritorni_vivi() from public, anon;
revoke all on function public.suggerimenti_ritorno() from public, anon;
revoke all on function public.esporta_miei_dati() from public, anon;
grant execute on function public.avvia_ritorno(timestamptz, uuid[]) to authenticated;
grant execute on function public.proroga_ritorno(uuid, integer) to authenticated;
grant execute on function public.invia_posizione_ritorno(uuid, double precision, double precision, real) to authenticated;
grant execute on function public.ritorni_vivi() to authenticated;
grant execute on function public.suggerimenti_ritorno() to authenticated;
grant execute on function public.esporta_miei_dati() to authenticated;
