#!/usr/bin/env sh

set -eu

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="/tmp/updated_mound_rpg_preview_tui"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

cd "$ROOT_DIR"

tsc \
  --outDir "$OUT_DIR" \
  --rootDir . \
  --module commonjs \
  --moduleResolution node \
  --target es2022 \
  --rewriteRelativeImportExtensions true \
  tests/preview-tui.ts

node "$OUT_DIR/tests/preview-tui.js" "$@"
