# design

Materiali di Claude Design per ogni schermata o gruppo di schermate (ADR-0011,
`docs/DESIGN.md`). Il design system va in `design/sistema/`; poi una cartella per
funzionalità, `design/F-xx-nome/`, secondo il calendario di `docs/GUIDA_OPERATIVA.md` §4. Ogni
cartella contiene:

- `brief.md`: obiettivo, stati (caricamento, vuoto, errore, successo, offline), varianti
  per minorenni e maggiorenni, testi;
- link al progetto Claude Design;
- immagini di ogni stato in tema scuro e chiaro;
- eventuale codice o specifica esportata, usata solo come riferimento.

L'implementazione segue la skill `implement-design`.
