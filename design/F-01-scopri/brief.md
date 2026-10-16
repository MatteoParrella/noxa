# Brief — F-01 Scopri, F-02 Mappa, F-03 Dettaglio evento, F-04 Amici che partecipano, F-05 Mi interessa / Partecipo

Schermate da preparare prima dell'iterazione 4 (GUIDA_OPERATIVA.md §4), in un unico prompt
perché condividono la scheda evento e i filtri. Requisiti: PRD F-01…F-05; regole R-20…R-23,
R-33, R-43, R-50, R-56, R-67 di SAFETY_PRIVACY.md; foto dei locali ADR-0018; mappe ADR-0016;
movimento ADR-0019. Le tavole vanno in questa cartella (`immagini/` e l'esportazione
`scopri.html`); `design/F-03-dettaglio-evento/` rimanda qui. Il prompt da incollare in
Claude Design è tutto quello che segue la riga `---`.

---

Nello **stesso progetto "Noxa — Design system"** completa la schermata **Scopri** (ne esiste
già una prima versione nella riga "Mappa e schermata di prova") e aggiungi il **dettaglio
dell'evento**, usando solo i token, i componenti e il movimento già definiti (accento A
arancio "lampione al sodio", Archivo + IBM Plex Mono, tema scuro predefinito). Ogni schermata
in **tema scuro e chiaro**, mobile 390 × 844, con una verifica a 360 px. Mettile in una nuova
riga del canvas intitolata "F-01 · Scopri".

## Contesto e regole che il design deve rendere evidenti
Noxa mostra gli eventi della sera a Milano e in Brianza a ragazzi dai 14 ai 25 anni.
- Ognuno vede **solo gli eventi a cui può entrare**: chi ha 16 anni non vede i 18+, un
  ventenne non vede i 21+. Gli eventi con riferimenti all'alcol non compaiono a chi ha meno
  di 18 anni. Il filtro non è un'opzione dell'utente: semplicemente quegli eventi non ci sono.
- Ogni evento mostra la **fascia d'età** come badge (14+, 16+, 18+, 21+…). Se il locale non
  l'ha dichiarata: "18+ · non dichiarata", con una spiegazione nel dettaglio.
- L'immagine di un evento è la **foto del locale** (con la velatura dei token sopra, per
  leggere il testo); se manca, il flyer approvato; se manca anche quello, il **fondo
  tipografico** del design system. Nessuna foto con persone riconoscibili o bottiglie.
- La **distanza** usa la posizione del telefono solo se concessa, oppure un comune scelto a
  mano. La posizione non viene salvata: va detto con una riga piccola dove si sceglie.
- **Amici che partecipano**: solo amici confermati che hanno reso visibile la partecipazione.
  Avatar sovrapposti e numero ("Marco e altri 2"), mai nomi di sconosciuti, mai contatori di
  persone in generale ("120 persone ci vanno").
- **Mi interessa / Partecipo**: un tocco per impostarlo, un tocco per toglierlo; la
  visibilità agli amici si cambia per ogni evento ("Visibile ai tuoi amici" / "Solo per te").
- Nessun incentivo a uscire di più o a spendere, nessun conto alla rovescia ("ultimi
  biglietti!", "tra 2 ore"), nessun riferimento all'alcol, nessuna pubblicità.

## Stile e movimento
Stesso linguaggio della Scopri già disegnata e delle schermate di accesso e amici: titoli
Archivo stretto, etichette da pensilina in maiuscoletto, orari in IBM Plex Mono, un solo
accento. Movimento ADR-0019: titolo che sale, schede che entrano dal sfocato al nitido con
sfasamento di 70 ms mentre si scorre, passaggio elenco ↔ mappa con una dissolvenza breve.
Nessun effetto che segue il dito, nessuna animazione infinita (i marker non pulsano).

## Schermate e stati

### 1. Scopri · elenco
- Intestazione "Scopri" con la data ("gio 15.10"); segmenti **Stasera · Domani · Weekend**
  (e "Scegli data" con un calendario nel foglio); pulsante **Filtri** con il numero di filtri
  attivi; passaggio **Elenco / Mappa**.
- Una **scheda in evidenza** (la prima della serata) grande, poi righe più compatte: foto del
  locale, titolo, locale e comune, orario ("23:00 → 05:00"), badge d'età, generi (2 al
  massimo), distanza se nota, prezzo minimo se noto ("da 15 €"), amici che partecipano.
