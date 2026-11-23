# Scopri senza account (sito)

Tavole preparate da Claude il 2026-11-23 (iterazione 12, D-18, ADR-0036), catturate dalla
schermata implementata con il Supabase simulato dei test.

## Obiettivo
Chi apre il sito senza account vede le serate dei prossimi 7 giorni e capisce che cosa offre
Noxa; qualsiasi clic porta all'iscrizione. Nell'app installata resta l'accesso obbligatorio.

## Stati
- **Elenco**: intestazione «Scopri · Prossimi giorni» con «Entra»; invito «Iscriviti per
  vedere prezzi, biglietti, la mappa e chi dei tuoi amici ci va» con «Crea un account»; serate
  raggruppate per serata, la prima con titolo in evidenza.
- **Serata riservata** (riferimenti all'alcol, R-23): riga «Serata 18+» con locale, ora e la
  nota «La vedi con un account maggiorenne»; niente titolo, generi o colori della fonte.
- **Caricamento, errore con «Riprova», offline, vuoto** («Nessuna serata nei prossimi
  giorni»): gli stessi stati di Scopri.
- **Clic** su una serata, sulla barra delle schede o su un'altra area: si apre
  l'iscrizione; dopo l'accesso si riapre la pagina scelta.

## Tavole
`01-elenco-{scuro,chiaro}-{mobile,desktop}-chromium.png`.
