#!/usr/bin/env bash
# Configura un ambiente online di Noxa (staging o produzione) a partire da un file locale
# compilato da .env.ambiente.example (ADR-0021, GUIDA_OPERATIVA.md §9). Si può rieseguire: ogni
# passo controlla lo stato e aggiorna solo ciò che serve.
#
# Uso:
#   scripts/configura_ambiente.sh .env.staging                       # configurazione completa
#   scripts/configura_ambiente.sh .env.staging --moderatore <email>  # ruolo di moderatore
#
# Passi: Edge Functions e loro segreti; impostazioni di Auth (email in italiano, TOTP,
# Turnstile, SMTP); progetto Cloudflare Pages e bucket R2 nell'UE (mappa con CORS, backup);
# environment di GitHub con segreti e variabili per pubblica.yml, worker.yml, backup.yml e
# mappa.yml. Quando le migrazioni sono applicate: password del ruolo noxa_worker, segreti del
# Vault per il Web Push (ADR-0026) e hook dell'età di Auth.
#
# Lo script usa solo HTTPS (porta 443): il SQL passa dall'API di gestione di Supabase, perché
# molte reti bloccano la porta 5432. Le migrazioni le applica pubblica.yml da GitHub; alla
# prima configurazione quindi lo script va eseguito due volte, prima e dopo pubblica.yml.
#
# Nessun segreto viene stampato: i valori passano da file temporanei con permessi 600 o
# dall'input standard. Richiede: curl, jq, openssl, gh autenticato, pnpm, node.
set -euo pipefail

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RADICE"

FILE="${1:?uso: scripts/configura_ambiente.sh <file .env> [--moderatore <email>]}"
shift
MODERATORE=""
if [[ "${1:-}" == "--moderatore" ]]; then MODERATORE="${2:?manca email del moderatore}"; fi

[[ -f "$FILE" ]] || { echo "File $FILE non trovato" >&2; exit 1; }
for comando in curl jq openssl gh pnpm node; do
  command -v "$comando" >/dev/null || { echo "Manca il comando $comando" >&2; exit 1; }
done

set -a
# shellcheck disable=SC1090
source "$FILE"
set +a

: "${AMBIENTE:?manca AMBIENTE}"
[[ "$AMBIENTE" == "staging" || "$AMBIENTE" == "produzione" ]] || {
  echo "AMBIENTE deve essere staging o produzione" >&2; exit 1; }
: "${SUPABASE_PROJECT_REF:?manca SUPABASE_PROJECT_REF}"
: "${SUPABASE_DB_PASSWORD:?manca SUPABASE_DB_PASSWORD}"
: "${SUPABASE_ACCESS_TOKEN:?manca SUPABASE_ACCESS_TOKEN}"
export SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD

TEMP="$(mktemp -d)"
chmod 700 "$TEMP"
trap 'rm -rf "$TEMP"' EXIT

passo() { printf '\n== %s\n' "$*"; }

# Aggiunge una riga CHIAVE=valore al file dell'ambiente se la chiave manca o è vuota.
ricorda() {
  local chiave="$1" valore="$2"
  if grep -q "^${chiave}=" "$FILE"; then
    sed -i "s|^${chiave}=.*|${chiave}=${valore}|" "$FILE"
  else
    printf '%s=%s\n' "$chiave" "$valore" >>"$FILE"
  fi
  printf -v "$chiave" '%s' "$valore"
}

API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF"
# Il token sta in un file di intestazioni, non negli argomenti di curl (visibili con ps).
printf 'Authorization: Bearer %s\nContent-Type: application/json\n' "$SUPABASE_ACCESS_TOKEN" \
  >"$TEMP/intestazioni"
api_supabase() { # api_supabase <metodo> <percorso> [file json]
  local argomenti=(--fail-with-body --silent --show-error -X "$1" "$API$2"
    -H "@$TEMP/intestazioni")
  [[ -n "${3:-}" ]] && argomenti+=(--data-binary "@$3")
  curl "${argomenti[@]}"
}

# Host del pooler di Supavisor in modalità sessione (IPv4: i runner di GitHub e WSL non hanno
# IPv6, necessario per la connessione diretta del piano Free).
POOLER_HOST="$(api_supabase GET /config/database/pooler | jq -r '[.[] | .db_host] | first')"
[[ -n "$POOLER_HOST" && "$POOLER_HOST" != "null" ]] || { echo "Pooler non trovato" >&2; exit 1; }
codifica() { jq -Rrj @uri <<<"$1"; }
url_db() { # url_db <ruolo> <password>
  printf 'postgresql://%s.%s:%s@%s:5432/postgres?sslmode=require' \
    "$1" "$SUPABASE_PROJECT_REF" "$(codifica "$2")" "$POOLER_HOST"
}

