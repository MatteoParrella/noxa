# ADR-0034: «Non hai un passaggio?» con numeri e link, senza integrazioni

- **Stato**: Accettato
- **Data**: 2026-11-15

## Contesto
Il ritorno sicuro (F-21) dice agli amici che stai rientrando, ma non aiuta chi a fine serata non
ha un modo per tornare. La decisione aperta D-17 proponeva un blocco con mezzi notturni, taxi e
app di trasporto. Il product owner ha chiesto di integrarlo «dove è più opportuno, con Uber o
i numeri dei taxi». I vincoli sono quelli di sempre: nessun SDK di terze parti (R-62), nessuna
pubblicità o accordo commerciale (R-61), nessun pagamento nell'app (PRD §6), nessun indirizzo
di casa sul server (R-32), nessuna pressione (R-43), età calcolata nel database (R-04).

## Decisione
- **Dove**: nell'area Vivi, sotto il ritorno sicuro, sempre visibile anche senza un ritorno
  attivo e senza doverlo avviare. Nella serata di gruppo chi non ha ancora scelto come torna
  trova il pulsante «Non hai un passaggio?», che apre lo stesso elenco in un foglio (F-16).
- **Che cosa contiene**, in ordine fisso e neutro:
  1. mezzi pubblici di notte, con il link alla pagina ufficiale degli orari;
  2. radiotaxi di Milano e della Brianza, con «Chiama» (link `tel:`);
  3. app di trasporto, con un link che apre l'app.
- **Solo numeri e link.** Per Uber si usa il link universale
  `https://m.uber.com/ul/?action=setPickup&pickup=my_location`: la partenza la decide l'app di
  Uber sul telefono, Noxa non manda coordinate, destinazione o identificativi, e il link si
  apre con `noreferrer`. Nessun SDK, nessun codice sconto, nessun pagamento.
- **Elenco nel database**: tabella `servizi_trasporto` con, per ogni voce, la fonte ufficiale e
  la data dell'ultima verifica (DATA_MODEL.md §5.5). L'app la legge soltanto; le voci cambiano
  con una migrazione, dopo la verifica sulla fonte.
- **Età**: ogni voce ha un'età minima e la policy di lettura la confronta con
  `private.eta_di(auth.uid())`. I termini di Uber richiedono 18 anni per avere un account:
  ai minorenni la voce non arriva nemmeno. Taxi e mezzi pubblici sono per tutti.
- **Dopo**: l'elenco ricorda il ritorno sicuro con una frase e un link, senza avvisi né
  richiami (R-43).
- **Voci iniziali** (verificate il 2026-11-15): rete notturna ATM (atm.it), Radiotaxi 02 4040
  e 02 8585 (sito dell'aeroporto di Linate), Radiotaxi Monza 039 36379 (portale turistico del
  Comune di Monza), Uber (termini per l'Italia).

## Alternative considerate
- **Elenco scritto nel codice dell'app e filtrato con la fascia d'età**: più semplice, ma il
  filtro sarebbe nel frontend e correggere un numero richiederebbe una nuova versione.
- **Integrazione con le API di Uber o di una cooperativa di taxi** (prezzi, prenotazione):
  richiede accordi, chiavi e l'invio di posizione e destinazione a terzi. Scartata (R-32,
  R-61, R-62).
- **Aggiungere subito FreeNow, itTaxi, 02 7777 e 02 6969**: l'età minima delle due app e i due
  numeri non sono stati confermati su una fonte ufficiale. Restano fuori finché non lo sono
  (ROADMAP.md, iterazione 12).
- **Scrittura dei moderatori dall'app**: richiede nuove azioni nel registro di moderazione
  (R-69) e una schermata. Rimandata alla roadmap; intanto vale la migrazione.

## Conseguenze
- D-17 è chiusa. Nuova funzionalità F-23 nel PRD.
- Nessun nuovo dato personale: la tabella di conservazione di SAFETY_PRIVACY.md non cambia.
- Chi apre Uber o chiama un taxi esce da Noxa: da lì valgono i termini di quei servizi.
- I numeri vanno riverificati periodicamente: la data è mostrata nell'elenco.
- La pagina della rete notturna ATM verificata è quella in inglese: va sostituita con quella
  in italiano quando se ne conferma l'indirizzo.
