-- Migrazione: diritti privacy (esportazione dei propri dati, eliminazione dell'account),
-- registri conservati per legge, conservazione completa e nuova versione dell'informativa
-- Documentazione: docs/DATA_MODEL.md §5.1, §5.9, §5.10, §8; ADR-0025; regole: R-55, R-63,
-- R-64, R-65, R-66
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX047 esportazione già richiesta nell'ultima ora (il dettaglio è l'ora della prossima)
--   NX048 troppi tentativi di eliminazione con una password sbagliata nell'ultima ora

-- ---------------------------------------------------------------------------------------------
-- Esportazione dei dati (R-64, artt. 15 e 20 GDPR)
-- ---------------------------------------------------------------------------------------------
create table private.esportazioni_dati (
  utente_id    uuid primary key references public.profili (id) on delete cascade,
  richiesta_il timestamptz not null
);
comment on table private.esportazioni_dati is
  'Ultima esportazione dei dati per utente: una richiesta all''ora (R-64).';
revoke all on private.esportazioni_dati from public, anon, authenticated;

-- Tutto ciò che Noxa conserva su chi chiama, in un unico JSON. Delle altre persone compaiono
-- solo username e nome di chi ha un legame con te (amici, bloccati, persone nel diario), gli
-- stessi dati che vedi nell'app; non compaiono le segnalazioni ricevute, che sono registri
-- della moderazione e rivelerebbero chi ha segnalato (R-50, R-69).
create or replace function public.esporta_miei_dati()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := auth.uid();
  ultima timestamptz;
