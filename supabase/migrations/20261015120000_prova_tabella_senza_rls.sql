-- PROVA DELLA CI (non unire): tabella senza RLS e senza test. La CI deve fallire
-- (criterio dell'iterazione 0, ROADMAP.md §5).
create table public.prova_senza_rls (
  id bigint generated always as identity primary key
);
