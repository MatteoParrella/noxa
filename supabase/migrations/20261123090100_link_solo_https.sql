-- Migrazione: nel catalogo solo link cifrati (consolidamento del 2026-11-14, iterazione 12).
-- Documentazione: docs/DATA_MODEL.md §5.2, §5.3; EVENT_INGESTION.md §3.3.
--
-- Un link `http://` apre una pagina che chiunque sulla stessa rete può modificare: biglietti,
-- pagine delle serate e siti dei locali si salvano solo in `https`. I link già salvati passano
-- a `https://`; il worker fa lo stesso prima di scrivere (`in_https`).

update public.eventi set url_biglietti = 'https://' || substr(url_biglietti, 8)
  where url_biglietti ilike 'http://%';
update public.eventi_fonti set url_originale = 'https://' || substr(url_originale, 8)
  where url_originale ilike 'http://%';
update public.locali set sito_web = 'https://' || substr(sito_web, 8)
  where sito_web ilike 'http://%';
update public.candidati_locali set sito_web = 'https://' || substr(sito_web, 8)
  where sito_web ilike 'http://%';

alter table public.eventi drop constraint eventi_url_biglietti;
alter table public.eventi add constraint eventi_url_biglietti
  check (url_biglietti ~ '^https://\S+$');

alter table public.eventi_fonti drop constraint eventi_fonti_url;
alter table public.eventi_fonti add constraint eventi_fonti_url
  check (url_originale ~ '^https://\S+$');

alter table public.locali drop constraint locali_sito_web;
alter table public.locali add constraint locali_sito_web
  check (sito_web ~ '^https://\S+$');

alter table public.candidati_locali drop constraint candidati_locali_sito;
alter table public.candidati_locali add constraint candidati_locali_sito
  check (sito_web ~ '^https://\S+$');
