# ADR-0025: Backup cifrato in proprio e diritti privacy nel database

- **Stato**: Accettato
- **Data**: 2026-10-27

## Contesto
ADR-0021 porta il database su Supabase Free, che non ha backup gestiti. D-14 chiedeva di
scegliere, prima della beta, tra il piano Pro (circa 25 $ al mese) e un backup notturno in
proprio. Nella stessa iterazione si implementano i diritti di R-64 (esportazione ed
eliminazione self-service), che i documenti attribuivano a due Edge Functions, e la
conservazione completa di SAFETY_PRIVACY.md §10, che deve tenere insieme la cancellazione
immediata dell'account e l'obbligo di conservare le prove di un'escalation (R-55).

## Decisione
1. **Backup notturno cifrato su Cloudflare R2** (chiude D-14). Il workflow `backup.yml`
   esegue ogni notte `scripts/backup_database.sh`: `pg_dump` dei soli dati di `public`,
   `private` e delle tabelle di Auth e dei metadati dello Storage, compressione e cifratura
   con `age` verso una chiave pubblica; il file in chiaro non tocca il disco. I backup si
   conservano 30 giorni, poi lo script li elimina. La chiave privata non è su GitHub: la
   custodisce il product owner fuori linea. Il ripristino (`scripts/ripristina_backup.sh`)
   carica i dati in un database con le stesse migrazioni, in un'unica transazione con i
   trigger sospesi. I file dello Storage non sono nel backup.
2. **Esportazione con una RPC**, non con una Edge Function: `public.esporta_miei_dati()`
   (`security definer`) restituisce in un unico JSON tutto ciò che Noxa conserva su chi
   chiama, con una richiesta all'ora (`private.esportazioni_dati`). Il database conosce già
   tutte le tabelle e le loro regole; una funzione esterna con `service_role` avrebbe
   richiesto di ripetere le stesse esclusioni (segnalazioni ricevute, identità di chi ha
   segnalato) fuori dalla RLS.
3. **Eliminazione in due parti**: la RPC `public.elimina_mio_account(password)` verifica la
   password (al massimo 5 tentativi sbagliati all'ora) e, se l'account ha i due fattori, una
   sessione `aal2`, poi elimina `auth.users` con la cascata su tutti i dati. L'Edge Function
   `elimina-account` la chiama con il JWT dell'utente e usa `service_role` solo per
   cancellare subito i file della foto profilo; se lo Storage non risponde, li elimina il job
   `pulizia_flyer` entro un giorno.
4. **Identità conservata solo per le escalation**: quando una decisione di moderazione è
   un'`escalation_autorita`, il trigger `private.registra_account_conservato` annota l'account
   coinvolto in `private.account_conservati`; se l'account viene eliminato, la RPC copia lì
   email, username, nome, data di nascita e date di registrazione e ultimo accesso. La tabella
   non è leggibile da nessun ruolo dell'app e la riga si toglie a mano a procedimento
   concluso.

## Alternative considerate
- **Supabase Pro**: backup giornalieri e ripristino a un punto nel tempo, ma 25 $ al mese
  senza utenti reali; si rivaluta quando il piano Free non basterà più (ADR-0021).
- **Backup in chiaro su R2**: più semplice, ma un accesso al bucket esporrebbe i dati di
  minorenni; la cifratura con chiave fuori linea limita il danno al solo database.
- **Edge Function `esporta-dati`**: avrebbe letto le tabelle con `service_role` e duplicato
  le regole di esclusione fuori dal database, contro ADR-0002.
- **Rifiutare l'eliminazione degli account in escalation**: avrebbe rivelato all'account
  sospeso l'esistenza di un procedimento, contro R-55.

## Conseguenze
- Un account eliminato sparisce dai backup entro 30 giorni (SAFETY_PRIVACY.md §10).
- Sul piano Free non c'è la protezione dalle password compromesse: resta la lunghezza minima
  di 10 caratteri (ADR-0021); l'app gestisce già l'errore `pwned` per quando si passerà a Pro.
- Il ripristino richiede la chiave privata: se va persa, i backup sono inutilizzabili.
  La prova di ripristino si ripete prima della beta e dopo ogni cambio della chiave.
- I file dello Storage persi con il progetto non si recuperano: le foto profilo si
  ricaricano, i flyer pubblicati restano senza immagine (fondo tipografico, ADR-0018).
- Documenti aggiornati: SAFETY_PRIVACY.md (R-64, §10), DATA_MODEL.md, ARCHITECTURE.md,
  PRD.md, ROADMAP.md, DECISIONI_APERTE.md (D-14 chiusa), skill `safety-review` e
  `db-migration`.
