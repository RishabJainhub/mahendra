#!/usr/bin/env node
/**
 * Interactive script to create the first admin user.
 * Usage: node create_admin.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

// Load .env.local (plain node scripts don't pick it up like Next.js does)
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or create .env.local)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log('Create Admin User for Mahendra Distributors\n');

  const email = await ask('Email: ');
  const password = await ask('Password: ');

  if (!email || !password) {
    console.error('Email and password are required');
    rl.close();
    process.exit(1);
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    app_metadata: {
      role: 'admin',
      tenant_id: TENANT_ID,
      must_reset_password: false,
    },
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    rl.close();
    process.exit(1);
  }

  const { error: profileError } = await supabase.from('users').upsert({
    id: authUser.user.id,
    tenant_id: TENANT_ID,
    role: 'admin',
    email: email.trim(),
    must_reset_password: false,
  });

  if (profileError) {
    console.error('Profile error:', profileError.message);
    rl.close();
    process.exit(1);
  }

  console.log('\nAdmin user created successfully!');
  console.log('  ID:', authUser.user.id);
  console.log('  Email:', email.trim());
  console.log('  Role: admin');
  console.log('  Tenant:', TENANT_ID);

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
