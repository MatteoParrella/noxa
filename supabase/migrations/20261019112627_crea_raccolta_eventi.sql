-- Migrazione: raccolta automatica degli eventi (fonti, esecuzioni, grezzi, coda dei job,
-- candidati locali), protezioni delle modifiche dei moderatori, accodamento e conservazione
-- Documentazione: docs/DATA_MODEL.md §3, §4, §5.3, §5.7, §8; docs/EVENT_INGESTION.md §2, §3,
-- §6, §7, §8; ADR-0003, ADR-0008, ADR-0018; regole: R-06, R-21, R-22, R-23, R-56, R-69

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------------------------
create type public.tipo_fonte as enum ('sito_locale', 'instagram', 'resident_advisor', 'xceed', 'dice');
create type public.stato_conformita as enum ('da_verificare', 'consentita', 'vietata');
create type public.stato_grezzo as enum (
  'nuovo', 'normalizzato', 'unito', 'in_revisione_dedup', 'scartato', 'errore'
);
create type public.tipo_job as enum (
  'esegui_fonte', 'analizza_flyer', 'deduplica_grezzo', 'copia_immagine_flyer', 'pulizia_flyer'
);
create type public.stato_job as enum ('in_coda', 'in_esecuzione', 'completato', 'fallito');

-- ---------------------------------------------------------------------------------------------
-- Nome normalizzato dei locali (EVENT_INGESTION.md §6.1): minuscole, senza accenti né
-- punteggiatura. Lo calcola il database, non chi scrive.
-- ---------------------------------------------------------------------------------------------
create or replace function private.normalizza_nome(testo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(lower(extensions.unaccent('extensions.unaccent', coalesce(testo, ''))),
                   '[^a-z0-9]+', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

create or replace function private.imposta_nome_normalizzato()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nome_normalizzato := private.normalizza_nome(new.nome);
  return new;
end;
$$;

create trigger locali_nome_normalizzato
  before insert or update of nome on public.locali
  for each row execute function private.imposta_nome_normalizzato();

-- R-56: i dati della foto si cambiano solo con le RPC salva_foto_locale e rimuovi_foto_locale,
-- che registrano l'azione; il nome normalizzato lo scrive il trigger.
revoke insert, update on public.locali from authenticated;
grant insert (nome, indirizzo, comune, provincia, posizione, osm_id, google_place_id, sito_web,
              instagram_username, attivo)
  on public.locali to authenticated;
grant update (nome, indirizzo, comune, provincia, posizione, osm_id, google_place_id, sito_web,
              instagram_username, attivo)
  on public.locali to authenticated;

-- ---------------------------------------------------------------------------------------------
-- fonti (ADR-0008, EVENT_INGESTION.md §2)
-- ---------------------------------------------------------------------------------------------
create table public.fonti (
  id                              uuid primary key default gen_random_uuid(),
  locale_id                       uuid not null references public.locali (id),
  tipo                            public.tipo_fonte not null,
  -- URL della pagina letta; per Instagram l'username senza @.
  url                             text not null,
  adattatore                      text constraint fonti_adattatore check (adattatore ~ '^[a-z0-9_]{3,60}$'),
  frequenza_minuti                integer not null default 360,
  pagine_massime                  smallint not null default 10
                                  constraint fonti_pagine_massime check (pagine_massime between 1 and 50),
  stato_conformita                public.stato_conformita not null default 'da_verificare',
  robots_esito                    text constraint fonti_robots_esito check (
                                    robots_esito in ('consentito', 'vietato', 'non_applicabile')),
  termini_url                     text constraint fonti_termini_url check (termini_url ~ '^https?://\S+$'),
  termini_letti_il                date,
  note_conformita                 text constraint fonti_note_conformita check (char_length(note_conformita) <= 2000),
  verificata_il                   timestamptz,
  verificata_da                   uuid references public.profili (id) on delete set null,
  attiva                          boolean not null default false,
  ultima_esecuzione_il            timestamptz,
  ultimo_esito                    jsonb,
  errori_consecutivi              integer not null default 0 constraint fonti_errori check (errori_consecutivi >= 0),
  esecuzioni_senza_eventi         integer not null default 0 constraint fonti_senza_eventi check (esecuzioni_senza_eventi >= 0),
  ultimo_errore                   text constraint fonti_ultimo_errore check (char_length(ultimo_errore) <= 500),
  disattivata_automaticamente_il  timestamptz,
  creato_il                       timestamptz not null default now(),
  aggiornato_il                   timestamptz not null default now(),
  -- Dominio della fonte: un solo job alla volta per dominio (coda_job.chiave_concorrenza).
  dominio                         text generated always as (
                                    case when tipo = 'instagram' then 'graph.facebook.com'
                                         else lower(substring(url from '^https?://([^/:?#]+)')) end
                                  ) stored,
  constraint fonti_url check (
    (tipo = 'instagram' and url ~ '^[A-Za-z0-9_.]{1,30}$')
    or (tipo <> 'instagram' and url ~ '^https?://[^/\s]+\S*$')
  ),
  -- EVENT_INGESTION.md §2.4: ogni 6 ore o meno spesso, Instagram ogni 12 ore.
  constraint fonti_frequenza check (
    frequenza_minuti <= 10080
    and frequenza_minuti >= case when tipo = 'instagram' then 720 else 360 end
  ),
  -- ADR-0008: "consentita" solo dopo la verifica scritta di robots.txt e dei termini d'uso;
  -- Instagram solo con l'API ufficiale; gli aggregatori restano vietati senza accordo (D-05).
  constraint fonti_conformita_verificata check (
    stato_conformita <> 'consentita'
    or (tipo in ('sito_locale', 'instagram')
        and verificata_il is not null
        and termini_url is not null
        and termini_letti_il is not null
        and robots_esito = case when tipo = 'instagram' then 'non_applicabile' else 'consentito' end)
  ),
  -- ADR-0008: si attiva solo una fonte consentita, con un adattatore.
  constraint fonti_attiva_consentita check (
    not attiva or (stato_conformita = 'consentita' and adattatore is not null)
  )
);
comment on table public.fonti is
  'Fonti degli eventi di ogni locale; si leggono solo se consentite e attive (ADR-0008).';
create unique index fonti_tipo_url_idx on public.fonti (tipo, lower(url));
create index fonti_locale_idx on public.fonti (locale_id);
create index fonti_da_eseguire_idx on public.fonti (ultima_esecuzione_il) where attiva;

alter table public.fonti enable row level security;
revoke all on public.fonti from anon, authenticated;
grant select on public.fonti to authenticated;
grant insert (locale_id, tipo, url, adattatore, frequenza_minuti, pagine_massime,
              stato_conformita, robots_esito, termini_url, termini_letti_il, note_conformita,
              attiva)
  on public.fonti to authenticated;
grant update (locale_id, tipo, url, adattatore, frequenza_minuti, pagine_massime,
              stato_conformita, robots_esito, termini_url, termini_letti_il, note_conformita,
              attiva)
  on public.fonti to authenticated;
grant select on public.fonti to noxa_worker;
grant update (ultima_esecuzione_il, ultimo_esito, errori_consecutivi, esecuzioni_senza_eventi,
              ultimo_errore, disattivata_automaticamente_il, attiva)
  on public.fonti to noxa_worker;

-- R-06, R-69: le fonti le vedono e le gestiscono solo i moderatori con due fattori.
create policy "fonti: i moderatori le vedono"
  on public.fonti for select to authenticated
  using ((select private.e_moderatore()));

create policy "fonti: i moderatori le creano"
  on public.fonti for insert to authenticated
  with check ((select private.e_moderatore()));

create policy "fonti: i moderatori le modificano"
  on public.fonti for update to authenticated
  using ((select private.e_moderatore()))
  with check ((select private.e_moderatore()));

create policy "fonti: il worker le legge"
  on public.fonti for select to noxa_worker
  using (true);

-- Il worker registra l'esito; il trigger fonti_prepara gli vieta di attivare (ADR-0008).
create policy "fonti: il worker registra l'esito"
  on public.fonti for update to noxa_worker
  using (true)
  with check (true);

-- ADR-0008: chi verifica la conformità e quando; una fonte non consentita si spegne; il worker
-- può solo disattivare; una riattivazione azzera il conteggio degli errori.
create or replace function private.prepara_fonte()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_user = 'noxa_worker' then
    if new.attiva and not old.attiva then
      raise exception using
        errcode = 'NX019',
        message = 'Il worker non può attivare una fonte: lo fa solo un moderatore (ADR-0008).';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' or new.stato_conformita is distinct from old.stato_conformita then
    if new.stato_conformita = 'da_verificare' then
      new.verificata_il := null;
      new.verificata_da := null;
    else
      new.verificata_il := now();
      new.verificata_da := auth.uid();
    end if;
  end if;
  if new.stato_conformita <> 'consentita' then
    new.attiva := false;
  end if;
  if tg_op = 'UPDATE' and new.attiva and not old.attiva then
    new.errori_consecutivi := 0;
    new.esecuzioni_senza_eventi := 0;
    new.disattivata_automaticamente_il := null;
  end if;
  return new;
end;
$$;

create trigger fonti_prepara
  before insert or update on public.fonti
  for each row execute function private.prepara_fonte();

create trigger fonti_aggiornato_il
  before update on public.fonti
  for each row execute function private.imposta_aggiornato_il();

-- ---------------------------------------------------------------------------------------------
-- esecuzioni_fonte: storico delle esecuzioni (EVENT_INGESTION.md §8)
-- ---------------------------------------------------------------------------------------------
create table public.esecuzioni_fonte (
  id                bigint generated always as identity primary key,
  fonte_id          uuid not null references public.fonti (id) on delete cascade,
  -- Esecuzione chiesta con "Esegui ora" su una fonte non attiva (prova, skill add-event-source).
  prova             boolean not null default false,
  iniziata_il       timestamptz not null,
  durata_ms         integer not null constraint esecuzioni_fonte_durata check (durata_ms >= 0),
  pagine_lette      integer not null default 0,
  eventi_letti      integer not null default 0,
  eventi_nuovi      integer not null default 0,
  eventi_uniti      integer not null default 0,
  eventi_in_revisione integer not null default 0,
  eventi_scartati   integer not null default 0,
  codice_errore     text constraint esecuzioni_fonte_codice check (codice_errore ~ '^[A-Z0-9_]{2,40}$'),
  messaggio_errore  text constraint esecuzioni_fonte_messaggio check (char_length(messaggio_errore) <= 500),
  constraint esecuzioni_fonte_conteggi check (
    pagine_lette >= 0 and eventi_letti >= 0 and eventi_nuovi >= 0 and eventi_uniti >= 0
    and eventi_in_revisione >= 0 and eventi_scartati >= 0
  )
);
comment on table public.esecuzioni_fonte is
  'Esito di ogni esecuzione di una fonte: conteggi ed errori, senza dati personali.';
create index esecuzioni_fonte_fonte_idx on public.esecuzioni_fonte (fonte_id, iniziata_il desc);

alter table public.esecuzioni_fonte enable row level security;
revoke all on public.esecuzioni_fonte from anon, authenticated;
grant select on public.esecuzioni_fonte to authenticated;
grant select, insert on public.esecuzioni_fonte to noxa_worker;

create policy "esecuzioni_fonte: i moderatori le vedono"
  on public.esecuzioni_fonte for select to authenticated
  using ((select private.e_moderatore()));

create policy "esecuzioni_fonte: il worker le legge"
  on public.esecuzioni_fonte for select to noxa_worker
  using (true);

create policy "esecuzioni_fonte: il worker le registra"
  on public.esecuzioni_fonte for insert to noxa_worker
  with check (true);

-- ---------------------------------------------------------------------------------------------
-- eventi_fonti: chiave esterna verso fonti e conferme per i possibili annullamenti (§7)
-- ---------------------------------------------------------------------------------------------
alter table public.eventi_fonti
  add constraint eventi_fonti_fonte_id_fkey foreign key (fonte_id) references public.fonti (id);
alter table public.eventi_fonti
  add column ultima_conferma_il  timestamptz not null default now(),
  add column assenze_consecutive smallint not null default 0
    constraint eventi_fonti_assenze check (assenze_consecutive >= 0);
create index eventi_fonti_fonte_idx on public.eventi_fonti (fonte_id, id_esterno);

grant select (ultima_conferma_il, assenze_consecutive) on public.eventi_fonti to authenticated;
grant update (url_originale, id_esterno, raccolto_il, ultima_conferma_il, assenze_consecutive)
  on public.eventi_fonti to noxa_worker;

create policy "eventi_fonti: il worker registra le conferme"
  on public.eventi_fonti for update to noxa_worker
  using (true)
  with check (true);

-- I moderatori correggono i generi di un evento (area di moderazione, F-40).
grant insert, delete on public.eventi_generi to authenticated;

create policy "eventi_generi: i moderatori li aggiungono"
  on public.eventi_generi for insert to authenticated
  with check ((select private.e_moderatore()));

create policy "eventi_generi: i moderatori li tolgono"
  on public.eventi_generi for delete to authenticated
  using ((select private.e_moderatore()));

-- ---------------------------------------------------------------------------------------------
-- eventi_grezzi: area di transito della pipeline (EVENT_INGESTION.md §3)
-- ---------------------------------------------------------------------------------------------
create table public.eventi_grezzi (
  id                   uuid primary key default gen_random_uuid(),
  fonte_id             uuid references public.fonti (id) on delete cascade,
  -- La chiave esterna verso caricamenti_flyer arriva con quella tabella (iterazione 6).
  caricamento_flyer_id uuid,
  payload              jsonb not null,
  hash_contenuto       text not null constraint eventi_grezzi_hash check (hash_contenuto ~ '^[0-9a-f]{64}$'),
  stato                public.stato_grezzo not null default 'nuovo',
  evento_id            uuid references public.eventi (id) on delete set null,
  evento_candidato_id  uuid references public.eventi (id) on delete set null,
  punteggio_dedup      numeric(5, 2) constraint eventi_grezzi_punteggio check (punteggio_dedup between 0 and 100),
  nota_revisione       text constraint eventi_grezzi_nota check (char_length(nota_revisione) <= 200),
  errore               text constraint eventi_grezzi_errore check (char_length(errore) <= 500),
  -- Decisione del moderatore sul possibile duplicato (RPC decidi_duplicato), applicata dal
  -- worker con il job deduplica_grezzo.
  decisione            text constraint eventi_grezzi_decisione check (decisione in ('stesso_evento', 'distinti')),
  deciso_da            uuid references public.profili (id) on delete set null,
  deciso_il            timestamptz,
  creato_il            timestamptz not null default now(),
  constraint eventi_grezzi_origine check (num_nonnulls(fonte_id, caricamento_flyer_id) = 1),
  constraint eventi_grezzi_revisione check (
    stato <> 'in_revisione_dedup' or evento_candidato_id is not null or nota_revisione is not null
  )
);
comment on table public.eventi_grezzi is
  'Eventi appena raccolti, prima della deduplicazione; conservati 30 giorni.';
-- §3.2: la stessa pagina riletta senza modifiche non produce lavoro.
create unique index eventi_grezzi_hash_idx on public.eventi_grezzi (fonte_id, hash_contenuto)
  where fonte_id is not null;
create index eventi_grezzi_revisione_idx on public.eventi_grezzi (creato_il)
  where stato = 'in_revisione_dedup' and decisione is null;
create index eventi_grezzi_evento_idx on public.eventi_grezzi (evento_id);
create index eventi_grezzi_creato_idx on public.eventi_grezzi (creato_il);

alter table public.eventi_grezzi enable row level security;
revoke all on public.eventi_grezzi from anon, authenticated;
grant select on public.eventi_grezzi to authenticated;
grant select, insert, update on public.eventi_grezzi to noxa_worker;

-- R-06: la coda dei duplicati la vedono solo i moderatori; le decisioni passano dalla RPC
-- decidi_duplicato, che le registra.
create policy "eventi_grezzi: i moderatori li vedono"
  on public.eventi_grezzi for select to authenticated
  using ((select private.e_moderatore()));

create policy "eventi_grezzi: il worker li legge"
  on public.eventi_grezzi for select to noxa_worker
  using (true);

create policy "eventi_grezzi: il worker li registra"
  on public.eventi_grezzi for insert to noxa_worker
  with check (true);

create policy "eventi_grezzi: il worker li aggiorna"
  on public.eventi_grezzi for update to noxa_worker
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------------------------
-- candidati_locali: locali scoperti da OpenStreetMap e Google Places, da verificare a mano
-- (EVENT_INGESTION.md §2.1). Da Google si conserva solo il place_id (ADR-0008).
-- ---------------------------------------------------------------------------------------------
create table public.candidati_locali (
  id                   uuid primary key default gen_random_uuid(),
  origine              text not null constraint candidati_locali_origine check (origine in ('osm', 'google')),
  osm_id               text unique,
  google_place_id      text unique,
  nome                 text constraint candidati_locali_nome check (char_length(nome) between 1 and 120),
  indirizzo            text constraint candidati_locali_indirizzo check (char_length(indirizzo) <= 200),
  comune               text constraint candidati_locali_comune check (char_length(comune) <= 80),
  provincia            text constraint candidati_locali_provincia check (provincia in ('MI', 'MB')),
  posizione            extensions.geography(Point, 4326),
  sito_web             text constraint candidati_locali_sito check (sito_web ~ '^https?://\S+$'),
  possibile_doppione_id uuid references public.locali (id) on delete set null,
  stato                text not null default 'da_verificare'
                       constraint candidati_locali_stato check (stato in ('da_verificare', 'creato', 'unito', 'scartato')),
  locale_id            uuid references public.locali (id) on delete set null,
  deciso_da            uuid references public.profili (id) on delete set null,
  deciso_il            timestamptz,
  creato_il            timestamptz not null default now(),
  constraint candidati_locali_identificativo check (
    (origine = 'osm' and osm_id is not null and google_place_id is null)
    -- ADR-0008: da Google solo l'identificativo, nessun altro dato.
    or (origine = 'google' and google_place_id is not null and osm_id is null and nome is null
        and indirizzo is null and comune is null and provincia is null and posizione is null
        and sito_web is null)
  ),
  constraint candidati_locali_decisione check ((stato = 'da_verificare') = (deciso_il is null))
);
comment on table public.candidati_locali is
  'Candidati locali da OSM e Google Places (solo place_id), verificati a mano dai moderatori.';
create index candidati_locali_da_verificare_idx on public.candidati_locali (creato_il)
  where stato = 'da_verificare';

alter table public.candidati_locali enable row level security;
revoke all on public.candidati_locali from anon, authenticated;
grant select on public.candidati_locali to authenticated;
grant select, insert on public.candidati_locali to noxa_worker;

create policy "candidati_locali: i moderatori li vedono"
  on public.candidati_locali for select to authenticated
  using ((select private.e_moderatore()));

create policy "candidati_locali: il worker li legge"
  on public.candidati_locali for select to noxa_worker
  using (true);

create policy "candidati_locali: il worker li importa"
  on public.candidati_locali for insert to noxa_worker
  with check (stato = 'da_verificare');

-- ---------------------------------------------------------------------------------------------
-- coda_job: coda del worker su Postgres (ADR-0003). pg_cron, i trigger e le RPC inseriscono,
-- il worker preleva con for update skip locked.
-- ---------------------------------------------------------------------------------------------
create table public.coda_job (
  id                 bigint generated always as identity primary key,
  tipo               public.tipo_job not null,
  payload            jsonb not null default '{}'::jsonb,
  chiave_idempotenza text not null constraint coda_job_chiave check (char_length(chiave_idempotenza) between 1 and 200),
  chiave_concorrenza text constraint coda_job_concorrenza check (char_length(chiave_concorrenza) <= 200),
  stato              public.stato_job not null default 'in_coda',
  tentativi          smallint not null default 0 constraint coda_job_tentativi check (tentativi between 0 and 5),
  esegui_dopo        timestamptz not null default now(),
  bloccato_fino      timestamptz,
  errore             text constraint coda_job_errore check (char_length(errore) <= 500),
  creato_il          timestamptz not null default now(),
  completato_il      timestamptz
);
comment on table public.coda_job is 'Job del worker; nessun accesso per gli utenti dell''app.';
-- Un solo job non concluso per chiave di idempotenza.
create unique index coda_job_idempotenza_idx on public.coda_job (chiave_idempotenza)
  where stato in ('in_coda', 'in_esecuzione');
-- Al massimo un job in esecuzione per dominio (EVENT_INGESTION.md §2.4).
create unique index coda_job_concorrenza_idx on public.coda_job (chiave_concorrenza)
  where stato = 'in_esecuzione' and chiave_concorrenza is not null;
create index coda_job_prelievo_idx on public.coda_job (esegui_dopo, id)
  where stato in ('in_coda', 'in_esecuzione');
create index coda_job_conclusi_idx on public.coda_job (completato_il)
  where stato in ('completato', 'fallito');

alter table public.coda_job enable row level security;
revoke all on public.coda_job from anon, authenticated;
grant select, insert, update on public.coda_job to noxa_worker;

create policy "coda_job: il worker li legge"
  on public.coda_job for select to noxa_worker
  using (true);

create policy "coda_job: il worker li inserisce"
  on public.coda_job for insert to noxa_worker
  with check (true);

create policy "coda_job: il worker li aggiorna"
  on public.coda_job for update to noxa_worker
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------------------------
-- Modifiche dei moderatori agli eventi (R-22, R-23): le operazioni delicate (abbassare un'età
-- dichiarata, togliere i riferimenti all'alcol, cambiare lo stato) passano solo dalle RPC con
-- motivazione, che impostano per la propria transazione noxa.operazione_moderazione.
-- ---------------------------------------------------------------------------------------------
create or replace function private.proteggi_eta_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  abbassa boolean := old.eta_minima_dichiarata
                     and (not new.eta_minima_dichiarata or new.eta_minima < old.eta_minima);
  toglie_alcol boolean := old.riferimenti_alcol and not new.riferimenti_alcol;
  da_rpc boolean := coalesce(current_setting('noxa.operazione_moderazione', true), '') = 'consentita';
begin
  if private.e_moderatore() then
    if (abbassa or toglie_alcol or new.stato is distinct from old.stato) and not da_rpc then
      raise exception using
        errcode = 'NX020',
        message = 'Età, alcol e stato di un evento si cambiano solo con una motivazione registrata.';
    end if;
    return new;
  end if;
  if abbassa then
    raise exception using
      errcode = 'NX017',
      message = 'L''età minima dichiarata di un evento la abbassa solo un moderatore.';
  end if;
  if toglie_alcol then
    raise exception using
      errcode = 'NX018',
      message = 'I riferimenti all''alcol di un evento li toglie solo un moderatore.';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Registro automatico delle modifiche dei moderatori a locali, fonti ed eventi: nessuna
-- azione silenziosa. Le RPC che registrano da sé l'azione impostano noxa.azione_registrata.
-- ---------------------------------------------------------------------------------------------
create or replace function private.registra_modifica_moderatore()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  vecchio jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  nuovo jsonb := to_jsonb(new);
  campi text;
  descrizione text;
  tipo public.tipo_oggetto_segnalabile;
  azione public.azione_moderazione;
begin
  if auth.uid() is null or not private.e_moderatore()
     or coalesce(current_setting('noxa.azione_registrata', true), '') = 'si' then
    return null;
  end if;

  select string_agg(n.key, ', ' order by n.key) into campi
  from jsonb_each(nuovo) n
  where n.key not in ('id', 'creato_il', 'aggiornato_il', 'nome_normalizzato', 'data_serata',
                      'dominio', 'verificata_il', 'verificata_da', 'immagine_approvata_da',
                      'immagine_approvata_il')
    and n.value is distinct from vecchio -> n.key;
  if tg_op = 'UPDATE' and campi is null then
    return null;
  end if;

  case tg_table_name
    when 'locali' then
      tipo := 'locale';
      azione := case when tg_op = 'INSERT' then 'crea_locale' else 'modifica_locale' end;
    when 'fonti' then
      tipo := 'fonte';
      azione := case when tg_op = 'INSERT' then 'crea_fonte' else 'modifica_fonte' end;
    else
      tipo := 'evento';
      azione := 'modifica_evento';
  end case;

  if tg_op = 'INSERT' then
    descrizione := 'Creato dall''area di moderazione.';
  else
    descrizione := 'Campi modificati: ' || campi || '.';
  end if;
  if tg_table_name = 'fonti' then
    if tg_op = 'INSERT' or nuovo ->> 'stato_conformita' is distinct from vecchio ->> 'stato_conformita' then
      descrizione := descrizione || ' Conformità: ' || (nuovo ->> 'stato_conformita') || '.';
    end if;
    if tg_op = 'UPDATE' and nuovo -> 'attiva' is distinct from vecchio -> 'attiva' then
      descrizione := descrizione
        || case when (nuovo ->> 'attiva')::boolean then ' Fonte attivata.' else ' Fonte disattivata.' end;
    end if;
  end if;

  insert into public.azioni_moderazione (moderatore_id, tipo_oggetto, oggetto_id, azione, motivazione)
  values (auth.uid(), tipo, (nuovo ->> 'id')::uuid, azione, descrizione);
  return null;
end;
$$;

create trigger locali_registra_moderatore
  after insert or update on public.locali
  for each row execute function private.registra_modifica_moderatore();

create trigger fonti_registra_moderatore
  after insert or update on public.fonti
  for each row execute function private.registra_modifica_moderatore();

create trigger eventi_registra_moderatore
  after update on public.eventi
  for each row execute function private.registra_modifica_moderatore();

create index azioni_moderazione_oggetto_idx on public.azioni_moderazione (oggetto_id, creata_il desc);

-- ---------------------------------------------------------------------------------------------
-- Accodamento delle fonti da eseguire (pg_cron ogni 5 minuti, ADR-0003). Dopo un errore
-- l'intervallo raddoppia fino a 8 volte la frequenza: è il backoff delle fonti (§2.4).
-- ---------------------------------------------------------------------------------------------
create or replace function private.accoda_fonti_da_eseguire()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  accodati integer;
begin
  insert into public.coda_job (tipo, payload, chiave_idempotenza, chiave_concorrenza)
  select 'esegui_fonte',
         jsonb_build_object('fonte_id', f.id, 'prova', false),
         'esegui_fonte:' || f.id,
         'dominio:' || f.dominio
  from public.fonti f
  where f.attiva
    and (f.ultima_esecuzione_il is null
         or f.ultima_esecuzione_il
            + make_interval(mins => f.frequenza_minuti * (1 << least(f.errori_consecutivi, 3)))
            <= now())
  on conflict (chiave_idempotenza) where stato in ('in_coda', 'in_esecuzione') do nothing;
  get diagnostics accodati = row_count;
  return accodati;
end;
$$;

select cron.schedule(
  'accoda-fonti-da-eseguire',
  '*/5 * * * *',
  $$select private.accoda_fonti_da_eseguire()$$
);

-- ---------------------------------------------------------------------------------------------
-- Conservazione dei dati della raccolta (SAFETY_PRIVACY.md §10). L'iterazione 8 estende la
-- funzione con le altre scadenze.
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
end;
$$;

select cron.schedule(
  'applica-conservazione',
  '41 * * * *',
  $$select private.applica_conservazione()$$
);

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function private.normalizza_nome(text) from public;
revoke all on function private.imposta_nome_normalizzato() from public;
revoke all on function private.prepara_fonte() from public;
revoke all on function private.proteggi_eta_evento() from public;
revoke all on function private.registra_modifica_moderatore() from public;
revoke all on function private.accoda_fonti_da_eseguire() from public;
revoke all on function private.applica_conservazione() from public;
grant execute on function private.normalizza_nome(text) to authenticated;
