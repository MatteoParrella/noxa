# Decisioni aperte

Questo è l'**unico punto** del repository in cui si elencano le decisioni non ancora prese.
Gli altri documenti descrivono la scelta adottata oggi (indicata come "Scelta provvisoria" qui
sotto) e rimandano a questo file con l'ID `D-xx`. Quando una decisione viene presa:

1. si scrive o si aggiorna l'ADR corrispondente in `docs/decisions/`;
2. si aggiornano i documenti che la citano;
3. si sposta la voce nella sezione "Decisioni chiuse" con la data e il link all'ADR.

| ID | Decisione | Scelta provvisoria | Chi decide | Entro |
|---|---|---|---|---|
| D-01 | Dominio del prodotto (il nome "Noxa" è deciso) | Dominio di lavoro `noxa.app`, usato in user agent dello scraper, email e app Meta; disponibilità del dominio e del marchio "Noxa" da verificare | Product owner | Fine Fase 0 |
| D-02 | Regola di contatto tra minorenni di età diverse (es. 14 e 17 anni) | Tutti i 14–17 anni sono un'unica fascia e possono cercarsi tra loro, con amicizia reciproca (R-10). Alternativa: ricerca limitata a ±2 anni di differenza | Product owner + consulente legale | Fine Fase 0 |
| D-03 | Modello Claude per l'estrazione dei flyer in produzione | `claude-opus-5-5` (ADR-0007). Valutare `claude-sonnet-5-5` o `claude-haiku-5-5` sul golden set confrontando qualità e costo per flyer | Product owner su dati della skill `flyer-parser` | Metà Fase 1 |
| D-04 | Plugin Capacitor per la geolocalizzazione in background | `@capacitor-community/background-geolocation` (open source). Alternativa: plugin commerciale con licenza (maggiore affidabilità su iOS, costo annuo) | Tech lead dopo un prototipo su dispositivi reali | Inizio Fase 2 |
| D-05 | Accordi con Resident Advisor, Xceed e Dice | Nessuna integrazione finché non c'è un accordo scritto o un'API ufficiale (ADR-0008) | Product owner | Fase 3 |
| D-06 | Classificazione d'età negli store | Da determinare con i questionari ufficiali di Apple e Google, considerando i riferimenti alla vita notturna | Product owner | Fase 2 |
| D-07 | Verifiche legali: DPIA, eventuale nomina del DPO, termini e informativa, licenza ODbL per i dati OpenStreetMap usati in `locali`, basi giuridiche dei trasferimenti verso Anthropic, Meta e Google (FCM) | DPIA avviata in Fase 0; i dati OSM sono usati solo come fonte iniziale di verifica e con attribuzione | Consulente legale | Bozza in Fase 0, definitiva prima della Fase 2 |
| D-08 | Accesso con Apple e Google (F-17) | Non nel MVP; solo email e password | Product owner | Fase 3 |
| D-09 | Fornitore delle tile della mappa | PMTiles generate da OpenStreetMap e servite dal bucket `mappe` (ADR-0004). Alternativa: MapTiler a pagamento | Tech lead | Fine Fase 0 |
| D-10 | Organizzazione della moderazione: team interno o esterno, turni per coprire i tempi di R-53 | Team interno ridotto durante la beta, con turni serali e weekend | Product owner | Prima della Fase 1 |
| D-11 | Modello di business | Nessuna pubblicità (R-61). Ipotesi da valutare dopo il lancio: servizi B2B per i locali (fuori perimetro del MVP) | Fondatori | Dopo la Fase 2 |
| D-12 | Trattamento dei dati da parte di Anthropic: conservazione, residenza dei dati, accordo sul trattamento (DPA) | Si inviano solo le immagini dei flyer, senza identificativi (R-66); accordo da firmare prima della beta | Consulente legale + tech lead | Prima della Fase 1 |

## Decisioni chiuse

| ID | Decisione | Esito | Data |
|---|---|---|---|
| D-01 (parte) | Nome del prodotto | **Noxa**. Resta aperto il dominio (D-01). | 2026-10-12 |
