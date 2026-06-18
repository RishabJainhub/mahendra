#!/usr/bin/env bash
# One-shot cloud Supabase setup for Mahendra Distributors.
#   ./scripts/setup-cloud.sh
#
# Requires: Supabase CLI logged in (`npx supabase login`) OR keys via env / paste.
# Writes .env.local pointing at your cloud project, pushes migrations, creates admin.
#
# Non-interactive example:
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
#   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
#   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret \
#   ./scripts/setup-cloud.sh

set -euo pipefail
cd "$(dirname "$0")/.."

# Quieter CLI (PostHog timeout warnings are harmless)
export SUPABASE_TELEMETRY_DISABLED="${SUPABASE_TELEMETRY_DISABLED:-1}"

PROJECT_REF="${SUPABASE_PROJECT_REF:-zpdrnblpvuijwghfxmgm}"
API_URL="https://${PROJECT_REF}.supabase.co"
DASHBOARD="https://supabase.com/dashboard/project/${PROJECT_REF}"
SKIP_LINK="${SKIP_LINK:-0}"
SKIP_DB_PUSH="${SKIP_DB_PUSH:-0}"
SKIP_ADMIN="${SKIP_ADMIN:-0}"

echo "==> Mahendra Distributors — cloud Supabase setup"
echo "    Project ref: $PROJECT_REF"
echo "    API URL:     $API_URL"
echo "    Dashboard:   $DASHBOARD"
echo ""

if [ "$SKIP_LINK" != "1" ]; then
  echo "==> 1/5 Linking Supabase CLI to cloud project..."
  if npx supabase link --project-ref "$PROJECT_REF" --yes 2>&1 | tail -3; then
    echo "Linked to $PROJECT_REF"
  else
    echo "WARN: link skipped or already linked. Run: npx supabase login"
  fi
else
  echo "==> 1/5 Skipping link (SKIP_LINK=1)"
fi

echo ""
if [ "$SKIP_DB_PUSH" != "1" ]; then
  echo "==> 2/5 Pushing migrations to cloud..."
  if npx supabase db push --yes 2>&1; then
    echo "Migrations up to date."
  else
    echo "WARN: db push failed — schema is likely already applied on cloud."
  fi
else
  echo "==> 2/5 Skipping db push (SKIP_DB_PUSH=1)"
fi

echo ""
echo "==> 3/5 Resolving API keys..."

ANON="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"
SERVICE="${SUPABASE_SERVICE_ROLE_KEY:-}"

fetch_keys_cli() {
  local json
  if ! json="$(npx supabase projects api-keys --project-ref "$PROJECT_REF" -o json 2>/dev/null)"; then
    return 1
  fi
  node -e "
    const rows = JSON.parse(process.argv[1]);
    for (const row of rows) {
      const name = (row.name || row.id || '').toLowerCase();
      const key = row.api_key || row.key || '';
      if (!key) continue;
      if (name.includes('service') || name === 'service_role') {
        console.log('SERVICE_ROLE_KEY=' + key);
      } else if (name.includes('anon') || name === 'anon' || name === 'default') {
        console.log('ANON_KEY=' + key);
      }
    }
  " "$json" 2>/dev/null
}

if [ -z "$ANON" ] || [ -z "$SERVICE" ]; then
  if KEYS="$(fetch_keys_cli)"; then
    get() { echo "$KEYS" | grep "^$1=" | head -1 | cut -d'=' -f2-; }
    ANON="${ANON:-$(get ANON_KEY)}"
    SERVICE="${SERVICE:-$(get SERVICE_ROLE_KEY)}"
  fi
fi

if [ -z "$ANON" ] || [ -z "$SERVICE" ]; then
  echo ""
  echo "Could not auto-fetch keys from Supabase CLI."
  echo "Open this page and copy both keys (anon + service_role):"
  echo "  $DASHBOARD/settings/api"
  echo ""
  echo "Or export them before running this script:"
  echo "  export NEXT_PUBLIC_SUPABASE_ANON_KEY='eyJ...'"
  echo "  export SUPABASE_SERVICE_ROLE_KEY='eyJ...'"
  echo ""
fi

if [ -z "$ANON" ]; then
  printf "NEXT_PUBLIC_SUPABASE_ANON_KEY: "
  IFS= read -r ANON || true
fi

if [ -z "$SERVICE" ]; then
  printf "SUPABASE_SERVICE_ROLE_KEY: "
  IFS= read -r SERVICE || true
fi

if [ -z "$ANON" ] || [ -z "$SERVICE" ]; then
  echo ""
  echo "ERROR: Both keys are required."
  echo "Quick manual fix — create .env.local yourself:"
  echo ""
  cat <<EOF
cat > .env.local <<'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=paste-service-role-key-here
ENVEOF
node create_admin.js
npm run check:cloud
npm run dev
EOF
  exit 1
fi

cat > .env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SERVICE
EOF
echo "Wrote .env.local → $API_URL"

echo ""
echo "==> 4/5 Auth URLs (one-time, in dashboard)"
echo "  $DASHBOARD/auth/url-configuration"
echo "  Site URL:      http://localhost:3001"
echo "  Redirect URLs: http://localhost:3001/**"
echo ""
if [ -t 0 ]; then
  printf "Press Enter after saving Auth URL settings..."
  IFS= read -r _ || true
else
  echo "(non-interactive — configure Auth URLs in dashboard before logging in)"
fi

echo ""
if [ "$SKIP_ADMIN" != "1" ]; then
  echo "==> 5/5 Create admin login"
  if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
    node create_admin.js --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"
  else
    node create_admin.js
  fi
else
  echo "==> 5/5 Skipping admin (SKIP_ADMIN=1) — run: node create_admin.js"
fi

echo ""
echo "Verify:"
echo "  npm run check:cloud"
echo "  npm run diagnose-login"
echo "  npm run dev"
echo "  → http://localhost:3001"
echo ""
echo "Cloud setup complete."
