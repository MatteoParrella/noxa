# ADR-0023: Occultamento automatico delle immagini segnalate per rischio a un minorenne

- **Stato**: Accettato
- **Data**: 2026-10-22

## Contesto
R-53 fissa i tempi massimi di gestione delle segnalazioni: entro 4 ore (08:00–02:00) quelle
con motivo `adescamento_o_rischio_minore`. Fino alla decisione del moderatore il contenuto
segnalato restava visibile. Per un'immagine che mette a rischio un minorenne, anche poche ore
di visibilità sono troppe. Restava aperto un rischio opposto: le segnalazioni coordinate per
far sparire i contenuti di altri (D-15).

Il product owner ha chiuso D-15 all'avvio dell'iterazione 6. Ha scelto un occultamento
automatico limitato, sotto controllo umano, che non mostri mai nell'app un vuoto o una scritta
"in lavorazione".

## Decisione
- **Quando**: una segnalazione con motivo `adescamento_o_rischio_minore`, fatta da un
  account con almeno 7 giorni, nasconde subito l'**immagine** dell'oggetto segnalato. Le
  segnalazioni con altri motivi, o fatte da account nuovi, non nascondono niente.
- **Cosa si nasconde**: solo immagini, mai profili o eventi interi (funzione
  `private.bersaglio_occultamento`):
  - per un profilo o una foto profilo, la foto profilo;
  - per un evento, la copertina del flyer;
  - per un locale, la foto del locale.
- **Come**: una riga in `contenuti_occultati` con `automatico = true` e un'azione
  `occulta_contenuto` nel registro, senza moderatore. Le policy dei bucket non consegnano più
  l'immagine a nessuno, tranne ai moderatori per la revisione.
- **Cosa vede l'utente**:
  - al posto di una copertina, un'illustrazione notturna disegnata per Noxa, senza diritti
    di terzi (copertina `sostitutiva`);
  - al posto di una foto profilo, le iniziali, come dopo una rimozione (R-52).
- **Chi è coinvolto lo sa**: la persona riceve una notifica (`contenuto_nascosto`) che
  dichiara il mezzo automatico (DSA art. 17).
- **Revisione umana**: la segnalazione resta in coda con priorità 1 e i tempi di R-53. La
  decisione del moderatore chiude l'occultamento in due modi:
  - se l'immagine viene rimossa, sparisce davvero;
  - se non resta nessuna segnalazione aperta sull'oggetto, l'immagine torna visibile e la
    persona riceve `contenuto_ripristinato`.
- **Escalation (R-55)**: l'occultamento diventa conservazione come prova
  (`conservazione_legale`) e non si toglie da solo.

## Alternative considerate
- **Nessun occultamento automatico** (scelta provvisoria di D-15): lascia visibile per ore
  un'immagine potenzialmente pericolosa per un minorenne.
- **Soglia di N segnalazioni in 24 ore**: è più lenta proprio nei casi in cui una sola
  segnalazione basta. Inoltre è più esposta alle segnalazioni coordinate.
- **Nascondere l'intero profilo o l'evento**: l'effetto è sproporzionato in caso di
  segnalazione infondata e facile da usare come arma. L'immagine è il contenuto più rischioso.
- **Pagina "contenuto in revisione"**: l'app mostrerebbe un vuoto e renderebbe visibile la
  segnalazione a chi guarda.

## Conseguenze
- R-53 in SAFETY_PRIVACY.md cita l'occultamento automatico; D-15 è chiusa.
- Database:
  - tabella `contenuti_occultati` e colonna `profili.avatar_nascosto`;
  - trigger `private.occulta_in_attesa` sulle segnalazioni;
  - copertina `sostitutiva` in `cerca_eventi` e `dettaglio_evento`;
  - test pgTAP in `029_avatar_occultamenti.test.sql`.
- App: tipo di copertina `sostitutiva` con l'illustrazione notturna; le foto profilo nascoste
  restano con le iniziali.
- Abuso delle segnalazioni: il requisito dei 7 giorni di account e il limite di 20
  segnalazioni al giorno (`private.prepara_segnalazione`) riducono le segnalazioni coordinate.
  Gli abusi si vedono nel registro e si gestiscono come violazione dei Termini.
- D-16 (più automazione sotto controllo umano) resta aperta.
