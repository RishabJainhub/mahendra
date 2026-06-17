#!/usr/bin/env bash
# Sync latest features from GitHub clone into your local TallyBillPro folder (Downloads).
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

rsync -av "${RSYNC_EXCLUDES[@]}" \
  "$SOURCE/lib/" "$TARGET/lib/"
rsync -av "${RSYNC_EXCLUDES[@]}" \
  "$SOURCE/app/" "$TARGET/app/"
rsync -av "${RSYNC_EXCLUDES[@]}" \
  "$SOURCE/components/" "$TARGET/components/"
rsync -av "${RSYNC_EXCLUDES[@]}" \
  "$SOURCE/__tests__/" "$TARGET/__tests__/"

cp "$SOURCE/package.json" "$TARGET/package.json"
cp "$SOURCE/package-lock.json" "$TARGET/package-lock.json" 2>/dev/null || true
cp "$SOURCE/next.config.ts" "$TARGET/next.config.ts"

echo "Done. In target folder run:"
echo "  cd \"$TARGET\""
echo "  npm install"
echo "  npm run dev"
