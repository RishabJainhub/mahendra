#!/usr/bin/env bash
# One-shot cloud Supabase setup for Mahendra Distributors.
#   ./scripts/setup-cloud.sh
#
# Requires: Supabase CLI logged in (`npx supabase login`) OR keys pasted manually.
# Writes .env.local pointing at your cloud project, pushes migrations, creates admin.

set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-zpdrnblpvuijwghfxmgm}"
API_URL="https://${PROJECT_REF}.supabase.co"
DASHBOARD="https://supabase.com/dashboard/project/${PROJECT_REF}"

echo "==> Mahendra Distributors — cloud Supabase setup"
echo "    Project ref: $PROJECT_REF"
echo "    API URL:     $API_URL"
echo "    Dashboard:   $DASHBOARD"
echo ""

echo "==> 1/5 Linking Supabase CLI to cloud project..."
if npx supabase link --project-ref "$PROJECT_REF" 2>/dev/null; then
  echo "Linked to $PROJECT_REF"
else
  echo "WARN: Could not link via CLI (run: npx supabase login). Continuing with manual keys."
fi

echo ""
echo "==> 2/5 Pushing migrations to cloud..."
if npx supabase db push 2>/dev/null; then
  echo "Migrations applied (or already up to date)."
else
  echo "WARN: db push skipped — schema may already be applied via dashboard/Cursor."
fi

echo ""
echo "==> 3/5 Resolving API keys..."

ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
SERVICE="${SUPABASE_SERVICE_ROLE_KEY:-}"

if [ -z "$ANON" ] || [ -z "$SERVICE" ]; then
  if KEYS="$(npx supabase projects api-keys --project-ref "$PROJECT_REF" -o env 2>/dev/null)"; then
    get() { echo "$KEYS" | grep "^$1=" | head -1 | cut -d'=' -f2- | tr -d '"'; }
    ANON="${ANON:-$(get ANON_KEY)}"
    SERVICE="${SERVICE:-$(get SERVICE_ROLE_KEY)}"
  fi
fi

if [ -z "$ANON" ]; then
  echo ""
  echo "Paste your anon key from:"
  echo "  $DASHBOARD/settings/api"
  read -r -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " ANON
fi

if [ -z "$SERVICE" ]; then
  echo ""
  echo "Paste your service_role key (server only — never commit):"
  echo "  $DASHBOARD/settings/api"
  read -r -p "SUPABASE_SERVICE_ROLE_KEY: " SERVICE
fi

if [ -z "$ANON" ] || [ -z "$SERVICE" ]; then
  echo "ERROR: Both anon and service_role keys are required."
  exit 1
fi

cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
EOF
echo "Wrote .env.local → $API_URL"

echo ""
echo "==> 4/5 Configure Auth URLs in Supabase dashboard (one-time)"
echo "  $DASHBOARD/auth/url-configuration"
echo "  Site URL:        http://localhost:3001"
echo "  Redirect URLs:   http://localhost:3001/**"
echo ""
read -r -p "Press Enter after you've saved Auth URL settings..."

echo ""
echo "==> 5/5 Create admin login"
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  node create_admin.js --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"
else
  echo "Run interactively:"
  node create_admin.js
fi

echo ""
echo "Verify:"
echo "  npm run diagnose-login"
echo "  npm run dev"
echo "  → http://localhost:3001"
echo ""
echo "Cloud setup complete. Local Docker Supabase is no longer needed."
