-- Migrazione: valori di enum per i flyer, la foto profilo, l'occultamento automatico (D-15,
-- ADR-0023) e i reclami (DSA art. 20)
-- Documentazione: docs/DATA_MODEL.md §3, §5.2; regole: R-50, R-51, R-52, R-53, R-55
--
-- I nuovi valori stanno in una migrazione a sé: Postgres non permette di usare un valore di
-- enum nella stessa transazione in cui viene aggiunto.

-- La foto profilo si segnala a parte dal profilo (oggetto_id = id del profilo, R-52).
alter type public.tipo_oggetto_segnalabile add value if not exists 'foto_profilo';

alter type public.azione_moderazione add value if not exists 'unisci_flyer';
alter type public.azione_moderazione add value if not exists 'prendi_in_carico';
alter type public.azione_moderazione add value if not exists 'occulta_contenuto';
alter type public.azione_moderazione add value if not exists 'ripristina_contenuto';
alter type public.azione_moderazione add value if not exists 'conferma_decisione';
alter type public.azione_moderazione add value if not exists 'cambia_decisione';

create type public.stato_reclamo as enum ('inviato', 'in_esame', 'deciso');
create type public.stato_caricamento as enum (
  'caricato', 'in_analisi', 'in_revisione', 'approvato', 'unito', 'rifiutato', 'errore'
);
