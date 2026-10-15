-- Migrazione: bucket pubblico `mappe` per la basemap Protomaps auto-ospitata
-- Documentazione: docs/DATA_MODEL.md §6; ADR-0016

-- Pubblico in lettura: contiene solo dati OpenStreetMap, font e icone, nessun dato personale.
-- Nessuna policy di scrittura su storage.objects: i file si caricano solo durante il deploy
-- con la chiave service_role (scripts/prepara_mappa.sh), mai dall'app.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mappe',
  'mappe',
  true,
  200 * 1024 * 1024,
  array['application/octet-stream', 'application/vnd.pmtiles', 'application/x-protobuf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
