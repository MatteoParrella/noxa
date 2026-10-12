---
name: iterazione
description: Esegue un'iterazione completa della roadmap di Noxa (/iterazione 0 … /iterazione 14) - verifica prerequisiti e design, pianifica, implementa con le altre skill, ripete cicli di revisione finché tutti i criteri sono soddisfatti, aggiorna documenti e registro, fa il commit su un branch dedicato. Con /iterazione stato mostra l'avanzamento.
argument-hint: "<numero da 0 a 14> | stato"
disable-model-invocation: true
---

# Iterazione della roadmap

Argomento ricevuto: `$ARGUMENTS`

- Se l'argomento è `stato` (o è vuoto): esegui solo il §A.
- Se è un numero da 0 a 14: esegui i passi da §1 a §8 per quell'iterazione.
- Altrimenti: rispondi che il formato è `/iterazione <0-14>` oppure `/iterazione stato`.

Riferimenti: `docs/ROADMAP.md` §5 (definizione delle iterazioni), `docs/REGISTRO_ITERAZIONI.md`
(stato), `docs/DECISIONI_APERTE.md`, `CLAUDE.md`.

## A. Stato

1. Leggi `docs/REGISTRO_ITERAZIONI.md` e mostra: iterazioni completate su 15, stato di ogni
   iterazione, attese esterne aperte, cicli di revisione totali.
2. Indica la **prossima iterazione** eseguibile e cosa serve per lanciarla: design da
   preparare in Claude Design (colonna "Design" di ROADMAP.md §5), decisioni aperte e
   prerequisiti esterni.

## 1. Controllo dei prerequisiti (prima di toccare qualsiasi file)

Leggi la sezione `### Iterazione N` di ROADMAP.md §5 e la riga della tabella. Verifica:

| Controllo | Come | Se manca |
|---|---|---|
| Iterazioni precedenti | Nel registro tutte le iterazioni `< N` sono `completata` o `completata con attese esterne` | **Fermati** e indica quale iterazione eseguire prima |
| Iterazione già fatta | Lo stato di N non è `completata` | Chiedi se rifarla da capo o riprenderla per correzioni |
| Design | Per ogni schermata della colonna "Design" esiste `design/F-xx-nome/` con `brief.md` e le immagini degli stati (DESIGN.md §1) | **Fermati** ed elenca esattamente cosa preparare in Claude Design |
| Decisioni | Le decisioni `D-xx` citate dall'iterazione sono chiuse in DECISIONI_APERTE.md | **Fermati** e fai la domanda all'utente, con le opzioni e una raccomandazione |
| Prerequisiti esterni | Variabili in `.env` e account elencati nell'iterazione | **Non fermarti**: annotali come attese esterne e prosegui con tutto il lavoro locale |
| Repository | `git status` pulito | Chiedi se fare un commit o mettere da parte le modifiche esistenti |

## 2. Avvio

1. Crea il branch da `main` aggiornato: `git switch -c iterazione-NN-<nome-breve>` (es.
   `iterazione-03-amicizie`). Se `main` non contiene ancora il lavoro precedente, chiedi se
   partire dal branch dell'ultima iterazione.
2. Nel registro imposta lo stato `in corso` e la data di inizio, e aggiungi la sezione
   `### Iterazione N` nel dettaglio.

## 3. Piano

Scrivi il piano nel dettaglio del registro e mostralo all'utente in forma breve:
- funzionalità coinvolte (`F-xx`) e criteri di accettazione dal PRD;
- tabelle, policy e RPC da DATA_MODEL.md;
- schermate (cartelle di `design/`);
- passi ordinati: database → backend e worker → interfaccia → test → documenti;
- criteri di completamento dell'iterazione (e della fase, se è l'ultima della fase).

Poi **procedi senza attendere conferma**. Ti fermi solo per: prerequisiti del §1, decisioni
di prodotto non coperte dai documenti, azioni esterne o irreversibili (creare account,
inserire segreti reali, pubblicare, pagare, fare push o merge).

