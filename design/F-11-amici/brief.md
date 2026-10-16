# Brief — F-11 Amici e profilo, F-12 Segnala e blocca

Schermate da preparare prima dell'iterazione 3 (GUIDA_OPERATIVA.md §4), in un unico prompt
perché condividono profilo e componenti. Requisiti: PRD F-11, F-12, F-42 (elenco dei
bloccati); regole R-10…R-17, R-43, R-50, R-52, R-53 di SAFETY_PRIVACY.md (ADR-0017: fascia
unica 14–17); movimento ADR-0019. Le tavole vanno in questa cartella (`immagini/` e
l'esportazione `amici.html`); `design/F-12-segnala-blocca/` rimanda qui. Il prompt da
incollare in Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** aggiungi le schermate degli amici, del
profilo e di segnalazione e blocco, usando solo i token, i componenti e il movimento già
definiti (accento A arancio "lampione al sodio", Archivo + IBM Plex Mono, tema scuro
predefinito). Ogni schermata in **tema scuro e chiaro**, mobile 390 × 844, con una verifica a
360 px. Mettile in una nuova riga del canvas intitolata "F-11 · Amici".

## Contesto e regole che il design deve rendere evidenti
Noxa è per ragazzi dai 14 ai 25 anni a Milano e in Brianza. Le persone si dividono in due
fasce: **14–17 anni** e **18 anni o più**. Nessuno vede l'età degli altri.
- La **ricerca** trova solo persone della propria fascia, per username, dopo almeno 3
  caratteri, al massimo 20 risultati. Mai suggerimenti, "persone che potresti conoscere",
  elenchi di sconosciuti o contatori di follower.
- Un'amicizia nasce solo quando l'altra persona **accetta**. Tra fasce diverse si diventa
  amici **solo con il codice invito**, che si mostra di persona come QR o si condivide come
  link, vale **15 minuti** e si usa una volta sola.
- Prima di accettare o usare un codice di una persona maggiorenne, chi ha 14–17 anni vede un
  avviso: "Stai aggiungendo una persona maggiorenne: aggiungi solo persone che conosci di
  persona."
- Il **blocco** nasconde tutto in entrambe le direzioni, toglie l'amicizia ed è invisibile a
  chi viene bloccato.
- Ogni profilo si **segnala in al massimo due tocchi**.
- Niente chat, niente messaggi, niente "ultimo accesso", niente indicatori di presenza.

## Stile e movimento
Stesso linguaggio delle schermate già fatte (Scopri, Accesso): titoli Archivo stretto,
etichette da pensilina in maiuscoletto, un solo accento. Movimento ADR-0019: titolo che sale
parola per parola, righe degli elenchi che entrano dal sfocato al nitido con sfasamento di
70 ms. Nessun effetto che segue il dito, nessuna animazione infinita (il QR non pulsa).
L'avatar è il cerchio con le iniziali del design system: la foto del profilo non fa parte di
questa iterazione.

## Schermate e stati

### 1. Amici (dentro l'area Profilo, voce "Amici")
- In alto due azioni con lo stesso peso: "Cerca per username" e "Il mio codice".
- Sezione "Richieste" con contatore neutro (mai rosso): richieste ricevute (Accetta /
  Rifiuta, stesso peso visivo) e, sotto, richieste inviate (Annulla).
- Sezione "Amici": riga con avatar, nome visualizzato e @username, menu "⋯" con "Rimuovi
  dall'elenco", "Blocca", "Segnala".
- Stati: caricamento (scheletri), vuoto ("Non hai ancora amici su Noxa. Cercali per username
  o mostra il tuo codice a chi è con te."), errore con "Riprova", offline (striscia e azioni
  spente con spiegazione).
- Conferma di "Rimuovi": foglio dal basso, "Non vedrà più le tue serate e non saprà di essere
  stata rimossa o rimosso."

### 2. Cerca per username
- Campo con prefisso @, risultati sotto mentre si scrive (dopo 3 caratteri), ogni riga con
  "Aggiungi" → diventa "Richiesta inviata" (con "Annulla").
- Testo d'aiuto fisso, piccolo: "Trovi solo persone della tua fascia d'età. Per aggiungere
  qualcun altro usate il codice, di persona."
- Stati: meno di 3 caratteri ("Scrivi almeno 3 lettere"), nessun risultato ("Nessuno con
  questo username nella tua fascia" + pulsante "Il mio codice"), limite raggiunto ("Hai
  inviato molte richieste oggi: riprova domani", R-14: 20 al giorno, 50 in attesa),
  errore, offline.

### 3. Il mio codice
- QR grande al centro su fondo chiaro anche nel tema scuro (per la lettura), sotto il codice
  in monospaziato a gruppi (es. `K7Q4-M2XP-9H`), tempo rimasto scritto in piccolo ("Valido
  ancora 14 min", senza conti alla rovescia vistosi), pulsanti "Condividi link" e "Nuovo
  codice".
- Testo: "Mostralo a chi è con te. Vale 15 minuti e funziona una volta sola."
- Pulsante secondario "Scansiona un codice".
- Stati: codice scaduto ("Questo codice è scaduto" + "Nuovo codice"), già usato, limite
  (10 codici al giorno), errore, offline.

### 4. Scansiona un codice
- Inquadratura della fotocamera con riquadro, testo "Inquadra il QR di chi è con te", in
  basso "Scrivi il codice" (campo in monospaziato).
- Stato senza permesso della fotocamera: spiegazione e "Scrivi il codice", mai insistenze.

### 5. Anteprima del codice (dopo la scansione o il link)
- Avatar, nome e @username della persona, pulsante "Invia richiesta" e "Annulla".
- **Variante per chi ha 14–17 anni quando la persona è maggiorenne**: riquadro di avviso
  (tipo avviso, icona e titolo, non solo colore) con il testo di R-12, pulsanti "Ho capito,
  invia" e "Annulla" con lo stesso peso.
- Stati: codice scaduto, già usato, non valido, siete già amici, la persona non è
  disponibile (blocco: stesso messaggio di "non valido", senza dire perché).

### 6. Richiesta ricevuta
- Dettaglio di una richiesta: avatar, nome, @username, "Accetta" e "Rifiuta".
- **Variante per chi ha 14–17 anni con richiesta da una persona maggiorenne** (nata da un
  codice): stesso avviso di R-12 prima dei pulsanti.

### 7. Profilo di un'altra persona
- Avatar grande, nome, @username; azioni in base al rapporto: amici ("Amici" con menu
  Rimuovi), richiesta in attesa ("Richiesta inviata", "Annulla"), richiesta ricevuta
  ("Accetta" / "Rifiuta").
- Menu "⋯" in alto: "Segnala" e "Blocca". Nessun numero di amici, nessuna data, nessuna
  età o fascia.
- Stato "Profilo non disponibile" (account sospeso, bloccato o non visibile): stesso
  messaggio per tutti i casi, senza dire perché.

### 8. Il mio profilo (area Profilo)
- In cima: avatar, nome, @username, "Modifica" (nome visualizzato e username, con le regole
  del passo 3 della registrazione).
- Sotto: voci "Amici", "Persone bloccate", "Aspetto" (tema, già fatto), "Esci dall'account".

### 9. Segnala (F-12)
Foglio dal basso, **due tocchi**: (1) "Segnala" dal menu, (2) scelta del motivo → invio.
- Motivi: "Contenuto inappropriato", "Molestie", "Mi sembra che metta a rischio una persona
  minorenne", "Spam o truffa", "Età falsa", "Altro".
- Campo facoltativo "Vuoi aggiungere qualcosa?" (massimo 1000 caratteri, contatore), non
  obbligatorio per inviare.
- Casella "Blocca anche questa persona" (non preselezionata).
- Conferma: "Grazie, ce ne occupiamo noi. Chi hai segnalato non lo saprà." Per il motivo
  di rischio per una persona minorenne: "Lo guardiamo entro 4 ore. Se c'è un pericolo
  immediato chiama il 112."
- Stati: invio in corso, errore con "Riprova", offline.

### 10. Blocca (F-12)
Foglio di conferma: "Bloccare @username? Non vedrà più il tuo profilo, le tue serate e i
tuoi check-in, e tu non vedrai i suoi. Non riceverà nessun avviso." Pulsanti "Blocca"
(pericolo) e "Annulla". Dopo: toast "Persona bloccata" con "Annulla" per pochi secondi.

### 11. Persone bloccate (F-42)
Elenco con avatar, nome e @username, pulsante "Sblocca" con conferma ("Potrà di nuovo
trovarti e mandarti richieste. Non tornerete amici da soli."). Stato vuoto: "Non hai
bloccato nessuno."

### 12. Le mie segnalazioni
Elenco semplice delle proprie segnalazioni con stato ("Inviata", "In lavorazione",
"Chiusa") e data; per quelle chiuse la decisione motivata (DSA art. 17) e "Non sono
d'accordo" per il reclamo. Stato vuoto.

## Testi e tono
"Tu", frasi brevi, mai paternalistico; nessuna pressione sociale ("i tuoi amici sono già
qui", "aggiungi altri amici"), nessun contatore che spinga ad aggiungere persone, nessun
riferimento all'alcol. Esempi realistici, mai dati di persone vere: `giulia.rota`,
`marco.brivio`, `sara.colombo`.

## Accessibilità
WCAG 2.2 AA in entrambi i temi; aree di tocco di almeno 44 px; ogni stato con icona e testo
(mai solo il colore); il QR ha un'alternativa testuale (il codice scritto); i menu "⋯" hanno
un nome ("Altre azioni per @username"); focus blu visibile; i fogli si chiudono con Esc.

## Cosa consegnare
Le tavole di tutte le schermate e di tutti gli stati, nei due temi, comprese le varianti per
chi ha 14–17 anni (anteprima del codice e richiesta da una persona maggiorenne). Se servono
componenti nuovi (riga persona con azioni, QR con codice, campo di ricerca con risultati,
menu "⋯", toast con "Annulla"), aggiungili anche alla tavola dei componenti del design
system. Esporta l'HTML come `amici.html` e le tavole in `immagini/`.
