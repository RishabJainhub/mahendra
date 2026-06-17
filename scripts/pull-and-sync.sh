#!/usr/bin/env bash
# Pull latest branch into ~/mahendra and sync into Downloads folder.
# Usage: ./scripts/pull-and-sync.sh "/Users/rishabpjain/Downloads/Mahendra project"
#
# Safe to re-run. Stashes auto-generated local changes that block git pull.

set -euo pipefail

TARGET="${1:-/Users/rishabpjain/Downloads/Mahendra project}"
BRANCH="${2:-cursor/full-revamp-ui-features-51c0}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"

cd "$REPO"

echo "==> Repo: $REPO"
echo "==> Branch: $BRANCH"
echo "==> Target: $TARGET"
echo ""

# Auto-generated files often differ after npm run dev/build — stash them so pull works.
if ! git diff --quiet next-env.d.ts package-lock.json 2>/dev/null; then
  echo "==> Stashing local next-env.d.ts / package-lock.json changes..."
  git stash push -m "auto: local dev artifacts $(date +%Y-%m-%d)" -- next-env.d.ts package-lock.json 2>/dev/null || true
fi

echo "==> Pulling latest..."
git fetch origin "$BRANCH"
git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
git pull origin "$BRANCH"

chmod +x scripts/sync-to-local.sh scripts/check-local.mjs scripts/fix-db-migrations.sh 2>/dev/null || true

echo "==> Syncing to Downloads..."
"$REPO/scripts/sync-to-local.sh" "$TARGET"

echo "==> Fixing database migrations (removes stale local SQL)..."
"$REPO/scripts/fix-db-migrations.sh" "$TARGET"

echo ""
echo "==> Installing in target..."
cd "$TARGET"
npm install

echo ""
echo "==> Running check..."
npm run check || true

echo ""
echo "==> IMPORTANT: reset database (syncs migrations from GitHub, fixes schema errors)"
echo "    cd \"$TARGET\" && npx supabase db reset"
echo ""
echo "Then: npm run dev"
echo "Open: http://localhost:3001"
