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

Iterazioni completate: 3 su 15.

| N | Stato | Inizio | Fine | Cicli di revisione | Branch | Note |
|---|---|---|---|---|---|---|
| 0 | completata con attese esterne | 2026-10-15 | 2026-10-15 | 3 | `iterazione-00-fondamenta` | CI verificata su GitHub (PR #4); mancano i progetti di staging, produzione e deploy |
| 1 | completata con attese esterne | 2026-10-15 | 2026-10-15 | 3 | `iterazione-01-design-system` | Mancano la prova su emulatore Android e simulatore iOS, gli account degli store e la mappa nei bucket di staging e produzione |
| 2 | completata con attese esterne | 2026-10-16 | 2026-10-16 | 2 | `iterazione-02-account` | Mancano Auth di staging e produzione (hook, Turnstile, email), D-01 e App Review Meta per chiudere la Fase 0 |
| 3 | da iniziare | — | — | 0 | — | — |
| 4 | da iniziare | — | — | 0 | — | — |
| 5 | da iniziare | — | — | 0 | — | — |
| 6 | da iniziare | — | — | 0 | — | — |
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

