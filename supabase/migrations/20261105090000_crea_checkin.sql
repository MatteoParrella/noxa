-- Migrazione: check-in "sono qui" (F-20)
-- Documentazione: docs/DATA_MODEL.md §5.5, §7, §8; docs/ARCHITECTURE.md §5.3; regole: R-17,
-- R-30, R-43, R-65, R-69
--
-- Il check-in indica solo un locale del catalogo, mai coordinate; lo vedono solo gli amici
-- confermati scelti ogni volta, per 6 ore; si cancella 24 ore dopo la fine. Un solo check-in
-- attivo alla volta (design/F-20-checkin/brief.md). I moderatori non hanno policy (R-69).
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX049 check-in disattivato nelle impostazioni (R-30)
--   NX050 c'è già un check-in attivo
--   NX051 nessun destinatario tra gli amici confermati
--   NX052 troppi check-in nelle ultime 24 ore
--   NX053 locale non disponibile o evento di un altro locale
--   NX054 check-in terminato o scaduto

-- ---------------------------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------------------------
create table public.checkin (
  id           uuid primary key default gen_random_uuid(),
  utente_id    uuid not null default auth.uid() references public.profili (id) on delete cascade,
  locale_id    uuid not null references public.locali (id) on delete cascade,
  evento_id    uuid references public.eventi (id) on delete set null,
  creato_il    timestamptz not null default now(),
  scade_il     timestamptz not null default now() + interval '6 hours',
  terminato_il timestamptz,
  constraint checkin_durata check (scade_il = creato_il + interval '6 hours'),
  constraint checkin_fine check (terminato_il is null or terminato_il >= creato_il)
);
comment on table public.checkin is
  'Check-in "sono qui": solo il locale, per 6 ore, visibile agli amici scelti (R-30).';
create index checkin_utente_idx on public.checkin (utente_id, creato_il desc);
create index checkin_scadenza_idx on public.checkin (scade_il);

create table public.checkin_destinatari (
  checkin_id uuid not null references public.checkin (id) on delete cascade,
  amico_id   uuid not null references public.profili (id) on delete cascade,
  primary key (checkin_id, amico_id)
);
comment on table public.checkin_destinatari is
  'Amici confermati scelti come destinatari di un check-in (R-30).';
create index checkin_destinatari_amico_idx on public.checkin_destinatari (amico_id);

alter table public.checkin enable row level security;
alter table public.checkin_destinatari enable row level security;
revoke all on public.checkin, public.checkin_destinatari from anon, authenticated;
grant select, delete on public.checkin to authenticated;
grant insert (locale_id, evento_id) on public.checkin to authenticated;
grant update (terminato_il) on public.checkin to authenticated;
grant select, insert, delete on public.checkin_destinatari to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Funzioni per le policy (evitano la ricorsione tra le due tabelle)
-- ---------------------------------------------------------------------------------------------
create or replace function private.e_titolare_checkin(checkin uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.checkin c where c.id = checkin and c.utente_id = auth.uid());
$$;

