-- Migrazione: gruppi, membri, serate di gruppo e partecipazioni con invariante delle fasce,
-- trasporto, notifiche, RPC di lettura e Realtime
-- Documentazione: docs/DATA_MODEL.md §3, §4, §5.4, §7, §8; regole: R-11, R-13, R-15, R-16,
-- R-17, R-20, R-23, R-24, R-43, R-55
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX037 gruppo pieno (30 membri)
--   NX038 persona non invitabile nel gruppo (non amica, fasce, blocco, account non attivo)
--   NX039 passaggio non valido (chi guida non è nella serata o non guida)
--   NX040 mezzo non consentito: "guido" solo per i maggiorenni
--   NX041 posti in auto non sufficienti
--   NX042 data della serata già passata
--   NX043 evento non adatto a tutto il gruppo (R-24)
--   NX044 modifica dei membri non prevista (ruolo o stato)
--   NX045 troppi gruppi creati nelle ultime 24 ore
--   NX026 cambio di stato della serata non previsto (codice dell'iterazione 6)

-- ---------------------------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------------------------
create type public.ruolo_gruppo as enum ('admin', 'membro');
create type public.stato_membro as enum ('invitato', 'attivo');
create type public.stato_serata as enum ('proposta', 'confermata', 'annullata');
create type public.risposta_serata as enum ('si', 'forse', 'no');
create type public.stato_biglietto as enum ('nessuno', 'prevendita', 'lista', 'alla_cassa');
create type public.mezzo_trasporto as enum (
  'auto_guido', 'passaggio', 'mezzi_pubblici', 'taxi_ncc', 'a_piedi', 'altro'
);

-- ---------------------------------------------------------------------------------------------
-- gruppi (F-13)
-- ---------------------------------------------------------------------------------------------
create table public.gruppi (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null
                  constraint gruppi_nome_lunghezza
                  check (char_length(nome) between 1 and 40 and nome = btrim(nome)),
  creato_da       uuid references public.profili (id) on delete set null,
  -- Chi ha scritto il nome attuale: riceve la decisione se il nome viene rimosso (R-52).
  nome_scritto_da uuid references public.profili (id) on delete set null,
  creato_il       timestamptz not null default now(),
  aggiornato_il   timestamptz not null default now()
);
comment on table public.gruppi is
  'Gruppi di amici: si entra solo su invito di un membro (R-11, R-15); nome segnalabile (R-50).';
create index gruppi_creato_da_idx on public.gruppi (creato_da, creato_il);

alter table public.gruppi enable row level security;
revoke all on public.gruppi from anon, authenticated;
grant select, delete on public.gruppi to authenticated;
grant insert (id, nome, creato_da) on public.gruppi to authenticated;
grant update (nome) on public.gruppi to authenticated;

-- ---------------------------------------------------------------------------------------------
-- membri_gruppo (F-13, R-15)
-- ---------------------------------------------------------------------------------------------
create table public.membri_gruppo (
  gruppo_id     uuid not null references public.gruppi (id) on delete cascade,
  utente_id     uuid not null references public.profili (id) on delete cascade,
  ruolo         public.ruolo_gruppo not null default 'membro',
  stato         public.stato_membro not null default 'invitato',
  invitato_da   uuid references public.profili (id) on delete set null,
  creato_il     timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  primary key (gruppo_id, utente_id),
  constraint membri_gruppo_admin_attivo check (ruolo = 'membro' or stato = 'attivo')
);
comment on table public.membri_gruppo is
  'Membri e inviti dei gruppi. Invariante delle fasce: R-15.';
create index membri_gruppo_utente_idx on public.membri_gruppo (utente_id);

alter table public.membri_gruppo enable row level security;
revoke all on public.membri_gruppo from anon, authenticated;
grant select, delete on public.membri_gruppo to authenticated;
grant insert (gruppo_id, utente_id, ruolo, stato, invitato_da) on public.membri_gruppo to authenticated;
grant update (stato, ruolo) on public.membri_gruppo to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Funzioni di supporto alle policy (DATA_MODEL.md §4)
-- ---------------------------------------------------------------------------------------------
create or replace function private.e_membro_attivo(gruppo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membri_gruppo m
    where m.gruppo_id = gruppo and m.utente_id = auth.uid() and m.stato = 'attivo'
  );
$$;

create or replace function private.e_membro(gruppo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membri_gruppo m
    where m.gruppo_id = gruppo and m.utente_id = auth.uid()
  );
$$;

create or replace function private.e_admin_gruppo(gruppo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.membri_gruppo m
    where m.gruppo_id = gruppo and m.utente_id = auth.uid()
      and m.stato = 'attivo' and m.ruolo = 'admin'
  );
$$;

-- R-15: ogni membro (invitato o attivo) diverso da `utente` non ha blocchi con lui ed è della
-- stessa fascia oppure suo amico confermato; il gruppo ha posto (30 membri compresi gli
-- invitati); l'account è attivo (R-55).
create or replace function private.puo_entrare_nel_gruppo(gruppo uuid, utente uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.account_attivo(utente)
    and (select count(*) from public.membri_gruppo m
         where m.gruppo_id = gruppo and m.utente_id <> utente) < 30
    and not exists (
      select 1 from public.membri_gruppo m
      where m.gruppo_id = gruppo and m.utente_id <> utente
        and (private.c_e_blocco(m.utente_id, utente)
             or (not private.stessa_fascia(m.utente_id, utente)
                 and not private.sono_amici(m.utente_id, utente)))
    );
$$;

-- R-24: l'evento è visibile a ogni membro attivo del gruppo.
create or replace function private.evento_adatto_al_gruppo(evento uuid, gruppo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.membri_gruppo m
    where m.gruppo_id = gruppo and m.stato = 'attivo'
      and not private.evento_visibile_a(evento, m.utente_id)
  );
$$;

-- Numero dei membri (invitati compresi) per chi è membro o invitato: l'invitato non vede le
-- righe degli altri, ma l'invito mostra quante persone ci sono.
create or replace function private.conta_membri(gruppo uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.e_membro(gruppo)
              then (select count(*)::integer from public.membri_gruppo m where m.gruppo_id = gruppo)
         end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Policy di gruppi e membri_gruppo
-- ---------------------------------------------------------------------------------------------
-- R-11: l'invitato vede il gruppo per decidere se entrare; nessun elenco di gruppi altrui.
create policy "gruppi: i membri e gli invitati vedono il gruppo"
  on public.gruppi for select to authenticated
  using ((select private.e_membro(id)));

-- R-55: un account sospeso non crea gruppi.
create policy "gruppi: un account attivo crea un gruppo a proprio nome"
  on public.gruppi for insert to authenticated
  with check (
    creato_da = (select auth.uid())
    and (select private.account_attivo((select auth.uid())))
  );

create policy "gruppi: un admin rinomina"
  on public.gruppi for update to authenticated
  using ((select private.e_admin_gruppo(id)))
  with check ((select private.e_admin_gruppo(id)));

create policy "gruppi: un admin elimina"
  on public.gruppi for delete to authenticated
  using ((select private.e_admin_gruppo(id)));

-- R-13, R-15: i membri attivi vedono tutti i membri; un invitato vede solo la propria riga
-- (l'anteprima dell'invito mostra solo le persone che conosce già).
create policy "membri_gruppo: i membri attivi vedono i membri, ognuno la propria riga"
  on public.membri_gruppo for select to authenticated
  using (utente_id = (select auth.uid()) or (select private.e_membro_attivo(gruppo_id)));

-- R-11, R-15: un membro attivo invita un amico confermato compatibile con tutti i membri.
create policy "membri_gruppo: un membro attivo invita un amico compatibile"
  on public.membri_gruppo for insert to authenticated
  with check (
    invitato_da = (select auth.uid())
    and stato = 'invitato'
    and ruolo = 'membro'
    and (select private.e_membro_attivo(gruppo_id))
    and (select private.account_attivo((select auth.uid())))
    and private.sono_amici((select auth.uid()), utente_id)
    and private.puo_entrare_nel_gruppo(gruppo_id, utente_id)
  );

-- R-11: solo l'invitato accetta il proprio invito.
create policy "membri_gruppo: l'invitato accetta"
  on public.membri_gruppo for update to authenticated
  using (utente_id = (select auth.uid()) and stato = 'invitato')
  with check (utente_id = (select auth.uid()) and stato = 'attivo');

create policy "membri_gruppo: un admin cambia il ruolo dei membri attivi"
  on public.membri_gruppo for update to authenticated
  using ((select private.e_admin_gruppo(gruppo_id)) and stato = 'attivo')
  with check ((select private.e_admin_gruppo(gruppo_id)) and stato = 'attivo');

create policy "membri_gruppo: si esce, si rifiuta un invito o un admin toglie"
  on public.membri_gruppo for delete to authenticated
  using (utente_id = (select auth.uid()) or (select private.e_admin_gruppo(gruppo_id)));

-- ---------------------------------------------------------------------------------------------
-- Trigger di gruppi e membri_gruppo
-- ---------------------------------------------------------------------------------------------
create trigger gruppi_aggiornato_il
  before update on public.gruppi
  for each row execute function private.imposta_aggiornato_il();

create trigger membri_gruppo_aggiornato_il
  before update on public.membri_gruppo
  for each row execute function private.imposta_aggiornato_il();

-- Limite anti-abuso (come R-14): al massimo 10 gruppi creati ogni 24 ore. Registra chi ha
-- scritto il nome; quando un moderatore lo rimuove l'autore resta, perché riceve la decisione e
-- può presentare reclamo.
create or replace function private.prepara_gruppo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.gruppi g
        where g.creato_da = new.creato_da and g.creato_il > now() - interval '24 hours') >= 10 then
      raise exception using errcode = 'NX045', message = 'Troppi gruppi creati nelle ultime 24 ore.';
    end if;
  end if;
  if tg_op = 'INSERT' or new.nome is distinct from old.nome then
    new.nome_scritto_da := case
      when coalesce(current_setting('noxa.operazione_moderazione', true), '') = 'consentita'
        then old.nome_scritto_da
      else auth.uid()
    end;
  end if;
  return new;
end;
$$;

create trigger gruppi_prepara
  before insert or update of nome on public.gruppi
  for each row execute function private.prepara_gruppo();

-- Chi crea il gruppo ne è admin.
create or replace function private.aggiungi_creatore_gruppo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.membri_gruppo (gruppo_id, utente_id, ruolo, stato)
  values (new.id, new.creato_da, 'admin', 'attivo');
  return null;
end;
$$;

create trigger gruppi_aggiungi_creatore
  after insert on public.gruppi
  for each row execute function private.aggiungi_creatore_gruppo();

-- R-15: controlli dell'invito con un codice d'errore preciso per l'app (la policy li ripete).
-- Le operazioni di sistema (creatore admin, promozione automatica) non passano da qui.
create or replace function private.verifica_invito_gruppo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stato <> 'invitato' then
    return new;
  end if;
  if (select count(*) from public.membri_gruppo m
      where m.gruppo_id = new.gruppo_id and m.utente_id <> new.utente_id) >= 30 then
    raise exception using errcode = 'NX037', message = 'Il gruppo è pieno (30 membri).';
  end if;
  if exists (select 1 from public.membri_gruppo m
             where m.gruppo_id = new.gruppo_id and m.utente_id = new.utente_id) then
    raise exception using errcode = 'NX038', message = 'Persona già nel gruppo.';
  end if;
  if not private.sono_amici(new.invitato_da, new.utente_id)
     or not private.puo_entrare_nel_gruppo(new.gruppo_id, new.utente_id) then
    raise exception using errcode = 'NX038', message = 'Questa persona non può entrare nel gruppo.';
  end if;
  return new;
end;
$$;

create trigger membri_gruppo_verifica_invito
  before insert on public.membri_gruppo
  for each row execute function private.verifica_invito_gruppo();

-- Stato e ruolo cambiano solo così: l'invitato accetta (R-11, con l'invariante ricontrollata,
-- R-15); un admin cambia il ruolo di un membro attivo. Le operazioni di sistema (nuovo admin
-- quando esce l'ultimo) impostano noxa.operazione_gruppi.
create or replace function private.proteggi_membri_gruppo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('noxa.operazione_gruppi', true), '') = 'sistema' then
    return new;
  end if;
  if new.stato is distinct from old.stato then
    if not (old.stato = 'invitato' and new.stato = 'attivo' and new.utente_id = auth.uid()) then
      raise exception using errcode = 'NX044', message = 'Cambio di stato non previsto.';
    end if;
    if not private.puo_entrare_nel_gruppo(new.gruppo_id, new.utente_id) then
      raise exception using errcode = 'NX038', message = 'L''invito non è più valido.';
    end if;
  end if;
  if new.ruolo is distinct from old.ruolo
     and (old.stato <> 'attivo' or not private.e_admin_gruppo(new.gruppo_id)) then
    raise exception using errcode = 'NX044', message = 'Solo un admin cambia i ruoli.';
  end if;
  return new;
end;
$$;

create trigger membri_gruppo_proteggi
  before update on public.membri_gruppo
  for each row execute function private.proteggi_membri_gruppo();

-- Un gruppo ha sempre un admin: se esce l'ultimo, diventa admin il membro attivo da più
-- tempo; un gruppo senza membri attivi si elimina con i suoi inviti e le sue serate.
create or replace function private.garantisci_admin_gruppo(gruppo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  successore uuid;
begin
  if not exists (select 1 from public.gruppi g where g.id = gruppo) then
    return;
  end if;
  if not exists (select 1 from public.membri_gruppo m where m.gruppo_id = gruppo and m.stato = 'attivo') then
    delete from public.gruppi g where g.id = gruppo;
    return;
  end if;
  if exists (select 1 from public.membri_gruppo m
             where m.gruppo_id = gruppo and m.stato = 'attivo' and m.ruolo = 'admin') then
    return;
  end if;
  select m.utente_id into successore
  from public.membri_gruppo m
  where m.gruppo_id = gruppo and m.stato = 'attivo'
  order by m.creato_il, m.utente_id
  limit 1;
  perform set_config('noxa.operazione_gruppi', 'sistema', true);
  update public.membri_gruppo m set ruolo = 'admin'
  where m.gruppo_id = gruppo and m.utente_id = successore;
  perform set_config('noxa.operazione_gruppi', '', true);
end;
$$;

-- Notifica dell'invito (F-13): solo identificativi, mai testi scritti da altri utenti.
create or replace function private.notifica_invito_gruppo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stato = 'invitato' then
    perform private.crea_notifica(
      new.utente_id, 'invito_gruppo',
      jsonb_build_object('gruppo_id', new.gruppo_id, 'utente_id', new.invitato_da)
    );
  end if;
  return null;
end;
$$;

create trigger membri_gruppo_notifica_invito
  after insert on public.membri_gruppo
  for each row execute function private.notifica_invito_gruppo();

-- Invito accettato: la notifica non serve più.
create or replace function private.dopo_accettazione_gruppo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.stato = 'invitato' and new.stato = 'attivo' then
    delete from public.notifiche n
    where n.utente_id = new.utente_id and n.tipo = 'invito_gruppo'
      and n.dati @> jsonb_build_object('gruppo_id', new.gruppo_id);
  end if;
  if old.ruolo = 'admin' and new.ruolo = 'membro' then
    perform private.garantisci_admin_gruppo(new.gruppo_id);
  end if;
  return null;
end;
$$;

create trigger membri_gruppo_dopo_aggiornamento
  after update on public.membri_gruppo
  for each row execute function private.dopo_accettazione_gruppo();

-- Uscita, rifiuto, rimozione: spariscono la notifica dell'invito, le risposte alle serate del
-- gruppo e i passaggi offerti; chi è stato tolto riceve una notifica con il motivo (R-15) e
-- con il nome del gruppo, che conosceva già, perché il gruppo non è più visibile. Nessuna
-- notifica dopo un blocco (R-17) o quando si elimina l'intero gruppo.
create or replace function private.dopo_uscita_gruppo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  motivo text := coalesce(nullif(current_setting('noxa.motivo_rimozione', true), ''),
                          case when old.utente_id is distinct from auth.uid() then 'tolto' end);
  nome_gruppo text;
begin
  select g.nome into nome_gruppo from public.gruppi g where g.id = old.gruppo_id;
  if nome_gruppo is null then
    return null;
  end if;
  delete from public.notifiche n
  where n.utente_id = old.utente_id and n.tipo = 'invito_gruppo'
    and n.dati @> jsonb_build_object('gruppo_id', old.gruppo_id);
  update public.partecipazioni_serata p set passaggio_da = null
  where p.passaggio_da = old.utente_id
    and p.serata_id in (select s.id from public.serate_gruppo s where s.gruppo_id = old.gruppo_id);
  delete from public.partecipazioni_serata p
  where p.utente_id = old.utente_id
    and p.serata_id in (select s.id from public.serate_gruppo s where s.gruppo_id = old.gruppo_id);
  if motivo in ('fasce', 'compleanno', 'tolto')
     and exists (select 1 from public.profili p where p.id = old.utente_id) then
    perform private.crea_notifica(
      old.utente_id, 'rimozione_gruppo',
      jsonb_build_object('gruppo_id', old.gruppo_id, 'nome_gruppo', nome_gruppo,
                         'motivo', motivo, 'era_invitato', old.stato = 'invitato')
    );
  end if;
  perform private.garantisci_admin_gruppo(old.gruppo_id);
  return null;
end;
$$;

create trigger membri_gruppo_dopo_uscita
  after delete on public.membri_gruppo
  for each row execute function private.dopo_uscita_gruppo();

-- ---------------------------------------------------------------------------------------------
-- Invariante delle fasce (R-15)
-- ---------------------------------------------------------------------------------------------
-- Per ogni coppia di membri (invitati o attivi) di fasce diverse che non sono amici
-- confermati (anche per un blocco), toglie dal gruppo il maggiorenne. `persone` limita il
-- controllo alle coppie che le contengono; `motivo` null = deciso per ogni rimozione
-- ('compleanno' se il maggiorenne ha 18 anni, altrimenti 'fasce').
create or replace function private.applica_invariante_gruppi(persone uuid[], motivo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  coppia record;
  rimossi integer := 0;
  eliminati integer;
begin
  for coppia in
    select distinct m1.gruppo_id,
           case when private.e_minorenne(m1.utente_id) then m2.utente_id else m1.utente_id end as adulto
    from public.membri_gruppo m1
    join public.membri_gruppo m2 on m2.gruppo_id = m1.gruppo_id and m1.utente_id < m2.utente_id
    where (persone is null or m1.utente_id = any (persone) or m2.utente_id = any (persone))
      and not private.stessa_fascia(m1.utente_id, m2.utente_id)
      and not private.sono_amici(m1.utente_id, m2.utente_id)
  loop
    perform set_config('noxa.motivo_rimozione',
                       coalesce(motivo, case when private.eta_di(coppia.adulto) = 18
                                             then 'compleanno' else 'fasce' end), true);
    delete from public.membri_gruppo m
    where m.gruppo_id = coppia.gruppo_id and m.utente_id = coppia.adulto;
    get diagnostics eliminati = row_count;
    rimossi := rimossi + eliminati;
    perform set_config('noxa.motivo_rimozione', '', true);
  end loop;
  return rimossi;
end;
$$;

-- Job giornaliero: dopo i compleanni dei 18 anni (DATA_MODEL.md §8).
create or replace function private.verifica_invariante_gruppi()
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.applica_invariante_gruppi(null, null);
$$;

select cron.schedule(
  'verifica_invariante_gruppi',
  '0 4 * * *',
  $$select private.verifica_invariante_gruppi()$$
);

-- Un'amicizia rimossa può rompere l'invariante.
create or replace function private.invariante_dopo_amicizia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.stato = 'accettata' then
    perform private.applica_invariante_gruppi(array[old.richiedente_id, old.destinatario_id], 'fasce');
  end if;
  return null;
end;
$$;

create trigger amicizie_invariante_gruppi
  after delete on public.amicizie
  for each row execute function private.invariante_dopo_amicizia();

-- R-17: il blocco toglie amicizie, richieste, notifiche reciproche e gli inviti in attesa nei
-- gruppi in cui c'è l'altra persona (senza notifiche: il blocco è invisibile), poi applica
-- l'invariante (R-15).
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
  delete from public.notifiche n
  where (n.utente_id = new.bloccante_id
         and n.dati @> jsonb_build_object('utente_id', new.bloccato_id))
     or (n.utente_id = new.bloccato_id
         and n.dati @> jsonb_build_object('utente_id', new.bloccante_id));
  perform set_config('noxa.motivo_rimozione', 'blocco', true);
  delete from public.membri_gruppo m
  where m.stato = 'invitato'
    and ((m.utente_id = new.bloccato_id
          and exists (select 1 from public.membri_gruppo a
                      where a.gruppo_id = m.gruppo_id and a.utente_id = new.bloccante_id))
      or (m.utente_id = new.bloccante_id
          and exists (select 1 from public.membri_gruppo a
                      where a.gruppo_id = m.gruppo_id and a.utente_id = new.bloccato_id)));
  perform set_config('noxa.motivo_rimozione', '', true);
  perform private.applica_invariante_gruppi(array[new.bloccante_id, new.bloccato_id], 'fasce');
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Visibilità dei profili (R-10, R-13, R-17, R-55): si aggiungono i membri dei propri gruppi.
-- Chi è membro attivo vede i membri e gli invitati; un invitato vede solo chi conosce già.
-- Grazie a R-15 due membri di fasce diverse sono sempre amici confermati.
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
      private.account_attivo(auth.uid())
      and not private.c_e_blocco(auth.uid(), target)
      and private.account_attivo(target)
      and (
        private.sono_amici(auth.uid(), target)
        or private.c_e_richiesta(auth.uid(), target)
        or exists (
          select 1
          from public.membri_gruppo io
          join public.membri_gruppo altro on altro.gruppo_id = io.gruppo_id
          where io.utente_id = auth.uid() and io.stato = 'attivo' and altro.utente_id = target
        )
      )
    );
$$;

-- ---------------------------------------------------------------------------------------------
-- serate_gruppo (F-14, F-15, R-16, R-24)
-- ---------------------------------------------------------------------------------------------
create table public.serate_gruppo (
  id               uuid primary key default gen_random_uuid(),
  gruppo_id        uuid not null references public.gruppi (id) on delete cascade,
  evento_id        uuid references public.eventi (id) on delete set null,
  titolo           text constraint serate_gruppo_titolo
                   check (titolo is null or (char_length(titolo) between 1 and 80 and titolo = btrim(titolo))),
  data_serata      date not null,
  ora_ritrovo      time,
  luogo_ritrovo    text constraint serate_gruppo_luogo check (char_length(luogo_ritrovo) <= 120),
  url_prevendita   text constraint serate_gruppo_url_prevendita
                   check (url_prevendita ~ '^https://\S+$' and char_length(url_prevendita) <= 500),
  url_lista        text constraint serate_gruppo_url_lista
                   check (url_lista ~ '^https://\S+$' and char_length(url_lista) <= 500),
  note             text constraint serate_gruppo_note check (char_length(note) <= 500),
  stato            public.stato_serata not null default 'proposta',
  creata_da        uuid references public.profili (id) on delete set null,
  -- Chi ha scritto gli ultimi testi (titolo, luogo, note): riceve la decisione se un
  -- moderatore li rimuove (R-52).
  testi_scritti_da uuid references public.profili (id) on delete set null,
  creata_il        timestamptz not null default now(),
  aggiornata_il    timestamptz not null default now(),
  constraint serate_gruppo_titolo_o_evento check (evento_id is not null or titolo is not null)
);
comment on table public.serate_gruppo is
  'Serate di gruppo: evento adatto a tutti i membri o serata libera (R-24); testi brevi e segnalabili (R-16).';
create index serate_gruppo_gruppo_idx on public.serate_gruppo (gruppo_id, data_serata);
create index serate_gruppo_evento_idx on public.serate_gruppo (evento_id);

alter table public.serate_gruppo enable row level security;
revoke all on public.serate_gruppo from anon, authenticated;
grant select, delete on public.serate_gruppo to authenticated;
grant insert (gruppo_id, evento_id, titolo, data_serata, ora_ritrovo, luogo_ritrovo,
              url_prevendita, url_lista, note, creata_da)
  on public.serate_gruppo to authenticated;
grant update (evento_id, titolo, data_serata, ora_ritrovo, luogo_ritrovo, url_prevendita,
              url_lista, note, stato)
  on public.serate_gruppo to authenticated;

-- R-24: solo i membri attivi, e solo se l'evento (quando c'è) è visibile a chi guarda.
create policy "serate_gruppo: i membri attivi vedono le serate con un evento visibile"
  on public.serate_gruppo for select to authenticated
  using (
    (select private.e_membro_attivo(gruppo_id))
    and (evento_id is null or private.evento_visibile_a(evento_id, (select auth.uid())))
  );

-- R-24: l'evento deve essere visibile a tutti i membri attivi al momento della proposta.
create policy "serate_gruppo: un membro attivo propone una serata adatta a tutti"
  on public.serate_gruppo for insert to authenticated
  with check (
    creata_da = (select auth.uid())
    and (select private.e_membro_attivo(gruppo_id))
    and (select private.account_attivo((select auth.uid())))
    and (evento_id is null or private.evento_adatto_al_gruppo(evento_id, gruppo_id))
  );

-- Chi ha proposto o un admin; un nuovo evento passa dal controllo di R-24 nel trigger.
create policy "serate_gruppo: chi ha proposto o un admin modifica"
  on public.serate_gruppo for update to authenticated
  using (
    (creata_da = (select auth.uid()) or (select private.e_admin_gruppo(gruppo_id)))
    and (evento_id is null or private.evento_visibile_a(evento_id, (select auth.uid())))
  )
  with check (
    (creata_da = (select auth.uid()) or (select private.e_admin_gruppo(gruppo_id)))
    and (select private.account_attivo((select auth.uid())))
  );

create policy "serate_gruppo: chi ha proposto o un admin elimina"
  on public.serate_gruppo for delete to authenticated
  using (
    (creata_da = (select auth.uid()) or (select private.e_admin_gruppo(gruppo_id)))
    and (evento_id is null or private.evento_visibile_a(evento_id, (select auth.uid())))
  );

create or replace function private.imposta_aggiornata_il()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.aggiornata_il := now();
  return new;
end;
$$;

create trigger serate_gruppo_aggiornata_il
  before update on public.serate_gruppo
  for each row execute function private.imposta_aggiornata_il();

-- Data e link presi dall'evento; niente serate nel passato; stati: proposta → confermata,
-- proposta o confermata → annullata (definitivo); una serata annullata o passata è in sola
-- lettura; un nuovo evento deve essere adatto a tutto il gruppo (R-24).
create or replace function private.prepara_serata_gruppo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  oggi date := ((now() at time zone 'Europe/Rome') - interval '6 hours')::date;
  ev public.eventi%rowtype;
begin
  -- Un moderatore che rimuove un testo (R-52) può farlo anche su una serata conclusa.
  if tg_op = 'UPDATE'
     and coalesce(current_setting('noxa.operazione_moderazione', true), '') = 'consentita' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.stato = 'annullata' or old.data_serata < oggi then
      raise exception using errcode = 'NX026', message = 'La serata è conclusa o annullata.';
    end if;
    if new.stato is distinct from old.stato
       and not (old.stato = 'proposta' and new.stato in ('confermata', 'annullata'))
       and not (old.stato = 'confermata' and new.stato = 'annullata') then
      raise exception using errcode = 'NX026', message = 'Cambio di stato non previsto.';
    end if;
    if new.evento_id is distinct from old.evento_id and new.evento_id is not null
       and not private.evento_adatto_al_gruppo(new.evento_id, new.gruppo_id) then
      raise exception using errcode = 'NX043', message = 'Evento non adatto a tutto il gruppo.';
    end if;
  end if;

  if new.evento_id is not null
     and (tg_op = 'INSERT' or new.evento_id is distinct from old.evento_id) then
    select * into ev from public.eventi e where e.id = new.evento_id;
    if ev.stato <> 'pubblicato' then
      raise exception using errcode = 'NX043', message = 'Evento non disponibile.';
    end if;
    new.data_serata := ev.data_serata;
    if new.url_prevendita is null and ev.url_biglietti ~ '^https://\S+$' then
      new.url_prevendita := ev.url_biglietti;
    end if;
  end if;

  if tg_op = 'INSERT' and new.data_serata < oggi then
    raise exception using errcode = 'NX042', message = 'La data è già passata.';
  end if;
  if tg_op = 'UPDATE' and new.data_serata is distinct from old.data_serata and new.data_serata < oggi then
    raise exception using errcode = 'NX042', message = 'La data è già passata.';
  end if;

  new.titolo := nullif(btrim(new.titolo), '');
  new.luogo_ritrovo := nullif(btrim(new.luogo_ritrovo), '');
  new.note := nullif(btrim(new.note), '');
  if tg_op = 'INSERT'
     or new.titolo is distinct from old.titolo
     or new.luogo_ritrovo is distinct from old.luogo_ritrovo
     or new.note is distinct from old.note then
    new.testi_scritti_da := case
      when coalesce(current_setting('noxa.operazione_moderazione', true), '') = 'consentita'
        then old.testi_scritti_da
      else auth.uid()
    end;
  end if;
  return new;
end;
$$;

create trigger serate_gruppo_prepara
  before insert or update on public.serate_gruppo
  for each row execute function private.prepara_serata_gruppo();

-- Notifiche (F-14): nuova serata a tutti i membri attivi che possono vederla (R-24); stato o
-- ritrovo cambiati a chi può vederla, tranne chi ha fatto la modifica. Solo identificativi.
create or replace function private.notifica_serata_gruppo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cambio text;
  membro uuid;
begin
  if coalesce(current_setting('noxa.operazione_moderazione', true), '') = 'consentita' then
    return null;
  end if;
  if tg_op = 'INSERT' then
    cambio := null;
  elsif new.stato is distinct from old.stato then
    cambio := new.stato::text;
  elsif new.data_serata is distinct from old.data_serata
     or new.ora_ritrovo is distinct from old.ora_ritrovo
     or new.luogo_ritrovo is distinct from old.luogo_ritrovo
     or new.evento_id is distinct from old.evento_id then
    cambio := 'modificata';
  else
    return null;
  end if;
  for membro in
    select m.utente_id from public.membri_gruppo m
    where m.gruppo_id = new.gruppo_id and m.stato = 'attivo'
      and m.utente_id is distinct from auth.uid()
      and (new.evento_id is null or private.evento_visibile_a(new.evento_id, m.utente_id))
  loop
    if tg_op = 'INSERT' then
      perform private.crea_notifica(membro, 'nuova_serata',
        jsonb_build_object('serata_id', new.id, 'gruppo_id', new.gruppo_id));
    else
      perform private.crea_notifica(membro, 'aggiornamento_serata',
        jsonb_build_object('serata_id', new.id, 'gruppo_id', new.gruppo_id, 'cambio', cambio));
    end if;
  end loop;
  return null;
end;
$$;

create trigger serate_gruppo_notifica
  after insert or update on public.serate_gruppo
  for each row execute function private.notifica_serata_gruppo();

-- Serata eliminata: spariscono le sue notifiche.
create or replace function private.rimuovi_notifiche_serata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifiche n
  where n.tipo in ('nuova_serata', 'aggiornamento_serata')
    and n.dati @> jsonb_build_object('serata_id', old.id);
  return null;
end;
$$;

create trigger serate_gruppo_rimuovi_notifiche
  after delete on public.serate_gruppo
  for each row execute function private.rimuovi_notifiche_serata();

-- ---------------------------------------------------------------------------------------------
-- partecipazioni_serata (F-14, F-15, F-16)
-- ---------------------------------------------------------------------------------------------
create table public.partecipazioni_serata (
  serata_id         uuid not null references public.serate_gruppo (id) on delete cascade,
  utente_id         uuid not null references public.profili (id) on delete cascade,
  risposta          public.risposta_serata not null,
  biglietto         public.stato_biglietto not null default 'nessuno',
  trasporto_andata  public.mezzo_trasporto,
  trasporto_ritorno public.mezzo_trasporto,
  posti_liberi      smallint constraint partecipazioni_serata_posti check (posti_liberi between 0 and 8),
  passaggio_da      uuid references public.profili (id) on delete set null,
  aggiornato_il     timestamptz not null default now(),
  primary key (serata_id, utente_id),
  constraint partecipazioni_serata_posti_solo_guida check (
    posti_liberi is null or trasporto_andata = 'auto_guido' or trasporto_ritorno = 'auto_guido'
  ),
  constraint partecipazioni_serata_passaggio check (
    passaggio_da is null
    or ((trasporto_andata = 'passaggio' or trasporto_ritorno = 'passaggio') and passaggio_da <> utente_id)
  )
);
comment on table public.partecipazioni_serata is
  'Risposte, biglietto e trasporto dei membri di una serata di gruppo (F-14, F-15, F-16).';
create index partecipazioni_serata_utente_idx on public.partecipazioni_serata (utente_id);
create index partecipazioni_serata_passaggio_idx on public.partecipazioni_serata (serata_id, passaggio_da);

alter table public.partecipazioni_serata enable row level security;
revoke all on public.partecipazioni_serata from anon, authenticated;
grant select, delete on public.partecipazioni_serata to authenticated;
grant insert (serata_id, utente_id, risposta, biglietto, trasporto_andata, trasporto_ritorno,
              posti_liberi, passaggio_da)
  on public.partecipazioni_serata to authenticated;
grant update (risposta, biglietto, trasporto_andata, trasporto_ritorno, posti_liberi, passaggio_da)
  on public.partecipazioni_serata to authenticated;

-- R-24 (la serata dev'essere visibile) e R-17 (le risposte di chi è bloccato non si vedono).
create policy "partecipazioni_serata: chi vede la serata vede le risposte"
  on public.partecipazioni_serata for select to authenticated
  using (
    exists (select 1 from public.serate_gruppo s where s.id = serata_id)
    and (utente_id = (select auth.uid()) or not private.c_e_blocco((select auth.uid()), utente_id))
  );

create policy "partecipazioni_serata: ognuno risponde per sé a una serata visibile"
  on public.partecipazioni_serata for insert to authenticated
  with check (
    utente_id = (select auth.uid())
    and (select private.account_attivo((select auth.uid())))
    and exists (select 1 from public.serate_gruppo s where s.id = serata_id)
  );

create policy "partecipazioni_serata: ognuno cambia la propria risposta"
  on public.partecipazioni_serata for update to authenticated
  using (utente_id = (select auth.uid()) and exists (select 1 from public.serate_gruppo s where s.id = serata_id))
  with check (
    utente_id = (select auth.uid())
    and (select private.account_attivo((select auth.uid())))
    and exists (select 1 from public.serate_gruppo s where s.id = serata_id)
  );

create policy "partecipazioni_serata: ognuno toglie la propria risposta"
  on public.partecipazioni_serata for delete to authenticated
  using (utente_id = (select auth.uid()));

create trigger partecipazioni_serata_aggiornato_il
  before update on public.partecipazioni_serata
  for each row execute function private.imposta_aggiornato_il();

-- F-16: "guido" solo per i maggiorenni (età legale per la patente B); i posti valgono solo per
-- chi guida, il passaggio solo verso chi guida nella stessa serata e ha ancora posto; nessun
-- passaggio tra persone che si sono bloccate (R-17). La serata dev'essere aperta.
create or replace function private.verifica_trasporto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  oggi date := ((now() at time zone 'Europe/Rome') - interval '6 hours')::date;
  guida boolean := 'auto_guido' in (new.trasporto_andata, new.trasporto_ritorno);
  conducente public.partecipazioni_serata%rowtype;
  occupati integer;
begin
  -- Togliere un passaggio che non c'è più (chi guidava ha cambiato idea o è uscito dal gruppo)
  -- è sempre possibile, anche su una serata conclusa.
  if tg_op = 'UPDATE' and new.passaggio_da is null and old.passaggio_da is not null
     and (new.risposta, new.biglietto, new.trasporto_andata, new.trasporto_ritorno, new.posti_liberi)
         is not distinct from
         (old.risposta, old.biglietto, old.trasporto_andata, old.trasporto_ritorno, old.posti_liberi) then
    return new;
  end if;
  if exists (select 1 from public.serate_gruppo s
             where s.id = new.serata_id and (s.stato = 'annullata' or s.data_serata < oggi)) then
    raise exception using errcode = 'NX026', message = 'La serata è conclusa o annullata.';
  end if;
  if not guida then
    new.posti_liberi := null;
  elsif new.posti_liberi is null then
    new.posti_liberi := 0;
  end if;
  if 'passaggio' not in (coalesce(new.trasporto_andata, 'altro'), coalesce(new.trasporto_ritorno, 'altro')) then
    new.passaggio_da := null;
  end if;

  if guida and coalesce(private.eta_di(new.utente_id), 0) < 18 then
    raise exception using errcode = 'NX040', message = 'Solo chi è maggiorenne può guidare.';
  end if;

  if guida then
    select count(*) into occupati from public.partecipazioni_serata p
    where p.serata_id = new.serata_id and p.passaggio_da = new.utente_id and p.utente_id <> new.utente_id;
    if new.posti_liberi < occupati then
      raise exception using errcode = 'NX041', message = 'I posti sono meno dei passaggi già scelti.';
    end if;
  end if;

  if new.passaggio_da is not null
     and (tg_op = 'INSERT' or new.passaggio_da is distinct from old.passaggio_da) then
    select * into conducente from public.partecipazioni_serata p
    where p.serata_id = new.serata_id and p.utente_id = new.passaggio_da
    for update;
    if conducente.utente_id is null
       or conducente.risposta = 'no'
       or 'auto_guido' not in (coalesce(conducente.trasporto_andata, 'altro'),
                               coalesce(conducente.trasporto_ritorno, 'altro'))
       or private.c_e_blocco(new.utente_id, new.passaggio_da) then
      raise exception using errcode = 'NX039', message = 'Passaggio non disponibile.';
    end if;
    select count(*) into occupati from public.partecipazioni_serata p
    where p.serata_id = new.serata_id and p.passaggio_da = new.passaggio_da and p.utente_id <> new.utente_id;
    if occupati >= coalesce(conducente.posti_liberi, 0) then
      raise exception using errcode = 'NX041', message = 'Non ci sono più posti in quest''auto.';
    end if;
  end if;
  return new;
end;
$$;

create trigger partecipazioni_serata_verifica_trasporto
  before insert or update on public.partecipazioni_serata
  for each row execute function private.verifica_trasporto();

-- Chi non guida più (o dice di no, o toglie la risposta) libera i passaggi che offriva.
create or replace function private.libera_passaggi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     or new.risposta = 'no'
     or 'auto_guido' not in (coalesce(new.trasporto_andata, 'altro'), coalesce(new.trasporto_ritorno, 'altro')) then
    update public.partecipazioni_serata p set passaggio_da = null
    where p.serata_id = coalesce(new.serata_id, old.serata_id)
      and p.passaggio_da = coalesce(new.utente_id, old.utente_id);
  end if;
  return null;
end;
$$;

create trigger partecipazioni_serata_libera_passaggi
  after update or delete on public.partecipazioni_serata
  for each row execute function private.libera_passaggi();

-- ---------------------------------------------------------------------------------------------
-- Realtime (ARCHITECTURE.md §4.3): la RLS filtra le righe inviate a ogni sessione.
-- ---------------------------------------------------------------------------------------------
alter publication supabase_realtime add table public.partecipazioni_serata;
alter publication supabase_realtime add table public.serate_gruppo;
alter publication supabase_realtime add table public.membri_gruppo;

-- ---------------------------------------------------------------------------------------------
-- RPC di scrittura (security invoker: valgono le policy)
-- ---------------------------------------------------------------------------------------------
-- Invita una persona alla volta, così ogni invito vede quelli precedenti (R-15).
create or replace function public.invita_nel_gruppo(gruppo uuid, invitati uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  persona uuid;
  inviati integer := 0;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  foreach persona in array coalesce(invitati, '{}') loop
    insert into public.membri_gruppo (gruppo_id, utente_id, invitato_da)
    values (gruppo, persona, auth.uid());
    inviati := inviati + 1;
  end loop;
  return inviati;
end;
$$;

-- Crea il gruppo e invia gli inviti in un'unica transazione.
create or replace function public.crea_gruppo(nome text, invitati uuid[] default '{}')
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  nuovo uuid := gen_random_uuid();
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  insert into public.gruppi (id, nome, creato_da) values (nuovo, btrim(crea_gruppo.nome), auth.uid());
  perform public.invita_nel_gruppo(nuovo, invitati);
  return nuovo;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RPC di lettura
-- ---------------------------------------------------------------------------------------------
-- Persona in forma JSON per le RPC: la foto nascosta in attesa di revisione non si restituisce
-- (ADR-0023).
create or replace function private.persona_json(p public.profili)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object('id', p.id, 'username', p.username,
                            'nome_visualizzato', p.nome_visualizzato,
                            'avatar_path', case when not p.avatar_nascosto then p.avatar_path end);
$$;

-- I miei gruppi e i miei inviti (security invoker: RLS di gruppi, membri, profili e serate).
create or replace function public.miei_gruppi()
returns table (
  id uuid,
  nome text,
  mio_ruolo public.ruolo_gruppo,
  mio_stato public.stato_membro,
  membri integer,
  primi jsonb,
  invitato_da jsonb,
  prossima jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.id, g.nome, io.ruolo, io.stato, private.conta_membri(g.id),
         coalesce((
           select jsonb_agg(private.persona_json(p) order by m.creato_il, p.id)
           from (select * from public.membri_gruppo m2
                 where m2.gruppo_id = g.id and m2.stato = 'attivo'
                 order by m2.creato_il limit 4) m
           join public.profili p on p.id = m.utente_id
         ), '[]'::jsonb),
         (select private.persona_json(p) from public.profili p where p.id = io.invitato_da),
         (select jsonb_build_object('id', s.id, 'data_serata', s.data_serata,
                                    'titolo', coalesce(s.titolo, e.titolo))
          from public.serate_gruppo s
          left join public.eventi e on e.id = s.evento_id
          where s.gruppo_id = g.id and s.stato <> 'annullata'
            and s.data_serata >= ((now() at time zone 'Europe/Rome') - interval '6 hours')::date
          order by s.data_serata, s.ora_ritrovo nulls last, s.id
          limit 1)
  from public.membri_gruppo io
  join public.gruppi g on g.id = io.gruppo_id
  where io.utente_id = auth.uid()
  order by io.stato = 'attivo', g.nome, g.id;
$$;

-- Dettaglio di un gruppo per un membro attivo (security invoker). I membri il cui profilo non
-- si vede (blocco, R-17) sono contati in `altri`.
create or replace function public.dettaglio_gruppo(gruppo uuid)
returns table (
  id uuid,
  nome text,
  mio_ruolo public.ruolo_gruppo,
  creato_da jsonb,
  membri_totale integer,
  membri jsonb,
  altri integer,
  serate jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with oggi as (
    select ((now() at time zone 'Europe/Rome') - interval '6 hours')::date as giorno
  )
  select g.id, g.nome, io.ruolo,
         (select private.persona_json(p) from public.profili p where p.id = g.creato_da),
         (select count(*)::integer from public.membri_gruppo m where m.gruppo_id = g.id),
         coalesce((
           select jsonb_agg(private.persona_json(p)
                            || jsonb_build_object('ruolo', m.ruolo, 'stato', m.stato)
                            order by m.utente_id <> auth.uid(), m.ruolo, m.stato desc,
                                     p.nome_visualizzato, p.id)
           from public.membri_gruppo m
           join public.profili p on p.id = m.utente_id
           where m.gruppo_id = g.id
         ), '[]'::jsonb),
         (select count(*)::integer from public.membri_gruppo m
          where m.gruppo_id = g.id
            and not exists (select 1 from public.profili p where p.id = m.utente_id)),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', s.id, 'titolo', coalesce(s.titolo, e.titolo), 'data_serata', s.data_serata,
                    'ora_ritrovo', s.ora_ritrovo, 'stato', s.stato, 'locale_nome', l.nome,
                    'locale_comune', l.comune, 'passata', s.data_serata < (select giorno from oggi),
                    'si', (select count(*) from public.partecipazioni_serata x
                           where x.serata_id = s.id and x.risposta = 'si'),
                    'forse', (select count(*) from public.partecipazioni_serata x
                              where x.serata_id = s.id and x.risposta = 'forse'),
                    'mia_risposta', (select x.risposta from public.partecipazioni_serata x
                                     where x.serata_id = s.id and x.utente_id = auth.uid()))
                  order by s.data_serata, s.ora_ritrovo nulls last, s.id)
           from public.serate_gruppo s
           left join public.eventi e on e.id = s.evento_id
           left join public.locali l on l.id = e.locale_id
           where s.gruppo_id = g.id
         ), '[]'::jsonb)
  from public.gruppi g
  join public.membri_gruppo io on io.gruppo_id = g.id and io.utente_id = auth.uid() and io.stato = 'attivo'
  where g.id = dettaglio_gruppo.gruppo;
$$;

-- Anteprima di un invito ricevuto (security definer: l'invitato non vede ancora i membri).
-- Mostra solo le persone che chi è invitato può già vedere (amici, R-13) e degli altri il
-- numero; `valido` dice se l'invito si può ancora accettare (R-15, gruppo pieno).
create or replace function public.anteprima_invito_gruppo(gruppo uuid)
returns table (
  stato text,
  nome text,
  invitato_da jsonb,
  membri integer,
  conosciuti jsonb,
  altri integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  invito public.membri_gruppo%rowtype;
begin
  if utente is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  select * into invito from public.membri_gruppo m
  where m.gruppo_id = anteprima_invito_gruppo.gruppo and m.utente_id = utente;
  if invito.gruppo_id is null or invito.stato <> 'invitato' then
    return query select 'non_valido', null::text, null::jsonb, null::integer, '[]'::jsonb, null::integer;
    return;
  end if;
  return query
  select case when private.puo_entrare_nel_gruppo(invito.gruppo_id, utente) then 'valido'
              else 'non_valido' end,
         g.nome,
         (select private.persona_json(p) from public.profili p
          where p.id = invito.invitato_da and private.puo_vedere_profilo(p.id)),
         (select count(*)::integer from public.membri_gruppo m where m.gruppo_id = g.id),
         coalesce((
           select jsonb_agg(private.persona_json(p) order by p.nome_visualizzato, p.id)
           from public.membri_gruppo m
           join public.profili p on p.id = m.utente_id
           where m.gruppo_id = g.id and m.utente_id <> utente and private.puo_vedere_profilo(p.id)
         ), '[]'::jsonb),
         (select count(*)::integer from public.membri_gruppo m
          where m.gruppo_id = g.id and m.utente_id <> utente and not private.puo_vedere_profilo(m.utente_id))
  from public.gruppi g
  where g.id = invito.gruppo_id;
end;
$$;

-- I miei amici confermati con il motivo per cui non si possono invitare (R-15), tenendo conto
-- dei membri del gruppo (se c'è) e delle persone già selezionate. Il motivo non dice con chi
-- c'è l'incompatibilità: 'fasce' (non è amico di tutte le persone dell'altra fascia),
-- 'non_disponibile' (blocco o account non attivo, senza dire quale), 'gia_nel_gruppo',
-- 'invito_in_attesa', 'pieno'. Security definer perché confronta amicizie tra altre persone;
-- restituisce solo i propri amici.
create or replace function public.amici_invitabili(gruppo uuid default null, selezionati uuid[] default '{}')
returns table (
  id uuid,
  username text,
  nome_visualizzato text,
  avatar_path text,
  motivo text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  scelti uuid[];
  occupati integer;
begin
  if utente is null then
    raise exception using errcode = '42501', message = 'Serve un account.';
  end if;
  -- Solo i propri amici contano come selezionati: nessuna informazione su altre persone.
  scelti := array(select distinct s from unnest(coalesce(selezionati, '{}')) s
                  where private.sono_amici(utente, s));
  if gruppo is not null and not private.e_membro_attivo(gruppo) then
    raise exception using errcode = '42501', message = 'Non fai parte di questo gruppo.';
  end if;
  occupati := case when gruppo is null then 1
                   else (select count(*)::integer from public.membri_gruppo m where m.gruppo_id = gruppo) end;
  return query
  with amici as (
    select p.*
    from public.amicizie f
    join public.profili p
      on p.id = case when f.richiedente_id = utente then f.destinatario_id else f.richiedente_id end
    where f.stato = 'accettata' and utente in (f.richiedente_id, f.destinatario_id)
      and not private.c_e_blocco(utente, p.id)
  ),
  altri as (
    -- Persone con cui l'amico deve essere compatibile: membri del gruppo (o io, se il gruppo
    -- è da creare) e le altre persone selezionate.
    select m.utente_id as persona from public.membri_gruppo m where m.gruppo_id = gruppo
    union
    select utente where gruppo is null
    union
    select unnest(scelti)
  )
  select a.id, a.username::text, a.nome_visualizzato,
         case when not a.avatar_nascosto then a.avatar_path end,
         case
           when gruppo is not null and exists (select 1 from public.membri_gruppo m
                                               where m.gruppo_id = gruppo and m.utente_id = a.id
                                                 and m.stato = 'attivo') then 'gia_nel_gruppo'
           when gruppo is not null and exists (select 1 from public.membri_gruppo m
                                               where m.gruppo_id = gruppo and m.utente_id = a.id) then 'invito_in_attesa'
           when a.stato_account <> 'attivo'
             or exists (select 1 from altri x where x.persona <> a.id
                        and private.c_e_blocco(x.persona, a.id)) then 'non_disponibile'
           when exists (select 1 from altri x where x.persona <> a.id
                        and not private.stessa_fascia(x.persona, a.id)
                        and not private.sono_amici(x.persona, a.id)) then 'fasce'
           when not (a.id = any (scelti))
             and occupati + cardinality(scelti) >= 30 then 'pieno'
         end
  from amici a
  order by a.nome_visualizzato, a.id;
end;
$$;

-- Eventi adatti a tutto il gruppo (R-20, R-23, R-24), da oggi per 30 giorni, con una ricerca
-- per titolo o locale. Security invoker: la policy di eventi vale per chi chiama.
create or replace function public.eventi_adatti_al_gruppo(gruppo uuid, testo text default null)
returns table (
  id uuid,
  titolo text,
  inizio timestamptz,
  fine timestamptz,
  data_serata date,
  eta_minima smallint,
  eta_minima_dichiarata boolean,
  locale_nome text,
  locale_comune text,
  url_biglietti text,
  copertina_tipo text,
  copertina_path text,
  copertina_attribuzione text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  oggi date := ((now() at time zone 'Europe/Rome') - interval '6 hours')::date;
  filtro text := nullif(btrim(coalesce(testo, '')), '');
begin
  if not private.e_membro_attivo(gruppo) then
    raise exception using errcode = '42501', message = 'Non fai parte di questo gruppo.';
  end if;
  return query
  select e.id, e.titolo, e.inizio, e.fine, e.data_serata, e.eta_minima, e.eta_minima_dichiarata,
         l.nome, l.comune, e.url_biglietti, c.tipo, c.percorso, c.attribuzione_copertina
  from public.eventi e
  join public.locali l on l.id = e.locale_id
  cross join lateral private.copertina_evento(e.id, l.id, l.immagine_path, e.immagine_path,
                                              l.immagine_attribuzione) c
  where e.stato = 'pubblicato'
    and e.data_serata between oggi and oggi + 30
    and coalesce(e.fine, e.inizio + interval '6 hours') > now()
    and (filtro is null
         or e.titolo ilike '%' || replace(replace(replace(filtro, '\', '\\'), '%', '\%'), '_', '\_') || '%'
         or l.nome ilike '%' || replace(replace(replace(filtro, '\', '\\'), '%', '\%'), '_', '\_') || '%')
    and private.evento_adatto_al_gruppo(e.id, gruppo)
  order by e.inizio, e.titolo, e.id
  limit 50;
end;
$$;

-- Dettaglio di una serata (security invoker: RLS di serate, partecipazioni, membri e profili).
-- `partecipanti` sono i membri attivi visibili con la loro risposta (null = non ha risposto);
-- `altri` i membri attivi che non si vedono (R-17); `posso_guidare` dice all'app se mostrare
-- "Guido" (F-16): l'età si calcola qui, mai nel client (R-02).
create or replace function public.dettaglio_serata(serata uuid)
returns table (
  id uuid,
  gruppo_id uuid,
  gruppo_nome text,
  titolo text,
  data_serata date,
  ora_ritrovo time,
  luogo_ritrovo text,
  url_prevendita text,
  url_lista text,
  note text,
  stato public.stato_serata,
  creata_da jsonb,
  posso_gestire boolean,
  posso_guidare boolean,
  passata boolean,
  evento jsonb,
  partecipanti jsonb,
  altri integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.gruppo_id, g.nome, s.titolo, s.data_serata, s.ora_ritrovo, s.luogo_ritrovo,
         s.url_prevendita, s.url_lista, s.note, s.stato,
         (select private.persona_json(p) from public.profili p where p.id = s.creata_da),
         s.creata_da = auth.uid() or private.e_admin_gruppo(s.gruppo_id),
         coalesce(private.eta_di(auth.uid()), 0) >= 18,
         s.data_serata < ((now() at time zone 'Europe/Rome') - interval '6 hours')::date,
         (select jsonb_build_object('id', e.id, 'titolo', e.titolo, 'inizio', e.inizio, 'fine', e.fine,
                                    'eta_minima', e.eta_minima,
                                    'eta_minima_dichiarata', e.eta_minima_dichiarata,
                                    'stato', e.stato, 'locale_nome', l.nome, 'locale_comune', l.comune,
                                    'copertina_tipo', c.tipo, 'copertina_path', c.percorso,
                                    'copertina_attribuzione', c.attribuzione_copertina)
          from public.eventi e
          join public.locali l on l.id = e.locale_id
          cross join lateral private.copertina_evento(e.id, l.id, l.immagine_path, e.immagine_path,
                                                      l.immagine_attribuzione) c
          where e.id = s.evento_id),
         coalesce((
           select jsonb_agg(private.persona_json(p) || jsonb_build_object(
                    'io', p.id = auth.uid(),
                    'risposta', x.risposta, 'biglietto', x.biglietto,
                    'trasporto_andata', x.trasporto_andata, 'trasporto_ritorno', x.trasporto_ritorno,
                    'posti_liberi', x.posti_liberi, 'passaggio_da', x.passaggio_da,
                    'aggiornato_il', x.aggiornato_il)
                  order by p.id <> auth.uid(), p.nome_visualizzato, p.id)
           from public.membri_gruppo m
           join public.profili p on p.id = m.utente_id
           left join public.partecipazioni_serata x on x.serata_id = s.id and x.utente_id = m.utente_id
           where m.gruppo_id = s.gruppo_id and m.stato = 'attivo'
         ), '[]'::jsonb),
         (select count(*)::integer from public.membri_gruppo m
          where m.gruppo_id = s.gruppo_id and m.stato = 'attivo'
            and not exists (select 1 from public.profili p where p.id = m.utente_id))
  from public.serate_gruppo s
  join public.gruppi g on g.id = s.gruppo_id
  where s.id = dettaglio_serata.serata;
$$;

-- Le prossime serate dei miei gruppi, con la mia risposta (Organizza).
create or replace function public.prossime_serate()
returns table (
  id uuid,
  gruppo_id uuid,
  gruppo_nome text,
  titolo text,
  data_serata date,
  ora_ritrovo time,
  stato public.stato_serata,
  mia_risposta public.risposta_serata
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.gruppo_id, g.nome, coalesce(s.titolo, e.titolo), s.data_serata, s.ora_ritrovo,
         s.stato,
         (select x.risposta from public.partecipazioni_serata x
          where x.serata_id = s.id and x.utente_id = auth.uid())
  from public.serate_gruppo s
  join public.gruppi g on g.id = s.gruppo_id
  left join public.eventi e on e.id = s.evento_id
  where s.data_serata >= ((now() at time zone 'Europe/Rome') - interval '6 hours')::date
    and s.stato <> 'annullata'
  order by s.data_serata, s.ora_ritrovo nulls last, s.id
  limit 20;
$$;

-- ---------------------------------------------------------------------------------------------
-- Permessi delle funzioni
-- ---------------------------------------------------------------------------------------------
revoke all on function private.e_membro_attivo(uuid) from public;
revoke all on function private.e_membro(uuid) from public;
revoke all on function private.e_admin_gruppo(uuid) from public;
revoke all on function private.puo_entrare_nel_gruppo(uuid, uuid) from public;
revoke all on function private.evento_adatto_al_gruppo(uuid, uuid) from public;
revoke all on function private.conta_membri(uuid) from public;
revoke all on function private.prepara_gruppo() from public;
revoke all on function private.aggiungi_creatore_gruppo() from public;
revoke all on function private.verifica_invito_gruppo() from public;
revoke all on function private.proteggi_membri_gruppo() from public;
revoke all on function private.garantisci_admin_gruppo(uuid) from public;
revoke all on function private.notifica_invito_gruppo() from public;
revoke all on function private.dopo_accettazione_gruppo() from public;
revoke all on function private.dopo_uscita_gruppo() from public;
revoke all on function private.applica_invariante_gruppi(uuid[], text) from public;
revoke all on function private.verifica_invariante_gruppi() from public;
revoke all on function private.invariante_dopo_amicizia() from public;
revoke all on function private.applica_blocco() from public;
revoke all on function private.puo_vedere_profilo(uuid) from public;
revoke all on function private.imposta_aggiornata_il() from public;
revoke all on function private.prepara_serata_gruppo() from public;
revoke all on function private.notifica_serata_gruppo() from public;
revoke all on function private.rimuovi_notifiche_serata() from public;
revoke all on function private.verifica_trasporto() from public;
revoke all on function private.libera_passaggi() from public;
revoke all on function private.persona_json(public.profili) from public;
grant execute on function private.e_membro_attivo(uuid) to authenticated;
grant execute on function private.e_membro(uuid) to authenticated;
grant execute on function private.e_admin_gruppo(uuid) to authenticated;
grant execute on function private.puo_entrare_nel_gruppo(uuid, uuid) to authenticated;
grant execute on function private.evento_adatto_al_gruppo(uuid, uuid) to authenticated;
grant execute on function private.conta_membri(uuid) to authenticated;
grant execute on function private.puo_vedere_profilo(uuid) to authenticated;
grant execute on function private.persona_json(public.profili) to authenticated;

revoke all on function public.invita_nel_gruppo(uuid, uuid[]) from public, anon;
revoke all on function public.crea_gruppo(text, uuid[]) from public, anon;
revoke all on function public.miei_gruppi() from public, anon;
revoke all on function public.dettaglio_gruppo(uuid) from public, anon;
revoke all on function public.anteprima_invito_gruppo(uuid) from public, anon;
revoke all on function public.amici_invitabili(uuid, uuid[]) from public, anon;
revoke all on function public.eventi_adatti_al_gruppo(uuid, text) from public, anon;
revoke all on function public.dettaglio_serata(uuid) from public, anon;
revoke all on function public.prossime_serate() from public, anon;
grant execute on function public.invita_nel_gruppo(uuid, uuid[]) to authenticated;
grant execute on function public.crea_gruppo(text, uuid[]) to authenticated;
grant execute on function public.miei_gruppi() to authenticated;
grant execute on function public.dettaglio_gruppo(uuid) to authenticated;
grant execute on function public.anteprima_invito_gruppo(uuid) to authenticated;
grant execute on function public.amici_invitabili(uuid, uuid[]) to authenticated;
grant execute on function public.eventi_adatti_al_gruppo(uuid, text) to authenticated;
grant execute on function public.dettaglio_serata(uuid) to authenticated;
grant execute on function public.prossime_serate() to authenticated;
