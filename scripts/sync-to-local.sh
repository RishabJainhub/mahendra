#!/usr/bin/env bash
# Sync latest from GitHub clone into your local TallyBill Pro folder (Downloads).
# Usage: ./scripts/sync-to-local.sh "/Users/rishabpjain/Downloads/Mahendra project"

set -euo pipefail

TARGET="${1:-}"
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$TARGET" ]; then
  echo "Usage: $0 \"/path/to/Mahendra project\""
  exit 1
fi

if [ ! -d "$TARGET" ]; then
  echo "Target directory not found: $TARGET"
  exit 1
fi

echo "Syncing from $SOURCE -> $TARGET"

RSYNC_EXCLUDES=(
  --exclude node_modules
  --exclude .next
  --exclude .git
  --exclude .env.local
)

for dir in lib app components __tests__ scripts; do
  if [ -d "$SOURCE/$dir" ]; then
    rsync -av "${RSYNC_EXCLUDES[@]}" "$SOURCE/$dir/" "$TARGET/$dir/"
  fi
done

for file in package.json package-lock.json next.config.ts tailwind.config.ts middleware.ts tsconfig.json postcss.config.mjs jest.config.js; do
  if [ -f "$SOURCE/$file" ]; then
    cp "$SOURCE/$file" "$TARGET/$file"
  fi
done

if [ -f "$SOURCE/app/globals.css" ]; then
  cp "$SOURCE/app/globals.css" "$TARGET/app/globals.css"
fi

echo ""
echo "Done. In target folder run:"
echo "  cd \"$TARGET\""
echo "  npm install"
echo "  npm run check"
echo "  npm run dev"
echo "  → http://localhost:3001"
