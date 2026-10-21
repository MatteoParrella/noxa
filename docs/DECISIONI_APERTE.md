# Decisioni aperte

Questo è l'**unico punto** del repository in cui si elencano le decisioni non ancora prese.
Gli altri documenti descrivono la scelta adottata oggi (indicata come "Scelta provvisoria" qui
sotto) e rimandano a questo file con l'ID `D-xx`. Quando una decisione viene presa:

1. si scrive o si aggiorna l'ADR corrispondente in `docs/decisions/`;
2. si aggiornano i documenti che la citano;
3. si sposta la voce nella sezione "Decisioni chiuse" con la data e il link all'ADR.

| ID | Decisione | Scelta provvisoria | Chi decide | Entro |
|---|---|---|---|---|
| D-01 | Dominio del prodotto (il nome "Noxa" è deciso) | Dominio di lavoro `noxa.app`, usato in user agent dello scraper, email, app Meta e identificativo delle app native (`app.noxa` in `capacitor.config.ts`, non più modificabile dopo la prima pubblicazione negli store); disponibilità del dominio e del marchio "Noxa" da verificare | Product owner | Quando si crea lo staging (serve per App Review Meta, email, mappa su R2 e informativa online), su Cloudflare Registrar a prezzo di costo (ADR-0021); fino ad allora vale `noxa.app` come ipotesi di lavoro |
| D-03 | Modello Claude per l'estrazione dei flyer in produzione | `claude-opus-5-5` (ADR-0007). Valutare `claude-sonnet-5-5` o `claude-haiku-5-5` sul golden set confrontando qualità e costo per flyer | Product owner su dati della skill `flyer-parser` | Metà Fase 1 |
| D-04 | Plugin Capacitor per la geolocalizzazione in background | `@capacitor-community/background-geolocation` (open source). Alternativa: plugin commerciale con licenza (maggiore affidabilità su iOS, costo annuo) | Tech lead dopo un prototipo su dispositivi reali | Inizio Fase 2 |
| D-05 | Accordi con Resident Advisor, Xceed, Dice e le biglietterie italiane (TicketSMS) | Nessuna integrazione finché non c'è un accordo scritto o un'API ufficiale (ADR-0008); fino ad allora i link alle biglietterie si salvano solo come link ai biglietti letti dai siti conformi dei locali | Product owner | Fase 3 |
| D-06 | Classificazione d'età negli store | Da determinare con i questionari ufficiali di Apple e Google, considerando i riferimenti alla vita notturna | Product owner | Fase 2 |
| D-07 | Verifiche legali: DPIA, eventuale nomina del DPO, termini e informativa, licenza ODbL per i dati OpenStreetMap usati in `locali`, basi giuridiche dei trasferimenti verso Anthropic, Meta, Google (FCM), Cloudflare (Turnstile, Pages e R2; ADR-0020, ADR-0021) e GitHub (esecuzione del worker, ADR-0021) | DPIA avviata in Fase 0; i dati OSM sono usati solo come fonte iniziale di verifica e con attribuzione; termini e informativa versione 2026-10 scritti dalle regole di SAFETY_PRIVACY.md (pagine `/termini` e `/privacy` dell'app), da rivedere con il legale insieme all'identità del titolare del trattamento | Consulente legale | Bozza in Fase 0, definitiva prima della Fase 2 |
| D-08 | Accesso con Apple e Google (F-17) | Non nel MVP; solo email e password | Product owner | Fase 3 |
| D-10 | Organizzazione della moderazione: team interno o esterno, turni per coprire i tempi di R-53 | Team interno ridotto durante la beta, con turni serali e weekend | Product owner | Prima della Fase 1 |
| D-11 | Modello di business | Nessuna pubblicità (R-61). Ipotesi da valutare dopo il lancio: servizi B2B per i locali (fuori perimetro del MVP) | Fondatori | Dopo la Fase 2 |
| D-12 | Trattamento dei dati da parte di Anthropic: conservazione, residenza dei dati, accordo sul trattamento (DPA) | Si inviano solo le immagini dei flyer, senza identificativi (R-66); accordo da firmare prima della beta | Consulente legale + tech lead | Prima della Fase 1 |
| D-13 | Account degli store: Apple Developer (99 $ l'anno) e Google Play Console (25 $ una tantum) | Rimandati finché non servono: la beta può partire dalla PWA, installabile anche su iPhone; le build interne TestFlight e Google Play dell'iterazione 8 e il ritorno sicuro in background su iOS (ADR-0006) richiedono gli account | Product owner | Iterazione 8 |
| D-14 | Backup del database e protezione dalle password compromesse con utenti reali | Piano Free senza backup finché non ci sono utenti reali (ADR-0021). Prima della beta: piano Supabase Pro (circa 25 $ al mese, backup giornalieri e protezione delle password) oppure backup notturno cifrato in proprio su Cloudflare R2 con finestra di 30 giorni | Product owner + tech lead | Prima della beta (iterazione 8) |

## Decisioni chiuse

| ID | Decisione | Esito | Data |
|---|---|---|---|
| D-01 (parte) | Nome del prodotto | **Noxa**. Resta aperto il dominio (D-01). | 2026-10-12 |
| D-02 | Contatti tra minorenni di età diverse | Un'unica fascia 14–17: un minorenne può cercare per username qualsiasi altro minorenne, con amicizia reciproca ([ADR-0017](decisions/0017-fascia-unica-minorenni.md)) | 2026-10-12 |
| D-09 | Fornitore delle tile della mappa | Protomaps auto-ospitato, gratuito ([ADR-0016](decisions/0016-mappe-protomaps-autospitate.md)) | 2026-10-12 |
