-- Migrazione: un account sospeso (decisione motivata o escalation R-55) non ha più contatti
-- con altri utenti; vede solo i propri dati, le notifiche con la motivazione e il reclamo
-- Documentazione: docs/DATA_MODEL.md §4 (puo_vedere_profilo, account_attivo), §5.2;
-- docs/SAFETY_PRIVACY.md §11; regole: R-10, R-11, R-12, R-13, R-55
--
-- Codici di errore (apps/web/src/lib/errori.ts):
--   NX036 account sospeso: l'operazione non è consentita

create or replace function private.account_attivo(utente uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profili p where p.id = utente and p.stato_account = 'attivo');
$$;

-- R-10, R-13, R-17, R-55: oltre al proprio, un profilo si vede solo da un account attivo.
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
      and (private.sono_amici(auth.uid(), target) or private.c_e_richiesta(auth.uid(), target))
    );
$$;

-- R-11, R-14, R-55: un account sospeso non invia richieste (nemmeno con un codice invito).
create or replace function private.limita_richieste_amicizia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.account_attivo(new.richiedente_id) then
    raise exception using errcode = 'NX036', message = 'Account sospeso.';
  end if;
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

-- R-11, R-55: un account sospeso non accetta richieste.
drop policy "amicizie: il destinatario accetta" on public.amicizie;
create policy "amicizie: il destinatario accetta"
  on public.amicizie for update to authenticated
  using (destinatario_id = (select auth.uid()) and stato = 'in_attesa')
  with check (
    destinatario_id = (select auth.uid())
    and stato = 'accettata'
    and (select private.account_attivo((select auth.uid())))
  );

-- R-12, R-55: un account sospeso non crea codici invito.
create or replace function private.verifica_codice_invito()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.account_attivo(new.creato_da) then
    raise exception using errcode = 'NX036', message = 'Account sospeso.';
  end if;
  return new;
end;
$$;

create trigger codici_invito_verifica
  before insert on public.codici_invito
  for each row execute function private.verifica_codice_invito();

revoke all on function private.account_attivo(uuid) from public;
revoke all on function private.puo_vedere_profilo(uuid) from public;
revoke all on function private.limita_richieste_amicizia() from public;
revoke all on function private.verifica_codice_invito() from public;
grant execute on function private.account_attivo(uuid) to authenticated;
grant execute on function private.puo_vedere_profilo(uuid) to authenticated;
