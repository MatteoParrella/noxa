# Roadmap

Ogni fase si chiude solo quando **tutti** i criteri di completamento sono soddisfatti e
verificati. Le funzionalità (`F-xx`) sono definite in [PRD.md](PRD.md). Una funzionalità è
completa solo se rispetta la definizione di completato del §6.

| Fase | Nome | Esito |
|---|---|---|
| 0 | Fondamenta | Infrastruttura, schema di base, sicurezza e design system pronti |
| 1 | Beta chiusa Milano e Brianza | Tracker, amicizie, gruppi, eventi da 3 fonti + flyer, con utenti reali su invito |
| 2 | Lancio pubblico (MVP completo) | Vivi (check-in, ritorno sicuro), notifiche push, badge, Wrapped, app negli store |
| 3 | Crescita | Aggregatori con accordo, nuove aree, accesso social |

## Fase 0 — Fondamenta

**Contenuto**

- Monorepo (ADR-0015): `apps/web` inizializzata con Next.js in export statico, TypeScript
  strict, Tailwind, ESLint, Prettier, Vitest, Playwright; `services/worker` con uv, Ruff,
  mypy strict, pytest; `supabase/` inizializzata con la CLI.
- CI su GitHub Actions: lint, typecheck, test unitari, `supabase test db`, build web, build
  Docker del worker, controllo delle dipendenze, `scripts/verifica_documentazione.py`.
- Progetti Supabase `staging` e `produzione` nella regione di Francoforte, sul piano Free;
  Cloudflare Pages, Cloudflare R2 e il workflow del worker su GitHub Actions (ADR-0021).
- Migrazioni di base: estensioni, enum, schema `private` con le funzioni del DATA_MODEL.md
  §4, `profili`, `profili_privati`, `ruoli_utente`, `consensi`, trigger di registrazione,
  test pgTAP `001_rls_abilitata` e seed con gli utenti di test per età.
- Registrazione, accesso e verifica email funzionanti end-to-end con il controllo dell'età
  (F-10, parte tecnica).
- Design system da Claude Design: token, tipografia, componenti di base e layout di
  navigazione (ADR-0011, [DESIGN.md](DESIGN.md)).
- Struttura del worker: `coda` (prelievo, lease, retry), `ClientHttpConforme`, funzioni di
  `normalizzazione/`, registro degli adattatori, test di architettura, schema e prompt
  iniziali dei flyer, strumenti `fonti.prova`, `fonti.salva_fixture` e `flyer.valuta`.
- Funzioni di supporto ai test `supabase/tests/000_supporto.test.sql`.
- Mappa: file `milano-brianza.pmtiles`, font e icone nel bucket `mappe`; stili Protomaps
  `dark` e `light` personalizzati con i design token; job trimestrale di aggiornamento
  (ADR-0016).
- Shell Capacitor iOS e Android compilabile, con la PWA servita dallo stesso export.
- Pratiche esterne avviate: App Review Meta per Business Discovery, account sviluppatore Apple
  e Google, bozza di termini, informativa e DPIA con un legale (D-07).

**Criteri di completamento**

1. Una PR con una migrazione senza RLS o senza test fa fallire la CI (verificato con una PR di
   prova).
2. `supabase test db` passa con i casi R-01, R-02, R-04, R-05 per tutti gli utenti del seed.
3. Un utente con data di nascita inferiore ai 14 anni non riesce a registrarsi né dall'app né
   chiamando direttamente l'API di Auth (test e2e).
4. L'app si compila in export statico e gira su simulatore iOS, emulatore Android e browser.
5. I token del design system sono in `apps/web/src/styles/tokens.css`, usati dalla
   configurazione di Tailwind e documentati in DESIGN.md.
6. La richiesta di App Review Meta è stata inviata.

La decisione sul dominio (D-01) è spostata ai criteri della Fase 2: fino ad allora si usa
l'ipotesi di lavoro `noxa.app`.

## Fase 1 — Beta chiusa Milano e Brianza

**Funzionalità**: F-01, F-02, F-03, F-04, F-05, F-06, F-10, F-11, F-12, F-13, F-14, F-15,
F-16, F-30, F-40, F-41, F-42, F-43 (PWA + build interne iOS e Android), F-44, F-45.

