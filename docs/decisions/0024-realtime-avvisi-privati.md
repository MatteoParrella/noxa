# ADR-0024: Aggiornamenti dal vivo con avvisi senza dati su canali privati

- **Stato**: Accettato
- **Data**: 2026-10-26

## Contesto
La serata di gruppo si aggiorna dal vivo (F-14, ARCHITECTURE.md §4.3). La prima versione
dell'iterazione 7 pubblicava `membri_gruppo`, `serate_gruppo` e `partecipazioni_serata` con
Postgres Changes, contando sulla RLS per filtrare le righe. La documentazione di Supabase
precisa però che la RLS non si applica agli eventi `DELETE`, che arrivano a ogni sessione in
ascolto con la chiave primaria. Per `membri_gruppo` (`gruppo_id`, `utente_id`) e
`partecipazioni_serata` (`serata_id`, `utente_id`) questo avrebbe rivelato a qualsiasi utente
autenticato chi esce da quale gruppo e chi toglie la risposta a quale serata: identificativi
pseudonimi, ma comunque relazioni tra persone, anche minorenni (R-13, R-17, R-68).

## Decisione
- Postgres Changes si usa solo per tabelle con RLS la cui chiave primaria non rivela relazioni
  tra persone (oggi `notifiche`, chiave `id`).
- Gruppi e serate usano avvisi **senza dati** su canali Broadcast **privati**: i trigger
  `private.avvisa_cambio_serata` e `private.avvisa_cambio_membri` chiamano `realtime.send`
  sui canali `serata:<id>` e `gruppi:<utente_id>`.
- Chi può ascoltare lo decide una policy su `realtime.messages` con
  `private.puo_ascoltare(topic)`, `security invoker`: la serata deve essere visibile secondo
  la RLS di `serate_gruppo`, il canale dei gruppi è solo del titolare.
- Chi riceve un avviso ricarica con le RPC, soggette alla RLS: nessun dato viaggia sul canale.

## Alternative considerate
- **Postgres Changes con `replica identity full`**: permette di filtrare i `DELETE`, ma non
  applica comunque la RLS al record cancellato.
- **Broadcast con i dati della riga** (`realtime.broadcast_changes`): eviterebbe una lettura,
  ma replicherebbe nella policy del canale le regole di visibilità di ogni riga (blocchi,
  R-17), con il rischio che le due regole divergano.
- **Polling**: semplice, ma più richieste al database Free e aggiornamenti in ritardo.

## Conseguenze
- Ogni avviso costa una lettura dell'RPC di dettaglio a chi è in ascolto: accettabile con
  gruppi di al massimo 30 membri.
- Il ritorno sicuro (iterazione 9) usa lo stesso meccanismo di canali privati, già previsto.
- Aggiornati DATA_MODEL.md §4 e §7, ARCHITECTURE.md §3.2, §4.3 e §5.3, SAFETY_PRIVACY.md
  (R-68, applicazione); test pgTAP `035_realtime_gruppi`.
