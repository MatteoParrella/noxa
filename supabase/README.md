# supabase

Configurazione del backend Supabase (ADR-0002): `config.toml` creato con `supabase init`. La CLI
si esegue con `pnpm exec supabase …` (dipendenza di sviluppo del repository).

| Percorso | Contenuto |
|---|---|
| `migrations/` | Migrazioni SQL con RLS e policy (skill `db-migration`) |
| `tests/` | Test pgTAP: `000_supporto.test.sql` (funzioni di supporto `tests.*`, dall'iterazione 2), `001_rls_abilitata.test.sql` (RLS, viste, schema `private`, ruolo del worker), poi un file per tabella; `scripts/verifica_migrazioni.py` controlla che ogni tabella abbia RLS e test |
| `functions/` | Edge Functions: `invia-push`, `esporta-dati`, `elimina-account` |
| `seed.sql` | Solo locale: utenti di test per età (`minore_14` … `adulto_21`, `moderatore`, `moderatore_senza_mfa`), gruppi e dati di esempio, password del ruolo `noxa_worker` |

Il modello dati di riferimento è `docs/DATA_MODEL.md`.
