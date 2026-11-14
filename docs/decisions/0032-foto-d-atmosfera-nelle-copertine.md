# ADR-0032: Foto d'atmosfera con licenza libera nelle copertine

- **Stato**: Accettato
- **Data**: 2026-11-14

## Contesto
Le copertine generate (design/F-01-copertine-generate, ADR-0030) sono motivi astratti. Il
product owner le trova poco attraenti rispetto alle app che mostrano la locandina vera di ogni
serata, e chiede che ogni serata si distingua a colpo d'occhio. Le locandine originali non si
possono mostrare: ripubblicarle senza licenza viola il diritto d'autore (ADR-0008), e il
product owner esclude di chiedere l'autorizzazione ai locali, che in pratica non rispondono.
Servono immagini vere, lecite e adatte anche ai minorenni (R-56).

## Decisione
- La copertina generata mostra una **foto d'atmosfera** (luci, laser, console, palchi, pubblico
  di spalle) sotto il titolo, al posto del motivo astratto. Non è una foto dell'evento né del
  locale e non viene presentata come tale.
- Le foto sono **solo di pubblico dominio o CC0** (nessun obbligo di attribuzione, uso
  commerciale e modifiche consentiti). Sono escluse le licenze con attribuzione, «condividi
  allo stesso modo», «non commerciale» e «non opere derivate», perché la foto viene ritagliata
  e colorata. L'elenco `apps/web/src/lib/fotoSerata.json` registra per ogni foto file, tema,
  autore, licenza e pagina di origine: è la prova della licenza. Un test unitario rifiuta una
  voce senza questi dati o senza file.
- Le foto rispettano R-56: **nessuna persona riconoscibile** (solo sagome e persone di spalle),
  nessun alcol in evidenza, nessun marchio leggibile. Le sceglie e le aggiunge un moderatore o
  uno sviluppatore con una PR, mai un utente.
- Le foto stanno nell'app (`apps/web/public/copertine/`, 800 × 500 WebP): nessuna richiesta a
  terzi (R-62), nessun dato nel database.
- **Ogni serata ha la sua copertina**: il seme (titolo + locale) sceglie la foto tra i temi
  adatti alla famiglia del genere (`club`, `disco`, `folla`, `palco`), il punto dell'inquadratura
  e il verso; la foto è in bianco e nero sotto la tinta dei colori letti dall'immagine della
  fonte (ADR-0030) o, se mancano, della famiglia. La stessa serata ha la stessa copertina in
  elenco, mappa e dettaglio. Il titolo resta sulla velatura del fondo, con lo stesso contrasto
  di prima.
- Ordine dell'immagine di un evento (ADR-0018): foto del locale, flyer approvato, copertina
  generata con la foto d'atmosfera; se la foto non si carica (offline) resta il motivo
  disegnato. Le copertine sostitutive (ADR-0023) non cambiano.

## Alternative considerate
- **Autorizzazione scritta dei locali a mostrare le locandine**: è la via di chi mostra le
  locandine vere, ma il product owner la esclude perché i locali non rispondono.
- **Mostrare la locandina direttamente dal sito del locale**: invia l'indirizzo IP di ogni
  utente a terzi (R-62) e resta una comunicazione al pubblico senza licenza. Scartata.
- **Embed di Instagram**: carica script e tracciamento di Meta (R-62). Scartata.
- **Foto con licenza CC BY**: più scelta, ma richiede l'attribuzione accanto a ogni copertina
  e molte ritraggono persone riconoscibili. Scartata per ora.
- **Immagini generate dall'intelligenza artificiale**: nessun vincolo di licenza, ma nessuno
  strumento nel progetto e un aspetto meno credibile. Da rivalutare.

## Conseguenze
- Due serate con lo stesso genere possono avere la stessa foto, distinte da inquadratura,
  verso, tinta e titolo: più la libreria cresce, più il caso è raro. Prima versione: 43 foto
  (una delle 44 iniziali è stata tolta perché mostrava un testo leggibile su uno schermo).
- Circa 0,8 MB in più nell'export statico; le foto non entrano nel precache del service
  worker e si caricano solo quando compaiono.
- La libreria si amplia con una PR: file in `public/copertine/` e voce in `fotoSerata.json`.
- Documenti aggiornati: SAFETY_PRIVACY.md (R-56), DESIGN.md §3, indice degli ADR. La verifica
  legale delle fonti delle foto rientra in D-07.
