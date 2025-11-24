#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT/frontend"

ensure_frontend_bundle() {
  if [[ "${SKIP_FRONTEND_BUILD:-0}" == "1" ]]; then
    return
  fi

  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    (cd "$FRONTEND_DIR" && npm install)
  fi

  if [[ ! -d "$FRONTEND_DIR/dist" || "$FRONTEND_DIR/src" -nt "$FRONTEND_DIR/dist" ]]; then
    (cd "$FRONTEND_DIR" && npm run build)
  fi
}

ensure_frontend_bundle

cd "$ROOT"
uv run workout-tracker-api "$@"
