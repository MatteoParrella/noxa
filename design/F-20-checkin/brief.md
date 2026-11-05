# Brief — F-20 Check-in "sono qui" (iterazione 9)

Schermate da preparare prima dell'iterazione 9 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-20,
F-42; regole R-17, R-30, R-33, R-34, R-43 di SAFETY_PRIVACY.md; DATA_MODEL.md
(`checkin`, `checkin_destinatari`, `profili_privati.checkin_abilitato`, notifica
`checkin_amico`). Il ritorno sicuro (F-21) è dell'iterazione 10 e non va disegnato ora:
nell'area Vivi resta solo il suo spazio. Notifiche sul telefono, permessi e preferenze sono
in `design/F-22-notifiche/`. Il prompt da incollare in Claude Design è tutto quello che segue
la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta il **check-in "sono qui"**
dell'area **Vivi**, usando solo i token, i componenti e il movimento già definiti:
- accento A arancio "lampione al sodio";
- Archivo e IBM Plex Mono;
- schede evento di "F-01 · Scopri", riga di una persona di "F-11 · Amici", selettori e fogli
  dal basso di "F-14 · Serata", righe di impostazione con interruttore di "F-41 · Privacy e
  dati".

Formato **mobile 390 × 844**, con una verifica a **360 px** e una a **1280 px**: da desktop
la navigazione delle aree è una barra laterale (ADR-0022) e i contenuti stanno in una colonna
di 720 px. Tema **scuro e chiaro**. Mettile in una nuova riga del canvas intitolata
"F-20 · Vivi: check-in".

## Contesto e regole che il design deve rendere evidenti
Il check-in serve a dire **ad alcuni amici scelti** "sono qui" durante una serata, così ci si
ritrova senza scriversi. Non è una mappa e non segue nessuno.
- **Spento di default** (R-30): finché non lo attivi in Privacy e dati, nell'area Vivi c'è
  solo la spiegazione con "Attiva il check-in". L'attivazione è un interruttore con la
  spiegazione completa, mai un invito insistente.
- **Solo il locale** (R-30): si sceglie un locale del catalogo (o l'evento di stasera in quel
  locale). **Nessuna coordinata, nessuna mappa della propria posizione**, nessuna richiesta
  della posizione del telefono: il locale si cerca per nome o si prende dai suggerimenti.
- **Destinatari scelti** (R-30, F-20): solo **amici confermati**, scelti ogni volta. Proposti
  di default i membri della serata di gruppo di stasera che sono anche amici confermati; si
  possono togliere e aggiungerne altri. Nessun "tutti gli amici" preselezionato.
- **A scadenza** (R-30): il check-in dura **6 ore** e poi sparisce per tutti; si termina
  prima in **un tocco** ("Sono andato via"). L'orario di scadenza è sempre scritto.