begin
  if io is null then
    raise exception using errcode = '42501', message = 'Accesso richiesto.';
  end if;
  select e.richiesta_il into ultima from private.esportazioni_dati e where e.utente_id = io;
  if ultima is not null and ultima > now() - interval '1 hour' then
    raise exception using errcode = 'NX047', message = 'Esportazione già richiesta nell''ultima ora.',
      detail = to_char((ultima + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;
  insert into private.esportazioni_dati (utente_id, richiesta_il) values (io, now())
  on conflict (utente_id) do update set richiesta_il = excluded.richiesta_il;

  return jsonb_build_object(
    'formato', 'noxa-esportazione-1',
    'generato_il', now(),
    'account', (
      select jsonb_build_object('id', u.id, 'email', u.email, 'creato_il', u.created_at,
                                'email_confermata_il', u.email_confirmed_at,
                                'ultimo_accesso_il', u.last_sign_in_at,
                                'due_fattori', exists (select 1 from auth.mfa_factors f
                                                       where f.user_id = u.id and f.status = 'verified'))
      from auth.users u where u.id = io),
    'profilo', (
      select jsonb_build_object('username', p.username, 'nome_visualizzato', p.nome_visualizzato,
                                'foto_profilo', p.avatar_path, 'stato_account', p.stato_account,
                                'creato_il', p.creato_il, 'aggiornato_il', p.aggiornato_il)
      from public.profili p where p.id = io),
    'impostazioni', (
      select jsonb_build_object('data_nascita', pp.data_nascita,
                                'partecipazioni_visibili', pp.partecipazioni_visibili,
                                'checkin_abilitato', pp.checkin_abilitato,
                                'notifiche_push_abilitate', pp.notifiche_push_abilitate,
                                'onboarding_completato_il', pp.onboarding_completato_il)
      from public.profili_privati pp where pp.utente_id = io),
    'ruoli', coalesce((
      select jsonb_agg(jsonb_build_object('ruolo', r.ruolo, 'assegnato_il', r.assegnato_il))
      from public.ruoli_utente r where r.utente_id = io), '[]'::jsonb),
    'consensi', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', c.tipo, 'versione', c.versione,
                                          'accettato_il', c.accettato_il) order by c.accettato_il)
      from public.consensi c where c.utente_id = io), '[]'::jsonb),
    'amicizie', coalesce((
      select jsonb_agg(jsonb_build_object(
               'username', p.username, 'nome_visualizzato', p.nome_visualizzato,
               'stato', a.stato, 'canale', a.canale,
               'direzione', case when a.richiedente_id = io then 'inviata' else 'ricevuta' end,
               'creata_il', a.creata_il, 'accettata_il', a.accettata_il) order by a.creata_il)
      from public.amicizie a
      join public.profili p on p.id = case when a.richiedente_id = io then a.destinatario_id else a.richiedente_id end
      where io in (a.richiedente_id, a.destinatario_id)), '[]'::jsonb),
    'codici_invito', coalesce((
      select jsonb_agg(jsonb_build_object('creato_il', ci.creato_il, 'scade_il', ci.scade_il,
                                          'usato_il', ci.usato_il) order by ci.creato_il)
      from public.codici_invito ci where ci.creato_da = io), '[]'::jsonb),
    'bloccati', coalesce((
      select jsonb_agg(jsonb_build_object('username', p.username,
                                          'nome_visualizzato', p.nome_visualizzato,
                                          'bloccato_il', b.creato_il) order by b.creato_il)
      from public.blocchi b join public.profili p on p.id = b.bloccato_id
      where b.bloccante_id = io), '[]'::jsonb),
    'gruppi', coalesce((
      select jsonb_agg(jsonb_build_object('nome', g.nome, 'ruolo', m.ruolo, 'stato', m.stato,
                                          'dal', m.creato_il) order by m.creato_il)
      from public.membri_gruppo m join public.gruppi g on g.id = m.gruppo_id
      where m.utente_id = io), '[]'::jsonb),
    'serate_di_gruppo', coalesce((
      select jsonb_agg(jsonb_build_object(
               'gruppo', g.nome, 'serata', coalesce(s.titolo, e.titolo), 'data_serata', s.data_serata,
               'risposta', ps.risposta, 'biglietto', ps.biglietto,
               'trasporto_andata', ps.trasporto_andata, 'trasporto_ritorno', ps.trasporto_ritorno,
               'posti_liberi', ps.posti_liberi, 'aggiornata_il', ps.aggiornato_il) order by s.data_serata)
      from public.partecipazioni_serata ps
      join public.serate_gruppo s on s.id = ps.serata_id
      join public.gruppi g on g.id = s.gruppo_id
      left join public.eventi e on e.id = s.evento_id
      where ps.utente_id = io), '[]'::jsonb),
    'serate_di_gruppo_proposte', coalesce((
      select jsonb_agg(jsonb_build_object(
               'gruppo', g.nome, 'titolo', s.titolo, 'data_serata', s.data_serata,
               'luogo_ritrovo', s.luogo_ritrovo, 'note', s.note, 'creata_il', s.creata_il)
             order by s.creata_il)
      from public.serate_gruppo s join public.gruppi g on g.id = s.gruppo_id
      where s.creata_da = io or s.testi_scritti_da = io), '[]'::jsonb),
    'partecipazioni_eventi', coalesce((
      select jsonb_agg(jsonb_build_object(
               'evento', e.titolo, 'data_serata', e.data_serata, 'stato', pe.stato,
               'visibile_agli_amici', pe.visibile_agli_amici, 'aggiornata_il', pe.aggiornato_il)
             order by e.data_serata)
      from public.partecipazioni_evento pe join public.eventi e on e.id = pe.evento_id
      where pe.utente_id = io), '[]'::jsonb),
    'diario', coalesce((
      select jsonb_agg(jsonb_build_object(
               'data_serata', s.data_serata, 'evento', e.titolo,
               'locale', coalesce(l.nome, s.nome_locale_libero), 'voto', s.voto, 'note', s.note,
               'spese', coalesce((select jsonb_agg(jsonb_build_object(
                                     'categoria', sp.categoria,
                                     'importo_euro', round(sp.importo_centesimi / 100.0, 2)))
                                  from public.tracker_spese sp where sp.serata_tracker_id = s.id), '[]'::jsonb),
               'dj', coalesce((select jsonb_agg(d.nome_dj)
                               from public.tracker_dj d where d.serata_tracker_id = s.id), '[]'::jsonb),
               'amici', coalesce((select jsonb_agg(p.username)
                                  from public.tracker_amici ta join public.profili p on p.id = ta.amico_id
                                  where ta.serata_tracker_id = s.id), '[]'::jsonb),
               'creata_il', s.creato_il, 'aggiornata_il', s.aggiornato_il) order by s.data_serata)
      from public.serate_tracker s
      left join public.eventi e on e.id = s.evento_id
      left join public.locali l on l.id = s.locale_id
      where s.utente_id = io), '[]'::jsonb),
    'segnalazioni_fatte', coalesce((
      select jsonb_agg(jsonb_build_object(
               'tipo_oggetto', s.tipo_oggetto, 'motivo', s.motivo, 'dettagli', s.dettagli,
               'stato', s.stato, 'creata_il', s.creata_il, 'chiusa_il', s.chiusa_il) order by s.creata_il)
      from public.segnalazioni s where s.segnalante_id = io), '[]'::jsonb),
    'reclami', coalesce((
      select jsonb_agg(jsonb_build_object('testo', r.testo, 'stato', r.stato, 'esito', r.esito,
                                          'motivazione_esito', r.motivazione_esito,
                                          'creato_il', r.creato_il, 'deciso_il', r.deciso_il)
                       order by r.creato_il)
      from public.reclami r where r.utente_id = io), '[]'::jsonb),
    'flyer_caricati', coalesce((
      select jsonb_agg(jsonb_build_object('stato', c.stato, 'motivo_rifiuto', c.motivo_rifiuto,
                                          'evento', e.titolo, 'creato_il', c.creato_il,
                                          'deciso_il', c.deciso_il) order by c.creato_il)
      from public.caricamenti_flyer c left join public.eventi e on e.id = c.evento_id
      where c.utente_id = io), '[]'::jsonb),
    'notifiche', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', n.tipo, 'creata_il', n.creata_il,
                                          'letta_il', n.letta_il) order by n.creata_il)
      from public.notifiche n where n.utente_id = io), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Registri conservati per legge (R-55): un account coinvolto in un'escalation alle autorità
