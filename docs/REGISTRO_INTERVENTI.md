# Registro degli interventi fuori iterazione

Lavori fatti su richiesta diretta del product owner, fuori dalle iterazioni della roadmap
(quelle restano in [REGISTRO_ITERAZIONI.md](REGISTRO_ITERAZIONI.md)). Ogni voce dice che cosa è
cambiato, dove, come è stato verificato e che cosa resta aperto. Le proposte non realizzate
non stanno qui: sono nel piano (ROADMAP.md, iterazione 12) o in DECISIONI_APERTE.md.

## 2026-11-14 — Analisi dell'app, sicurezza, rinfresco dell'interfaccia, copertine con foto

Richiesta: analisi completa da sviluppatore e da commerciale, poi applicazione delle migliorie
possibili, soprattutto di interfaccia; in seguito schermata di apertura, immagini vere per le
serate con una soluzione lecita, controllo finale. Il product owner ha lasciato le scelte a
Claude e ha chiesto di non essere interpellato.

### Rami e commit (locali, non caricati su GitHub)

| Ramo | Commit | Contenuto |
|---|---|---|
| `fix/rafforza-sicurezza-ci-e-funzioni` | `fc6acd9` | Sicurezza di CI, funzioni e cambio password |
| `feat/rinfresco-interfaccia` | `373ed76` | Brief del rinfresco (`design/F-01-rinfresco-interfaccia/`) |
| | `36b49bd` | Rinfresco di Benvenuto, Scopri, dettaglio evento, barra di navigazione |
| | `7b65edc` | Prima versione della schermata di apertura |
| | `6eb4a48` | Foto d'atmosfera nelle copertine (ADR-0032) |
| | commit successivo | Apertura con il solo simbolo, pagina 404, anteprima dei link, robots.txt, questo registro e il piano |

I due rami partono da `main` e sono indipendenti: si possono unire in qualsiasi ordine.

### 1. Sicurezza

- Azioni dei workflow fissate allo SHA del commit (prima ai tag, per esempio `@v7`).
- Dependabot per npm, uv, Docker e le azioni; analisi CodeQL di TypeScript, Python e workflow.
- `elimina-account` risponde solo alle origini di `NOXA_ORIGINI_APP` (sito e app native);
  senza la variabile solo allo sviluppo locale. La variabile è impostata da
  `scripts/configura_ambiente.sh` e a ogni pubblicazione (`pubblica.yml`).
- Cambio della password solo con un accesso recente (`secure_password_change`).
- Verifica: documentazione, formattazione, sintassi dei file. I workflow e la funzione non sono
  stati eseguiti in locale (Docker spento, Deno assente): la prova è la CI della PR. Il cambio
  password protetto arriva in staging rilanciando `scripts/configura_ambiente.sh .env.staging`.

### 2. Rinfresco dell'interfaccia (deroga a DESIGN.md §2, chiesta dal product owner)

Implementato direttamente nel codice con i soli token esistenti, senza tavole di Claude Design.

