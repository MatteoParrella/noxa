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
| Scadenza delle sessioni | Non disponibile nel piano gratuito di Supabase | ROADMAP, iterazione 13 |
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

## 2026-11-15 (sera) — Trasparenza in tutta l'app e copertine senza fascia scura

Richiesta: dopo l'unione delle PR #84 e #85 il product owner non vedeva cambiamenti: «vedo
sempre una striscia nera sotto ogni evento e non la trasparenza applicata a tutta l'app».
Aveva ragione: l'intervento del mattino aveva reso traslucidi solo i tag, e su un fondo nero
piatto un velo traslucido resta nero. Ramo `feat/trasparenza-in-tutta-l-app`.

- **La striscia nera** era la velatura delle copertine: opaca al 90% su quasi metà della foto
  (nelle miniature in alto e in basso). Ora sotto il testo c'è un vetro smerigliato che
  sfuma, e nelle miniature l'orario è una targhetta di vetro.
- **Tutta l'app**: fondo d'atmosfera con aloni di colore; schede, campi, segmenti, pulsanti
  secondari, righe e linee traslucidi in tutte le aree; fogli, finestre e barre fisse di
  vetro sfocato (ADR-0033, secondo aggiornamento; `src/styles/vetro.css`).
- Restano pieni l'area di moderazione e le schermate di accesso.
- Verifica: lint, tipi, formattazione; suite e2e completa su telefono e desktop (Chromium),
  464 test superati con axe nei due temi; schermate controllate a vista. Safari e Firefox
  nella CI della PR. Il contrasto del testo sulle foto è stato controllato a vista sulle
  foto dei test, non su tutte le 43 della libreria.
- Nota per chi prova: l'app installata sul telefono tiene la versione vecchia finché non si
  tocca «Ricarica» nell'avviso di nuova versione o non si chiudono tutte le schede.


## 2026-11-17 — Live Club di nuovo raccolto e più pagine per le fonti

Richiesta: «alza le pagine a 10» e «sistema Live Club». Ramo `fix/live-club-nuovo-sito`.

- **Pagine per esecuzione**: in staging `pagine_massime` è passato da 2 a 10 per le fonti di
  Live Club, Magazzini Generali, Gate, The Club e Alcatraz (dato della tabella `fonti`, non
  una migrazione). Con 2 pagine The Club completava al massimo una serata per esecuzione.
- **Live Club** leggeva 0 serate dal 15 novembre: il sito ha tolto i dati strutturati e
  /eventi/ rimanda a /tutti-gli-eventi/. Nuovo adattatore `sito_html_live_club`: ogni scheda
  dell'elenco ha già il giorno, l'apertura porte, i prezzi in cassa, il link ai biglietti e
  la nota d'ingresso. Le serate annullate non si raccolgono. Le serate senza nessun orario
  vengono scartate (ORARIO_MANCANTE): oggi 7 su 15, quasi tutti concerti lontani.
- **Età**: la normalizzazione riconosce «Ingresso riservato ai maggiori di 16 anni» come 16,
  in simmetria con «minori di 16 anni». Le serate di Live Club che lo scrivono (7teen Again,
  Puro Perreo, Zarro Night, Noche de Travesura) diventano visibili ai sedicenni e diciassettenni.
