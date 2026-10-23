-- Migrazione: segnalazione del nome dei gruppi e dei testi delle serate di gruppo, con la
-- decisione motivata dei moderatori e il reclamo di chi li ha scritti
-- Documentazione: docs/DATA_MODEL.md §4, §5.10, §10; docs/SAFETY_PRIVACY.md §11;
-- regole: R-16, R-50, R-52, R-53, R-55, R-69
--
-- Ridefinisce le funzioni dell'iterazione 6 aggiungendo i tipi `gruppo` e `serata_gruppo`.

-- ---------------------------------------------------------------------------------------------
-- segnalazioni: nome del gruppo e testi della serata (R-16, R-50)
-- ---------------------------------------------------------------------------------------------
drop policy "segnalazioni: si segnala un profilo, una foto o un evento visibile" on public.segnalazioni;

-- R-50: si segnala un profilo che si può vedere o che si è bloccato, la sua foto se si vede,
-- un evento visibile, la foto di un locale visibile, un gruppo di cui si è membri o invitati e
-- una serata di gruppo visibile.
create policy "segnalazioni: si segnala un profilo, una foto, un evento, un gruppo o una serata visibile"
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
      or (tipo_oggetto = 'gruppo' and (select private.e_membro(oggetto_id)))
      or (tipo_oggetto = 'serata_gruppo'
          and exists (select 1 from public.serate_gruppo s where s.id = oggetto_id))
    )
  );

-- R-53: priorità 2 anche per un gruppo o una serata con membri minorenni.
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
      or (new.tipo_oggetto in ('profilo', 'foto_profilo') and private.e_minorenne(new.oggetto_id))
      or (new.tipo_oggetto in ('gruppo', 'serata_gruppo') and exists (
            select 1 from public.membri_gruppo m
            where m.gruppo_id = case when new.tipo_oggetto = 'gruppo' then new.oggetto_id
                                     else (select s.gruppo_id from public.serate_gruppo s
                                           where s.id = new.oggetto_id) end
              and private.e_minorenne(m.utente_id))) then 2
    else 3
  end;
  return new;
end;
$$;

-- Descrizione dell'oggetto per chi lo conosceva già: username del profilo, titolo dell'evento,
-- nome del locale, nome del gruppo, titolo della serata.
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
    when tipo = 'gruppo' then (select g.nome from public.gruppi g where g.id = oggetto)
    when tipo = 'serata_gruppo' then (
      select coalesce(s.titolo, e.titolo, 'Serata di gruppo')
      from public.serate_gruppo s left join public.eventi e on e.id = s.evento_id
      where s.id = oggetto)
  end;
$$;

-- Persone a cui spetta la motivazione di una decisione e il reclamo (DSA art. 17 e 20): chi ha
-- segnalato e chi subisce la decisione (titolare del profilo o del flyer; dall'iterazione 7
-- chi ha scritto il nome del gruppo o i testi della serata). Le escalation non si comunicano
-- all'account coinvolto (R-55).
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
    and c.utente_id is not null
  union
  select g.nome_scritto_da, 'interessato'
  from public.azioni_moderazione a
  join public.gruppi g on g.id = a.oggetto_id
  where a.id = interessati_azione.azione
    and a.tipo_oggetto = 'gruppo' and a.azione = 'rimuovi_contenuto'
    and g.nome_scritto_da is not null
  union
  select s.testi_scritti_da, 'interessato'
  from public.azioni_moderazione a
  join public.serate_gruppo s on s.id = a.oggetto_id
  where a.id = interessati_azione.azione
    and a.tipo_oggetto = 'serata_gruppo' and a.azione = 'rimuovi_contenuto'
    and s.testi_scritti_da is not null;
$$;

-- R-69: apre una segnalazione e registra l'accesso. Restituisce l'oggetto com'è per gli
-- utenti, il testo di chi ha segnalato (senza la sua identità), le altre segnalazioni sullo
-- stesso oggetto e il registro. Dall'iterazione 7 anche gruppi e serate di gruppo, con i
-- soli testi segnalabili e l'autore (R-16, R-69: nessun elenco dei membri).
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
           when s.tipo_oggetto = 'gruppo' then (
             select jsonb_build_object('id', g.id, 'nome', g.nome,
                                       'membri', (select count(*) from public.membri_gruppo m
                                                  where m.gruppo_id = g.id),
                                       'autore', (select '@' || p.username::text from public.profili p
                                                  where p.id = g.nome_scritto_da))
             from public.gruppi g where g.id = s.oggetto_id)
           when s.tipo_oggetto = 'serata_gruppo' then (
             select jsonb_build_object('id', x.id, 'titolo', x.titolo, 'evento_titolo', e.titolo,
                                       'luogo_ritrovo', x.luogo_ritrovo, 'note', x.note,
                                       'data_serata', x.data_serata, 'gruppo_nome', g.nome,
                                       'autore', (select '@' || p.username::text from public.profili p
                                                  where p.id = x.testi_scritti_da))
             from public.serate_gruppo x
             join public.gruppi g on g.id = x.gruppo_id
             left join public.eventi e on e.id = x.evento_id
             where x.id = s.oggetto_id)
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

