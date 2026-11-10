# Brief — F-32 Badge (iterazione 11)

Schermate da preparare prima dell'iterazione 11 (GUIDA_OPERATIVA.md §4). Requisiti: PRD F-32;
regole R-41, R-43, R-66 di SAFETY_PRIVACY.md; DATA_MODEL.md (`badge`, `badge_utente`,
`notifiche` di tipo `badge_ottenuto`, `private.assegna_badge()`). Il catalogo qui sotto è una
**proposta** da confermare nell'iterazione 11 con la `safety-review` (criterio della
roadmap): i nomi possono cambiare, i criteri devono restare conformi a R-41. Il prompt da
incollare in Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** progetta la **bacheca dei badge** dell'area
**Ricorda**, usando solo i token, i componenti e il movimento già definiti (accento A arancio,
Archivo e IBM Plex Mono, commutatore Diario/Statistiche/Badge di "F-31 · Statistiche",
elenco delle notifiche di "F-06 · Notifiche").

Formato **mobile 390 × 844**, con una verifica a **360 px** e una a **1280 px**. Tema
**scuro e chiaro**. Mettile in una nuova riga del canvas intitolata "F-32 · Badge".

## Contesto e regole che il design deve rendere evidenti
I badge sono piccoli ricordi di ciò che hai scoperto: locali nuovi, musica diversa, serate
annotate. Si assegnano una volta al giorno dal diario; li vedi **solo tu**.
- **Mai premiare il rischio** (R-41): nessun badge per la spesa, l'alcol, il numero di serate
  in pochi giorni, l'orario di rientro o il fare tardi. Nessuna icona di bicchieri, bottiglie,
  lune con orari, soldi.
- **Nessuna pressione** (R-43): niente barre "ti manca 1 serata!", niente serie, niente conti
  alla rovescia, niente classifiche con gli amici. I badge non ottenuti si vedono come sagome
  neutre con il criterio scritto, senza percentuale di avanzamento.
- **Privati**: la bacheca è nel tuo profilo e non compare nel profilo visto dagli amici.
  Nessun pulsante "condividi".

## Catalogo proposto (per le illustrazioni)
Icone a linea, un solo colore, nello stile della segnaletica di Noxa:
- **Prima pagina** — hai annotato la prima serata nel diario.
- **Esploratore** I, II, III — 5, 10, 25 locali diversi annotati.
- **Orecchio curioso** — 5 generi musicali diversi.
- **Cacciatore di DJ** — 10 DJ diversi annotati.
- **Cronista** — 10 serate con le note scritte.
- **Quattro stagioni** — almeno una serata in ognuna delle quattro stagioni dello stesso
  anno.
- **Di casa** — 5 serate nello stesso locale, in qualunque arco di tempo.
- **In compagnia** — 10 serate annotate con almeno un amico.

## Schermate e stati

### 1. Ricorda › Badge
- Griglia di badge (3 colonne su mobile): ottenuti in alto con la data in monospaziato
  ("12.10.2026"), da ottenere sotto come sagome con il criterio.
- Contatore neutro in piccolo ("6 di 12").
- Stati: caricamento, nessun badge ancora ("I badge arrivano dal tuo diario: annota le tue
  serate"), errore con Riprova, offline (ultimi dati salvati).

### 2. Dettaglio di un badge (foglio dal basso)
- Illustrazione grande, nome, descrizione, data in cui l'hai ottenuto oppure "Come si
  ottiene".
- Nessun pulsante per condividere.

### 3. Notifica "Hai un nuovo badge"
- Riga nell'elenco delle notifiche (F-06) e testo push sulla schermata di blocco: "Noxa · Hai
  un nuovo badge in Ricorda", senza nome del badge (stile dei testi di sistema di F-22).
- Tocco → dettaglio del badge.

### 4. Nel profilo personale
- Una riga "I tuoi badge · 6" nel proprio profilo, con "Lo vedi solo tu", che apre la
  bacheca. Mostra anche il profilo come lo vede un amico: la riga non c'è.

## Testi e tono
"Tu", leggero, mai competitivo ("Hai scoperto 10 locali", non "Sei tra i migliori").

## Accessibilità
- WCAG 2.2 AA nei due temi; aree di tocco di almeno 44 px.
- Ogni badge ha un nome accessibile con lo stato ("Esploratore II, ottenuto il 12 ottobre
  2026" / "Cronista, da ottenere").
- Ottenuto e da ottenere si distinguono anche senza colore (sagoma tratteggiata ed
  etichetta).
- Nessuna animazione di festa con `prefers-reduced-motion`; altrimenti al massimo un breve
  ingresso del badge.

## Cosa consegnare
Le tavole di tutte le schermate e degli stati elencati, nei due temi, più le verifiche a 360
e 1280 px. Aggiungi alla tavola dei componenti: tessera del badge (ottenuto, da ottenere),
foglio di dettaglio, illustrazioni del catalogo.

Esporta l'HTML come `badge.html` e le tavole come immagini in questa cartella (con il foglio
CSS del layer).
