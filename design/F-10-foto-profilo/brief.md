# Brief — F-10 Foto profilo (iterazione 6)

Schermate da preparare prima dell'iterazione 6 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-10
(foto profilo facoltativa) e F-12; regole R-50, R-52 di SAFETY_PRIVACY.md; DATA_MODEL.md §6
(bucket `avatar`). La notifica di rimozione e il reclamo sono in `design/F-06-flyer/`, la
rimozione da parte dei moderatori in `design/F-40-moderazione/`. Il prompt da incollare in
Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta la **foto profilo**: scelta,
ritaglio, sostituzione e rimozione, usando solo i token, i componenti e il movimento già
definiti (accento A arancio, Archivo + IBM Plex Mono) e il componente avatar con le
iniziali che esiste già. Formato **mobile 390 × 844**, con una verifica a **360 px** e una a
**1280 px**. Tema **scuro e chiaro**. Mettile in una nuova riga del canvas intitolata
"F-10 · Foto profilo".

## Contesto e regole che il design deve rendere evidenti
- La foto è **facoltativa**: senza foto restano le iniziali, che sono un'opzione a pieno
  titolo, non uno stato "incompleto". Nessun invito insistente a caricarla.
- **Chi la vede** (R-52): solo chi può già vedere il profilo (amici confermati e, più
  avanti, i membri degli stessi gruppi). Una riga lo dice dove si sceglie la foto.
- **Privacy della foto**: ritaglio quadrato, conversione e rimozione di posizione e dati del
  telefono (EXIF) **sul dispositivo**, prima dell'invio. File JPEG, PNG o WebP fino a 2 MB.
- **Segnalabile e rimovibile** (R-50, R-52): chi vede il profilo può segnalarlo; un
  moderatore può rimuovere la foto con una motivazione, e la persona riceve la notifica e
  può presentare reclamo.
- Suggerimento discreto, uguale per tutte le età: "Usa una foto tua, senza altre persone".

## Schermate e stati

### 1. Dal profilo
- In **Modifica profilo** (esiste dall'iterazione 3): l'avatar grande in cima con
  "Aggiungi foto" (senza foto) o "Cambia foto" (con foto).
- Foglio delle azioni: **Scatta una foto**, **Scegli dalla galleria** (sul desktop: scegli
  un file), **Rimuovi foto** (solo se c'è).

### 2. Ritaglio
- Cerchio di ritaglio su sfondo velato, con trascinamento, pizzico e **cursore dello zoom**;
  alternativa da tastiera (frecce per spostare, + e − per lo zoom) indicata a schermo.
- Anteprima affiancata dell'avatar nelle dimensioni reali (elenco amici, scheda profilo).
- Riga "Abbiamo tolto posizione e dati del telefono" e "La vedono solo i tuoi amici".
- "Salva" (principale) e "Annulla".

### 3. Stati
- Invio in corso (sull'avatar), **salvata** (messaggio breve), formato non valido, file
  oltre 2 MB (con "Scegline un'altra"), errore con "Riprova", offline ("Serve la
  connessione"), permesso della fotocamera o della galleria negato (con come attivarlo).
- **Sostituzione**: stesso flusso; la foto precedente resta finché la nuova non è salvata.
- **Rimozione**: conferma breve ("Tornano le tue iniziali"), poi messaggio con "Annulla".
- **Rimossa da un moderatore**: nel profilo, al posto della foto le iniziali e una riga
  "La tua foto è stata rimossa: vedi il motivo" che apre la notifica con la motivazione e
  "Presenta reclamo".

### 4. Dove compare
- Una tavola con l'avatar con foto e con iniziali nelle dimensioni in uso: elenco amici e
  richieste, risultati della ricerca, scheda di una persona, pila di avatar degli amici
  che partecipano su Scopri e nel dettaglio evento, voce di notifica.
- Nella scheda di una persona, il menu ⋯ con "Segnala" (esiste già) apre il foglio di
  segnalazione: aggiungi la scelta di cosa segnalare, "Il profilo" o "La foto profilo",
  come primo passo solo quando la persona ha una foto (restano al massimo due tocchi per
  inviare, R-50).

## Testi e tono
"Tu", frasi brevi, neutre. Nessun dato di persone vere negli esempi: "Giulia R."
`@giulia.r`, "Marco B." `@marcob`; foto d'esempio illustrate o astratte, non di persone
reali riconoscibili.

## Accessibilità
WCAG 2.2 AA nei due temi; il ritaglio è utilizzabile senza gesti (cursore e tastiera,
WCAG 2.5.7); aree di tocco di almeno 44 px; l'avatar ha il nome come testo alternativo;
stati annunciati con una regione live; fogli chiudibili con Esc e con il gesto indietro.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px. Aggiungi alla tavola dei componenti il ritaglio circolare con cursore dello zoom
e le varianti dell'avatar (foto, iniziali, invio in corso). Esporta l'HTML come
`foto-profilo.html` e le tavole come immagini in questa cartella.
