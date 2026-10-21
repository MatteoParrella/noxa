-- Migrazione: moderazione dei flyer, delle segnalazioni e dei reclami; occultamento automatico
-- in attesa della revisione (D-15); escalation alle autorità; notifiche degli esiti
-- Documentazione: docs/DATA_MODEL.md §4, §5.2 (segnalazioni, azioni_moderazione, reclami),
-- §5.3 (caricamenti_flyer), §5.10, §8; docs/SAFETY_PRIVACY.md §11; ADR-0022;
-- regole: R-06, R-21, R-22, R-23, R-50, R-51, R-52, R-53, R-55, R-69; DSA art. 17 e 20
--
-- Tutte le RPC dei moderatori sono security definer e verificano come prima istruzione che
-- chi chiama sia un moderatore con due fattori (R-06). Nessuna restituisce chi ha segnalato o
-- chi ha caricato un flyer (R-69).
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX028 reclamo fuori termine: si presenta entro 6 mesi dalla decisione
--   NX029 reclamo già presentato per questa decisione
--   NX030 decisione non reclamabile da chi chiama
--   NX031 un reclamo lo decide un moderatore diverso da chi ha preso la decisione
--   NX032 parola di conferma dell'escalation errata (R-55)
--   NX033 segnalazione presa in carico da un altro moderatore
--   NX034 conferme del moderatore mancanti per pubblicare un flyer (R-51)

