#!/usr/bin/env bash
# Configura un ambiente online di Noxa (staging o produzione) a partire da un file locale
# compilato da .env.ambiente.example (ADR-0021, GUIDA_OPERATIVA.md §9). Si può rieseguire: ogni
# passo controlla lo stato e aggiorna solo ciò che serve.
#
# Uso:
#   scripts/configura_ambiente.sh .env.staging                       # configurazione completa
#   scripts/configura_ambiente.sh .env.staging --moderatore <email>  # ruolo di moderatore
#
# Passi: migrazioni e Edge Functions su Supabase; password del ruolo noxa_worker; segreti del
# Vault e delle funzioni per il Web Push (ADR-0026); impostazioni di Auth (hook dell'età,
# email in italiano, TOTP, Turnstile, SMTP); progetto Cloudflare Pages e bucket R2 nell'UE
# (mappa con CORS, backup); environment di GitHub con segreti e variabili per pubblica.yml,
# worker.yml, backup.yml e mappa.yml.
#
# Nessun segreto viene stampato: i valori passano da file temporanei con permessi 600 o
# dall'input standard. Richiede: curl, jq, openssl, docker (per psql), gh autenticato, pnpm.
set -euo pipefail

RADICE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RADICE"

FILE="${1:?uso: scripts/configura_ambiente.sh <file .env> [--moderatore <email>]}"
shift
MODERATORE=""
if [[ "${1:-}" == "--moderatore" ]]; then MODERATORE="${2:?manca email del moderatore}"; fi

[[ -f "$FILE" ]] || { echo "File $FILE non trovato" >&2; exit 1; }
for comando in curl jq openssl docker gh pnpm node; do
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

# Esegue SQL letto dall'input standard come utente postgres. I valori arrivano come variabili
# d'ambiente (docker -e NOME senza valore le eredita), mai negli argomenti; nel SQL si leggono
# con \getenv.
psql_remoto() {
  local ambiente=(-e PGPASSWORD)
  for nome in "$@"; do ambiente+=(-e "$nome"); done
  PGPASSWORD="$SUPABASE_DB_PASSWORD" docker run --rm -i "${ambiente[@]}" postgres:17-alpine \
    psql "host=$POOLER_HOST port=5432 dbname=postgres user=postgres.$SUPABASE_PROJECT_REF sslmode=require" \
    -v ON_ERROR_STOP=1 -q
}

if [[ -n "$MODERATORE" ]]; then
  passo "Ruolo di moderatore per l'account indicato"
  export MODERATORE
  psql_remoto MODERATORE <<'SQL'
\getenv email MODERATORE
insert into public.ruoli_utente (utente_id, ruolo)
select u.id, 'moderatore' from auth.users u where u.email = :'email'
on conflict do nothing;
select case when exists (select 1 from auth.users where email = :'email')
  then 'Fatto: al primo accesso all''area di moderazione serve attivare i due fattori.'
  else 'Nessun account con questa email: registralo prima dall''app.' end as esito \gset
\echo :esito
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

passo "Migrazioni ed Edge Functions su Supabase ($SUPABASE_PROJECT_REF)"
pnpm exec supabase link --project-ref "$SUPABASE_PROJECT_REF" </dev/null
pnpm exec supabase db push --yes </dev/null

passo "Password del ruolo noxa_worker e segreti del Vault per il Web Push"
export WORKER_DB_PASSWORD NOXA_PUSH_SEGRETO
export URL_PUSH="https://$SUPABASE_PROJECT_REF.supabase.co/functions/v1/invia-push"
psql_remoto WORKER_DB_PASSWORD NOXA_PUSH_SEGRETO URL_PUSH <<'SQL'
\getenv password_worker WORKER_DB_PASSWORD
\getenv url_push URL_PUSH
\getenv segreto_push NOXA_PUSH_SEGRETO
alter role noxa_worker with login password :'password_worker';
-- I blocchi do non vedono le variabili di psql: i valori passano da impostazioni di sessione,
-- senza stampare il risultato della select.
\o /dev/null
select set_config('noxa.url_push', :'url_push', false),
       set_config('noxa.segreto_push', :'segreto_push', false);
\o
do $$
declare
  nome text;
  valore text;
begin
  foreach nome in array array['invia_push_url', 'invia_push_segreto'] loop
    valore := current_setting(case nome when 'invia_push_url' then 'noxa.url_push'
                                        else 'noxa.segreto_push' end);
    if exists (select 1 from vault.secrets s where s.name = nome) then
      perform vault.update_secret((select s.id from vault.secrets s where s.name = nome), valore);
    else
      perform vault.create_secret(valore, nome);
    end if;
  end loop;
end
$$;
SQL

passo "Segreti delle Edge Functions"
{
  printf 'VAPID_PUBLIC_KEY=%s\n' "$VAPID_PUBLIC_KEY"
  printf 'VAPID_PRIVATE_KEY=%s\n' "$VAPID_PRIVATE_KEY"
  printf 'VAPID_SUBJECT=%s\n' "mailto:${EMAIL_MITTENTE:-sicurezza@noxa.app}"
  printf 'NOXA_PUSH_SEGRETO=%s\n' "$NOXA_PUSH_SEGRETO"
} >"$TEMP/segreti_funzioni"
pnpm exec supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" \
  --env-file "$TEMP/segreti_funzioni" </dev/null
pnpm exec supabase functions deploy --use-api --project-ref "$SUPABASE_PROJECT_REF" </dev/null

passo "Impostazioni di Auth"
# Stessi valori di supabase/config.toml, con l'indirizzo dell'app al posto di quello locale.
jq -n \
  --arg sito "$URL_APP" \
  --rawfile conferma supabase/templates/conferma.html \
  --rawfile recupero supabase/templates/recupero.html \
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
    mfa_totp_verify_enabled: true,
    hook_before_user_created_enabled: true,
    hook_before_user_created_uri: "pg-functions://postgres/private/prima_della_creazione_utente",
    mailer_subjects_confirmation: "Conferma la tua email per Noxa",
    mailer_templates_confirmation_content: $conferma,
    mailer_subjects_recovery: "Scegli una nuova password per Noxa",
    mailer_templates_recovery_content: $recupero
  }' >"$TEMP/auth.json"
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
    smtp_sender_name: "Noxa"}' "$TEMP/auth.json" >"$TEMP/auth2.json" &&
    mv "$TEMP/auth2.json" "$TEMP/auth.json"
else
  echo "Brevo non configurato: email dal server di prova di Supabase (solo membri del progetto)."
fi
api_supabase PATCH /config/auth "$TEMP/auth.json" >/dev/null
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
if ! wrangler pages project list --json 2>/dev/null |
  jq -e --arg nome "$CLOUDFLARE_PAGES_PROGETTO" 'any(.[]; (.["Project Name"] // .name) == $nome)' >/dev/null; then
  wrangler pages project create "$CLOUDFLARE_PAGES_PROGETTO" --production-branch main
fi
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
  1. mappa:       gh workflow run mappa.yml -f ambiente=$AMBIENTE
  2. app:         gh workflow run pubblica.yml -f ambiente=$AMBIENTE
  3. servizi:     gh variable set AMBIENTI_SERVIZI --body '["$AMBIENTE"]'
                  gh variable set SERVIZI_ATTIVI --body true
  4. moderatore:  registrati su $URL_APP, poi
                  scripts/configura_ambiente.sh $FILE --moderatore <email>
FINE
