# ADR-0037: Amici in comune e numero di amici, al posto dei follower

- **Stato**: Accettato
- **Data**: 2026-11-24

## Contesto
Il product owner ha chiesto di mostrare i follower delle persone, per rendere Noxa più
competitiva rispetto ai social che i ragazzi usano già. Un modello a follower contraddice le
regole sui minorenni:

- seguire qualcuno senza la sua accettazione contraddice R-11;
- l'elenco dei follower o degli amici di una persona mostra a chi guarda persone che non
  conosce: un adulto amico di un sedicenne vedrebbe gli altri minorenni che quella persona
  frequenta, cioè proprio il canale che R-10 e R-13 chiudono;
- un numero di follower in vista è un indice di popolarità. Per chi ha 14–17 anni il DSA
  (art. 28) e le linee guida della Commissione sulla tutela dei minori chiedono impostazioni
  predefinite protettive, e gli store ne tengono conto nella classificazione d'età (D-06).

Il product owner ha scelto le due alternative compatibili proposte il 2026-11-24: gli amici
in comune e il numero di amici visibile solo agli amici.

## Decisione
- **Amici in comune**: sul profilo di una persona che si può già vedere
  (`private.puo_vedere_profilo`), compaiono gli amici confermati in comune, con avatar, nome e
  username, e il loro numero. Sono per definizione amici di chi guarda, quindi la funzione non
  mostra mai persone nuove; sono esclusi gli account non attivi e i blocchi in qualunque
  direzione tra le tre persone. Sul proprio profilo la sezione non c'è.
- **Numero di amici**: il numero di amici confermati di una persona è visibile solo ai suoi
  amici confermati, e solo da 5 in su (sotto i 5 non compare nulla). Mai l'elenco. Il titolare
  lo vede sempre sul proprio profilo e può nasconderlo agli altri in Privacy e dati.
- **Predefiniti**: per chi si iscrive con 14–17 anni il numero è **nascosto di default** e
  attivabile; per chi si iscrive maggiorenne è visibile di default. Il compimento dei 18 anni
  non cambia la scelta fatta. La preferenza è una colonna di `profili_privati`, scritta solo
  dal titolare.
- **Database**: due RPC `security definer` in `public` con `set search_path = ''`, per
  esempio `amici_in_comune(persona)` e `numero_amici(persona)`, che ricontrollano
  `puo_vedere_profilo`, `sono_amici` e i blocchi; la tabella `amicizie` resta leggibile solo
  dalle due persone della riga.
- Nessuna notifica legata ai numeri (né «hai 10 amici», né confronti), nessuna classifica
  (R-43).

## Alternative considerate
- **Follower pubblici con elenco**: viola R-10, R-11 e R-13; escluso.
- **Numero di amici visibile a chiunque veda il profilo**: un membro di un gruppo che non è
  amico vedrebbe un indice di popolarità di un minorenne; il vantaggio per la crescita non
  giustifica l'esposizione.
- **Numero visibile anche ai minorenni di default**: più vicino a un social, ma contrario alle
  impostazioni predefinite protettive chieste per i minori; resta attivabile da loro.

## Conseguenze
- R-13 si estende con la nuova visibilità: SAFETY_PRIVACY.md (R-13), DATA_MODEL.md (`profili_privati`, due RPC), PRD.md (F-11) e ARCHITECTURE.md
  aggiornati nell'iterazione 14 con `new-feature` e `db-migration`.
- Test pgTAP per tutte le età del seed: chi non può vedere il profilo non ottiene nulla; un
  adulto non vede mai un minorenne che non sia già suo amico; blocchi in ogni direzione; soglia
  dei 5; preferenza rispettata.
- `safety-review` obbligatoria prima della chiusura.
