# Brief — Design system Noxa

Prompt da incollare in Claude Design per il primo progetto (design system), da preparare
prima dell'iterazione 1 (GUIDA_OPERATIVA.md §4). Regole di riferimento: DESIGN.md.

---

Progetta il design system di **Noxa**, un'app mobile (PWA + iOS + Android) per ragazzi dai 14
ai 25 anni che escono la sera a Milano e in Brianza. L'app copre quattro momenti della
serata: **Scopri** (eventi su elenco e mappa), **Organizza** (amici, gruppi, serate di
gruppo), **Vivi** (check-in e ritorno sicuro a casa), **Ricorda** (diario delle serate,
statistiche, badge, riepilogo annuale). La quinta area è il **Profilo**. Prodotto destinato
al lancio pubblico: deve sembrare maturo e affidabile, anche agli occhi di un genitore.

## Direzione visiva: "Milano alle due di notte"

Voglio un design **minimale, editoriale e diverso dalle solite app della notte**. Niente
neon, niente gradienti viola-rosa, niente glassmorphism, niente glow, niente estetica da
locale o da festival. L'ispirazione è la città di notte vista con calma: asfalto bagnato, la
luce arancione dei lampioni al sodio, le insegne del tram, la carta di un biglietto, gli
orari stampati di una pensilina.

Principi:
1. **Inchiostro, non nero.** Superfici scure con una punta di blu-grafite, mai #000 puro.
   Profondità data da 3-4 livelli di superficie e da linee sottili (hairline da 1 px), non
   da ombre. Ombre quasi assenti nel tema scuro.
2. **Un solo accento.** Un arancio "lampione al sodio" caldo, usato con parsimonia: azione
   principale, stato attivo, elemento selezionato sulla mappa. Tutto il resto è scala di
   grigi caldi. Proponimi anche una seconda esplorazione con un accento alternativo (per
   esempio un giallo-tram o un verde-semaforo desaturato) da confrontare.
3. **La tipografia fa il lavoro.** Un grotesk sobrio e molto leggibile per l'interfaccia, con
   titoli grandi e stretti in stile editoriale (gerarchia forte, pochi pesi). Un
   **monospaziato con cifre tabellari** per orari, date, distanze, prezzi e numeri delle
   statistiche, come un tabellone degli orari. Solo font open source (Google Fonts o
   simili), massimo due famiglie.
4. **Griglia e ritmo.** Spaziature su scala di 4 px, molto respiro, allineamenti rigorosi,
   elenchi densi ma ordinati. Gli eventi si leggono come righe di un palinsesto più che
   come card colorate piene di immagini.
5. **Movimento discreto.** Transizioni brevi e funzionali (150-250 ms), nessuna animazione
   decorativa in loop; versione ridotta per `prefers-reduced-motion`.
6. **Dettagli che danno carattere** senza rompere la sobrietà: per esempio un'etichetta in
   maiuscoletto spaziato, un bordo tratteggiato da "biglietto strappato" per gli elementi
   legati ai biglietti, numeri grandi in monospaziato nelle statistiche. Proponi tu 2-3
   dettagli di questo tipo, coerenti tra loro.

## Vincoli non negoziabili

- **Tema scuro predefinito** (uso notturno) e **tema chiaro completo**, entrambi progettati,
  non uno derivato automaticamente dall'altro.
- **WCAG 2.2 AA** in entrambi i temi: testo normale ≥ 4,5:1, testo grande e componenti
  ≥ 3:1; indica il rapporto di contrasto di ogni coppia testo/sfondo nei token. Aree di
  tocco di almeno 44 × 44 px. Focus visibile e ben distinto dall'accento. Il colore non è
  mai l'unico modo per comunicare uno stato (sempre anche icona o testo).
- Testo ridimensionabile al 200% senza perdita di contenuto: i componenti devono reggere
  etichette lunghe in italiano.