create or replace function private.e_destinatario_checkin(checkin uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.checkin_destinatari d
                 where d.checkin_id = checkin and d.amico_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------------------------
-- Policy
-- ---------------------------------------------------------------------------------------------
-- R-30, R-17: il destinatario vede il check-in finché è attivo e finché siete amici senza
-- blocchi (sono_amici esclude i blocchi); un account sospeso non vede altri (R-55).
create policy "checkin: il titolare e i destinatari amici finché è attivo"
  on public.checkin for select to authenticated
  using (
    utente_id = (select auth.uid())
    or (scade_il > now() and terminato_il is null
        and (select private.e_destinatario_checkin(id))
        and (select private.sono_amici(auth.uid(), utente_id))
        and (select private.account_attivo(auth.uid())))
  );

-- R-30, R-20: solo per sé, con un evento visibile alla propria età; il resto lo controlla il
-- trigger verifica_checkin.
create policy "checkin: si crea per sé"
  on public.checkin for insert to authenticated
  with check (
    utente_id = (select auth.uid())
    and (select private.account_attivo(auth.uid()))
    and (evento_id is null or (select private.evento_visibile_a(evento_id, auth.uid())))
  );

create policy "checkin: il titolare lo termina"
  on public.checkin for update to authenticated
  using (utente_id = (select auth.uid()))
  with check (utente_id = (select auth.uid()));

create policy "checkin: il titolare lo elimina"
  on public.checkin for delete to authenticated
  using (utente_id = (select auth.uid()));

create policy "checkin_destinatari: il titolare e il destinatario"
  on public.checkin_destinatari for select to authenticated
  using ((select private.e_titolare_checkin(checkin_id)) or amico_id = (select auth.uid()));

-- R-30: solo amici confermati, scelti dal titolare.
create policy "checkin_destinatari: il titolare sceglie amici confermati"
  on public.checkin_destinatari for insert to authenticated
  with check (
    (select private.e_titolare_checkin(checkin_id))
    and (select private.sono_amici(auth.uid(), amico_id))
  );

create policy "checkin_destinatari: il titolare toglie un destinatario"
  on public.checkin_destinatari for delete to authenticated
  using ((select private.e_titolare_checkin(checkin_id)));

-- ---------------------------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------------------------
-- Avviso senza dati sul canale privato della persona (ADR-0024): l'area Vivi ricarica.
create or replace function private.avvisa_vivi(utente uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send('{}'::jsonb, 'cambio', 'vivi:' || utente::text, true);
end;
$$;

-- R-30: check-in attivo nelle impostazioni, un solo check-in attivo, al massimo 10 al giorno
-- (ogni check-in avvisa gli amici), locale attivo, evento nello stesso locale. Orari decisi
-- dal database.
create or replace function private.verifica_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  abilitato boolean;
begin
  -- Il lock sulla riga delle impostazioni serializza i check-in della stessa persona.
  select pp.checkin_abilitato into abilitato
  from public.profili_privati pp where pp.utente_id = new.utente_id
  for update;
  if not coalesce(abilitato, false) then
    raise exception using errcode = 'NX049', message = 'Il check-in è disattivato nelle impostazioni.';
  end if;
  if exists (select 1 from public.checkin c
             where c.utente_id = new.utente_id and c.terminato_il is null and c.scade_il > now()) then
    raise exception using errcode = 'NX050', message = 'Hai già un check-in attivo.';
  end if;
  if (select count(*) from public.checkin c
      where c.utente_id = new.utente_id and c.creato_il > now() - interval '24 hours') >= 10 then
    raise exception using errcode = 'NX052', message = 'Troppi check-in nelle ultime 24 ore.';
  end if;
  if not exists (select 1 from public.locali l where l.id = new.locale_id and l.attivo)
     or (new.evento_id is not null
         and not exists (select 1 from public.eventi e
                         where e.id = new.evento_id and e.locale_id = new.locale_id)) then
    raise exception using errcode = 'NX053', message = 'Locale non disponibile.';
  end if;
  new.creato_il := now();
  new.scade_il := now() + interval '6 hours';
  new.terminato_il := null;
  return new;
end;
$$;

create trigger checkin_verifica
  before insert on public.checkin
  for each row execute function private.verifica_checkin();

-- La fine si registra una volta sola e con l'ora del database.
create or replace function private.proteggi_checkin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.terminato_il is not null then
    new.terminato_il := old.terminato_il;
  elsif new.terminato_il is not null then
    new.terminato_il := least(now(), old.scade_il);
  end if;
  return new;
end;
$$;

create trigger checkin_proteggi
  before update on public.checkin
  for each row execute function private.proteggi_checkin();

-- Check-in terminato: sparisce subito dagli schermi dei destinatari.
create or replace function private.dopo_fine_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  amico uuid;
begin
  for amico in select d.amico_id from public.checkin_destinatari d where d.checkin_id = new.id loop
    perform private.avvisa_vivi(amico);
  end loop;
  return null;
end;
$$;

create trigger checkin_dopo_fine
  after update of terminato_il on public.checkin
  for each row when (old.terminato_il is null and new.terminato_il is not null)
  execute function private.dopo_fine_checkin();

-- Un destinatario si aggiunge solo a un check-in attivo e non è il titolare.
create or replace function private.verifica_destinatario_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.checkin c
                 where c.id = new.checkin_id and c.terminato_il is null and c.scade_il > now()
                   and c.utente_id <> new.amico_id) then
    raise exception using errcode = 'NX054', message = 'Il check-in non è più attivo.';
  end if;
  return new;
end;
$$;

create trigger checkin_destinatari_verifica
  before insert on public.checkin_destinatari
  for each row execute function private.verifica_destinatario_checkin();

-- Notifica checkin_amico con i soli identificativi: il locale si legge dal check-in finché è
-- visibile, poi la notifica dice "Check-in terminato" (design/F-20-checkin §5).
create or replace function private.notifica_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.crea_notifica(
    new.amico_id, 'checkin_amico',
    jsonb_build_object('checkin_id', new.checkin_id,
                       'utente_id', (select c.utente_id from public.checkin c where c.id = new.checkin_id))
  );
  perform private.avvisa_vivi(new.amico_id);
  return null;
end;
$$;

create trigger checkin_destinatari_notifica
  after insert on public.checkin_destinatari
  for each row execute function private.notifica_checkin();

-- Destinatario tolto: il check-in sparisce dal suo telefono con la notifica. Se era l'ultimo,
-- il check-in termina. Quando si elimina il check-in intero (conservazione, account eliminato)
-- le notifiche restano come "Check-in terminato".
create or replace function private.dopo_rimozione_destinatario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.checkin c where c.id = old.checkin_id) then
    delete from public.notifiche n
    where n.utente_id = old.amico_id and n.tipo = 'checkin_amico'
      and n.dati @> jsonb_build_object('checkin_id', old.checkin_id);
    if not exists (select 1 from public.checkin_destinatari d where d.checkin_id = old.checkin_id) then
      update public.checkin c set terminato_il = now()
      where c.id = old.checkin_id and c.terminato_il is null;
    end if;
  end if;
  perform private.avvisa_vivi(old.amico_id);
  return null;
