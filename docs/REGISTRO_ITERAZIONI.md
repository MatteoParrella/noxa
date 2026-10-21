# Registro delle iterazioni

Stato di avanzamento delle 15 iterazioni definite in [ROADMAP.md](ROADMAP.md) §5. Il file è
aggiornato **dalla skill `iterazione`** all'inizio e alla fine di ogni iterazione; a mano si
modifica solo per correggere un errore, spiegandolo nelle note.

Stati possibili:

| Stato | Significato |
|---|---|
| `da iniziare` | Non ancora avviata |
| `in corso` | Avviata e non ancora chiusa |
| `completata` | Tutti i criteri di completamento verificati |
| `completata con attese esterne` | Tutto il lavoro locale è completo e verificato; mancano solo prerequisiti esterni (account, chiavi, accordi, revisioni degli store), elencati nel dettaglio. Si può passare all'iterazione successiva, ma la fase non si chiude finché le attese non sono risolte |
| `bloccata` | Ferma per un problema da risolvere (design mancante, decisione aperta, criterio non raggiungibile): il motivo è nel dettaglio |

## Riepilogo

Iterazioni completate: 6 su 15.

| N | Stato | Inizio | Fine | Cicli di revisione | Branch | Note |
|---|---|---|---|---|---|---|
| 0 | completata con attese esterne | 2026-10-15 | 2026-10-15 | 3 | `iterazione-00-fondamenta` | CI verificata su GitHub (PR #4); mancano i progetti di staging, produzione e deploy |
| 1 | completata con attese esterne | 2026-10-15 | 2026-10-15 | 3 | `iterazione-01-design-system` | Mancano la prova su emulatore Android e simulatore iOS, gli account degli store e la mappa nei bucket di staging e produzione |
| 2 | completata con attese esterne | 2026-10-16 | 2026-10-16 | 2 | `iterazione-02-account` | Mancano Auth di staging e produzione (hook, Turnstile, email), D-01 e App Review Meta per chiudere la Fase 0 |
| 3 | completata | 2026-10-16 | 2026-10-16 | 3 | `iterazione-03-amicizie` | Notifiche delle richieste e reclamo nell'iterazione 6, gruppi nella 7 (ROADMAP) |
| 4 | completata | 2026-10-19 | 2026-10-19 | 2 | `iterazione-04-catalogo-eventi` | Eventi reali dall'iterazione 5; foto dei locali caricate dai moderatori nell'iterazione 5; flyer nell'iterazione 6 |
| 5 | completata con attese esterne | 2026-10-19 | 2026-10-19 | 2 | `iterazione-05-raccolta-eventi` | Mancano App Review Meta e token, chiave Google Places, 40 locali verificati e il primo `sito_html_<locale>` in staging |
| 6 | in corso | 2026-10-21 | — | 0 | `iterazione-06-flyer-moderazione` | — |
| 7 | da iniziare | — | — | 0 | — | — |
| 8 | da iniziare | — | — | 0 | — | — |
| 9 | da iniziare | — | — | 0 | — | — |
| 10 | da iniziare | — | — | 0 | — | — |
| 11 | da iniziare | — | — | 0 | — | — |
| 12 | da iniziare | — | — | 0 | — | — |
| 13 | da iniziare | — | — | 0 | — | — |
| 14 | da iniziare | — | — | 0 | — | — |

## Dettaglio

Per ogni iterazione avviata la skill aggiunge qui una sezione con: piano eseguito, cicli di
revisione (cosa è stato trovato e corretto in ognuno), esito dei test, rapporto di
`safety-review`, attese esterne, commit.

### Iterazione 0 — Fondamenta del repository

**Piano**
- Funzionalità: nessuna (infrastruttura). Riferimenti: ROADMAP.md §5, ADR-0001, ADR-0002,
  ADR-0003, ADR-0013, ADR-0015.
- Database: `supabase init`; migrazione con estensioni (`postgis`, `citext`, `pg_cron`,
  `pg_net`), schema `private` vuoto senza accesso per `anon`, ruolo `noxa_worker` senza
  `BYPASSRLS`; seed con la password locale del worker; test `001_rls_abilitata` e
  `scripts/verifica_migrazioni.py`.
- Worker: `pyproject.toml` e `uv.lock`; configurazione validata, log structlog, API con
  `/salute` e `/pronto`, modulo `coda` (esecutore con lease, timeout, retry e backoff dietro
  il protocollo `ArchivioJob`); Ruff, mypy strict, pytest.
- App: monorepo pnpm; Next.js in export statico, TypeScript strict, Tailwind, ESLint,
  Prettier, Vitest, Playwright con axe.
- CI GitHub Actions: documentazione e migrazioni, app, worker con immagine Docker, database
  con pgTAP, controllo delle dipendenze.
- Criteri: build statica; `docker compose up worker` risponde su `/salute`; `supabase start`
  e `supabase test db` funzionano; CI verde su una PR di prova e rossa su una PR con una
  tabella senza RLS.

**Cicli di revisione**
- Ciclo 1: `supabase db lint` falliva sulle funzioni interne di PostGIS nello schema
  `extensions` → corretto limitando il lint a `public` e `private`. In CI l'e2e avrebbe
  rifatto la build già eseguita → corretto (`webServer` serve solo l'export in CI). Il
  `Dockerfile` non copia `README.md`, citato da `pyproject.toml` → corretto rimuovendo il
  campo `readme`. Errori di Ruff e mypy (convenzione dei nomi delle eccezioni, `Any` nel
  calcolo del backoff, confronti tra tipi diversi nei test) → corretti.
- Ciclo 2: `pnpm audit` ha segnalato 2 vulnerabilità "high" in dipendenze di sviluppo →
  `compression` forzata a `>=1.8.2` con un override; `braces` (dentro il plugin ESLint di
  Next, nessuna versione corretta disponibile) non viene pubblicata, quindi la CI blocca su
  `pnpm audit --prod` e mostra l'audit completo come informativo. I tipi globali dei test
  (`vitest/globals`) erano visibili anche al codice dell'app → i test importano le funzioni
  da `vitest` e il `tsconfig` include solo i tipi di Node.
- Ciclo 3: tutti i controlli verdi, nessun problema nuovo.

**Esito dei test**
- `scripts/verifica_documentazione.py`: 0 problemi; `scripts/verifica_migrazioni.py`: verde.
- pgTAP (`supabase test db`): 9/9. `supabase db lint` su `public` e `private`: nessun errore.
- App: lint, typecheck e Prettier verdi; Vitest 1/1; Playwright con axe 4/4 (mobile e desktop);
  `pnpm --filter web build` produce l'export statico in `apps/web/out`.
- Worker: Ruff, formattazione e mypy strict verdi; pytest 29/29.
- Docker: `docker compose up --build worker` → `/salute` 200, `/pronto` 200 con il database
  locale e il ruolo `noxa_worker`.
- Dipendenze: `pnpm audit --prod` e `pip-audit` senza vulnerabilità.
- Prova della RLS: una migrazione temporanea con una tabella senza RLS fa fallire sia
  `001_rls_abilitata` (1/9 fallito) sia `scripts/verifica_migrazioni.py`; dopo la rimozione i
  test tornano verdi. È la stessa sequenza che esegue la CI.

**Criteri di completamento**
| Criterio | Esito | Evidenza |
|---|---|---|
| `pnpm --filter web build` produce l'export statico | SÌ | `apps/web/out/index.html` |
| `docker compose up worker` risponde su `/salute` | SÌ | risposta `{"stato":"ok"}` 200 |
| `supabase start` e `supabase test db` funzionano | SÌ | 9/9 |
| CI verde su una PR di prova e rossa con una tabella senza RLS | Verificato in locale con gli stessi comandi della CI | `.github/workflows/ci.yml`; prova della RLS sopra. Da confermare su GitHub (attesa esterna) |

**Safety review — Iterazione 0 (infrastruttura)**
Esito: SUPERATA

| Sezione | Esito | Evidenza |
|---|---|---|
| A. Autorizzazione | SÌ | Nessuna tabella; `001_rls_abilitata` controlla RLS su tabelle, viste `security_invoker`, assenza di viste materializzate in `public`, nessun accesso di `anon` a `private`; `noxa_worker` senza `BYPASSRLS` né privilegi amministrativi; `execute` sulle funzioni di `private` revocato per default; nessun `service_role` in `apps/web` (grep) |
| B. Contatti tra utenti | N/A | Nessuna funzionalità utente |
| C. Eventi e contenuti | N/A | Nessun evento né testo per gli utenti oltre al titolo dell'app |
| D. Posizione | N/A | Nessun dato di posizione |
| E. Contenuti caricati | N/A | Nessun caricamento |
| F. Privacy | SÌ | Nessun dato personale, nessun SDK di terze parti; la password del database è `SecretStr` e non compare nei log né in `repr` (test `test_la_password_del_database_non_compare_nella_rappresentazione`); `openapi`/`docs` del worker disattivati |
| G. Documentazione | SÌ | DATA_MODEL §9, SAFETY_PRIVACY R-68, ARCHITECTURE §3.3, DESIGN §2, ROADMAP (iterazioni 2 e 5), CLAUDE.md e README aggiornati |

**Scelte fatte durante l'iterazione**
- TypeScript 6.0 invece della 7.0: `typescript-eslint` supporta solo versioni inferiori alla
  6.1. ESLint 9 invece del 10: i plugin di `eslint-config-next` non supportano ancora il 10.
- Tailwind 4: la configurazione sta nel CSS (`@theme inline`), DESIGN.md §2 aggiornato.
- CLI Supabase come dipendenza di sviluppo (`pnpm exec supabase`), così la versione è
  bloccata dal lockfile.
- Il modulo `coda` contiene l'esecutore e il protocollo `ArchivioJob`; l'implementazione
  Postgres e l'avvio degli esecutori arrivano con la tabella `coda_job` nell'iterazione 5
  (ROADMAP.md aggiornato).

**Attese esterne**
- ~~Repository GitHub remoto e prima esecuzione della CI~~: risolta il 2026-10-15. La CI è verde
  su `main` (PR #3) e la PR di prova #4, con una tabella senza RLS e senza test, è fallita sia
  in `001_rls_abilitata` sia in `scripts/verifica_migrazioni.py`; chiusa senza unirla.
- Progetti Supabase `staging` e `produzione` (Francoforte), Vercel (UE) e Fly.io (`fra`).

### Iterazione 1 — Design system e guscio dell'app

**Piano**
- Funzionalità: F-43 (app installabile), F-45 (accessibilità), F-02 (stile della mappa);
  ADR-0001, ADR-0011, ADR-0016, ADR-0018.
- Design: `design/sistema/` (progetto Claude Design "Noxa — Design system", accento A).
- Database: bucket pubblico `mappe` senza scritture per gli utenti, con test pgTAP.
- App: `tokens.css` e classi dei componenti dal foglio `noxa.css` del design; Tailwind 4 con i
  soli token; componenti di `src/components/ui/`; guscio con le cinque aree; tema scuro e
  chiaro; catalogo `page.dev.tsx`; PWA (manifest, icone, service worker Workbox); progetti
  Capacitor iOS e Android; mappa MapLibre + PMTiles con i colori del design.
- Criteri: nessuna violazione axe nel catalogo e nella navigazione in entrambi i temi; app su
  browser, emulatore Android e simulatore iOS; mappa senza richieste a domini esterni.

**Cicli di revisione**
- Ciclo 1: la mappa non si caricava ("Worker failed to load"): il bundler di Next non emette il
  web worker di MapLibre 6 → il worker è copiato in `public/vendor/maplibre/` a ogni build e
  indicato con `setWorkerUrl`, sempre dalla stessa origine. ESLint analizzava i file copiati
  nei progetti nativi → esclusi `android/`, `ios/` e `public/vendor/` da ESLint e Prettier.
  React segnalava `setState` in un effetto per il tema → sostituito con
  `useSyncExternalStore`.
- Ciclo 2: due stili scritti a mano in `Interruttore` → spostati nelle classi del design
  system. La PWA non ha ancora la Content Security Policy di ARCHITECTURE.md §9 → aggiunta
  all'iterazione 2 in ROADMAP.md.
- Ciclo 3: tutti i controlli verdi.

**Esito dei test**
- pgTAP 13/13 (`001_rls_abilitata`, `010_storage_mappe`); `verifica_documentazione.py` e
  `verifica_migrazioni.py` verdi.
- Vitest 19/19; Playwright 36/36 su mobile e desktop: cinque aree in tema scuro e chiaro con
  axe, catalogo con axe e foglio (focus ed Esc), tema ricordato dopo il ricaricamento, mappa
  senza richieste a domini esterni, PWA installabile con service worker.
- Build di produzione senza catalogo; `cap sync` per iOS e Android riuscito.
- Mappa reale: `scripts/prepara_mappa.sh` ha estratto Milano e Brianza (build Protomaps del
  2026-10-14, zoom fino a 15, 119 MB) e l'ha caricata con i font nel bucket locale; risposte
  206 alle richieste a intervalli.

**Criteri di completamento**
| Criterio | Esito | Evidenza |
|---|---|---|
| Nessuna violazione axe nel catalogo e nella navigazione, in entrambi i temi | SÌ | `tests/e2e/catalogo.spec.ts`, `tests/e2e/navigazione.spec.ts` |
| L'app gira su browser | SÌ | test e2e su Chromium mobile e desktop |
| L'app gira su emulatore Android e simulatore iOS | Attesa esterna | Progetti `android/` e `ios/` generati e sincronizzati; mancano Android SDK e JDK in questa macchina, e il simulatore iOS richiede macOS |
| La mappa si apre senza richieste a domini esterni | SÌ | `tests/e2e/mappa.spec.ts` |

**Safety review — Iterazione 1 (F-43, F-45, F-02)**
Esito: SUPERATA

| Sezione | Esito | Evidenza |
|---|---|---|
| A. Autorizzazione | SÌ | Bucket `mappe` senza policy di scrittura: `010_storage_mappe` verifica che anon e utenti non possano caricare o modificare file; nessun `service_role` nell'app (lo usa solo `scripts/prepara_mappa.sh`, dall'ambiente di chi lo esegue) |
| B. Contatti tra utenti | SÌ | Nessuna superficie di contatto; escluso il pulsante "Messaggi dei gruppi" del design (R-16), annotato in `design/sistema/brief.md` |
| C. Eventi e contenuti | SÌ | Nessun riferimento all'alcol in icone, testi o esempi; contatori neutri, mai rossi (R-43); la scheda evento mostra l'età calcolata nel database e la foto del locale con velatura (ADR-0018) |
| D. Posizione | SÌ | La mappa non chiede la posizione del dispositivo e non registra le aree viste; nessuna richiesta a servizi di mappe esterni (test e2e) |
| E. Contenuti caricati | N/A | Nessun caricamento; il Pulsante "Segnala" è pronto per i contenuti (R-50) |
| F. Privacy | SÌ | Font serviti dall'app, worker di MapLibre e mappa dalla nostra origine, nessun SDK di terze parti (R-62); il tema è salvato solo sul dispositivo |
| G. Documentazione | SÌ | DESIGN.md §2 e §3, ADR-0016, ROADMAP (iterazioni 2 e 8), DECISIONI_APERTE (D-01 e `appId`), CLAUDE.md, README |

**Scelte fatte durante l'iterazione**
- Le classi dei componenti vengono dal foglio `noxa.css` di Claude Design
  (`src/styles/componenti.css`); Tailwind 4 serve per il layout, con le palette predefinite
  azzerate.
- Icona dell'app provvisoria (una "n" con il punto arancio): quella definitiva arriva con
  l'iterazione 12.
- Identificativo delle app native `app.noxa`, legato a D-01.
- Glifi della mappa per l'italiano (latino, latino esteso, punteggiatura); niente icone dei
  punti di interesse.

**Attese esterne**
- Prova dell'app su emulatore Android (Android Studio con SDK e JDK) e su simulatore iOS (Mac
  con Xcode).
- Account Apple Developer e Google Play Console per firmare le build.
- Mappa nei bucket `mappe` di staging e produzione: workflow `Aggiornamento mappa` con i
  segreti `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` degli ambienti GitHub.

### Iterazione 2 — Account e sicurezza di base

**Piano**
- Funzionalità: F-10 (registrazione, accesso, verifica dell'email, onboarding di sicurezza),
  F-41 (consensi versionati). Regole: R-01, R-02, R-04, R-05, R-06, R-07, R-60, R-63, R-68.
- Design: `design/F-10-accesso/` (benvenuto, età non sufficiente, registrazione in 4 passi,
  verifica dell'email, accesso, recupero della password, onboarding, nuovi termini).
- Database: enum `stato_account`, `ruolo_utente`, `tipo_consenso`; tabelle `profili`,
  `profili_privati`, `ruoli_utente`, `consensi`; funzioni `private.eta_di`, `e_minorenne`,
  `stessa_fascia`, `puo_vedere_profilo` (per ora solo il titolare), `e_moderatore`,
  `e_amministratore`, `imposta_aggiornato_il`; hook di Supabase Auth prima della creazione
  dell'utente e trigger `private.gestisci_nuovo_utente` (R-01) che crea profilo, dati privati e
  consensi; trigger `private.blocca_modifica_data_nascita` (R-02); versioni dei documenti e RPC
  `mio_account`; seed con gli utenti per età; `000_supporto.test.sql` e test pgTAP.
- App: client Supabase tipizzato, errori di dominio, messaggi, TanStack Query e Zod; schermate
  del design; protezione delle aree per gli utenti senza sessione (R-07); CAPTCHA Turnstile;
  Content Security Policy (meta con gli hash degli script e header di Vercel).
- Test: pgTAP per tutte le età del seed; Vitest; Playwright con axe sulle schermate (Supabase
  simulato) e percorso completo con Supabase locale, compreso il tredicenne rifiutato dall'app
  e dall'API.
- Criteri: criteri della Fase 0; test e2e che un utente di 13 anni non può registrarsi né
  dall'app né dall'API.

**Cicli di revisione**
- Ciclo 1: tutti i controlli verdi; dalla rilettura del diff, cinque problemi. Senza token di
  Turnstile accesso, recupero e reinvio non davano risposta → avviso "Stiamo completando la
  verifica di sicurezza". Un link delle email rimandato al Site URL (app nativa, indirizzo non
  ammesso) arrivava alla home e perdeva il token → la home inoltra `token_hash` alla pagina
  di verifica. `/sicurezza/` ripeteva l'onboarding già completato → porta in Scopri.
  `interest-cohort` in `Permissions-Policy` è obsoleto → rimosso. "Ho sbagliato email"
  lasciava la verifica in attesa sul dispositivo → la cancella. Aggiunti i test e2e.
- Ciclo 2: tutti i controlli verdi, nessun problema nuovo.
- Durante lo sviluppo (prima dei cicli) i test hanno trovato: dati di registrazione rimasti
  in `auth.users` e in `auth.identities` perché Supabase Auth riscrive i metadati dopo il
  trigger → pulizia in `before insert`/`before update` su entrambe le tabelle (R-05, test
  pgTAP e e2e con Supabase reale); service worker che serviva la 404 per le pagine con
  parametri (`?token_hash=`, in futuro `?id=`) → parametri ignorati nella cache; `.env`
  della radice non letto da Next (cache di `loadEnvConfig`) → lettura forzata.

**Esito dei test**
- pgTAP 127/127 (6 file: `000_supporto`, `001_rls_abilitata`, `010_storage_mappe`,
  `011_profili`, `012_registrazione`, `013_account_non_confermati`); `supabase db lint`
  senza errori; `verifica_documentazione.py` e `verifica_migrazioni.py` verdi.
- Vitest 37/37; ESLint, TypeScript e Prettier verdi.
- Playwright con Supabase simulato 132/132 (mobile e desktop, axe nei due temi su tutte le
  schermate e gli stati); Playwright con Supabase locale reale 3/3.
- Worker invariato: Ruff, mypy, pytest 29/29.

**Criteri di completamento**
| Criterio | Esito | Evidenza |
|---|---|---|
| Fase 0.1: migrazione senza RLS o test fa fallire la CI | SÌ | PR #4 (iterazione 0) |
| Fase 0.2: `supabase test db` con R-01, R-02, R-04, R-05 per tutti gli utenti del seed | SÌ | `011_profili`, `012_registrazione` |
| Fase 0.3: chi ha meno di 14 anni non si registra né dall'app né dall'API (e2e) | SÌ | `tests/e2e/integrazione/registrazione.spec.ts` (Supabase reale), job CI `integrazione` |
| Fase 0.4: export statico su browser, simulatore iOS, emulatore Android | Parziale | Browser SÌ; simulatori: attesa esterna dall'iterazione 1 |
| Fase 0.5: token del design system | SÌ | iterazione 1 |
| Fase 0.6: D-01 (dominio) chiusa | NO | Decisione del product owner |
| Fase 0.7: richiesta di App Review Meta inviata | NO | Attesa esterna |
| PRD F-10: dati minimi, data immutabile, CAPTCHA, consensi versionati, onboarding in 3 schermate | SÌ | e2e `registrazione`, `accesso`, `sicurezza`; pgTAP |
| Content Security Policy (ARCHITECTURE.md §9) | SÌ | `scripts/applica-csp.mjs`, `vercel.json`, e2e "Content Security Policy" |

**Safety review — Iterazione 2 (F-10, F-41 consensi)**
Esito: SUPERATA

Dati coinvolti: email e password (Supabase Auth, solo il titolare); username e nome
(`profili`, solo il titolare finché non esistono amicizie); data di nascita
(`profili_privati`, solo il titolare, immutabile, fuori da metadati e JWT); consensi (solo il
titolare, sola aggiunta); onboarding completato (solo il titolare); fascia d'età (solo al
titolare tramite `mio_account`); email della verifica in attesa (solo `localStorage` del
dispositivo, cancellata alla prima sessione). Superfici di contatto: nessuna; l'hook rivela a
chi tenta di registrarsi solo se uno username esiste già (codice `NX003`), senza età né altri
dati, dietro limiti di frequenza e CAPTCHA.

| Sezione | Esito | Evidenza |
|---|---|---|
| A. Autorizzazione | SÌ | RLS e policy per operazione su 4 tabelle; età solo nel DB (`private.eta_di`, test per 14–21 anni e compleanno a Roma); funzioni `security definer` in `private` con `search_path` vuoto; test positivi e negativi per tutti gli utenti del seed, `moderatore` e `moderatore_senza_mfa`; nessun `service_role` in `apps/web` |
| B. Contatti tra utenti | SÌ | `profili` visibile solo al titolare (`puo_vedere_profilo`), nessun elenco possibile, nessun accesso anonimo; nessun messaggio libero |
| C. Eventi e contenuti | SÌ | Nessun evento; testi senza alcol, senza urgenza (attesa di 60 s scritta in piccolo), opzioni del foglio dei termini con lo stesso peso (R-43) |
| D. Posizione | N/A | Nessun dato di posizione |
| E. Contenuti caricati | SÌ | Username e nome con vincoli di formato e lunghezza; la segnalazione dei profili arriva con `segnalazioni` (iterazione 3) |
| F. Privacy | SÌ | Solo i dati di R-60; account non confermati eliminati dopo 24 ore (§10, `013_account_non_confermati`); Turnstile documentato (ADR-0020, R-66, D-07, informativa); nessun tracciamento; check-in e notifiche spenti di default (test); testi per quattordicenni |
| G. Documentazione | SÌ | PRD, ARCHITECTURE §3.1 §3.2 §4.1 §9, DATA_MODEL §4 §5.1 §5.10 §8 §9, SAFETY_PRIVACY R-01 R-02 R-05 R-63 R-66 §10, ADR-0020, DESIGN, ROADMAP (iterazione 8), DECISIONI_APERTE D-07, supabase/README |

**Scelte fatte durante l'iterazione**
- Controllo dell'età nell'hook "before user created" di Supabase Auth (errore leggibile
  dall'app) e di nuovo nel trigger su `auth.users`; i consensi iniziali li registra il
  trigger, insieme al profilo.
- Username verificato all'invio e non mentre si scrive: senza account non si interrogano i
  profili (R-07, R-10).
- Link delle email con `token_hash` verso pagine dell'app: funzionano su qualsiasi
  dispositivo. Account non confermati eliminati dopo 24 ore (nuova riga in §10).
- CSP come meta con gli hash degli script, calcolata dopo la build, valida anche nelle app
  native; header di Vercel per il resto.
- Test e2e in due livelli: Supabase simulato per schermate e stati, Supabase reale per il
  percorso completo e R-01 (nuovo job CI).
- Sentry e i link delle email nell'app nativa spostati nell'iterazione 8 (ROADMAP).

**Attese esterne**
- Supabase Auth di staging e produzione: hook dell'età, Turnstile con la chiave segreta,
  modelli delle email, URL, password di 10 caratteri e protezione dalle password compromesse
  (supabase/README.md); chiave del sito in Vercel.
- Revisione legale di termini e informativa 2026-10 e identità del titolare (D-07).
- Dalle iterazioni precedenti: progetti di staging e produzione, deploy, simulatori iOS e
  Android, account degli store. Per chiudere la Fase 0: D-01 e App Review Meta.

**Commit**: `e8283e9` … commit finale di chiusura sul branch `iterazione-02-account`.

### Iterazione 3 — Amicizie, blocchi e segnalazioni

**Piano**
- Funzionalità: F-11 (amicizie per ricerca e per codice invito), F-12 (blocco e
  segnalazione), F-42 (elenco dei bloccati), profilo e modifica di nome e username (F-10).
  Regole: R-10…R-14, R-17, R-43, R-50, R-52, R-53, R-69.
- Design: `design/F-11-amici/` (amici, ricerca, codice e scansione, anteprima e richiesta
  con l'avviso per chi ha 14–17 anni, profili, segnala, blocca, bloccati, le mie
  segnalazioni).
- Database: enum `stato_amicizia`, `canale_amicizia`, `tipo_oggetto_segnalabile`,
  `motivo_segnalazione`, `stato_segnalazione`, `azione_moderazione`; tabelle `amicizie`,
  `codici_invito`, `blocchi`, `segnalazioni`, `azioni_moderazione`; funzioni `c_e_blocco`,
  `sono_amici`, `puo_vedere_profilo` estesa; trigger `limita_richieste_amicizia` (R-14),
  `applica_blocco` (R-17), priorità delle segnalazioni (R-53); RPC `cerca_utenti`,
  `crea_codice_invito`, `anteprima_codice_invito`, `usa_codice_invito`, `avviso_richiesta`,
  `miei_bloccati`, `mie_segnalazioni`; pulizia dei codici scaduti; test pgTAP per tutte le età.
- App: schermate del design nelle aree (Profilo, Amici, persona), QR, scansione con
  BarcodeDetector e codice scritto, link d'invito, menu ⋯, segnala in due tocchi, blocca con
  "Annulla", persone bloccate, le mie segnalazioni.
- Fuori da questa iterazione (ROADMAP): notifiche delle richieste (iterazione 9), gruppi e
  invariante R-15 (iterazione 7), decisioni dei moderatori e reclamo (iterazione 6).
- Criteri: test pgTAP di R-10…R-14 e R-17 per tutte le età, compreso il tentativo di elencare
  `profili`; e2e amicizia per ricerca e per codice con l'avviso al minorenne.

**Cicli di revisione**
- Durante lo sviluppo: il menu ⋯ dell'ultima riga si apriva sotto la barra di navigazione
  fissa → si apre verso l'alto vicino al fondo; il toast "Persona bloccata" spariva con la
  riga della persona → fornitore unico dei toast nell'app; "Valido ancora 16 min" per lo
  scarto tra gli orologi → limitato a 15.
- Ciclo 1: tutti i controlli verdi; dalla rilettura del diff, un link d'invito aperto senza
  sessione si perdeva dopo l'accesso → la pagina richiesta si ricorda e si riapre (e2e).
- Ciclo 2: il test con Supabase reale ha trovato una regressione della correzione: dopo
  "Esci dall'account" il nuovo accesso riapriva il Profilo → si ricorda la pagina solo se la
  sessione mancava fin dall'apertura.
- Ciclo 3: tutti i controlli verdi, nessun problema nuovo.

**Esito dei test**
- pgTAP 234/234 (9 file, nuovi `014_amicizie_blocchi`, `015_codici_invito`,
  `016_segnalazioni`; `011_profili` aggiornato con le relazioni del seed); `supabase db
  lint` senza errori; `verifica_documentazione.py` e `verifica_migrazioni.py` verdi.
- Vitest 43/43; ESLint, TypeScript e Prettier verdi.
- Playwright con Supabase simulato 180/180 (axe nei due temi su profilo, amici, ricerca,
  codice, anteprima con avviso, menu ⋯, bloccati, segnalazioni); con Supabase reale 5/5,
  compreso adulto e minorenne che non si trovano con la ricerca ma diventano amici con il
  codice, con l'avviso al minorenne, e il blocco che li nasconde a vicenda.
- Worker invariato: Ruff, mypy, pytest 29/29.
- Un test del reinvio dell'email è fallito una volta su 178 con la macchina carica e passa
  6 volte su 6 da solo: instabilità di tempi, la CI ha 2 tentativi.

**Criteri di completamento**
| Criterio | Esito | Evidenza |
|---|---|---|
| Test pgTAP di R-10…R-14 e R-17 per tutte le età, compreso il tentativo di elencare `profili` | SÌ | `011_profili` (elenco di `profili` per ogni utente del seed), `014_amicizie_blocchi`, `015_codici_invito` |
| e2e amicizia per ricerca e per codice con l'avviso al minorenne | SÌ | `tests/e2e/amici.spec.ts`, `tests/e2e/integrazione/amici.spec.ts` |
| PRD F-11, F-12, F-42 | SÌ | e2e `amici.spec.ts` (ricerca, codice, anteprima, richieste, rimozione, segnala, blocca, bloccati, segnalazioni, modifica) |

**Safety review — Iterazione 3 (F-11, F-12, F-42)**
Esito: SUPERATA

Dati coinvolti: amicizie e richieste (solo le due persone); codici invito (solo il titolare,
cancellati 24 ore dopo la scadenza); blocchi (solo chi blocca; il bloccato non li vede);
segnalazioni con testo facoltativo di massimo 1000 caratteri (chi segnala e i moderatori con
due fattori); registro della moderazione (solo moderatori). Superfici di contatto: ricerca
solo nella propria fascia, per prefisso, 20 risultati; codice invito monouso di 15 minuti,
che mostra username e nome del titolare solo a chi lo usa; profilo visibile solo agli amici
e a chi ha una richiesta in attesa; nessun messaggio libero.

| Sezione | Esito | Evidenza |
|---|---|---|
| A. Autorizzazione | SÌ | RLS e policy per operazione sulle 5 nuove tabelle; RPC `security definer` con `search_path` vuoto e controllo del chiamante; test per 14, 15, 16, 17, 18, 20, 21 anni, `moderatore` e `moderatore_senza_mfa` |
| B. Contatti tra utenti | SÌ | Adulti e minorenni non si trovano (`014`, e2e reale); tra fasce solo con codice e avviso (`015`, e2e); blocco reciproco e invisibile, con lo stesso errore di un account non disponibile; nessun messaggio libero; nessuna notifica con testi di altri |
| C. Eventi e contenuti | SÌ | Nessun evento; contatori neutri, nessun suggerimento di persone né pressione sociale (R-43) |
| D. Posizione | N/A | Nessuna posizione; la fotocamera legge il QR sul dispositivo e niente viene salvato |
| E. Contenuti caricati | SÌ | Profili segnalabili in due tocchi (R-50), priorità secondo R-53, 20 segnalazioni al giorno, azioni dei moderatori registrate (R-69) |
| F. Privacy | SÌ | Nessun dato nuovo oltre a relazioni e segnalazioni; conservazione in §10 (codici 24 ore, segnalazioni 12 mesi, il resto con l'account); nessun SDK nuovo; libreria QR locale |
| G. Documentazione | SÌ | PRD F-11 F-12, DATA_MODEL §4 §5.2 §5.10 §8, SAFETY_PRIVACY R-50 e §10, DESIGN, ROADMAP (iterazioni 6 e 7), brief F-11 |

**Scelte fatte durante l'iterazione**
- `puo_vedere_profilo` senza la condizione sui gruppi fino all'iterazione 7.
- Tabella `notifiche`, notifiche delle richieste ed esiti di moderazione con il reclamo
  spostati nell'iterazione 6 (ROADMAP); la R-15 sui gruppi nell'iterazione 7.
- Le richieste arrivate con il codice si accettano dal profilo, dove compare l'avviso.
- Una pagina aperta senza sessione (link d'invito) si riapre dopo l'accesso.
- QR generato in locale con `uqr`; scansione con BarcodeDetector dove il browser lo offre,
  altrimenti codice scritto.

**Attese esterne**: nessuna nuova (restano quelle delle iterazioni 0–2).

**Commit**: `148cb2e` … commit finale di chiusura sul branch `iterazione-03-amicizie`.

### Iterazione 4 — Catalogo eventi e scoperta

**Piano**
- Funzionalità: F-01 (elenco con filtri), F-02 (mappa), F-03 (dettaglio), F-04 (amici che
  partecipano), F-05 (mi interessa / partecipo). Regole: R-20…R-23, R-33, R-43, R-50, R-56,
  R-67; ADR-0016, ADR-0018, ADR-0019.
- Design: `design/F-01-scopri/` (elenco, filtri e scegli data, mappa, dettaglio con le
  copertine, stati, partecipazione e visibilità, componenti, verifica a 360 px).
- Database: enum `stato_evento`, `stato_partecipazione_evento`, `fonte_immagine_locale`,
  valore `dati_errati` di `motivo_segnalazione`; tabelle `locali` (con le colonne della foto e
  il check di R-56), `generi_musicali`, `eventi`, `eventi_generi`, `eventi_fonti`,
  `partecipazioni_evento`; funzioni `evento_visibile_a`, `amici_di`; trigger
  `calcola_data_serata`, `proteggi_eta_evento` (R-22), visibilità predefinita delle
  partecipazioni (R-67); bucket `immagini-locali` e `flyer-pubblicati` (sola lettura per
  l'app); RPC `cerca_eventi` e `dettaglio_evento` (`security invoker`) con la copertina
  nell'ordine dell'ADR-0018; segnalazione di eventi e foto dei locali; permessi del worker
  sulle tabelle degli eventi; dati di esempio nel seed.
- Test pgTAP per 14, 15, 16, 17, 18, 20, 21, moderatore e worker; prova di prestazioni di
  `cerca_eventi` con 5.000 eventi sintetici.
- App: Scopri con elenco (scheda in evidenza, righe, sezioni per serata), segmenti
  Stasera/Domani/Weekend e calendario, foglio dei filtri (posizione non salvata o comune,
  distanza, generi, età minima, solo con amici), mappa con marker raggruppati e anteprima,
  dettaglio evento con copertine, età non dichiarata, annullato, amici, Mi interessa /
  Partecipo con visibilità e "Annulla", fonte, biglietti, Apri in Mappe, menu ⋯ con
  Condividi e Segnala; stati di caricamento, vuoto, errore e offline.
- Criteri: test pgTAP di R-20…R-23, R-56 e R-67 per tutte le età; `cerca_eventi` < 800 ms al
  95° percentile con 5.000 eventi; criteri di accettazione di F-01…F-05.

**Cicli di revisione**
- Durante lo sviluppo: `cerca_eventi` calcolava amici e generi per tutti gli eventi
  dell'intervallo prima del limite (450 ms al 95° percentile con 5.000 eventi) → si scelgono
  prima i 300 eventi, poi si calcolano i dati solo per quelli (140 ms); la tela della mappa
  era alta 0 perché `.maplibregl-map` imponeva `position: relative` (difetto presente
  dall'iterazione 1, i test controllavano solo lo stato "pronta") → selettore più specifico,
  e i test ora toccano i segnaposto; l'anteprima della mappa copriva l'attribuzione
  OpenStreetMap → anteprima sotto la mappa come nel design; il piede fisso del foglio dei
  filtri copriva i suggerimenti dei comuni (axe `target-size`) → contenuto con scorrimento
  proprio; i radio di "Dove" non si potevano toccare (cerchio sopra l'input nascosto) →
  input nativo invisibile su tutta la riga; il seed non aveva eventi nel weekend → date dal
  prossimo venerdì; `prepara_mappa.sh` falliva se la cartella indicata non esisteva →
  `mkdir -p`.
- Ciclo 1: tutti i controlli verdi; dalla rilettura del diff: due strisce offline (quella del
  guscio e quella della pagina) → la striscia del guscio usa il testo della pagina; il nome
  dei link delle schede nascondeva annullato, distanza, prezzo e amici → nome completo;
  "Scegli un comune" con il campo vuoto filtrava Milano senza mostrarlo → il campo si
  riempie; nessun avviso quando la ricerca arriva al limite di 300 → riga informativa.
- Ciclo 2: tutti i controlli verdi, nessun problema nuovo.

**Esito dei test**
- pgTAP 370/370 (14 file; nuovi `017_locali`, `018_eventi`, `019_partecipazioni_evento`,
  `020_cerca_eventi`, `021_prestazioni_cerca_eventi`; `016_segnalazioni` aggiornato);
  `supabase db lint` senza errori su `public` e `private`; `verifica_documentazione.py` e
  `verifica_migrazioni.py` verdi (15 tabelle con RLS e test).
- Prestazioni: `cerca_eventi` con 5.000 eventi in 60 giorni, 60 ricerche tipiche per un
  adulto e un minorenne: 95° percentile 140 ms, massimo 155 ms (soglia 800 ms).
- Vitest 63/63 (nuovo `scopri.test.tsx`: date delle serate, weekend, testi delle schede,
  amici, filtri, comuni, componenti); ESLint, TypeScript e Prettier verdi.
- Playwright con Supabase simulato 214/214 (nuovo `scopri.spec.ts`: axe nei due temi su
  elenco, filtri, calendario, mappa con anteprima, dettaglio con foto, amici, menu ⋯,
  segnala, annullato, età non dichiarata, non disponibile; filtri, posizione arrotondata e
  negata, vuoto, errore, offline, partecipazione con Annulla e visibilità, condivisione,
  segnalazione di evento e foto); con Supabase reale 7/7 (nuovo
  `integrazione/scopri.spec.ts`: età e alcol per 16 e 20 anni, partecipazione visibile solo
  all'amico e nascosta con "Solo per te").
- Worker invariato: Ruff, mypy, pytest 29/29.
- Prova a mano nel browser con Supabase locale (16, 15 e 20 anni, temi scuro e chiaro):
  elenco, filtri, mappa con segnaposto e anteprima, dettaglio, partecipazione, annullato,
  segnala. La prova con VoiceOver o TalkBack su un dispositivo resta da fare con la beta
  (iterazione 8, verifica completa di accessibilità).

**Criteri di completamento**
| Criterio | Esito | Evidenza |
|---|---|---|
| Test pgTAP di R-20…R-23 per 14, 15, 16, 17, 18, 20, 21 | SÌ | `018_eventi` (visibilità per ogni età e moderatori, R-21 check, R-22 con il ruolo `noxa_worker`), `020_cerca_eventi` |
| Test pgTAP di R-56 | SÌ | `017_locali` (check della foto, approvazione, bucket `immagini-locali` e `flyer-pubblicati`, segnalazione della foto) |
| Test pgTAP di R-67 per tutte le età | SÌ | `019_partecipazioni_evento` (14, 15, 16, 17, 18, 20, 21, moderatore, blocco) |
| `cerca_eventi` < 800 ms al 95° percentile con 5.000 eventi | SÌ | `021_prestazioni_cerca_eventi` (140 ms) |
| PRD F-01 elenco e filtri | SÌ | e2e `scopri.spec.ts` (quando, filtri, posizione, vuoto, errore, offline) |
| PRD F-02 mappa | SÌ | e2e `scopri.spec.ts` e `mappa.spec.ts` (segnaposto, gruppi, anteprima, attribuzione, elenco) |
| PRD F-03 dettaglio | SÌ | e2e `scopri.spec.ts` (copertina con attribuzione, fonte, biglietti, Mappe, annullato, età non dichiarata, non disponibile) |
| PRD F-04 amici che partecipano | SÌ | `019`, `020`, e2e reale `integrazione/scopri.spec.ts` |
| PRD F-05 Mi interessa / Partecipo | SÌ | e2e `scopri.spec.ts` (un tocco, Annulla, visibilità, errore), `019` |

**Safety review — Iterazione 4 (F-01…F-05)**
Esito: SUPERATA

Dati coinvolti: eventi, generi, fonti e locali (informazioni pubbliche sugli eventi, visibili
secondo l'età di chi guarda); foto dei locali (solo moderatori in scrittura, nessuna foto
nel seed); partecipazioni (titolare e amici confermati, se visibili); posizione del
telefono (solo parametro della ricerca, arrotondata a ~100 m, in memoria); comune scelto e
filtri (solo nel `sessionStorage` del dispositivo); segnalazioni di eventi e foto.
Superfici di contatto: riga "amici che partecipano" ed elenco degli amici nel dettaglio,
limitati agli amici confermati non bloccati con partecipazione visibile; nessun nome o
contatore di sconosciuti; link condiviso senza dati di altri utenti.

| Sezione | Esito | Evidenza |
|---|---|---|
| A. Autorizzazione | SÌ | RLS e policy per operazione sulle 6 nuove tabelle e sui 2 bucket; RPC `security invoker`; funzioni `private` con `search_path` vuoto; età da `private.eta_di`; test per 14, 15, 16, 17, 18, 20, 21, `moderatore`, `moderatore_senza_mfa`, `noxa_worker` e `anon` (`017`…`020`) |
| B. Contatti tra utenti | SÌ | Partecipazioni solo di amici confermati con `private.miei_amici()` (blocchi esclusi) e solo per eventi visibili a chi guarda (`019`: il minorenne non vede l'amico adulto a un 18+); profili degli amici tramite la RLS di `profili`; nessun testo libero nuovo |
| C. Eventi e contenuti | SÌ | Tutte le letture passano dalla policy di `eventi` (RPC invoker, storage con `exists` su `eventi`/`locali`); età sconosciuta = 18 con check; R-22 con trigger; alcol invisibile ai minorenni (`018`, `020`, e2e reale); nessun conto alla rovescia, contatori generici o incentivo a spendere (e2e `scopri.spec.ts`), prezzi solo informativi |
| D. Posizione | SÌ | Disattivata di default, chiesta solo con "Usa la mia posizione", arrotondata, mai salvata (e2e controlla il `sessionStorage`); alternativa con il centro del comune; nessuna coordinata nei log |
| E. Contenuti caricati | SÌ | Eventi e foto dei locali segnalabili in due tocchi (`018`, `017`, e2e); foto caricate e approvate solo da moderatori con due fattori, percorso e fonte obbligatori (R-56) |
| F. Privacy | SÌ | Nessun dato personale nuovo oltre alle partecipazioni, già nella tabella di conservazione (§10, con l'account); nessun SDK nuovo; mappe dal bucket `mappe` (e2e senza domini esterni); "Apri in Mappe" e i link esterni partono solo da un tocco |
| G. Documentazione | SÌ | PRD F-01, F-03, F-05; ARCHITECTURE §4.2, §5.5, §10; DATA_MODEL §3, §4, §5.2, §5.3, §5.4, §5.10, §6; SAFETY_PRIVACY R-20…R-23, R-33, R-50, R-56, R-67; DESIGN; ROADMAP iterazioni 5, 6, 8 |

**Scelte fatte durante l'iterazione**
- Un evento `annullato` resta visibile (con badge e senza azioni) a chi ha l'età per
  vederlo, per avvisare chi voleva andarci; non ci si può segnare.
- RPC `dettaglio_evento` (security invoker) accanto a `cerca_eventi`, con la fonte più
  affidabile e, per i soli flyer, il sito o l'Instagram del locale.
- Policy di `eventi` scritta in linea (funzioni valutate una volta per query) e
  `private.miei_amici()` per le partecipazioni, per le prestazioni; il test verifica che la
  policy coincida con `private.evento_visibile_a`.
- Bucket `flyer-pubblicati` creato ora (lettura legata all'evento), chiavi esterne di
  `eventi_fonti` verso `fonti` e `caricamenti_flyer` con quelle tabelle (iterazioni 5 e 6).
- Velatura delle copertine costruita sul colore di sfondo del tema, come nel layer "scopri";
  tolti i token `--colore-velo-foto` e `--colore-testo-su-foto`.
- Valore `dati_errati` di `motivo_segnalazione`; la foto del locale si segnala dal menu
  dell'evento con il tipo `immagine_locale`.
- Calendario estratto in `Calendario` (usato anche dalla data di nascita);
  `NEXT_PUBLIC_URL_APP` per i link condivisi dalle app native.
- Eventi già visti in memoria finché l'app è aperta; la cache su IndexedDB arriva con
  l'offline dell'iterazione 8.

**Attese esterne**: nessuna nuova (restano quelle delle iterazioni 0–2).

**Commit**: `bbc6209` … commit finale di chiusura sul branch `iterazione-04-catalogo-eventi`.

### Iterazione 5 — Raccolta automatica degli eventi

**Piano**
- Funzionalità: F-44 (raccolta automatica), F-40 (moderazione di locali, fonti, duplicati ed
  eventi). Regole: R-06, R-21, R-22, R-23, R-50, R-53, R-56, R-69; ADR-0003, ADR-0008,
  ADR-0018.
- Design: `design/F-40-moderazione-fonti/` (accesso con due fattori, guscio, locali e candidati,
  scheda e foto del locale, fonti ed esecuzioni, duplicati, eventi e possibili annullamenti,
  componenti, verifiche a 1024 e 390 px).
- Database: enum `tipo_fonte`, `stato_conformita`, `stato_grezzo`, `tipo_job`, `stato_job` e
  nuovi valori di `tipo_oggetto_segnalabile` e `azione_moderazione`; tabelle `fonti`,
  `esecuzioni_fonte`, `eventi_grezzi`, `candidati_locali`, `coda_job`; chiave esterna
  `eventi_fonti.fonte_id`; foto dei locali solo con RPC registrate; registro automatico delle
  modifiche dei moderatori; età, alcol e stato degli eventi solo con motivazione (R-22);
  `accoda_fonti_da_eseguire` e `applica_conservazione` con `pg_cron`; RPC di moderazione
  (`esegui_fonte_ora`, `decidi_duplicato`, `coda_duplicati`, `decidi_candidato_locale`,
  `salva_foto_locale`, `rimuovi_foto_locale`, `correggi_eta_alcol_evento`,
  `cambia_stato_evento`, `possibili_annullamenti`, `decidi_possibile_annullamento`,
  `registro_moderazione`, `locali_moderazione`, `eventi_moderazione`,
  `contatori_moderazione`).
- Worker: archivio Postgres della coda (`for update skip locked`, un job per dominio) ed
  esecutori nel lifespan; `ClientHttpConforme`; normalizzazione (date, età, alcol, generi);
  adattatori `sito_jsonld` (JSON-LD, microdata, iCal) e `instagram_business_discovery`;
  deduplicazione e fusione con golden set; job `esegui_fonte` e `deduplica_grezzo`; bootstrap
  dei locali da OSM e Google Places (solo `place_id`); strumenti `prova` e `salva_fixture`.
- App: area di moderazione con due fattori e le schermate del design.
- Criteri: test degli adattatori su fixture; precisione ≥ 98% e richiamo ≥ 90% sul golden
  set; almeno 40 locali verificati.


**Cicli di revisione**
- Durante lo sviluppo: i test di fonti, grezzi ed eventi contavano anche i dati di esempio
  del seed → ogni file della raccolta parte da tabelle vuote dentro la propria transazione;
  il caricamento di MapLibre unificato con la nuova mappa della scheda locale rallentava fino
  al blocco la mappa di Scopri sotto carico → la mappa di Scopri tiene il suo caricamento e
  condivide solo centro e limiti; la classe `.casella` dell'area si scontrava con quella del
  design system → `.scelta-riga`; il testo dell'avviso "fonte disattivata" ripeteva il
  titolo → solo l'ultimo errore e cosa fare.
- Ciclo 1: dall'e2e, dopo il primo codice dei due fattori l'invalidazione dei dati dell'area
  rilanciava l'attivazione e creava un secondo fattore non verificato → la query
  dell'attivazione ha una chiave fuori dall'area e non si ricarica. Dalla rilettura del diff
  (R-56): sostituendo una foto, il file nuovo andava nello stesso percorso di quella
  approvata e gli utenti lo vedevano prima di fonte e conferme → ogni foto ha un percorso
  `<id>-<versione>.webp`, visibile solo dopo `salva_foto_locale`, che restituisce la foto
  precedente da eliminare (nuovi test pgTAP in `017_locali`); "Riattiva" del locale non
  gestiva gli errori → mutazione con avviso. `Mappa.tsx` non formattato → Prettier.
- Ciclo 2: tutti i controlli verdi, nessun problema nuovo. Il test e2e della mappa di Scopri
  su mobile resta sensibile al carico quando la suite gira insieme ad altri processi pesanti
  (in CI ci sono due tentativi); da solo e nella suite completa passa.

**Esito dei test**
- pgTAP 523/523 (19 file; nuovi `022_fonti`, `023_eventi_grezzi`, `024_candidati_locali`,
  `025_coda_job`, `026_moderazione_eventi`; aggiornati `017_locali` e `018_eventi`);
  `supabase db lint` senza errori; `verifica_documentazione.py` e `verifica_migrazioni.py`
  verdi (20 tabelle con RLS e test).
- Worker: Ruff, mypy strict, pytest 191/191 (187 unitari: client HTTP conforme, adattatori su
  fixture, normalizzazione, schema evento condiviso, deduplicazione, golden set, pipeline,
  architettura; 4 di integrazione su Postgres reale con il ruolo `noxa_worker`).
- Golden set della deduplicazione: 350 coppie, precisione 100% e richiamo 94,7% (soglie 98% e
  90%); prima versione sintetica, da estendere con le coppie decise in moderazione.
- App: Vitest 76/76 (nuovo `moderazione.test.tsx`); ESLint, TypeScript e Prettier verdi.
  Playwright con Supabase simulato 262/262 (nuovo `moderazione.spec.ts`, 48 test: due
  fattori, locali e candidati, scheda e foto, fonti e conformità, duplicati con tastiera,
  eventi e operazioni delicate, possibili annullamenti, registro, 390 px, axe nei due temi);
  con Supabase reale 9/9 (nuovo `integrazione/moderazione.spec.ts`: attivazione dei due
  fattori con un codice TOTP vero, RPC protette, scarto di un candidato).

**Criteri di completamento**
| Criterio | Esito | Evidenza |
|---|---|---|
| Test degli adattatori su fixture | SÌ | `test_sito_jsonld.py` (JSON-LD, microdata, iCal), `test_instagram.py`, `test_sito_html.py`, `test_http.py` |
| Precisione ≥ 98% e richiamo ≥ 90% sul golden set | SÌ | `test_dedup_golden.py` (100% e 94,7% su 350 coppie) |
| Almeno 40 locali verificati | ATTESA | Lavoro operativo dei moderatori in staging: bootstrap (`bootstrap_locali --importa`) e verifica dei candidati nell'area |
| PRD F-40: locali e fonti con verifica di conformità, coda dei duplicati, azioni motivate e registrate, due fattori | SÌ | `022`…`026`, `moderazione.spec.ts`, `integrazione/moderazione.spec.ts` |
| PRD F-44: adattatori dati strutturati, HTML e Instagram; deduplicazione; conformità ADR-0008 | SÌ, con attese | `sito_jsonld`, base `AdattatoreSitoHtml`, `instagram_business_discovery`, `test_pipeline.py`; il primo `sito_html_<locale>` reale e il token Meta sono attese |

**Safety review — Iterazione 5 (F-40, F-44)**
Esito: SUPERATA

Dati coinvolti: locali, fonti, esecuzioni, grezzi, candidati ed eventi (informazioni
pubbliche, nessun dato personale; da Google solo il `place_id`); registro delle azioni con il
nome visualizzato dei moderatori, visibile solo ai moderatori; foto dei locali (fonte lecita,
conferme, EXIF rimosso sul dispositivo); fattore TOTP gestito da Supabase Auth.
Superfici di contatto: nessuna nuova tra utenti. I moderatori non vedono utenti: i possibili
annullamenti dicono solo se qualcuno si è segnato (R-69).

| Sezione | Esito | Evidenza |
|---|---|---|
| A. Autorizzazione | SÌ | RLS e policy per operazione su 5 nuove tabelle; RPC `security definer` con `richiedi_moderatore()` come prima istruzione e `search_path` vuoto; permessi di colonna su `locali`, `fonti`, `eventi_fonti`; il worker può solo disattivare (NX019); test per 14, 15, 16, 17, 18, 20, 21, `moderatore`, `moderatore_senza_mfa`, `noxa_worker` (`017`, `018`, `022`…`026`) |
| B. Contatti tra utenti | N/A | Nessun nuovo contatto o testo libero tra utenti; le motivazioni le scrivono solo i moderatori |
| C. Eventi e contenuti | SÌ | Età sconosciuta = 18 e massimo tra le fonti (`fusione.py`, `test_dedup.py`); alcol se una fonte lo indica; abbassare l'età o togliere l'alcol solo con RPC e motivazione (NX020, `018`, e2e); i nuovi eventi passano dalla policy di `eventi` |
| D. Posizione | N/A | Solo coordinate dei locali, nessuna posizione degli utenti |
| E. Contenuti caricati e moderazione | SÌ | Foto: fonte, conferme e percorso nuovo visibile solo dopo l'approvazione (`017`); ogni decisione in `azioni_moderazione` (registro automatico e RPC); due fattori obbligatori e verificati nel database (R-06) |
| F. Privacy | SÌ | Nessun nuovo dato personale; grezzi 30 giorni, job 14, esecuzioni 90 (`applica_conservazione`, `025`); scarti senza testi della fonte; didascalie Instagram non salvate; token Meta nell'intestazione e URL fuori dai log; nessun SDK nuovo nell'app |
| G. Documentazione | SÌ | DATA_MODEL §3, §4, §5, §6, §8; EVENT_INGESTION §2, §3, §6, §7; ARCHITECTURE §3.3, §10; SAFETY_PRIVACY R-06, R-22, R-56 e §10; PRD §7; ROADMAP iterazioni 6 e 8; skill `add-event-source`; CLAUDE.md |

**Scelte fatte durante l'iterazione**
- Registro automatico delle modifiche dei moderatori con un trigger; le RPC registrano da sé
  le decisioni e lo segnalano per la transazione (`noxa.azione_registrata`), azzerato a fine
  operazione.
- Stato, età e alcol degli eventi solo dalle RPC con motivazione (NX020 anche per i
  moderatori); correzioni ordinarie dirette, registrate.
- Tabelle nuove non previste dal modello: `esecuzioni_fonte` (storico per il dettaglio
  dell'esito) e `candidati_locali` (candidati del bootstrap); colonne di verifica strutturate
  in `fonti` (`robots_esito`, `termini_url`, `termini_letti_il`, `pagine_massime`).
- Backoff delle fonti nella pianificazione (intervallo raddoppiato dopo gli errori) invece di
  nuovi tentativi immediati; "Esegui ora" su una fonte non attiva è una prova che non scrive.
- Instagram: didascalia letta con regole fino all'estrattore dell'iterazione 6.
- Il primo adattatore `sito_html_<locale>` si scrive in staging su un locale verificato
  (scelta del product owner); ora c'è la base `AdattatoreSitoHtml`.
- Foto dei locali con percorso per versione (`<id>-<versione>.webp`).
- Accesso all'area: 8 ore dal codice, poi lo si chiede di nuovo (controllo dell'app sul claim
  `amr`; il database richiede comunque `aal2`).

**Attese esterne**
- App Review di Meta e token di sistema (`META_IG_USER_ID`, `META_ACCESS_TOKEN`) per le fonti
  Instagram: senza, l'adattatore si ferma con `META_NON_CONFIGURATA`.
- Chiave Google Places (`GOOGLE_PLACES_API_KEY`) per il bootstrap; senza, solo OSM.
- In staging: bootstrap dei locali e verifica di almeno 40 locali; il primo adattatore
  `sito_html_<locale>` su un sito verificato; foto autorizzate o con licenza libera (ADR-0018).
- Restano quelle delle iterazioni 0–2.

**Commit**: `99c6827` … commit finale di chiusura sul branch `iterazione-05-raccolta-eventi`.

### Iterazione 6 — Flyer e moderazione

**Piano**
- Funzionalità: F-06 (caricamento e stato dei flyer), F-40 (code dei flyer, delle
  segnalazioni e dei reclami, escalation R-55), F-10 (foto profilo), F-12 (stato delle
  proprie segnalazioni con decisione e reclamo), F-22 limitata alle notifiche nell'app
  (Realtime). Regole: R-50…R-55, R-66, R-69; DSA art. 17 e 20. Design:
  `design/F-06-flyer/`, `design/F-40-moderazione/`, `design/F-10-foto-profilo/`.
- Decisione D-15 chiusa all'avvio dal product owner (nuovo ADR): occultamento automatico in
  attesa della revisione solo per il motivo `adescamento_o_rischio_minore` segnalato da un
  account non nuovo; il contenuto nascosto è sostituito da un'immagine senza copyright a
  tema serata, così l'app non mostra mai vuoti o "in lavorazione"; revisione entro i tempi di
  R-53, ripristino se infondata, mezzo automatico dichiarato nella motivazione.
- Database: valori nuovi degli enum; `notifiche` con trigger sulle amicizie e Realtime;
  `caricamenti_flyer` con bucket `flyer-caricati`, limite R-54, job `analizza_flyer` e
  chiavi esterne da `eventi_grezzi` ed `eventi_fonti`; bucket `avatar` (R-52);
  `contenuti_occultati` (D-15); `reclami` (DSA art. 20); RPC `coda_flyer`, `decidi_flyer`,
  `coda_segnalazioni`, `dettaglio_segnalazione`, `prendi_in_carico_segnalazione`,
  `decidi_segnalazione`, `escalation_segnalazione`, `presenta_reclamo`, `reclami_moderazione`,
  `decidi_reclamo`; contatori dell'area estesi; conservazione delle notifiche (90 giorni).
- Worker: modulo `flyer` (schema `FlyerEstratto`, prompt versionato, estrattore con l'SDK
  `anthropic` e `messages.parse`, immagini con EXIF rimosso, ridimensionamento e pHash,
  client Storage con `service_role`, risoluzione del locale, deduplicazione), job
  `analizza_flyer`, `copia_immagine_flyer`, `pulizia_flyer`; comando `valuta`; golden set
  iniziale di 50 flyer sintetici creati internamente; estrattore in modalità testo e immagine
  per le didascalie Instagram. Senza `ANTHROPIC_API_KEY` il flyer va in revisione manuale
  con i campi vuoti (scelta del product owner).
- App: "Carica un flyer" (Scopri e stato vuoto), caricamento con EXIF rimosso, "I miei
  flyer"; campanella e notifiche in tempo reale; decisione motivata e reclamo nelle
  segnalazioni; foto profilo con ritaglio e conversione WebP sul dispositivo, segnalazione
  della foto; area di moderazione: Flyer, Segnalazioni (con escalation) e Reclami.
- Passi: database e test pgTAP → worker e test → app e test unitari/e2e → documenti →
  cicli di revisione e `safety-review`.
- Criteri dell'iterazione: soglie della skill `flyer-parser` (valutazione con la chiave:
  attesa esterna); test pgTAP di R-51, R-54, R-69 e delle policy del bucket `avatar` per
  tutte le età del seed.

