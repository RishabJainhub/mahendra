#!/usr/bin/env bash
# Wipe stale local Supabase migrations and copy the correct ones from this repo.
# Fixes: ERROR column "tenant_id" does not exist ... idx_audit_log_tenant
#
# Usage: ./scripts/fix-db-migrations.sh "/Users/rishabpjain/Downloads/Mahendra project"

set -euo pipefail

TARGET="${1:-}"
SOURCE="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "$TARGET" ]; then
  echo "Usage: $0 \"/path/to/Mahendra project\""
  exit 1
fi

if [ ! -d "$TARGET" ]; then
  echo "Target not found: $TARGET"
  exit 1
fi

if [ ! -d "$SOURCE/supabase/migrations" ]; then
  echo "Source migrations missing in $SOURCE/supabase/migrations"
  exit 1
fi

echo "==> Removing stale migrations in:"
echo "    $TARGET/supabase/migrations"
rm -rf "$TARGET/supabase/migrations"
mkdir -p "$TARGET/supabase/migrations"

echo "==> Copying migrations from GitHub repo ($SOURCE)"
cp -v "$SOURCE/supabase/migrations/"*.sql "$TARGET/supabase/migrations/"
if [ -f "$SOURCE/supabase/config.toml" ]; then
  mkdir -p "$TARGET/supabase"
  cp -v "$SOURCE/supabase/config.toml" "$TARGET/supabase/config.toml"
fi

echo ""
echo "==> Verifying no stale idx_audit_log_tenant migration..."
if grep -r "idx_audit_log_tenant" "$TARGET/supabase" 2>/dev/null; then
  echo ""
  echo "ERROR: Stale migration still present. Delete manually and re-run."
  exit 1
fi

COUNT=$(ls -1 "$TARGET/supabase/migrations"/*.sql 2>/dev/null | wc -l | tr -d ' ')
echo "OK — $COUNT migration files installed."
echo ""
echo "Next:"
echo "  cd \"$TARGET\""
echo "  npx supabase db reset"
echo "  node create_admin.js    # if you need a fresh admin login"
echo "  npm run dev"
