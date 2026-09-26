#!/usr/bin/env bash
# Refreshes agent/offline-snapshot.ndjson from the live production dataset,
# for --offline mode. Run this before taking the agent into the field, or
# whenever the dataset changes. Requires a Sanity CLI login (npx sanity login).
set -euo pipefail
cd "$(dirname "$0")/.."

TMP="scripts/snapshot-export.tar.gz"

(cd studio && npx sanity datasets export production "../$TMP" \
  --no-assets --no-drafts --types surveyPaper,surveySite,vesReading --raw --overwrite)

tar -xzf "$TMP" --wildcards "*/data.ndjson" -O > agent/offline-snapshot.ndjson
rm "$TMP"

count=$(wc -l < agent/offline-snapshot.ndjson)
echo "Refreshed agent/offline-snapshot.ndjson ($count documents)."
