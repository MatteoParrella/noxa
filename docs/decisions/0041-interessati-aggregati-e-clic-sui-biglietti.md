# ADR-0041: Interessati in forma aggregata e clic sui biglietti contati

- **Stato**: Proposto (D-25)
- **Data**: 2026-11-24

## Contesto
Chi sceglie una serata vuole sapere se ci sarà gente; un locale o un investitore vuole sapere
se Noxa porta pubblico. Oggi le partecipazioni sono visibili solo agli amici (R-67) e i clic
sui biglietti non sono misurati. Gli strumenti di analisi di terze parti sono esclusi (R-62).

## Decisione
- **Interessati aggregati**: sul dettaglio di una serata, chi può vederla legge una fascia del
  numero di persone con «Mi interessa» o «Partecipo»: «più di 10», «più di 25», «più di 50»,
  «più di 100». Sotto i 10 non compare nulla. Nessun nome, nessun avatar oltre a quelli degli
  amici già previsti da F-04, nessuna notifica sul numero (R-43).
- Il conteggio comprende anche le partecipazioni non visibili agli amici: in una fascia di
  almeno 10 persone nessuno è riconoscibile.
- **Clic sui biglietti**: un contatore per serata e per giorno, incrementato da una RPC senza
  salvare chi ha cliccato; nessuna colonna con l'utente, nessun identificativo del
  dispositivo.
- I numeri servono anche al cruscotto e al rapporto per i locali (iterazione 16), sempre in
  forma aggregata e sopra la soglia di 10.

## Alternative considerate
- **Numero esatto**: con numeri piccoli permette di dedurre chi partecipa.
- **Elenco di chi partecipa**: contrario a R-67.
- **Contatore dei clic con l'utente**: dato personale non necessario allo scopo.

## Conseguenze
- R-67 precisata in SAFETY_PRIVACY.md; DATA_MODEL.md (contatore con RLS, RPC); PRD.md (F-03,
  F-04); test pgTAP per tutte le età e per la soglia; iterazione 16.
