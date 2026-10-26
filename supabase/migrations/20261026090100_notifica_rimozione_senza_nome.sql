-- Migrazione: la notifica di uscita da un gruppo non contiene più il nome del gruppo
-- Documentazione: docs/DATA_MODEL.md §5.4; regole: R-15, R-50, R-52
--
-- Il nome è scritto da un altro utente: un admin potrebbe rinominare il gruppo e togliere
-- subito una persona, che riceverebbe il testo in una notifica senza poterlo più segnalare
-- (la segnalazione di un gruppo richiede di esserne membri). Le notifiche non contengono
-- testi scritti da altri utenti (safety-review, sezione B): restano motivo e cosa fare.

-- Uscita, rifiuto, rimozione: spariscono la notifica dell'invito, le risposte alle serate del
-- gruppo e i passaggi offerti; chi è stato tolto riceve una notifica con il solo motivo
-- (R-15). Nessuna notifica dopo un blocco (R-17) o quando si elimina l'intero gruppo.
create or replace function private.dopo_uscita_gruppo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  motivo text := coalesce(nullif(current_setting('noxa.motivo_rimozione', true), ''),
                          case when old.utente_id is distinct from auth.uid() then 'tolto' end);
begin
  if not exists (select 1 from public.gruppi g where g.id = old.gruppo_id) then
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
      jsonb_build_object('gruppo_id', old.gruppo_id, 'motivo', motivo, 'era_invitato', old.stato = 'invitato')
    );
  end if;
  perform private.garantisci_admin_gruppo(old.gruppo_id);
  return null;
end;
$$;

update public.notifiche
set dati = dati - 'nome_gruppo'
where tipo = 'rimozione_gruppo' and dati ? 'nome_gruppo';