**Fonti degli eventi** (2–3 fonti più i flyer, come da perimetro):

1. adattatore `sito_jsonld` (siti dei locali con dati strutturati);
2. almeno un adattatore `sito_html_<locale>` per i locali senza dati strutturati;
3. adattatore `instagram_business_discovery`;
4. caricamento flyer con estrazione Claude API e pre-moderazione.

**Criteri di completamento**

1. Almeno 40 locali attivi in `locali` per le province MI e MB, ognuno con almeno una fonte
   `consentita` o raggiungibile tramite flyer.
2. Per 4 settimane consecutive: almeno 150 eventi pubblicati a settimana; correttezza dei
   campi chiave ≥ 95% sul campione mensile; precisione della deduplicazione ≥ 98% sul golden
   set e sul campione (PRD §2).
3. Estrazione dai flyer valutata sul golden set di almeno 50 flyer: data e locale corretti in
   almeno il 90% dei casi, età minima mai più bassa di quella reale (0 errori verso il basso).
4. Tutte le tabelle usate dalle funzionalità della fase hanno test pgTAP per ogni policy,
   inclusi i casi negativi per fascia d'età (DATA_MODEL.md §9).
5. Test e2e Playwright per i percorsi: registrazione, ricerca evento, amicizia per ricerca e
   per codice invito, creazione di un gruppo misto valido e rifiuto di uno non valido, serata
   di gruppo con conferme, voce del tracker, caricamento flyer, segnalazione, esportazione ed
   eliminazione dell'account.
6. Nessuna violazione WCAG 2.2 AA rilevata da axe sulle schermate della fase; verifica
   manuale con VoiceOver e TalkBack sui percorsi del punto 5.
7. Beta con almeno 200 utenti su invito, di cui almeno 50 minorenni con il consenso
   informato previsto dall'informativa; zero incidenti di sicurezza aperti; il 95% delle
   segnalazioni gestite nei tempi di R-53.
8. Ogni funzionalità della fase ha superato la skill `safety-review`, con l'esito registrato
   nella PR.

## Fase 2 — Lancio pubblico (MVP completo)

**Funzionalità**: F-20, F-21, F-22, F-31, F-32, F-33, F-43 (pubblicazione negli store), più
il consolidamento di tutte le funzionalità della Fase 1.

**Contenuto aggiuntivo**

- Plugin di geolocalizzazione in background scelto (D-04) e testato su dispositivi reali iOS
  e Android, con l'app in background e con lo schermo bloccato.
- Notifiche push per Android, iOS e web.
- DPIA definitiva, informativa e termini definitivi, nomina del DPO se richiesta (D-07).
- Penetration test esterno su app, API Supabase ed Edge Functions.
- Test di carico: 100.000 utenti sintetici, 5.000 eventi futuri, 500 ritorni sicuri
  simultanei.

**Criteri di completamento**

1. Ritorno sicuro: su 20 prove reali per piattaforma (iOS e Android) con l'app in background
   per almeno 30 minuti, la posizione arriva ai destinatari con un intervallo massimo di 2
   minuti nel 95% del tempo; l'allerta parte entro 2 minuti dall'arrivo previsto superato nel
   100% delle prove.
2. Test pgTAP di R-30, R-31 e R-41 superati; nessuna posizione più vecchia di 24 ore dalla
   fine della sessione presente nel database (query di verifica in CI su staging).
3. Penetration test senza vulnerabilità di gravità alta o critica aperte.
4. DPIA approvata; termini e informativa pubblicati; questionari di età degli store compilati
   (D-06).
5. App approvate su App Store e Google Play; PWA in produzione.
6. Test di carico: `cerca_eventi` < 800 ms al 95° percentile; nessun errore Realtime sopra
   l'1%.
7. Crash-free sessions ≥ 99,5% nell'ultima settimana di beta.
8. Wrapped (F-33) e badge (F-32), se presenti nel rilascio, verificati con `safety-review`
   (R-41, R-42); se in ritardo, il lancio procede senza (sono P1).
9. La decisione D-01 (dominio) è chiusa prima della pubblicazione negli store e gli ADR e i
   documenti che citano `noxa.app` sono aggiornati (DECISIONI_APERTE.md).

## Fase 3 — Crescita

