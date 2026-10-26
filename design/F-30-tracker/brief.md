# Brief — F-30 Tracker personale delle serate (iterazione 8)

Schermate da preparare prima dell'iterazione 8 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-30;
regole R-40, R-43 di SAFETY_PRIVACY.md; DATA_MODEL.md (`serate_tracker`, `tracker_spese`,
`tracker_dj`, `tracker_amici`). Statistiche, badge e riepilogo annuale (F-31…F-33) sono della
Fase 2 e non vanno disegnati ora. Impostazioni di privacy, esportazione ed eliminazione
dell'account sono in `design/F-42-privacy/`. Il prompt da incollare in Claude Design è tutto
quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta il **diario delle serate**
dell'area **Ricorda**, usando solo i token, i componenti e il movimento già definiti:
- accento A arancio "lampione al sodio";
- Archivo e IBM Plex Mono;
- schede evento di "F-01 · Scopri", riga di una persona di "F-11 · Amici", selettori a
  pillole e fogli dal basso di "F-14 · Serata".

Formato **mobile 390 × 844**, con una verifica a **360 px** e una a **1280 px**: da desktop
la navigazione delle aree è una barra laterale (ADR-0022) e i contenuti stanno in una colonna
di 720 px. Tema **scuro e chiaro**. Mettile in una nuova riga del canvas intitolata
"F-30 · Ricorda".

## Contesto e regole che il design deve rendere evidenti
Il diario è il posto dove ognuno annota le proprie serate: dove è stato, con chi, quanto ha
speso, che musica c'era, com'è andata. È **solo tuo**: nessun altro lo vede, nemmeno gli amici
che indichi.
- **Sempre privato**: un'etichetta fissa e discreta lo ricorda ("Lo vedi solo tu"). Nessuna
  condivisione, nessun "mi piace", nessun confronto con gli altri.
- **Amici presenti** (F-30): si scelgono solo tra i propri **amici confermati**. Chi viene
  indicato **non riceve nessuna notifica** e non vede la voce. Il selettore lo dice.
- **Spese per categoria**: ingresso, prevendita, trasporto, cibo, bevande analcoliche,
  guardaroba, altro e, **solo per i maggiorenni**, alcolici (R-40). Per un minorenne la
  categoria alcolici **non esiste**: non compare spenta, semplicemente non c'è. Prepara le due
  varianti affiancate (16 e 20 anni).
- **Nessun incentivo** (R-43): niente totali di spesa in evidenza come obiettivo, niente
  serie, niente "hai speso meno del solito", niente conti alla rovescia. Il totale di una
  serata è un'informazione neutra, in piccolo.
- **Offline**: si può aggiungere o modificare una serata anche senza rete. La voce resta sul
  telefono con lo stato "Da sincronizzare" e parte appena torna la connessione.
- Niente alcol negli esempi, nelle icone e nelle illustrazioni (R-40), anche nella variante
  per maggiorenni: la categoria alcolici è solo una voce dell'elenco.

## Stile
Linguaggio di Scopri e Serata:
- titoli Archivo stretto ed etichette da pensilina in maiuscoletto;
- date, importi e voti in IBM Plex Mono ("SAB 08.11", "€ 18,50", "4/5");
- un solo accento per l'azione principale;
- il diario ricorda un quaderno di biglietti: righe ordinate per mese, senza decorazioni.

## Schermate e stati

### 1. Ricorda › Il mio diario
- Intestazione dell'area "Ricorda · Il tuo diario" con la campanella.
- Elenco delle serate per mese (intestazione del mese in maiuscoletto), dalla più recente.
  Ogni riga:
  - data in monospaziato;
  - evento o locale (o il nome libero del locale);
  - voto in piccolo, se c'è;
  - avatar sovrapposti degli amici presenti, se ci sono;
  - badge "Da sincronizzare" quando la voce aspetta la rete.
- Azione principale "Aggiungi una serata".
- Spazio riservato e vuoto, senza contenuti finti, dove nella Fase 2 arriveranno statistiche
  e badge: **non disegnarli**.
- Stati:
  - caricamento;
  - vuoto ("Il tuo diario è vuoto. Quando torni da una serata, annotala qui: la vedi solo
    tu"), con "Aggiungi una serata";
  - errore con Riprova;
  - offline (elenco salvato, aggiunta possibile).

### 2. Aggiungi o modifica una serata
Un solo modulo, a sezioni, in cui tutto tranne la data è facoltativo:
- **Dove**: cerca un evento passato o un locale del catalogo; se il locale non c'è, "Scrivi il
  nome del locale" (fino a 80 caratteri). Un evento scelto mostra la scheda compatta.
- **Quando**: data (precompilata da un evento; mai nel futuro).
- **Con chi**: selettore degli amici confermati con caselle e ricerca locale. Sotto: "Gli
  amici che indichi non ricevono niente e non vedono il tuo diario".
- **Spese**: righe categoria + importo in euro (fino a 1.000 € per riga), aggiungibili e
  rimovibili; totale della serata in piccolo. Variante 16 anni senza alcolici.
- **Musica**: DJ o artisti come etichette (fino a 80 caratteri ciascuno).
- **Com'è andata**: voto da 1 a 5 (cinque pulsanti, non stelle da trascinare) e note private
  (contatore 0/1000).
- Barra in fondo con "Salva" che resta **sopra la barra di navigazione** sul telefono.
- Conferma: "Serata salvata nel diario" oppure, offline, "Salvata sul telefono: la
  sincronizzo quando torna la rete".
- Errori: data mancante o futura, importo non valido, nome troppo lungo.
- Eliminazione dal menu ⋯ con un foglio di conferma ("Eliminare questa serata dal diario? Non
  si può annullare").

### 3. Dettaglio di una serata del diario
- Data, evento o locale (con link al dettaglio dell'evento se esiste ancora), voto, amici,
  spese per categoria con totale, DJ, note.
- Menu ⋯: Modifica, Elimina.
- Stati: caricamento, voce non trovata, offline, "Da sincronizzare" con il motivo.

### 4. "Ero a questo evento" (dal dettaglio di un evento passato)
- Nel dettaglio di un evento **passato** compare l'azione "Ero a questo evento": apre il
  modulo del §2 con evento, locale e data già compilati.
- Se la serata è già nel diario: "Nel tuo diario" con il link alla voce.

## Testi e tono
"Tu", frasi brevi, tono da amici. Il diario è uno spazio personale: niente giudizi sulle
spese o sul numero di serate. Nessun dato di persone vere negli esempi: "Giulia R."
`@giulia.r`, "Marco B." `@marcob`, "Sara C." `@sara.c`; locali di fantasia ("Binario 7",
"Sala Ventuno").

## Accessibilità
- WCAG 2.2 AA nei due temi; aree di tocco di almeno 44 px.
- Il voto è un gruppo di pulsanti con etichetta ("Voto 4 su 5").
- Importi con etichetta testuale della categoria; il totale annunciato quando cambia.
- Lo stato "Da sincronizzare" è scritto, non solo un'icona.
- Fogli chiudibili con Esc e con il gesto indietro; focus visibile; esiti in una regione
  live.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px e la variante 16/20 anni delle spese.

Aggiungi alla tavola dei componenti i componenti nuovi:
- riga della serata del diario con intestazione del mese;
- riga di spesa (categoria + importo) con aggiunta e rimozione;
- voto da 1 a 5;
- etichette dei DJ;
- badge "Da sincronizzare".

Esporta l'HTML come `tracker.html` e le tavole come immagini in questa cartella (con il
foglio CSS del layer, come per le altre aree).
