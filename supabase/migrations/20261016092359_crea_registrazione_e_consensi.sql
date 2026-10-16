-- Migrazione: registrazione con controllo dell'età, consensi versionati, RPC mio_account
-- Documentazione: docs/DATA_MODEL.md §4, §5.1, §5.10; ARCHITECTURE.md §4.1;
-- regole: R-01, R-02, R-05, R-60, R-63
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX001 età inferiore a 14 anni (R-01)
--   NX002 username non valido
--   NX003 username già in uso
--   NX004 nome visualizzato non valido
--   NX005 data di nascita mancante o non valida
--   NX006 consenso a termini o informativa mancante o di una versione non in vigore (R-63)
--   NX007 data di nascita non modificabile (R-02, migrazione precedente)

-- ---------------------------------------------------------------------------------------------
-- Versioni di termini e informativa (R-63)
-- ---------------------------------------------------------------------------------------------
-- Nello schema private: si legge solo tramite private.versione_corrente e public.mio_account.
-- Una nuova versione si pubblica con una migrazione che inserisce una riga: chi ha accettato
-- solo le versioni precedenti vede il foglio "Nuova versione dei termini" al primo accesso.
create table private.versioni_documenti (
  tipo          public.tipo_consenso not null,
  versione      text not null check (versione ~ '^[0-9]{4}-[0-9]{2}$'),
  in_vigore_dal date not null,
  novita        text[] not null default '{}',
  primary key (tipo, versione)
);
comment on table private.versioni_documenti is
  'Versioni di termini e informativa con le novità da riassumere (R-63).';
revoke all on private.versioni_documenti from public, anon, authenticated;

insert into private.versioni_documenti (tipo, versione, in_vigore_dal)
values ('termini', '2026-10', date '2026-10-16'),
       ('privacy', '2026-10', date '2026-10-16');

create or replace function private.versione_corrente(tipo_documento public.tipo_consenso)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select v.versione
  from private.versioni_documenti v
  where v.tipo = tipo_documento
    and v.in_vigore_dal <= (now() at time zone 'Europe/Rome')::date
  order by v.in_vigore_dal desc, v.versione desc
  limit 1;
$$;
revoke all on function private.versione_corrente(public.tipo_consenso) from public;
grant execute on function private.versione_corrente(public.tipo_consenso) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- consensi: registro di sola aggiunta (R-63)
-- ---------------------------------------------------------------------------------------------
create table public.consensi (
  id           uuid primary key default gen_random_uuid(),
  utente_id    uuid not null references public.profili (id) on delete cascade,
  tipo         public.tipo_consenso not null,
  versione     text not null,
  accettato_il timestamptz not null default now(),
  unique (utente_id, tipo, versione)
);
comment on table public.consensi is
  'Consensi a termini e informativa con la versione accettata; solo aggiunte (R-63).';

alter table public.consensi enable row level security;

revoke all on public.consensi from anon, authenticated;
grant select on public.consensi to authenticated;
-- La data di accettazione la decide il database.
grant insert (utente_id, tipo, versione) on public.consensi to authenticated;

create policy "consensi: il titolare vede i propri consensi"
  on public.consensi for select to authenticated
  using (utente_id = (select auth.uid()));

-- R-63
create policy "consensi: il titolare accetta la versione in vigore"
  on public.consensi for insert to authenticated
  with check (
    utente_id = (select auth.uid())
    and versione = (select private.versione_corrente(tipo))
  );

-- ---------------------------------------------------------------------------------------------
-- Verifica dei dati di registrazione (R-01, R-60)
-- ---------------------------------------------------------------------------------------------
-- I metadati arrivano da supabase.auth.signUp(options.data):
--   { username, nome_visualizzato, data_nascita: 'AAAA-MM-GG',
--     consensi: { termini: '<versione>', privacy: '<versione>' } }
-- Restituisce null se i dati sono validi, altrimenti il codice NX0nn. È usata dall'hook di
-- Supabase Auth (errore leggibile dall'app) e dal trigger su auth.users (difesa in profondità).
create or replace function private.verifica_dati_registrazione(metadati jsonb)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  testo_data text := metadati ->> 'data_nascita';
  nascita date;
  oggi date := (now() at time zone 'Europe/Rome')::date;
  username_richiesto text := metadati ->> 'username';
  nome text := metadati ->> 'nome_visualizzato';
begin
  if testo_data is null or testo_data !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return 'NX005';
  end if;
  begin
    nascita := testo_data::date;
  exception when others then
    return 'NX005';
  end;
  if nascita <= date '1900-01-01' or nascita > oggi then
    return 'NX005';
  end if;
  -- R-01
  if extract(year from age(oggi, nascita)) < 14 then
    return 'NX001';
  end if;

  if username_richiesto is null or username_richiesto !~ '^[a-z0-9_.]{3,20}$' then
    return 'NX002';
  end if;
  if exists (select 1 from public.profili p where p.username = username_richiesto::extensions.citext) then
    return 'NX003';
  end if;

  if nome is null or nome <> btrim(nome) or char_length(nome) not between 1 and 40 then
    return 'NX004';
  end if;

  -- R-63
  if (metadati -> 'consensi' ->> 'termini') is distinct from private.versione_corrente('termini')
     or (metadati -> 'consensi' ->> 'privacy') is distinct from private.versione_corrente('privacy')
  then
    return 'NX006';
  end if;

  return null;
end;
$$;
revoke all on function private.verifica_dati_registrazione(jsonb) from public;

-- ---------------------------------------------------------------------------------------------
-- Hook "before user created" di Supabase Auth (supabase/config.toml)
-- ---------------------------------------------------------------------------------------------
-- Rifiuta la registrazione prima di creare l'utente, con un errore che l'app può mostrare.
-- Il messaggio inizia con il codice NX0nn, convertito in un errore di dominio dall'app.
create or replace function private.prima_della_creazione_utente(evento jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  codice text := private.verifica_dati_registrazione(
    coalesce(evento -> 'user' -> 'user_metadata', '{}'::jsonb)
  );
begin
  if codice is null then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 400, 'message', codice)
  );
