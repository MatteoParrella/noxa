# Brief — F-40 Area di moderazione: locali, fonti, duplicati (iterazione 5)

Schermate da preparare prima dell'iterazione 5 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-40 e
F-44; regole R-06, R-21, R-22, R-23, R-50, R-56, R-69 di SAFETY_PRIVACY.md; ADR-0008
(conformità delle fonti), ADR-0018 (foto dei locali); EVENT_INGESTION.md §2 (fonti e
verifica di conformità), §6.4 (revisione dei duplicati), §7 (fusione e possibili
annullamenti), §8 (monitoraggio); skill `add-event-source`. Le code di flyer e segnalazioni
sono dell'iterazione 6 (`design/F-40-moderazione/`): qui serve solo lo spazio per loro nella
navigazione. Il prompt da incollare in Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta l'**area di moderazione** di Noxa,
usando solo i token, i componenti e il movimento già definiti (accento A arancio "lampione al
sodio", Archivo + IBM Plex Mono). È uno strumento di lavoro interno, non una vetrina: denso,
leggibile, senza animazioni espressive (solo transizioni funzionali brevi). Formato
**desktop 1280 × 800**, con una verifica a **1024 px** e una a **390 px** (deve restare
utilizzabile da telefono per un intervento urgente, senza tavole dedicate per ogni stato).
Tema **scuro e chiaro**. Mettile in una nuova riga del canvas intitolata
"F-40 · Moderazione: locali e fonti".

## Contesto e regole che il design deve rendere evidenti
Noxa raccoglie gli eventi della sera di Milano e Brianza dai siti dei locali e dagli account
Instagram ufficiali. I moderatori (un piccolo team interno) verificano i locali, decidono
quali fonti si possono leggere, controllano i possibili duplicati e correggono gli eventi.
- **Due fattori obbligatori** (R-06): senza il codice dell'app di autenticazione l'area non
  si apre. Nessun dato degli utenti si vede in quest'area (R-69): solo locali, fonti, eventi.
- **Conformità prima di tutto** (ADR-0008): una fonte si può attivare solo se è
  "consentita", cioè dopo aver scritto l'esito di robots.txt e dei termini d'uso con link e
  data. "Vietata" e "Da verificare" non si attivano: il pulsante "Attiva" non esiste o è
  spento con il motivo scritto. Instagram solo con l'API ufficiale; gli aggregatori sono
  "vietati" finché non c'è un accordo.
- **Foto del locale** (ADR-0018, R-56): una sola foto per locale, caricata da un moderatore,
  con la fonte obbligatoria (autorizzazione scritta del locale con il riferimento al
  documento, foto di Noxa, licenza libera con attribuzione). Prima di salvare il moderatore
  conferma con caselle esplicite: niente persone riconoscibili, niente bottiglie o marchi di
  alcolici in evidenza. La foto è visibile anche ai minorenni.
- **Età degli eventi** (R-21, R-22, R-23): un'età non dichiarata vale 18+; abbassare un'età
  dichiarata o togliere i "riferimenti all'alcol" lo fa solo un moderatore, con una
  motivazione obbligatoria che viene registrata. Il design deve far sentire che è
  un'operazione delicata (conferma, testo che spiega l'effetto sui minorenni), senza
  allarmismi.
- **Ogni decisione è motivata e registrata**: niente azioni silenziose; un campo
  "Motivazione" dove serve e una riga di conferma dopo l'azione.

## Stile
Linguaggio delle schermate già disegnate: titoli Archivo stretto, etichette da pensilina in
maiuscoletto, dati (orari, date, conteggi, URL, codici) in IBM Plex Mono, un solo accento
per l'azione principale. Tabelle e liste dense ma con righe di almeno 44 px; stati scritti
con badge testuali, mai solo colore. Nessuna barra di navigazione delle 5 aree dell'app:
l'area ha la sua navigazione laterale.

## Schermate e stati

