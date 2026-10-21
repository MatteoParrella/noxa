# Brief — F-40 Area di moderazione: flyer e segnalazioni (iterazione 6)

Schermate da preparare prima dell'iterazione 6 (GUIDA_OPERATIVA.md §4). Continuano l'area di
moderazione dell'iterazione 5 (`design/F-40-moderazione-fonti/`): stesso guscio, stessa
navigazione, stessi componenti. Requisiti: PRD F-06, F-10 (foto profilo), F-12, F-40; regole
R-06, R-51, R-52, R-53, R-55, R-69 di SAFETY_PRIVACY.md (e §11, procedura operativa);
DATA_MODEL.md (`caricamenti_flyer`, `segnalazioni`, `azioni_moderazione`); EVENT_INGESTION.md
§3 (flyer). Il prompt da incollare in Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** completa l'**area di moderazione** con le
**code dei flyer e delle segnalazioni**, usando il guscio, i componenti e lo stile già
disegnati per "F-40 · Moderazione: locali e fonti" (navigazione laterale, tabella densa,
badge di stato, conferma con motivazione, riga del registro). Formato **desktop 1280 × 800**,
con una verifica a **1024 px** e una a **390 px** (intervento urgente da telefono). Tema
**scuro e chiaro**. Mettile in una nuova riga del canvas intitolata
"F-40 · Moderazione: flyer e segnalazioni".

## Contesto e regole che il design deve rendere evidenti
- **Flyer** (R-51): gli utenti caricano foto di flyer; un modello di intelligenza
  artificiale ne estrae i dati; nessun evento da flyer si pubblica senza che un moderatore
  lo controlli confrontando i campi con l'immagine. Se corrisponde a un evento già
  pubblicato da una fonte verificata, il flyer si **unisce** e non cambia i campi.
- **Anonimato** (R-69): nella coda dei flyer **non compare chi l'ha caricato**; nelle
  segnalazioni non compare chi ha segnalato. Dei dati degli utenti si vede solo l'oggetto
  segnalato, e **aprire una segnalazione viene registrato**: la schermata lo dice.
- **Priorità e tempi** (R-53): le segnalazioni sono ordinate per priorità. Priorità 1
  "Rischio per un minore" (adescamento): entro 4 ore tra le 08:00 e le 02:00, entro le 10:00
  per quelle notturne; priorità 2 "Coinvolge un minorenne": entro 24 ore; priorità 3: entro
  72 ore. Il tempo che resta si vede su ogni riga e diventa evidente vicino alla scadenza
  (con testo, non solo colore).
- **Ogni decisione è motivata** e la motivazione arriva alle persone interessate (DSA art.
  17): il moderatore vede l'**anteprima del messaggio** che riceveranno. Le persone possono
  presentare **reclamo** (DSA art. 20), che esamina un moderatore diverso da chi ha deciso.
- **Casi gravi** (R-55): materiale pedopornografico, adescamento o minacce gravi. L'azione
  "Escalation alle autorità" è separata dalle altre, con una conferma esplicita: sospende
  l'account, rende il contenuto inaccessibile e lo conserva come prova; **non esiste un
  pulsante per scaricare o inoltrare** il contenuto; nessun messaggio all'account sospeso.
- **Foto profilo** (R-52): un moderatore può rimuoverla; al suo posto tornano le iniziali.
- **Alcol ed età** (R-21, R-22, R-23): nella revisione del flyer età non dichiarata = 18+;
  "Riferimenti all'alcol" è una scelta esplicita del moderatore; scendere sotto i 18 anni
  richiede la motivazione, come nella scheda evento dell'iterazione 5.

## Schermate e stati

### 1. Guscio
- Nella barra laterale si accendono **Flyer** e **Segnalazioni** (oggi "In arrivo"), con i
  contatori; il contatore delle segnalazioni mostra a parte quelle di priorità 1.
- Un avviso in cima a tutte le sezioni quando c'è una segnalazione di priorità 1 aperta
  ("1 segnalazione urgente · scade alle 23:40"), che porta alla coda.

### 2. Coda dei flyer
- **Elenco**: miniatura, data di arrivo, **confidenza** dell'estrazione (0–100 % in
  monospaziato), titolo e locale estratti (o "Locale non riconosciuto"), segnale di
  **possibile corrispondenza** con un evento già pubblicato, stato (In revisione, Non
  leggibile). Filtri: stato, confidenza bassa, locale non riconosciuto, con
  corrispondenza. Nessuna colonna con l'utente.
