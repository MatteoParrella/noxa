#!/usr/bin/env bash
# Backup notturno cifrato del database su Cloudflare R2 (D-14, ADR-0025).
#
# Esporta i dati (non lo schema, che viene dalle migrazioni) degli schemi public e private e
# delle tabelle di Supabase Auth e dello Storage che descrivono account e file, li comprime,
# li cifra con `age` per il destinatario pubblico AGE_DESTINATARIO e li carica in R2 con il
# nome backup/AAAA-MM-GG.sql.gz.age. Elimina i backup più vecchi di GIORNI_CONSERVAZIONE
# (30, SAFETY_PRIVACY.md §10). Il file in chiaro non tocca mai il disco.
#
# Variabili:
#   DATABASE_URL_BACKUP   connessione con un ruolo che legge tutti i dati, per esempio con
#                         pg_read_all_data (segreto)
#   AGE_DESTINATARIO      chiave pubblica age; la chiave privata resta fuori da GitHub
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_BACKUP
#   GIORNI_CONSERVAZIONE  facoltativa, predefinita 30
#   SOLO_FILE             facoltativa: scrive il file cifrato qui invece di caricarlo (prove)
# Richiede pg_dump 17, gzip, age e la CLI aws (presente sui runner di GitHub).
# Nessun dato personale nei log: solo nomi dei file e conteggi.
set -euo pipefail

: "${DATABASE_URL_BACKUP:?manca DATABASE_URL_BACKUP}"
: "${AGE_DESTINATARIO:?manca AGE_DESTINATARIO}"
GIORNI="${GIORNI_CONSERVAZIONE:-30}"
NOME="backup/$(date -u +%Y-%m-%d).sql.gz.age"

TABELLE_SUPABASE=(
  auth.users auth.identities auth.mfa_factors auth.mfa_amr_claims
  storage.buckets storage.objects
)
# Con --table pg_dump ignora --schema: gli schemi dell'app si indicano come modelli.
argomenti=(--data-only --no-owner --no-privileges --table='public.*' --table='private.*')
for tabella in "${TABELLE_SUPABASE[@]}"; do argomenti+=("--table=$tabella"); done

esporta() {
  pg_dump "${argomenti[@]}" "$DATABASE_URL_BACKUP" | gzip -9 | age --encrypt --recipient "$AGE_DESTINATARIO"
}

if [[ -n "${SOLO_FILE:-}" ]]; then
  esporta >"$SOLO_FILE"
  echo "Backup cifrato scritto in $SOLO_FILE"
  exit 0
fi

: "${R2_ACCOUNT_ID:?manca R2_ACCOUNT_ID}"
: "${R2_BUCKET_BACKUP:?manca R2_BUCKET_BACKUP}"
export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID:?manca R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY:?manca R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION=auto
ENDPOINT="https://${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com"

esporta | aws s3 cp - "s3://$R2_BUCKET_BACKUP/$NOME" --endpoint-url "$ENDPOINT" --only-show-errors
echo "Backup caricato: $NOME"

limite="$(date -u -d "-$GIORNI days" +%Y-%m-%d)"
eliminati=0
while read -r chiave; do
  giorno="$(basename "$chiave" .sql.gz.age)"
  if [[ "$giorno" < "$limite" ]]; then
    aws s3 rm "s3://$R2_BUCKET_BACKUP/$chiave" --endpoint-url "$ENDPOINT" --only-show-errors
    eliminati=$((eliminati + 1))
  fi
done < <(aws s3api list-objects-v2 --bucket "$R2_BUCKET_BACKUP" --prefix backup/ \
  --endpoint-url "$ENDPOINT" --query 'Contents[].Key' --output text | tr '\t' '\n' | grep -v '^None$' || true)
echo "Backup oltre $GIORNI giorni eliminati: $eliminati"