# Esegue il SQL letto dall'input standard con l'API di gestione (utente postgres) e stampa
# il risultato in JSON. Il corpo della richiesta sta in un file temporaneo, mai negli argomenti.
sql_remoto() {
  jq -Rs '{query: .}' >"$TEMP/query.json"
  api_supabase POST /database/query "$TEMP/query.json"
}
# Letterale SQL con gli apici raddoppiati.
letterale() { printf "'%s'" "${1//\'/\'\'}"; }

# Le migrazioni sono applicate se esistono il ruolo del worker e l'hook dell'età.
MIGRAZIONI_APPLICATE="$(sql_remoto <<'SQL' | jq -r '.[0].pronte'
select to_regrole('noxa_worker') is not null
   and to_regprocedure('private.prima_della_creazione_utente(jsonb)') is not null as pronte;
SQL
)"

if [[ -n "$MODERATORE" ]]; then
  passo "Ruolo di moderatore per l'account indicato"
  [[ "$MIGRAZIONI_APPLICATE" == "true" ]] || { echo "Migrazioni non applicate" >&2; exit 1; }
  sql_remoto <<SQL | jq -r '.[0].esito'
insert into public.ruoli_utente (utente_id, ruolo)
select u.id, 'moderatore' from auth.users u where u.email = $(letterale "$MODERATORE")
on conflict do nothing;
select case when exists (select 1 from auth.users where email = $(letterale "$MODERATORE"))
  then 'Fatto: al primo accesso all''area di moderazione serve attivare i due fattori.'
  else 'Nessun account con questa email: registralo prima dall''app.' end as esito;
SQL
  exit 0
fi

: "${URL_APP:?manca URL_APP}"
: "${CLOUDFLARE_ACCOUNT_ID:?manca CLOUDFLARE_ACCOUNT_ID}"
: "${CLOUDFLARE_API_TOKEN:?manca CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_PAGES_PROGETTO:?manca CLOUDFLARE_PAGES_PROGETTO}"
: "${R2_ACCESS_KEY_ID:?manca R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?manca R2_SECRET_ACCESS_KEY}"
URL_APP="${URL_APP%/}"
export CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_API_TOKEN

# Valori generati una volta e poi riusati.
[[ -n "${WORKER_DB_PASSWORD:-}" ]] || ricorda WORKER_DB_PASSWORD "$(openssl rand -hex 24)"
[[ -n "${NOXA_PUSH_SEGRETO:-}" ]] || ricorda NOXA_PUSH_SEGRETO "$(openssl rand -hex 32)"
if [[ -z "${VAPID_PRIVATE_KEY:-}" ]]; then
  while IFS='=' read -r chiave valore; do
    [[ "$chiave" == VAPID_* ]] && ricorda "$chiave" "$valore"
  done < <(node scripts/genera_chiavi_vapid.mjs)
fi

if [[ "$MIGRAZIONI_APPLICATE" == "true" ]]; then
  passo "Password del ruolo noxa_worker e segreti del Vault per il Web Push"
  URL_PUSH="https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/invia-push"
  sql_remoto >/dev/null <<SQL
alter role noxa_worker with login password $(letterale "$WORKER_DB_PASSWORD");
do \$\$
declare
  segreti constant jsonb := jsonb_build_object(
    'invia_push_url', $(letterale "$URL_PUSH"),
    'invia_push_segreto', $(letterale "$NOXA_PUSH_SEGRETO"));
  nome text;
begin
  for nome in select jsonb_object_keys(segreti) loop
    if exists (select 1 from vault.secrets s where s.name = nome) then
      perform vault.update_secret((select s.id from vault.secrets s where s.name = nome),
                                  segreti ->> nome);
    else
      perform vault.create_secret(segreti ->> nome, nome);
    end if;
  end loop;
end
\$\$;
SQL
  echo "Fatto."
else
  echo "Migrazioni non ancora applicate: ruolo del worker, Vault e hook dell'età al prossimo giro."
fi

