#!/usr/bin/env bash
# Testes completos em ambiente local (nada toca o site no ar).
# Cada bateria roda contra um banco e um KV locais zerados, com o catálogo
# migrado (67 produtos) — uma bateria não depende do que a outra fez.
# Uso: scripts/testar-local.sh [unit|api|e2e]   (sem argumento = todas)
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .dev.vars ] || cp .dev.vars.exemplo .dev.vars
DEV=""
parar() { [ -n "$DEV" ] && kill "$DEV" 2>/dev/null || true; pkill -f "wrangler dev" 2>/dev/null || true; DEV=""; }
trap parar EXIT

subir() {
  parar
  sleep 1
  rm -rf .wrangler/state
  npx wrangler d1 migrations apply eloa --local > /dev/null
  mkdir -p .wrangler
  npx wrangler dev --port 8787 --ip 127.0.0.1 > .wrangler/dev.log 2>&1 &
  DEV=$!
  for _ in $(seq 1 60); do curl -sf http://localhost:8787/api/catalogo > /dev/null && return 0; sleep 1; done
  echo "O Worker local não subiu. Veja .wrangler/dev.log" >&2; exit 1
}

case "${1:-todas}" in
  unit) npm test ;;
  api)  subir; npm run test:api ;;
  e2e)  subir; npm run test:e2e ;;
  *)    npm test; subir; npm run test:api; subir; npm run test:e2e ;;
esac
