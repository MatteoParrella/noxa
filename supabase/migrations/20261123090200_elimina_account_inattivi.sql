-- Migrazione: avviso ed eliminazione degli account senza accessi da 24 mesi.
-- Documentazione: docs/DATA_MODEL.md §8 (job) e §4 (funzioni private); SAFETY_PRIVACY.md §10;
-- regole: R-55, R-62, R-64.
--
-- Un account senza accessi da 24 mesi riceve un'email; se nei 30 giorni successivi non c'è
-- nessun accesso, l'account è eliminato con la stessa procedura di `elimina_mio_account`
-- (identità conservata solo per un procedimento in corso, R-55; file della foto profilo
-- eliminati dal job pulizia_flyer). Un account si elimina solo se Brevo ha accettato l'email di
-- avviso: senza la configurazione nel Vault, o se l'invio fallisce, nessun account viene
-- eliminato e l'avviso si riprova.
--
-- «Accesso» è l'ultimo accesso con la password oppure l'ultimo rinnovo di una sessione: chi usa
-- ogni giorno l'app installata non rifà l'accesso, ma la sua sessione si rinnova.

-- ---------------------------------------------------------------------------------------------
-- Eliminazione condivisa con elimina_mio_account
-- ---------------------------------------------------------------------------------------------
create or replace function private.elimina_account(utente uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  dati_utente auth.users%rowtype;
begin
  select * into dati_utente from auth.users u where u.id = utente;
  if not found then
    return;
  end if;
  -- R-55: identità conservata per il procedimento, separata dall'account.
  update private.account_conservati ac
  set eliminato_il = now(),
      dati = jsonb_build_object(
        'email', dati_utente.email, 'registrato_il', dati_utente.created_at,
        'ultimo_accesso_il', dati_utente.last_sign_in_at,
        'username', p.username, 'nome_visualizzato', p.nome_visualizzato,
        'data_nascita', pp.data_nascita)
  from public.profili p join public.profili_privati pp on pp.utente_id = p.id
  where ac.utente_id = utente and p.id = utente;

  delete from auth.users u where u.id = utente;
end;
$$;

revoke all on function private.elimina_account(uuid) from public, anon, authenticated;

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

  select coalesce(array_agg(o.name), '{}') into file
  from storage.objects o
  where o.bucket_id = 'avatar' and (storage.foldername(o.name))[1] = io::text
    and not exists (select 1 from public.contenuti_occultati x
                    where x.tipo_oggetto = 'foto_profilo' and x.oggetto_id = io
                      and x.conservazione_legale);

  perform private.elimina_account(io);
  return jsonb_build_object('esito', 'eliminato', 'file_avatar', to_jsonb(file));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Avvisi di inattività
-- ---------------------------------------------------------------------------------------------
create table private.avvisi_inattivita (
  utente_id   uuid primary key references auth.users (id) on delete cascade,
  avvisato_il timestamptz not null default now(),
  -- Richiesta di pg_net verso Brevo; null quando l'esito è stato letto.
  richiesta_id bigint,
  confermato  boolean not null default false
);
comment on table private.avvisi_inattivita is
  'Account avvisati per 24 mesi senza accessi (SAFETY_PRIVACY.md §10): eliminati dopo 30 giorni '
  'senza un nuovo accesso. Solo data e utente; nessun accesso dal client.';
revoke all on private.avvisi_inattivita from public, anon, authenticated;

-- Ultimo accesso con la password o rinnovo della sessione.
create or replace function private.ultimo_accesso(utente uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    u.created_at,
    u.last_sign_in_at,
    (select max(greatest(s.created_at, s.updated_at, s.refreshed_at::timestamptz))
     from auth.sessions s where s.user_id = u.id)
  )
  from auth.users u where u.id = utente;
$$;

revoke all on function private.ultimo_accesso(uuid) from public, anon, authenticated;

-- Email di avviso con l'API di Brevo (ADR-0021). Indirizzo, chiave e mittente stanno nel Vault;
-- nel corpo c'è solo l'indirizzo email del destinatario, nessun altro dato dell'account.
create or replace function private.invia_avviso_inattivita(utente uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  chiave text;
  mittente text;
  url_app text;
  destinatario text;
begin
  select s.decrypted_secret into chiave from vault.decrypted_secrets s where s.name = 'brevo_api_chiave';
  select s.decrypted_secret into mittente from vault.decrypted_secrets s where s.name = 'email_mittente';
  select s.decrypted_secret into url_app from vault.decrypted_secrets s where s.name = 'url_app';
  select u.email into destinatario from auth.users u where u.id = utente;
  if chiave is null or mittente is null or url_app is null or destinatario is null then
    return null;
  end if;

  return net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    body := jsonb_build_object(
      'sender', jsonb_build_object('name', 'Noxa', 'email', mittente),
      'to', jsonb_build_array(jsonb_build_object('email', destinatario)),
      'subject', 'Il tuo account Noxa sta per essere eliminato',
      'textContent',
        'Ciao,' || chr(10) || chr(10)
        || 'non entri in Noxa da due anni. Per non tenere dati che non usi, tra 30 giorni '
        || 'eliminiamo il tuo account con le serate, gli amici e i gruppi.' || chr(10) || chr(10)
        || 'Se vuoi tenerlo, basta entrare una volta: ' || url_app || '/accesso/' || chr(10)
        || 'Se invece va bene così, non devi fare nulla.' || chr(10) || chr(10)
        || 'Noxa'
    ),
    headers := jsonb_build_object('Content-Type', 'application/json', 'api-key', chiave),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function private.invia_avviso_inattivita(uuid) from public, anon, authenticated;

create or replace function private.gestisci_account_inattivi()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  utente uuid;
  richiesta bigint;
begin
  -- Esito degli invii (pg_net conserva le risposte per 6 ore): se Brevo ha accettato l'email
  -- l'avviso è confermato, altrimenti si cancella e si riprova al giro successivo.
  update private.avvisi_inattivita a
  set confermato = true, richiesta_id = null
  from net._http_response r
  where r.id = a.richiesta_id and r.status_code between 200 and 299;
  delete from private.avvisi_inattivita a
  where not a.confermato
    and (exists (select 1 from net._http_response r
                 where r.id = a.richiesta_id
                   and (r.status_code is null or r.status_code not between 200 and 299))
         or a.avvisato_il < now() - interval '5 hours');

  -- Chi è rientrato dopo l'avviso non viene più eliminato.
  delete from private.avvisi_inattivita a
  where private.ultimo_accesso(a.utente_id) > a.avvisato_il;

  -- Eliminazione: avviso di almeno 30 giorni fa e nessun accesso da allora.
  for utente in
    select a.utente_id from private.avvisi_inattivita a
    where a.confermato and a.avvisato_il < now() - interval '30 days'
  loop
    perform private.elimina_account(utente);
  end loop;

  -- Nuovi avvisi: al massimo 100 al giorno, dentro il limite gratuito di Brevo (ADR-0021).
  for utente in
    select u.id from auth.users u
    -- Filtro economico prima: l'ultimo accesso non è mai prima di questi due istanti.
    where coalesce(u.last_sign_in_at, u.created_at) < now() - interval '24 months'
      and u.created_at < now() - interval '24 months'
      and private.ultimo_accesso(u.id) < now() - interval '24 months'
      and not exists (select 1 from private.avvisi_inattivita a where a.utente_id = u.id)
    order by private.ultimo_accesso(u.id)
    limit greatest(0, 100 - (select count(*) from private.avvisi_inattivita a
                             where a.avvisato_il > now() - interval '24 hours'))
  loop
    richiesta := private.invia_avviso_inattivita(utente);
    exit when richiesta is null;
    insert into private.avvisi_inattivita (utente_id, richiesta_id) values (utente, richiesta);
  end loop;
end;
$$;

revoke all on function private.gestisci_account_inattivi() from public, anon, authenticated;

-- Ogni ora: l'esito di un invio si legge prima che pg_net lo cancelli (6 ore).
select cron.schedule('account-inattivi', '20 * * * *', $$select private.gestisci_account_inattivi()$$);
