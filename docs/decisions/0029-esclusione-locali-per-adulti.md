# ADR-0029: Esclusione dei locali di intrattenimento per adulti

- **Stato**: Accettato
- **Data**: 2026-11-11

## Contesto
Il primo bootstrap dei locali da OpenStreetMap (EVENT_INGESTION.md §2.1) ha restituito 85
candidati per Milano e Brianza. Il tag `amenity=nightclub` comprende anche locali di
intrattenimento per adulti: discoteche topless, night club con spettacoli di spogliarello,
saune. Nessuna regola di SAFETY_PRIVACY.md li escludeva: R-20…R-23 filtrano gli **eventi**
per età, ma i **locali** (`locali`) sono visibili a tutti gli utenti, quattordicenni compresi,
sulla mappa e nelle schede. Un locale per adulti verificato per errore comparirebbe quindi a
un minorenne.

## Decisione
- Nuova regola **R-44**: Noxa non elenca locali di intrattenimento per adulti (strip club,
  locali topless o di lap dance, night club con spettacoli di spogliarello, club per
  scambisti, saune e centri a sfondo sessuale, sexy shop) né i loro eventi, **nemmeno per gli
  utenti maggiorenni**. Il catalogo è uno solo, pensato per un pubblico dai 14 anni.
- **Bootstrap**: `bootstrap_locali.py` marca questi candidati con il motivo (tag OSM come
  `amenity=stripclub`, `leisure=sauna`, `adult=*`, oppure parole del nome come «topless»,
  «night club», «exotic», «sauna», «scambisti», o del dominio del sito come «topless») nella colonna `esclusione` del CSV e non li importa in
  `candidati_locali`. Il controllo è volutamente prudente: un falso positivo (per esempio un
  locale ordinario che si chiama «Nightclub») si recupera creando il locale a mano dopo la
  verifica, un falso negativo no.
- **Verifica umana**: prima di "Verifica e crea" o di creare un locale a mano il moderatore
  controlla che il locale non rientri in R-44 (sito, recensioni, foto); se ci rientra lo
  scarta con il motivo "R-44". Vale anche per i locali citati nei flyer e per le fonti
  Instagram.
- La regola riguarda il **tipo di attività**, non il pubblico: i locali LGBTQ+ e le serate a
  tema non sono esclusi in quanto tali e si trattano come tutti gli altri.

## Alternative considerate
- **Locali visibili solo ai maggiorenni**: una colonna `solo_maggiorenni` su `locali`, la RLS
  su `locali` e sulle RPC della mappa, test pgTAP per tutte le età. Più lavoro e più punti in
  cui sbagliare, per un tipo di locale che non serve allo scopo di Noxa (uscire la sera con
  gli amici).
- **Nessun filtro automatico, solo verifica dei moderatori**: una sola barriera umana per un
  errore che espone i minorenni; il filtro nel bootstrap costa poco e toglie il rischio alla
  fonte.

## Conseguenze
- Il CSV del bootstrap ha la colonna `esclusione`; `--importa` salta le righe con un motivo.
- I moderatori hanno un criterio in più nella verifica dei candidati, dei locali nuovi e dei
  flyer (SAFETY_PRIVACY.md §11).
- Documenti aggiornati: SAFETY_PRIVACY.md (R-44, §11), EVENT_INGESTION.md §2.1, PRD.md §6,
  CLAUDE.md (vincolo 7), skill `add-event-source` e `safety-review`.
