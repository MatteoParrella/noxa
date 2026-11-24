-- Migrazione: valori di enum per la gestione dei servizi di trasporto dai moderatori (F-23,
-- ADR-0034). Separata dalla migrazione che li usa: un valore nuovo non si usa nella stessa
-- transazione in cui si aggiunge. Il nuovo tipo di oggetto non è segnalabile dagli utenti: la
-- policy di insert di `segnalazioni` elenca i tipi ammessi.
alter type public.tipo_oggetto_segnalabile add value if not exists 'servizio_trasporto';
alter type public.azione_moderazione add value if not exists 'crea_servizio_trasporto';
alter type public.azione_moderazione add value if not exists 'modifica_servizio_trasporto';
