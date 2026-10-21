# ADR-0021: Infrastruttura a costo minimo

- **Stato**: Accettato
- **Data**: 2026-10-21

## Contesto
Noxa è sviluppata senza budget: ogni costo fisso pesa finché non ci sono utenti reali né
entrate (D-11). ADR-0012 aveva scelto Supabase con Point-in-Time Recovery in produzione
(oltre 100 € al mese), il worker sempre acceso su Fly.io (che non ha più un piano gratuito) e
Vercel per la PWA, il cui piano gratuito è limitato all'uso non commerciale. Con il piano
gratuito di Supabase, inoltre, il traffico incluso (circa 5 GB al mese) non basta alla mappa
servita dal bucket `mappe`: la soglia di crescita di ADR-0016 si raggiungerebbe con poche
centinaia di utenti.

Restano validi i vincoli di sicurezza: dati nell'UE (R-66), RLS come unico punto di
autorizzazione (ADR-0002), `pg_cron` come unico scheduler (ADR-0003), nessun dato personale
nei log.

## Decisione
Principio: **costo zero finché non ci sono utenti reali**; ogni servizio a pagamento ha una
soglia scritta che ne giustifica l'attivazione. Sostituisce ADR-0012 e il punto "Hosting" di
ADR-0016.

| Componente | Scelta | Costo |
|---|---|---|
| Database, Auth, Storage, Realtime, Edge Functions | Supabase, piano **Free**, regione Francoforte; due progetti, `staging` e `produzione` | 0 € |
| Worker | **GitHub Actions** con esecuzione periodica (sotto) | 0 € (repository pubblico) |
| PWA statica | **Cloudflare Pages** | 0 € |
| Mappa (PMTiles, font, icone) | **Cloudflare R2** con giurisdizione UE, su un sottodominio `mappe.` del dominio di D-01 | 0 € fino a 10 GB, traffico in uscita gratuito |
| Email di Auth | **Brevo** (azienda UE) come SMTP di Supabase Auth, con SPF e DKIM sul dominio | 0 € fino a 300 email al giorno |
| Errori | Sentry, piano Developer, regione UE (ADR-0014) | 0 € |
| CAPTCHA | Cloudflare Turnstile (ADR-0020) | 0 € |
| Dominio | Cloudflare Registrar, a prezzo di costo, comprato quando si crea lo staging (D-01) | circa 10–15 € l'anno |

**Worker su GitHub Actions.**
- Il workflow `worker.yml` parte ogni 15 minuti (`schedule`) e a mano (`workflow_dispatch`),
  solo dal branch `main`, con `concurrency` che impedisce due esecuzioni sovrapposte. Avvia
  la stessa immagine Docker del worker in **modalità a esaurimento**: preleva i job pronti da
  `coda_job` finché la coda è vuota o finché non passa la durata massima (10 minuti), poi
  termina. In locale `docker compose` continua a usare gli esecutori nel lifespan di FastAPI.
- `pg_cron` resta l'**unico scheduler**: decide quali job entrano in coda e quando. GitHub
  Actions sveglia soltanto l'esecutore, che non pianifica nulla (ADR-0003). Un job aspetta
  al massimo circa 15 minuti più i ritardi di GitHub: accettabile per la raccolta (frequenze
  di 6 e 12 ore) e per i flyer, che passano comunque dalla revisione umana (R-51).
- Segreti (URL del database con il ruolo `noxa_worker`, token di Meta, chiave Claude API)
  in un *environment* di GitHub limitato a `main`; nessun workflow usa `pull_request_target`,
  quindi le PR esterne non ricevono segreti.
- I log delle Actions di un repository pubblico sono **pubblici**: il worker non scrive dati
  personali nei log (regola già valida), registra solo identificativi tecnici e contatori, e
  la conservazione dei log del repository è impostata a 30 giorni (SAFETY_PRIVACY.md §10).
- I runner di GitHub non garantiscono la residenza nell'UE: GitHub (Microsoft) si aggiunge ai
  fornitori extra-UE di R-66 per i soli dati che il worker tratta, cioè informazioni
  pubbliche sugli eventi e immagini dei flyer senza identità di chi le ha caricate
  (ADR-0003).