- **Revisione** (pagina a due colonne): a sinistra il **flyer** ingrandibile (zoom, sposta,
  adatta), a destra i **campi estratti modificabili** allineati: titolo, locale (scelta con
  ricerca, oppure "Crea locale" che porta alla scheda dell'iterazione 5), data e ora di
  inizio e fine, età minima con "dichiarata sul flyer sì/no", **riferimenti all'alcol**
  (scelta obbligatoria sì/no), generi, artisti, prezzo minimo, link ai biglietti. I campi a
  bassa confidenza hanno un segno scritto ("da controllare").
- **Corrispondenza**: se c'è un evento già pubblicato simile, un riquadro con il confronto
  breve e l'azione "Unisci a questo evento" (il flyer aggiunge solo la fonte).
- **Conferme prima di pubblicare** (caselle): "Ho confrontato i campi con il flyer",
  "Il flyer non contiene contenuti inadatti" (l'immagine potrà comparire come sfondo
  dell'evento, anche per i minorenni se l'evento è visibile a loro).
- **Azioni**: "Approva e pubblica" (principale), "Unisci", "Rifiuta" con **motivo**
  (scelta tra motivi frequenti — non è un flyer, evento già passato, informazioni
  illeggibili, locale fuori da Milano e Brianza, contenuto inadatto — più testo) e
  anteprima di cosa vedrà l'utente; "Escalation alle autorità" nel menu ⋯ (§4).
- Scorciatoie da tastiera indicate (A approva, R rifiuta, frecce per il successivo).
- Stati: coda vuota ("Nessun flyer da controllare"), caricamento, errore, decisione salvata
  con passaggio al successivo, flyer già deciso da un altro moderatore.

### 3. Coda delle segnalazioni
- **Elenco** ordinato per priorità e scadenza: badge di priorità scritto (P1 "Rischio
  minore", P2 "Minorenne", P3), **tempo rimanente** (in monospaziato, "2 h 15 min"),
  tipo di oggetto (Profilo, Foto profilo, Evento, Foto del locale, Flyer), motivo, numero di
  segnalazioni sullo stesso oggetto, stato (Aperta, In lavorazione, Chiusa). Filtri: priorità,
  tipo, motivo, stato, "assegnate a me". Nella lista **non si vede il contenuto**: si apre
  solo dal dettaglio.
- **Dettaglio**: banda "L'apertura di questa segnalazione è stata registrata"; l'**oggetto
  segnalato** com'è per gli utenti (profilo: solo avatar, nome e username; evento: scheda;
  foto del locale o flyer: immagine sfocata con "Mostra" esplicito); motivo e testo scritto
  da chi ha segnalato (senza la sua identità); altre segnalazioni sullo stesso oggetto;
  **registro** delle azioni precedenti.
- **Azioni**: "Nessuna violazione", "Rimuovi contenuto" (per un profilo: foto profilo, nome
  o username, a scelta), "Correggi evento" (porta alla scheda evento), "Sospendi account",
  ognuna con **motivazione obbligatoria** e l'anteprima del messaggio per chi ha segnalato e
  per chi è coinvolto. "Prendi in carico" la segna "In lavorazione" a proprio nome.
- Stati: vuoto ("Nessuna segnalazione aperta"), caricamento, errore, decisione salvata,
  segnalazione presa in carico da un altro moderatore.

### 4. Escalation alle autorità (R-55)
- Azione separata, con colore e testo di gravità ma senza allarmismo, nel menu ⋯ del
  dettaglio della segnalazione e della revisione del flyer.
- Conferma in due passaggi: cosa succede ("L'account viene sospeso, il contenuto diventa
  inaccessibile e viene conservato come prova. La segnalazione alla Polizia Postale la fa
  l'amministratore incaricato."), motivazione obbligatoria, digitazione di una parola di
  conferma. Dopo: stato "In escalation" e registro; nessuna anteprima di messaggio
  all'utente.

### 5. Reclami
- Una scheda "Reclami" nella sezione Segnalazioni: elenco con la decisione originale, chi
  l'ha presa ("Moderatore Uno"), data e testo del reclamo. Chi ha preso la decisione
  originale vede il reclamo ma **non può deciderlo** (pulsanti spenti con il motivo).
- Azioni: "Conferma la decisione" o "Cambia la decisione" (con la nuova azione), entrambe con
  motivazione e anteprima del messaggio.
- Stati: vuoto, caricamento, errore.

## Testi e tono
Professionale e chiaro, frasi brevi, nessun gergo. Nessun dato di persone vere o locali
veri: locali "Officina Lambro", "Cascina Torretta", "Club Binario 7"; utenti "Giulia R."
`@giulia.r`; moderatori "Moderatore Uno", "Moderatore Due". Nessuna immagine realistica di
contenuti inadatti negli esempi: usa riquadri sfocati con didascalia.

## Accessibilità
WCAG 2.2 AA nei due temi; navigazione completa da tastiera con le scorciatoie indicate;
focus visibile; priorità, scadenze e confidenze scritte, non solo colori; l'immagine
sfocata ha un'alternativa testuale e "Mostra" è un pulsante vero; conferme chiudibili con
Esc; lo zoom del flyer funziona anche con + e −.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 1024
e 390 px. Aggiungi alla tavola dei componenti i componenti nuovi (visualizzatore del flyer
con zoom, campo con segno di bassa confidenza, badge di priorità con tempo rimanente,
immagine sfocata con "Mostra", anteprima del messaggio all'utente, conferma in due passaggi
dell'escalation, voce di reclamo). Esporta l'HTML come `moderazione.html` e le tavole come
immagini in questa cartella (o in `esportazione/` con il foglio CSS del layer
`noxa-moderazione.css` aggiornato).