end;
$$;

create trigger checkin_destinatari_rimozione
  after delete on public.checkin_destinatari
  for each row execute function private.dopo_rimozione_destinatario();

-- R-17: un blocco o un'amicizia rimossa tolgono la persona dai check-in dell'altra, nelle
-- due direzioni.
create or replace function private.rimuovi_destinatari_checkin()
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
  delete from public.checkin_destinatari d
  using public.checkin c
  where c.id = d.checkin_id
    and ((c.utente_id = a and d.amico_id = b) or (c.utente_id = b and d.amico_id = a));
  return null;
end;
$$;

create trigger blocchi_rimuovi_destinatari_checkin
  after insert on public.blocchi
  for each row execute function private.rimuovi_destinatari_checkin();

create trigger amicizie_rimuovi_destinatari_checkin
  after delete on public.amicizie
  for each row execute function private.rimuovi_destinatari_checkin();

-- R-30: spegnere l'impostazione termina il check-in attivo.
create or replace function private.dopo_disattivazione_checkin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.checkin c set terminato_il = now()
  where c.utente_id = new.utente_id and c.terminato_il is null and c.scade_il > now();
  return null;
end;
$$;

create trigger profili_privati_disattiva_checkin
  after update of checkin_abilitato on public.profili_privati
  for each row when (old.checkin_abilitato and not new.checkin_abilitato)
  execute function private.dopo_disattivazione_checkin();

-- ---------------------------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------------------------
-- Crea il check-in con i destinatari in un'unica transazione. Security invoker: valgono le
-- policy delle due tabelle. Chi non è più un amico confermato viene escluso e restituito, così
-- l'app lo dice; senza nessun amico valido il check-in non parte (NX051).
create or replace function public.fai_checkin(locale uuid, evento uuid, destinatari uuid[])
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  io uuid := auth.uid();
  validi uuid[];
  esclusi uuid[];
  nuovo public.checkin%rowtype;
begin
  if io is null then
    raise exception using errcode = '42501', message = 'Accesso richiesto.';
  end if;
  -- Prima l'impostazione (R-30), così chi l'ha spenta riceve il motivo giusto.
  if not coalesce((select pp.checkin_abilitato from public.profili_privati pp where pp.utente_id = io), false) then
    raise exception using errcode = 'NX049', message = 'Il check-in è disattivato nelle impostazioni.';
  end if;
  if cardinality(coalesce(destinatari, '{}')) > 500 then
    raise exception using errcode = '22023', message = 'Troppi destinatari.';
  end if;
  select coalesce(array_agg(distinct d), '{}') into validi
  from unnest(coalesce(destinatari, '{}')) d
  where d is not null and d <> io and private.sono_amici(io, d);
  select coalesce(array_agg(distinct d), '{}') into esclusi
  from unnest(coalesce(destinatari, '{}')) d
  where d is not null and not d = any (validi);
  if cardinality(validi) = 0 then
    raise exception using errcode = 'NX051', message = 'Scegli almeno un amico confermato.';
  end if;

  insert into public.checkin (locale_id, evento_id) values (locale, evento)
  returning * into nuovo;
  insert into public.checkin_destinatari (checkin_id, amico_id)
  select nuovo.id, d from unnest(validi) d;

  return jsonb_build_object('id', nuovo.id, 'scade_il', nuovo.scade_il,
                            'destinatari', to_jsonb(validi), 'esclusi', to_jsonb(esclusi));
