# Brief — F-06 Flyer, notifiche nell'app e reclamo (iterazione 6)

Schermate da preparare prima dell'iterazione 6 (GUIDA_OPERATIVA.md §4), lato utente.
Requisiti: PRD F-06, F-10 (notifiche degli esiti), F-12 (stato delle proprie segnalazioni);
regole R-20, R-50, R-51, R-53, R-54, R-66 di SAFETY_PRIVACY.md; DATA_MODEL.md
(`caricamenti_flyer`, `notifiche`, `segnalazioni`); EVENT_INGESTION.md §3 (flyer). Le code di
moderazione sono in `design/F-40-moderazione/`, la foto profilo in `design/F-10-foto-profilo/`.
Il centro notifiche completo (push, permessi, preferenze) è dell'iterazione 9
(`design/F-22-notifiche/`): qui serve solo l'elenco nell'app. Il prompt da incollare in
Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta il **caricamento dei flyer**, lo
**stato dei miei flyer**, le **notifiche nell'app** e il **reclamo sulle decisioni di
moderazione**, usando solo i token, i componenti e il movimento già definiti (accento A
arancio "lampione al sodio", Archivo + IBM Plex Mono). Formato **mobile 390 × 844**, con una
verifica a **360 px** e una a **1280 px** (PWA da desktop). Tema **scuro e chiaro**. Mettile
in una nuova riga del canvas intitolata "F-06 · Flyer, notifiche e reclami".

## Contesto e regole che il design deve rendere evidenti
Chi trova un flyer di una serata (foto o screenshot) può caricarlo: un modello di
intelligenza artificiale ne legge titolo, data, locale ed età, poi un moderatore lo
controlla. Nessun flyer diventa un evento senza revisione umana (R-51), salvo quando
corrisponde a un evento già pubblicato: allora viene solo "unito".
- **Limiti** (R-54): al massimo **10 flyer ogni 24 ore**; JPEG, PNG o WebP fino a **10 MB**.
  Il contatore dei caricamenti rimasti si vede prima di scegliere la foto, non dopo l'errore.
- **Privacy della foto** (R-54, R-66): posizione e dati del telefono (EXIF) si tolgono sul
  dispositivo prima dell'invio; l'immagine viene analizzata da un servizio esterno **senza
  il nome di chi l'ha caricata**. Una riga breve lo dice, con il link all'informativa.
- **Anonimato verso i moderatori** (R-69): i moderatori non sanno chi ha caricato il flyer.
  Si può dire all'utente ("Chi controlla non vede il tuo nome").
- **Età** (R-20): se l'evento pubblicato non è visibile per la propria età, lo stato dice
  "Pubblicato" senza link al dettaglio e senza spiegare perché, come per tutti gli eventi
  non visibili.
- **Motivazioni e reclamo** (R-53, DSA art. 17 e 20): ogni decisione che riguarda l'utente
  (flyer rifiutato, segnalazione decisa, foto profilo o altro contenuto rimosso) arriva con
  la motivazione e con la possibilità di **presentare reclamo** una volta, entro 6 mesi.
- **Notifiche** (F-22): solo testi di sistema, mai testi scritti da altri utenti; di
  un'altra persona si vedono solo avatar, nome e username, e solo se si può vedere il suo
  profilo.

## Stile
Linguaggio delle schermate già disegnate (Scopri, Amici): titoli Archivo stretto, etichette
da pensilina in maiuscoletto, date, orari e contatori in IBM Plex Mono, un solo accento per
l'azione principale. Stati scritti con badge testuali, mai solo colore. Barra di navigazione
delle 5 aree visibile dove già lo è.

## Schermate e stati

### 1. Punti di ingresso
- In **Scopri**: un'azione "Carica un flyer" nell'intestazione (icona + etichetta
  accessibile) e nello stato vuoto ("Non trovi una serata? Carica il flyer").
- Nel **Profilo**: voce "I miei flyer" con il numero di quelli in attesa, accanto a "Le mie
  segnalazioni".

### 2. Carica un flyer
- Spiegazione breve (2 righe) e i passaggi: "Lo leggiamo, lo controlliamo, lo pubblichiamo".
- Scelta: **Scatta una foto** / **Scegli dalla galleria** (sul desktop: trascina o scegli).
- **Anteprima** dell'immagine scelta, con la riga "Abbiamo tolto posizione e dati del
  telefono", contatore "Ti restano N caricamenti oggi", la riga sull'analisi esterna senza
  nome con il link all'informativa, pulsante "Invia" e "Scegli un'altra".
