# Brief — F-01 Copertine generate degli eventi

Componente da preparare per Scopri, mappa e dettaglio evento (PRD F-01…F-03). Requisiti:
foto dei locali e ordine delle immagini ADR-0018; illustrazione sostitutiva ADR-0023;
regole R-43, R-44, R-56 di SAFETY_PRIVACY.md; movimento ADR-0019; accessibilità DESIGN.md §4.
Le tavole e l'esportazione vanno in questa cartella (vedi "Cosa esportare"). Il prompt da
incollare in Claude Design è tutto quello che segue la riga `---`.

## Perché
Con le prime fonti reali (The Club, 127 eventi in staging) quasi nessun evento ha la foto del
locale o un flyer approvato: le immagini dei siti e di Instagram non si possono usare
(ADR-0008, ADR-0018) e le foto autorizzate arrivano piano. Oggi tutti questi eventi hanno lo
**stesso fondo tipografico**, quindi l'elenco sembra una fila di schede uguali. La copertina
generata dà a ogni serata un'immagine propria, originale, senza diritti di terzi, senza
persone e senza richieste a server esterni.

## Cosa cambia e cosa no
- L'ordine dell'ADR-0018 resta: **foto del locale → flyer approvato → copertina generata**.
  La copertina generata prende il posto del fondo tipografico (tipo `tipografica` di
  `Copertina.tsx`); la copertina `sostitutiva` dell'ADR-0023 resta com'è e ha la precedenza.
- Nessun dato nuovo: la copertina si calcola nel telefono da campi che l'app ha già
  (titolo, locale, generi, orario).

---

Nello **stesso progetto "Noxa — Design system"**, nella riga "F-01 · Scopri", aggiungi il
componente **Copertina generata**: l'immagine di un evento quando non ci sono né la foto del
locale né un flyer approvato. Usa solo i token, i font e il movimento già definiti (accento
arancio "lampione al sodio", Archivo + IBM Plex Mono, tema scuro predefinito). Ogni tavola in
**tema scuro e chiaro**, mobile 390 × 844, con una verifica a 360 px.

## Idea
Ogni **serata** ha una copertina riconoscibile, come una locandina astratta fatta da Noxa:
- **Deterministica**: la stessa serata dello stesso locale ha sempre la stessa copertina.
  Il "seme" è il titolo normalizzato (minuscole, senza accenti né date) più il locale: "ONE
  TWO" di The Club è identica ogni mercoledì; "ATLANTA" del giovedì è diversa da "ONE TWO".
  Due serate diverse nello stesso locale si distinguono a colpo d'occhio.
- **Colore dal genere musicale principale** (il primo dei generi dell'evento). Proponi una
  famiglia di colori per ognuno, costruita dai token esistenti o da nuovi token
  `--copertina-<genere>-*` da aggiungere al design system, con la variante per il tema
  chiaro: techno, house, hip hop, reggaeton, commerciale, latino, drum and bass, elettronica,
  indie, live, altro. **Senza genere**: la famiglia dell'accento (arancio sodio su notte).
- **Motivo grafico dal seme**: scegli un piccolo alfabeto di 6–8 motivi astratti che
  ricordano la notte in città senza raffigurare persone (per esempio: bande di luce dei
  lampioni, griglia di finestre illuminate, onde sonore, cerchi concentrici di un
  altoparlante, linee del tram, scia di luci, costellazione, insegne al neon astratte). Il
  seme sceglie motivo, angolo, densità e posizione del bagliore entro limiti che restano
  belli. Niente forme casuali "rumorose": deve sembrare disegnato.
- **Testo**: nella forma in evidenza e nel dettaglio il **nome della serata** in grande,
  Archivo stretto, come su un manifesto, più l'orario in IBM Plex Mono (come il fondo
  tipografico attuale: "23:30"). Nella miniatura solo orario e titolo corto.

## Vincoli
- **Contenuto** (R-43, R-44, R-56): nessuna persona o silhouette, nessuna bottiglia, bicchiere
  o riferimento all'alcol, nessun riferimento sessuale, nessun conto alla rovescia o
  scritta d'urgenza ("ultimi posti", "sold out"). Le copertine le vedono anche i
  quattordicenni.
- **Solo token**: colori, raggi, tipografia e movimento dal design system; i nuovi token
  delle famiglie di colore si dichiarano nel layer esportato, con valori per scuro e chiaro.
