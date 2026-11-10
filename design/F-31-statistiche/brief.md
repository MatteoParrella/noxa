# Brief — F-31 Statistiche personali (iterazione 11)

Schermate da preparare prima dell'iterazione 11 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-31;
regole R-40, R-43, R-69 di SAFETY_PRIVACY.md; DATA_MODEL.md (vista `statistiche_personali`,
`serate_tracker`, `tracker_spese`, `tracker_dj`, `eventi_generi`). Le statistiche nascono dal
diario dell'iterazione 8 (`design/F-30-tracker/`) e occupano lo spazio che il diario aveva
lasciato vuoto. La bacheca dei badge è in `design/F-32-badge/`, il riepilogo annuale in
`design/F-33-wrapped/`. Il prompt da incollare in Claude Design è tutto quello che segue la
riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta le **statistiche personali**
dell'area **Ricorda**, usando solo i token, i componenti e il movimento già definiti:
- accento A arancio "lampione al sodio";
- Archivo e IBM Plex Mono;
- righe e intestazioni del mese di "F-30 · Ricorda", selettori a pillole di "F-14 · Serata".

Formato **mobile 390 × 844**, con una verifica a **360 px** e una a **1280 px** (barra
laterale e colonna di 720 px, ADR-0022). Tema **scuro e chiaro**. Mettile in una nuova riga
del canvas intitolata "F-31 · Statistiche".

## Contesto e regole che il design deve rendere evidenti
Le statistiche riassumono il **tuo** diario: le vedi solo tu, nessuno le confronta con gli
altri. Si calcolano solo dalle serate che hai annotato.
- **Sempre privato**: la stessa etichetta del diario ("Lo vedi solo tu").
- **Nessun incentivo** (R-43): niente obiettivi, serie, record da battere, "questo mese hai
  speso di più/meno", frecce verdi o rosse, confronti con gli amici o con la media. Sono
  numeri neutri, in ordine di data o di frequenza.
- **La spesa non è un traguardo**: totale e categorie stanno in una sezione chiusa di
  default ("Spese — mostra"), in testo normale, senza grafico a torta colorato che la metta
  in risalto.
- **Minorenni** (R-40): la categoria alcolici non esiste. Prepara la sezione spese nelle due
  varianti affiancate (16 e 20 anni).
- Nessun dato degli amici: le statistiche non dicono "con chi esci di più".

## Stile
- Numeri grandi in IBM Plex Mono, etichette in maiuscoletto da pensilina.
- Grafici essenziali: barre verticali sottili per le serate per mese, elenchi numerati per
  le classifiche. Un solo colore (accento A) per i dati, testo sempre leggibile senza colore.
- Ogni grafico ha accanto la sua versione testuale (tabella o elenco).

## Schermate e stati

### 1. Ricorda › Statistiche (scheda accanto a "Diario")
- Commutatore in alto: **Diario · Statistiche · Badge** (i badge sono in F-32).
- Selettore del periodo a pillole: "Quest'anno", "Anno scorso", "Sempre".
- Sezioni, ognuna con titolo in maiuscoletto:
  - **Serate per mese**: barre dei 12 mesi, con il numero sopra ogni barra; mesi a zero
    visibili e neutri.
  - **Locali più frequenti**: i primi 5 con il numero di serate ("Binario 7 · 6").
  - **Generi più ascoltati**: i primi 5, dai generi degli eventi annotati.
  - **DJ più visti**: i primi 5.
  - **Spese** (chiusa di default): totale del periodo e per categoria, in elenco.
- Stati:
  - caricamento (scheletri delle sezioni);
  - vuoto ("Le statistiche nascono dal tuo diario. Annota qualche serata e le trovi qui"),
    con "Aggiungi una serata";
  - pochi dati (una sola serata: le sezioni vuote mostrano "Ancora niente qui", senza
    nasconderle);
  - errore con Riprova;
  - offline (ultimi dati salvati, con "Aggiornate al …").

## Testi e tono
"Tu", frasi brevi, nessun giudizio. Locali di fantasia ("Binario 7", "Sala Ventuno",
"Ex Cartiera"), DJ di fantasia ("DJ Lumen", "Nera Vox"), generi reali (techno, house,
hip hop, indie).

## Accessibilità
- WCAG 2.2 AA nei due temi; aree di tocco di almeno 44 px.
- Il grafico per mese ha un'alternativa testuale ("Gennaio: 2 serate…") e non usa il solo
  colore.
- Il commutatore è un gruppo di schede accessibile; la sezione Spese è un pulsante con
  `aria-expanded`.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px e la variante 16/20 anni delle spese. Aggiungi alla tavola dei componenti:
commutatore Diario/Statistiche/Badge, grafico a barre per mese con alternativa testuale,
riga di classifica, sezione richiudibile.

Esporta l'HTML come `statistiche.html` e le tavole come immagini in questa cartella (con il
foglio CSS del layer, come per le altre aree).
