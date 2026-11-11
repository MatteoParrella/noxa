# ADR-0031: Sveglia del worker da pg_cron con workflow_dispatch

- **Stato**: Accettato
- **Data**: 2026-11-11

## Contesto
ADR-0021 fa girare il worker su GitHub Actions con un trigger `schedule` ogni 15 minuti. In
staging GitHub esegue quel trigger con ritardi di ore (un'esecuzione ogni 5-6 ore il
2026-11-11): le esecuzioni programmate dei repository pubblici sono "best effort" e vengono
rimandate quando GitHub è carico. Così i job in `coda_job` (fonti, colori delle copertine,
flyer, dedup decisi in moderazione) restano in attesa per ore e ogni prova richiede un avvio a
mano.

## Decisione
- `pg_cron`, già unico scheduler (ADR-0003), ogni 15 minuti esegue
  `private.sveglia_worker()`. La funzione avvia `worker.yml` con l'API `workflow_dispatch` di
  GitHub (`pg_net`) **solo se** in coda c'è un job pronto (`in_coda`, `esegui_dopo` passato) e
  nessun job è `in_esecuzione` con il blocco ancora valido: un esecutore già al lavoro finisce
  la coda da solo. Senza job pronti non parte nulla.
- La richiesta contiene solo il branch (`main`) e il nome dell'ambiente (input `ambiente` di
  `worker.yml`, scelta fissa tra `tutti`, `staging` e `produzione`): ogni database sveglia
  solo il proprio ambiente. Nessun dato degli utenti esce dal database.
- Il token è un **fine-grained token** di GitHub limitato al repository di Noxa con il solo
  permesso "Actions: Read and write". Sta nel Vault di Supabase (`github_worker_token`, con
  `github_worker_repository` e `github_worker_ambiente`), scritto da
  `scripts/configura_ambiente.sh` dalla variabile `GITHUB_TOKEN_WORKER` del file
  dell'ambiente. Solo `postgres` (e quindi `pg_cron`) esegue la funzione; `authenticated`,
  `anon` e `noxa_worker` no. In locale i segreti non ci sono e la sveglia resta spenta.
- Lo `schedule` di `worker.yml` resta come riserva: se il token scade o GitHub rifiuta la
  richiesta, il worker parte comunque, solo più tardi.

## Alternative considerate
- **Solo lo `schedule` di GitHub** (ADR-0021): gratuito ma inaffidabile, ritardi di ore.
- **Servizio di cron esterno** (per esempio cron-job.org) che chiama `workflow_dispatch`: un
  fornitore in più che custodisce il token; `pg_cron` è già nel progetto.
- **Worker sempre acceso** su un VPS UE (circa 4 € al mese, soglia di ADR-0021): latenza
  minima, ma costo fisso prima della beta.
- **Sveglia a ogni inserimento in `coda_job`** (trigger): più rapida, ma un'esecuzione di
  GitHub per ogni job e richieste a raffica quando `accoda_fonti_da_eseguire` inserisce molte
  fonti insieme.

## Conseguenze
- Un job aspetta al massimo circa 15 minuti più l'avvio del runner (1-2 minuti), come previsto
  da ADR-0021.
- Il token va rinnovato alla scadenza scelta su GitHub: con un token scaduto la sveglia fallisce
  in silenzio (risposta in `net._http_response`) e resta lo `schedule`. Rinnovo: nuovo token in
  `GITHUB_TOKEN_WORKER` e di nuovo `scripts/configura_ambiente.sh`.
- Chi ottiene il token può solo avviare workflow del repository: non legge segreti né codice
  privato e non scrive nel repository.
- Documenti aggiornati: ADR-0021 (nota), ARCHITECTURE.md §2 e §6, DATA_MODEL.md §4 e §8,
  GUIDA_OPERATIVA.md §9, `.env.ambiente.example`, indice degli ADR.
