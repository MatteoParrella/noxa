-- Migrazione: l'esportazione dei dati include l'avviso di inattività (R-64, SAFETY_PRIVACY.md §10).
-- Documentazione: docs/DATA_MODEL.md §4 (gestisci_account_inattivi) e §5.10 (esporta_miei_dati).
create or replace function public.esporta_miei_dati()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  io uuid := auth.uid();
begin
  return private.esporta_dati_vivi() || jsonb_build_object(
    'badge', coalesce((
      select jsonb_agg(jsonb_build_object('codice', b.badge_codice, 'nome', c.nome,
                                          'ottenuto_il', b.ottenuto_il)
                       order by b.ottenuto_il)
      from public.badge_utente b join public.badge c on c.codice = b.badge_codice
      where b.utente_id = io), '[]'::jsonb),
    'riepiloghi_annuali', coalesce((
      select jsonb_agg(jsonb_build_object('anno', r.anno, 'dati', r.dati,
                                          'generato_il', r.generato_il)
                       order by r.anno)
      from public.riepiloghi_annuali r where r.utente_id = io), '[]'::jsonb),
    -- Avviso di inattività (SAFETY_PRIVACY.md §10), se c'è: solo la data.
    'avviso_inattivita', (select jsonb_build_object('avvisato_il', a.avvisato_il)
                          from private.avvisi_inattivita a where a.utente_id = io)
  );
end;
$$;