- **Utenti anche minorenni**: nessun riferimento visivo o iconografico all'alcol (bicchieri,
  bottiglie, cocktail) in nessun componente, icona o illustrazione di esempio.
- **Nessun dark pattern**: le opzioni di privacy e i rifiuti hanno lo stesso peso visivo
  delle altre scelte; nessuna urgenza artificiale (contatori, badge rossi aggressivi).
- Niente pubblicità, niente spazi per banner.
- Tono dei testi di esempio: "tu", frasi brevi, diretto e amichevole, mai paternalistico.
  Tutti i testi in italiano.

## Cosa consegnare

### 1. Token (tema scuro e chiaro)
Organizzati in queste categorie, con nomi in italiano e valori esportabili come variabili
CSS:
- `colore`: superfici (sfondo, superficie 1-3, superficie elevata), linee/bordi, testo
  (primario, secondario, terziario, su accento), accento (normale, premuto, tenue), focus,
  stati (successo, avviso, errore, info) con versione tenue per gli sfondi;
- `spazio`: scala di 4 px;
- `raggio`: pochi valori (consiglio raggi piccoli e netti, non bolle);
- `ombra`: minime, soprattutto per il tema chiaro e per i fogli;
- `tipografia`: famiglie, scala (da didascalia a titolo display), pesi, interlinea,
  spaziatura delle lettere, uso delle cifre tabellari;
- `movimento`: durate, curve, versione ridotta.

### 2. Componenti di base
Per ognuno: anatomia, varianti, dimensioni e stati (normale, hover, premuto, focus,
disabilitato, caricamento, errore dove applicabile), in tema scuro e chiaro.
- **Pulsante** (principale, secondario, testo, pericolo; con icona; a larghezza piena)
- **Campo** di testo (con etichetta, aiuto, errore associato al campo con suggerimento di
  correzione), campo data, ricerca
- **Scheda** (in particolare la riga/scheda evento: titolo, locale, orario, distanza, età
  minima, amici che partecipano)
- **Avviso** (info, successo, avviso, errore) in linea e a comparsa
- **Foglio** dal basso (bottom sheet) e finestra modale
- **Badge** / etichetta (per esempio "14+", "18+", "Gratis", "Flyer in revisione")
- **Avatar** (con iniziali, gruppo di avatar sovrapposti con "+3")
- **Interruttore**, casella di selezione, pulsanti di opzione, segmenti
- **Schede** (tab) orizzontali
- **Stati**: elenco vuoto (con azione), caricamento (skeleton sobri, niente spinner
  ovunque), errore con azione "Riprova", offline
- **Pulsante "Segnala"** discreto ma sempre raggiungibile
- Set di **icone** lineari coerente (indica una libreria open source, per esempio Lucide o
  Phosphor)

### 3. Navigazione
Barra di navigazione inferiore con le 5 aree: **Scopri, Organizza, Vivi, Ricorda,
Profilo**, con stato attivo, badge di notifica non aggressivo e intestazione di schermata
(titolo grande che si riduce allo scorrimento). Mostrala su una schermata di esempio.

### 4. Stile della mappa
La mappa usa una basemap **vettoriale OpenStreetMap (Protomaps)** di cui posso
sovrascrivere i colori: definisci la palette per tema scuro e chiaro (acqua, parchi, strade
principali e secondarie, edifici, etichette) in modo che sia quasi monocromatica e lasci
risaltare solo i segnaposto. Progetta il **segnaposto evento** (normale, selezionato,
gruppo di eventi con numero), la posizione di un amico durante il ritorno sicuro e
l'attribuzione "© OpenStreetMap contributors · Protomaps" sempre visibile.

### 5. Schermata di prova
Una schermata "Scopri" (elenco eventi di stasera, con filtri a segmenti e passaggio alla
mappa) in entrambi i temi, per vedere il sistema all'opera. Usa eventi di esempio
realistici a Milano e in Brianza, senza alcol e senza nomi di locali reali.

Formato: mobile 390 × 844 come riferimento, con una verifica a 360 px di larghezza.
