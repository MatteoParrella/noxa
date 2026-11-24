# ADR-0038: Link di amicizia di 48 ore nella stessa fascia

- **Stato**: Proposto (D-22)
- **Data**: 2026-11-24

## Contesto
Oggi ogni amicizia nasce dalla ricerca per username oppure da un codice invito di 15 minuti
(F-11, R-12). Il codice è pensato per l'incontro di persona: mandato su WhatsApp a qualcuno
che non ha ancora Noxa scade prima che l'altro si iscriva. Per la crescita è il punto in cui
il passaparola si ferma, e un'app sociale con pochi amici vale poco.

R-12 chiede il codice di 15 minuti solo per le amicizie **tra fasce diverse**: tra persone
della stessa fascia la ricerca è già consentita (R-10), quindi un link più lungo non apre
contatti nuovi.

## Decisione
- Un **link di amicizia** monouso, valido **48 ore**, generato dal titolare e condiviso con il
  foglio di condivisione del sistema. Chi lo apre senza account si iscrive e torna al link.
- Il link funziona **solo tra persone della stessa fascia**, calcolata nel database
  (`private.stessa_fascia`). Tra fasce diverse dà lo stesso messaggio di un link non valido,
  senza rivelare la fascia (R-05); lì resta il codice di 15 minuti con l'avviso al minorenne.
- Usare il link crea una richiesta che il titolare del link **accetta esplicitamente** (R-11),
  come per il codice.
- I link contano nel limite di 10 codici ogni 24 ore (R-14); il titolare vede quelli attivi e
  li revoca; scaduti, si cancellano come i codici.

## Alternative considerate
- **Codice di 15 minuti anche per il link**: non risolve l'invito a chi non è iscritto.
- **Link valido anche tra fasce diverse**: un link che circola permetterebbe a un adulto di
  arrivare a un minorenne; contrario a R-12.
- **Link multiuso**: diventerebbe un modo per raccogliere amicizie di sconosciuti.

## Conseguenze
- R-12 e R-14 aggiornate in SAFETY_PRIVACY.md; `codici_invito` estesa o tabella nuova con RLS
  e test pgTAP per tutte le età; F-11 nel PRD; iterazione 14.