passo "Segreti delle Edge Functions"
{
  printf 'VAPID_PUBLIC_KEY=%s\n' "$VAPID_PUBLIC_KEY"
  printf 'VAPID_PRIVATE_KEY=%s\n' "$VAPID_PRIVATE_KEY"
  printf 'VAPID_SUBJECT=%s\n' "mailto:${EMAIL_MITTENTE:-sicurezza@noxanight.it}"
  printf 'NOXA_PUSH_SEGRETO=%s\n' "$NOXA_PUSH_SEGRETO"
} >"$TEMP/segreti_funzioni"
pnpm exec supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" \
  --env-file "$TEMP/segreti_funzioni" </dev/null
pnpm exec supabase functions deploy --use-api --project-ref "$SUPABASE_PROJECT_REF" </dev/null

passo "Impostazioni di Auth"
# Stessi valori di supabase/config.toml, con l'indirizzo dell'app al posto di quello locale.
jq -n \
  --arg sito "$URL_APP" \
  '{
    site_url: $sito,
    uri_allow_list: ($sito + "/**"),
    disable_signup: false,
    external_email_enabled: true,
    mailer_autoconfirm: false,
    mailer_secure_email_change_enabled: true,
    mailer_otp_exp: 3600,
    smtp_max_frequency: 60,
    password_min_length: 10,
    jwt_exp: 3600,
    refresh_token_rotation_enabled: true,
    security_refresh_token_reuse_interval: 10,
    mfa_totp_enroll_enabled: true,
    mfa_totp_verify_enabled: true
  }' >"$TEMP/auth.json"
# L'hook dell'età (R-01) si attiva solo se la funzione esiste già nel database.
if [[ "$MIGRAZIONI_APPLICATE" == "true" ]]; then
  jq '. + {hook_before_user_created_enabled: true,
    hook_before_user_created_uri: "pg-functions://postgres/private/prima_della_creazione_utente"}' \
    "$TEMP/auth.json" >"$TEMP/auth2.json" && mv "$TEMP/auth2.json" "$TEMP/auth.json"
fi
if [[ -n "${TURNSTILE_SECRET:-}" ]]; then
  jq --arg segreto "$TURNSTILE_SECRET" '. + {security_captcha_enabled: true,
    security_captcha_provider: "turnstile", security_captcha_secret: $segreto}' \
    "$TEMP/auth.json" >"$TEMP/auth2.json" && mv "$TEMP/auth2.json" "$TEMP/auth.json"
else
  echo "TURNSTILE_SECRET vuoto: CAPTCHA spento (la registrazione resta senza Turnstile)."
fi
if [[ -n "${BREVO_SMTP_CHIAVE:-}" ]]; then
  : "${BREVO_SMTP_UTENTE:?manca BREVO_SMTP_UTENTE}" "${EMAIL_MITTENTE:?manca EMAIL_MITTENTE}"
  jq --arg utente "$BREVO_SMTP_UTENTE" --arg chiave "$BREVO_SMTP_CHIAVE" \
    --arg mittente "$EMAIL_MITTENTE" '. + {smtp_host: "smtp-relay.brevo.com", smtp_port: "587",
    smtp_user: $utente, smtp_pass: $chiave, smtp_admin_email: $mittente,
    smtp_sender_name: "Noxa", rate_limit_email_sent: 30}' "$TEMP/auth.json" >"$TEMP/auth2.json" &&
    mv "$TEMP/auth2.json" "$TEMP/auth.json"
  # I modelli delle email (link alla pagina /accesso/conferma/ dell'app) si possono cambiare
  # sul piano Free solo con un SMTP proprio.
  jq --rawfile conferma supabase/templates/conferma.html \
    --rawfile recupero supabase/templates/recupero.html '. + {
    mailer_subjects_confirmation: "Conferma la tua email per Noxa",
    mailer_templates_confirmation_content: $conferma,
    mailer_subjects_recovery: "Scegli una nuova password per Noxa",
    mailer_templates_recovery_content: $recupero}' "$TEMP/auth.json" >"$TEMP/auth2.json" &&
    mv "$TEMP/auth2.json" "$TEMP/auth.json"
else
  echo "Brevo non configurato: email dal server di prova di Supabase (solo membri del"
  echo "progetto) e con i modelli predefiniti, che il piano Free non lascia cambiare senza SMTP."
fi
api_supabase PATCH /config/auth "$TEMP/auth.json" >"$TEMP/esito_auth" ||
  { jq -r '.message // .' "$TEMP/esito_auth" >&2; exit 1; }
echo "Auth aggiornato."

passo "Chiavi pubbliche e di servizio del progetto"
api_supabase GET "/api-keys?reveal=true" >"$TEMP/chiavi.json"
CHIAVE_ANON="$(jq -r '(map(select(.name == "anon")) + map(select(.type == "publishable")))
  | first | .api_key' "$TEMP/chiavi.json")"
