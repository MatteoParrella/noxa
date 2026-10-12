# ADR-0005: Età minima numerica per evento e data di nascita

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Gli eventi hanno soglie diverse (14+, 16+, 18+, 20+, 21+). Le regole di contatto distinguono
minorenni e maggiorenni. L'età cambia nel tempo.

## Decisione
- `eventi.eta_minima` è un intero da 14 a 30, predefinito 18 se non dichiarato (R-21); in
  caso di fonti discordanti vale il massimo (R-22).
- Si conserva la **data di nascita** (non una fascia), immutabile dall'utente (R-02); età e
  fascia si calcolano nel database a ogni richiesta (R-04).
- Un evento è visibile se l'età dell'utente è almeno l'età minima (R-20), per tutti gli
  utenti.

## Alternative considerate
- **Fasce fisse di eventi (14+, 16+, 18+)**: non coprirebbero 20+ e 21+.
- **Salvare solo la fascia**: impossibile gestire i compleanni e le soglie 16, 20, 21.

## Conseguenze
- La data di nascita è un dato personale in più, protetto da R-05.
- Il passaggio ai 18 anni richiede il job sull'invariante dei gruppi (R-15).