## 4. Implementazione

Per ogni funzionalità segui la skill `new-feature`, che a sua volta usa:
- `db-migration` per database, policy e test pgTAP;
- `implement-design` per le schermate;
- `add-event-source` e `flyer-parser` dove l'iterazione lo prevede.

Per l'iterazione 0, che non ha funzionalità, segui direttamente il contenuto della sezione.
Fai commit piccoli e frequenti sul branch dell'iterazione, in italiano, all'imperativo.

## 5. Cicli di revisione

Ripeti il ciclo finché **tutti** i controlli sono superati, contando i cicli:

1. Esegui tutti i controlli automatici:
   ```bash
   python3 scripts/verifica_documentazione.py
   supabase db reset && supabase test db
   pnpm --filter web lint && pnpm --filter web typecheck && pnpm --filter web test && pnpm --filter web test:e2e
   cd services/worker && uv run ruff check . && uv run ruff format --check . && uv run mypy src && uv run pytest
   ```
   Dall'iterazione 0 esegui solo i comandi già disponibili.
2. Rileggi il diff dell'iterazione (`git diff main...HEAD`) come un revisore senior: errori,
   casi limite, gestione degli errori, logging, tipi, accessibilità, coerenza con i documenti.
3. Verifica uno per uno i criteri di completamento dell'iterazione (e della fase, se è
   l'ultima) e i criteri di accettazione del PRD, ognuno con un'evidenza: test, comando o
   file.
4. Esegui la skill `safety-review` sull'insieme dell'iterazione.
5. Se qualcosa non passa: correggi, annota nel registro "Ciclo k: trovato … → corretto …" e
   ricomincia dal punto 1.

Se dopo **5 cicli** resta un problema che non sai risolvere, imposta lo stato `bloccata`,
descrivi il problema con le opzioni possibili e fermati.

## 6. Documenti

- Aggiorna PRD, ARCHITECTURE, DATA_MODEL, SAFETY_PRIVACY, EVENT_INGESTION, DESIGN e ADR se
  l'implementazione ha precisato o cambiato qualcosa (CLAUDE.md, "Come aggiornare la
  documentazione").
- Una decisione nata durante l'iterazione diventa un ADR; una questione rimasta aperta va in
  DECISIONI_APERTE.md, mai come `TODO` nel codice.
- Aggiorna i comandi in CLAUDE.md e README.md se ne sono nati di nuovi.

## 7. Chiusura

1. Nel registro:
   - stato `completata`, oppure `completata con attese esterne` con l'elenco delle attese;
   - data di fine, numero di cicli di revisione e nome del branch;
   - nel dettaglio: cicli con le correzioni, esito dei test (numeri), rapporto di
     `safety-review`, commit;
   - aggiorna la riga "Iterazioni completate: X su 15" (le iterazioni `completata con attese
     esterne` contano come completate).
2. Commit finale sul branch: `iterazione N: <nome> completata`.
3. **Non** fare merge in `main` né push senza la richiesta esplicita dell'utente.

## 8. Rapporto all'utente

Rispondi con:

```markdown
## Iterazione N — <nome>: <stato>
**Fatto**: funzionalità e componenti realizzati, in breve.
**Cicli di revisione**: K
- Ciclo 1: trovato … → corretto …
- …
**Test**: pgTAP n/n, unitari n/n, e2e n/n, worker n/n.
**Safety review**: superata (punti principali).
**Attese esterne**: elenco, oppure nessuna.
**Avanzamento**: X iterazioni completate su 15 (cicli di revisione totali: T).
**Prossima iterazione**: N+1 — <nome>.
**Da preparare in Claude Design prima di lanciarla**: elenco delle schermate, oppure nessuna.
**Per unire il lavoro**: `git switch main && git merge iterazione-NN-<nome>` (lo eseguo se me lo chiedi).
```
