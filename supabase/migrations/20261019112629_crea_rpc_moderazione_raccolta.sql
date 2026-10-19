-- Migrazione: RPC dell'area di moderazione per locali, candidati, foto, fonti, duplicati ed
-- eventi; ogni decisione è motivata e registrata in azioni_moderazione
-- Documentazione: docs/DATA_MODEL.md §5.3, §5.10; docs/EVENT_INGESTION.md §2.1, §6.4, §7;
-- ADR-0008, ADR-0018; regole: R-06, R-22, R-23, R-53, R-56, R-69
--
-- Tutte le RPC sono security definer: verificano come prima istruzione che chi chiama sia un
-- moderatore con due fattori (private.e_moderatore(), R-06) e non restituiscono dati degli
-- utenti (R-69).

-- ---------------------------------------------------------------------------------------------
-- Supporto
-- ---------------------------------------------------------------------------------------------
create or replace function private.richiedi_moderatore()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.e_moderatore() then
    raise exception using errcode = '42501',
      message = 'Riservato ai moderatori con l''autenticazione a due fattori.';
  end if;
end;
$$;

create or replace function private.richiedi_motivazione(motivazione text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if char_length(btrim(coalesce(motivazione, ''))) = 0 then
    raise exception using errcode = 'NX021', message = 'Serve una motivazione.';
  end if;
  if char_length(btrim(motivazione)) > 500 then
    raise exception using errcode = '22001', message = 'La motivazione supera 500 caratteri.';
  end if;
  return btrim(motivazione);
end;
$$;

-- Registra un'azione e segnala ai trigger che la modifica di questa transazione è già nel
-- registro (private.registra_modifica_moderatore).
create or replace function private.registra_azione(
  tipo public.tipo_oggetto_segnalabile,
  oggetto uuid,
  azione public.azione_moderazione,
  motivazione text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('noxa.azione_registrata', 'si', true);
  insert into public.azioni_moderazione (moderatore_id, tipo_oggetto, oggetto_id, azione, motivazione)
  values (auth.uid(), tipo, oggetto, azione, motivazione);
end;
$$;

-- Fine di un'operazione delle RPC: i permessi di transazione non restano attivi per le
-- istruzioni successive della stessa transazione.
create or replace function private.chiudi_operazione()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('noxa.azione_registrata', '', true);
  perform set_config('noxa.operazione_moderazione', '', true);
end;
$$;

-- Evento non più trovato nella sua unica fonte per due esecuzioni, a più di 48 ore
-- dall'inizio (EVENT_INGESTION.md §7): si segnala, non si annulla in automatico.
create or replace function private.e_possibile_annullamento(evento uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.eventi e
    where e.id = evento
      and e.stato = 'pubblicato'
      and e.inizio > now() + interval '48 hours'
      and (select count(*) from public.eventi_fonti ef where ef.evento_id = e.id) = 1
      and exists (select 1 from public.eventi_fonti ef
                  where ef.evento_id = e.id and ef.fonte_id is not null
                    and ef.assenze_consecutive >= 2)
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Contatori della navigazione laterale
-- ---------------------------------------------------------------------------------------------
create or replace function public.contatori_moderazione()
returns table (duplicati integer, possibili_annullamenti integer, candidati_locali integer)
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
    (select count(*)::integer from public.candidati_locali c where c.stato = 'da_verificare');
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Locali
-- ---------------------------------------------------------------------------------------------
-- Elenco dei locali con i conteggi di fonti ed eventi. "Da verificare": il locale ha fonti
-- di cui non è ancora stata scritta la verifica di conformità.
create or replace function public.locali_moderazione()
returns table (
  id uuid,
  nome text,
  comune text,
  provincia text,
  attivo boolean,
  da_verificare boolean,
  immagine_path text,
  fonti_totali integer,
  fonti_attive integer,
  eventi_7_giorni integer,
  aggiornato_il timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  return query
  select l.id, l.nome, l.comune, l.provincia, l.attivo,
         exists (select 1 from public.fonti f
                 where f.locale_id = l.id and f.stato_conformita = 'da_verificare'),
         l.immagine_path,
         (select count(*)::integer from public.fonti f where f.locale_id = l.id),
         (select count(*)::integer from public.fonti f where f.locale_id = l.id and f.attiva),
         (select count(*)::integer from public.eventi e
          where e.locale_id = l.id and e.stato = 'pubblicato'
            and e.data_serata between (now() at time zone 'Europe/Rome')::date
                                  and (now() at time zone 'Europe/Rome')::date + 6),
         l.aggiornato_il
  from public.locali l
  order by l.nome;
end;
$$;

-- R-56: salva la foto già caricata in immagini-locali/<id>.webp con la sua fonte lecita e le
-- conferme del moderatore (niente persone riconoscibili, niente alcol in evidenza).
create or replace function public.salva_foto_locale(
  locale uuid,
  fonte public.fonte_immagine_locale,
  attribuzione text,
  riferimento text,
  senza_persone boolean,
  senza_alcol boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  percorso text := locale::text || '.webp';
  nome_locale text;
begin
  perform private.richiedi_moderatore();
  if not coalesce(senza_persone, false) or not coalesce(senza_alcol, false) then
    raise exception using errcode = 'NX023',
      message = 'Conferma che nella foto non ci sono persone riconoscibili né alcolici in evidenza.';
  end if;
  select l.nome into nome_locale from public.locali l where l.id = locale;
  if nome_locale is null then
    raise exception using errcode = 'P0002', message = 'Locale inesistente.';
  end if;
  if not exists (select 1 from storage.objects o
                 where o.bucket_id = 'immagini-locali' and o.name = percorso) then
    raise exception using errcode = 'NX024', message = 'La foto non è stata caricata.';
  end if;

  perform private.registra_azione(
    'locale', locale, 'approva_immagine_locale',
    'Foto approvata. Fonte: ' || fonte::text
      || coalesce('; attribuzione: ' || nullif(btrim(attribuzione), ''), '')
      || coalesce('; riferimento: ' || nullif(btrim(riferimento), ''), '')
      || '. Nessuna persona riconoscibile, nessun alcolico in evidenza.'
  );
  update public.locali l
  set immagine_path = percorso,
      immagine_fonte = fonte,
      immagine_attribuzione = nullif(btrim(attribuzione), ''),
      immagine_riferimento = nullif(btrim(riferimento), ''),
      immagine_approvata_da = auth.uid(),
      immagine_approvata_il = now()
  where l.id = locale;
  perform private.chiudi_operazione();
end;
$$;

-- R-56: la rimozione chiede una motivazione; il file si elimina dall'app subito dopo.
create or replace function public.rimuovi_foto_locale(locale uuid, motivazione text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  testo text;
begin
  perform private.richiedi_moderatore();
  testo := private.richiedi_motivazione(motivazione);
  if not exists (select 1 from public.locali l where l.id = locale and l.immagine_path is not null) then
    raise exception using errcode = 'NX025', message = 'Il locale non ha una foto.';
  end if;
  perform private.registra_azione('locale', locale, 'rimuovi_immagine_locale', testo);
  update public.locali l
  set immagine_path = null, immagine_fonte = null, immagine_attribuzione = null,
      immagine_riferimento = null
  where l.id = locale;
  perform private.chiudi_operazione();
end;
$$;

-- Candidati da OpenStreetMap e Google Places (EVENT_INGESTION.md §2.1): "creato" dopo aver
-- creato il locale verificato, "unito" a un locale esistente, "scartato" con il motivo.
-- L'identificativo OSM o Google passa al locale; nessun altro dato viene sovrascritto.
create or replace function public.decidi_candidato_locale(
  candidato uuid,
  esito text,
  locale uuid,
  motivazione text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.candidati_locali%rowtype;
  testo text;
begin
  perform private.richiedi_moderatore();
  select * into c from public.candidati_locali cl where cl.id = candidato for update;
  if c.id is null then
    raise exception using errcode = 'P0002', message = 'Candidato inesistente.';
  end if;
  if c.stato <> 'da_verificare' then
    raise exception using errcode = 'NX025', message = 'Il candidato è già stato deciso.';
  end if;
  if esito not in ('creato', 'unito', 'scartato') then
    raise exception using errcode = '22023', message = 'Esito non valido.';
  end if;

  if esito = 'creato' then
    testo := coalesce(nullif(btrim(motivazione), ''), 'Verificato e creato come nuovo locale.');
  else
    testo := private.richiedi_motivazione(motivazione);
  end if;

  if esito in ('creato', 'unito') then
    if locale is null or not exists (select 1 from public.locali l where l.id = locale) then
      raise exception using errcode = '22023', message = 'Scegli il locale.';
    end if;
    perform set_config('noxa.azione_registrata', 'si', true);
    update public.locali l
    set osm_id = coalesce(l.osm_id, c.osm_id),
        google_place_id = coalesce(l.google_place_id, c.google_place_id)
    where l.id = locale;
    perform private.registra_azione(
      'locale', locale,
      case when esito = 'creato' then 'verifica_candidato_locale'
           else 'unisci_candidato_locale' end::public.azione_moderazione,
      testo
    );
  end if;

  update public.candidati_locali cl
  set stato = esito,
      locale_id = case when esito = 'scartato' then null else locale end,
      deciso_da = auth.uid(),
      deciso_il = now()
  where cl.id = candidato;
  perform private.registra_azione(
    'candidato_locale', candidato,
    case esito when 'creato' then 'verifica_candidato_locale'
               when 'unito' then 'unisci_candidato_locale'
               else 'scarta_candidato_locale' end::public.azione_moderazione,
    testo
  );
  perform private.chiudi_operazione();
end;
$$;

-- Registro in sola lettura di un locale, una fonte o un evento: azioni dei moderatori (con il
-- nome visualizzato del moderatore) e, per gli eventi, le operazioni della raccolta
-- ("Sistema", autore nullo).
create or replace function public.registro_moderazione(
  tipo public.tipo_oggetto_segnalabile,
  oggetto uuid
)
returns table (creata_il timestamptz, autore text, azione text, motivazione text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  if registro_moderazione.tipo not in ('locale', 'fonte', 'evento', 'candidato_locale') then
    raise exception using errcode = '22023', message = 'Tipo di oggetto non previsto.';
  end if;
  return query
  select r.creata_il, r.autore, r.azione, r.motivazione
  from (
    select a.creata_il, p.nome_visualizzato as autore, a.azione::text as azione,
           a.motivazione
    from public.azioni_moderazione a
    left join public.profili p on p.id = a.moderatore_id
    where a.tipo_oggetto = registro_moderazione.tipo and a.oggetto_id = oggetto
      and a.azione <> 'accesso_segnalazione'
    union all
    select g.creato_il, null,
           case g.stato when 'normalizzato' then 'evento_creato' else 'evento_aggiornato' end,
           coalesce(case f.tipo when 'instagram' then '@' || f.url else f.url end, 'flyer')
    from public.eventi_grezzi g
    left join public.fonti f on f.id = g.fonte_id
    where registro_moderazione.tipo = 'evento' and g.evento_id = oggetto and g.stato in ('normalizzato', 'unito')
  ) r
  order by r.creata_il desc
  limit 50;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Fonti
-- ---------------------------------------------------------------------------------------------
-- Skill add-event-source §6: accoda subito un'esecuzione di una fonte consentita, anche non
-- attiva (prova). Restituisce il job, nuovo o già in coda.
create or replace function public.esegui_fonte_ora(fonte uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fonti%rowtype;
  job bigint;
begin
  perform private.richiedi_moderatore();
  select * into f from public.fonti x where x.id = fonte;
  if f.id is null then
    raise exception using errcode = 'P0002', message = 'Fonte inesistente.';
  end if;
  if f.stato_conformita <> 'consentita' or f.adattatore is null then
    raise exception using errcode = 'NX022',
      message = 'Si esegue solo una fonte consentita con un adattatore (ADR-0008).';
  end if;

  insert into public.coda_job (tipo, payload, chiave_idempotenza, chiave_concorrenza)
  values ('esegui_fonte', jsonb_build_object('fonte_id', f.id, 'prova', not f.attiva),
          'esegui_fonte:' || f.id, 'dominio:' || f.dominio)
  on conflict (chiave_idempotenza) where stato in ('in_coda', 'in_esecuzione') do nothing
  returning id into job;
  if job is null then
    select j.id into job from public.coda_job j
    where j.chiave_idempotenza = 'esegui_fonte:' || f.id and j.stato in ('in_coda', 'in_esecuzione');
    return job;
  end if;

  perform private.registra_azione(
    'fonte', f.id, 'esegui_fonte',
    case when f.attiva then 'Esecuzione chiesta dall''area di moderazione.'
         else 'Esecuzione di prova chiesta dall''area di moderazione.' end
  );
  perform private.chiudi_operazione();
  return job;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Duplicati (EVENT_INGESTION.md §6.4)
-- ---------------------------------------------------------------------------------------------
create or replace function public.coda_duplicati()
returns table (
  grezzo_id uuid,
  punteggio numeric,
  nota_revisione text,
  creato_il timestamptz,
  payload jsonb,
  fonte_tipo public.tipo_fonte,
  fonte_url text,
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
  select g.id, g.punteggio_dedup, g.nota_revisione, g.creato_il, g.payload, f.tipo, f.url,
         case when e.id is null then null else jsonb_build_object(
           'id', e.id,
           'titolo', e.titolo,
           'locale_id', e.locale_id,
           'locale_nome', l.nome,
           'inizio', e.inizio,
           'fine', e.fine,
           'eta_minima', e.eta_minima,
           'eta_minima_dichiarata', e.eta_minima_dichiarata,
           'riferimenti_alcol', e.riferimenti_alcol,
           'generi', coalesce((select jsonb_agg(eg.genere_codice order by eg.genere_codice)
                               from public.eventi_generi eg where eg.evento_id = e.id), '[]'::jsonb),
           'artisti', to_jsonb(e.artisti),
           'prezzo_min_centesimi', e.prezzo_min_centesimi,
           'stato', e.stato,
           'url', (select ef.url_originale from public.eventi_fonti ef
                   where ef.evento_id = e.id and ef.url_originale is not null
                   order by case ef.tipo_origine when 'sito_locale' then 1
                                                 when 'instagram' then 2 else 3 end,
                            ef.raccolto_il desc
                   limit 1)
         ) end
  from public.eventi_grezzi g
  left join public.fonti f on f.id = g.fonte_id
  left join public.eventi e on e.id = g.evento_candidato_id
  left join public.locali l on l.id = e.locale_id
  where g.stato = 'in_revisione_dedup' and g.decisione is null
  order by g.creato_il, g.id;
end;
$$;

-- Decisione sul possibile duplicato: la fusione o la creazione la esegue il worker con il job
-- deduplica_grezzo, con le regole del §7 (età massima, alcol se una fonte lo indica, R-22).
create or replace function public.decidi_duplicato(grezzo uuid, stesso_evento boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.eventi_grezzi%rowtype;
begin
  perform private.richiedi_moderatore();
  if stesso_evento is null then
    raise exception using errcode = '22023', message = 'Scegli "Stesso evento" o "Eventi distinti".';
  end if;
  select * into g from public.eventi_grezzi x where x.id = grezzo for update;
  if g.id is null then
    raise exception using errcode = 'P0002', message = 'Elemento della coda inesistente.';
  end if;
  if g.stato <> 'in_revisione_dedup' or g.decisione is not null then
    raise exception using errcode = 'NX025', message = 'Questo duplicato è già stato deciso.';
  end if;
  if stesso_evento and g.evento_candidato_id is null then
    raise exception using errcode = '22023', message = 'Non c''è un evento con cui unirlo.';
  end if;

  update public.eventi_grezzi x
  set decisione = case when stesso_evento then 'stesso_evento' else 'distinti' end,
      deciso_da = auth.uid(),
      deciso_il = now()
  where x.id = grezzo;

  insert into public.coda_job (tipo, payload, chiave_idempotenza)
  values ('deduplica_grezzo', jsonb_build_object('grezzo_id', grezzo), 'deduplica_grezzo:' || grezzo)
  on conflict (chiave_idempotenza) where stato in ('in_coda', 'in_esecuzione') do nothing;

  if g.evento_candidato_id is not null then
    perform private.registra_azione(
      'evento', g.evento_candidato_id,
      case when stesso_evento then 'unisci_duplicato' else 'separa_duplicato' end::public.azione_moderazione,
      case when stesso_evento then 'Stesso evento: dati della nuova fonte uniti'
           else 'Eventi distinti: il dato raccolto diventa un evento a sé' end
        || coalesce(' (punteggio ' || round(g.punteggio_dedup)::text || ')', '') || '.'
    );
  end if;
  perform private.chiudi_operazione();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Eventi
-- ---------------------------------------------------------------------------------------------
create or replace function public.eventi_moderazione(
  testo text default null,
  stati public.stato_evento[] default null,
  dal date default null,
  al date default null,
  locale uuid default null
)
returns table (
  id uuid,
  titolo text,
  locale_id uuid,
  locale_nome text,
  locale_comune text,
  inizio timestamptz,
  data_serata date,
  eta_minima smallint,
  eta_minima_dichiarata boolean,
  riferimenti_alcol boolean,
  stato public.stato_evento,
  fonti integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  return query
  select e.id, e.titolo, e.locale_id, l.nome, l.comune, e.inizio, e.data_serata, e.eta_minima,
         e.eta_minima_dichiarata, e.riferimenti_alcol, e.stato,
         (select count(*)::integer from public.eventi_fonti ef where ef.evento_id = e.id)
  from public.eventi e
  join public.locali l on l.id = e.locale_id
  where (testo is null or btrim(testo) = ''
         or e.titolo ilike '%' || btrim(testo) || '%' or l.nome ilike '%' || btrim(testo) || '%')
    and (stati is null or e.stato = any (stati))
    and (dal is null or e.data_serata >= dal)
    and (al is null or e.data_serata <= al)
    and (locale is null or e.locale_id = locale)
  order by e.data_serata, e.inizio, e.titolo
  limit 200;
end;
$$;

-- R-22, R-23: abbassare un'età dichiarata o togliere i riferimenti all'alcol lo fa solo un
-- moderatore, con una motivazione registrata.
create or replace function public.correggi_eta_alcol_evento(
  evento uuid,
  eta_minima smallint,
  eta_minima_dichiarata boolean,
  riferimenti_alcol boolean,
  motivazione text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  testo text;
  e public.eventi%rowtype;
  eta_nuova smallint := case when eta_minima_dichiarata then eta_minima else 18 end;
begin
  perform private.richiedi_moderatore();
  testo := private.richiedi_motivazione(motivazione);
  select * into e from public.eventi x where x.id = evento for update;
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'Evento inesistente.';
  end if;
  if eta_minima_dichiarata is null or riferimenti_alcol is null
     or (eta_minima_dichiarata and eta_minima is null) then
    raise exception using errcode = '22023', message = 'Indica età e riferimenti all''alcol.';
  end if;

  perform private.registra_azione(
    'evento', evento, 'correggi_eta_alcol',
    'Età ' || e.eta_minima || '+' || case when e.eta_minima_dichiarata then '' else ' (non dichiarata)' end
      || ' → ' || eta_nuova || '+' || case when eta_minima_dichiarata then '' else ' (non dichiarata)' end
      || '; alcol ' || case when e.riferimenti_alcol then 'sì' else 'no' end
      || ' → ' || case when riferimenti_alcol then 'sì' else 'no' end
      || '. ' || testo
  );
  perform set_config('noxa.operazione_moderazione', 'consentita', true);
  update public.eventi x
  set eta_minima = eta_nuova,
      eta_minima_dichiarata = correggi_eta_alcol_evento.eta_minima_dichiarata,
      riferimenti_alcol = correggi_eta_alcol_evento.riferimenti_alcol
  where x.id = evento;
  perform private.chiudi_operazione();
end;
$$;

-- Pubblica (da revisione o da annullato), annulla (da pubblicato) o rifiuta (da revisione o
-- pubblicato). Annullare e rifiutare chiedono la motivazione: chi aveva scelto "Partecipo"
-- vede l'evento come annullato.
create or replace function public.cambia_stato_evento(
  evento uuid,
  stato public.stato_evento,
  motivazione text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  attuale public.stato_evento;
  testo text;
begin
  perform private.richiedi_moderatore();
  select e.stato into attuale from public.eventi e where e.id = evento for update;
  if attuale is null then
    raise exception using errcode = 'P0002', message = 'Evento inesistente.';
  end if;
  if not ((stato = 'pubblicato' and attuale in ('in_revisione', 'annullato'))
          or (stato = 'annullato' and attuale = 'pubblicato')
          or (stato = 'rifiutato' and attuale in ('in_revisione', 'pubblicato'))) then
    raise exception using errcode = 'NX026',
      message = 'Questo cambio di stato non è previsto.';
  end if;
  testo := case when stato = 'pubblicato'
                then coalesce(nullif(btrim(motivazione), ''), 'Evento controllato e pubblicato.')
                else private.richiedi_motivazione(motivazione) end;

  perform private.registra_azione(
    'evento', evento,
    case stato when 'pubblicato' then 'pubblica_evento'
               when 'annullato' then 'annulla_evento'
               else 'rifiuta_evento' end::public.azione_moderazione,
    testo
  );
  perform set_config('noxa.operazione_moderazione', 'consentita', true);
  update public.eventi e set stato = cambia_stato_evento.stato where e.id = evento;
  perform private.chiudi_operazione();
end;
$$;

-- Possibili annullamenti: indica solo se qualcuno si è segnato, senza dire chi (R-69).
create or replace function public.possibili_annullamenti()
returns table (
  evento_id uuid,
  titolo text,
  locale_nome text,
  locale_comune text,
  fonte_url text,
  inizio timestamptz,
  data_serata date,
  ultima_conferma_il timestamptz,
  ha_partecipanti boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  return query
  select e.id, e.titolo, l.nome, l.comune, ef.url_originale, e.inizio, e.data_serata,
         ef.ultima_conferma_il,
         exists (select 1 from public.partecipazioni_evento p where p.evento_id = e.id)
  from public.eventi e
  join public.locali l on l.id = e.locale_id
  join public.eventi_fonti ef on ef.evento_id = e.id
  where e.stato = 'pubblicato' and e.inizio > now() + interval '48 hours'
    and private.e_possibile_annullamento(e.id)
  order by e.inizio;
end;
$$;

create or replace function public.decidi_possibile_annullamento(
  evento uuid,
  annullato boolean,
  motivazione text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  if not private.e_possibile_annullamento(evento) then
    raise exception using errcode = 'NX025', message = 'L''evento non è più tra i possibili annullamenti.';
  end if;
  if annullato then
    perform public.cambia_stato_evento(evento, 'annullato', motivazione);
  else
    perform private.registra_azione(
      'evento', evento, 'conferma_in_programma',
      coalesce(nullif(btrim(motivazione), ''), 'L''evento è ancora in programma.')
    );
    update public.eventi_fonti ef
    set assenze_consecutive = 0, ultima_conferma_il = now()
    where ef.evento_id = evento;
    perform private.chiudi_operazione();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function private.richiedi_moderatore() from public;
revoke all on function private.chiudi_operazione() from public;
revoke all on function private.richiedi_motivazione(text) from public;
revoke all on function private.registra_azione(public.tipo_oggetto_segnalabile, uuid,
                                               public.azione_moderazione, text) from public;
revoke all on function private.e_possibile_annullamento(uuid) from public;

revoke all on function public.contatori_moderazione() from public, anon;
revoke all on function public.locali_moderazione() from public, anon;
revoke all on function public.salva_foto_locale(uuid, public.fonte_immagine_locale, text, text,
                                                boolean, boolean) from public, anon;
revoke all on function public.rimuovi_foto_locale(uuid, text) from public, anon;
revoke all on function public.decidi_candidato_locale(uuid, text, uuid, text) from public, anon;
revoke all on function public.registro_moderazione(public.tipo_oggetto_segnalabile, uuid)
  from public, anon;
revoke all on function public.esegui_fonte_ora(uuid) from public, anon;
revoke all on function public.coda_duplicati() from public, anon;
revoke all on function public.decidi_duplicato(uuid, boolean) from public, anon;
revoke all on function public.eventi_moderazione(text, public.stato_evento[], date, date, uuid)
  from public, anon;
revoke all on function public.correggi_eta_alcol_evento(uuid, smallint, boolean, boolean, text)
  from public, anon;
revoke all on function public.cambia_stato_evento(uuid, public.stato_evento, text) from public, anon;
revoke all on function public.possibili_annullamenti() from public, anon;
revoke all on function public.decidi_possibile_annullamento(uuid, boolean, text) from public, anon;

grant execute on function public.contatori_moderazione() to authenticated;
grant execute on function public.locali_moderazione() to authenticated;
grant execute on function public.salva_foto_locale(uuid, public.fonte_immagine_locale, text, text,
                                                   boolean, boolean) to authenticated;
grant execute on function public.rimuovi_foto_locale(uuid, text) to authenticated;
grant execute on function public.decidi_candidato_locale(uuid, text, uuid, text) to authenticated;
grant execute on function public.registro_moderazione(public.tipo_oggetto_segnalabile, uuid)
  to authenticated;
grant execute on function public.esegui_fonte_ora(uuid) to authenticated;
grant execute on function public.coda_duplicati() to authenticated;
grant execute on function public.decidi_duplicato(uuid, boolean) to authenticated;
grant execute on function public.eventi_moderazione(text, public.stato_evento[], date, date, uuid)
  to authenticated;
grant execute on function public.correggi_eta_alcol_evento(uuid, smallint, boolean, boolean, text)
  to authenticated;
grant execute on function public.cambia_stato_evento(uuid, public.stato_evento, text) to authenticated;
grant execute on function public.possibili_annullamenti() to authenticated;
grant execute on function public.decidi_possibile_annullamento(uuid, boolean, text) to authenticated;
