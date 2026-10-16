-- Migrazione: amicizie, codici invito, blocchi, segnalazioni e registro della moderazione
-- Documentazione: docs/DATA_MODEL.md §3, §4, §5.2, §5.10, §8; regole: R-10, R-11, R-12, R-13,
-- R-14, R-17, R-50, R-53, R-69
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX008 troppe richieste di amicizia nelle ultime 24 ore (R-14)
--   NX009 troppe richieste in attesa (R-14)
--   NX010 troppi codici invito nelle ultime 24 ore (R-14)
--   NX011 codice invito non valido
--   NX012 codice invito scaduto
--   NX013 codice invito già usato
--   NX014 amicizia o richiesta già esistente
--   NX015 troppe segnalazioni nelle ultime 24 ore
--   NX016 persona non disponibile

-- ---------------------------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------------------------
create type public.stato_amicizia as enum ('in_attesa', 'accettata');
create type public.canale_amicizia as enum ('ricerca', 'codice_invito');
create type public.tipo_oggetto_segnalabile as enum (
  'profilo', 'evento', 'caricamento_flyer', 'gruppo', 'serata_gruppo', 'immagine_locale'
);
create type public.motivo_segnalazione as enum (
  'contenuto_inappropriato', 'molestie', 'adescamento_o_rischio_minore', 'spam',
  'evento_falso', 'eta_errata', 'alcol_a_minori', 'altro'
);
create type public.stato_segnalazione as enum ('aperta', 'in_lavorazione', 'chiusa');
create type public.azione_moderazione as enum (
  'nessuna_violazione', 'rimuovi_contenuto', 'modifica_evento', 'approva_flyer',
  'rifiuta_flyer', 'sospendi_account', 'riattiva_account', 'correggi_data_nascita',
  'escalation_autorita', 'accesso_segnalazione'
);

-- ---------------------------------------------------------------------------------------------
-- blocchi (R-17)
-- ---------------------------------------------------------------------------------------------
create table public.blocchi (
  bloccante_id uuid not null references public.profili (id) on delete cascade,
  bloccato_id  uuid not null references public.profili (id) on delete cascade,
  creato_il    timestamptz not null default now(),
  primary key (bloccante_id, bloccato_id),
  constraint blocchi_non_se_stessi check (bloccante_id <> bloccato_id)
);
comment on table public.blocchi is
  'Blocchi tra utenti: nascondono tutto in entrambe le direzioni, invisibili al bloccato (R-17).';
create index blocchi_bloccato_idx on public.blocchi (bloccato_id);

alter table public.blocchi enable row level security;
revoke all on public.blocchi from anon, authenticated;
grant select, delete on public.blocchi to authenticated;
grant insert (bloccante_id, bloccato_id) on public.blocchi to authenticated;

-- R-17: il bloccato non vede il blocco
create policy "blocchi: il bloccante vede i propri blocchi"
  on public.blocchi for select to authenticated
  using (bloccante_id = (select auth.uid()));

-- R-17
create policy "blocchi: ognuno blocca per sé"
  on public.blocchi for insert to authenticated
  with check (bloccante_id = (select auth.uid()));

create policy "blocchi: il bloccante sblocca"
  on public.blocchi for delete to authenticated
  using (bloccante_id = (select auth.uid()));

