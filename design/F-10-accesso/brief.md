# Brief — F-10 Accesso, registrazione e onboarding di sicurezza

Schermate da preparare prima dell'iterazione 2 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-10,
F-41 (consensi); regole R-01, R-02, R-05, R-07, R-60, R-63 di SAFETY_PRIVACY.md; movimento
ADR-0019. Il prompt da incollare in Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** aggiungi le schermate di accesso di Noxa,
usando solo i token, i componenti e il movimento già definiti (accento A arancio
"lampione al sodio", Archivo + IBM Plex Mono, tema scuro predefinito). Ogni schermata in
**tema scuro e chiaro**, mobile 390 × 844, con una verifica a 360 px. Mettile in una nuova
riga del canvas intitolata "F-10 · Accesso".

## Contesto
Noxa è per ragazzi dai 14 ai 25 anni a Milano e in Brianza. Senza account non si vede nulla
(niente eventi, mappe o profili). Alla registrazione chiediamo solo: email, password,
username, nome visualizzato e data di nascita. Mai telefono, nome reale, genere, indirizzo o
rubrica. La data di nascita non si potrà più cambiare e nessun altro la vedrà.

## Stile e movimento
- Stesso linguaggio della schermata Scopri: titoli grandi Archivo stretto, etichette da
  pensilina in maiuscoletto, molto respiro, un solo accento.
- Movimento (ADR-0019): il titolo di ogni schermata sale parola per parola, i blocchi entrano
  dal sfocato al nitido con uno sfasamento di 70 ms, curva `cubic-bezier(.2,.7,.2,1)`, il
  bagliore arancio si accende nell'intestazione del Benvenuto. Passaggio tra i passi della
  registrazione con uno scorrimento orizzontale breve. Mostra in una tavola a parte i
  fotogrammi chiave (inizio, metà, fine) e la versione con movimento ridotto (solo
  dissolvenze).
- Nessun effetto che segue il mouse o il dito, nessuna animazione infinita.

## Schermate e stati

### 1. Benvenuto
- Marchio "noxa" grande, una frase: "Le tue serate a Milano e in Brianza, dall'idea al
  ritorno a casa."
- Pulsante principale "Crea un account", secondario "Ho già un account".
- In basso, piccolo: link a Termini e Informativa privacy.

### 2. Registrazione in 4 passi (indicatore "1 di 4" in monospaziato)
1. **Data di nascita** (per prima): campo data con il calendario in un foglio dal basso.
   Testo d'aiuto: "Ci serve per mostrarti solo eventi adatti alla tua età. Non potrai
   cambiarla e nessuno la vedrà."
2. **Email e password**: password con mostra/nascondi e requisiti scritti (almeno 10
   caratteri); errore "Questa password è comparsa in una violazione di dati: scegline
   un'altra".
3. **Username e nome**: username da 3 a 20 caratteri (lettere minuscole, numeri, punto,
   trattino basso) con verifica di disponibilità e stato "già in uso, prova
   giulia.rota2"; nome visualizzato fino a 40 caratteri.
4. **Consensi**: riassunto dell'informativa in una schermata, scritto per un quattordicenne
   (cosa raccogliamo, chi lo vede, quanto lo teniamo, come cancellare tutto), con il link al
   testo completo; due caselle separate e non preselezionate, "Accetto i Termini" e "Ho letto
   l'informativa privacy"; riquadro del CAPTCHA (Cloudflare Turnstile); pulsante "Crea
   l'account".

Stati da disegnare: campo con errore e suggerimento di correzione, invio in caricamento,
errore di rete con "Riprova", offline (striscia in alto, pulsante disabilitato con
spiegazione).

### 3. Età non sufficiente
Per chi ha meno di 14 anni. Tono gentile, senza colpe: "Noxa è per chi ha almeno 14 anni.
Ti aspettiamo quando li avrai compiuti." Un solo pulsante "Ho capito". **Nessun pulsante per
cambiare la data**, per non suggerire di mentire.

### 4. Verifica dell'email
"Controlla la posta: abbiamo mandato un link a g•••@gmail.com." Pulsante "Reinvia l'email",
disattivato per 60 secondi con il tempo scritto in monospaziato (nessuna urgenza o conto
alla rovescia vistoso), link "Ho sbagliato email". Stati: inviata, reinviata, errore di
invio, link scaduto.

### 5. Accesso
Email e password, "Password dimenticata?". Stati: errore generico "Email o password non
corretti" (mai dire quale dei due), email non ancora verificata (con "Reinvia il link"),
troppi tentativi ("Riprova tra qualche minuto"), caricamento.

### 6. Recupero della password
Due schermate: richiesta del link (stessa risposta che l'email esista o no: "Se c'è un
account con questa email, ti abbiamo mandato un link") e scelta della nuova password.

### 7. Onboarding di sicurezza (3 schermate, una sola volta dopo la prima verifica)
Indicatore a punti; pulsanti "Avanti" e, nell'ultima, "Ho capito, iniziamo". Niente "Salta".
Un'illustrazione astratta per schermata (forme, linee della città, nessuna persona e nessun
bicchiere).
1. **Chi può trovarti.** Versione per chi ha **14–17 anni**: "Ti trovano solo persone della
   tua età. Una persona maggiorenne può aggiungerti solo con il codice che le dai tu, di
   persona. Ogni amicizia la accetti tu." Versione per chi ha **18 anni o più**: "Trovi e
   ti trovano solo persone maggiorenni. Puoi aggiungere una persona più giovane solo se ti
   dà il suo codice di persona. Ogni amicizia va accettata."
2. **La tua posizione.** "Check-in e ritorno sicuro sono spenti finché non li accendi tu.
   Scegli tu quali amici possono vederti, e la posizione si cancella dopo 24 ore."
3. **Segnala e blocca.** "Ogni profilo, evento o flyer si segnala in due tocchi. Chi
   blocchi non vede più nulla di te, e non saprà di essere stato bloccato."

### 8. Nuova versione dei termini
Foglio dal basso che compare all'accesso quando cambiano termini o informativa: riassunto
delle novità, link al testo, caselle da accettare di nuovo. Le opzioni hanno lo stesso peso
visivo; si può anche uscire dall'account.

## Testi e tono
"Tu", frasi brevi, mai paternalistico; nessuna pressione ("non perderti…"), nessun dark
pattern, nessun riferimento all'alcol. Esempi realistici, mai dati di persone vere: email
`giulia.rota@example.com`, username `giulia.rota`.

## Accessibilità
WCAG 2.2 AA in entrambi i temi; aree di tocco di almeno 44 px; ogni errore vicino al campo,
con icona e testo (mai solo il colore); focus blu visibile; ordine di lettura logico; i
titoli animati restano testo leggibile.

## Cosa consegnare
Le tavole di tutte le schermate e di tutti gli stati, nei due temi, più la tavola del
movimento. Se servono componenti nuovi (indicatore dei passi, campo password, campo data,
casella con testo lungo), aggiungili anche alla tavola dei componenti del design system.

---

## Esito

- Progetto Claude Design: https://claude.ai/artifact/4MTnXgrpFWHsegaL47BcbT (stesso progetto
  del design system, riga "F-10 · Accesso").
- Esportazione: `accesso.html` (riferimento) e le tavole PNG in `immagini/`: benvenuto, età e
  nuovi termini; registrazione passi 1–3 e passo 4; verifica dell'email; accesso e recupero;
  onboarding di sicurezza; movimento (ADR-0019); verifica a 360 px.