**Funzionalità**: F-07 (aggregatori con accordo), F-17 (accesso con Apple e Google), F-46
(nuove aree geografiche).

**Criteri di completamento**

1. Per ogni aggregatore attivato: accordo scritto o API ufficiale archiviati e citati in
   `fonti.note_conformita`; ADR di integrazione accettato.
2. Accesso social: impossibile creare un profilo senza data di nascita (test e2e);
   esperienza conforme alle linee guida Apple (Sign in with Apple presente se è presente
   Google).
3. Nuova area: almeno 30 locali verificati e le soglie di qualità del PRD §2 rispettate per 4
   settimane.

## 5. Iterazioni

Le fasi sono divise in **15 iterazioni** (da 0 a 14). Ogni iterazione è un blocco di lavoro
completo e verificabile che si esegue con il comando `/iterazione <numero>` (skill
`iterazione`). Lo stato di ogni iterazione e il numero di cicli di revisione fatti sono in
[REGISTRO_ITERAZIONI.md](REGISTRO_ITERAZIONI.md).

Ogni iterazione ha:
- **Design**: le schermate da preparare in Claude Design e salvare in `design/` **prima** di
  lanciarla (DESIGN.md §1). Senza questi materiali l'iterazione si ferma all'inizio.
- **Prerequisiti esterni**: account, chiavi o accordi che servono. Se mancano, il lavoro
  locale si completa lo stesso e l'iterazione viene chiusa come "completata con attese
  esterne"; la fase però non si chiude finché le attese non sono risolte.
- **Criteri di completamento**: tutti verificati prima di chiuderla. L'ultima iterazione di
  ogni fase verifica anche i criteri della fase.

| N | Fase | Nome | Funzionalità | Design da preparare prima |
|---|---|---|---|---|
| 0 | 0 | Fondamenta del repository | infrastruttura | — |
| 1 | 0 | Design system e guscio dell'app | F-43, F-45, F-02 (stile mappa) | **Design system Noxa**, navigazione, stile della mappa |
| 2 | 0 | Account e sicurezza di base | F-10, F-41 (consensi) | Accesso e onboarding |
| 3 | 1 | Amicizie, blocchi e segnalazioni | F-11, F-12, F-42 (bloccati) | Amici, profilo, segnala e blocca |
| 4 | 1 | Catalogo eventi e scoperta | F-01, F-02, F-03, F-04, F-05 | Scopri: elenco, filtri, mappa, dettaglio |
| 5 | 1 | Raccolta automatica degli eventi | F-44, F-40 (locali e fonti) | Moderazione: locali e fonti |
| 6 | 1 | Flyer e moderazione | F-06, F-40, F-10 (foto profilo) | Carica flyer, stato flyer, code di moderazione, foto profilo |
| 7 | 1 | Gruppi e serate di gruppo | F-13, F-14, F-15, F-16 | Gruppi, dettaglio gruppo, serata di gruppo |
| 8 | 1 | Tracker, privacy e beta | F-30, F-41, F-42, F-45, F-43 (build interne) | Tracker, impostazioni di privacy, esporta ed elimina account |
| 9 | 2 | Notifiche e check-in | F-22, F-20 | Centro notifiche, permessi, check-in |
| 10 | 2 | Ritorno sicuro | F-21 | Avvio, ritorno in corso, ritorno di un amico, allerta |
| 11 | 2 | Statistiche, badge e Wrapped | F-31, F-32, F-33 | Statistiche, bacheca badge, schede del Wrapped |
| 12 | 2 | Preparazione al lancio | F-43 (store), consolidamento | Icona, schermate e testi per gli store |
| 13 | 3 | Accesso con Apple e Google | F-17 | Accesso social e completamento del profilo |
| 14 | 3 | Aggregatori e nuove aree | F-07, F-46 | — |

### Iterazione 0 — Fondamenta del repository
- **Contenuto**: monorepo pnpm + uv; `apps/web` con Next.js in export statico, TypeScript
  strict, Tailwind, ESLint, Prettier, Vitest, Playwright; `services/worker` con
  `pyproject.toml`, `uv.lock`, Ruff, mypy strict, pytest, FastAPI con `/salute` e `/pronto`,
  modulo `coda`; `supabase init` con estensioni e schema `private` vuoto; CI GitHub Actions
  (lint, typecheck, test, `supabase test db`, build, Docker, audit dipendenze,
  `scripts/verifica_documentazione.py`); `.nvmrc`, `.python-version`.
