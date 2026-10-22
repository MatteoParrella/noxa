-- Migrazione: notifiche nell'app con Realtime; notifiche delle richieste di amicizia e delle
-- amicizie accettate
-- Documentazione: docs/DATA_MODEL.md §5.1 (notifiche), §5.2 (amicizie, blocchi), §7;
-- regole: R-17, R-53 (esiti motivati), R-65 (conservazione 90 giorni)
--
-- Le notifiche contengono solo identificativi e testi di sistema o dei moderatori, mai testi
-- liberi scritti da altri utenti (design/F-06-flyer/brief.md §4).

-- ---------------------------------------------------------------------------------------------
-- notifiche
-- ---------------------------------------------------------------------------------------------
create table public.notifiche (
  id              uuid primary key default gen_random_uuid(),
  utente_id       uuid not null references public.profili (id) on delete cascade,
  tipo            text not null constraint notifiche_tipo check (tipo in (
                    'richiesta_amicizia', 'amicizia_accettata', 'invito_gruppo', 'nuova_serata',
                    'aggiornamento_serata', 'checkin_amico', 'ritorno_avviato', 'ritorno_allerta',
                    'ritorno_arrivato', 'esito_moderazione', 'rimozione_gruppo', 'badge_ottenuto',
                    'riepilogo_pronto')),
  dati            jsonb not null default '{}'::jsonb
                  constraint notifiche_dati_oggetto check (jsonb_typeof(dati) = 'object'),
  letta_il        timestamptz,
  inviata_push_il timestamptz,
  creata_il       timestamptz not null default now()
);
comment on table public.notifiche is
  'Notifiche nell''app (Realtime); solo identificativi e testi di sistema, conservate 90 giorni.';
create index notifiche_utente_idx on public.notifiche (utente_id, creata_il desc);
create index notifiche_creata_idx on public.notifiche (creata_il);
-- Ricerca delle notifiche collegate a un'amicizia o a una persona (blocco, rifiuto).
create index notifiche_dati_idx on public.notifiche using gin (dati jsonb_path_ops);

alter table public.notifiche enable row level security;
revoke all on public.notifiche from anon, authenticated;
grant select on public.notifiche to authenticated;
grant update (letta_il) on public.notifiche to authenticated;

create policy "notifiche: il titolare vede le proprie"
  on public.notifiche for select to authenticated
  using (utente_id = (select auth.uid()));

create policy "notifiche: il titolare le segna come lette"
  on public.notifiche for update to authenticated
  using (utente_id = (select auth.uid()))
  with check (utente_id = (select auth.uid()));

-- Le righe le scrivono solo le funzioni security definer e i trigger.
create or replace function private.crea_notifica(utente uuid, tipo text, dati jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if utente is null then
    return;
  end if;
  insert into public.notifiche (utente_id, tipo, dati) values (utente, tipo, dati);
end;
$$;

-- Realtime: l'app riceve le notifiche nuove del proprio utente (la RLS filtra le righe).
alter publication supabase_realtime add table public.notifiche;

-- ---------------------------------------------------------------------------------------------
-- Notifiche delle amicizie (F-11)
-- ---------------------------------------------------------------------------------------------
create or replace function private.notifica_amicizia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.stato = 'in_attesa' then
    perform private.crea_notifica(
      new.destinatario_id, 'richiesta_amicizia',
      jsonb_build_object('amicizia_id', new.id, 'utente_id', new.richiedente_id)
    );
  elsif tg_op = 'UPDATE' and new.stato = 'accettata' and old.stato = 'in_attesa' then
    -- La richiesta è stata gestita: la sua notifica non serve più.
    delete from public.notifiche n
    where n.tipo = 'richiesta_amicizia' and n.dati @> jsonb_build_object('amicizia_id', new.id);
    perform private.crea_notifica(
      new.richiedente_id, 'amicizia_accettata',
      jsonb_build_object('amicizia_id', new.id, 'utente_id', new.destinatario_id)
    );
  end if;
  return null;
end;
$$;

create trigger amicizie_notifica
  after insert or update of stato on public.amicizie
  for each row execute function private.notifica_amicizia();

-- Richiesta rifiutata o annullata, amicizia rimossa: spariscono le notifiche collegate.
create or replace function private.rimuovi_notifiche_amicizia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifiche n
  where n.tipo in ('richiesta_amicizia', 'amicizia_accettata')
    and n.dati @> jsonb_build_object('amicizia_id', old.id);
  return null;
end;
$$;

create trigger amicizie_rimuovi_notifiche
  after delete on public.amicizie
  for each row execute function private.rimuovi_notifiche_amicizia();

-- R-17: dopo un blocco nessuna delle due persone vede notifiche che riguardano l'altra.
create or replace function private.applica_blocco()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.amicizie f
  where least(f.richiedente_id, f.destinatario_id) = least(new.bloccante_id, new.bloccato_id)
    and greatest(f.richiedente_id, f.destinatario_id) = greatest(new.bloccante_id, new.bloccato_id);
  delete from public.notifiche n
  where (n.utente_id = new.bloccante_id
         and n.dati @> jsonb_build_object('utente_id', new.bloccato_id))
     or (n.utente_id = new.bloccato_id
         and n.dati @> jsonb_build_object('utente_id', new.bloccante_id));
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function private.crea_notifica(uuid, text, jsonb) from public;
revoke all on function private.notifica_amicizia() from public;
revoke all on function private.rimuovi_notifiche_amicizia() from public;
revoke all on function private.applica_blocco() from public;
