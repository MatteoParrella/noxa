# ADR-0013: Strategia di test

- **Stato**: Accettato
- **Data**: 2026-10-12

## Contesto
Le regole di sicurezza devono essere verificate automaticamente a ogni modifica; un errore in
una policy può esporre un minorenne.

## Decisione
| Livello | Strumento | Obbligo |
|---|---|---|
| Database | pgTAP con `supabase test db` | Ogni policy di ogni tabella con casi positivi e negativi per tutte le età del seed; `001_rls_abilitata` |
| Web, logica e componenti | Vitest + Testing Library | Copertura delle righe ≥ 80% su `src/features` e `src/lib` |
| Web, percorsi | Playwright + axe-core | Percorsi elencati nei criteri di fase; nessuna violazione WCAG AA |
| Worker | pytest + respx (HTTP registrato), nessuna rete reale | Copertura ≥ 85%; fixture HTML per ogni adattatore |
| Deduplicazione | golden set `dedup_golden.jsonl` | Non regressione di precisione e richiamo |
| Flyer | golden set `flyer_golden/` | Eseguito a ogni modifica di prompt, schema o modello (costa: non gira a ogni PR) |
| Contratto | JSON Schema evento | Modelli Pydantic e tipi TypeScript verificati contro lo schema in CI |

## Alternative considerate
- **Testare le regole solo con test e2e**: troppo lenti e incompleti per coprire tutte le
  combinazioni di età.

## Conseguenze
- Il seed con utenti di ogni età è un elemento chiave da mantenere.
