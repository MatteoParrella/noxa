-- Migrazione: colore dei gruppi, per riconoscerli a colpo d'occhio negli elenchi e nelle serate
-- (consolidamento del 2026-11-14, iterazione 12).
-- Documentazione: docs/DATA_MODEL.md §5.4 (gruppi); regole: R-13, R-15.
--
-- Un colore da una tavolozza fissa, scelto da chi crea il gruppo e cambiato dagli admin con le
-- stesse policy del nome. Nessuna immagine caricata: niente da moderare (R-50).

alter table public.gruppi
  add column colore text not null default 'ciano'
  constraint gruppi_colore check (
    colore in ('ciano', 'blu', 'viola', 'rosa', 'rosso', 'arancione', 'giallo', 'verde')
  );
comment on column public.gruppi.colore is
  'Colore del gruppo dalla tavolozza dei token --colore-gruppo-* (DESIGN.md).';

-- I gruppi già creati ricevono colori diversi, stabili per gruppo.
update public.gruppi
set colore = (array['ciano', 'blu', 'viola', 'rosa', 'rosso', 'arancione', 'giallo', 'verde'])
             [1 + abs(hashtext(id::text)) % 8];

grant insert (colore) on public.gruppi to authenticated;
grant update (colore) on public.gruppi to authenticated;
