# ADR-0026: Notifiche sul telefono con il Web Push, testi di sistema e webhook dal database

- **Stato**: Accettato
- **Data**: 2026-11-05

## Contesto
F-22 chiede notifiche sul telefono con consenso esplicito e senza testi scritti da altri
utenti. Con D-13 aperta la beta è solo PWA (ADR-0021): FCM e APNs per le app native arrivano
solo con gli account degli store. ARCHITECTURE.md §5.4 prevedeva già un webhook del database
sull'`INSERT` in `notifiche` verso l'Edge Function `invia-push`, ma non diceva come
autenticarlo, come cifrare il contenuto, quali testi mandare né come trattare i dispositivi.
Le notifiche arrivano anche sulla schermata di blocco, che chiunque può guardare: un nome o un
locale lì rivelerebbe con chi e dove esce un minorenne.

## Decisione
1. **Web Push con VAPID, senza dipendenze**: l'Edge Function `invia-push` cifra il contenuto
   con aes128gcm (RFC 8291) e firma il JWT VAPID ES256 (RFC 8292) con WebCrypto
   (`supabase/functions/_shared/webpush.ts`). Le chiavi VAPID si generano in locale con
   `scripts/genera_chiavi_vapid.mjs`: la pubblica va nell'app (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
   e nella funzione, la privata solo nei segreti della funzione.
2. **Webhook con `pg_net`**: il trigger `private.invia_push` su `notifiche` chiama la
   funzione solo se la persona ha almeno un dispositivo, con il solo `notifica_id` e un
   segreto condiviso (`x-noxa-segreto`); indirizzo e segreto stanno nel Vault
   (`invia_push_url`, `invia_push_segreto`) e senza di essi non parte nessuna richiesta (in
   locale, in CI e nei test). La funzione ha la verifica del JWT spenta e controlla il
   segreto a tempo costante; rilegge notifica e dispositivi con `service_role`, toglie i
   dispositivi che il servizio push dà per scaduti (404, 410) e imposta `inviata_push_il`.
3. **Solo testi di sistema**: il testo dipende solo dal tipo (e, per la moderazione, dall'esito,
   un valore di un elenco chiuso), mai da nomi, username, nomi dei gruppi, locali o testi di
   altre persone (`supabase/functions/_shared/testi_push.ts`, con test). I dettagli si
   leggono aprendo l'app, che rilegge l'oggetto con la RLS: se non c'è più (amicizia annullata,
   check-in terminato, blocco) l'elenco delle notifiche dice "Non è più disponibile".
4. **Consenso e dispositivi**: il permesso del sistema si chiede solo dopo "Attiva" nel foglio
   di Noxa. Ogni browser iscritto è una riga di `dispositivi_push` registrata con la RPC
   `registra_dispositivo_push` (un endpoint appartiene a un solo account, al massimo 10
   dispositivi, solo endpoint dei servizi push dei browser), con un'etichetta generica
   ("Android · Chrome") e senza modello né versione. `profili_privati.notifiche_push_abilitate`
   la scrive solo il database: è vera se esiste almeno un dispositivo. All'uscita dall'account
   l'app toglie il dispositivo; quelli non usati da 90 giorni si cancellano.

## Alternative considerate
- **Libreria `web-push` di npm nella funzione**: dipende dal modulo `crypto` di Node e da
  `jsonwebtoken`, con un comportamento incerto sul runtime Deno; l'implementazione con
  WebCrypto è breve, verificata con una decifratura indipendente nei test.
- **Notifiche "vuote" (senza contenuto) e testo letto dal service worker**: il service worker
  non ha la sessione dell'utente; servirebbe un token nel worker o un endpoint pubblico.
- **`pg_cron` ogni minuto invece del webhook**: più semplice da autenticare, ma un check-in
  arriverebbe fino a un minuto dopo e il job girerebbe anche senza notifiche.
- **Firebase Cloud Messaging anche per il web**: un fornitore e un account in più senza
  vantaggi per la PWA; resta per le app native quando D-13 si chiude.

## Conseguenze
- I servizi push dei browser (Google, Mozilla, Apple, Microsoft) ricevono l'endpoint e un
  contenuto cifrato che non possono leggere: SAFETY_PRIVACY.md R-66 e §10 aggiornati.
- Su iPhone il Web Push funziona solo con Noxa aggiunta alla schermata Home: l'app mostra i
  due passi invece dell'interruttore.
- In staging e produzione servono: chiavi VAPID, `NOXA_PUSH_SEGRETO` e `VAPID_SUBJECT` nei
  segreti delle funzioni, i due segreti nel Vault e il deploy di `invia-push` senza verifica
  del JWT.
- L'app Android aggiunge FCM alla stessa funzione, con gli stessi testi (ADR-0027); APNs
  arriva con l'app iOS, se D-13 si chiude per Apple.
- Documenti aggiornati: DATA_MODEL.md, ARCHITECTURE.md §5.4, SAFETY_PRIVACY.md, PRD.md (F-22).
