# supabase

Configurazione del backend Supabase (ADR-0002). Inizializzata nella Fase 0 con
`supabase init`, che crea `config.toml`.

| Percorso | Contenuto |
|---|---|
| `migrations/` | Migrazioni SQL con RLS e policy (skill `db-migration`) |
| `tests/` | Test pgTAP: `000_supporto.test.sql` (funzioni di supporto `tests.*`), `001_rls_abilitata.test.sql`, poi un file per tabella |
| `functions/` | Edge Functions: `invia-push`, `esporta-dati`, `elimina-account` |
| `seed.sql` | Solo locale: utenti di test per età (`minore_14` … `adulto_21`, `moderatore`, `moderatore_senza_mfa`), gruppi e dati di esempio, password del ruolo `noxa_worker` |

Il modello dati di riferimento è `docs/DATA_MODEL.md`.
