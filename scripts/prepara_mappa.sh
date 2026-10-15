#!/usr/bin/env bash
# Scarica la basemap di Milano e Brianza e la carica nel bucket `mappe` (ADR-0016).
#
# Uso:
#   scripts/prepara_mappa.sh                       # Supabase locale (chiave da `supabase status`)
#   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… scripts/prepara_mappa.sh   # staging o produzione
#
# Variabili facoltative: DATA_BUILD (AAAAMMGG della build di Protomaps, predefinita: ieri),
# CARTELLA (dove scaricare i file, predefinita: una cartella temporanea), PMTILES (file già
# estratto da caricare senza riscaricarlo).
# Richiede la CLI `pmtiles` (https://github.com/protomaps/go-pmtiles). La chiave service_role
# resta solo nell'ambiente di chi esegue lo script, mai nell'app (CLAUDE.md).
set -euo pipefail

RIQUADRO="8.65,45.15,9.60,45.80"   # province di Milano e Monza e Brianza
ZOOM_MASSIMO=15
DATA_BUILD="${DATA_BUILD:-$(date -u -d yesterday +%Y%m%d)}"
CARTELLA="${CARTELLA:-$(mktemp -d)}"
ASSETS="https://raw.githubusercontent.com/protomaps/basemaps-assets/main"
# Intervalli di glifi per l'italiano: latino, latino esteso, punteggiatura.
INTERVALLI=("0-255" "256-511" "8192-8447")
FONT=("Noto Sans Regular" "Noto Sans Medium" "Noto Sans Italic")

if [[ -z "${SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  stato="$(pnpm exec supabase status -o env 2>/dev/null)"
  SUPABASE_URL="$(sed -n 's/^API_URL="\(.*\)"$/\1/p' <<<"$stato")"
  SUPABASE_SERVICE_ROLE_KEY="$(sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p' <<<"$stato")"
fi
[[ -n "$SUPABASE_URL" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]] || { echo "Supabase non raggiungibile" >&2; exit 1; }

carica() { # carica <file locale> <percorso nel bucket> <content-type>
  curl --fail --silent --show-error -X POST "$SUPABASE_URL/storage/v1/object/mappe/$2" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "x-upsert: true" -H "Content-Type: $3" -H "Cache-Control: max-age=86400" \
    --data-binary "@$1" >/dev/null
}

if [[ -z "${PMTILES:-}" ]]; then
  echo "Estraggo la build $DATA_BUILD di Protomaps in $CARTELLA"
  PMTILES="$CARTELLA/milano-brianza.pmtiles"
  pmtiles extract "https://build.protomaps.com/$DATA_BUILD.pmtiles" "$PMTILES" \
    --bbox="$RIQUADRO" --maxzoom="$ZOOM_MASSIMO"
fi
carica "$PMTILES" "milano-brianza.pmtiles" "application/octet-stream"

for font in "${FONT[@]}"; do
  for intervallo in "${INTERVALLI[@]}"; do
    file="$CARTELLA/glifo.pbf"
    curl --fail --silent --show-error -o "$file" "$ASSETS/fonts/${font// /%20}/$intervallo.pbf"
    carica "$file" "assets/fonts/${font// /%20}/$intervallo.pbf" "application/x-protobuf"
  done
done
echo "Mappa caricata nel bucket mappe di $SUPABASE_URL"
