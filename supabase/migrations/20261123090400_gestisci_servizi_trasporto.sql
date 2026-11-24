-- Migrazione: gestione dei servizi di trasporto dall'area di moderazione (F-23, ADR-0034).
-- Documentazione: docs/DATA_MODEL.md §5.5; regole: R-04, R-06, R-69.
--
-- Prima le voci si cambiavano solo con una migrazione. Ora un moderatore con i due fattori le
-- crea, le corregge, le disattiva e ne aggiorna la data di verifica con una RPC, che registra
-- ogni cambio in azioni_moderazione con la motivazione (R-69). L'app continua a leggere la
-- tabella con la policy per età (R-04).

-- Tutte le voci, anche disattivate e per ogni età: solo per i moderatori.
create or replace function public.servizi_trasporto_moderazione()
returns setof public.servizi_trasporto
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.richiedi_moderatore();
  return query select s.* from public.servizi_trasporto s order by s.ordine, s.nome;
end;
$$;

-- Crea (servizio null) o modifica una voce. I vincoli della tabella controllano forma, link
-- https, telefono ed età; qui si controllano la data di verifica e la motivazione.
create or replace function public.salva_servizio_trasporto(
  servizio uuid,
  tipo public.tipo_servizio_trasporto,
  nome text,
  zona text,
  telefono text,
  url text,
  nota text,
  eta_minima smallint,
  ordine smallint,
  fonte_url text,
  verificato_il date,
  attivo boolean,
  motivazione text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  risultato uuid;
  testo text;
begin
  perform private.richiedi_moderatore();
  testo := private.richiedi_motivazione(motivazione);
  if verificato_il is null or verificato_il > current_date
     or verificato_il < current_date - interval '2 years' then
    raise exception using errcode = '22023',
      message = 'La data di verifica deve essere di oggi o di un giorno passato.';
  end if;

  if servizio is null then
    insert into public.servizi_trasporto
      (tipo, nome, zona, telefono, url, nota, eta_minima, ordine, fonte_url, verificato_il, attivo)
    values
      (tipo, btrim(nome), zona, nullif(btrim(telefono), ''), nullif(btrim(url), ''),
       nullif(btrim(nota), ''), eta_minima, coalesce(ordine, 100), btrim(fonte_url),
       verificato_il, coalesce(attivo, true))
    returning id into risultato;
    perform private.registra_azione('servizio_trasporto', risultato, 'crea_servizio_trasporto', testo);
  else
    update public.servizi_trasporto s
    set tipo = salva_servizio_trasporto.tipo,
        nome = btrim(salva_servizio_trasporto.nome),
        zona = salva_servizio_trasporto.zona,
        telefono = nullif(btrim(salva_servizio_trasporto.telefono), ''),
        url = nullif(btrim(salva_servizio_trasporto.url), ''),
        nota = nullif(btrim(salva_servizio_trasporto.nota), ''),
        eta_minima = salva_servizio_trasporto.eta_minima,
        ordine = coalesce(salva_servizio_trasporto.ordine, s.ordine),
        fonte_url = btrim(salva_servizio_trasporto.fonte_url),
        verificato_il = salva_servizio_trasporto.verificato_il,
        attivo = coalesce(salva_servizio_trasporto.attivo, s.attivo)
    where s.id = servizio
    returning s.id into risultato;
    if risultato is null then
      raise exception using errcode = 'P0002', message = 'Servizio inesistente.';
    end if;
    perform private.registra_azione('servizio_trasporto', risultato, 'modifica_servizio_trasporto',
                                    testo);
  end if;
  perform private.chiudi_operazione();
  return risultato;
end;
$$;

-- Il registro di una voce si legge come quello di locali e fonti.
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
  if registro_moderazione.tipo not in ('locale', 'fonte', 'evento', 'candidato_locale', 'servizio_trasporto') then
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

revoke all on function public.servizi_trasporto_moderazione() from public, anon;
revoke all on function public.salva_servizio_trasporto(uuid, public.tipo_servizio_trasporto, text,
  text, text, text, text, smallint, smallint, text, date, boolean, text) from public, anon;
grant execute on function public.servizi_trasporto_moderazione() to authenticated;
grant execute on function public.salva_servizio_trasporto(uuid, public.tipo_servizio_trasporto,
  text, text, text, text, text, smallint, smallint, text, date, boolean, text) to authenticated;
