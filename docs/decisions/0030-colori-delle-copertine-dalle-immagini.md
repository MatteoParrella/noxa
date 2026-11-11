# ADR-0030: Colori delle copertine dalle immagini delle fonti

- **Stato**: Accettato
- **Data**: 2026-11-11

## Contesto
Le copertine generate (design/F-01-copertine-generate) danno a ogni serata una locandina
astratta: il motivo viene dal titolo, il colore dal genere musicale. Il product owner vuole che
la copertina richiami il locale e la serata, cioè i colori delle immagini che il locale
pubblica (locandine sul sito, immagini nei dati strutturati, post Instagram). Fino a oggi
ADR-0008 ed EVENT_INGESTION.md §2.4 vietavano di scaricare immagini dalle fonti: si salvava
solo il link. Ripubblicarle resta escluso per il diritto d'autore e per le persone
riconoscibili (ADR-0018).

## Decisione
- Il worker può **leggere un'immagine di una fonte solo in memoria, per estrarne i colori
  dominanti**. L'immagine non si salva (né su disco, né nel database, né nello storage), non
  si mostra, non si inoltra a servizi esterni e non si analizza in altro modo: nessun
  riconoscimento di volti, testi o oggetti.
- Si conserva solo la **tavolozza**: 4 colori per il tema scuro e 4 per il tema chiaro
  (`fondo`, `1`, `2`, `bagliore`), in `eventi.copertina_colori`. Il worker adatta i colori ai
  vincoli di contrasto del design (testo su velatura ≥ 4,5:1 in entrambi i temi) prima di
  salvarli; un colore non è un'opera protetta né un dato personale.
- **Una sola immagine per serata**: la tavolozza vale per titolo normalizzato + locale (il
  seme della copertina) e si ricalcola al massimo ogni 30 giorni. Così The Club, con 127
  eventi e 5 serate fisse, richiede 5 immagini, non 127.
- Le immagini passano da `ClientHttpConforme`: user agent `NoxaBot`, robots.txt del dominio
  dell'immagine, limiti di frequenza, stop su 403 e 429, limite di pagine per esecuzione. Un
  dominio che vieta il percorso o un'immagine oltre 5 MB si salta senza errore.
- Il link all'immagine si legge dalla fonte solo quando serve e resta nei dati grezzi (30
  giorni, come gli altri campi grezzi); non entra nello schema evento.
- Senza tavolozza (fonte senza immagini, dominio vietato, errore) la copertina usa la
  famiglia del genere, come nel design.

## Alternative considerate
- **Colore scelto a mano dal moderatore per locale**: nessun download, ma non segue le
  singole serate e richiede lavoro manuale per ogni locale. Scartata dal product owner.
- **Solo il genere musicale**: nessun legame visivo con il locale. Scartata dal product owner.
- **Mostrare l'immagine originale**: violerebbe il diritto d'autore e R-56 (persone
  riconoscibili). Resta esclusa.

## Conseguenze
- Una richiesta HTTP in più per serata nuova (non per evento), entro i limiti di
  `ClientHttpConforme`.
- Nuova colonna `eventi.copertina_colori` con vincolo di formato; visibilità invariata (policy
  di `eventi`, R-20).
- Documenti aggiornati: EVENT_INGESTION.md §2.4, ADR-0008 (riga sulle immagini), CLAUDE.md
  (regole per scraping), DATA_MODEL.md (colonna, nella PR del database).
