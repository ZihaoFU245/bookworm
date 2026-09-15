#!/usr/bin/env bash
set -euo pipefail

SITE_DIR="${SITE_DIR:-./dist}"
COMPRESS_JOBS="${COMPRESS_JOBS:-2}"

if [[ ! -d "$SITE_DIR" ]]; then
  echo "ERROR: site dir not found: $SITE_DIR" >&2
  exit 1
fi

for command in brotli gzip; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $command" >&2
    exit 1
  }
done

echo "Precompressing in: $SITE_DIR"
echo "Generating: .br and .gz for compressible assets..."

compress_file() {
  local f="$1"

  [[ -f "$f" ]] || return 0

  echo "Compressing: $f"
  brotli -f -q 11 -o "${f}.br" "$f"
  gzip -kf -9 "$f"
}

export -f compress_file

find "$SITE_DIR" -type f \( \
  -name '*.html' -o \
  -name '*.css'  -o \
  -name '*.js'   -o \
  -name '*.json' -o \
  -name '*.svg'  -o \
  -name '*.xml'  -o \
  -name '*.txt'  -o \
  -name '*.glb' \
\) -print0 |
xargs -0 -P"$COMPRESS_JOBS" -I{} bash -c 'compress_file "$1"' _ "{}"

echo "Compression complete."