end;
$$;
revoke all on function private.prima_della_creazione_utente(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.prima_della_creazione_utente(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------------------------
-- Trigger di registrazione su auth.users (R-01, R-02, R-05, R-60, R-63)
-- ---------------------------------------------------------------------------------------------
-- Prima dell'inserimento: ripete la verifica dell'hook (vale anche per gli utenti creati con
-- service_role o se l'hook non è configurato), crea profilo, dati privati e consensi, poi toglie
-- i dati di registrazione dai metadati: la data di nascita resta solo in profili_privati e non
-- finisce nel JWT (R-05). Il vincolo profili.id → auth.users è differito per questo.
create or replace function private.gestisci_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadati jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  codice text := private.verifica_dati_registrazione(metadati);
begin
  if codice is not null then
    raise exception using
      errcode = codice,
      message = 'Registrazione rifiutata: ' || codice;
  end if;

  insert into public.profili (id, username, nome_visualizzato)
  values (new.id, metadati ->> 'username', metadati ->> 'nome_visualizzato');

  insert into public.profili_privati (utente_id, data_nascita)
  values (new.id, (metadati ->> 'data_nascita')::date);

  insert into public.consensi (utente_id, tipo, versione)
  values (new.id, 'termini', metadati -> 'consensi' ->> 'termini'),
         (new.id, 'privacy', metadati -> 'consensi' ->> 'privacy');

  new.raw_user_meta_data := metadati - 'data_nascita' - 'username' - 'nome_visualizzato' - 'consensi';
  return new;
end;
$$;
revoke all on function private.gestisci_nuovo_utente() from public;

create trigger gestisci_nuovo_utente
  before insert on auth.users
  for each row execute function private.gestisci_nuovo_utente();

-- Supabase Auth riscrive i metadati subito dopo la creazione con la copia che ha in memoria:
-- anche negli aggiornamenti i dati di registrazione non restano nei metadati (R-05).
create or replace function private.rimuovi_dati_registrazione()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
                            - 'data_nascita' - 'username' - 'nome_visualizzato' - 'consensi';
  return new;
end;
$$;
revoke all on function private.rimuovi_dati_registrazione() from public;

create trigger rimuovi_dati_registrazione
  before update of raw_user_meta_data on auth.users
  for each row execute function private.rimuovi_dati_registrazione();

-- Supabase Auth copia i metadati anche nell'identità email (auth.identities.identity_data):
-- anche lì non restano (R-05).
create or replace function private.rimuovi_dati_registrazione_identita()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.identity_data := coalesce(new.identity_data, '{}'::jsonb)
                       - 'data_nascita' - 'username' - 'nome_visualizzato' - 'consensi';
  return new;
end;
$$;
revoke all on function private.rimuovi_dati_registrazione_identita() from public;

create trigger rimuovi_dati_registrazione
  before insert or update of identity_data on auth.identities
  for each row execute function private.rimuovi_dati_registrazione_identita();

-- ---------------------------------------------------------------------------------------------
-- RPC public.mio_account: stato dell'account per l'app
-- ---------------------------------------------------------------------------------------------
-- Restituisce solo dati del chiamante: username, nome, se è minorenne (per i testi
-- dell'onboarding, R-05: l'informazione resta al titolare), se ha completato l'onboarding e i
-- documenti in vigore non ancora accettati, con le novità da riassumere (R-63).
create or replace function public.mio_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  risultato jsonb;
begin
  if utente is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;

  select jsonb_build_object(
           'username', p.username::text,
           'nome_visualizzato', p.nome_visualizzato,
           'stato_account', p.stato_account,
           'minorenne', private.e_minorenne(p.id),
           'onboarding_completato', pp.onboarding_completato_il is not null,
           'documenti_da_accettare', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'tipo', v.tipo,
                      'versione', v.versione,
                      'in_vigore_dal', v.in_vigore_dal,
                      'novita', to_jsonb(v.novita)
                    ) order by v.tipo)
             from private.versioni_documenti v
             where v.versione = private.versione_corrente(v.tipo)
               and not exists (
                 select 1 from public.consensi c
                 where c.utente_id = p.id and c.tipo = v.tipo and c.versione = v.versione
               )
           ), '[]'::jsonb)
         )
  into risultato
  from public.profili p
  join public.profili_privati pp on pp.utente_id = p.id
  where p.id = utente;

  return risultato;
end;
$$;
revoke all on function public.mio_account() from public, anon;
grant execute on function public.mio_account() to authenticated;