- Stati: invio in corso (barra di avanzamento), **inviato** (conferma con "Ti avvisiamo
  quando è controllato" e link a "I miei flyer"), formato non valido, file oltre 10 MB,
  **limite giornaliero raggiunto** (con l'ora in cui si libera il prossimo caricamento,
  pulsante spento), offline ("Serve la connessione per inviare il flyer"), errore generico
  con "Riprova", permesso della fotocamera negato (con l'alternativa della galleria).

### 3. I miei flyer
- Elenco con miniatura del proprio flyer, data di invio, **stato** con badge:
  "In analisi", "In revisione", "Pubblicato" (con il titolo e il link all'evento se
  visibile), "Unito a un evento esistente" (con il link), "Rifiutato" (con il motivo per
  intero), "Non leggibile" (errore di analisi, con "Caricane un altro").
- Ogni voce ha il menu ⋯ con "Elimina": conferma che spiega che si cancellano la richiesta e
  l'immagine, ma un evento già pubblicato resta.
- Su un flyer rifiutato: "Presenta reclamo" (vedi §5).
- Stati: vuoto ("Non hai ancora caricato flyer" + "Carica un flyer"), caricamento,
  errore, offline (ultimo elenco salvato, con la data dell'aggiornamento).

### 4. Notifiche nell'app
- Una **campanella** nell'intestazione delle aree con il numero delle non lette (in
  monospaziato, letto dallo screen reader come "3 notifiche non lette").
- **Elenco** in ordine dal più recente, raggruppato per "Oggi", "Questa settimana",
  "Prima"; le non lette distinte anche con un segno scritto. Si aggiorna in tempo reale
  (nuova notifica in cima, annunciata con discrezione, senza spostare il focus).
- Tipi in questa iterazione, ognuno con la sua icona e azione:
  - **Richiesta di amicizia** (avatar, nome, username; "Vedi richiesta");
  - **Amicizia accettata** ("Vedi profilo");
  - **Esito di moderazione**: flyer pubblicato o unito (link all'evento), flyer rifiutato
    (motivo), segnalazione decisa ("Abbiamo esaminato la tua segnalazione su …" + decisione),
    **contenuto rimosso** (per esempio la foto profilo, con la motivazione) — gli ultimi tre
    con "Presenta reclamo".
- Toccare una notifica la segna come letta; "Segna tutte come lette".
- Stati: vuoto ("Nessuna notifica"), caricamento, errore, offline. Le notifiche si
  conservano 90 giorni: una riga in fondo lo dice.

### 5. Le mie segnalazioni e reclamo
- La schermata "Le mie segnalazioni" esiste già (iterazione 3): aggiungi alla voce di una
  segnalazione chiusa la **decisione motivata** in evidenza e il pulsante "Presenta reclamo".
- **Reclamo** (foglio o pagina): riepilogo della decisione, campo di testo "Perché non sei
  d'accordo" (obbligatorio, al massimo 1000 caratteri con il contatore), riga "Lo esamina
  un'altra persona del team", "Invia reclamo". Lo stesso modulo si apre dalle notifiche di
  flyer rifiutato e di contenuto rimosso.
- **Stato del reclamo** sulla voce: "Reclamo inviato", "In esame", "Decisione confermata"
  (con la motivazione), "Decisione cambiata" (con cosa è cambiato). Un reclamo per decisione:
  dopo l'invio il pulsante sparisce.
- Stati: invio in corso, inviato, termine scaduto ("Il reclamo si può presentare entro 6
  mesi dalla decisione"), errore, offline (il testo resta salvato, l'invio è spento).

## Testi e tono
"Tu", frasi brevi, mai colpevolizzanti verso chi riceve un rifiuto o una rimozione. Errori
che dicono cosa fare. Nessun dato di persone vere o locali veri negli esempi: locali
"Officina Lambro", "Cascina Torretta", "Club Binario 7"; persone "Giulia R." `@giulia.r`,
"Marco B." `@marcob`. Nessun riferimento all'alcol negli esempi delle schermate dei
minorenni (R-23, R-40).

## Accessibilità
WCAG 2.2 AA nei due temi; aree di tocco di almeno 44 px; ogni stato annunciato con una
regione live; il contatore della campanella ha un'etichetta testuale; l'anteprima del flyer
ha un testo alternativo ("Flyer che hai scelto"); focus visibile; fogli chiudibili con Esc
e con il gesto indietro.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px. Aggiungi alla tavola dei componenti del design system i componenti nuovi
(selettore della foto con anteprima, barra di avanzamento dell'invio, badge degli stati del
flyer, voce di notifica letta e non letta, campanella con contatore, modulo di reclamo,
riga della decisione motivata). Esporta l'HTML come `flyer.html` e le tavole come immagini
in questa cartella (o in `esportazione/` con il foglio CSS del layer, come per Scopri).
