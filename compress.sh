#!/usr/bin/env bash
set -euo pipefail

# Set directory to the build output
SITE_DIR="./dist"

if [[ ! -d "$SITE_DIR" ]]; then
  echo "ERROR: site dir not found: $SITE_DIR" >&2
  exit 1
fi

# Ensure dependencies are installed (for GitHub Actions runners)
if ! command -v brotli >/dev/null 2>&1 || ! command -v gzip >/dev/null 2>&1; then
  echo "Installing dependencies..."
  sudo apt-get update && sudo apt-get install -y brotli gzip
fi

echo "Precompressing in: $SITE_DIR"
echo "Generating: .br (brotli) and .gz (gzip) for text assets..."

cd "$SITE_DIR"

# Use find and xargs for parallel execution
find . -type f \
  \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.json' -o -name '*.svg' -o -name '*.xml' -o -name '*.txt' \) \
  -print0 \
| xargs -0 -n1 -P"$(nproc)" bash -c '
  f="$1"
  # Skip if file was deleted or is already a compressed extension
  [[ ! -f "$f" ]] && exit 0
  case "$f" in
    *.br|*.gz) exit 0 ;;
  esac

  # Brotli (Max compression level 11)
  brotli -f -q 11 -o "${f}.br" "$f"

  # Gzip (Max compression level 9)
  gzip -kf -9 "$f"
' _

echo "Compression complete."