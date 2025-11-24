#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT/frontend"
STATIC_DIR="$ROOT/src/workout_tracker/static"

echo "==> Building frontend inside Docker..."
docker run --rm \
  -v "$FRONTEND_DIR":/workspace \
  -w /workspace \
  node:20 \
  bash -lc "set -euo pipefail; npm install; npm run build"

echo "==> Syncing built assets into Python package..."
mkdir -p "$STATIC_DIR"
rsync -a --delete "$FRONTEND_DIR/dist/" "$STATIC_DIR/"

echo "Frontend assets ready at $STATIC_DIR (included by uv build)."