### 1. Accesso all'area: due fattori
- **Attiva i due fattori** (prima volta): spiegazione breve ("Serve un'app di
  autenticazione, per esempio quella del telefono"), QR da scansionare con il codice segreto
  scritto sotto (monospaziato, copiabile), campo per il codice di 6 cifre, "Attiva".
- **Inserisci il codice** (accessi successivi): campo di 6 cifre a caselle o unico,
  "Continua", link "Non hai il telefono? Scrivi all'amministratore".
- Stati: codice errato (errore sotto il campo, senza svuotarlo del tutto), troppi tentativi
  (attesa), account senza ruolo di moderatore ("Quest'area è riservata al team di
  moderazione"), sessione scaduta.

### 2. Guscio dell'area
- Barra laterale con: **Locali**, **Fonti**, **Duplicati** (con contatore neutro), **Eventi**
  (correzioni e possibili annullamenti, con contatore), e, spente con l'etichetta "In
  arrivo", **Flyer** e **Segnalazioni** (iterazione 6). In fondo: nome del moderatore,
  "Torna all'app", "Esci".
- Intestazione di pagina con titolo, conteggio, ricerca e filtri della sezione.

### 3. Locali
- **Elenco**: tabella con nome, comune e provincia (MI/MB), stato (Attivo / Non attivo / Da
  verificare), foto (sì/no con miniatura), numero di fonti e di fonti attive, eventi nei
  prossimi 7 giorni, ultimo aggiornamento. Filtri: provincia, stato, "senza foto", "senza
  fonti attive"; ricerca per nome.
- **Candidati da verificare** (bootstrap da OpenStreetMap e Google Places): elenco a parte
  con l'origine ("OSM", "Google: solo identificativo"), azioni "Verifica e crea",
  "Unisci a un locale esistente" (scelta del locale con ricerca), "Scarta" con motivo.
- **Scheda del locale** (pagina o pannello laterale): dati modificabili (nome, indirizzo,
  comune, provincia, posizione su una piccola mappa con il segnaposto trascinabile, sito,
  username Instagram, attivo sì/no), sezione **Foto**, elenco delle sue **fonti** con stato e
  "Aggiungi fonte", **prossimi eventi** del locale.
- **Foto del locale**: area di caricamento (trascina o scegli; JPEG/PNG/WebP), anteprima
  ritagliata 16:10 com'è nella scheda in evidenza di Scopri e con la velatura, scelta della
  **fonte** (tre opzioni) con il campo obbligatorio che cambia (riferimento dell'autorizzazione
  oppure attribuzione, es. "Laura Bassi, CC BY 4.0"), le due **conferme di contenuto**, "Salva
  foto". Stati: caricamento, file troppo grande (oltre 1 MB dopo la conversione, viene
  ridotta da sola), formato non valido, foto salvata (con chi l'ha approvata e quando),
  "Sostituisci" e "Rimuovi foto" (con motivazione).
- Stati della sezione: vuoto ("Nessun locale con questi filtri"), caricamento, errore.

### 4. Fonti
- **Elenco**: tabella con locale, tipo (Sito / Instagram / aggregatore), URL o @username,
  adattatore, **conformità** (Da verificare / Consentita / Vietata), **attiva** (sì/no),
  frequenza ("ogni 6 h"), ultima esecuzione (data e ora), **esito** (eventi letti, nuovi,
  uniti, errori) ed errori consecutivi. Filtri: conformità, attive, con errori, "0 eventi
  nelle ultime 3 esecuzioni" (probabile cambio del sito, EVENT_INGESTION.md §8).
- **Nuova fonte / modifica**: locale, tipo, URL, adattatore (scelta da un elenco), frequenza
  (minimi: 6 h per i siti, 12 h per Instagram, con l'aiuto scritto), e la sezione
  **Verifica di conformità** con quattro campi guidati: esito di robots.txt per `NoxaBot` e
  `*` (con il link), termini d'uso (link e data di lettura), pagine massime per esecuzione,
  campi raccolti ("solo quelli dello schema evento"). Poi la scelta Consentita / Vietata.
- **Azioni**: "Esegui ora" (prova anche se non è attiva; mostra l'esito quando arriva),
  "Attiva" / "Disattiva" (solo per le consentite), "Segna come vietata". Una fonte
  disattivata in automatico dopo 5 errori ha un avviso con l'ultimo errore.
- **Dettaglio dell'esito**: ultime esecuzioni in una lista cronologica (data, durata, pagine
  lette, eventi, errore con codice), senza grafici superflui.

### 5. Duplicati
- **Coda**: elenco dei possibili duplicati con punteggio (0–100, in monospaziato), motivo
  ("stesso locale, orario a 30 minuti, titolo simile" oppure "modifica rilevante" o "locale
  non riconosciuto"), fonte, data di arrivo.
- **Confronto affiancato**: a sinistra l'evento esistente, a destra il dato appena raccolto;
  campi allineati riga per riga (titolo, locale, inizio e fine, età, alcol, generi, artisti,
  prezzo, link) con le **differenze evidenziate** (anche con un segno scritto, non solo
  colore). Sotto: "Stesso evento" (con l'anteprima del risultato della fusione: età massima,
  alcol se almeno una fonte lo indica) e "Eventi distinti". Scorciatoie da tastiera
  indicate (S / D, frecce per passare al successivo).
- Per "locale non riconosciuto": scelta del locale con ricerca oppure "Crea locale".
- Stati: coda vuota ("Niente da controllare"), caricamento, errore, decisione salvata con
  passaggio al successivo.

### 6. Eventi
- **Ricerca e correzione**: elenco con titolo, locale, data della serata, età (badge
  "18+ · non dichiarata" quando serve), alcol (badge), stato (Pubblicato, In revisione,
  Annullato, Rifiutato), fonti. Filtri per stato, data, locale.
- **Scheda evento del moderatore**: campi correggibili, con le operazioni delicate separate:
  **abbassare l'età dichiarata** e **togliere "riferimenti all'alcol"** aprono una conferma
  con motivazione obbligatoria e la frase "L'evento diventerà visibile anche a chi ha meno
  di N anni". Azioni: "Pubblica", "Annulla evento" (con motivazione: chi aveva scelto
  "Partecipo" lo vedrà come annullato), "Rifiuta".
- **Possibili annullamenti**: elenco degli eventi non più trovati nella loro unica fonte per
  due esecuzioni, a più di 48 ore dall'inizio, con "Conferma annullamento" e "È ancora in
  programma".
- **Registro**: sotto ogni locale, fonte ed evento, le ultime azioni dei moderatori (chi,
  quando, cosa, motivazione), in sola lettura.

## Testi e tono
Professionale e chiaro, "tu", frasi brevi. Errori che dicono cosa fare. Nessun dato di
persone vere o locali veri negli esempi: "Officina Lambro", "Cascina Torretta", "Club
Binario 7", "Sala Ventuno", siti nel dominio `.example`, moderatori "Moderatore Uno".

## Accessibilità
WCAG 2.2 AA nei due temi; navigazione completa da tastiera (tabelle con righe
selezionabili, scorciatoie della coda dei duplicati); focus visibile; differenze e stati
scritti; pannelli e conferme chiudibili con Esc; contrasto delle differenze evidenziate.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 1024
e 390 px. Aggiungi alla tavola dei componenti del design system i componenti nuovi
(navigazione laterale, tabella densa con filtri, badge di conformità e di stato, campo del
codice a 6 cifre, caricamento della foto con anteprima, confronto affiancato con
differenze, conferma con motivazione, riga del registro). Esporta l'HTML come
`moderazione-fonti.html` e le tavole come immagini in questa cartella (o in `esportazione/`
con il foglio CSS del layer, come per Scopri).
