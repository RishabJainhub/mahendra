#!/usr/bin/env node
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const TIMEOUT_MS = 8000;
const issues = [];
const hints = [];

function loadEnvLocal() {
  if (!fs.existsSync('.env.local')) return {};
  const env = {};
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const envFile = loadEnvLocal();
const url = envFile.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = envFile.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = envFile.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\nMahendra Distributors — login diagnostic\n');
console.log('App URL: http://localhost:3001\n');

if (!fs.existsSync('.env.local')) {
  issues.push('Missing .env.local');
  hints.push('Run: ./scripts/setup-local.sh');
} else {
  if (!url) issues.push('.env.local is missing NEXT_PUBLIC_SUPABASE_URL');
  if (!anon) issues.push('.env.local is missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!service) issues.push('.env.local is missing SUPABASE_SERVICE_ROLE_KEY');
  if (anon === 'your-anon-key' || service === 'your-service-role-key') {
    issues.push('.env.local still has placeholder keys');
    hints.push('Run: ./scripts/setup-local.sh');
  }
}

try {
  execSync('npx supabase status', { stdio: 'pipe', timeout: TIMEOUT_MS });
} catch {
  issues.push('Supabase is not running (or Docker is starting)');
  hints.push('Run: npx supabase start');
}

if (url && service && issues.length === 0) {
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
    if (authError) {
      issues.push(`Cannot reach Supabase auth with .env.local keys: ${authError.message}`);
      hints.push('Keys may be stale after supabase restart — run: ./scripts/setup-local.sh');
    } else {
      const authCount = authData.users.length;
      console.log(`Auth users: ${authCount}`);

      if (authCount === 0) {
        issues.push('No auth users exist (common after db reset)');
        hints.push('Run: node create_admin.js');
      }

      const { data: profiles, error: profileError } = await admin
        .from('users')
        .select('id, email, role, tenant_id');

      if (profileError) {
        issues.push(`Cannot read public.users: ${profileError.message}`);
      } else {
        const admins = profiles.filter((p) => p.role === 'admin');
        console.log(`public.users rows: ${profiles.length} (${admins.length} admin)`);

        if (admins.length === 0) {
          issues.push('No admin profile in public.users');
          hints.push('Run: node create_admin.js');
        }

        for (const user of authData.users) {
          const meta = user.app_metadata ?? {};
          const profile = profiles.find((p) => p.id === user.id);
          if (!profile) {
            issues.push(`Auth user ${user.email ?? user.id} has no public.users row`);
          } else if (!meta.role || !meta.tenant_id) {
            issues.push(`Auth user ${user.email ?? user.id} is missing role/tenant_id in JWT metadata`);
            hints.push('Run: node create_admin.js (updates existing admin metadata)');
          }
        }
      }
    }
  } catch (err) {
    issues.push(`Supabase check failed: ${err.message}`);
  }
}

if (issues.length === 0) {
  console.log('\n✓ Login setup looks good.');
  console.log('If sign-in still fails, restart dev server after changing .env.local: npm run dev\n');
  process.exit(0);
}

console.log('\nIssues found:\n');
issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));

const uniqueHints = [...new Set(hints)];
if (uniqueHints.length > 0) {
  console.log('\nSuggested fixes:\n');
  uniqueHints.forEach((hint) => console.log(`  • ${hint}`));
}

console.log('\nFull local reset:\n');
console.log('  npx supabase stop --all');
console.log('  ./scripts/setup-local.sh');
console.log('  node create_admin.js');
console.log('  npm run dev\n');
process.exit(1);