- **Contrasto WCAG 2.2 AA** del testo sopra la copertina in entrambi i temi: ≥ 4,5:1 per
  l'orario, ≥ 3:1 per il titolo grande. Se serve, una velatura o una banda dietro il testo,
  come per le foto dei locali. Il colore non comunica informazioni da solo (il genere è
  scritto nella scheda).
- **Resa nel telefono**: SVG in linea o CSS (gradienti, `mask`, `clip-path`), nessuna
  immagine raster scaricata, nessun font o risorsa esterna, nessun canvas. Deve restare
  leggera: l'elenco ne mostra decine e la mappa le usa nell'anteprima. Indica quanti nodi SVG
  usa al massimo un motivo (obiettivo: ≤ 40).
- **Movimento**: nessuna animazione infinita; al massimo l'ingresso già previsto per le
  schede (dal sfocato al nitido) e, con `prefers-reduced-motion`, nessun movimento.
- La copertina è **decorativa** (`aria-hidden`): le informazioni stanno nel testo della
  scheda. Il titolo dentro la copertina non sostituisce quello della scheda.

## Forme da disegnare
Le tre forme di `Copertina` già esistenti, con le stesse proporzioni:
1. **Evidenza**: la scheda grande in cima all'elenco di Scopri.
2. **Miniatura**: la riga compatta dell'elenco e l'anteprima della mappa.
3. **Dettaglio**: la testata del dettaglio evento, con sopra l'etichetta (giorno e comune) e
   l'orario.

## Esempi da usare
Serate reali di **The Club, Milano** (dati pubblici, nessuna immagine del locale):
| Serata | Giorno | Orario | Genere da ipotizzare |
|---|---|---|---|
| ONE TWO | mercoledì | 23:30 → 05:30 | hip hop |
| ATLANTA | giovedì | 23:30 → 05:30 | hip hop |
| FIRST CLASS | venerdì | 23:30 → 05:30 | commerciale |
| GIRLS REPUBLIC | sabato | 23:30 → 05:30 | commerciale |
| SUPERBE | domenica | 23:30 → 05:30 | senza genere |

E due eventi di fantasia: **"Bassi Lunghi"** a Officina Lambro (techno, 23:00) e **"Perreo
Night"** a Club Binario 7 (reggaeton, 22:30).

## Tavole e stati
1. **Le sette copertine** nelle tre forme, scuro e chiaro, una accanto all'altra: deve
   vedersi che sono tutte diverse e tutte "di Noxa".
2. **Stessa serata, settimane diverse**: ONE TWO di tre mercoledì consecutivi, identiche.
3. **Elenco Scopri** reale con la scheda in evidenza e 6 righe, mescolando copertine
   generate, una foto del locale (con velatura) e un flyer approvato: le tre devono convivere
   senza che le generate sembrino "di serie B".
4. **Titoli difficili**: titolo lunghissimo ("THE ULTIMATE AFTERHOUR EXPERIENCE VOL. 12"),
   titolo di una parola ("SUPERBE"), titolo con caratteri accentati o simboli ("Città —
   Notte #3"): a capo, troncamento con "…", nessun testo fuori dalla copertina.
5. **Stati**: caricamento (scheletro della scheda, come oggi); foto del locale che non si
   carica → si vede la copertina generata (non un vuoto); copertina `sostitutiva` dell'ADR-0023
   accanto alla generata per mostrare che restano distinguibili.
6. **Verifica a 360 px** dell'elenco e del dettaglio.

## Cosa esportare
In `design/F-01-copertine-generate/`:
- link al progetto Claude Design;
- le tavole in PNG, una per punto sopra, in tema scuro e chiaro;
- l'esportazione HTML/CSS del layer (`copertine.html` e `noxa-copertine.css`) con i nuovi
  token delle famiglie di colore e gli SVG dei motivi;
- una breve **specifica dell'algoritmo**: come dal seme si scelgono motivo, angolo, densità e
  bagliore (con i limiti), e la tabella genere → famiglia di colore. Sarà riscritta in
  TypeScript nel componente `Copertina`; il codice esportato è solo un riferimento
  (DESIGN.md §1).

## Testi e tono
Nessun testo nuovo oltre al titolo e all'orario dell'evento. Nessuna parola d'urgenza,
nessun riferimento all'alcol.

## Accessibilità
WCAG 2.2 AA in entrambi i temi anche sopra la copertina; la copertina è decorativa e non
porta informazioni che non siano già scritte nella scheda; nessun movimento infinito,
`prefers-reduced-motion` rispettato.
