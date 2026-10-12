# ADR-0008: Politica sulle fonti degli eventi

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Raccogliere eventi da siti di terzi ha vincoli legali (termini d'uso, diritto sui database,
GDPR) e reputazionali. Alcuni aggregatori (per esempio Resident Advisor) vietano
esplicitamente la raccolta automatica.

## Decisione
- Si raccolgono eventi solo da fonti con `stato_conformita = 'consentita'`, dopo la verifica
  di robots.txt **e** dei termini d'uso, documentata in `fonti.note_conformita`.
- Instagram solo con l'API ufficiale Graph (Business Discovery), mai scraping.
- Aggregatori (RA, Xceed, Dice) solo con accordo scritto o API ufficiale (D-05).
- Si salvano solo i campi dello schema evento; nessun dato personale; nessuna immagine
  ripubblicata dalle fonti; link alla fonte sempre visibile.
- Da Google Places si conserva solo il `place_id`.
- Richieste di rimozione eseguite entro 72 ore.
- Tutte le richieste HTTP passano da `ClientHttpConforme` (EVENT_INGESTION.md §4).

## Alternative considerate
- **Rispettare solo robots.txt**: insufficiente, perché i termini d'uso possono vietare la
  raccolta anche quando robots.txt la consente.
- **Scraping degli aggregatori senza accordo**: rischio legale e di blocco, inaccettabile per
  un prodotto commerciale.

## Conseguenze
- Copertura iniziale più bassa, compensata dai flyer caricati dagli utenti.
- Ogni nuova fonte richiede la procedura della skill `add-event-source`.
