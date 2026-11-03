#!/usr/bin/env bash
# Imports the LendLoop workflows into n8n, activates them, and starts n8n.
# Usage: ./scripts/n8n-setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env.n8n ]]; then
  echo "Missing .env.n8n. Run: cp .env.n8n.example .env.n8n and fill it in." >&2
  exit 1
fi

compose=(docker compose)

"${compose[@]}" run --rm n8n import:workflow --separate --input=/workflows
for id in lendloopErrors01 lendloopNotify01 lendloopRemind01; do
  "${compose[@]}" run --rm n8n publish:workflow --id="$id"
done
"${compose[@]}" up -d
echo "n8n is starting at http://localhost:5678 (create the owner account on first visit)."