- **Benvenuto**: quattro schede con le promesse dell'app (Scopri, Organizza, Vivi, Ricorda).
- **Scopri**: miniature da 84 a 108 px, riga degli amici subito sotto l'orario con avatar da
  32 px, testo secondario a 14 px, fila «Con i tuoi amici» in cima (solo amici confermati con
  la scelta visibile, R-67; non ripete l'evento in evidenza).
- **Dettaglio evento**: «Partecipo» in accento tenue a riposo e pieno quando è scelto, battito
  singolo e vibrazione breve dopo il tocco, riga degli amici con avatar da 40 px.
- **Barra di navigazione**: fondo tenue dietro l'area attiva, luna per Vivi.
- Verifica: lint, tipi, 154 test unitari, suite e2e completa sui quattro browser (850 superati;
  un test del diario su Firefox è fallito sotto carico ed è passato rieseguito da solo).

### 3. Schermata di apertura

Solo il simbolo di Noxa: la «n» sale, il lampione si accende con il bagliore, poi la schermata
si apre sulla pagina sotto (Benvenuto senza sessione, Scopri con la sessione). Due secondi, una
volta per sessione, solo CSS, non blocca i tocchi, assente con il movimento ridotto
(`Apertura.tsx`, `movimento.css`, `lib/tema.ts`). Verifica: test e2e sui quattro browser e
fotogrammi controllati a vista.

### 4. Copertine con foto (ADR-0032)

Le locandine vere non si possono ripubblicare senza licenza e il product owner esclude di
chiedere l'autorizzazione ai locali. Soluzione: 44 foto di pubblico dominio o CC0 (luci, laser,
console, palchi, pubblico di spalle), servite dall'app, con autore, licenza e fonte in
`apps/web/src/lib/fotoSerata.json`. Ogni serata sceglie dal seme la foto tra i temi del genere,
l'inquadratura e il verso; la tinta viene dai colori della locandina (ADR-0030). Verifica: 5
test unitari (licenze, file, scelta stabile), test e2e di Scopri, catalogo, gruppi, diario e
mappa su Chromium e WebKit, schermate controllate a vista nei due temi. Le foto sono state
scelte guardando le anteprime: nessun volto riconoscibile, alcol o marchio visibile; un
controllo umano di ogni foto a piena risoluzione resta consigliato prima della beta.

### 5. Controllo finale e rifiniture

- Pagina 404 con il ritorno a Scopri (`src/app/not-found.tsx`).
- Anteprima dei link condivisi (Open Graph) con immagine `public/icone/anteprima.png`,
  generata da `pnpm --filter web icone`; `robots.txt` che lascia ai motori solo le pagine
  pubbliche.

- Verifica finale: lint, tipi, 159 test unitari; suite e2e completa sui quattro browser con
  863 test superati e 4 falliti sotto carico (mappa di Scopri su Chromium e WebKit, notifiche
  su WebKit, diario offline su Firefox), tutti superati rieseguiti da soli. Sono test già noti
  come sensibili al carico: l'esito che conta è la CI della PR.

### Non fatto, con il motivo

| Voce | Motivo | Dove è nel piano |
|---|---|---|
| Link di biglietti e fonti solo `https` | Serve una migrazione con test pgTAP; Docker era spento | ROADMAP, iterazione 12 |
| Momenti di riscontro (amicizia, gruppo, serata al completo) | Tre flussi diversi con i loro test: da disegnare prima | ROADMAP, iterazione 12; brief §4 |
| Testi «troppo da intelligenza artificiale» | La richiesta non dice quali testi; le descrizioni vengono dai siti dei locali e i generi sono un elenco fisso | D-19 |
| Pagine evento pubbliche | Tocca le regole di visibilità degli eventi: serve un ADR | D-18 |
| Scadenza delle sessioni | Non disponibile nel piano gratuito di Supabase | ROADMAP, iterazione 12 |
| Repository privato | Scelta del product owner nelle impostazioni di GitHub | ROADMAP, iterazione 12 |

## 2026-11-14 (sera) — Rifiniture dell'interfaccia e layout desktop da sito

Richiesta: dopo l'analisi delle schermate reali, correggere i difetti trovati, applicare le
migliorie di interfaccia e rendere la versione desktop «più sito che applicazione», diversa
dal telefono. Ramo `feat/rifiniture-e-layout-desktop`.

### Pubblicazione e CI