-- ---------------------------------------------------------------------------------------------
-- Supporto
-- ---------------------------------------------------------------------------------------------
-- R-53: scadenza della gestione. Priorità 1 entro 4 ore se ricevuta tra le 08:00 e le 02:00
-- (ora di Roma), entro le 10:00 se ricevuta di notte; priorità 2 entro 24 ore; 3 entro 72.
create or replace function private.scadenza_segnalazione(priorita smallint, creata timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when priorita = 1 and (creata at time zone 'Europe/Rome')::time >= time '02:00'
                      and (creata at time zone 'Europe/Rome')::time < time '08:00'
      then (((creata at time zone 'Europe/Rome')::date + time '10:00') at time zone 'Europe/Rome')
    when priorita = 1 then creata + interval '4 hours'
    when priorita = 2 then creata + interval '24 hours'
    else creata + interval '72 hours'
  end;
$$;

-- Registra una decisione o un accesso e restituisce la riga del registro. Imposta per la
-- transazione noxa.azione_registrata, così il registro automatico non la duplica.
create or replace function private.registra_decisione(
  tipo public.tipo_oggetto_segnalabile,
  oggetto uuid,
  azione public.azione_moderazione,
  motivazione text,
  segnalazione uuid default null,
  conservazione boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuova uuid;
begin
  perform set_config('noxa.azione_registrata', 'si', true);
  insert into public.azioni_moderazione
    (moderatore_id, segnalazione_id, tipo_oggetto, oggetto_id, azione, motivazione,
     conservazione_legale)
  values (auth.uid(), segnalazione, tipo, oggetto, azione, motivazione, conservazione)
  returning id into nuova;
  return nuova;
end;
$$;

-- Notifica di un esito di moderazione (R-53): testo del moderatore o di sistema, mai di altri
-- utenti.
create or replace function private.notifica_esito(utente uuid, esito text, dati jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.crea_notifica(utente, 'esito_moderazione',
                                jsonb_build_object('esito', esito) || dati);
end;
$$;

-- Immagine da nascondere per un oggetto segnalato (D-15, R-55): la foto per i profili, la
-- copertina del flyer per gli eventi, la foto per i locali.
create or replace function private.bersaglio_occultamento(
  tipo public.tipo_oggetto_segnalabile,
  oggetto uuid
)
returns public.tipo_oggetto_segnalabile
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when tipo in ('profilo', 'foto_profilo')
         and exists (select 1 from public.profili p where p.id = oggetto and p.avatar_path is not null)
      then 'foto_profilo'::public.tipo_oggetto_segnalabile
    when tipo = 'evento'
         and exists (select 1 from public.eventi e where e.id = oggetto and e.immagine_path is not null)
      then 'evento'::public.tipo_oggetto_segnalabile
    when tipo = 'immagine_locale'
         and exists (select 1 from public.locali l where l.id = oggetto and l.immagine_path is not null)
      then 'immagine_locale'::public.tipo_oggetto_segnalabile
  end;
$$;

-- Persone a cui spetta la motivazione di una decisione e il reclamo (DSA art. 17 e 20): chi ha
-- segnalato e chi subisce la decisione (titolare del profilo o del flyer). Le escalation non
-- si comunicano all'account coinvolto (R-55).
create or replace function private.interessati_azione(azione uuid)
returns table (utente uuid, ruolo text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.segnalante_id, 'segnalante'
  from public.azioni_moderazione a
  join public.segnalazioni s on s.id = a.segnalazione_id
  where a.id = interessati_azione.azione and s.segnalante_id is not null
  union
  select a.oggetto_id, 'interessato'
  from public.azioni_moderazione a
  where a.id = interessati_azione.azione
    and a.tipo_oggetto in ('profilo', 'foto_profilo')
    and a.azione in ('rimuovi_contenuto', 'sospendi_account')
  union
  select c.utente_id, 'interessato'
  from public.azioni_moderazione a
  join public.caricamenti_flyer c on c.id = a.oggetto_id
  where a.id = interessati_azione.azione
    and a.tipo_oggetto = 'caricamento_flyer'
    and a.azione in ('approva_flyer', 'unisci_flyer', 'rifiuta_flyer')
    and c.utente_id is not null;
$$;

-- Descrizione dell'oggetto per chi lo conosceva già: username del profilo, titolo dell'evento,
-- nome del locale.
create or replace function private.descrivi_oggetto(tipo public.tipo_oggetto_segnalabile, oggetto uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when tipo in ('profilo', 'foto_profilo')
      then (select '@' || p.username::text from public.profili p where p.id = oggetto)
    when tipo = 'evento' then (select e.titolo from public.eventi e where e.id = oggetto)
    when tipo = 'immagine_locale' then (select l.nome from public.locali l where l.id = oggetto)
  end;
$$;

-- ---------------------------------------------------------------------------------------------
-- segnalazioni: foto profilo segnalabile (R-50, R-52) e priorità (R-53)
-- ---------------------------------------------------------------------------------------------
drop policy "segnalazioni: si segnala un profilo, un evento o una foto visibile" on public.segnalazioni;

-- R-50: si segnala un profilo che si può vedere o che si è bloccato, la sua foto se si vede,
-- un evento visibile o la foto di un locale visibile. Gruppi e serate con le loro tabelle.
create policy "segnalazioni: si segnala un profilo, una foto o un evento visibile"
  on public.segnalazioni for insert to authenticated
  with check (
    segnalante_id = (select auth.uid())
    and (
      (tipo_oggetto = 'profilo'
       and oggetto_id <> (select auth.uid())
       and ((select private.puo_vedere_profilo(oggetto_id))
            or exists (select 1 from public.blocchi b
                       where b.bloccante_id = (select auth.uid()) and b.bloccato_id = oggetto_id)))
      or (tipo_oggetto = 'foto_profilo'
          and oggetto_id <> (select auth.uid())
          and exists (select 1 from public.profili p
                      where p.id = oggetto_id and p.avatar_path is not null))
      or (tipo_oggetto = 'evento'
          and exists (select 1 from public.eventi e where e.id = oggetto_id))
      or (tipo_oggetto = 'immagine_locale'
          and exists (select 1 from public.locali l
                      where l.id = oggetto_id and l.immagine_path is not null))
    )
  );

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
      or (new.tipo_oggetto in ('profilo', 'foto_profilo') and private.e_minorenne(new.oggetto_id)) then 2
    else 3
  end;
  return new;
end;
$$;

-- D-15, ADR-0022: una segnalazione per rischio a un minorenne da un account con almeno 7
-- giorni nasconde subito l'immagine segnalata (foto profilo, copertina, foto del locale), in
-- attesa del moderatore entro i tempi di R-53. Al posto dell'immagine l'app mostra
-- un'immagine sostitutiva. Il mezzo automatico è dichiarato nella motivazione (DSA art. 17).
create or replace function private.occulta_in_attesa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  bersaglio public.tipo_oggetto_segnalabile;
  azione uuid;
begin
  if new.motivo <> 'adescamento_o_rischio_minore' or not exists (
    select 1 from public.profili p
    where p.id = new.segnalante_id and p.creato_il <= now() - interval '7 days'
  ) then
    return null;
  end if;
  bersaglio := private.bersaglio_occultamento(new.tipo_oggetto, new.oggetto_id);
  if bersaglio is null or private.e_occultato(bersaglio, new.oggetto_id) then
    return null;
  end if;
  insert into public.contenuti_occultati (tipo_oggetto, oggetto_id, segnalazione_id, automatico)
  values (bersaglio, new.oggetto_id, new.id, true);
  insert into public.azioni_moderazione (moderatore_id, segnalazione_id, tipo_oggetto, oggetto_id,
                                         azione, motivazione)
  values (null, new.id, bersaglio, new.oggetto_id, 'occulta_contenuto',
          'Nascosto in automatico in attesa del controllo di un moderatore (mezzo automatico, '
          || 'ADR-0022).')
  returning id into azione;
  if bersaglio = 'foto_profilo' then
    perform private.notifica_esito(
      new.oggetto_id, 'contenuto_nascosto',
      jsonb_build_object('azione_id', azione, 'tipo_oggetto', bersaglio,
                         'motivazione', 'La tua foto profilo è nascosta in attesa di un controllo. '
                                        || 'È una misura automatica: un moderatore la esamina al più presto.')
    );
  end if;
  return null;
end;
$$;

create trigger segnalazioni_occulta_in_attesa
  after insert on public.segnalazioni
  for each row execute function private.occulta_in_attesa();

-- ---------------------------------------------------------------------------------------------
-- reclami (DSA art. 20)
-- ---------------------------------------------------------------------------------------------
create table public.reclami (
  id                uuid primary key default gen_random_uuid(),
  azione_id         uuid not null references public.azioni_moderazione (id) on delete cascade,
  utente_id         uuid not null references public.profili (id) on delete cascade,
  testo             text not null
                    constraint reclami_testo check (char_length(btrim(testo)) between 1 and 1000),
  stato             public.stato_reclamo not null default 'inviato',
  esito             text constraint reclami_esito check (esito in ('confermata', 'cambiata')),
  motivazione_esito text constraint reclami_motivazione check (char_length(motivazione_esito) <= 500),
  preso_da          uuid references public.profili (id) on delete set null,
  deciso_da         uuid references public.profili (id) on delete set null,
  creato_il         timestamptz not null default now(),
  deciso_il         timestamptz,
  constraint reclami_uno_per_decisione unique (azione_id, utente_id),
  constraint reclami_decisione check (
    (stato = 'deciso') = (esito is not null and motivazione_esito is not null and deciso_il is not null)
  )
);
comment on table public.reclami is
  'Reclami sulle decisioni di moderazione (DSA art. 20), decisi da un altro moderatore.';
create index reclami_coda_idx on public.reclami (stato, creato_il);
create index reclami_utente_idx on public.reclami (utente_id);

alter table public.reclami enable row level security;
revoke all on public.reclami from anon, authenticated;
-- Chi ha presentato il reclamo vede stato ed esito, non chi lo ha deciso.
grant select (id, azione_id, utente_id, testo, stato, esito, motivazione_esito, creato_il, deciso_il)
  on public.reclami to authenticated;

create policy "reclami: chi lo presenta vede i propri"
  on public.reclami for select to authenticated
  using (utente_id = (select auth.uid()));

-- DSA art. 20: un reclamo per decisione, entro 6 mesi, da chi l'ha ricevuta.
create or replace function public.presenta_reclamo(azione uuid, testo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  chiamante uuid := auth.uid();
  a public.azioni_moderazione%rowtype;
  pulito text := btrim(coalesce(testo, ''));
  nuovo uuid;
begin
  if chiamante is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  if char_length(pulito) = 0 then
    raise exception using errcode = '22023', message = 'Scrivi perché non sei d''accordo.';
  end if;
  if char_length(pulito) > 1000 then
    raise exception using errcode = '22001', message = 'Il reclamo supera 1000 caratteri.';
  end if;
  select * into a from public.azioni_moderazione x where x.id = presenta_reclamo.azione;
  if a.id is null
     or a.azione not in ('nessuna_violazione', 'rimuovi_contenuto', 'modifica_evento',
                         'sospendi_account', 'rifiuta_flyer')
     or not exists (select 1 from private.interessati_azione(a.id) i where i.utente = chiamante) then
    raise exception using errcode = 'NX030', message = 'Questa decisione non si può reclamare.';
  end if;
  if a.creata_il <= now() - interval '6 months' then
    raise exception using errcode = 'NX028',
      message = 'Il reclamo si presenta entro 6 mesi dalla decisione.';
  end if;
  if exists (select 1 from public.reclami r where r.azione_id = a.id and r.utente_id = chiamante) then
    raise exception using errcode = 'NX029', message = 'Hai già presentato un reclamo su questa decisione.';
  end if;
  insert into public.reclami (azione_id, utente_id, testo)
  values (a.id, chiamante, pulito)
  returning id into nuovo;
  return nuovo;
end;
$$;

-- Decisione reclamabile da chi chiama: entro 6 mesi, senza un reclamo già presentato.
create or replace function private.reclamabile(azione uuid, utente uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.azioni_moderazione a
    where a.id = reclamabile.azione
      and a.azione in ('nessuna_violazione', 'rimuovi_contenuto', 'modifica_evento',
                       'sospendi_account', 'rifiuta_flyer')
      and a.creata_il > now() - interval '6 months'
      and exists (select 1 from private.interessati_azione(a.id) i where i.utente = reclamabile.utente)
      and not exists (select 1 from public.reclami r where r.azione_id = a.id and r.utente_id = reclamabile.utente)
  );
$$;

-- Le proprie segnalazioni con lo stato, la decisione motivata (DSA art. 17) e il reclamo. Di
-- un'escalation chi ha segnalato riceve solo un testo generico (R-55).
drop function public.mie_segnalazioni();
create or replace function public.mie_segnalazioni()
returns table (
  id uuid,
  tipo_oggetto public.tipo_oggetto_segnalabile,
  descrizione text,
  motivo public.motivo_segnalazione,
  stato public.stato_segnalazione,
  creata_il timestamptz,
  chiusa_il timestamptz,
  azione_id uuid,
  decisione_azione public.azione_moderazione,
  decisione text,
  decisa_il timestamptz,
  reclamabile boolean,
  reclamo_stato public.stato_reclamo,
  reclamo_esito text,
  reclamo_motivazione text
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.tipo_oggetto, private.descrivi_oggetto(s.tipo_oggetto, s.oggetto_id),
         s.motivo, s.stato, s.creata_il, s.chiusa_il,
         d.id, d.azione,
         case when d.azione = 'escalation_autorita'
              then 'Abbiamo preso provvedimenti secondo le regole della comunità.'
              else d.motivazione end,
         d.creata_il,
         coalesce(private.reclamabile(d.id, auth.uid()), false),
         r.stato, r.esito, r.motivazione_esito
  from public.segnalazioni s
  left join lateral (
    select a.id, a.azione, a.motivazione, a.creata_il
    from public.azioni_moderazione a
    where a.segnalazione_id = s.id
      and a.azione in ('nessuna_violazione', 'rimuovi_contenuto', 'modifica_evento',
                       'sospendi_account', 'escalation_autorita')
    order by a.creata_il desc
    limit 1
  ) d on true
  left join public.reclami r on r.azione_id = d.id and r.utente_id = auth.uid()
  where s.segnalante_id = auth.uid()
  order by s.creata_il desc;
$$;

-- ---------------------------------------------------------------------------------------------
-- caricamenti_flyer: esiti notificati a chi ha caricato e registrati (R-51, R-53)
-- ---------------------------------------------------------------------------------------------
-- Le decisioni dei moderatori passano da decidi_flyer, che le registra prima di cambiare lo
-- stato; quelle automatiche del worker (non è un flyer, unione a un evento già pubblicato) si
-- registrano qui con autore nullo ("Sistema"). Un'escalation non si comunica (R-55).
create or replace function private.esito_caricamento_flyer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ultima public.azioni_moderazione%rowtype;
begin
  if new.stato is not distinct from old.stato
     or new.stato not in ('approvato', 'unito', 'rifiutato') then
    return null;
  end if;
  if auth.uid() is null then
    insert into public.azioni_moderazione (moderatore_id, tipo_oggetto, oggetto_id, azione, motivazione)
    values (null, 'caricamento_flyer', new.id,
            case new.stato when 'unito' then 'unisci_flyer' else 'rifiuta_flyer' end::public.azione_moderazione,
            case new.stato
              when 'unito' then 'Unito in automatico a un evento già pubblicato da una fonte verificata.'
              else 'Decisione automatica: ' || new.motivo_rifiuto
            end);
  end if;
  select * into ultima from public.azioni_moderazione a
  where a.tipo_oggetto = 'caricamento_flyer' and a.oggetto_id = new.id
  order by a.creata_il desc, a.id desc
  limit 1;
  if ultima.azione = 'escalation_autorita' or new.utente_id is null then
    return null;
  end if;
  perform private.notifica_esito(
    new.utente_id,
    case new.stato when 'approvato' then 'flyer_pubblicato'
                   when 'unito' then 'flyer_unito'
                   else 'flyer_rifiutato' end,
    jsonb_build_object('azione_id', ultima.id, 'tipo_oggetto', 'caricamento_flyer',
                       'caricamento_id', new.id, 'evento_id', new.evento_id,
                       'motivazione', case when new.stato = 'rifiutato' then new.motivo_rifiuto end,
                       'automatica', ultima.moderatore_id is null)
  );
  return null;
end;
$$;

create trigger caricamenti_flyer_esito
  after update of stato on public.caricamenti_flyer
  for each row execute function private.esito_caricamento_flyer();

-- I propri flyer con l'ultima decisione e il reclamo.
create or replace function public.miei_flyer()
returns table (
  id uuid,
  stato public.stato_caricamento,
  storage_path text,
  evento_id uuid,
  motivo_rifiuto text,
  creato_il timestamptz,
  azione_id uuid,
  reclamabile boolean,
  reclamo_stato public.stato_reclamo,
  reclamo_esito text,
  reclamo_motivazione text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.stato, c.storage_path, c.evento_id, c.motivo_rifiuto, c.creato_il, d.id,
         coalesce(private.reclamabile(d.id, auth.uid()), false),
         r.stato, r.esito, r.motivazione_esito
  from public.caricamenti_flyer c
  left join lateral (
    select a.id from public.azioni_moderazione a
    where a.tipo_oggetto = 'caricamento_flyer' and a.oggetto_id = c.id
      and a.azione in ('approva_flyer', 'unisci_flyer', 'rifiuta_flyer')
    order by a.creata_il desc, a.id desc
    limit 1
  ) d on true
  left join public.reclami r on r.azione_id = d.id and r.utente_id = auth.uid()
  where c.utente_id = auth.uid()
  order by c.creato_il desc;
$$;

-- ---------------------------------------------------------------------------------------------
-- Contatori della navigazione laterale
-- ---------------------------------------------------------------------------------------------
drop function public.contatori_moderazione();
create or replace function public.contatori_moderazione()
returns table (
  duplicati integer,
  possibili_annullamenti integer,
  candidati_locali integer,
  flyer integer,
  segnalazioni integer,
  segnalazioni_urgenti integer,
  scadenza_urgente timestamptz,
  reclami integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  return query
  select
    (select count(*)::integer from public.eventi_grezzi g
     where g.stato = 'in_revisione_dedup' and g.decisione is null),
    (select count(*)::integer from public.eventi e
     where e.stato = 'pubblicato' and e.inizio > now() + interval '48 hours'
       and private.e_possibile_annullamento(e.id)),
    (select count(*)::integer from public.candidati_locali c where c.stato = 'da_verificare'),
    (select count(*)::integer from public.caricamenti_flyer c where c.stato in ('in_revisione', 'errore')),
    (select count(*)::integer from public.segnalazioni s where s.stato <> 'chiusa'),
    (select count(*)::integer from public.segnalazioni s where s.stato <> 'chiusa' and s.priorita = 1),
    (select min(private.scadenza_segnalazione(s.priorita, s.creata_il)) from public.segnalazioni s
     where s.stato <> 'chiusa' and s.priorita = 1),
    (select count(*)::integer from public.reclami r where r.stato <> 'deciso');
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Coda dei flyer (R-51, R-69)
-- ---------------------------------------------------------------------------------------------
create or replace function private.evento_json(evento uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'titolo', e.titolo,
    'locale_id', e.locale_id,
    'locale_nome', l.nome,
    'locale_comune', l.comune,
    'inizio', e.inizio,
    'fine', e.fine,
    'eta_minima', e.eta_minima,
    'eta_minima_dichiarata', e.eta_minima_dichiarata,
    'riferimenti_alcol', e.riferimenti_alcol,
    'generi', coalesce((select jsonb_agg(eg.genere_codice order by eg.genere_codice)
                        from public.eventi_generi eg where eg.evento_id = e.id), '[]'::jsonb),
    'artisti', to_jsonb(e.artisti),
    'prezzo_min_centesimi', e.prezzo_min_centesimi,
    'url_biglietti', e.url_biglietti,
    'stato', e.stato
  )
  from public.eventi e
  join public.locali l on l.id = e.locale_id
  where e.id = evento;
$$;

-- Caricamenti in revisione o non leggibili, prima quelli con contenuti sospetti, poi i più
-- vecchi. Nessun dato di chi li ha caricati (R-69).
create or replace function public.coda_flyer()
returns table (
  id uuid,
  stato public.stato_caricamento,
  creato_il timestamptz,
  storage_path text,
  risultato_estrazione jsonb,
  modello text,
  versione_prompt text,
  confidenza numeric,
  contenuto_sospetto boolean,
  nota_revisione text,
  evento jsonb,
  candidato jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  return query
  select c.id, c.stato, c.creato_il, c.storage_path, c.risultato_estrazione, c.modello,
         c.versione_prompt, c.confidenza, c.contenuto_sospetto, c.nota_revisione,
         private.evento_json(c.evento_id),
         case when c.evento_candidato_id is not null
              then private.evento_json(c.evento_candidato_id) end
  from public.caricamenti_flyer c
  where c.stato in ('in_revisione', 'errore')
  order by c.contenuto_sospetto desc, c.creato_il, c.id;
end;
$$;

-- Decisione su un flyer (R-51, EVENT_INGESTION.md §5 passo 6):
--   'approva': dati con titolo, locale_id, inizio, fine, eta_minima, eta_minima_dichiarata,
--     riferimenti_alcol (scelta esplicita, R-23), generi, artisti, prezzo_min_centesimi,
--     url_biglietti e le due conferme (confrontato, immagine_adatta); pubblica_immagine
--     accoda la copia dell'immagine come copertina. Sotto i 18 anni serve la motivazione.
--   'unisci': evento_esistente pubblicato; il flyer aggiunge solo la fonte.
--   'rifiuta': motivazione obbligatoria, mostrata a chi ha caricato.
create or replace function public.decidi_flyer(
  caricamento uuid,
  esito text,
  dati jsonb default '{}'::jsonb,
  motivazione text default null,
  evento_esistente uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.caricamenti_flyer%rowtype;
  evento uuid;
  testo text;
  eta smallint;
  dichiarata boolean;
  alcol boolean;
  generi text[];
begin
  perform private.richiedi_moderatore();
  select * into c from public.caricamenti_flyer x where x.id = caricamento for update;
  if c.id is null then
    raise exception using errcode = 'P0002', message = 'Flyer inesistente.';
  end if;
  if c.stato not in ('in_revisione', 'errore') then
    raise exception using errcode = 'NX025', message = 'Questo flyer è già stato deciso.';
  end if;
  perform set_config('noxa.operazione_moderazione', 'consentita', true);

  if esito = 'rifiuta' then
    testo := private.richiedi_motivazione(motivazione);
    perform private.registra_decisione('caricamento_flyer', c.id, 'rifiuta_flyer', testo);
    update public.eventi e set stato = 'rifiutato'
    where e.id = c.evento_id and e.stato = 'in_revisione';
    update public.caricamenti_flyer x set stato = 'rifiutato', motivo_rifiuto = testo
    where x.id = c.id;
    perform private.chiudi_operazione();
    return c.evento_id;
  end if;

  if esito = 'unisci' then
    if not exists (select 1 from public.eventi e
                   where e.id = evento_esistente and e.stato = 'pubblicato') then
      raise exception using errcode = '22023', message = 'Scegli un evento pubblicato a cui unirlo.';
    end if;
    testo := coalesce(nullif(btrim(motivazione), ''),
                      'Corrisponde a un evento già pubblicato: il flyer aggiunge solo la fonte.');
    perform private.registra_decisione('caricamento_flyer', c.id, 'unisci_flyer', testo);
    if c.evento_id is not null and c.evento_id <> evento_esistente then
      delete from public.eventi e
      where e.id = c.evento_id and e.stato = 'in_revisione'
        and not exists (select 1 from public.eventi_fonti ef
                        where ef.evento_id = e.id and ef.caricamento_flyer_id is distinct from c.id);
    end if;
    if not exists (select 1 from public.eventi_fonti ef
                   where ef.evento_id = evento_esistente and ef.caricamento_flyer_id = c.id) then
      insert into public.eventi_fonti (evento_id, caricamento_flyer_id, tipo_origine)
      values (evento_esistente, c.id, 'flyer');
    end if;
    update public.caricamenti_flyer x set stato = 'unito', evento_id = evento_esistente
    where x.id = c.id;
    perform private.chiudi_operazione();
    return evento_esistente;
  end if;

  if esito <> 'approva' then
    raise exception using errcode = '22023', message = 'Esito non previsto.';
  end if;
  if not coalesce((dati ->> 'confrontato')::boolean, false)
     or not coalesce((dati ->> 'immagine_adatta')::boolean, false) then
    raise exception using errcode = 'NX034',
      message = 'Conferma di aver confrontato i campi con il flyer e che non contiene contenuti inadatti.';
  end if;
  if dati ->> 'riferimenti_alcol' is null or dati ->> 'eta_minima_dichiarata' is null
     or nullif(btrim(dati ->> 'titolo'), '') is null or dati ->> 'locale_id' is null
     or dati ->> 'inizio' is null then
    raise exception using errcode = '22023',
      message = 'Servono titolo, locale, inizio, età e riferimenti all''alcol.';
  end if;
  alcol := (dati ->> 'riferimenti_alcol')::boolean;
  dichiarata := (dati ->> 'eta_minima_dichiarata')::boolean;
  -- R-21: un'età non dichiarata è 18.
  eta := case when dichiarata then (dati ->> 'eta_minima')::smallint else 18 end;
  if eta is null then
    raise exception using errcode = '22023', message = 'Indica l''età minima dichiarata.';
  end if;
  -- Scendere sotto i 18 anni richiede la motivazione, come nella scheda evento.
  testo := case when eta < 18 then private.richiedi_motivazione(motivazione)
                else coalesce(nullif(btrim(motivazione), ''), 'Flyer controllato e pubblicato.') end;
  select coalesce(array_agg(g), '{}') into generi
  from jsonb_array_elements_text(coalesce(dati -> 'generi', '[]'::jsonb)) g;

  perform private.registra_decisione('caricamento_flyer', c.id, 'approva_flyer', testo);
  if c.evento_id is null then
    insert into public.eventi (locale_id, titolo, inizio, fine, eta_minima, eta_minima_dichiarata,
                               riferimenti_alcol, artisti, prezzo_min_centesimi, url_biglietti, stato)
    values ((dati ->> 'locale_id')::uuid, btrim(dati ->> 'titolo'), (dati ->> 'inizio')::timestamptz,
            (dati ->> 'fine')::timestamptz, eta, dichiarata, alcol,
            coalesce((select array_agg(a) from jsonb_array_elements_text(coalesce(dati -> 'artisti', '[]'::jsonb)) a), '{}'),
            (dati ->> 'prezzo_min_centesimi')::integer, nullif(btrim(dati ->> 'url_biglietti'), ''),
            'pubblicato')
    returning id into evento;
    insert into public.eventi_fonti (evento_id, caricamento_flyer_id, tipo_origine)
    values (evento, c.id, 'flyer');
  else
    evento := c.evento_id;
    update public.eventi e
    set locale_id = (dati ->> 'locale_id')::uuid,
        titolo = btrim(dati ->> 'titolo'),
        inizio = (dati ->> 'inizio')::timestamptz,
        fine = (dati ->> 'fine')::timestamptz,
        eta_minima = eta,
        eta_minima_dichiarata = dichiarata,
        riferimenti_alcol = alcol,
        artisti = coalesce((select array_agg(a) from jsonb_array_elements_text(coalesce(dati -> 'artisti', '[]'::jsonb)) a), '{}'),
        prezzo_min_centesimi = (dati ->> 'prezzo_min_centesimi')::integer,
        url_biglietti = nullif(btrim(dati ->> 'url_biglietti'), ''),
        stato = 'pubblicato'
    where e.id = evento;
    if not exists (select 1 from public.eventi_fonti ef
                   where ef.evento_id = evento and ef.caricamento_flyer_id = c.id) then
      insert into public.eventi_fonti (evento_id, caricamento_flyer_id, tipo_origine)
      values (evento, c.id, 'flyer');
    end if;
  end if;
  delete from public.eventi_generi eg where eg.evento_id = evento;
  insert into public.eventi_generi (evento_id, genere_codice)
  select evento, g from unnest(generi) g
  on conflict do nothing;
  perform private.registra_decisione('evento', evento, 'pubblica_evento',
                                     'Pubblicato dalla revisione di un flyer. ' || testo);

  -- ADR-0018: la copertina si copia solo se il moderatore l'ha confermata adatta.
  if coalesce((dati ->> 'pubblica_immagine')::boolean, false) and not c.contenuto_sospetto then
    insert into public.coda_job (tipo, payload, chiave_idempotenza)
    values ('copia_immagine_flyer', jsonb_build_object('caricamento_id', c.id, 'evento_id', evento),
            'copia_immagine_flyer:' || c.id)
    on conflict (chiave_idempotenza) where stato in ('in_coda', 'in_esecuzione') do nothing;
  end if;
  update public.caricamenti_flyer x set stato = 'approvato', evento_id = evento where x.id = c.id;
  perform private.chiudi_operazione();
  return evento;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Escalation alle autorità (R-55, SAFETY_PRIVACY.md §11): account sospeso, contenuto
-- inaccessibile e conservato come prova, nessuna comunicazione all'account coinvolto. La
-- segnalazione alla Polizia Postale la fa l'amministratore incaricato, fuori dall'app.
-- ---------------------------------------------------------------------------------------------
create or replace function private.applica_escalation(
  tipo public.tipo_oggetto_segnalabile,
  oggetto uuid,
  segnalazione uuid,
  motivazione text,
  conferma text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  testo text := private.richiedi_motivazione(motivazione);
  account uuid;
  bersaglio public.tipo_oggetto_segnalabile;
begin
  if upper(btrim(coalesce(conferma, ''))) <> 'ESCALATION' then
    raise exception using errcode = 'NX032', message = 'Scrivi ESCALATION per confermare.';
  end if;
  perform private.registra_decisione(tipo, oggetto, 'escalation_autorita', testo, segnalazione, true);
  perform set_config('noxa.operazione_moderazione', 'consentita', true);

  account := case
    when tipo in ('profilo', 'foto_profilo') then oggetto
    when tipo = 'caricamento_flyer' then (select c.utente_id from public.caricamenti_flyer c where c.id = oggetto)
  end;
  if account is not null then
    update public.profili p set stato_account = 'sospeso' where p.id = account;
  end if;

  bersaglio := private.bersaglio_occultamento(tipo, oggetto);
  if bersaglio is not null then
    insert into public.contenuti_occultati (tipo_oggetto, oggetto_id, segnalazione_id, automatico,
                                            conservazione_legale)
    values (bersaglio, oggetto, segnalazione, false, true)
    on conflict (tipo_oggetto, oggetto_id)
      do update set conservazione_legale = true, automatico = false;
  end if;
  if tipo = 'evento' then
    update public.eventi e set stato = 'rifiutato'
    where e.id = oggetto and e.stato in ('pubblicato', 'in_revisione');
  end if;
  if tipo = 'caricamento_flyer' then
    update public.eventi e set stato = 'rifiutato'
    where e.id = (select c.evento_id from public.caricamenti_flyer c where c.id = oggetto)
      and e.stato = 'in_revisione';
    update public.caricamenti_flyer c
    set conservazione_legale = true,
        stato = 'rifiutato',
        motivo_rifiuto = coalesce(c.motivo_rifiuto, 'Flyer non pubblicabile.')
    where c.id = oggetto;
  end if;

  -- Le segnalazioni sullo stesso oggetto si chiudono e restano conservate; chi le ha fatte
  -- riceve un esito generico.
  update public.segnalazioni s
  set stato = 'chiusa', chiusa_il = now(), gestita_da = auth.uid(), conservazione_legale = true
  where s.tipo_oggetto = tipo and s.oggetto_id = oggetto and s.stato <> 'chiusa';
  perform private.notifica_esito(
    s.segnalante_id, 'segnalazione_decisa',
    jsonb_build_object('segnalazione_id', s.id, 'tipo_oggetto', s.tipo_oggetto,
                       'descrizione', private.descrivi_oggetto(s.tipo_oggetto, s.oggetto_id),
                       'decisione', 'provvedimento',
                       'motivazione', 'Abbiamo preso provvedimenti secondo le regole della comunità.')
  )
  from public.segnalazioni s
  where s.tipo_oggetto = tipo and s.oggetto_id = oggetto and s.chiusa_il = now()
    and s.segnalante_id is not null;
  perform private.chiudi_operazione();
end;
$$;

create or replace function public.escalation_segnalazione(
  segnalazione uuid,
  motivazione text,
  conferma text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.segnalazioni%rowtype;
begin
  perform private.richiedi_moderatore();
  select * into s from public.segnalazioni x where x.id = segnalazione for update;
  if s.id is null then
    raise exception using errcode = 'P0002', message = 'Segnalazione inesistente.';
  end if;
  if s.stato = 'chiusa' then
    raise exception using errcode = 'NX025', message = 'Questa segnalazione è già chiusa.';
  end if;
  perform private.applica_escalation(s.tipo_oggetto, s.oggetto_id, s.id, motivazione, conferma);
end;
$$;

create or replace function public.escalation_flyer(caricamento uuid, motivazione text, conferma text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  if not exists (select 1 from public.caricamenti_flyer c
                 where c.id = caricamento and c.stato in ('in_revisione', 'errore')) then
    raise exception using errcode = 'NX025', message = 'Questo flyer è già stato deciso.';
  end if;
  perform private.applica_escalation('caricamento_flyer', caricamento, null, motivazione, conferma);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Coda delle segnalazioni (R-53, R-69)
-- ---------------------------------------------------------------------------------------------
-- Aperte e in lavorazione per priorità e scadenza, poi le chiuse degli ultimi 30 giorni.
-- Nessun contenuto né chi ha segnalato: il contenuto si apre solo dal dettaglio, registrato.
create or replace function public.coda_segnalazioni()
returns table (
  id uuid,
  tipo_oggetto public.tipo_oggetto_segnalabile,
  oggetto_id uuid,
  motivo public.motivo_segnalazione,
  priorita smallint,
  stato public.stato_segnalazione,
  creata_il timestamptz,
  scadenza timestamptz,
  chiusa_il timestamptz,
  presa_da_me boolean,
  presa_da text,
  stesso_oggetto integer,
  in_escalation boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  return query
  select s.id, s.tipo_oggetto, s.oggetto_id, s.motivo, s.priorita, s.stato, s.creata_il,
         private.scadenza_segnalazione(s.priorita, s.creata_il), s.chiusa_il,
         s.gestita_da = auth.uid(),
         case when s.gestita_da is not null and s.gestita_da <> auth.uid()
              then (select p.nome_visualizzato from public.profili p where p.id = s.gestita_da) end,
         (select count(*)::integer from public.segnalazioni x
          where x.tipo_oggetto = s.tipo_oggetto and x.oggetto_id = s.oggetto_id),
         exists (select 1 from public.azioni_moderazione a
                 where a.segnalazione_id = s.id and a.azione = 'escalation_autorita')
  from public.segnalazioni s
  where s.stato <> 'chiusa' or s.chiusa_il > now() - interval '30 days'
  order by (s.stato = 'chiusa'), s.priorita, private.scadenza_segnalazione(s.priorita, s.creata_il), s.id
  limit 500;
end;
$$;

-- R-69: apre una segnalazione e registra l'accesso. Restituisce l'oggetto com'è per gli
-- utenti, il testo di chi ha segnalato (senza la sua identità), le altre segnalazioni sullo
-- stesso oggetto e il registro.
create or replace function public.dettaglio_segnalazione(id uuid)
returns table (
  segnalazione_id uuid,
  tipo_oggetto public.tipo_oggetto_segnalabile,
  oggetto_id uuid,
  motivo public.motivo_segnalazione,
  dettagli text,
  priorita smallint,
  stato public.stato_segnalazione,
  creata_il timestamptz,
  scadenza timestamptz,
  presa_da_me boolean,
  presa_da text,
  in_escalation boolean,
  occultato boolean,
  oggetto jsonb,
  altre jsonb,
  registro jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.segnalazioni%rowtype;
begin
  perform private.richiedi_moderatore();
  select * into s from public.segnalazioni x where x.id = dettaglio_segnalazione.id;
  if s.id is null then
    raise exception using errcode = 'P0002', message = 'Segnalazione inesistente.';
  end if;
  insert into public.azioni_moderazione (moderatore_id, segnalazione_id, tipo_oggetto, oggetto_id, azione)
  values (auth.uid(), s.id, s.tipo_oggetto, s.oggetto_id, 'accesso_segnalazione');

  return query
  select s.id, s.tipo_oggetto, s.oggetto_id, s.motivo, s.dettagli, s.priorita, s.stato, s.creata_il,
         private.scadenza_segnalazione(s.priorita, s.creata_il),
         s.gestita_da = auth.uid(),
         case when s.gestita_da is not null and s.gestita_da <> auth.uid()
              then (select p.nome_visualizzato from public.profili p where p.id = s.gestita_da) end,
         exists (select 1 from public.azioni_moderazione a
                 where a.segnalazione_id = s.id and a.azione = 'escalation_autorita'),
         coalesce(private.e_occultato(private.bersaglio_occultamento(s.tipo_oggetto, s.oggetto_id),
                                      s.oggetto_id), false),
         case
           when s.tipo_oggetto in ('profilo', 'foto_profilo') then (
             select jsonb_build_object('id', p.id, 'username', p.username,
                                       'nome_visualizzato', p.nome_visualizzato,
                                       'avatar_path', p.avatar_path,
                                       'avatar_nascosto', p.avatar_nascosto,
                                       'stato_account', p.stato_account)
             from public.profili p where p.id = s.oggetto_id)
           when s.tipo_oggetto = 'evento' then (
             select private.evento_json(s.oggetto_id)
                    || jsonb_build_object('immagine_path', e.immagine_path)
             from public.eventi e where e.id = s.oggetto_id)
           when s.tipo_oggetto = 'immagine_locale' then (
             select jsonb_build_object('id', l.id, 'nome', l.nome, 'comune', l.comune,
                                       'immagine_path', l.immagine_path)
             from public.locali l where l.id = s.oggetto_id)
           when s.tipo_oggetto = 'caricamento_flyer' then (
             select jsonb_build_object('id', c.id, 'storage_path', c.storage_path, 'stato', c.stato)
             from public.caricamenti_flyer c where c.id = s.oggetto_id)
         end,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', x.id, 'motivo', x.motivo, 'dettagli', x.dettagli,
                                               'stato', x.stato, 'creata_il', x.creata_il)
                            order by x.creata_il desc)
           from public.segnalazioni x
           where x.tipo_oggetto = s.tipo_oggetto and x.oggetto_id = s.oggetto_id and x.id <> s.id
         ), '[]'::jsonb),
         coalesce((
           select jsonb_agg(jsonb_build_object('creata_il', a.creata_il, 'autore', p.nome_visualizzato,
                                               'azione', a.azione, 'motivazione', a.motivazione)
                            order by a.creata_il desc)
           from public.azioni_moderazione a
           left join public.profili p on p.id = a.moderatore_id
           where a.oggetto_id = s.oggetto_id
             and a.tipo_oggetto in (s.tipo_oggetto,
                                    private.bersaglio_occultamento(s.tipo_oggetto, s.oggetto_id))
             and a.azione <> 'accesso_segnalazione'
         ), '[]'::jsonb);
end;
$$;

-- "Prendi in carico": la segnalazione passa in lavorazione a nome di chi chiama.
create or replace function public.prendi_in_carico_segnalazione(segnalazione uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.segnalazioni%rowtype;
begin
  perform private.richiedi_moderatore();
  select * into s from public.segnalazioni x where x.id = segnalazione for update;
  if s.id is null then
    raise exception using errcode = 'P0002', message = 'Segnalazione inesistente.';
  end if;
  if s.stato = 'chiusa' then
    raise exception using errcode = 'NX025', message = 'Questa segnalazione è già chiusa.';
  end if;
  if s.gestita_da is not null and s.gestita_da <> auth.uid() then
    raise exception using errcode = 'NX033', message = 'La segnalazione è in carico a un altro moderatore.';
  end if;
  perform private.registra_decisione(s.tipo_oggetto, s.oggetto_id, 'prendi_in_carico',
                                     'Presa in carico.', s.id);
  update public.segnalazioni x set stato = 'in_lavorazione', gestita_da = auth.uid()
  where x.id = s.id;
  perform private.chiudi_operazione();
end;
$$;

-- Decisione motivata su una segnalazione (SAFETY_PRIVACY.md §11): chiude tutte le
-- segnalazioni aperte sullo stesso oggetto, notifica chi le ha fatte e chi subisce la
-- decisione (R-53), toglie o conferma l'occultamento automatico (D-15). Restituisce il
-- percorso di una foto di un locale rimossa, che l'app del moderatore elimina.
--   contenuto (solo per rimuovi_contenuto di un profilo): 'foto', 'nome' o 'username'.
create or replace function public.decidi_segnalazione(
  segnalazione uuid,
  azione public.azione_moderazione,
  motivazione text,
  contenuto text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.segnalazioni%rowtype;
  testo text;
  bersaglio public.tipo_oggetto_segnalabile;
  prima uuid;
  da_eliminare text;
  aperta record;
  registrata uuid;
begin
  perform private.richiedi_moderatore();
  testo := private.richiedi_motivazione(motivazione);
  select * into s from public.segnalazioni x where x.id = segnalazione for update;
  if s.id is null then
    raise exception using errcode = 'P0002', message = 'Segnalazione inesistente.';
  end if;
  if s.stato = 'chiusa' then
    raise exception using errcode = 'NX025', message = 'Questa segnalazione è già chiusa.';
  end if;
  if s.gestita_da is not null and s.gestita_da <> auth.uid() then
    raise exception using errcode = 'NX033', message = 'La segnalazione è in carico a un altro moderatore.';
  end if;
  if azione not in ('nessuna_violazione', 'rimuovi_contenuto', 'modifica_evento', 'sospendi_account')
     or (azione = 'modifica_evento' and s.tipo_oggetto <> 'evento')
     or (azione = 'sospendi_account' and s.tipo_oggetto not in ('profilo', 'foto_profilo'))
     or (azione = 'rimuovi_contenuto' and s.tipo_oggetto = 'profilo'
         and coalesce(contenuto, '') not in ('foto', 'nome', 'username')) then
    raise exception using errcode = '22023', message = 'Azione non prevista per questo oggetto.';
  end if;
  perform set_config('noxa.operazione_moderazione', 'consentita', true);
  bersaglio := private.bersaglio_occultamento(s.tipo_oggetto, s.oggetto_id);

  if azione = 'rimuovi_contenuto' then
    if s.tipo_oggetto = 'foto_profilo' or (s.tipo_oggetto = 'profilo' and contenuto = 'foto') then
      if not exists (select 1 from public.profili p where p.id = s.oggetto_id and p.avatar_path is not null) then
        raise exception using errcode = '22023', message = 'Il profilo non ha una foto.';
      end if;
      -- Il file resta senza riferimenti e il worker lo elimina (job pulizia_flyer).
      update public.profili p set avatar_path = null where p.id = s.oggetto_id;
    elsif s.tipo_oggetto = 'profilo' and contenuto = 'nome' then
      update public.profili p set nome_visualizzato = 'Utente Noxa' where p.id = s.oggetto_id;
    elsif s.tipo_oggetto = 'profilo' and contenuto = 'username' then
      update public.profili p
      set username = 'utente_' || substr(md5(gen_random_uuid()::text), 1, 8)
      where p.id = s.oggetto_id;
    elsif s.tipo_oggetto = 'evento' then
      if not exists (select 1 from public.eventi e where e.id = s.oggetto_id and e.immagine_path is not null) then
        raise exception using errcode = '22023', message = 'L''evento non ha un''immagine da rimuovere.';
      end if;
      update public.eventi e set immagine_path = null where e.id = s.oggetto_id;
    elsif s.tipo_oggetto = 'immagine_locale' then
      select l.immagine_path into da_eliminare from public.locali l where l.id = s.oggetto_id;
      if da_eliminare is null then
        raise exception using errcode = '22023', message = 'Il locale non ha una foto.';
      end if;
      update public.locali l
      set immagine_path = null, immagine_fonte = null, immagine_attribuzione = null,
          immagine_riferimento = null
      where l.id = s.oggetto_id;
    else
      raise exception using errcode = '22023', message = 'Azione non prevista per questo oggetto.';
    end if;
  elsif azione = 'sospendi_account' then
    update public.profili p set stato_account = 'sospeso' where p.id = s.oggetto_id;
  end if;

  -- Chiude le segnalazioni aperte sullo stesso oggetto, ognuna con la sua riga nel registro.
  for aperta in
    select x.id, x.segnalante_id from public.segnalazioni x
    where x.tipo_oggetto = s.tipo_oggetto and x.oggetto_id = s.oggetto_id and x.stato <> 'chiusa'
    order by x.id = s.id desc, x.creata_il
  loop
    registrata := private.registra_decisione(
      s.tipo_oggetto, s.oggetto_id, azione,
      testo || case when azione = 'rimuovi_contenuto' and s.tipo_oggetto = 'profilo'
                    then ' (rimosso: ' || contenuto || ')' else '' end,
      aperta.id
    );
    prima := coalesce(prima, registrata);
    update public.segnalazioni x
    set stato = 'chiusa', chiusa_il = now(), gestita_da = auth.uid()
    where x.id = aperta.id;
    perform private.notifica_esito(
      aperta.segnalante_id, 'segnalazione_decisa',
      jsonb_build_object('azione_id', registrata, 'segnalazione_id', aperta.id,
                         'tipo_oggetto', s.tipo_oggetto,
                         'descrizione', private.descrivi_oggetto(s.tipo_oggetto, s.oggetto_id),
                         'decisione', azione, 'motivazione', testo)
    );
  end loop;

  -- La persona coinvolta riceve la motivazione e può presentare reclamo.
  if s.tipo_oggetto in ('profilo', 'foto_profilo') and azione in ('rimuovi_contenuto', 'sospendi_account') then
    perform private.notifica_esito(
      s.oggetto_id,
      case azione when 'sospendi_account' then 'account_sospeso' else 'contenuto_rimosso' end,
      jsonb_build_object('azione_id', prima, 'tipo_oggetto', s.tipo_oggetto,
                         'contenuto', case when s.tipo_oggetto = 'foto_profilo' then 'foto' else contenuto end,
                         'motivazione', testo)
    );
  end if;

  -- D-15: l'occultamento in attesa finisce quando l'immagine è stata rimossa oppure quando
  -- non resta nessuna segnalazione aperta che la riguardi; in questo caso torna visibile e la
  -- persona lo sa.
  if bersaglio is not null and exists (
    select 1 from public.contenuti_occultati o
    where o.tipo_oggetto = bersaglio and o.oggetto_id = s.oggetto_id and not o.conservazione_legale
  ) then
    if azione = 'rimuovi_contenuto' and (s.tipo_oggetto <> 'profilo' or contenuto = 'foto') then
      delete from public.contenuti_occultati o
      where o.tipo_oggetto = bersaglio and o.oggetto_id = s.oggetto_id;
    elsif not exists (
      select 1 from public.segnalazioni x
      where x.oggetto_id = s.oggetto_id and x.stato <> 'chiusa'
        and x.tipo_oggetto = any (case when bersaglio = 'foto_profilo'
                                       then array['profilo', 'foto_profilo']::public.tipo_oggetto_segnalabile[]
                                       else array[bersaglio] end)
    ) then
      delete from public.contenuti_occultati o
      where o.tipo_oggetto = bersaglio and o.oggetto_id = s.oggetto_id;
      registrata := private.registra_decisione(bersaglio, s.oggetto_id, 'ripristina_contenuto',
                                               'Controllo concluso: immagine di nuovo visibile.', s.id);
      if bersaglio = 'foto_profilo' and azione <> 'sospendi_account' then
        perform private.notifica_esito(
          s.oggetto_id, 'contenuto_ripristinato',
          jsonb_build_object('azione_id', registrata, 'tipo_oggetto', bersaglio,
                             'motivazione', 'Il controllo è concluso: la tua foto è di nuovo visibile.')
        );
      end if;
    end if;
  end if;
  perform private.chiudi_operazione();
  return da_eliminare;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reclami: coda e decisione (DSA art. 20). Decide un moderatore diverso da chi ha deciso.
-- ---------------------------------------------------------------------------------------------
create or replace function public.reclami_moderazione()
returns table (
  id uuid,
  stato public.stato_reclamo,
  testo text,
  creato_il timestamptz,
  ruolo text,
  decisione_id uuid,
  decisione_azione public.azione_moderazione,
  decisione_motivazione text,
  decisione_il timestamptz,
  decisione_autore text,
  tipo_oggetto public.tipo_oggetto_segnalabile,
  descrizione text,
  puo_decidere boolean,
  esito text,
  motivazione_esito text,
  deciso_il timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  return query
  select r.id, r.stato, r.testo, r.creato_il,
         (select i.ruolo from private.interessati_azione(a.id) i where i.utente = r.utente_id limit 1),
         a.id, a.azione, a.motivazione, a.creata_il, p.nome_visualizzato,
         a.tipo_oggetto,
         case when a.tipo_oggetto = 'caricamento_flyer' then 'Flyer caricato'
              else private.descrivi_oggetto(a.tipo_oggetto, a.oggetto_id) end,
         a.moderatore_id is distinct from auth.uid(),
         r.esito, r.motivazione_esito, r.deciso_il
  from public.reclami r
  join public.azioni_moderazione a on a.id = r.azione_id
  left join public.profili p on p.id = a.moderatore_id
  order by (r.stato = 'deciso'), r.creato_il
  limit 300;
end;
$$;

create or replace function public.esamina_reclamo(reclamo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  update public.reclami r set stato = 'in_esame', preso_da = auth.uid()
  where r.id = reclamo and r.stato = 'inviato'
    and exists (select 1 from public.azioni_moderazione a
                where a.id = r.azione_id and a.moderatore_id is distinct from auth.uid());
end;
$$;

-- Conferma o cambia la decisione. Cambiare annulla l'effetto dove si può: il flyer rifiutato
-- torna in revisione, l'account sospeso torna attivo, la segnalazione senza violazione torna
-- aperta; un contenuto rimosso si può caricare di nuovo.
create or replace function public.decidi_reclamo(reclamo uuid, cambia boolean, motivazione text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reclami%rowtype;
  a public.azioni_moderazione%rowtype;
  spiegazione text;
begin
  perform private.richiedi_moderatore();
  spiegazione := private.richiedi_motivazione(motivazione);
  if cambia is null then
    raise exception using errcode = '22023', message = 'Scegli se confermare o cambiare la decisione.';
  end if;
  select * into r from public.reclami x where x.id = reclamo for update;
  if r.id is null then
    raise exception using errcode = 'P0002', message = 'Reclamo inesistente.';
  end if;
  if r.stato = 'deciso' then
    raise exception using errcode = 'NX025', message = 'Questo reclamo è già stato deciso.';
  end if;
  select * into a from public.azioni_moderazione x where x.id = r.azione_id;
  if a.moderatore_id = auth.uid() then
    raise exception using errcode = 'NX031',
      message = 'Il reclamo lo decide un moderatore diverso da chi ha preso la decisione.';
  end if;
  perform set_config('noxa.operazione_moderazione', 'consentita', true);

  if cambia then
    if a.azione = 'rifiuta_flyer' then
      update public.caricamenti_flyer c
      set stato = 'in_revisione', motivo_rifiuto = null, deciso_il = null
      where c.id = a.oggetto_id and c.stato = 'rifiutato' and not c.conservazione_legale;
      update public.eventi e set stato = 'in_revisione'
      where e.id = (select c.evento_id from public.caricamenti_flyer c where c.id = a.oggetto_id)
        and e.stato = 'rifiutato';
    elsif a.azione = 'sospendi_account' then
      update public.profili p set stato_account = 'attivo' where p.id = a.oggetto_id;
      perform private.registra_decisione(a.tipo_oggetto, a.oggetto_id, 'riattiva_account', spiegazione,
                                         a.segnalazione_id);
    elsif a.azione = 'nessuna_violazione' and a.segnalazione_id is not null then
      update public.segnalazioni s
      set stato = 'aperta', chiusa_il = null, gestita_da = null
      where s.id = a.segnalazione_id;
    end if;
  end if;
  perform private.registra_decisione(a.tipo_oggetto, a.oggetto_id,
                                     case when cambia then 'cambia_decisione'
                                          else 'conferma_decisione' end::public.azione_moderazione,
                                     spiegazione, a.segnalazione_id);
  update public.reclami x
  set stato = 'deciso', esito = case when cambia then 'cambiata' else 'confermata' end,
      motivazione_esito = spiegazione, deciso_da = auth.uid(), deciso_il = now()
  where x.id = r.id;
  perform private.notifica_esito(
    r.utente_id, 'reclamo_deciso',
    jsonb_build_object('reclamo_id', r.id, 'azione_id', a.id, 'tipo_oggetto', a.tipo_oggetto,
                       'cambiata', cambia, 'motivazione', spiegazione)
  );
  perform private.chiudi_operazione();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Conservazione (SAFETY_PRIVACY.md §10): estende la funzione dell'iterazione 5 con le
-- notifiche (90 giorni) e il registro dei caricamenti dei flyer (24 ore). L'iterazione 8
-- aggiunge le altre scadenze.
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
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Pulizia delle immagini (job pulizia_flyer, pg_cron ogni giorno alle 03:30): il worker
-- elimina con la chiave service_role i file indicati da questa funzione (SAFETY_PRIVACY.md
-- §10). Restituisce bucket e percorso; nessun dato degli utenti.
--   - flyer-caricati: 30 giorni dopo la decisione, mai se conservati come prova (R-55); file
--     senza richiesta più vecchi di un giorno;
--   - flyer-pubblicati: 12 mesi dopo la serata (il riferimento nell'evento lo toglie il
--     worker) o senza riferimento da più di un giorno;
--   - avatar: file che non sono la foto in uso da più di un giorno (sostituite o rimosse),
--     salvo le foto conservate come prova.
-- ---------------------------------------------------------------------------------------------
create or replace function private.immagini_da_eliminare()
returns table (bucket text, percorso text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'flyer-caricati', c.storage_path
  from public.caricamenti_flyer c
  where c.stato in ('approvato', 'unito', 'rifiutato')
    and c.deciso_il < now() - interval '30 days'
    and c.immagine_eliminata_il is null
    and not c.conservazione_legale
  union all
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id = 'flyer-caricati'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.caricamenti_flyer c where c.storage_path = o.name)
  union all
  select 'flyer-pubblicati', e.immagine_path
  from public.eventi e
  where e.immagine_path is not null and e.data_serata < (now() - interval '12 months')::date
  union all
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id = 'flyer-pubblicati'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.eventi e where e.immagine_path = o.name)
  union all
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id = 'avatar'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.profili p where p.avatar_path = o.name)
    and not exists (select 1 from public.contenuti_occultati x
                    where x.tipo_oggetto = 'foto_profilo' and x.conservazione_legale
                      and x.oggetto_id::text = (storage.foldername(o.name))[1])
  limit 1000;
$$;

create or replace function private.accoda_pulizia_flyer()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.coda_job (tipo, payload, chiave_idempotenza)
  values ('pulizia_flyer', '{}'::jsonb, 'pulizia_flyer:' || to_char(now() at time zone 'Europe/Rome', 'YYYY-MM-DD'))
  on conflict (chiave_idempotenza) where stato in ('in_coda', 'in_esecuzione') do nothing;
$$;

select cron.schedule('accoda-pulizia-flyer', '30 3 * * *', $$select private.accoda_pulizia_flyer()$$);

-- Il worker usa solo queste funzioni dello schema private.
grant usage on schema private to noxa_worker;

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function private.scadenza_segnalazione(smallint, timestamptz) from public;
revoke all on function private.registra_decisione(public.tipo_oggetto_segnalabile, uuid,
                                                  public.azione_moderazione, text, uuid, boolean) from public;
revoke all on function private.notifica_esito(uuid, text, jsonb) from public;
revoke all on function private.bersaglio_occultamento(public.tipo_oggetto_segnalabile, uuid) from public;
revoke all on function private.interessati_azione(uuid) from public;
revoke all on function private.descrivi_oggetto(public.tipo_oggetto_segnalabile, uuid) from public;
revoke all on function private.prepara_segnalazione() from public;
revoke all on function private.occulta_in_attesa() from public;
revoke all on function private.reclamabile(uuid, uuid) from public;
revoke all on function private.esito_caricamento_flyer() from public;
revoke all on function private.evento_json(uuid) from public;
revoke all on function private.applica_escalation(public.tipo_oggetto_segnalabile, uuid, uuid, text, text) from public;
revoke all on function private.applica_conservazione() from public;
revoke all on function private.immagini_da_eliminare() from public;
revoke all on function private.accoda_pulizia_flyer() from public;
grant execute on function private.immagini_da_eliminare() to noxa_worker;

revoke all on function public.presenta_reclamo(uuid, text) from public, anon;
revoke all on function public.mie_segnalazioni() from public, anon;
revoke all on function public.miei_flyer() from public, anon;
revoke all on function public.contatori_moderazione() from public, anon;
revoke all on function public.coda_flyer() from public, anon;
revoke all on function public.decidi_flyer(uuid, text, jsonb, text, uuid) from public, anon;
revoke all on function public.escalation_segnalazione(uuid, text, text) from public, anon;
revoke all on function public.escalation_flyer(uuid, text, text) from public, anon;
revoke all on function public.coda_segnalazioni() from public, anon;
revoke all on function public.dettaglio_segnalazione(uuid) from public, anon;
revoke all on function public.prendi_in_carico_segnalazione(uuid) from public, anon;
revoke all on function public.decidi_segnalazione(uuid, public.azione_moderazione, text, text) from public, anon;
revoke all on function public.reclami_moderazione() from public, anon;
revoke all on function public.esamina_reclamo(uuid) from public, anon;
revoke all on function public.decidi_reclamo(uuid, boolean, text) from public, anon;

grant execute on function public.presenta_reclamo(uuid, text) to authenticated;
grant execute on function public.mie_segnalazioni() to authenticated;
grant execute on function public.miei_flyer() to authenticated;
grant execute on function public.contatori_moderazione() to authenticated;
grant execute on function public.coda_flyer() to authenticated;
grant execute on function public.decidi_flyer(uuid, text, jsonb, text, uuid) to authenticated;
grant execute on function public.escalation_segnalazione(uuid, text, text) to authenticated;
grant execute on function public.escalation_flyer(uuid, text, text) to authenticated;
grant execute on function public.coda_segnalazioni() to authenticated;
grant execute on function public.dettaglio_segnalazione(uuid) to authenticated;
grant execute on function public.prendi_in_carico_segnalazione(uuid) to authenticated;
grant execute on function public.decidi_segnalazione(uuid, public.azione_moderazione, text, text) to authenticated;
grant execute on function public.reclami_moderazione() to authenticated;
grant execute on function public.esamina_reclamo(uuid) to authenticated;
grant execute on function public.decidi_reclamo(uuid, boolean, text) to authenticated;
