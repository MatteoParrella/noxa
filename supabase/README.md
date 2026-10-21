# supabase

Configurazione del backend Supabase (ADR-0002): `config.toml` creato con `supabase init`. La CLI
si esegue con `pnpm exec supabase …` (dipendenza di sviluppo del repository).

| Percorso | Contenuto |
|---|---|
| `migrations/` | Migrazioni SQL con RLS e policy (skill `db-migration`) |
| `tests/` | Test pgTAP: `000_supporto.test.sql` (funzioni di supporto `tests.*`), `001_rls_abilitata.test.sql` (RLS, viste, schema `private`, ruolo del worker), poi un file per tabella; `scripts/verifica_migrazioni.py` controlla che ogni tabella abbia RLS e test |
| `templates/` | Email di Supabase Auth in italiano: conferma (`conferma.html`) e recupero della password (`recupero.html`), con il link alle pagine dell'app che verificano il `token_hash` |
| `functions/` | Edge Functions: `invia-push`, `esporta-dati`, `elimina-account` |
| `seed.sql` | Solo locale: utenti di test per età (`minore_14` … `adulto_21`, `moderatore`, `moderatore_senza_mfa`, accesso con `<username>@example.com` e `password-di-prova`), password del ruolo `noxa_worker` |

Il modello dati di riferimento è `docs/DATA_MODEL.md`.

## Supabase Auth

In locale `config.toml` imposta tutto. In staging e produzione le stesse impostazioni si
fanno dalla dashboard del progetto, perché `config.toml` vale solo per la CLI:

| Impostazione | Valore | Dove |
|---|---|---|
| Conferma dell'email | attiva | Authentication → Sign In / Providers → Email |
| Lunghezza minima della password | 10 | Authentication → Sign In / Providers → Email |
| Protezione dalle password compromesse | attiva con il piano Pro; sul piano Free non è disponibile (ADR-0021, D-14) | Authentication → Attack Protection |
| SMTP | Brevo, mittente sul dominio di D-01 con SPF e DKIM (ADR-0021) | Authentication → Emails → SMTP Settings |
| CAPTCHA | Cloudflare Turnstile con la chiave segreta del widget (ADR-0020); in locale resta spento | Authentication → Attack Protection |
| Hook "Before User Created" | funzione Postgres `private.prima_della_creazione_utente` | Authentication → Hooks |
| Site URL e Redirect URLs | dominio dell'app (D-01) con `/**` | Authentication → URL Configuration |
| Modelli delle email | contenuto di `templates/conferma.html` e `templates/recupero.html` | Authentication → Emails |
| Frequenza delle email | 60 secondi tra due invii allo stesso indirizzo | Authentication → Rate Limits |

La chiave del sito di Turnstile va in `NEXT_PUBLIC_TURNSTILE_SITE_KEY` nelle variabili di
Cloudflare Pages; la chiave segreta solo in Supabase Auth.
