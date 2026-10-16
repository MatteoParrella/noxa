-- Migrazione: identità e account (profili, dati privati, ruoli) e funzioni di età e fascia
-- Documentazione: docs/DATA_MODEL.md §3, §4, §5.1; regole: R-02, R-04, R-05, R-06, R-07, R-60,
-- R-68

-- ---------------------------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------------------------
create type public.stato_account as enum ('attivo', 'sospeso');
create type public.ruolo_utente as enum ('moderatore', 'amministratore');
create type public.tipo_consenso as enum ('termini', 'privacy');

-- ---------------------------------------------------------------------------------------------
-- Trigger comune per aggiornato_il
-- ---------------------------------------------------------------------------------------------
create or replace function private.imposta_aggiornato_il()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aggiornato_il := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- profili: dati visibili ad altri, senza informazioni sull'età (R-05)
-- ---------------------------------------------------------------------------------------------
create table public.profili (
  -- Vincolo differito: il trigger di registrazione crea il profilo prima della riga di
  -- auth.users (before insert), il controllo avviene alla fine della transazione.
  id                uuid primary key
                    references auth.users (id) on delete cascade deferrable initially deferred,
  username          extensions.citext not null unique
                    constraint profili_username_formato
                    check (username::text ~ '^[a-z0-9_.]{3,20}$'),
  nome_visualizzato text not null
                    constraint profili_nome_lunghezza
                    check (char_length(btrim(nome_visualizzato)) between 1 and 40
                           and nome_visualizzato = btrim(nome_visualizzato)),
  avatar_path       text,
  stato_account     public.stato_account not null default 'attivo',
  creato_il         timestamptz not null default now(),
  aggiornato_il     timestamptz not null default now()
);
comment on table public.profili is
  'Dati pubblici minimi dell''utente; nessun dato sull''età (R-05). Creati dal trigger di registrazione.';

alter table public.profili enable row level security;

-- Nessun accesso anonimo (R-07); gli utenti leggono e modificano solo le colonne previste.
revoke all on public.profili from anon, authenticated;
grant select on public.profili to authenticated;
grant update (username, nome_visualizzato, avatar_path) on public.profili to authenticated;

create trigger profili_aggiornato_il
  before update on public.profili
  for each row execute function private.imposta_aggiornato_il();

-- ---------------------------------------------------------------------------------------------
-- profili_privati: dati visibili solo al titolare (R-05)
-- ---------------------------------------------------------------------------------------------
create table public.profili_privati (
  utente_id                 uuid primary key references public.profili (id) on delete cascade,
  data_nascita              date not null
                            constraint profili_privati_data_plausibile
                            check (data_nascita > date '1900-01-01'),
  checkin_abilitato         boolean not null default false,
  partecipazioni_visibili   boolean not null default true,
  notifiche_push_abilitate  boolean not null default false,
  onboarding_completato_il  timestamptz,
  creato_il                 timestamptz not null default now(),
  aggiornato_il             timestamptz not null default now()
);
comment on table public.profili_privati is
  'Dati privati del titolare: data di nascita immutabile (R-02) e impostazioni protettive di default (R-30, R-67).';

alter table public.profili_privati enable row level security;

revoke all on public.profili_privati from anon, authenticated;
grant select on public.profili_privati to authenticated;
-- La data di nascita non è tra le colonne modificabili (R-02).
grant update (checkin_abilitato, partecipazioni_visibili, notifiche_push_abilitate,
              onboarding_completato_il)
  on public.profili_privati to authenticated;

create trigger profili_privati_aggiornato_il
  before update on public.profili_privati
  for each row execute function private.imposta_aggiornato_il();

-- ---------------------------------------------------------------------------------------------
-- ruoli_utente: moderatori e amministratori, gestiti solo con service_role
-- ---------------------------------------------------------------------------------------------
create table public.ruoli_utente (
  utente_id    uuid not null references public.profili (id) on delete cascade,
  ruolo        public.ruolo_utente not null,
  assegnato_il timestamptz not null default now(),
  primary key (utente_id, ruolo)
);
comment on table public.ruoli_utente is
  'Ruoli di moderazione; assegnati solo con service_role dalla console di amministrazione.';

