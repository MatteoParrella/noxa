-- Migrazione: aggiornamenti dal vivo di gruppi e serate con Broadcast privato al posto di
-- Postgres Changes
-- Documentazione: docs/DATA_MODEL.md §7, docs/ARCHITECTURE.md §4.3 e §5.3; regole: R-13,
-- R-15, R-17, R-24
--
-- Postgres Changes non applica la RLS agli eventi DELETE e li invia con la chiave primaria:
-- con `membri_gruppo` e `partecipazioni_serata` pubblicate, qualsiasi sessione autenticata
-- avrebbe ricevuto chi esce da quale gruppo e chi toglie la risposta a quale serata. I trigger
-- inviano invece un avviso senza dati su un canale privato; chi lo riceve ricarica con le RPC,
-- soggette alla RLS.

alter publication supabase_realtime drop table public.partecipazioni_serata;
alter publication supabase_realtime drop table public.serate_gruppo;
alter publication supabase_realtime drop table public.membri_gruppo;

-- ---------------------------------------------------------------------------------------------
-- Avvisi
-- ---------------------------------------------------------------------------------------------
-- Una serata o le sue risposte sono cambiate: avviso su `serata:<id>`.
create or replace function private.avvisa_cambio_serata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Le due tabelle hanno colonne diverse: si legge la riga come JSON.
  riga jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  serata text := case when tg_table_name = 'serate_gruppo' then riga ->> 'id'
                      else riga ->> 'serata_id' end;
begin
  perform realtime.send('{}'::jsonb, 'cambio', 'serata:' || serata, true);
  return null;
end;
$$;

create trigger serate_gruppo_avvisa
  after insert or update or delete on public.serate_gruppo
  for each row execute function private.avvisa_cambio_serata();

create trigger partecipazioni_serata_avvisa
  after insert or update or delete on public.partecipazioni_serata
  for each row execute function private.avvisa_cambio_serata();

-- Un invito, un ingresso o un'uscita: avviso alla sola persona interessata su `gruppi:<id>`.
create or replace function private.avvisa_cambio_membri()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send('{}'::jsonb, 'cambio',
                        'gruppi:' || coalesce(new.utente_id, old.utente_id)::text, true);
  return null;
end;
$$;

create trigger membri_gruppo_avvisa
  after insert or update or delete on public.membri_gruppo
  for each row execute function private.avvisa_cambio_membri();

-- ---------------------------------------------------------------------------------------------
-- Chi ascolta
-- ---------------------------------------------------------------------------------------------
-- Security invoker: la sottoquery su serate_gruppo passa dalla sua RLS (membri attivi, evento
-- visibile, R-24). Il `case` evita il cast di un argomento che non è un identificativo.
create or replace function private.puo_ascoltare(argomento text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when argomento = 'gruppi:' || auth.uid()::text then true
    when argomento ~ '^serata:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      exists (select 1 from public.serate_gruppo s where s.id = substr(argomento, 8)::uuid)
    else false
  end;
$$;

revoke all on function private.avvisa_cambio_serata() from public;
revoke all on function private.avvisa_cambio_membri() from public;
revoke all on function private.puo_ascoltare(text) from public;
grant execute on function private.puo_ascoltare(text) to authenticated;

-- R-13, R-17, R-24: si ascolta solo il proprio canale dei gruppi e le serate che si vedono.
create policy "realtime: gruppi propri e serate visibili"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select private.puo_ascoltare(realtime.topic()))
  );
