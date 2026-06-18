#!/usr/bin/env bash
# Resume cloud setup from step 3 — write .env.local + create admin.
# Use when setup-cloud.sh stopped at "Resolving API keys".
#
#   ./scripts/finish-cloud-env.sh
#
# Or with keys already exported:
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... SUPABASE_SERVICE_ROLE_KEY=eyJ... ./scripts/finish-cloud-env.sh

set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-zpdrnblpvuijwghfxmgm}"
API_URL="https://${PROJECT_REF}.supabase.co"
DASHBOARD="https://supabase.com/dashboard/project/${PROJECT_REF}/settings/api"

ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
SERVICE="${SUPABASE_SERVICE_ROLE_KEY:-}"

echo "Finish cloud .env.local setup"
echo "Get keys from: $DASHBOARD"
echo ""

if [ -z "$ANON" ]; then
  printf "NEXT_PUBLIC_SUPABASE_ANON_KEY: "
  IFS= read -r ANON || true
fi
if [ -z "$SERVICE" ]; then
  printf "SUPABASE_SERVICE_ROLE_KEY: "
  IFS= read -r SERVICE || true
fi

if [ -z "$ANON" ] || [ -z "$SERVICE" ]; then
  echo "ERROR: both keys required."
  exit 1
fi

cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
EOF

echo "✓ Wrote .env.local"
echo ""
echo "Next:"
echo "  1. Auth URLs: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration"
echo "     Site URL http://localhost:3001  |  Redirect http://localhost:3001/**"
echo "  2. node create_admin.js"
echo "  3. npm run check:cloud && npm run dev"