-- Decisione motivata su una segnalazione (SAFETY_PRIVACY.md §11): chiude tutte le
-- segnalazioni aperte sullo stesso oggetto, notifica chi le ha fatte e chi subisce la
-- decisione (R-53), toglie o conferma l'occultamento automatico (D-15). Restituisce il
-- percorso di una foto di un locale rimossa, che l'app del moderatore elimina.
--   contenuto (per rimuovi_contenuto): di un profilo 'foto', 'nome' o 'username'; di un gruppo
--   'nome'; di una serata di gruppo 'titolo', 'luogo' o 'note' (iterazione 7).
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
         and coalesce(contenuto, '') not in ('foto', 'nome', 'username'))
     or (azione = 'rimuovi_contenuto' and s.tipo_oggetto = 'gruppo'
         and coalesce(contenuto, '') <> 'nome')
     or (azione = 'rimuovi_contenuto' and s.tipo_oggetto = 'serata_gruppo'
         and coalesce(contenuto, '') not in ('titolo', 'luogo', 'note')) then
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
    elsif s.tipo_oggetto = 'gruppo' then
      update public.gruppi g set nome = 'Gruppo' where g.id = s.oggetto_id;
      if not found then
        raise exception using errcode = 'P0002', message = 'Il gruppo non esiste più.';
      end if;
    elsif s.tipo_oggetto = 'serata_gruppo' then
      -- Il titolo di una serata libera è obbligatorio: diventa un titolo generico.
      update public.serate_gruppo x
      set titolo = case when contenuto <> 'titolo' then x.titolo
                        when x.evento_id is null then 'Serata di gruppo' end,
          luogo_ritrovo = case when contenuto = 'luogo' then null else x.luogo_ritrovo end,
          note = case when contenuto = 'note' then null else x.note end
      where x.id = s.oggetto_id;
      if not found then
        raise exception using errcode = 'P0002', message = 'La serata non esiste più.';
      end if;
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
      testo || case when azione = 'rimuovi_contenuto'
                         and s.tipo_oggetto in ('profilo', 'gruppo', 'serata_gruppo')
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

  -- Chi ha scritto il nome del gruppo o i testi della serata riceve la motivazione e può
  -- presentare reclamo (iterazione 7).
  if s.tipo_oggetto in ('gruppo', 'serata_gruppo') and azione = 'rimuovi_contenuto' then
    perform private.notifica_esito(
      i.utente, 'contenuto_rimosso',
      jsonb_build_object('azione_id', prima, 'tipo_oggetto', s.tipo_oggetto,
                         'contenuto', contenuto, 'motivazione', testo)
    )
    from private.interessati_azione(prima) i
    where i.ruolo = 'interessato';
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
-- Escalation alle autorità (R-55, SAFETY_PRIVACY.md §11): account sospeso, contenuto
-- inaccessibile e conservato come prova, nessuna comunicazione all'account coinvolto. La
-- segnalazione alla Polizia Postale la fa l'amministratore incaricato, fuori dall'app.
-- Dall'iterazione 7, per un gruppo o una serata si sospende chi ne ha scritto i testi.
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
    when tipo = 'gruppo' then (select g.nome_scritto_da from public.gruppi g where g.id = oggetto)
    when tipo = 'serata_gruppo' then (select s.testi_scritti_da from public.serate_gruppo s where s.id = oggetto)
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

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni (create or replace li conserva; si ripetono per chiarezza)
-- ---------------------------------------------------------------------------------------------
revoke all on function private.prepara_segnalazione() from public;
revoke all on function private.descrivi_oggetto(public.tipo_oggetto_segnalabile, uuid) from public;
revoke all on function private.interessati_azione(uuid) from public;
revoke all on function private.applica_escalation(public.tipo_oggetto_segnalabile, uuid, uuid, text, text) from public;
revoke all on function public.dettaglio_segnalazione(uuid) from public, anon;
revoke all on function public.decidi_segnalazione(uuid, public.azione_moderazione, text, text) from public, anon;
grant execute on function public.dettaglio_segnalazione(uuid) to authenticated;
grant execute on function public.decidi_segnalazione(uuid, public.azione_moderazione, text, text) to authenticated;