- Sezioni per serata quando l'intervallo è più lungo ("Venerdì 16.10", "Sabato 17.10").
- Stati: caricamento (scheletri delle schede), **nessun evento** con i filtri attuali (con
  "Togli i filtri"), errore con "Riprova", offline (eventi già visti con la striscia "Sei
  offline: vedi gli eventi salvati sul telefono", senza azioni che richiedono la rete).

### 2. Filtri (foglio dal basso)
- **Quando**: i segmenti e "Scegli data".
- **Dove**: "Usa la mia posizione" (con la riga "La posizione serve solo a calcolare le
  distanze e non viene salvata") oppure "Scegli un comune" (campo con suggerimenti: Milano,
  Monza, Lissone, Seregno, Desio…); **distanza** a scelta (5, 10, 25 km, "tutte").
- **Generi musicali**: scelte multiple a pillola (techno, house, hip hop, reggaeton,
  commerciale, indie, live…).
- **Età minima**: "Solo eventi fino a 16+ / 18+…" tra quelli che si possono già vedere
  (serve a chi esce con amici più piccoli), non un modo per sbloccarne altri.
- **Solo eventi con amici** (interruttore).
- In fondo: "Azzera" e "Mostra N eventi", stesso peso visivo dei due.
- Stato permesso di posizione negato: spiegazione e "Scegli un comune", senza insistere.

### 3. Scopri · mappa
- Mappa a tutto schermo sotto l'intestazione (stile Protomaps scuro e chiaro già definito),
  marker dei locali con il numero di eventi, **raggruppati** quando sono vicini (cerchio con
  il numero), marker selezionato in arancio.
- Al tocco su un marker: **anteprima in basso** (scheda compatta dell'evento, o elenco breve
  se il locale ha più eventi) con "Apri" che porta al dettaglio.
- "Mostra elenco" sempre raggiungibile: l'elenco è l'alternativa accessibile della mappa.
- Attribuzione "© OpenStreetMap" sempre visibile.
- Stati: mappa in caricamento, mappa non disponibile ("La mappa non si è caricata. Vedi gli
  eventi in elenco."), nessun evento nell'area visibile, offline.

### 4. Dettaglio evento
- Copertina con la foto del locale (velatura dei token), attribuzione della foto in piccolo
  se la licenza la chiede ("Foto: Nome Cognome, CC BY 4.0"); varianti con flyer e con fondo
  tipografico.
- Titolo, data e orari in monospaziato, locale con indirizzo e comune (link "Apri in Mappe"
  che passa all'app di mappe del telefono), badge d'età, generi, artisti, prezzo minimo.
- **Età non dichiarata**: riquadro informativo "Il locale non ha indicato un'età minima:
  la consideriamo 18+." (variante).
- **Amici che partecipano**: avatar e nomi solo degli amici ("Marco, Sara e altri 2 ci
  vanno"), tocco → elenco degli amici.
- Azioni: **Mi interessa** e **Partecipo** (segmenti: si sceglie uno dei due o nessuno),
  sotto la riga di visibilità "Visibile ai tuoi amici" con un interruttore o un link
  "Cambia".
- Link sempre presente **"Fonte: sito del locale"** (o "Instagram del locale") e, se c'è,
  **"Biglietti"** che apre il sito esterno (icona di link esterno, nessuna urgenza).
- Menu ⋯ in alto con **"Segnala"** (motivi: evento falso, dati sbagliati, contenuto
  inappropriato, riferimenti all'alcol non segnalati…) e "Condividi" (link all'evento).
- Stati: caricamento, evento non disponibile ("Questo evento non c'è più o non è adatto
  alla tua età" — stesso testo per tutti i casi), errore, offline (dettagli salvati, azioni
  spente con spiegazione), evento annullato (badge "Annullato" e niente azioni).

### 5. Partecipazione · stati e visibilità
- Mostra i tre stati (nessuno, Mi interessa, Partecipo) e il cambio di visibilità per
  l'evento ("Solo per te": gli amici non la vedono).
- Toast breve dopo il tocco ("Segnato: partecipi") con "Annulla".

## Testi e tono
"Tu", frasi brevi, nessuna pressione ("non perderti", "tutti ci vanno"), nessun riferimento
all'alcol, prezzi solo come informazione. Esempi realistici, mai dati di persone o locali
veri: locali come "Officina Lambro", "Cascina Torretta", "Club Binario 7"; artisti di
fantasia.

## Accessibilità
WCAG 2.2 AA in entrambi i temi, anche sopra le foto (velatura); aree di tocco di almeno
44 px; il badge d'età e lo stato di partecipazione sono scritti, non solo colorati; la mappa
ha l'elenco come alternativa e i marker hanno un nome ("Officina Lambro, 2 eventi"); focus
visibile; i fogli si chiudono con Esc.

## Cosa consegnare
Le tavole di tutte le schermate e di tutti gli stati, nei due temi, compresi foto, flyer e
fondo tipografico per la copertina, età dichiarata e non dichiarata, evento annullato. Se
servono componenti nuovi (scheda in evidenza, riga evento compatta, pillole dei generi,
marker raggruppato, anteprima sulla mappa, selettore Mi interessa / Partecipo, riga
"amici che partecipano"), aggiungili alla tavola dei componenti del design system. Esporta
l'HTML come `scopri.html` e le tavole in `immagini/`.

## Esito

- Progetto Claude Design: https://claude.ai/artifact/4MTnXgrpFWHsegaL47BcbT (riga "F-01 · Scopri").
- Esportazione in `esportazione/`: il prototipo `F01.dc.html` (tutte le schermate e gli
  stati, con i parametri `tema`, `schermata`, `stato`, `giorno`, `evento`, `copertina`,
  `partecipazione`, `visibilita`), le tavole `F01-01`…`F01-07` (elenco; filtri e scegli
  data; mappa; dettaglio con copertine, età non dichiarata, annullato, menu ⋯ e segnala;
  stati del dettaglio; partecipazione e visibilità; verifica a 360 px), i componenti nuovi
  (`Componenti-scopri.dc.html`: scheda in evidenza, riga compatta, badge d'età e generi,
  marker e gruppo, anteprima sulla mappa, selettore Mi interessa / Partecipo, visibilità,
  amici che partecipano, link esterno) e il foglio `noxa-scopri.css` (layer "scopri", solo
  token di noxa.css).
- Le tavole si vedono nel progetto Claude Design; le schermate di confronto si catturano
  durante l'iterazione 4 (skill `implement-design`).
