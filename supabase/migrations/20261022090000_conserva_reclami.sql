-- Migrazione: conservazione dei reclami (SAFETY_PRIVACY.md §10, DSA art. 20)
-- Documentazione: docs/DATA_MODEL.md §5.2 (reclami), §8; regole: R-55, R-65
-- Un reclamo deciso si elimina 12 mesi dopo la decisione, salvo che la decisione contestata
-- sia conservata come prova (R-55). Le altre scadenze restano quelle dell'iterazione 6;
-- l'iterazione 8 aggiunge segnalazioni, azioni di moderazione e account inattivi.

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
end;
$$;

revoke all on function private.applica_conservazione() from public;