**Servizi a pagamento spenti di default.** Il bootstrap dei locali usa solo OpenStreetMap; la
chiave Google Places è facoltativa. Senza chiave Claude API il job `analizza_flyer` manda il
flyer in revisione con i campi vuoti, che il moderatore compila guardando l'immagine (R-51
resta rispettata). L'API di Instagram (Meta) è gratuita.

**Soglie per passare a un servizio a pagamento.**
- Supabase Pro (circa 25 $ al mese): prima dell'apertura della beta con utenti reali si
  decide tra il piano Pro, che porta backup giornalieri e protezione dalle password
  compromesse, e un backup cifrato fatto in proprio (D-14). Senza una delle due soluzioni la
  beta non si apre. Il passaggio è obbligato anche quando si superano i limiti del Free
  (500 MB di database, 1 GB di file).
- Worker sempre acceso (VPS UE o Fly.io, circa 4–5 € al mese): quando serve una latenza
  inferiore ai 15 minuti, quando un'esecuzione supera regolarmente i 10 minuti o se GitHub
  cambia le condizioni per i repository pubblici. Il codice non cambia: stessa immagine,
  stessa coda, esecutori nel lifespan.
- Account degli store (Apple 99 $ l'anno, Google Play 25 $ una tantum): D-13.

## Alternative considerate
- **Mantenere ADR-0012** (Fly.io, Vercel, Supabase con PITR): oltre 100 € al mese prima di
  avere un utente.
- **Oracle Cloud Always Free a Francoforte** per il worker: gratuito e nell'UE, ma richiede
  una carta, le istanze inattive possono essere recuperate dal fornitore e la gestione del
  server (aggiornamenti, sicurezza) resta a noi.
- **Worker nelle Edge Functions di Supabase**: limiti di durata e di memoria incompatibili
  con Playwright e con i lavori lunghi (ADR-0003).
- **VPS UE economico** (circa 4 € al mese): è la prima scelta quando si supera la soglia del
  worker, non prima.
- **Vercel Hobby**: gratuito ma limitato all'uso non commerciale; Cloudflare Pages non ha
  questo limite e tiene dominio, mappa e Turnstile presso un unico fornitore.
- **Repository privato**: i 2.000 minuti gratuiti al mese di GitHub Actions non bastano a
  un'esecuzione ogni 15 minuti.

## Conseguenze
- Costo fisso fino alla beta: solo il dominio.
- Il progetto Supabase gratuito si mette in pausa dopo 7 giorni senza attività: può capitare
  allo staging, che si riattiva dalla dashboard.
- Sul piano Free non esiste la protezione dalle password compromesse: resta la lunghezza
  minima di 10 caratteri finché non si decide D-14.
- I backup (piano Pro o backup cifrato) devono rispettare la finestra di 30 giorni della
  tabella di conservazione per gli account eliminati (SAFETY_PRIVACY.md §10).
- Cloudflare riceve gli indirizzi IP di chi scarica l'app e la mappa, GitHub i dati trattati
  dal worker: entrambi in R-66 e nelle verifiche di D-07; l'informativa dell'app va
  aggiornata con una nuova versione prima della beta (R-63).
- Lavoro da fare (iterazione 8, prima della beta): modalità a esaurimento del worker e
  workflow `worker.yml`; caricamento della mappa su R2 in `scripts/prepara_mappa.sh` e nel
  workflow `mappa.yml`; header di sicurezza in `_headers` di Cloudflare Pages al posto di
  `apps/web/vercel.json`; SMTP Brevo in Supabase Auth; testo dei fornitori nella pagina
  `/privacy`.
- Documenti aggiornati: CLAUDE.md, ARCHITECTURE.md §2 e §6, SAFETY_PRIVACY.md R-66 e §10,
  ROADMAP.md, GUIDA_OPERATIVA.md §8, DECISIONI_APERTE.md (D-01, D-07, D-13, D-14),
  `supabase/README.md`, indice degli ADR.
