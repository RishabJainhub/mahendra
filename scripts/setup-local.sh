#!/usr/bin/env bash
# One-shot local setup for Mahendra Distributors. Run from the repo root.
#   ./scripts/setup-local.sh
#
# Requires Docker Desktop running. Creates .env.local, applies migrations,
# and tells you how to create an admin + start the app.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/4 Starting Supabase (Docker must be running)..."
npx supabase start

echo ""
echo "==> 2/4 Writing .env.local from supabase status..."
ENV_OUT="$(npx supabase status -o env 2>/dev/null)"

get() { echo "$ENV_OUT" | grep "^$1=" | head -1 | cut -d'=' -f2- | tr -d '"'; }
API_URL="$(get API_URL)"
ANON="$(get ANON_KEY)"
SERVICE="$(get SERVICE_ROLE_KEY)"

if [ -z "$API_URL" ] || [ -z "$ANON" ] || [ -z "$SERVICE" ]; then
  echo "ERROR: Could not read keys from 'supabase status'. Is Supabase running?"
  exit 1
fi

cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
EOF
echo "Wrote .env.local (URL: $API_URL)"

echo ""
echo "==> 3/4 Resetting database (applies all migrations + seed tenant)..."
npx supabase db reset

echo ""
echo "==> 4/4 Setup complete."
echo ""
echo "Create your admin login, then start the app:"
echo "  node create_admin.js"
echo "  npm run dev"
echo "  → open http://localhost:3001"