- **Un check-in alla volta**: se ne hai già uno attivo la schermata mostra quello; per
  cambiare locale lo termini e ne fai uno nuovo (proposta del brief, da fissare in
  DATA_MODEL nell'iterazione 9).
- **Chi lo riceve** vede solo nome, avatar, locale e da quando, finché il check-in è attivo.
  Il blocco lo nasconde in entrambe le direzioni (R-17).
- **Nessuna pressione sociale** (R-43): niente "3 amici sono fuori, tu no?", niente conteggi
  di chi non ha fatto check-in, niente conti alla rovescia animati.

## Stile
Linguaggio di Scopri e Serata:
- titoli Archivo stretto ed etichette da pensilina in maiuscoletto;
- orari in IBM Plex Mono ("DALLE 23:10", "FINO ALLE 05:10");
- un solo accento per l'azione principale;
- il check-in attivo ricorda un timbro sul biglietto: una scheda compatta, non un banner che
  lampeggia.

## Schermate e stati

### 1. Vivi (area)
- Intestazione dell'area "Vivi · Durante la serata" con la campanella.
- **Check-in spento**: blocco con la spiegazione ("Dì ad alcuni amici in quale locale sei.
  Solo il locale, solo a chi scegli, per 6 ore") e "Attiva il check-in", che apre
  l'impostazione del §4.
- **Check-in acceso, nessun check-in attivo**: azione principale "Fai check-in".
- **Il tuo check-in attivo**: scheda con locale (ed evento, se c'è), "dalle 23:10 · fino alle
  05:10", avatar sovrapposti dei destinatari con "Lo vedono 3 amici", azioni "Sono andato
  via" (in un tocco, con l'esito annunciato) e "Chi lo vede" (apre l'elenco, da cui si
  possono togliere persone).
- **Amici in giro stasera**: elenco dei check-in attivi ricevuti, ognuno con avatar, nome,
  username, locale e "dalle 23:40"; toccando si apre il locale o l'evento. Vuoto: "Nessun
  amico ha condiviso dove si trova".
- Spazio del **ritorno sicuro** (iterazione 10): riga riservata e vuota, senza contenuti
  finti.
- Stati: caricamento, errore con Riprova, offline (il check-in non parte senza rete: azione
  spenta con il motivo).

### 2. Fai check-in (foglio dal basso o pagina)
Tre passi in un solo foglio:
- **Dove**: suggerimenti in cima (evento a cui partecipi stasera, locale della serata di
  gruppo di stasera), poi ricerca dei locali per nome. Un locale scelto mostra la scheda
  compatta; un evento scelto la scheda evento compatta. Nessun pulsante "usa la mia
  posizione".
- **Chi lo vede**: selettore degli amici confermati con caselle e ricerca locale; in cima,
  già spuntati, gli amici della serata di gruppo di stasera con l'etichetta "Dalla serata
  Sabato al Binario 7". Contatore "3 amici". Almeno un destinatario.
- **Riepilogo**: "Binario 7 · lo vedono Giulia R., Marco B. e Sara C. fino alle 05:10" e
  "Fai check-in".
- Esiti: "Check-in fatto: lo vedono 3 amici"; errore di rete; check-in disattivato nel
  frattempo; un amico non più amico tolto dall'elenco con l'avviso.

### 3. Chi vede il mio check-in
- Elenco dei destinatari con "Togli" per ciascuno (conferma leggera, senza foglio).
- Riga finale "Togliendo una persona, il check-in sparisce subito dal suo telefono".
- Togliere l'ultimo destinatario equivale a terminare il check-in: lo si dice prima.

### 4. Profilo › Privacy e dati › Check-in
Nuova riga nella sezione **Chi vede cosa** di "F-41 · Privacy e dati":
- interruttore "Check-in 'sono qui'" (predefinito spento) con la spiegazione: "Quando fai
  check-in, gli amici che scegli vedono in quale locale sei per 6 ore. Mai la tua posizione
  esatta. Dopo 24 ore dalla fine lo cancelliamo".
- Spegnerlo con un check-in attivo lo termina: lo dice un foglio di conferma ("Spegnere il
  check-in? Quello attivo al Binario 7 termina subito").
- Stati: salvataggio non riuscito (torna com'era, con un avviso), offline.

### 5. Notifica nell'app "check-in di un amico"
Nuovo tipo nell'elenco delle notifiche di "F-06 · Notifiche": avatar, nome, username,
"è al Binario 7" e "dalle 23:40"; azione "Vedi locale". Quando il check-in scade o termina,
la notifica resta ma diventa "Check-in terminato" senza il locale.

## Testi e tono
"Tu", frasi brevi, tono da amici. Niente parole che suggeriscono controllo ("traccia",
"segui", "posizione in tempo reale"). Nessun dato di persone vere negli esempi: "Giulia R."
`@giulia.r`, "Marco B." `@marcob`, "Sara C." `@sara.c`; locali di fantasia ("Binario 7",
"Sala Ventuno").

## Accessibilità
- WCAG 2.2 AA nei due temi; aree di tocco di almeno 44 px.
- L'orario di scadenza è testo, non solo una barra o un anello.
- I destinatari selezionati sono letti con il contatore ("3 amici selezionati").
- "Sono andato via" e gli esiti annunciati in una regione live.
- Fogli chiudibili con Esc e con il gesto indietro; focus visibile.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px.

Aggiungi alla tavola dei componenti i componenti nuovi:
- scheda del proprio check-in attivo;
- riga del check-in di un amico;
- suggerimento di locale (evento di stasera, serata di gruppo);
- selettore dei destinatari con gli amici proposti dalla serata.

Esporta l'HTML come `checkin.html` e le tavole come immagini in questa cartella (con il
foglio CSS del layer, come per le altre aree).