jq -r '(map(select(.name == "service_role")) + map(select(.type == "secret")))
  | first | .api_key' "$TEMP/chiavi.json" >"$TEMP/service_role"
[[ -n "$CHIAVE_ANON" && "$CHIAVE_ANON" != "null" ]] || { echo "Chiave anon non trovata" >&2; exit 1; }

passo "Cloudflare Pages e R2"
wrangler() { pnpm exec wrangler "$@" </dev/null; }
# Il progetto Pages si crea con l'API REST: le versioni recenti di wrangler provano a
# trasformarlo in un Worker, cosa che in un monorepo fallisce.
printf 'Authorization: Bearer %s\nContent-Type: application/json\n' "$CLOUDFLARE_API_TOKEN" \
  >"$TEMP/intestazioni_cf"
API_PAGES="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects"
if ! curl --silent --show-error -H "@$TEMP/intestazioni_cf" "$API_PAGES/$CLOUDFLARE_PAGES_PROGETTO" |
  jq -e '.success' >/dev/null; then
  jq -n --arg nome "$CLOUDFLARE_PAGES_PROGETTO" '{name: $nome, production_branch: "main"}' \
    >"$TEMP/pages.json"
  curl --silent --show-error -H "@$TEMP/intestazioni_cf" -X POST "$API_PAGES" \
    --data-binary "@$TEMP/pages.json" >"$TEMP/esito_pages"
  jq -e '.success' "$TEMP/esito_pages" >/dev/null ||
    { jq -r '[.errors[].message] | join("; ")' "$TEMP/esito_pages" >&2; exit 1; }
  echo "Progetto Pages $CLOUDFLARE_PAGES_PROGETTO creato."
fi
SOTTODOMINIO="$(curl --silent -H "@$TEMP/intestazioni_cf" "$API_PAGES/$CLOUDFLARE_PAGES_PROGETTO" |
  jq -r '.result.subdomain')"
[[ "https://$SOTTODOMINIO" == "$URL_APP" ]] ||
  echo "Attenzione: Pages risponde su https://$SOTTODOMINIO, diverso da URL_APP ($URL_APP)."
BUCKET_MAPPE="$CLOUDFLARE_PAGES_PROGETTO-mappe"
BUCKET_BACKUP="$CLOUDFLARE_PAGES_PROGETTO-backup"
for bucket in "$BUCKET_MAPPE" "$BUCKET_BACKUP"; do
  if ! wrangler r2 bucket info "$bucket" --jurisdiction eu >/dev/null 2>&1; then
    wrangler r2 bucket create "$bucket" --jurisdiction eu
  fi
done
# La mappa si legge a pezzi (richieste con Range) dall'app web e dalle app native.
jq -n --arg sito "$URL_APP" '{rules: [{
  allowed: {origins: [$sito, "https://localhost", "capacitor://localhost"],
            methods: ["GET", "HEAD"], headers: ["range", "if-match"]},
  exposeHeaders: ["etag", "content-range", "content-length", "accept-ranges"],
  maxAgeSeconds: 86400}]}' >"$TEMP/cors.json"
pnpm exec wrangler r2 bucket cors set "$BUCKET_MAPPE" --jurisdiction eu \
  --file "$TEMP/cors.json" --force </dev/null
# Indirizzo pubblico della mappa: r2.dev finché il bucket non ha il sottodominio mappe. del
# dominio di D-01 (che si imposta con `wrangler r2 bucket domain add`).
if [[ -z "${URL_MAPPA:-}" ]]; then
  wrangler r2 bucket dev-url enable "$BUCKET_MAPPE" --jurisdiction eu --force >/dev/null 2>&1 || true
  URL_MAPPA="$(wrangler r2 bucket dev-url get "$BUCKET_MAPPE" --jurisdiction eu 2>&1 |
    grep -o 'https://pub-[a-z0-9]*\.r2\.dev' | head -1)"
  [[ -n "$URL_MAPPA" ]] || { echo "Indirizzo r2.dev della mappa non trovato" >&2; exit 1; }
fi

passo "Chiave del backup"
if [[ -z "${AGE_DESTINATARIO:-}" ]]; then
  if command -v age-keygen >/dev/null; then
    PRIVATA="$HOME/noxa-backup-$AMBIENTE.age.txt"
    [[ -f "$PRIVATA" ]] || (umask 077 && age-keygen -o "$PRIVATA" 2>/dev/null)
    ricorda AGE_DESTINATARIO "$(age-keygen -y "$PRIVATA")"
    echo "Chiave privata del backup in $PRIVATA: copiala fuori linea e cancellala dal PC."
  else
    echo "age-keygen non installato (sudo apt install age): backup non configurato."
  fi
