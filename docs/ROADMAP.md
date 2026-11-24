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
- Progetti Supabase `staging` (Irlanda, `eu-west-1`) e `produzione` (Francoforte), sul piano Free;
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
- Pratiche esterne avviate: app Meta per Business Discovery (in modalità sviluppo, senza App
  Review: EVENT_INGESTION.md §2.5), account sviluppatore Apple e Google, bozza di termini,
  informativa e DPIA con un legale (D-07).

**Criteri di completamento**

1. Una PR con una migrazione senza RLS o senza test fa fallire la CI (verificato con una PR di
   prova).
2. `supabase test db` passa con i casi R-01, R-02, R-04, R-05 per tutti gli utenti del seed.
3. Un utente con data di nascita inferiore ai 14 anni non riesce a registrarsi né dall'app né
   chiamando direttamente l'API di Auth (test e2e).
4. L'app si compila in export statico e gira su simulatore iOS, emulatore Android e browser.
5. I token del design system sono in `apps/web/src/styles/tokens.css`, usati dalla
   configurazione di Tailwind e documentati in DESIGN.md.
6. L'app Meta è configurata e Business Discovery risponde con il token di sistema del worker
   (l'App Review non serve: EVENT_INGESTION.md §2.5).

La decisione sul dominio (D-01) è stata chiusa il 2026-11-10 con la creazione dello staging:
`noxanight.it`.

## Fase 1 — Beta chiusa Milano e Brianza

**Funzionalità**: F-01, F-02, F-03, F-04, F-05, F-06, F-10, F-11, F-12, F-13, F-14, F-15,
F-16, F-30, F-40, F-41, F-42, F-43 (PWA; app Android con APK di debug, ADR-0027), F-44, F-45.

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

**Funzionalità**: F-20, F-21, F-22, F-23, F-31, F-32, F-33, F-43 (pubblicazione negli store), più
il consolidamento di tutte le funzionalità della Fase 1. La pubblicazione su Google Play è
l'ultimo passo, a funzionalità complete; App Store solo se D-13 si chiude per Apple
(ADR-0027).

**Contenuto aggiuntivo**

- Piano di crescita del 2026-11-24 (iterazioni 13–16): scoperta e abitudine, amici e inviti,
  sito e pagine per la ricerca, misure per i locali e per chi investe, prima del lancio.
- Plugin `@capacitor-community/background-geolocation` (ADR-0027) testato su dispositivi
  reali Android, con l'app in background e con lo schermo bloccato; iOS se D-13 si chiude.
- Notifiche push per Android (FCM) e web; APNs con iOS.
- DPIA definitiva, informativa e termini definitivi, nomina del DPO se richiesta (D-07).
- Penetration test esterno su app, API Supabase ed Edge Functions.
- Test di carico: 100.000 utenti sintetici, 5.000 eventi futuri, 500 ritorni sicuri
  simultanei.

**Criteri di completamento**

1. Ritorno sicuro: su 20 prove reali per piattaforma nativa (Android; iOS se D-13 si chiude) con l'app in background
   per almeno 30 minuti, la posizione arriva ai destinatari con un intervallo massimo di 2
   minuti nel 95% del tempo; l'allerta parte entro 2 minuti dall'arrivo previsto superato nel
   100% delle prove.
2. Test pgTAP di R-30, R-31 e R-41 superati; nessuna posizione più vecchia di 24 ore dalla
   fine della sessione presente nel database (query di verifica in CI su staging).
3. Penetration test senza vulnerabilità di gravità alta o critica aperte.
4. DPIA approvata; termini e informativa pubblicati; questionario di età di Google Play
   compilato (D-06).
5. App approvata su Google Play (e su App Store se D-13 si chiude); PWA in produzione.
6. Test di carico: `cerca_eventi` < 800 ms al 95° percentile; nessun errore Realtime sopra
   l'1%.
7. Crash-free sessions ≥ 99,5% nell'ultima settimana di beta.
8. Wrapped (F-33) e badge (F-32), se presenti nel rilascio, verificati con `safety-review`
   (R-41, R-42); se in ritardo, il lancio procede senza (sono P1).
9. Il dominio `noxanight.it` (D-01) serve l'app di produzione con HTTPS, le email partono da
   un mittente del dominio e gli App Links di Android sono verificati.

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

Le fasi sono divise in **20 iterazioni** (da 0 a 19). Ogni iterazione è un blocco di lavoro
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
| 8 | 1 | Tracker, privacy e beta | F-30, F-41, F-42, F-45, F-43 (PWA) | Tracker, impostazioni di privacy, esporta ed elimina account |
| 9 | 2 | Notifiche e check-in | F-22, F-20 | Centro notifiche, permessi, check-in |
| 10 | 2 | Ritorno sicuro | F-21, F-43 (app Android) | Avvio, ritorno in corso, ritorno di un amico, allerta |
| 11 | 2 | Statistiche, badge e Wrapped | F-31, F-32, F-33 | Statistiche, bacheca badge, schede del Wrapped |
| 12 | 2 | Consolidamento prima della beta | F-23 (gestione dall'area di moderazione; primo rilascio fuori iterazione il 2026-11-15, ADR-0034), consolidamento | Momenti di riscontro (`design/F-01-rinfresco-interfaccia/` §4); icona, schermata di apertura e anteprima dei link (`design/store/`) |
| 13 | 2 | Crescita: scoperta e abitudine | F-01, F-03, F-05, F-10 (preferenze), F-22 (weekend), F-30, F-33 | Tavole preparate da Claude in `design/F-01-crescita-scoperta/` |
| 14 | 2 | Crescita: amici e inviti | F-11, F-13, F-14 | Tavole preparate da Claude in `design/F-11-amici-e-inviti/` |
| 15 | 2 | Sito e pagine per la ricerca | F-01 (pagine pubbliche), sito | Tavole preparate da Claude in `design/F-01-sito-pubblico/` |
| 16 | 2 | Misure per i locali e per chi investe | F-40 (cruscotto), F-04 (interessati) | Tavole preparate da Claude in `design/F-40-misure/` |
| 17 | 2 | Produzione, beta e lancio | F-43 (Google Play), beta della Fase 1 | Schermate e testi per Google Play (`design/store/`) |
| 18 | 3 | Accesso con Apple e Google | F-17 | Accesso social e completamento del profilo |
| 19 | 3 | Aggregatori e nuove aree | F-07, F-46 | — |

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
- **Prerequisiti esterni**: nessuno; le build locali non richiedono account (Google Play
  solo nell'iterazione 17, ADR-0027).
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
- **Prerequisiti esterni**: app Meta e token di sistema del worker; chiave Google Places; foto autorizzate
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
  e cache delle tile della mappa già viste (richieste PMTiles a intervalli, ADR-0016); RPC
  `esporta_miei_dati` ed Edge Function `elimina-account` (ADR-0025); impostazioni di privacy;
  `applica_conservazione` completa (dall'iterazione 5 copre già grezzi, job ed esecuzioni
  delle fonti, dall'iterazione 6 notifiche e registro dei caricamenti; mancano tra l'altro
  segnalazioni e azioni di moderazione a 12 mesi dalla chiusura, SAFETY_PRIVACY.md
  §10); verifica completa di accessibilità; Sentry nell'app e nel worker con `beforeSend`
  (ADR-0014, R-62). Infrastruttura di ADR-0021: worker in modalità a esaurimento con il
  workflow `worker.yml`, mappa su Cloudflare R2 (`prepara_mappa.sh` e `mappa.yml`), header di
  sicurezza in `_headers` di Cloudflare Pages al posto di `vercel.json`, SMTP Brevo, fornitori
  aggiornati nella pagina `/privacy` con una nuova versione dell'informativa; backup notturno
  cifrato su R2 (D-14 chiusa con ADR-0025). La beta parte dalla sola PWA: l'app Android e
  i link delle email nell'app nativa passano all'iterazione 10 (ADR-0027).
- **Criteri**: criteri della **Fase 1** (§Fase 1) verificati per la parte tecnica; la beta
  con utenti reali si avvia alla chiusura di questa iterazione.

### Iterazione 9 — Notifiche e check-in
- **Contenuto**: `dispositivi_push`, Edge Function `invia-push` (FCM, APNs, Web Push),
  permessi e preferenze; `checkin`, `checkin_destinatari`, trigger `verifica_checkin`.
- **Prerequisiti esterni**: chiavi VAPID per il Web Push, gratuite e generate in locale; la
  beta è solo PWA, quindi il progetto Firebase arriva con l'app Android dell'iterazione 10
  (ADR-0027) e le chiavi APNs solo se D-13 si chiude per Apple.
- **Design**: `design/F-22-notifiche/` e `design/F-20-checkin/`.
- **Criteri**: test pgTAP di R-30; nessun testo di altri utenti nelle notifiche, né nomi né
  username nei testi sulla schermata di blocco (test).

### Iterazione 10 — Ritorno sicuro
- **Contenuto**: plugin `@capacitor-community/background-geolocation` (ADR-0027),
  `ritorni_sicuri`, `ritorni_destinatari`, `posizioni_ritorno`, Broadcast privato,
  `verifica_ritorni_scaduti`, area di arrivo salvata solo sul dispositivo, modalità solo in
  primo piano nella PWA. App Android installata sui telefoni del team con l'APK di debug
  (nessun account Google Play) e notifiche native con FCM in `invia-push`; link delle email
  di conferma e di recupero aperti nell'app con gli App Links, con il dominio `noxanight.it` (D-01).
- **Prerequisiti esterni**: progetto Firebase gratuito per FCM; un telefono Android per le
  prove. Nessun account degli store (ADR-0027).
- **Criteri**: test pgTAP di R-31 e R-32; prove su dispositivi Android reali secondo il
  criterio 1 della Fase 2.

### Iterazione 11 — Statistiche, badge e Wrapped
- **Contenuto**: RPC `mie_statistiche` (al posto della vista prevista); catalogo dei badge e `assegna_badge`;
  `genera_riepiloghi` e `rigenera_mio_riepilogo`; Wrapped con esportazione dell'immagine
  sul dispositivo.
- **Criteri**: test pgTAP di R-41 e R-42; `safety-review` del catalogo dei badge.

### Iterazione 12 — Consolidamento prima della beta
- **Perimetro**: solo lavoro di codice, provato in locale e su staging. Nessun ambiente di
  produzione, nessun account degli store, nessuna pubblicazione: sono nell'iterazione 17.
  L'iterazione 12 è stata divisa in due il 2026-11-23, su richiesta del product owner, che ha
  altro da sistemare prima della pubblicazione.
- **Contenuto** (in gran parte proposto il 2026-11-14 e il 2026-11-15, REGISTRO_INTERVENTI.md):
  - eliminazione degli account senza accessi da 24 mesi, con l'avviso via email 30 giorni
    prima (SAFETY_PRIVACY.md §10): nessun account della beta può arrivarci prima;
  - link di biglietti e fonti solo `https` (migrazione su `eventi.url_biglietti`,
    `eventi_fonti.url_originale`, `locali.sito_web`, con i test pgTAP);
  - momenti di riscontro del rinfresco (amicizia confermata, gruppo creato, serata confermata
    da tutti), dopo le tavole di `design/F-01-rinfresco-interfaccia/brief.md` §4;
  - libreria delle foto d'atmosfera portata ad almeno 120 foto e nessuna foto ripetuta nello
    stesso elenco (ADR-0032); controllo umano di ogni foto a piena risoluzione;
  - icona, schermata di apertura e anteprima dei link definitive da Claude Design
    (`design/store/`), con il carattere del marchio; progetto Claude Design riallineato al
    rinfresco e allo stile iOS (ADR-0035);
  - prova dell'apertura, del Benvenuto, delle copertine e di «Salva immagine» del riepilogo
    (attesa dell'iterazione 11) su telefoni reali con l'app di staging: iPhone con la PWA,
    Android con l'APK di debug; se il salvataggio non funziona nell'app Android, plugin di
    condivisione di Capacitor;
  - repository privato o segreti del worker in un environment protetto; esito della prima
    analisi CodeQL;
  - dopo l'analisi delle schermate del 2026-11-14: layout desktop a più colonne anche per
    Organizza, Vivi, Ricorda e Profilo (ADR-0033); carattere monospazio solo per orari e date;
    «Privacy e dati» più leggibile; titoli delle pagine allineati ai nomi delle aree; tinta
    delle foto d'atmosfera per il tema chiaro; identità visiva dei gruppi (colore o copertina);
  - dopo gli interventi del 2026-11-15: gestione di `servizi_trasporto` dall'area di
    moderazione con la data di verifica (F-23, ADR-0034); verifica su fonte ufficiale di
    02 7777 e 02 6969 (Milano), dell'età minima di FreeNow e itTaxi e dei treni notturni
    Trenord, prima di aggiungerli all'elenco; pagina in italiano della rete notturna ATM;
    adattatori o Instagram per i locali senza pagina della serata. L'età predefinita per locale
    è stata scartata il 2026-11-23 con il product owner: servirebbe solo ad abbassare l'età delle
    serate che non la dichiarano, la direzione più rischiosa per i minorenni, e il worker legge
    già l'età dalla pagina di ogni serata (R-21 resta com'è);
  - decisioni D-19 (tono dei testi) e D-18 (pagine evento pubbliche): se D-18 si chiude per la
    pagina pubblica, la si realizza qui con il suo ADR.
- **Prerequisiti esterni**: nessun account; un iPhone e un telefono Android per le prove.
- **Criteri**: ogni voce del contenuto è fatta oppure spostata, con il motivo, in questa
  ROADMAP o in DECISIONI_APERTE.md; migrazioni con RLS e test pgTAP; criteri 4, 5, 6 (parte
  automatica con axe) e 8 della **Fase 1** verificati; tutto online su staging.

### Iterazione 13 — Crescita: scoperta e abitudine
- **Perimetro**: piano di crescita del 2026-11-24 (REGISTRO_INTERVENTI.md), prima parte. Solo
  funzioni che non cambiano le regole di sicurezza: rendono Noxa utile da soli, dal primo
  giorno, e danno un motivo per tornare ogni settimana senza pressione (R-43). Ogni
  funzionalità nuova passa da `new-feature` (PRD, matrice, ARCHITECTURE, DATA_MODEL).
- **Contenuto**:
  - **preferenze all'ingresso**: dopo l'onboarding due domande saltabili, i generi preferiti
    (salvati in `profili_privati`, leggibili solo dal titolare) e il comune di partenza
    (solo sul dispositivo, R-33); Scopri mette prima le serate dei generi scelti; si cambiano
    da Profilo. Nuovo dato personale: SAFETY_PRIVACY.md §10 e l'esportazione (R-64) aggiornati;
  - **il weekend di Noxa**: pagina con fino a 8 serate del fine settimana scelte per i generi
    preferiti e una notifica facoltativa, **disattivata di default**, il giovedì alle 18, al
    massimo una alla settimana, con un testo di sistema senza nomi (F-22, R-43); job in
    `pg_cron` (ADR-0003);
  - **«Nuova»** sulle serate pubblicate dopo l'ultima visita (data dell'ultima visita solo sul
    dispositivo) e **«Lasciami sorprendere»**: una serata a caso tra quelle filtrate, con un
    tocco, senza animazioni da estrazione né premi;
  - **«Aggiungi al calendario»**: file `.ics` generato sul dispositivo dal dettaglio di una
    serata con «Mi interessa» o «Partecipo» e dalla serata di gruppo, con il link alla
    pagina di Noxa e nessun dato di altre persone;
  - **stati vuoti che invitano**: amici, gruppi e diario vuoti mostrano un'azione concreta
    (il proprio codice invito, crea un gruppo, «Ero a questo evento»);
  - **mappa dei tuoi locali** in Ricorda: i locali delle voci del diario sulla mappa, solo per
    il titolare (F-30, R-40), con l'elenco testuale come alternativa accessibile;
  - **dominio nel Wrapped**: `noxanight.it` scritto nell'immagine esportata accanto al marchio
    (testo, non link), dopo la verifica di R-42 con `safety-review`.
- **Prerequisiti esterni**: nessuno.
- **Criteri**: test unitari ed e2e delle nuove schermate, axe in entrambi i temi, pgTAP per le
  preferenze (solo il titolare legge e scrive, tutte le età del seed); `safety-review` con
  attenzione a R-33 e R-43; tutto online su staging.

### Iterazione 14 — Crescita: amici e inviti
- **Perimetro**: seconda parte del piano di crescita. Il passaparola nasce dagli inviti tra
  persone che si conoscono; le regole R-10…R-15 restano il confine. Modifiche alle regole solo
  con gli ADR indicati, accettati dal product owner prima di iniziare.
- **Contenuto**:
  - **amici in comune e numero di amici** ([ADR-0037](decisions/0037-amici-in-comune-e-numero-di-amici.md)):
    sul profilo di una persona che si può già vedere, gli amici in comune con avatar e nome;
    il numero di amici visibile solo agli amici confermati, da 5 in su, mai l'elenco,
    nascosto di default per chi ha 14–17 anni; RPC `security definer` con test pgTAP;
  - **link di amicizia di 48 ore** tra persone della stessa fascia (D-22,
    [ADR-0038](decisions/0038-link-di-amicizia-nella-stessa-fascia.md)): chi non ha un account
    si iscrive e torna al link; tra fasce diverse resta solo il codice di 15 minuti (R-12);
  - **invito al gruppo con link** (D-23,
    [ADR-0039](decisions/0039-invito-al-gruppo-con-link.md)): anteprima senza nomi, richiesta
    di ingresso approvata da un admin, invariante delle fasce verificata nel database (R-15);
  - condivisione nativa del link (foglio di condivisione del sistema) dagli stati vuoti
    dell'iterazione 13.
- **Prerequisiti esterni**: nessuno; D-22 e D-23 chiuse dal product owner.
- **Criteri**: test pgTAP positivi e negativi per tutte le età del seed su ogni RPC nuova
  (compresi un adulto che usa il link di un minorenne e un gruppo misto); e2e degli inviti con
  Supabase locale; SAFETY_PRIVACY.md aggiornato con le regole modificate; `safety-review`.

### Iterazione 15 — Sito e pagine per la ricerca
- **Perimetro**: terza parte del piano di crescita. Il sito porta persone dai motori di
  ricerca e dai link condivisi, e parla anche ai genitori e ai locali. Le pagine mostrano solo
  i dati ridotti dell'elenco pubblico (ADR-0036): i dettagli restano agli iscritti.
- **Contenuto**:
  - **pagine statiche delle serate, dei locali e dei generi** (D-24,
    [ADR-0040](decisions/0040-pagine-pubbliche-per-la-ricerca.md)): generate a ogni
    pubblicazione e una volta al giorno (sveglia da `pg_cron`, come ADR-0031), con i dati
    strutturati schema.org `Event`, la mappa del sito e l'anteprima del link per serata;
    serate con riferimenti all'alcol come «Serata 18+», fuori dall'indice;
  - **pagina iniziale del sito**: promessa in una riga, serate di stasera, schermate dell'app,
    come installarla, collegamenti a genitori e locali;
  - **«Per i genitori»**: le regole sui minorenni, il ritorno sicuro, l'assenza di chat e
    pubblicità, in linguaggio semplice, con le domande frequenti;
  - **«Per i locali»**: come finire su Noxa (sito, Instagram, flyer), le regole dei contenuti
    (R-23, R-44) e un indirizzo email del dominio per scrivere; nessun modulo che raccolga dati;
  - «Condividi il link» dal dettaglio di una serata usa la pagina pubblica quando esiste.
- **Prerequisiti esterni**: nessuno; D-24 chiusa dal product owner.
- **Criteri**: test della generazione (nessun titolo né genere per le serate con alcol, nessun
  dato degli utenti), Lighthouse SEO e accessibilità ≥ 95 sulle pagine pubbliche, validatore
  dei dati strutturati di Google senza errori, axe; `safety-review`.

### Iterazione 16 — Misure per i locali e per chi investe
- **Perimetro**: ultima parte del piano di crescita. Chi valuta Noxa (un locale, un PR, un
  investitore) chiede numeri: si calcolano nel database in forma aggregata (R-62), senza
  strumenti di terze parti e senza dati di singole persone.
- **Contenuto**:
  - **cruscotto delle metriche** del PRD §2 nell'area di moderazione, solo per i moderatori
    con due fattori: utenti attivi settimanali, attivazione (prima serata di gruppo entro 7
    giorni), retention a 4 settimane per coorte, serate di gruppo ogni 100 utenti, quota con
    almeno un amico; nessun valore sotto le 10 persone;
  - **interessati in forma aggregata** sulle serate e **clic sui biglietti contati** (D-25,
    [ADR-0041](decisions/0041-interessati-aggregati-e-clic-sui-biglietti.md)): fasce «più di
    10, 25, 50, 100», nessun nome; contatore dei clic senza identificativo di chi clicca;
  - **rapporto per i locali**: esportazione dall'area di moderazione, per locale e per mese,
    di serate pubblicate, interessati e clic sui biglietti, solo valori aggregati;
  - **scheda per chi investe** (`docs/SCHEDA_PRODOTTO.md`): problema, utenti, metriche con la
    definizione, costi mensili (ADR-0021), conformità (DSA, GDPR, regole R-xx), rischi aperti
    da DECISIONI_APERTE.md e ipotesi di ricavo da D-11, senza pubblicità (R-61).
- **Prerequisiti esterni**: nessuno; D-25 chiusa dal product owner.
- **Criteri**: test pgTAP delle RPC del cruscotto (solo moderatori con `aal2`, nessun valore
  sotto soglia) e dei contatori (nessuna colonna con l'utente); e2e del cruscotto e del
  rapporto; `safety-review`.

### Iterazione 17 — Produzione, beta e lancio
- **Perimetro**: si avvia solo quando il product owner decide che l'app è pronta per essere
  pubblicata, di norma dopo le iterazioni 13–16 (era la 13 fino al 2026-11-24). Contiene tutto ciò che richiede la produzione, gli utenti reali o gli store.
- **Contenuto**:
  - ambiente di produzione (Supabase a Francoforte, Cloudflare Pages e R2, Brevo, Sentry) con
    la procedura di GUIDA_OPERATIVA.md §9, prima della beta;
  - beta chiusa con utenti su invito (criterio 7 della Fase 1), con la moderazione
    organizzata (D-10) e, se i flyer usano Claude API, l'accordo con Anthropic (D-12);
  - fonti per arrivare ai 40 locali della Fase 1: adattatori o Instagram per i locali senza
    pagina della serata (skill `add-event-source`, una verifica di conformità per sito;
    rimandato dall'iterazione 12, dove serviva il codice e non i dati);
  - libreria delle foto d'atmosfera ad almeno 120 foto: la scelta e il controllo a piena
    risoluzione li fa una persona del team (R-56); dall'iterazione 12 il codice non ripete la
    stessa foto nello stesso elenco;
  - numeri e app di trasporto ancora da verificare su fonte ufficiale (02 7777, 02 6969,
    FreeNow, itTaxi, treni notturni Trenord): li aggiunge un moderatore dall'area di
    moderazione (iterazione 12), dopo averli letti sul sito ufficiale; le pagine del Comune di
    Milano non si leggono con uno strumento automatico e quella italiana della rete notturna
    ATM non esiste (resta il link alla versione inglese);
  - scadenza delle sessioni dei moderatori quando il piano di Supabase la consente;
  - correzioni del penetration test, test di carico, DPIA e testi legali definitivi (D-07,
    D-21);
  - prove reali del ritorno sicuro e delle notifiche (criterio 1 della Fase 2);
  - account Apple Developer e pubblicazione su App Store se D-13 si chiude prima del lancio, come
    proposto il 2026-11-24;
  - come ultimo passo: account Google Play Console (25 $ una tantum), test chiuso richiesto da
    Google (12 tester per 14 giorni con un account personale), dichiarazione della posizione in
    background, questionario d'età (D-06) e pubblicazione su Google Play (ADR-0027); App Store
    solo se D-13 si chiude per Apple.
- **Prerequisiti esterni**: penetration test esterno, consulente legale, account dei servizi
  di produzione e di Google Play Console, tester per il test chiuso.
- **Criteri**: criteri della **Fase 1** ancora aperti e criteri della **Fase 2** (§Fase 2)
  verificati.

### Iterazione 18 — Accesso con Apple e Google
- **Contenuto**: ADR per il profilo da completare; provider OAuth; completamento obbligatorio
  della data di nascita prima di qualsiasi accesso ai dati.
- **Criteri**: criterio 2 della Fase 3.

### Iterazione 19 — Aggregatori e nuove aree
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
5. esistono test unitari e, per i percorsi utente, test e2e che passano su Chrome (telefono e
   computer), Safari su iPhone (WebKit) e Firefox; la CI è verde;
6. l'interfaccia rispetta WCAG 2.2 AA e DESIGN.md (skill `implement-design`);
7. la skill `safety-review` è stata superata e l'esito è riportato nella PR;
8. la revisione del codice è stata approvata da almeno un'altra persona.
