-- Migrazione: notifiche sul telefono con il Web Push (F-22), conservazione ed esportazione del
-- check-in e dei dispositivi
-- Documentazione: docs/DATA_MODEL.md §5.1, §8; docs/ARCHITECTURE.md §5.4; ADR-0026; regole:
-- R-17, R-43, R-64, R-65, R-66
--
-- Ogni `INSERT` in `notifiche` di una persona con almeno un dispositivo chiama l'Edge Function
-- `invia-push` con `pg_net`: indirizzo e segreto stanno nel Vault (`invia_push_url`,
-- `invia_push_segreto`) e, se mancano (in locale e nei test), non parte nessuna richiesta. La
-- funzione invia solo un testo di sistema per tipo, mai nomi, username o testi di altre persone.

create type public.piattaforma as enum ('ios', 'android', 'web');

-- ---------------------------------------------------------------------------------------------
-- dispositivi_push
-- ---------------------------------------------------------------------------------------------
create table public.dispositivi_push (
  id            uuid primary key default gen_random_uuid(),
  utente_id     uuid not null references public.profili (id) on delete cascade,
  piattaforma   public.piattaforma not null,
  -- Web Push: l'endpoint dell'iscrizione, solo verso i servizi push dei browser (niente
  -- richieste della funzione verso indirizzi scelti dal client).
  token         text not null unique constraint dispositivi_push_token check (
                  char_length(token) <= 1000
                  and (piattaforma <> 'web'
                       or token ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/')),
  chiave_p256dh text constraint dispositivi_push_p256dh check (chiave_p256dh ~ '^[A-Za-z0-9_-]{80,100}={0,2}$'),
  chiave_auth   text constraint dispositivi_push_auth check (chiave_auth ~ '^[A-Za-z0-9_-]{16,30}={0,2}$'),
  -- Etichetta generica scritta dall'app ("Android · Chrome"), senza modello né versione.
  descrizione   text constraint dispositivi_push_descrizione check (char_length(descrizione) <= 60),
  creato_il     timestamptz not null default now(),
  ultimo_uso_il timestamptz not null default now(),
  constraint dispositivi_push_chiavi_web
    check (piattaforma <> 'web' or (chiave_p256dh is not null and chiave_auth is not null))
);
comment on table public.dispositivi_push is
  'Dispositivi con le notifiche sul telefono attive (F-22); tolti dopo 90 giorni senza uso.';
create index dispositivi_push_utente_idx on public.dispositivi_push (utente_id, ultimo_uso_il desc);

alter table public.dispositivi_push enable row level security;
revoke all on public.dispositivi_push from anon, authenticated;
-- La registrazione passa dalla RPC: lo stesso browser può passare da un account all'altro.
grant select, delete on public.dispositivi_push to authenticated;

create policy "dispositivi_push: il titolare vede i propri"
  on public.dispositivi_push for select to authenticated
  using (utente_id = (select auth.uid()));

create policy "dispositivi_push: il titolare li toglie"
  on public.dispositivi_push for delete to authenticated
  using (utente_id = (select auth.uid()));

-- Registra (o rinnova) il dispositivo di chi chiama. Un endpoint appartiene a un solo account:
-- se il browser era di un'altra persona, la sua riga si toglie. Al massimo 10 dispositivi per
-- persona: oltre, si toglie il meno usato.
create or replace function public.registra_dispositivo_push(
  piattaforma public.piattaforma, token text, chiave_p256dh text, chiave_auth text,
  descrizione text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := auth.uid();
  id_dispositivo uuid;
begin
  if io is null then
    raise exception using errcode = '42501', message = 'Accesso richiesto.';
  end if;
  delete from public.dispositivi_push d where d.token = registra_dispositivo_push.token and d.utente_id <> io;
  insert into public.dispositivi_push (utente_id, piattaforma, token, chiave_p256dh, chiave_auth, descrizione)
  values (io, registra_dispositivo_push.piattaforma, registra_dispositivo_push.token,
          registra_dispositivo_push.chiave_p256dh, registra_dispositivo_push.chiave_auth,
          nullif(btrim(registra_dispositivo_push.descrizione), ''))
  on conflict on constraint dispositivi_push_token_key do update
    set chiave_p256dh = excluded.chiave_p256dh, chiave_auth = excluded.chiave_auth,
        descrizione = excluded.descrizione, ultimo_uso_il = now()
  returning id into id_dispositivo;
  delete from public.dispositivi_push d
  where d.utente_id = io
    and d.id not in (select x.id from public.dispositivi_push x where x.utente_id = io
                     order by x.ultimo_uso_il desc limit 10);
  return id_dispositivo;
end;
$$;

-- `notifiche_push_abilitate` dice se esiste almeno un dispositivo: la scrive solo il trigger.
revoke update (notifiche_push_abilitate) on public.profili_privati from authenticated;

create or replace function private.sincronizza_notifiche_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  utente uuid := case when tg_op = 'DELETE' then old.utente_id else new.utente_id end;
begin
  update public.profili_privati pp
  set notifiche_push_abilitate = exists (select 1 from public.dispositivi_push d where d.utente_id = utente)
  where pp.utente_id = utente;
  return null;
end;
$$;

create trigger dispositivi_push_sincronizza
  after insert or delete on public.dispositivi_push
  for each row execute function private.sincronizza_notifiche_push();

-- ---------------------------------------------------------------------------------------------
-- Webhook verso invia-push (ARCHITECTURE.md §5.4, ADR-0026)
-- ---------------------------------------------------------------------------------------------
create or replace function private.invia_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  indirizzo text;
  segreto text;
begin
  if not exists (select 1 from public.dispositivi_push d where d.utente_id = new.utente_id) then
    return null;
  end if;
  select s.decrypted_secret into indirizzo from vault.decrypted_secrets s where s.name = 'invia_push_url';
  select s.decrypted_secret into segreto from vault.decrypted_secrets s where s.name = 'invia_push_segreto';
  if indirizzo is null or segreto is null then
    return null;
  end if;
  -- Solo l'identificativo: la funzione rilegge la notifica e decide il testo.
  perform net.http_post(
    url := indirizzo,
    body := jsonb_build_object('notifica_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-noxa-segreto', segreto),
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

create trigger notifiche_invia_push
  after insert on public.notifiche
  for each row execute function private.invia_push();

-- ---------------------------------------------------------------------------------------------
-- Conservazione (SAFETY_PRIVACY.md §10): si aggiungono check-in e dispositivi
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
  -- R-30: check-in cancellati 24 ore dopo la fine (scadenza o "Sono andato via").
  delete from public.checkin c
  where least(c.terminato_il, c.scade_il) < now() - interval '24 hours';
  -- Dispositivi su cui l'app non si apre da 90 giorni.
  delete from public.dispositivi_push where ultimo_uso_il < now() - interval '90 days';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Esportazione dei dati (R-64): la versione dell'iterazione 8 diventa la base privata, a cui si
-- aggiungono check-in e dispositivi (senza l'endpoint né le chiavi, che non dicono niente).
-- ---------------------------------------------------------------------------------------------
alter function public.esporta_miei_dati() set schema private;
alter function private.esporta_miei_dati() rename to esporta_dati_base;
revoke all on function private.esporta_dati_base() from public, anon, authenticated;

create or replace function public.esporta_miei_dati()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := auth.uid();
begin
  return private.esporta_dati_base() || jsonb_build_object(
    'checkin', coalesce((
      select jsonb_agg(jsonb_build_object(
               'locale', l.nome, 'evento', e.titolo, 'creato_il', c.creato_il,
               'scade_il', c.scade_il, 'terminato_il', c.terminato_il,
               -- R-17: chi è bloccato, in una delle due direzioni, non compare.
               'destinatari', coalesce((select jsonb_agg(p.username)
                                        from public.checkin_destinatari d
                                        join public.profili p on p.id = d.amico_id
                                        where d.checkin_id = c.id
                                          and not private.c_e_blocco(io, d.amico_id)), '[]'::jsonb))
             order by c.creato_il)
      from public.checkin c
      join public.locali l on l.id = c.locale_id
      left join public.eventi e on e.id = c.evento_id
      where c.utente_id = io), '[]'::jsonb),
    'dispositivi_push', coalesce((
      select jsonb_agg(jsonb_build_object('piattaforma', d.piattaforma, 'descrizione', d.descrizione,
                                          'creato_il', d.creato_il, 'ultimo_uso_il', d.ultimo_uso_il)
                       order by d.creato_il)
      from public.dispositivi_push d where d.utente_id = io), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function public.registra_dispositivo_push(public.piattaforma, text, text, text, text) from public, anon;
grant execute on function public.registra_dispositivo_push(public.piattaforma, text, text, text, text) to authenticated;
revoke all on function public.esporta_miei_dati() from public, anon;
grant execute on function public.esporta_miei_dati() to authenticated;
revoke all on function private.sincronizza_notifiche_push() from public;
revoke all on function private.invia_push() from public;
revoke all on function private.applica_conservazione() from public;
