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