create or replace function private.c_e_blocco(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocchi bl
    where (bl.bloccante_id = a and bl.bloccato_id = b)
       or (bl.bloccante_id = b and bl.bloccato_id = a)
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- amicizie (R-10, R-11, R-12, R-14)
-- ---------------------------------------------------------------------------------------------
create table public.amicizie (
  id              uuid primary key default gen_random_uuid(),
  richiedente_id  uuid not null references public.profili (id) on delete cascade,
  destinatario_id uuid not null references public.profili (id) on delete cascade,
  stato           public.stato_amicizia not null default 'in_attesa',
  canale          public.canale_amicizia not null,
  creata_il       timestamptz not null default now(),
  accettata_il    timestamptz,
  constraint amicizie_non_se_stessi check (richiedente_id <> destinatario_id),
  constraint amicizie_accettazione check ((stato = 'accettata') = (accettata_il is not null))
);
comment on table public.amicizie is
  'Amicizie e richieste: nascono solo con l''accettazione del destinatario (R-11); tra fasce diverse solo con il codice invito (R-12).';
create unique index amicizie_coppia_idx
  on public.amicizie (least(richiedente_id, destinatario_id), greatest(richiedente_id, destinatario_id));
create index amicizie_destinatario_idx on public.amicizie (destinatario_id);
create index amicizie_richiedente_idx on public.amicizie (richiedente_id, creata_il);

alter table public.amicizie enable row level security;
revoke all on public.amicizie from anon, authenticated;
grant select, delete on public.amicizie to authenticated;
grant insert (richiedente_id, destinatario_id, canale) on public.amicizie to authenticated;
grant update (stato) on public.amicizie to authenticated;

create or replace function private.sono_amici(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.amicizie f
    where f.stato = 'accettata'
      and least(f.richiedente_id, f.destinatario_id) = least(a, b)
      and greatest(f.richiedente_id, f.destinatario_id) = greatest(a, b)
  ) and not private.c_e_blocco(a, b);
$$;

create or replace function private.c_e_richiesta(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.amicizie f
    where f.stato = 'in_attesa'
      and least(f.richiedente_id, f.destinatario_id) = least(a, b)
      and greatest(f.richiedente_id, f.destinatario_id) = greatest(a, b)
  );
$$;

create policy "amicizie: le due persone vedono la propria amicizia o richiesta"
  on public.amicizie for select to authenticated
  using ((select auth.uid()) in (richiedente_id, destinatario_id));

-- R-10, R-11, R-12, R-17: dalla ricerca solo nella stessa fascia e senza blocchi; il canale
-- codice_invito passa solo dalla RPC usa_codice_invito.
create policy "amicizie: richiesta dalla ricerca nella stessa fascia"
  on public.amicizie for insert to authenticated
  with check (
    richiedente_id = (select auth.uid())
    and canale = 'ricerca'
    and stato = 'in_attesa'
    and (select private.stessa_fascia(richiedente_id, destinatario_id))
    and not (select private.c_e_blocco(richiedente_id, destinatario_id))
  );

-- R-11: solo il destinatario accetta
create policy "amicizie: il destinatario accetta"
  on public.amicizie for update to authenticated
  using (destinatario_id = (select auth.uid()) and stato = 'in_attesa')
  with check (destinatario_id = (select auth.uid()) and stato = 'accettata');

create policy "amicizie: ognuna delle due persone rifiuta, annulla o rimuove"
  on public.amicizie for delete to authenticated
  using ((select auth.uid()) in (richiedente_id, destinatario_id));

-- R-14 e disponibilità del destinatario
create or replace function private.limita_richieste_amicizia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profili p
    where p.id = new.destinatario_id and p.stato_account = 'attivo'
  ) or private.c_e_blocco(new.richiedente_id, new.destinatario_id) then
    raise exception using errcode = 'NX016', message = 'Persona non disponibile.';
  end if;
  if exists (
    select 1 from public.amicizie f
    where least(f.richiedente_id, f.destinatario_id) = least(new.richiedente_id, new.destinatario_id)
      and greatest(f.richiedente_id, f.destinatario_id) = greatest(new.richiedente_id, new.destinatario_id)
  ) then
    raise exception using errcode = 'NX014', message = 'Amicizia o richiesta già esistente.';
  end if;
  if (select count(*) from public.amicizie f
      where f.richiedente_id = new.richiedente_id
        and f.creata_il > now() - interval '24 hours') >= 20 then
    raise exception using errcode = 'NX008', message = 'Troppe richieste nelle ultime 24 ore (R-14).';
  end if;
  if (select count(*) from public.amicizie f
      where f.richiedente_id = new.richiedente_id and f.stato = 'in_attesa') >= 50 then
    raise exception using errcode = 'NX009', message = 'Troppe richieste in attesa (R-14).';
  end if;
  return new;
end;
$$;

create trigger amicizie_limita_richieste
  before insert on public.amicizie
  for each row execute function private.limita_richieste_amicizia();

create or replace function private.imposta_accettata_il()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stato = 'accettata' and old.stato = 'in_attesa' then
    new.accettata_il := now();
  end if;
  return new;
end;
$$;

create trigger amicizie_accettata_il
  before update on public.amicizie
  for each row execute function private.imposta_accettata_il();

-- Il blocco toglie amicizie e richieste tra le due persone (R-17).
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
  return new;
end;
$$;

