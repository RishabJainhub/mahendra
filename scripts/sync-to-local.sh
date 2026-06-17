#!/usr/bin/env bash
# Sync latest features from this repo into your local TallyBillPro folder.
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

EX=(--exclude node_modules --exclude .next --exclude .git --exclude .env.local)

for dir in lib app components __tests__ scripts; do
  if [ -d "$SOURCE/$dir" ]; then
    rsync -av "${EX[@]}" "$SOURCE/$dir/" "$TARGET/$dir/"
  fi
done

for f in package.json package-lock.json next.config.ts tsconfig.json jest.config.js; do
  [ -f "$SOURCE/$f" ] && cp "$SOURCE/$f" "$TARGET/$f"
done

echo ""
echo "✓ Sync complete. PDF import files included:"
echo "  - lib/tally/pdf-parser.ts"
echo "  - components/tally/import-format-picker.tsx"
echo "  - app/supplier/import/import-form.tsx"
echo ""
echo "Next steps:"
echo "  cd \"$TARGET\""
echo "  npm install"
echo "  lsof -ti :3001 | xargs kill -9 2>/dev/null || true"
echo "  npm run dev"
echo "  open http://localhost:3001/supplier/import"