- **Fixture**: `salva_fixture` toglie da sé script, `<noscript>` e attributi `on*` (prima si
  faceva a mano, PR #86); i contatti nella pagina salvata sono sostituiti da testo neutro.
- Golden set della deduplicazione: 4 coppie reali di Live Club (le serate lette prima con
  `sito_jsonld` hanno orari diversi e si uniscono con quelle nuove). Precisione e richiamo
  invariati.
- Verifica: ruff, mypy e pytest del worker (355 test); `verifica_documentazione.py`.
- Da fare dopo l'unione: in staging la fonte di Live Club passa a `sito_html_live_club` con
  l'url /tutti-gli-eventi/, poi «Esegui ora» e controllo di `ultimo_esito`. La serata
  annullata di Steve 'n' Seagulls (8 dicembre) è ancora pubblicata dalle letture precedenti
  e va annullata in moderazione.
## 2026-11-17 — Scheda in evidenza senza fascia sotto la copertina sul telefono

Richiesta: «da telefono vedo ancora la banda nera sotto l'evento». Ramo
`fix/fascia-scura-scheda-in-evidenza`.

- Sul telefono amici, generi e prezzo della scheda in evidenza stavano in una fascia a parte
  sotto la copertina, sul fondo scuro della pagina. Ora stanno sulla copertina, sotto il
  luogo, come su desktop dove erano già in un riquadro di vetro sulla foto.
- La copertina resta almeno 16:10 e si allunga se il contenuto non ci sta
  (`min-height: 62.5cqi`: con `overflow: hidden` un `aspect-ratio` lo taglierebbe).
- Il vetro sotto il testo sale fin quasi in cima, perché il testo ora occupa più copertina;
  nel tema chiaro copre tutta la foto, altrimenti il titolo scuro finiva sulla parte nera.
- Verifica: lint, tipi, formattazione; schermate su telefono e desktop nei due temi; suite e2e
  su Chromium (telefono e desktop) con axe.

## 2026-11-17 (pomeriggio) — Sistemazioni prima dell'iterazione 11

Richiesta: «vedi te per il resto, sistema tutto prima della IT11». Ramo
`fix/prima-di-iterazione-11`, più la PR #91.

- **Fascia scura**: la #90 era impilata sulla #89 ed è stata unita nel ramo di Live Club
  quando la #89 era già in `main`, quindi la correzione non è mai arrivata in `main`. La #91
  porta lo stesso commit su `main`.
- **Live Club in staging**: fonte passata a `sito_html_live_club` con l'url
  /tutti-gli-eventi/ e una nota nelle `note_conformita`; esecuzione lanciata a mano: 15 serate
  lette, 7 unite a quelle già presenti (orari, prezzi e biglietti aggiornati; 7teen Again,
  Puro Perreo e Zarro Night ora 16+ dichiarate), 7 scartate perché senza orario, 1 in
  revisione. Il concerto annullato di Steve 'n' Seagulls resta pubblicato finché un
  moderatore non lo conferma tra i «possibili annullamenti», dove compare da solo quando il
  sito smette di confermarlo: non l'ho annullato a nome di un moderatore.
- **Età delle serate («18+ · non dichiarata» quasi ovunque)**: il worker leggeva la pagina
  di una serata solo se mancavano i biglietti. Gate dà i biglietti già nell'elenco e scrive
  «Età minima 18+» solo nella pagina della serata, quindi la sua età non veniva mai letta.
  Ora si legge la pagina anche quando manca l'età dichiarata, nell'elenco e nel catalogo
  (`dettaglio.py`, `raccolta/postgres.py`). Con 10 pagine per esecuzione e 8 dettagli per
  volta, le serate di Gate e The Club dei prossimi 45 giorni si completano in pochi giorni.
- **Età per locale: non fatta**. Ho letto i siti ufficiali: solo Gate pubblica una regola
  generale, e con un'eccezione (18+ per le serate, 16+ per i concerti); The Club la scrive in
  ogni pagina di serata, Magazzini Generali e Alcatraz da nessuna parte. Un'età unica per
  locale sarebbe sbagliata per i concerti di Gate e, per i locali che la scrivono già nelle
  serate, la lettura del dettaglio basta. Resta nella ROADMAP (iterazione 12), con il
  requisito delle eccezioni per tipo di serata.
- **Next.js 16.4.1 → 16.4.5**: correzione di GHSA-mfr8-8qww-v76h (moderata; riguarda
  `unstable_cache` e `use cache`, che l'export statico non usa) e della build che a volte si
  fermava con `SecurityFatalError`. Scelta la 16.4.5 e non la 16.4.6 perché ha più di due
  settimane. Tolte da `pnpm-workspace.yaml` le eccezioni sull'età minima di rilascio dei
  pacchetti 16.4.1. `pnpm audit --prod`: nessuna vulnerabilità.
- Verifica: worker (ruff, mypy, 355 test, 4 test di integrazione sul database locale); app
  (lint, tipi, 159 test unitari, build, suite e2e su Chromium telefono e desktop);
  `verifica_documentazione.py`.
- **Aggiornamento dell'app** (dopo «vedo ancora la banda nera»): la correzione era online
  dalle 11:28, ma il telefono mostrava la versione salvata. L'avviso «Ricarica» si poteva
  chiudere e la versione nuova si attivava solo chiudendo tutte le finestre dell'app, cosa
  che una PWA installata non fa quasi mai. Ora, con una versione in attesa, l'app la applica
  quando passa in secondo piano, tranne mentre un campo di testo è attivo
  (`lib/aggiornamento.ts`, ARCHITECTURE.md §5.5). Ramo
  `fix/aggiornamento-app-in-secondo-piano`.

## 2026-11-19/20 — Interfaccia in stile iOS (ADR-0035)

Richiesta: rifare tutta l'interfaccia perché sembri un'app nativa Apple (iOS 26, materiali
tipo Liquid Glass), senza toccare logica, route, API o dati, con la skill `apple-design`
(audit HIG prima e dopo). Scelte del product owner: tinta che non sia arancio (poi ciano
neon), tema scuro predefinito con l'interruttore del tema che resta, deroga a Claude Design,
lavoro in un worktree separato mentre l'iterazione 11 procedeva in parallelo.

### Ramo e commit (locali, non caricati su GitHub)

Ramo `feat/stile-ios`, sopra `main` con l'iterazione 11 (PR #94).

| Commit | Contenuto |
|---|---|
| `2c942cd` | Design system: token semantici iOS, scala Dynamic Type, materiali, componenti, ADR-0035, DESIGN.md §2.1, CLAUDE.md, skill `implement-design` |
| `3c171f3` | Tinta ciano neon (anche icona e anteprima dei link), cifre tabulari di sistema al posto di IBM Plex Mono |
| `7f16394` | Scopri e dettaglio evento |
| `96d2761` | Organizza, gruppi e serate; liste raggruppate senza cambiare il markup |
| `b8b9656` | Ricorda con statistiche, badge, riepiloghi e Wrapped dell'iterazione 11 |
| `cf693ea` | Vivi, ritorno sicuro, Profilo e Privacy |
| `a316231` | Benvenuto, accesso e registrazione |
| `023f863`, `48c11dc`, `a596f74` e seguenti | Correzioni dalle verifiche (testo a 10 px, contrasti, menu ⋯ nelle liste, test del movimento, liste senza `:has()`), questo registro |

### Che cosa è cambiato

- Colori: ruoli semantici di iOS con i nomi storici come alias, così tutte le schermate li
  ereditano; contrasti calcolati e scritti accanto ai token. Tinta `#3EE0CF` in scuro e
  `#005A52` in chiaro.
- Testo: carattere di sistema con Inter incluso come ripiego, scala sul modello di Dynamic
  Type in `rem` su base 17 px; su iPhone e iPad la base segue la dimensione del testo di
  sistema. Archivo resta per copertine, marchio e Wrapped.
- Vetro solo su barra delle schede, barra del titolo, fogli, menu, notifiche e barre delle
  azioni, con ripieghi opachi; schede e celle piene.
- Componenti: barra delle schede a capsula galleggiante con la capsula attiva che scivola a
  molla, titolo grande che si riduce in una barra di vetro, fogli che si chiudono
  trascinando, segmented control, interruttore 51 × 31, pulsanti a capsula, liste
  raggruppate, scheletri, stati vuoti centrati.
- Movimento: 150–450 ms a molla, niente titoli parola per parola (sostituisce le durate di
  ADR-0019).
- Errori trovati lungo la strada e corretti: l'età sulla copertina in evidenza copriva la
  data (anche su `main`); i menu ⋯ dentro le liste non si aprivano; i titoli composti parola
  per parola non andavano a capo dopo il cambio di carattere.

### Verifica

- Tipi, lint, formattazione, `verifica_documentazione.py`, 178 test unitari.
- e2e Chromium telefono e desktop: 460 su 460 (al primo giro 40 falliti per contrasti nel
  tema chiaro, menu delle liste e test del movimento, tutti corretti).
- e2e Safari per iPhone (WebKit): su questa macchina WebKit sotto WSL va in timeout anche
  su `main` (19 falliti su 229). Sul ramo i falliti erano 30, 17 diversi da `main`: rieseguiti
  da soli passano tutti e 46 i casi, dopo aver corretto i due contrasti veri che solo WebKit
  mostrava (etichetta della scheda attiva e pulsante pericolo).
- e2e Firefox desktop: al primo giro 6 falliti. Quattro erano timeout e passano rieseguiti;
  i due test di accessibilità della moderazione andavano davvero oltre i 90 secondi (su
  `main` ne servono 34) per i selettori `:has()` delle liste raggruppate, che Firefox
  ricalcola a ogni lettura di stile di axe. Riscritti senza `:has()`: 168 su 168 tra
  moderazione, amici, gruppi, privacy e Ricorda su Firefox e Chromium, aspetto invariato.
- Foto prima e dopo di ogni area in entrambi i temi, con Supabase simulato.
- `safety-review`: superata, rapporto qui sotto.

### Safety review — interfaccia in stile iOS (nessuna F-xx nuova)

Esito: SUPERATA. Nessun file in `supabase/`, `services/` o `packages/`; nessuna nuova
chiamata di rete, archiviazione, posizione o dato personale; nessuna superficie di contatto
nuova. L'unica dipendenza nuova è Inter, servito dall'app (R-62). La scelta del tema resta
salvata solo sul dispositivo, come prima. Il Wrapped condivisibile cambia solo carattere e
colori (R-42). I pulsanti Accetta e Rifiuta degli inviti restano con lo stesso peso visivo
(nessun dark pattern, R-43). Test del database non eseguiti: il ramo non tocca il database.

### Che cosa resta

- Fogli senza l'altezza intermedia (si aprono interi).
- Safari non supporta ancora `prefers-reduced-transparency`: su iPhone il vetro diventa
  opaco solo con «Aumenta contrasto».
- Da provare su un iPhone vero: Dynamic Type nell'app Capacitor e resa del vetro.
- Moderazione: solo i nuovi token, senza un controllo visivo schermata per schermata.
- Layout desktop non rivisto schermata per schermata.
- Con la barra del titolo visibile, i lettori di schermo trovano due pulsanti «indietro».
- Il progetto Claude Design va riallineato allo stile iOS (ADR-0035).

## 2026-11-23 — Iterazione 12 divisa in codice e produzione

Richiesta: dividere l'iterazione 12 in una parte di codice e una di produzione, perché il
product owner ha altro da sistemare prima della pubblicazione. Ramo `docs/dividi-iterazione-12`.

- **Iterazione 12 — Consolidamento prima della beta**: solo codice, provato in locale e su
  staging; nessun ambiente di produzione, account degli store o pubblicazione. Contiene il
  consolidamento proposto il 2026-11-14 e il 2026-11-15, l'eliminazione degli account inattivi,
  la prova di «Salva immagine» rimasta dall'iterazione 11 e le decisioni D-18 e D-19.
- **Iterazione 13 — Produzione, beta e lancio**: ambiente di produzione, beta chiusa,
  scadenza delle sessioni dei moderatori, penetration test, test di carico, testi legali e
  Google Play. Si avvia solo quando il product owner decide di pubblicare.
- Le iterazioni «Accesso con Apple e Google» e «Aggregatori e nuove aree» diventano la 14 e la
  15: in tutto sono 16. Aggiornati ROADMAP.md §5, REGISTRO_ITERAZIONI.md, GUIDA_OPERATIVA.md
  §3, §7 e §8, CLAUDE.md, la skill `iterazione`, ARCHITECTURE.md, DECISIONI_APERTE.md (D-13),
  ADR-0027 e ADR-0028 (rimandi a Google Play) e la tabella del 2026-11-14 qui sopra (scadenza
  delle sessioni).
- Verifica: `verifica_documentazione.py`; ricerca dei rimandi alle iterazioni 12, 13 e 14 in
  tutto il repository.
