-- Migrazione: nomi dei generi come si scrivono (D-19, iterazione 12).
-- Documentazione: docs/DATA_MODEL.md §5.3 (generi_musicali). I codici non cambiano: worker,
-- filtri salvati e copertine generate li usano già.
update public.generi_musicali g
set nome = v.nome
from (values
  ('techno', 'Techno'),
  ('house', 'House'),
  ('hip_hop', 'Hip hop'),
  ('reggaeton', 'Reggaeton'),
  ('commerciale', 'Commerciale'),
  ('latino', 'Latino'),
  ('drum_and_bass', 'Drum & bass'),
  ('elettronica', 'Elettronica'),
  ('indie', 'Indie'),
  ('live', 'Live'),
  ('altro', 'Altro')
) as v(codice, nome)
where g.codice = v.codice;