- PR #71 e #72 unite dal product owner; la CI di `main` è fallita per un test nuovo
  (anteprima dei link, corretto con la PR #82) e per la mappa su Firefox nei runner, che
  falliva già prima. Lo staging è stato pubblicato a mano con `workflow_dispatch`.
- Firefox in CI: i driver Mesa non sono bastati; in questo ramo Firefox gira con uno schermo
  virtuale (Xvfb, `NOXA_FIREFOX_CON_SCHERMO`). Esito da verificare nella CI della PR.
- PR di Dependabot #73–#81: nessuna unita; su sette c'è il motivo in un commento. #74
  (`setup-uv`) e #81 (ESLint 10) si possono unire quando la CI di `main` è verde.

### Correzioni

- Barra laterale del tablet a sinistra (compariva a destra).
- Campanella neutra, in accento solo con notifiche da leggere.
- Barra «Salva» del diario e delle serate esattamente sopra la navigazione (`--nav-altezza`):
  prima restava un varco da cui spuntava il contenuto.
- Diario vuoto senza il riquadro tratteggiato riservato alla Fase 2.
- Serata libera con la copertina della serata (foto e titolo) al posto del rettangolo grigio.
- Dettaglio evento: con la copertina generata il titolo non si ripete sotto (resta per i
  lettori di schermo).
- Stati vuoti con l'icona su fondo tenue dell'accento.
- «Cerca amici» al posto di «Cerca per username» nel pulsante; il conteggio dei membri non va
  più a capo.
- Tolta dalla libreria una foto con un testo leggibile su uno schermo (restano 43 foto).

### Layout desktop (ADR-0033)

Sopra i 1024 px: barra in alto con marchio e aree, piè di pagina con i documenti, colonna
centrata, Scopri a griglia con l'evento in evidenza a tutta riga, dettaglio evento a due
colonne con la locandina che resta in vista, Benvenuto come pagina di presentazione.

### Due falsi allarmi dell'analisi

- La data in formato `mm/dd/yyyy` nel diario e la scritta «Verifica completata» nell'accesso
  compaiono solo nel browser dei test (lingua inglese, Turnstile simulato): con un browser in
  italiano il campo data è `gg/mm/aaaa` e il controllo è il riquadro di Cloudflare.

### Non fatto

| Voce | Motivo | Dove è nel piano |
|---|---|---|
| Profilo con statistiche e badge | È l'iterazione 11 | ROADMAP, iterazione 11 |
| Layout a più colonne per Organizza, Vivi, Ricorda e Profilo su desktop | Ogni area va pensata a sé | ROADMAP, iterazione 12 |
| Meno carattere monospazio, «Privacy e dati» più leggibile, nomi di area e titoli allineati | Toccano molte schermate e i loro test | ROADMAP, iterazione 12 |
| Resa delle foto nel tema chiaro | Serve una tinta diversa per il tema chiaro | ROADMAP, iterazione 12 |

## 2026-11-15 — Interfaccia larga e traslucida, dati delle serate più completi, «Non hai un passaggio?»

Richiesta: (1) sistemare l'interfaccia da computer, che non usava tutto lo schermo, e
ottimizzare quella da telefono; (2) più trasparenza, soprattutto nei tag, che sembravano
blocchi neri; nell'evento in evidenza il genere occupava metà scheda; (3) informazioni delle
serate più accurate e complete, come età e link ai biglietti; (4) integrare «non ho un
passaggio» dove più opportuno, con Uber o i numeri dei taxi.

### Rami

| Ramo | Contenuto |
|---|---|
| `feat/interfaccia-dettagli-e-passaggio` | Punti 1, 2 e 4 e la parte visibile del punto 3 (dettaglio evento): app, migrazione e documenti |
| `feat/dettagli-serate` | Punto 3 nel worker: lettura della pagina della serata, con EVENT_INGESTION.md §2.6 |

### 1 e 2. Interfaccia

- **Desktop**: la larghezza del sito segue lo schermo fino a 1680 px (prima 1120 px fissi).
  Scopri: evento in evidenza a tutta riga con amici, generi e prezzo in un riquadro
  traslucido grande quanto il contenuto, eventi in colonne da almeno 400 px. Vivi, Organizza,
  Ricorda e Profilo su più colonne. Dettaglio evento con la locandina più alta (ADR-0033,
  aggiornamento).
- **Telefono**: intestazione delle aree più bassa (titolo da 48 a 40 px), barra di
  navigazione traslucida, la scheda in evidenza non lascia una fascia vuota quando non ha
  amici, generi né prezzo.
- **Trasparenze**: tag dei generi a pillola con fondo traslucido e bordo sottile; etichetta
  dell'età sopra le copertine, pulsanti tondi e barra di navigazione «di vetro»
  (`--vetro-*`, DESIGN.md §2), in entrambi i temi.
- Verifica: lint, tipi, formattazione, 159 test unitari; e2e su telefono e desktop (Chromium)
  di Scopri, navigazione, Vivi, gruppi, Ricorda, amici, catalogo e ritorno, axe compreso:
  206 superati; schermate controllate a vista a 412 e a 1920 px nei due temi. Safari e
  Firefox girano nella CI della PR.

### 3. Dati delle serate

Stato in staging prima dell'intervento (serate future pubblicate): The Club 126 serate senza
età dichiarata, prezzo, biglietti né generi; Magazzini Generali 25 e Live Club 16 senza
biglietti né prezzo; solo Gate completo. Causa: il worker leggeva solo gli elenchi, mentre
questi dati stanno nella pagina della singola serata.

- **Worker**: dopo l'elenco legge la pagina delle serate dei prossimi 45 giorni ancora senza
  biglietti, al massimo 8 per esecuzione, sempre con il client conforme
  (`fonti/dettaglio.py`, EVENT_INGESTION.md §2.6). Ne ricava link ai biglietti, prezzo
  d'ingresso, età dichiarata e genere. Provato su tre pagine reali salvate come fixture:
  The Club (prevendita da 20 €, «Non sono ammessi minorenni» = 18 dichiarati, hip hop e
  house), Magazzini Generali (link TicketOne), Live Club (link Vivaticket, 37 €).
- **Età**: riconosciute «non sono ammessi minorenni», «under 18 not allowed», «vietato ai
  minori di 16 anni» (16, non 18). Corretti due errori: «ingresso da 15 €» letto come 15 anni
  e l'età di un tavolo («privé dai 21 anni») presa per l'età della serata.
- **App**: il dettaglio mostra sempre età (dichiarata o no, con la spiegazione), prezzo e
  biglietti; il pulsante dei biglietti porta il nome del sito; se la fonte non indica i
  biglietti lo dice e rimanda al sito del locale.
- Verifica: Ruff, mypy, 343 test del worker (22 nuovi). Non provato contro lo staging: i dati
  si completano dopo l'unione, in qualche esecuzione del worker (8 serate per fonte ogni
  volta, The Club con 20 secondi tra una richiesta e l'altra).
- Limite: quando il locale non scrive l'età, resta «18+ non dichiarata» (R-21). Per i
  concerti aperti a tutti serve la correzione di un moderatore o una regola nuova (ROADMAP,
  iterazione 12).

### 4. «Non hai un passaggio?» (F-23, ADR-0034, chiude D-17)

- In Vivi, sotto il ritorno sicuro, sempre visibile; nella serata di gruppo un pulsante per chi
  non ha ancora scelto come torna.
- Voci verificate su fonti ufficiali il 2026-11-15: rete notturna ATM, Radiotaxi 02 4040 e
  02 8585, Radiotaxi Monza 039 36379, Uber (solo maggiorenni: i termini chiedono 18 anni).
- Tabella `servizi_trasporto` con RLS: l'età si confronta nel database, l'app non scrive.
  Nessun dato personale, nessun SDK, nessuna posizione o destinazione passata a terzi.
- Verifica: e2e di Vivi e gruppi su telefono e desktop (72 superati, 3 nuovi con axe).
  **Migrazione e test pgTAP `043` non eseguiti in locale** (Docker Desktop spento): li esegue
  la CI della PR. I tipi TypeScript della tabella sono scritti a mano con lo stesso formato
  del generatore: da rigenerare con `supabase gen types` alla prima occasione.

### Non fatto, con il motivo

| Voce | Motivo | Dove è nel piano |
|---|---|---|
| 02 7777, 02 6969, FreeNow, itTaxi, treni notturni Trenord | Numero o età minima non confermati su una fonte ufficiale | ROADMAP, iterazione 12 |
| Gestione dei servizi di trasporto dall'area di moderazione | Richiede nuove azioni nel registro (R-69) e una schermata | ROADMAP, iterazione 12 |
| Età predefinita per locale | Tocca R-21: serve un ADR | ROADMAP, iterazione 12 |
| Tavole di Claude Design per vetro e layout largo | Deroga chiesta dal product owner; token da riportare nel progetto | DESIGN.md §2 |

