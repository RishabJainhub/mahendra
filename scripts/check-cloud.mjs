#!/usr/bin/env node
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

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

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\nMahendra Distributors — cloud check\n');

if (!url?.includes('supabase.co')) {
  issues.push('.env.local is not pointing at cloud Supabase (expected https://*.supabase.co)');
  hints.push('Run: ./scripts/setup-cloud.sh');
}

if (!fs.existsSync('.env.local')) {
  issues.push('Missing .env.local');
  hints.push('Run: ./scripts/setup-cloud.sh');
} else {
  if (!anon) issues.push('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!service) issues.push('Missing SUPABASE_SERVICE_ROLE_KEY');
}

if (url && service && issues.length === 0) {
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data, error } = await admin.from('tenants').select('id, name').limit(1);
    if (error) {
      issues.push(`Database unreachable: ${error.message}`);
    } else {
      console.log(`✓ Connected to ${url}`);
      console.log(`✓ Tenant: ${data[0]?.name ?? 'none'}`);
    }

    const { data: authData, error: authError } = await admin.auth.admin.listUsers({ perPage: 5 });
    if (authError) {
      issues.push(`Auth check failed: ${authError.message}`);
    } else if (authData.users.length === 0) {
      issues.push('No users — run: node create_admin.js');
    } else {
      console.log(`✓ Auth users: ${authData.users.length}`);
    }
  } catch (err) {
    issues.push(err.message);
  }
}

if (issues.length === 0) {
  console.log('\n✓ Cloud setup looks good. Run: npm run dev\n');
  process.exit(0);
}

console.log('\nIssues:\n');
issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
if (hints.length) {
  console.log('\nFix:\n');
  hints.forEach((h) => console.log(`  • ${h}`));
}
console.log('');
process.exit(1);
