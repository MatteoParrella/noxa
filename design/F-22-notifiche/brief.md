# Brief — F-22 Notifiche sul telefono, permessi e preferenze (iterazione 9)

Schermate da preparare prima dell'iterazione 9 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-22,
F-42; regole R-17, R-43, R-66 di SAFETY_PRIVACY.md; DATA_MODEL.md (`dispositivi_push`,
`notifiche`, `profili_privati.notifiche_push_abilitate`); ARCHITECTURE.md §5.4. L'elenco
delle notifiche nell'app esiste già ("F-06 · Notifiche"): qui si aggiungono le notifiche sul
telefono. La beta è solo PWA (D-13): si disegna il Web Push, con le differenze di iPhone. Il
check-in è in `design/F-20-checkin/`. Il prompt da incollare in Claude Design è tutto quello
che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta le **notifiche sul telefono**:
richiesta del permesso, preferenze e aspetto delle notifiche, usando solo i token, i
componenti e il movimento già definiti:
- accento A arancio "lampione al sodio";
- Archivo e IBM Plex Mono;
- elenco delle notifiche e campanella di "F-06 · Notifiche", righe di impostazione con
  interruttore e fogli dal basso di "F-41 · Privacy e dati".

Formato **mobile 390 × 844**, con una verifica a **360 px** e una a **1280 px**: da desktop
la navigazione delle aree è una barra laterale (ADR-0022) e i contenuti stanno in una colonna
di 720 px. Tema **scuro e chiaro**. Mettile in una nuova riga del canvas intitolata
"F-22 · Notifiche sul telefono".

## Contesto e regole che il design deve rendere evidenti
- **Consenso esplicito** (F-22): le notifiche sul telefono sono spente finché non le accendi
  tu. Il permesso del sistema si chiede **solo dopo** un tuo tocco su "Attiva", mai
  all'apertura dell'app né durante l'onboarding.
- **Prima il nostro foglio, poi quello del sistema**: un foglio spiega cosa arriverà e cosa
  no; "Attiva" e "Non ora" hanno lo stesso peso (R-43). Dopo un "Non ora" non si richiede di
  nuovo da soli: resta solo l'interruttore nelle impostazioni e una riga discreta in fondo
  all'elenco delle notifiche.
- **Solo testi di sistema** (F-22): sulla schermata di blocco il testo è scritto da Noxa e
  **non contiene nomi, username o testi di altre persone**: "Hai una nuova richiesta di
  amicizia", "Un amico ha fatto check-in", "Novità sulla serata di sabato". I dettagli si
  vedono solo aprendo l'app. Prepara una tavola con gli esempi per ogni tipo.
- **Niente pressione** (R-43): nessuna notifica di richiamo ("Non ti vediamo da un po'"),
  nessuna notifica di marketing, nessun "i tuoi amici escono stasera".
- **iPhone**: il Web Push funziona solo con Noxa **aggiunta alla schermata Home**. Da Safari
  senza installazione si vede la spiegazione con i due passi (Condividi → Aggiungi alla
  schermata Home), non un interruttore che non fa niente.
- **Permesso negato dal sistema**: l'interruttore non può riaccenderlo; si spiega dove
  cambiarlo nelle impostazioni del browser o del telefono.
- **Dispositivi** (R-66): ogni telefono o browser su cui le hai attivate è una riga
  ("Questo dispositivo", "Browser · ultimo uso 02.11"); si può togliere. Disattivare le
  notifiche toglie il dispositivo.

## Stile
Linguaggio di Privacy e dati e delle notifiche nell'app: titoli Archivo stretto, etichette
da pensilina in maiuscoletto, date in IBM Plex Mono, un solo accento per l'azione principale.
Le anteprime delle notifiche di sistema imitano in modo neutro la schermata di blocco (icona
dell'app, "NOXA", testo), senza riprodurre l'interfaccia di un sistema operativo preciso.

## Schermate e stati

### 1. Foglio "Ricevi le notifiche sul telefono"
- Si apre da: interruttore in Privacy e dati (§2), riga discreta in fondo all'elenco delle
  notifiche, primo check-in fatto o prima serata di gruppo a cui partecipi (una volta sola,
  come suggerimento nel foglio dell'esito, non come finestra a parte).
- Contenuto: cosa arriva (richieste di amicizia, inviti e novità dei gruppi, check-in degli
  amici, esiti di moderazione), cosa non arriva mai (pubblicità, richiami, testi di altre
  persone), "Puoi spegnerle quando vuoi".
- Azioni: "Attiva" e "Non ora", stesso peso.
- Esiti: attivate ("Notifiche attive su questo dispositivo"); permesso negato dal sistema
  (spiegazione di dove cambiarlo); browser non compatibile; iPhone senza installazione (i due
  passi per aggiungere Noxa alla schermata Home); errore di registrazione con Riprova.

### 2. Profilo › Privacy e dati › Notifiche
Nuova sezione **Notifiche** in "F-41 · Privacy e dati":
- interruttore "Notifiche sul telefono" (predefinito spento) con la spiegazione breve;
- elenco **Dispositivi** con le notifiche attive: "Questo dispositivo" in cima, poi gli
  altri con piattaforma e data dell'ultimo uso, ciascuno con "Togli";
- riga "Le notifiche restano anche nell'app per 90 giorni".
- Stati: caricamento, salvataggio non riuscito (torna com'era, con un avviso), offline,
  permesso negato dal sistema (interruttore spento con la spiegazione), iPhone senza
  installazione, nessun dispositivo.

### 3. Notifiche sulla schermata di blocco
Tavola di esempi, una per tipo, con titolo e testo di sistema:
- richiesta di amicizia, amicizia accettata;
- invito in un gruppo, nuova serata, novità sulla serata, rimozione da un gruppo;
- check-in di un amico;
- esito di moderazione (flyer pubblicato, flyer rifiutato, segnalazione decisa, contenuto
  rimosso).
Toccare la notifica apre la schermata giusta dell'app; se nel frattempo l'oggetto non c'è più
(amicizia annullata, check-in terminato, persona bloccata) si apre l'elenco delle notifiche
con un avviso "Non è più disponibile".

### 4. Elenco delle notifiche (aggiornamento)
- Riga discreta in fondo, solo se le notifiche sul telefono sono spente: "Vuoi riceverle
  anche sul telefono? Attiva" (apre il §1). Si può nascondere con "Non mostrare più".
- Nuovo tipo "check-in di un amico" (dettaglio in `design/F-20-checkin/`).

## Testi e tono
"Tu", frasi brevi, tono da amici ma sobrio: una notifica è un'informazione, non un invito a
fare qualcosa. Nessun dato di persone vere negli esempi: "Giulia R." `@giulia.r`, "Marco B."
`@marcob`; locali di fantasia ("Binario 7").

## Accessibilità
- WCAG 2.2 AA nei due temi; aree di tocco di almeno 44 px.
- Interruttori con etichetta e stato letti insieme ("Notifiche sul telefono, disattivato").
- Gli esiti della richiesta del permesso annunciati in una regione live.
- I passi per iPhone sono un elenco numerato, con testo oltre alle icone.
- Fogli chiudibili con Esc e con il gesto indietro; focus visibile.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px e la tavola degli esempi della schermata di blocco.

Aggiungi alla tavola dei componenti i componenti nuovi:
- foglio di richiesta del permesso;
- riga di un dispositivo;
- avviso "permesso negato" e "aggiungi alla schermata Home";
- anteprima neutra di una notifica di sistema.

Esporta l'HTML come `notifiche.html` e le tavole come immagini in questa cartella (con il
foglio CSS del layer, come per le altre aree).