end;
$$;

-- Suggerimenti di "Fai check-in" per la serata in corso (le notti finiscono alle 06:00, come
-- data_serata degli eventi): eventi a cui partecipi e serate di gruppo a cui non hai detto di
-- no, con gli amici confermati del gruppo da proporre come destinatari. Security invoker: eventi,
-- serate e membri passano dalla loro RLS (R-20, R-24).
create or replace function public.suggerimenti_checkin()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with stasera as (
    select ((now() at time zone 'Europe/Rome') - interval '6 hours')::date as giorno
  )
  select jsonb_build_object(
    'eventi', coalesce((
      select jsonb_agg(jsonb_build_object(
               'evento_id', e.id, 'titolo', e.titolo, 'inizio', e.inizio, 'fine', e.fine,
               'locale_id', l.id, 'locale', l.nome, 'comune', l.comune) order by e.inizio)
      from public.partecipazioni_evento pe
      join public.eventi e on e.id = pe.evento_id
      join public.locali l on l.id = e.locale_id
      cross join stasera
      where pe.utente_id = auth.uid() and pe.stato = 'partecipo'
        and e.stato = 'pubblicato' and l.attivo and e.data_serata = stasera.giorno), '[]'::jsonb),
    'serate', coalesce((
      select jsonb_agg(jsonb_build_object(
               'serata_id', s.id, 'titolo', coalesce(s.titolo, e.titolo),
               'evento_id', e.id, 'evento', e.titolo,
               'locale_id', l.id, 'locale', l.nome, 'comune', l.comune,
               'amici', coalesce((
                 select jsonb_agg(m.utente_id)
                 from public.membri_gruppo m
                 where m.gruppo_id = s.gruppo_id and m.stato = 'attivo' and m.utente_id <> auth.uid()
                   and private.sono_amici(auth.uid(), m.utente_id)
                   and not exists (select 1 from public.partecipazioni_serata ps
                                   where ps.serata_id = s.id and ps.utente_id = m.utente_id
                                     and ps.risposta = 'no')), '[]'::jsonb))
             order by s.creata_il)
      from public.serate_gruppo s
      left join public.eventi e on e.id = s.evento_id
      left join public.locali l on l.id = e.locale_id and l.attivo
      cross join stasera
      where s.data_serata = stasera.giorno and s.stato <> 'annullata'
        and not exists (select 1 from public.partecipazioni_serata ps
                        where ps.serata_id = s.id and ps.utente_id = auth.uid()
                          and ps.risposta = 'no')), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Realtime: il canale `vivi:<utente>` si aggiunge a quelli di ADR-0024
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
    else false
  end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function private.e_titolare_checkin(uuid) from public;
revoke all on function private.e_destinatario_checkin(uuid) from public;
revoke all on function private.avvisa_vivi(uuid) from public;
revoke all on function private.verifica_checkin() from public;
revoke all on function private.proteggi_checkin() from public;
revoke all on function private.dopo_fine_checkin() from public;
revoke all on function private.verifica_destinatario_checkin() from public;
revoke all on function private.notifica_checkin() from public;
revoke all on function private.dopo_rimozione_destinatario() from public;
revoke all on function private.rimuovi_destinatari_checkin() from public;
revoke all on function private.dopo_disattivazione_checkin() from public;
grant execute on function private.e_titolare_checkin(uuid) to authenticated;
grant execute on function private.e_destinatario_checkin(uuid) to authenticated;
revoke all on function public.fai_checkin(uuid, uuid, uuid[]) from public, anon;
revoke all on function public.suggerimenti_checkin() from public, anon;
grant execute on function public.fai_checkin(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.suggerimenti_checkin() to authenticated;