-- resta identificabile per il procedimento anche se viene eliminato. La tabella non è
-- leggibile da nessun ruolo dell'app; la riga si toglie a mano a procedimento concluso.
-- ---------------------------------------------------------------------------------------------
create table private.account_conservati (
  utente_id     uuid primary key,
  azione_id     uuid not null,
  conservato_il timestamptz not null default now(),
  -- Copia dei dati di identificazione fatta al momento dell'eliminazione dell'account.
  dati          jsonb,
  eliminato_il  timestamptz
);
comment on table private.account_conservati is
  'Account coinvolti in un''escalation alle autorità: identità conservata per il procedimento (R-55).';
revoke all on private.account_conservati from public, anon, authenticated;

create or replace function private.registra_account_conservato()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account uuid;
begin
  account := case
    when new.tipo_oggetto in ('profilo', 'foto_profilo') then new.oggetto_id
    when new.tipo_oggetto = 'caricamento_flyer' then (select c.utente_id from public.caricamenti_flyer c where c.id = new.oggetto_id)
    when new.tipo_oggetto = 'gruppo' then (select g.nome_scritto_da from public.gruppi g where g.id = new.oggetto_id)
    when new.tipo_oggetto = 'serata_gruppo' then (select s.testi_scritti_da from public.serate_gruppo s where s.id = new.oggetto_id)
  end;
  if account is not null then
    insert into private.account_conservati (utente_id, azione_id) values (account, new.id)
    on conflict (utente_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger azioni_moderazione_account_conservato
  after insert on public.azioni_moderazione
  for each row when (new.azione = 'escalation_autorita')
  execute function private.registra_account_conservato();

-- ---------------------------------------------------------------------------------------------
-- Eliminazione dell'account (R-64, art. 17 GDPR)
-- ---------------------------------------------------------------------------------------------
create table private.tentativi_eliminazione (
  utente_id  uuid not null references public.profili (id) on delete cascade,
  tentato_il timestamptz not null default now()
);
create index tentativi_eliminazione_utente_idx on private.tentativi_eliminazione (utente_id, tentato_il);
comment on table private.tentativi_eliminazione is
  'Password sbagliate nella conferma dell''eliminazione: al massimo 5 all''ora.';
revoke all on private.tentativi_eliminazione from public, anon, authenticated;

-- Elimina l'account di chi chiama dopo aver verificato la password e, se l'account ha i due
-- fattori, una sessione aal2. La cancellazione di auth.users elimina a cascata profilo,
-- impostazioni, amicizie, blocchi, gruppi, partecipazioni, diario, notifiche e consensi; le
-- segnalazioni fatte e i flyer caricati restano senza legame con la persona, per i tempi di
-- SAFETY_PRIVACY.md §10. Restituisce i file della foto profilo, che l'Edge Function
-- elimina-account cancella subito dallo storage (il job pulizia_flyer li toglie comunque
-- entro un giorno). La password sbagliata non è un'eccezione, così il tentativo resta
-- registrato.
create or replace function public.elimina_mio_account(password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := auth.uid();
  utente auth.users%rowtype;
  file text[];
begin
  if io is null then
    raise exception using errcode = '42501', message = 'Accesso richiesto.';
  end if;
  if (select count(*) from private.tentativi_eliminazione t
      where t.utente_id = io and t.tentato_il > now() - interval '1 hour') >= 5 then
    raise exception using errcode = 'NX048', message = 'Troppi tentativi: riprova tra un''ora.';
  end if;

  select * into utente from auth.users u where u.id = io;
  if utente.encrypted_password is null or utente.encrypted_password = ''
     or utente.encrypted_password <> extensions.crypt(coalesce(password, ''), utente.encrypted_password) then
    insert into private.tentativi_eliminazione (utente_id) values (io);
    return jsonb_build_object('esito', 'password_errata');
  end if;

  if exists (select 1 from auth.mfa_factors f where f.user_id = io and f.status = 'verified')
     and coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    return jsonb_build_object('esito', 'serve_codice');
  end if;

  -- R-55: identità conservata per il procedimento, separata dall'account.
  update private.account_conservati ac
  set eliminato_il = now(),
      dati = jsonb_build_object(
        'email', utente.email, 'registrato_il', utente.created_at,
        'ultimo_accesso_il', utente.last_sign_in_at,
        'username', p.username, 'nome_visualizzato', p.nome_visualizzato,
        'data_nascita', pp.data_nascita)
  from public.profili p join public.profili_privati pp on pp.utente_id = p.id
  where ac.utente_id = io and p.id = io;

  select coalesce(array_agg(o.name), '{}') into file
  from storage.objects o
  where o.bucket_id = 'avatar' and (storage.foldername(o.name))[1] = io::text
    and not exists (select 1 from public.contenuti_occultati x
                    where x.tipo_oggetto = 'foto_profilo' and x.oggetto_id = io
                      and x.conservazione_legale);

  delete from auth.users u where u.id = io;
  return jsonb_build_object('esito', 'eliminato', 'file_avatar', to_jsonb(file));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Conservazione (SAFETY_PRIVACY.md §10): completa le scadenze delle iterazioni 5 e 6
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
  delete from public.reclami r
  where r.stato = 'deciso' and r.deciso_il < now() - interval '12 months'
    and not exists (select 1 from public.azioni_moderazione a
                    where a.id = r.azione_id and a.conservazione_legale);
  -- Registro della moderazione: 12 mesi dalla decisione, salvo le prove (R-55) e le decisioni
  -- con un reclamo ancora conservato.
  delete from public.azioni_moderazione a
  where a.creata_il < now() - interval '12 months'
    and not a.conservazione_legale
    and not exists (select 1 from public.reclami r where r.azione_id = a.id);
  delete from public.segnalazioni s
  where s.stato = 'chiusa' and s.chiusa_il < now() - interval '12 months'
    and not s.conservazione_legale;
  -- Foto dei locali disattivati da più di 7 giorni: il riferimento si toglie qui, il file lo
  -- elimina il job pulizia_flyer (private.immagini_da_eliminare). Le prove restano (R-55).
  update public.locali l
  set immagine_path = null, immagine_fonte = null, immagine_attribuzione = null,
      immagine_riferimento = null
  where not l.attivo and l.immagine_path is not null
    and l.aggiornato_il < now() - interval '7 days'
    and not exists (select 1 from public.contenuti_occultati x
                    where x.tipo_oggetto = 'immagine_locale' and x.oggetto_id = l.id
                      and x.conservazione_legale);
  delete from private.tentativi_eliminazione where tentato_il < now() - interval '24 hours';
  delete from private.esportazioni_dati where richiesta_il < now() - interval '24 hours';
end;
$$;

-- Come la versione dell'iterazione 6, con le foto dei locali non più in uso.
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
  union all
  select o.bucket_id, o.name
  from storage.objects o
  where o.bucket_id = 'immagini-locali'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.locali l where l.immagine_path = o.name)
    and not exists (select 1 from public.contenuti_occultati x
                    where x.tipo_oggetto = 'immagine_locale' and x.conservazione_legale
                      and o.name like x.oggetto_id::text || '%')
  limit 1000;
$$;

-- ---------------------------------------------------------------------------------------------
-- Nuova versione dell'informativa: fornitori di ADR-0021 e diritti self-service (R-63, R-66)
-- ---------------------------------------------------------------------------------------------
insert into private.versioni_documenti (tipo, versione, in_vigore_dal, novita)
values ('privacy', '2026-11', date '2026-10-27', array[
  'Nuovi fornitori: Cloudflare per l''app e la mappa, GitHub per la raccolta degli eventi, Brevo per le email.',
  'Copie di sicurezza cifrate nell''Unione europea, cancellate dopo 30 giorni.',
  'Scarichi i tuoi dati ed elimini l''account da Profilo › Privacy e dati.'
]);

revoke all on function public.esporta_miei_dati() from public, anon;
revoke all on function public.elimina_mio_account(text) from public, anon;
grant execute on function public.esporta_miei_dati() to authenticated;
grant execute on function public.elimina_mio_account(text) to authenticated;
revoke all on function private.registra_account_conservato() from public;
revoke all on function private.applica_conservazione() from public;
revoke all on function private.immagini_da_eliminare() from public;
grant execute on function private.immagini_da_eliminare() to noxa_worker;