- **Prerequisiti esterni**: repository GitHub remoto per la CI; progetti Supabase staging e
  produzione, Cloudflare Pages e R2 per i deploy (ADR-0021).
- **Criteri**: `pnpm --filter web build` produce l'export statico; `docker compose up worker`
  risponde su `/salute`; `supabase start` e `supabase test db` funzionano; la CI è verde su
  una PR di prova e fallisce su una PR con una tabella senza RLS.

### Iterazione 1 — Design system e guscio dell'app
- **Contenuto**: `tokens.css` dai design token di Claude Design (tema scuro e chiaro)
  collegato a Tailwind; componenti di `src/components/ui/` (DESIGN.md §3) con test; catalogo
  `page.dev.tsx`; layout di navigazione delle aree Scopri, Organizza, Vivi, Ricorda,
  Profilo; PWA (manifest, service worker); Capacitor iOS e Android; mappa Protomaps con file
  `milano-brianza.pmtiles`, font e icone nel bucket `mappe` e stili personalizzati
  (ADR-0016); scheda evento con spazio per la foto del locale e velatura al posto del blocco
  colorato del design (ADR-0018); axe nei test e2e.
- **Prerequisiti esterni**: account Apple Developer e Google Play Console per firmare le
  build (le build locali funzionano anche senza).
- **Criteri**: nessuna violazione axe nel catalogo e nella navigazione, in entrambi i temi;
  l'app gira su browser, emulatore Android e simulatore iOS; la mappa si apre senza
  richieste a domini esterni (verificato nel test e2e).