create trigger blocchi_applica_blocco
  after insert on public.blocchi
  for each row execute function private.applica_blocco();

-- ---------------------------------------------------------------------------------------------
-- Visibilità dei profili (R-10, R-13, R-17): estende la versione dell'iterazione 2.
-- La condizione sui gruppi arriva con membri_gruppo (iterazione 7).
-- ---------------------------------------------------------------------------------------------
create or replace function private.puo_vedere_profilo(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target = auth.uid()
    or (
      not private.c_e_blocco(auth.uid(), target)
      and exists (
        select 1 from public.profili p where p.id = target and p.stato_account = 'attivo'
      )
      and (private.sono_amici(auth.uid(), target) or private.c_e_richiesta(auth.uid(), target))
    );
$$;

-- ---------------------------------------------------------------------------------------------
-- codici_invito (R-12, R-14)
-- ---------------------------------------------------------------------------------------------
create table public.codici_invito (
  codice    text primary key
            constraint codici_invito_formato check (codice ~ '^[A-HJKMNP-Z2-9]{10}$'),
  creato_da uuid not null references public.profili (id) on delete cascade,
  creato_il timestamptz not null default now(),
  scade_il  timestamptz not null default now() + interval '15 minutes',
  usato_da  uuid references public.profili (id) on delete set null,
  usato_il  timestamptz
);
comment on table public.codici_invito is
  'Codici invito monouso di 15 minuti, unico canale di amicizia tra fasce diverse (R-12).';
create index codici_invito_creato_da_idx on public.codici_invito (creato_da, creato_il);

alter table public.codici_invito enable row level security;
revoke all on public.codici_invito from anon, authenticated;
grant select on public.codici_invito to authenticated;

create policy "codici_invito: il titolare vede i propri codici"
  on public.codici_invito for select to authenticated
  using (creato_da = (select auth.uid()));

-- Codice senza caratteri ambigui (0, O, 1, I, L), dalla sorgente casuale crittografica.
create or replace function private.nuovo_codice_invito()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  byte_casuali bytea := extensions.gen_random_bytes(10);
  risultato text := '';
begin
  for i in 0..9 loop
    risultato := risultato || substr(alfabeto, (get_byte(byte_casuali, i) % length(alfabeto)) + 1, 1);
  end loop;
  return risultato;
end;
$$;

-- R-12, R-14: al massimo 10 codici ogni 24 ore
create or replace function public.crea_codice_invito()
returns table (codice text, scade_il timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  nuovo text;
begin
  if utente is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  if (select count(*) from public.codici_invito c
      where c.creato_da = utente and c.creato_il > now() - interval '24 hours') >= 10 then
    raise exception using errcode = 'NX010', message = 'Troppi codici nelle ultime 24 ore (R-14).';
  end if;
  loop
    nuovo := private.nuovo_codice_invito();
    exit when not exists (select 1 from public.codici_invito c where c.codice = nuovo);
  end loop;
  return query
    insert into public.codici_invito as c (codice, creato_da)
    values (nuovo, utente)
    returning c.codice, c.scade_il;
end;
$$;

-- Normalizza un codice scritto a mano: maiuscole, senza trattini e spazi.
create or replace function private.normalizza_codice(testo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(testo, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Anteprima del titolare di un codice: identità solo se il codice è utilizzabile o se siete
-- già in contatto; un blocco o un account sospeso danno lo stesso esito di un codice non
-- valido. avviso_fasce = chi chiama è minorenne e il titolare maggiorenne (R-12).
create or replace function public.anteprima_codice_invito(codice text)
returns table (
  stato text,
  titolare_id uuid,
  username text,
  nome_visualizzato text,
  avviso_fasce boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  riga public.codici_invito;
  titolare public.profili;
begin
  if utente is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  select * into riga from public.codici_invito c
  where c.codice = private.normalizza_codice(anteprima_codice_invito.codice);
  if riga.codice is null or riga.creato_da = utente then
    return query select 'non_valido', null::uuid, null::text, null::text, false;
    return;
  end if;
  select * into titolare from public.profili p where p.id = riga.creato_da;
  if titolare.stato_account <> 'attivo' or private.c_e_blocco(utente, riga.creato_da) then
    return query select 'non_valido', null::uuid, null::text, null::text, false;
    return;
  end if;
  if private.sono_amici(utente, riga.creato_da) then
    return query select 'gia_amici', titolare.id, titolare.username::text,
                        titolare.nome_visualizzato, false;
    return;
  end if;
  if private.c_e_richiesta(utente, riga.creato_da) then
    return query select 'in_attesa', titolare.id, titolare.username::text,
                        titolare.nome_visualizzato, false;
    return;
  end if;
  if riga.usato_il is not null then
    return query select 'usato', null::uuid, null::text, null::text, false;
    return;
  end if;
  if riga.scade_il <= now() then
    return query select 'scaduto', null::uuid, null::text, null::text, false;
    return;
  end if;
  return query select 'valido', titolare.id, titolare.username::text, titolare.nome_visualizzato,
                      private.e_minorenne(utente) and not private.e_minorenne(titolare.id);
end;
$$;

-- R-12: usa il codice e crea la richiesta verso il titolare, che deve accettarla.
create or replace function public.usa_codice_invito(codice text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  riga public.codici_invito;
  nuova uuid;
begin
  if utente is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  select * into riga from public.codici_invito c
  where c.codice = private.normalizza_codice(usa_codice_invito.codice)
  for update;
  if riga.codice is null or riga.creato_da = utente
     or private.c_e_blocco(utente, riga.creato_da)
     or not exists (select 1 from public.profili p
                    where p.id = riga.creato_da and p.stato_account = 'attivo') then
    raise exception using errcode = 'NX011', message = 'Codice non valido.';
  end if;
  if private.sono_amici(utente, riga.creato_da) or private.c_e_richiesta(utente, riga.creato_da) then
    raise exception using errcode = 'NX014', message = 'Amicizia o richiesta già esistente.';
  end if;
  if riga.usato_il is not null then
    raise exception using errcode = 'NX013', message = 'Codice già usato.';
  end if;
  if riga.scade_il <= now() then
    raise exception using errcode = 'NX012', message = 'Codice scaduto.';
  end if;

  update public.codici_invito c set usato_da = utente, usato_il = now()
  where c.codice = riga.codice;
  insert into public.amicizie (richiedente_id, destinatario_id, canale)
  values (utente, riga.creato_da, 'codice_invito')
  returning id into nuova;
  return nuova;
end;
$$;

-- R-12: avviso al destinatario minorenne di una richiesta da una persona maggiorenne.
create or replace function public.avviso_richiesta(amicizia uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.e_minorenne(f.destinatario_id) and not private.e_minorenne(f.richiedente_id)
    from public.amicizie f
    where f.id = amicizia
      and f.destinatario_id = auth.uid()
      and f.stato = 'in_attesa'
  ), false);
$$;

-- ---------------------------------------------------------------------------------------------
-- Ricerca degli utenti (R-10)
-- ---------------------------------------------------------------------------------------------
create index profili_username_prefisso_idx on public.profili ((username::text) text_pattern_ops);

-- Per prefisso di username, almeno 3 caratteri, al massimo 20 risultati, solo nella fascia di
-- chi cerca, senza bloccati in nessuna direzione né account sospesi. Restituisce solo
-- identificativo (per inviare la richiesta), username, nome e il rapporto con chi cerca.
create or replace function public.cerca_utenti(testo text)
returns table (id uuid, username text, nome_visualizzato text, relazione text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  prefisso text := lower(btrim(ltrim(btrim(coalesce(testo, '')), '@')));
begin
  if utente is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  if char_length(prefisso) < 3 or prefisso !~ '^[a-z0-9_.]+$' then
    return;
  end if;
  return query
    select p.id, p.username::text, p.nome_visualizzato,
           case
             when private.sono_amici(utente, p.id) then 'amici'
             when exists (select 1 from public.amicizie f
                          where f.richiedente_id = utente and f.destinatario_id = p.id) then 'inviata'
             when exists (select 1 from public.amicizie f
                          where f.richiedente_id = p.id and f.destinatario_id = utente) then 'ricevuta'
             else 'nessuna'
           end
    from public.profili p
    where (p.username::text) like replace(replace(prefisso, '\', '\\'), '_', '\_') || '%' escape '\'
      and p.id <> utente
      and p.stato_account = 'attivo'
      and private.stessa_fascia(utente, p.id)
      and not private.c_e_blocco(utente, p.id)
    order by p.username
    limit 20;
end;
$$;

-- Persone bloccate da chi chiama, con username e nome: il profilo di un bloccato non è più
-- visibile dalla tabella (R-17), ma chi blocca deve poterlo riconoscere per sbloccarlo (F-42).
create or replace function public.miei_bloccati()
returns table (id uuid, username text, nome_visualizzato text, bloccato_il timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username::text, p.nome_visualizzato, b.creato_il
  from public.blocchi b
  join public.profili p on p.id = b.bloccato_id
  where b.bloccante_id = auth.uid()
  order by b.creato_il desc;
$$;

-- ---------------------------------------------------------------------------------------------
-- segnalazioni (R-50, R-53)
-- ---------------------------------------------------------------------------------------------
create table public.segnalazioni (
  id                   uuid primary key default gen_random_uuid(),
  segnalante_id        uuid references public.profili (id) on delete set null,
  tipo_oggetto         public.tipo_oggetto_segnalabile not null,
  oggetto_id           uuid not null,
  motivo               public.motivo_segnalazione not null,
  dettagli             text constraint segnalazioni_dettagli_lunghezza check (char_length(dettagli) <= 1000),
  priorita             smallint not null default 3 check (priorita between 1 and 3),
  stato                public.stato_segnalazione not null default 'aperta',
  gestita_da           uuid references public.profili (id) on delete set null,
  conservazione_legale boolean not null default false,
  creata_il            timestamptz not null default now(),
  chiusa_il            timestamptz
);
comment on table public.segnalazioni is
  'Segnalazioni dei contenuti e dei profili (R-50); priorità calcolata secondo R-53.';
create index segnalazioni_segnalante_idx on public.segnalazioni (segnalante_id, creata_il);
create index segnalazioni_coda_idx on public.segnalazioni (stato, priorita, creata_il);

alter table public.segnalazioni enable row level security;
revoke all on public.segnalazioni from anon, authenticated;
grant select on public.segnalazioni to authenticated;
grant insert (segnalante_id, tipo_oggetto, oggetto_id, motivo, dettagli)
  on public.segnalazioni to authenticated;
grant update (stato, gestita_da, conservazione_legale, chiusa_il)
  on public.segnalazioni to authenticated;

create policy "segnalazioni: chi segnala vede le proprie, i moderatori tutte"
  on public.segnalazioni for select to authenticated
  using (segnalante_id = (select auth.uid()) or (select private.e_moderatore()));

-- R-50: si segnala un profilo che si può vedere o che si è bloccato. Gli altri tipi di
-- oggetto si aggiungono con le loro tabelle (eventi, flyer, gruppi).
create policy "segnalazioni: si segnala un profilo visibile"
  on public.segnalazioni for insert to authenticated
  with check (
    segnalante_id = (select auth.uid())
    and tipo_oggetto = 'profilo'
    and oggetto_id <> (select auth.uid())
    and (
      (select private.puo_vedere_profilo(oggetto_id))
      or exists (select 1 from public.blocchi b
                 where b.bloccante_id = (select auth.uid()) and b.bloccato_id = oggetto_id)
    )
  );

create policy "segnalazioni: i moderatori le gestiscono"
  on public.segnalazioni for update to authenticated
  using ((select private.e_moderatore()))
  with check ((select private.e_moderatore()));

-- R-53: priorità 1 per adescamento o rischio per un minorenne, 2 se coinvolge un minorenne,
-- 3 per le altre. Al massimo 20 segnalazioni ogni 24 ore per utente.
create or replace function private.prepara_segnalazione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.segnalazioni s
      where s.segnalante_id = new.segnalante_id
        and s.creata_il > now() - interval '24 hours') >= 20 then
    raise exception using errcode = 'NX015', message = 'Troppe segnalazioni nelle ultime 24 ore.';
  end if;
  new.priorita := case
    when new.motivo = 'adescamento_o_rischio_minore' then 1
    when private.e_minorenne(new.segnalante_id)
      or (new.tipo_oggetto = 'profilo' and private.e_minorenne(new.oggetto_id)) then 2
    else 3
  end;
  return new;
end;
$$;

create trigger segnalazioni_prepara
  before insert on public.segnalazioni
  for each row execute function private.prepara_segnalazione();

-- ---------------------------------------------------------------------------------------------
-- azioni_moderazione: registro di sola aggiunta (DSA art. 17, R-53, R-69)
-- ---------------------------------------------------------------------------------------------
create table public.azioni_moderazione (
  id                   uuid primary key default gen_random_uuid(),
  moderatore_id        uuid references public.profili (id) on delete set null,
  segnalazione_id      uuid references public.segnalazioni (id) on delete set null,
  tipo_oggetto         public.tipo_oggetto_segnalabile not null,
  oggetto_id           uuid not null,
  azione               public.azione_moderazione not null,
  motivazione          text,
  conservazione_legale boolean not null default false,
  creata_il            timestamptz not null default now(),
  constraint azioni_moderazione_motivazione check (
    azione = 'accesso_segnalazione' or char_length(btrim(coalesce(motivazione, ''))) > 0
  )
);
comment on table public.azioni_moderazione is
  'Decisioni e accessi dei moderatori, solo aggiunte (DSA art. 17, R-53, R-69).';
create index azioni_moderazione_segnalazione_idx on public.azioni_moderazione (segnalazione_id);

alter table public.azioni_moderazione enable row level security;
revoke all on public.azioni_moderazione from anon, authenticated;
grant select on public.azioni_moderazione to authenticated;
grant insert (moderatore_id, segnalazione_id, tipo_oggetto, oggetto_id, azione, motivazione,
              conservazione_legale)
  on public.azioni_moderazione to authenticated;

-- R-06, R-69
create policy "azioni_moderazione: i moderatori le leggono"
  on public.azioni_moderazione for select to authenticated
  using ((select private.e_moderatore()));

create policy "azioni_moderazione: un moderatore registra le proprie azioni"
  on public.azioni_moderazione for insert to authenticated
  with check ((select private.e_moderatore()) and moderatore_id = (select auth.uid()));

-- Le proprie segnalazioni con lo stato e, quando c'è, l'ultima decisione motivata (DSA art.
-- 17). Il profilo segnalato è indicato con l'username, che chi segnala conosceva già.
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
         case when s.tipo_oggetto = 'profilo'
              then (select '@' || p.username::text from public.profili p where p.id = s.oggetto_id)
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
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function private.c_e_blocco(uuid, uuid) from public;
revoke all on function private.sono_amici(uuid, uuid) from public;
revoke all on function private.c_e_richiesta(uuid, uuid) from public;
revoke all on function private.limita_richieste_amicizia() from public;
revoke all on function private.imposta_accettata_il() from public;
revoke all on function private.applica_blocco() from public;
revoke all on function private.nuovo_codice_invito() from public;
revoke all on function private.normalizza_codice(text) from public;
revoke all on function private.prepara_segnalazione() from public;
grant execute on function private.c_e_blocco(uuid, uuid) to authenticated;
grant execute on function private.sono_amici(uuid, uuid) to authenticated;
grant execute on function private.c_e_richiesta(uuid, uuid) to authenticated;

revoke all on function public.crea_codice_invito() from public, anon;
revoke all on function public.anteprima_codice_invito(text) from public, anon;
revoke all on function public.usa_codice_invito(text) from public, anon;
revoke all on function public.avviso_richiesta(uuid) from public, anon;
revoke all on function public.cerca_utenti(text) from public, anon;
revoke all on function public.miei_bloccati() from public, anon;
revoke all on function public.mie_segnalazioni() from public, anon;
grant execute on function public.crea_codice_invito() to authenticated;
grant execute on function public.anteprima_codice_invito(text) to authenticated;
grant execute on function public.usa_codice_invito(text) to authenticated;
grant execute on function public.avviso_richiesta(uuid) to authenticated;
grant execute on function public.cerca_utenti(text) to authenticated;
grant execute on function public.miei_bloccati() to authenticated;
grant execute on function public.mie_segnalazioni() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Conservazione dei codici invito: 24 ore dalla scadenza (SAFETY_PRIVACY.md §10)
-- ---------------------------------------------------------------------------------------------
create or replace function private.elimina_codici_invito_scaduti()
returns integer
language sql
security definer
set search_path = ''
as $$
  with eliminati as (
    delete from public.codici_invito c
    where c.scade_il < now() - interval '24 hours'
    returning 1
  )
  select count(*)::integer from eliminati;
$$;
revoke all on function private.elimina_codici_invito_scaduti() from public, anon, authenticated;

select cron.schedule(
  'elimina_codici_invito_scaduti',
  '23 * * * *',
  $$select private.elimina_codici_invito_scaduti()$$
);
