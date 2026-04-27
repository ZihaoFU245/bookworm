#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="./dist"

if [[ ! -d "$SITE_DIR" ]]; then
  echo "ERROR: site dir not found: $SITE_DIR" >&2
  exit 1
fi

if ! command -v brotli >/dev/null 2>&1 || ! command -v gzip >/dev/null 2>&1; then
  echo "Installing dependencies..."
  sudo apt-get update
  sudo apt-get install -y brotli gzip
fi

echo "Precompressing in: $SITE_DIR"
echo "Generating: .br and .gz for text assets..."

cd "$SITE_DIR"

compress_file() {
  local f="$1"

  [[ -f "$f" ]] || return 0

  echo "Compressing: $f"
  brotli -f -q 11 -o "${f}.br" "$f"
  gzip -kf -9 "$f"
}

export -f compress_file

find . -type f \( \
  -name '*.html' -o \
  -name '*.css'  -o \
  -name '*.js'   -o \
  -name '*.json' -o \
  -name '*.svg'  -o \
  -name '*.xml'  -o \
  -name '*.txt' \
\) -print0 |
xargs -0 -P"$(nproc)" -I{} bash -c 'compress_file "$1"' _ "{}"

echo "Compression complete."