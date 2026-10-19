-- Migrazione: valori di enum per la raccolta degli eventi e il registro dell'area di
-- moderazione (locali, fonti, duplicati, eventi)
-- Documentazione: docs/DATA_MODEL.md §3, §5.2 (azioni_moderazione); regole: R-22, R-53, R-56
--
-- I nuovi valori stanno in una migrazione a sé: Postgres non permette di usare un valore di
-- enum nella stessa transazione in cui viene aggiunto.

-- Oggetti a cui si riferiscono le azioni del registro di moderazione. Restano non
-- segnalabili dagli utenti: la policy INSERT di segnalazioni elenca i tipi ammessi.
alter type public.tipo_oggetto_segnalabile add value if not exists 'locale';
alter type public.tipo_oggetto_segnalabile add value if not exists 'fonte';
alter type public.tipo_oggetto_segnalabile add value if not exists 'candidato_locale';

alter type public.azione_moderazione add value if not exists 'crea_locale';
alter type public.azione_moderazione add value if not exists 'modifica_locale';
alter type public.azione_moderazione add value if not exists 'approva_immagine_locale';
alter type public.azione_moderazione add value if not exists 'rimuovi_immagine_locale';
alter type public.azione_moderazione add value if not exists 'crea_fonte';
alter type public.azione_moderazione add value if not exists 'modifica_fonte';
alter type public.azione_moderazione add value if not exists 'esegui_fonte';
alter type public.azione_moderazione add value if not exists 'unisci_duplicato';
alter type public.azione_moderazione add value if not exists 'separa_duplicato';
alter type public.azione_moderazione add value if not exists 'pubblica_evento';
alter type public.azione_moderazione add value if not exists 'annulla_evento';
alter type public.azione_moderazione add value if not exists 'rifiuta_evento';
alter type public.azione_moderazione add value if not exists 'correggi_eta_alcol';
alter type public.azione_moderazione add value if not exists 'conferma_in_programma';
alter type public.azione_moderazione add value if not exists 'verifica_candidato_locale';
alter type public.azione_moderazione add value if not exists 'unisci_candidato_locale';
alter type public.azione_moderazione add value if not exists 'scarta_candidato_locale';