alter table public.ruoli_utente enable row level security;

revoke all on public.ruoli_utente from anon, authenticated;
grant select on public.ruoli_utente to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Funzioni di supporto alle policy (DATA_MODEL.md §4)
-- ---------------------------------------------------------------------------------------------

-- Anni compiuti oggi nel fuso Europe/Rome (R-04). Null se l'utente non esiste.
create or replace function private.eta_di(utente uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select extract(year from age((now() at time zone 'Europe/Rome')::date, p.data_nascita))::integer
  from public.profili_privati p
  where p.utente_id = utente;
$$;

-- Un utente senza età nota è trattato come minorenne: è l'ipotesi che protegge di più.
create or replace function private.e_minorenne(utente uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.eta_di(utente) < 18, true);
$$;

create or replace function private.stessa_fascia(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.e_minorenne(a) = private.e_minorenne(b);
$$;

-- Visibilità di un profilo (R-10, R-13, R-17). Finché non esistono amicizie, blocchi e gruppi
-- (iterazione 3 e seguenti) un profilo è visibile solo al titolare; la funzione viene estesa
-- con `create or replace` dalla migrazione che introduce quelle tabelle.
create or replace function private.puo_vedere_profilo(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = auth.uid();
$$;

-- Moderatori e amministratori solo con l'autenticazione a due fattori (R-06).
create or replace function private.e_moderatore()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.ruoli_utente r
       where r.utente_id = auth.uid()
         and r.ruolo in ('moderatore', 'amministratore')
     );
$$;

create or replace function private.e_amministratore()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.ruoli_utente r
       where r.utente_id = auth.uid()
         and r.ruolo = 'amministratore'
     );
$$;

revoke all on function private.eta_di(uuid) from public;
revoke all on function private.e_minorenne(uuid) from public;
revoke all on function private.stessa_fascia(uuid, uuid) from public;
revoke all on function private.puo_vedere_profilo(uuid) from public;
revoke all on function private.e_moderatore() from public;
revoke all on function private.e_amministratore() from public;
grant execute on function private.eta_di(uuid) to authenticated;
grant execute on function private.e_minorenne(uuid) to authenticated;
grant execute on function private.stessa_fascia(uuid, uuid) to authenticated;
grant execute on function private.puo_vedere_profilo(uuid) to authenticated;
grant execute on function private.e_moderatore() to authenticated;
grant execute on function private.e_amministratore() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Policy
-- ---------------------------------------------------------------------------------------------

-- R-10, R-13, R-17
create policy "profili: visibili a chi può vedere il profilo"
  on public.profili for select to authenticated
  using ((select private.puo_vedere_profilo(id)));

create policy "profili: il titolare modifica il proprio profilo"
  on public.profili for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- R-05
create policy "profili_privati: solo il titolare li legge"
  on public.profili_privati for select to authenticated
  using (utente_id = (select auth.uid()));

-- R-02: la data di nascita è esclusa dai permessi di colonna
create policy "profili_privati: il titolare modifica le proprie impostazioni"
  on public.profili_privati for update to authenticated
  using (utente_id = (select auth.uid()))
  with check (utente_id = (select auth.uid()));

create policy "ruoli_utente: il titolare vede i propri ruoli"
  on public.ruoli_utente for select to authenticated
  using (utente_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- R-02: la data di nascita non cambia, se non con la correzione degli amministratori
-- ---------------------------------------------------------------------------------------------
-- La sola eccezione è la RPC public.correggi_data_nascita (DATA_MODEL.md §5.10), che arriva
-- con azioni_moderazione e imposta per la propria transazione noxa.correzione_data_nascita.
-- Codice di errore NX007 (apps/web/src/lib/errori.ts).
create or replace function private.blocca_modifica_data_nascita()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.data_nascita is distinct from old.data_nascita
     and coalesce(current_setting('noxa.correzione_data_nascita', true), '') <> 'consentita' then
    raise exception using
      errcode = 'NX007',
      message = 'La data di nascita non è modificabile (R-02).';
  end if;
  return new;
end;
$$;

create trigger profili_privati_blocca_data_nascita
  before update on public.profili_privati
  for each row execute function private.blocca_modifica_data_nascita();
