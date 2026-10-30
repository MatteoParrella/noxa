#!/usr/bin/env bash
# Ripristino di un backup cifrato (D-14, ADR-0025). Procedura completa in supabase/README.md.
#
# Uso:
#   AGE_CHIAVE=<file della chiave privata> DATABASE_URL_DESTINAZIONE=<url> \
#     scripts/ripristina_backup.sh <file .sql.gz.age>
#
# La destinazione deve essere un database con le stesse migrazioni del backup e senza dati
# (per esempio un progetto Supabase nuovo dopo `supabase db push`). Il ripristino avviene in
# un'unica transazione con i trigger sospesi (session_replication_role = replica), così le
# regole già verificate all'origine non rifiutano i dati e le notifiche non ripartono.
# I file dello Storage (foto profilo, flyer) non sono nel backup: restano i riferimenti.
set -euo pipefail

FILE="${1:?indica il file del backup}"
: "${AGE_CHIAVE:?manca AGE_CHIAVE (file della chiave privata age)}"
: "${DATABASE_URL_DESTINAZIONE:?manca DATABASE_URL_DESTINAZIONE}"

age --decrypt --identity "$AGE_CHIAVE" "$FILE" | gunzip | psql "$DATABASE_URL_DESTINAZIONE" \
  --single-transaction --set ON_ERROR_STOP=1 --quiet \
  --command 'set session_replication_role = replica' --file -
echo "Ripristino completato da $(basename "$FILE")"
