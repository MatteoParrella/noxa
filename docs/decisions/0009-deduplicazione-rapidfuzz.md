# ADR-0009: Deduplicazione con blocchi per locale e data e confronto fuzzy

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Lo stesso evento arriva dal sito del locale, da Instagram e dai flyer con titoli diversi
("SABATO TECHNO w/ DJ X" e "Techno Saturday - DJ X").

## Decisione
- Blocchi di confronto per `locale_id` + `data_serata` (la serata inizia alle 6:00 del giorno
  di calendario e include le ore successive alla mezzanotte).
- Titoli normalizzati e confrontati con `rapidfuzz.fuzz.token_set_ratio`; artisti in comune e
  vicinanza degli orari come segnali di conferma; una zona grigia va in revisione umana.
- Soglie calibrate su un golden set versionato, con test di non regressione.
- Fusione dei campi per affidabilità della fonte; età minima = massimo (R-22).

## Alternative considerate
- **Embedding semantici**: più costosi e meno spiegabili; da valutare solo se la precisione
  non raggiunge gli obiettivi.
- **Solo uguaglianza esatta**: troppi duplicati visibili agli utenti.

## Conseguenze
- La qualità del catalogo dipende dalla correttezza di `locale_id`: la risoluzione del locale
  nei flyer è un punto critico, gestito con revisione.
