---
name: new-feature
description: Flusso standard per sviluppare una nuova funzionalità di Noxa o modificare un comportamento esistente - aggiorna PRD, pianifica, implementa, testa, aggiorna i documenti, esegue la safety-review. Da usare all'inizio di qualsiasi lavoro che cambia ciò che l'utente vede o i dati che il sistema tratta.
---

# Nuova funzionalità

Il flusso è sempre: **PRD → piano → implementazione → test → documenti → safety-review →
PR**. Non si salta nessun passo; per una piccola modifica i passi sono brevi, ma ci sono
tutti.

## 1. PRD

1. Cerca la funzionalità in `docs/PRD.md` §4.
   - Se esiste: rileggi i criteri di accettazione e le regole collegate nella matrice §7.
   - Se non esiste: aggiungila nella sezione giusta con il primo ID libero (`F-xx`),
     priorità (P0, P1, P2), fase e **criteri di accettazione verificabili** (numeri, stati,
     limiti). Aggiungi la riga nella matrice di tracciabilità §7.
2. Verifica che non sia nel fuori perimetro (PRD §6). Se lo è, fermati: serve un ADR
   approvato dal product owner.
3. Leggi le regole citate in `docs/SAFETY_PRIVACY.md`. Se la funzionalità tocca dati
   personali, posizione, contatti tra utenti o contenuti caricati, fai **subito** una prima
   passata della checklist di `safety-review` per evitare di progettare qualcosa che non può
   essere rilasciato.
4. Se serve una decisione non ancora presa, aggiungila a `docs/DECISIONI_APERTE.md` e
   chiedila prima di procedere.

## 2. Piano

Scrivi il piano nella descrizione della PR in bozza (o nel thread di lavoro) con:

```markdown
## Piano — F-xx <nome>
**Obiettivo**: una frase.
**Dati**: tabelle e colonne nuove o modificate; policy per S/I/U/D; regole R-xx applicate.
**Backend**: migrazioni, RPC, trigger, Edge Functions, job del worker.
**Frontend**: schermate (con il riferimento in design/F-xx-nome/), componenti, query.
**Errori**: cosa può andare storto e come lo vede l'utente.
**Test**: pgTAP (casi per età), unitari, e2e, accessibilità.
**Documenti da aggiornare**: elenco.
**Rischi e domande aperte**: elenco.
```

Ordina il lavoro in passi piccoli, ognuno verificabile: prima i dati e le policy, poi la
logica, poi l'interfaccia.

## 3. Implementazione

1. **Database** con la skill `db-migration` (migrazione, policy, test pgTAP, tipi generati).
2. **Worker** (se serve): moduli in `services/worker/src/noxa_worker/`, tipi Pydantic,
   eccezioni tipizzate, log con `structlog`; nuovi job come valori di `tipo_job` e
   accodamento da `pg_cron` o da trigger (mai uno scheduler nel worker).
3. **Edge Functions** (se servono segreti di terze parti o `service_role`): in
   `supabase/functions/<nome>/`, verifica del JWT, input validato, nessun dato personale nei
   log.
4. **App**:
   - logica e query in `apps/web/src/features/<area>/` con TanStack Query e Zod;
   - schermate con la skill `implement-design`;
   - errori convertiti con `src/lib/errori.ts`; testi in `src/lib/messaggi/it.ts`;
   - stati di caricamento, vuoto, errore, offline.
5. Rispetta le convenzioni di `CLAUDE.md` (lingua, tipi strict, niente `any`, niente
   `console.log`, niente `TODO`).

## 4. Test

```bash
supabase db reset && supabase test db
pnpm --filter web lint && pnpm --filter web typecheck && pnpm --filter web test
pnpm --filter web test:e2e
cd services/worker && uv run ruff check . && uv run mypy src tests && uv run pytest   # se toccato
```

- Ogni criterio di accettazione del PRD ha almeno un test che lo verifica (unitario o e2e).
  Nella PR elenca la corrispondenza criterio → test.
- I percorsi utente principali hanno un test e2e con verifica axe.
- Le regole d'età sono testate con tutti gli utenti del seed pertinenti.

## 5. Documenti

Aggiorna nella **stessa PR**:

| Se hai cambiato… | Aggiorna |
|---|---|
| comportamento visibile | `docs/PRD.md` (criteri e matrice §7) |
| componenti o flussi | `docs/ARCHITECTURE.md` (tabelle e diagrammi Mermaid) |
| tabelle, policy, funzioni, storage, job | `docs/DATA_MODEL.md` |
| regole di sicurezza o conservazione | `docs/SAFETY_PRIVACY.md` + ADR |
| fase o criteri di completamento | `docs/ROADMAP.md` |
| una scelta tecnica importante | nuovo ADR + `docs/decisions/README.md` |
| schema evento | `packages/schemas/evento.schema.json` + `docs/EVENT_INGESTION.md` §3.3 |
| comandi o struttura | `CLAUDE.md` e `README.md` |

Controlla la coerenza:
```bash
python3 scripts/verifica_documentazione.py
grep -rn "<nome_tabella_o_ID>" docs CLAUDE.md README.md .claude
```

## 6. Safety review

Esegui la skill `safety-review` e incolla il rapporto nella PR. Se l'esito è "NON
SUPERATA", torna al passo 3.

## 7. Pull request

- Titolo in italiano all'imperativo: `F-xx: aggiungi conferme in tempo reale alla serata`.
- Descrizione: piano (aggiornato a quanto fatto), corrispondenza criteri → test, rapporto di
  `safety-review`, schermate o video per le modifiche visive, migrazioni incluse.
- CI verde e approvazione di almeno un'altra persona.

## Definizione di completato

Vedi `docs/ROADMAP.md` §6. In sintesi: PRD e documenti aggiornati, migrazioni con RLS e
test, codice tipizzato con gestione degli errori e logging, test verdi, accessibilità
verificata, `safety-review` superata, revisione approvata.
