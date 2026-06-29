#!/usr/bin/env node
/**
 * Create or reset the first admin user.
 * Usage:
 *   node create_admin.js
 *   node create_admin.js --email admin@example.com --password secret
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

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

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--email' && argv[i + 1]) {
      args.email = argv[++i];
    } else if (arg === '--password' && argv[i + 1]) {
      args.password = argv[++i];
    }
  }
  return args;
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

async function findAuthUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function ensureSeedTenant() {
  const { error } = await supabase.from('tenants').upsert({
    id: TENANT_ID,
    name: 'Mahendra Distributors',
    gstin: null,
    address: null,
  });
  if (error) throw error;
}

async function upsertAdminProfile(userId, email) {
  const { error: profileError } = await supabase.from('users').upsert({
    id: userId,
    tenant_id: TENANT_ID,
    role: 'admin',
    email,
    supplier_id: null,
    must_reset_password: false,
  });
  if (profileError) throw profileError;

  const { error: syncError } = await supabase.rpc('sync_user_app_metadata', {
    p_user_id: userId,
    p_tenant_id: TENANT_ID,
    p_role: 'admin',
    p_supplier_id: null,
    p_must_reset_password: false,
  });
  if (syncError) throw syncError;
}

async function createOrUpdateAdmin(email, password) {
  const normalizedEmail = email.trim();

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    app_metadata: {
      role: 'admin',
      tenant_id: TENANT_ID,
      must_reset_password: false,
    },
  });

  if (!authError) {
    await upsertAdminProfile(authUser.user.id, normalizedEmail);
    return { userId: authUser.user.id, created: true };
  }

  const alreadyExists =
    authError.message.toLowerCase().includes('already') ||
    authError.message.toLowerCase().includes('registered');

  if (!alreadyExists) {
    throw authError;
  }

  const existing = await findAuthUserByEmail(normalizedEmail);
  if (!existing) {
    throw new Error(`User exists in auth but could not be loaded: ${authError.message}`);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    app_metadata: {
      role: 'admin',
      tenant_id: TENANT_ID,
      must_reset_password: false,
    },
  });
  if (updateError) throw updateError;

  await upsertAdminProfile(existing.id, normalizedEmail);
  return { userId: existing.id, created: false };
}

async function main() {
  const cli = parseArgs(process.argv);
  console.log('Create Admin User for Mahendra Distributors\n');

  const email = cli.email || (await ask('Email: '));
  const password = cli.password || (await ask('Password: '));

  if (!email || !password) {
    console.error('Email and password are required');
    rl.close();
    process.exit(1);
  }

  await ensureSeedTenant();
  const { userId, created } = await createOrUpdateAdmin(email, password);

  console.log(`\nAdmin user ${created ? 'created' : 'updated'} successfully!`);
  console.log('  ID:', userId);
  console.log('  Email:', email.trim());
  console.log('  Role: admin');
  console.log('  Tenant:', TENANT_ID);
  console.log('\nOpen http://localhost:3001 and sign in with these credentials.');

  rl.close();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