fi

passo "Environment $AMBIENTE su GitHub"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh api -X PUT "repos/$REPO/environments/$AMBIENTE" --input - >/dev/null <<'JSON'
{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}
JSON
if ! gh api "repos/$REPO/environments/$AMBIENTE/deployment-branch-policies" \
  -q '.branch_policies[].name' | grep -qx main; then
  gh api -X POST "repos/$REPO/environments/$AMBIENTE/deployment-branch-policies" \
    -f name=main -f type=branch >/dev/null
fi
segreto() { gh secret set "$1" --env "$AMBIENTE" --repo "$REPO" <<<"$2" >/dev/null; }
variabile() { gh variable set "$1" --env "$AMBIENTE" --repo "$REPO" --body "$2" >/dev/null; }

segreto SUPABASE_ACCESS_TOKEN "$SUPABASE_ACCESS_TOKEN"
segreto SUPABASE_DB_PASSWORD "$SUPABASE_DB_PASSWORD"
segreto SUPABASE_URL "https://$SUPABASE_PROJECT_REF.supabase.co"
segreto SUPABASE_SERVICE_ROLE_KEY "$(cat "$TEMP/service_role")"
segreto WORKER_DATABASE_URL "$(url_db noxa_worker "$WORKER_DB_PASSWORD")"
segreto DATABASE_URL_BACKUP "$(url_db postgres "$SUPABASE_DB_PASSWORD")"
segreto CLOUDFLARE_API_TOKEN "$CLOUDFLARE_API_TOKEN"
segreto R2_ACCOUNT_ID "$CLOUDFLARE_ACCOUNT_ID"
segreto R2_MAPPE_ACCESS_KEY_ID "$R2_ACCESS_KEY_ID"
segreto R2_MAPPE_SECRET_ACCESS_KEY "$R2_SECRET_ACCESS_KEY"
segreto R2_BACKUP_ACCESS_KEY_ID "${R2_BACKUP_ACCESS_KEY_ID:-$R2_ACCESS_KEY_ID}"
segreto R2_BACKUP_SECRET_ACCESS_KEY "${R2_BACKUP_SECRET_ACCESS_KEY:-$R2_SECRET_ACCESS_KEY}"

variabile SUPABASE_PROJECT_REF "$SUPABASE_PROJECT_REF"
variabile CLOUDFLARE_ACCOUNT_ID "$CLOUDFLARE_ACCOUNT_ID"
variabile CLOUDFLARE_PAGES_PROGETTO "$CLOUDFLARE_PAGES_PROGETTO"
variabile R2_BUCKET_MAPPE "$BUCKET_MAPPE"
variabile R2_BUCKET_BACKUP "$BUCKET_BACKUP"
[[ -n "${AGE_DESTINATARIO:-}" ]] && variabile AGE_DESTINATARIO "$AGE_DESTINATARIO"
variabile NEXT_PUBLIC_SUPABASE_URL "https://$SUPABASE_PROJECT_REF.supabase.co"
variabile NEXT_PUBLIC_SUPABASE_ANON_KEY "$CHIAVE_ANON"
variabile NEXT_PUBLIC_MAPPA_PMTILES_URL "$URL_MAPPA/milano-brianza.pmtiles"
variabile NEXT_PUBLIC_TURNSTILE_SITE_KEY "${TURNSTILE_SITE_KEY:-}"
variabile NEXT_PUBLIC_URL_APP "$URL_APP"
variabile NEXT_PUBLIC_VAPID_PUBLIC_KEY "$VAPID_PUBLIC_KEY"

cat <<FINE

Ambiente $AMBIENTE configurato.
Prossimi passi (GUIDA_OPERATIVA.md §9):
  1. migrazioni e app:  gh workflow run pubblica.yml -f ambiente=$AMBIENTE
  2. di nuovo:          scripts/configura_ambiente.sh $FILE   (worker, Vault, hook dell'età)
  3. mappa:             gh workflow run mappa.yml -f ambiente=$AMBIENTE
  4. servizi:           gh variable set AMBIENTI_SERVIZI --body '["$AMBIENTE"]'
                        gh variable set SERVIZI_ATTIVI --body true
  5. moderatore:        registrati su $URL_APP, poi
                        scripts/configura_ambiente.sh $FILE --moderatore <email>
FINE
