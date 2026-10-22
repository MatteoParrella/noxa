# Brief — F-14 Serata di gruppo: chi c'è, biglietti e trasporto (iterazione 7)

Schermate da preparare prima dell'iterazione 7 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-14,
F-15, F-16; regole R-16, R-20, R-23, R-24, R-43, R-50 di SAFETY_PRIVACY.md; DATA_MODEL.md
(`serate_gruppo`, `partecipazioni_serata`). I gruppi e gli inviti sono in
`design/F-13-gruppi/`. Il ritorno sicuro con la posizione è un'altra funzionalità
(iterazione 10): qui c'è solo **come si torna**, senza posizione. Il prompt da incollare in
Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta la **serata di gruppo**, usando
solo i token, i componenti e il movimento già definiti:
- accento A arancio "lampione al sodio";
- Archivo e IBM Plex Mono;
- scheda evento, copertine e badge dell'età di "F-01 · Scopri" e del dettaglio evento;
- righe persona di "F-11 · Amici".

Formato **mobile 390 × 844**, con una verifica a **360 px** e una a **1280 px** (barra
laterale, ADR-0022). Tema **scuro e chiaro**. Mettile in una nuova riga del canvas intitolata
"F-14 · Serata di gruppo".

## Contesto e regole che il design deve rendere evidenti
In un gruppo qualcuno propone una serata, legata a un evento di Scopri oppure libera ("Pizza
e poi da Marco"). Ognuno risponde sì, forse o no; poi si organizzano biglietti e trasporto.
Tutto si aggiorna **in tempo reale** quando gli altri rispondono.
- **Evento adatto a tutti** (R-20, R-23, R-24): si può proporre solo un evento visibile a
  **tutti** i membri attivi del gruppo. Nel selettore dell'evento compaiono solo eventi
  adatti a tutti, senza spiegare l'età dei singoli; una riga dice "Mostriamo solo le
  serate adatte a tutto il gruppo".
  - Se entra un membro che non può vedere l'evento, per lui la serata non c'è.
  - Gli altri non vengono avvisati del perché.
- **Niente chat** (R-16): la coordinazione è fatta di campi strutturati (risposta,
  biglietto, mezzo per andare e tornare, posti in auto). C'è un solo testo libero, le
  **note** della serata, scritte da chi la propone: massimo 500 caratteri, visibili solo ai
  membri, **segnalabili** (R-50) come il titolo.
- **Biglietti** (F-15): link esterni alla prevendita e alla lista (si aprono fuori
  dall'app, con l'avviso "Stai lasciando Noxa"). Ognuno indica il proprio stato: nessuno,
  prevendita, in lista, alla cassa. **Nessun pagamento nell'app.**
- **Trasporto** (F-16):
  - ognuno indica il mezzo per l'**andata** e per il **ritorno**: guido, passaggio,
    mezzi pubblici, taxi/NCC, a piedi, altro;
  - **"Guido" solo per chi ha almeno 18 anni**: per i minorenni l'opzione non compare;
  - chi guida indica i **posti liberi** (0–8);
  - gli altri scelgono "Passaggio da …" tra chi guida, e i posti scendono;
  - un **avviso** compare se qualcuno che va non ha ancora un mezzo per il ritorno, con
    il numero e senza colpe ("2 persone non hanno ancora un mezzo per tornare").
- **Nessuna pressione** (R-43): niente "mancano solo 2 persone!", niente conti alla
  rovescia, niente classifiche di chi esce di più. Il riepilogo è informativo.
- Niente alcol nei testi di esempio, nelle note e nelle illustrazioni; nelle tavole con un
  gruppo di minorenni gli eventi sono senza riferimenti all'alcol (R-23, R-40).

## Stile
Come dettaglio evento e Scopri:
- la copertina dell'evento in cima, se legata a un evento;
- altrimenti un fondo tipografico con titolo e data;
- risposte e conteggi in IBM Plex Mono ("5 SÌ · 2 FORSE · 1 NO");
- segmenti per scegliere la risposta;
- un solo accento per l'azione principale;
- stati e avvisi scritti, mai solo colore.

## Schermate e stati

### 1. Proponi una serata
- Due strade:
  - **Da un evento**: elenco e ricerca degli eventi adatti al gruppo, con data, locale,
    badge dell'età;
  - **Serata libera**: titolo 1–80 caratteri.
- Campi:
  - data e ora del ritrovo, facoltativa;
  - luogo del ritrovo, facoltativo, al massimo 120 caratteri;
  - link a prevendita e lista, facoltativi, solo `https://`, già presi dall'evento se ci
    sono;
  - note, 0/500.
- Conferma: "Serata proposta · il gruppo riceve una notifica".
- Errori: campo mancante, link non valido, evento non più disponibile.
- Stato vuoto del selettore: "Nessun evento adatto a tutto il gruppo in questi giorni",
  con la proposta di una serata libera.

### 2. Dettaglio della serata
- Intestazione:
  - copertina o fondo tipografico;
  - titolo, data, ora e luogo del ritrovo;
  - nome del gruppo;
  - stato della serata (Proposta, Confermata, Annullata).
- **La mia risposta**: segmenti Sì / Forse / No, sempre in alto, con il cambio istantaneo e
  l'annuncio.
- **Chi c'è**:
  - tre gruppi (Sì, Forse, No, più "Non hanno risposto");
  - righe persona con l'icona del biglietto e del mezzo di ritorno;
  - aggiornamento dal vivo con un'animazione discreta quando qualcuno risponde.
- **Biglietti**:
  - link "Prevendita" e "Lista" (esterni);
  - il mio stato del biglietto (segmenti o selezione);
  - il riepilogo "3 in prevendita · 2 in lista · 1 alla cassa".
- **Trasporto**:
  - il mio mezzo per andata e ritorno;
  - se guido, i posti liberi;
  - se passaggio, "Passaggio da …" con i posti rimasti;
  - l'elenco delle auto del gruppo con conducente e passeggeri;
  - l'avviso per chi non ha un mezzo per il ritorno.
- **Note** della serata, con il menu ⋯ per segnalare titolo o note.
- Azioni di chi ha proposto o degli admin: modifica, conferma la serata, annulla (foglio con
  l'effetto: "Tutti ricevono una notifica").
- Stati:
  - caricamento;
  - errore con Riprova;
  - serata annullata, in sola lettura con il badge "Annullata";
  - evento annullato dal locale, con avviso e serata che resta per decidere cosa fare;
  - serata passata, in sola lettura;
  - serata non più disponibile ("Non fai più parte del gruppo" o evento non visibile, senza
    dire perché);
  - offline: la serata salvata resta leggibile, le risposte e i cambi sono spenti con il
    motivo scritto (la coda delle scritture offline arriva nell'iterazione 8).

### 3. Variante minorenne e variante maggiorenne
- Stessa serata vista da un sedicenne e da un ventenne:
  - per il sedicenne "Guido" non c'è tra i mezzi;
  - per il ventenne sì, con i posti liberi.
- Nessuna indicazione dell'età degli altri.

### 4. Serate nel gruppo e in Organizza
- Riga della serata nel dettaglio del gruppo e nell'area Organizza ("Le prossime serate dei
  tuoi gruppi"), con data in monospaziato, titolo, gruppo e la propria risposta come badge
  ("Sì", "Da rispondere").

## Testi e tono
"Tu", frasi brevi e pratiche ("Come torni?", "Chi guida?"). Nessuna pressione e nessun
giudizio su chi dice no. Nessun dato di persone vere o locali veri negli esempi:
- locali "Officina Lambro", "Cascina Torretta", "Club Binario 7";
- persone "Giulia R." `@giulia.r`, "Marco B." `@marcob`, "Sara C." `@sara.c`;
- gruppi "Calcetto del giovedì", "Quelli del sabato".

## Accessibilità
- WCAG 2.2 AA nei due temi; aree di tocco di almeno 44 px.
- Le risposte che arrivano dal vivo sono annunciate in modo discreto (regione live
  "polite", al massimo una frase per aggiornamento).
- I segmenti sono gruppi di radio veri.
- Link esterni con l'indicazione "si apre fuori da Noxa".
- Avvisi scritti; focus visibile; fogli chiudibili con Esc e con il gesto indietro.
- Nessuna animazione infinita; con `prefers-reduced-motion` solo dissolvenze.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px e le due varianti per età.

Aggiungi alla tavola dei componenti i componenti nuovi:
- segmenti della risposta;
- riepilogo "chi c'è" con i tre gruppi;
- riga persona con biglietto e mezzo;
- selettore del mezzo di trasporto;
- scheda dell'auto con posti;
- avviso del ritorno;
- riga della serata;
- selettore dell'evento adatto al gruppo.

Esporta l'HTML come `serata.html` e le tavole come immagini in questa cartella (o in
`esportazione/` con il foglio CSS del layer, come per Scopri).