### Iterazione 2 — Account e sicurezza di base
- **Contenuto**: migrazioni di `profili`, `profili_privati`, `ruoli_utente`, `consensi` e delle
  funzioni `private.*` per età e fascia (DATA_MODEL.md §4); trigger di registrazione (R-01,
  R-02); `000_supporto.test.sql` e seed con gli utenti per età (`001_rls_abilitata.test.sql`
  esiste dall'iterazione 0); schermate di accesso, registrazione con CAPTCHA, verifica email, onboarding di
  sicurezza, consensi versionati; client tipizzato ed errori di dominio; Content Security
  Policy della PWA negli header dell'hosting statico (ARCHITECTURE.md §9).
- **Prerequisiti esterni**: chiave Cloudflare Turnstile.
- **Criteri**: criteri della **Fase 0** (§Fase 0) verificati; test e2e che un utente di 13
  anni non può registrarsi né dall'app né dall'API.

### Iterazione 3 — Amicizie, blocchi e segnalazioni
- **Contenuto**: `amicizie`, `codici_invito`, `blocchi`, `segnalazioni`,
  `azioni_moderazione`; RPC `cerca_utenti`, `crea_codice_invito`,
  `anteprima_codice_invito`, `usa_codice_invito`, `avviso_richiesta`; schermate amici,
  ricerca, QR, richieste, profilo, blocca e segnala, elenco dei bloccati.
- **Criteri**: test pgTAP di R-10…R-14 e R-17 per tutte le età, compreso il tentativo di
  elencare `profili`; e2e amicizia per ricerca e per codice con l'avviso al minorenne.

### Iterazione 4 — Catalogo eventi e scoperta
- **Contenuto**: `locali`, `eventi`, `generi_musicali`, `eventi_generi`, `eventi_fonti`,
  `partecipazioni_evento`; colonne della foto in `locali` e bucket `immagini-locali` con le
  policy (ADR-0018, R-56); RPC `cerca_eventi`, che restituisce anche l'immagine di copertina
  secondo l'ordine dell'ADR; dati di esempio nel seed; schermate elenco con filtri, mappa,
  dettaglio, "mi interessa / partecipo", amici che partecipano.
- **Criteri**: test pgTAP di R-20…R-23, R-56 e R-67 per età 14, 15, 16, 17, 18, 20, 21;
  `cerca_eventi` < 800 ms al 95° percentile con 5.000 eventi sintetici.

### Iterazione 5 — Raccolta automatica degli eventi
- **Contenuto**: `fonti`, `eventi_grezzi`, `coda_job`; archivio Postgres della coda
  (implementazione di `ArchivioJob` con `for update skip locked`, test di integrazione) e avvio
  degli esecutori nel lifespan del worker; `ClientHttpConforme`, normalizzazione,
  adattatori `sito_jsonld`, almeno un `sito_html_<locale>`,
  `instagram_business_discovery`; chiave esterna `eventi_fonti.fonte_id` → `fonti`;
  deduplicazione e fusione con golden set; bootstrap dei locali da OSM e Google Places;
  `pg_cron` di accodamento; RPC `esegui_fonte_ora` e `decidi_duplicato`; area di
  moderazione per locali (con caricamento e approvazione della foto, ADR-0018, registrati in
  `azioni_moderazione`), fonti e duplicati; correzione di età e riferimenti all'alcol degli
  eventi da parte dei moderatori con la riga in `azioni_moderazione` (R-22).
- **Prerequisiti esterni**: App Review Meta approvata; chiave Google Places; foto autorizzate
  o con licenza libera dei locali verificati (ADR-0018).
- **Criteri**: test degli adattatori su fixture; precisione della deduplicazione ≥ 98% e
  richiamo ≥ 90% sul golden set; almeno 40 locali verificati.

### Iterazione 6 — Flyer e moderazione
- **Contenuto**: `caricamenti_flyer` (con la chiave esterna di
  `eventi_fonti.caricamento_flyer_id`), bucket `flyer-caricati` (il bucket `flyer-pubblicati`
  e la sua policy di lettura esistono dall'iterazione 4);
  estrattore con Claude API, prompt versionato, golden set di almeno 50 flyer, comando
  `valuta`; RPC `coda_flyer`, `decidi_flyer`, `dettaglio_segnalazione`,
  `decidi_segnalazione`; job `copia_immagine_flyer` e `pulizia_flyer`; schermate di
  caricamento, stato dei flyer e code di moderazione con MFA. Foto profilo (F-10): bucket
  `avatar` con le policy di DATA_MODEL.md §6, caricamento con ritaglio, conversione in WebP
  e rimozione dei dati EXIF sul dispositivo, sostituzione e rimozione, segnalazione e
  rimozione da parte dei moderatori (R-52). Tabella `notifiche` mostrata nell'app con Realtime
  (richieste di amicizia, amicizie accettate, esiti della moderazione con la motivazione,
  R-53) e reclamo sulle decisioni dalla schermata "Le mie segnalazioni" (DSA art. 20).
  Estrattore anche per Instagram (EVENT_INGESTION.md §2.5): didascalia in modalità testo e
  immagine del post quando la didascalia non basta (dall'iterazione 5 la didascalia si legge
  con regole). Valori di `tipo_oggetto_segnalabile` e voci "Flyer" e "Segnalazioni" della
  navigazione dell'area di moderazione, oggi spente con "In arrivo".
- **Prerequisiti esterni**: chiave Claude API con limite di spesa; accordo sul trattamento
  dei dati (D-12).
- **Criteri**: soglie della skill `flyer-parser`; test pgTAP di R-51, R-54, R-69 e delle
  policy del bucket `avatar` (lettura solo con `private.puo_vedere_profilo`, scrittura solo
  nella propria cartella) per tutte le età del seed.

### Iterazione 7 — Gruppi e serate di gruppo
- **Contenuto**: `gruppi`, `membri_gruppo`, `serate_gruppo`, `partecipazioni_serata`;
  invariante delle fasce e job giornaliero, con i trigger su `amicizie` e `blocchi` (R-15);
  `private.puo_vedere_profilo` estesa ai membri dello stesso gruppo; Realtime; schermate di
  gruppi, inviti, serata con conferme, biglietti e trasporto.
- **Criteri**: test pgTAP di R-15, R-16, R-24 e del trigger `verifica_trasporto`; e2e di
  gruppo misto valido e rifiutato; aggiornamento in tempo reale tra due sessioni.

### Iterazione 8 — Tracker, privacy e beta
- **Contenuto**: tabelle del tracker e trigger di R-40; offline con coda di scritture, eventi
  già visti salvati in IndexedDB (dall'iterazione 4 restano in memoria finché l'app è aperta)
  e cache delle tile della mappa già viste (richieste PMTiles a intervalli, ADR-0016); Edge
  Functions `esporta-dati` ed `elimina-account`; impostazioni di privacy;
  `applica_conservazione` completa (dall'iterazione 5 copre già grezzi, job ed esecuzioni
  delle fonti); verifica completa di accessibilità; build interne TestFlight e
  Google Play; Sentry nell'app e nel worker con `beforeSend` (ADR-0014, R-62); link delle
  email di conferma e di recupero aperti nell'app nativa con App Links e Universal Links sul
  dominio di D-01. Infrastruttura di ADR-0021: worker in modalità a esaurimento con il
  workflow `worker.yml`, mappa su Cloudflare R2 (`prepara_mappa.sh` e `mappa.yml`), header di
  sicurezza in `_headers` di Cloudflare Pages al posto di `vercel.json`, SMTP Brevo, fornitori
  aggiornati nella pagina `/privacy` con una nuova versione dell'informativa; decisione sui
  backup (D-14) e sugli account degli store (D-13).
- **Criteri**: criteri della **Fase 1** (§Fase 1) verificati per la parte tecnica; la beta
  con utenti reali si avvia alla chiusura di questa iterazione.

### Iterazione 9 — Notifiche e check-in
- **Contenuto**: `dispositivi_push`, Edge Function `invia-push` (FCM, APNs, Web Push),
  permessi e preferenze; `checkin`, `checkin_destinatari`, trigger `verifica_checkin`.
- **Prerequisiti esterni**: progetto Firebase, chiavi APNs, chiavi VAPID.
- **Criteri**: test pgTAP di R-30; nessun testo di altri utenti nelle notifiche (test).

### Iterazione 10 — Ritorno sicuro
- **Contenuto**: plugin di posizione in background (D-04), `ritorni_sicuri`,
  `ritorni_destinatari`, `posizioni_ritorno`, Broadcast privato, `verifica_ritorni_scaduti`,
  area di arrivo salvata solo sul dispositivo, modalità solo in primo piano nella PWA.
- **Criteri**: test pgTAP di R-31 e R-32; prove su dispositivi reali secondo il criterio 1
  della Fase 2.

### Iterazione 11 — Statistiche, badge e Wrapped
- **Contenuto**: vista `statistiche_personali`; catalogo dei badge e `assegna_badge`;
  `genera_riepiloghi` e `rigenera_mio_riepilogo`; Wrapped con esportazione dell'immagine
  sul dispositivo.
- **Criteri**: test pgTAP di R-41 e R-42; `safety-review` del catalogo dei badge.

### Iterazione 12 — Preparazione al lancio
- **Contenuto**: correzioni del penetration test, test di carico, DPIA e testi legali
  definitivi, questionari degli store (D-06), pubblicazione su App Store e Google Play.
- **Prerequisiti esterni**: penetration test esterno, consulente legale.
- **Criteri**: criteri della **Fase 2** (§Fase 2) verificati.

### Iterazione 13 — Accesso con Apple e Google
- **Contenuto**: ADR per il profilo da completare; provider OAuth; completamento obbligatorio
  della data di nascita prima di qualsiasi accesso ai dati.
- **Criteri**: criterio 2 della Fase 3.

### Iterazione 14 — Aggregatori e nuove aree
- **Contenuto**: adattatori degli aggregatori con accordo (D-05); estensione di
  `locali.provincia` e bootstrap dei locali della nuova area.
- **Criteri**: criteri 1 e 3 della **Fase 3**.

## 6. Definizione di completato

Una funzionalità è completa quando:

1. il PRD contiene la funzionalità con i criteri di accettazione e la riga nella matrice di
   tracciabilità;
2. DATA_MODEL.md, ARCHITECTURE.md e gli eventuali ADR sono aggiornati;
3. le migrazioni hanno RLS e test pgTAP positivi e negativi (skill `db-migration`);
4. il codice è tipizzato (TypeScript strict, mypy strict), con gestione degli errori e
   logging secondo ARCHITECTURE.md §5.2 e §8;
5. esistono test unitari e, per i percorsi utente, test e2e; la CI è verde;
6. l'interfaccia rispetta WCAG 2.2 AA e DESIGN.md (skill `implement-design`);
7. la skill `safety-review` è stata superata e l'esito è riportato nella PR;
8. la revisione del codice è stata approvata da almeno un'altra persona.
