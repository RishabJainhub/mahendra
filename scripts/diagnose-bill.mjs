#!/usr/bin/env node
// One-off: delete any bill row that has zero bill_items (an artefact of the
// pre-022 RLS bug where admin-imported bills landed but their line items did
// not). Run once after applying migration 022, then re-import the Tally file.
//
//   node scripts/diagnose-bill.mjs --apply   # actually delete the empty bills
//   node scripts/diagnose-bill.mjs           # dry run

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const env = {};
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const apply = process.argv.includes('--apply');
const env = loadEnvLocal();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: bills, error: billErr } = await admin
  .from('bills')
  .select('id, bill_number, status, supplier_id, total_amount, created_at')
  .order('created_at', { ascending: false })
  .limit(50);

if (billErr) {
  console.error('Failed to list bills:', billErr.message);
  process.exit(1);
}

console.log(`Scanning ${bills.length} bill(s)...`);
const empties = [];
for (const b of bills) {
  const { count } = await admin
    .from('bill_items')
    .select('*', { count: 'exact', head: true })
    .eq('bill_id', b.id);
  if ((count ?? 0) === 0) empties.push(b);
  console.log(`  • ${b.bill_number} (${b.status}) — items: ${count}`);
}

if (empties.length === 0) {
  console.log('\nNo empty bills found. Nothing to clean up.');
  process.exit(0);
}

console.log(`\n${apply ? 'Deleting' : 'Would delete'} ${empties.length} empty bill(s):`);
for (const b of empties) console.log(`  • ${b.bill_number} (${b.id})`);

if (!apply) {
  console.log('\nDry run. Re-run with --apply to actually delete.');
  process.exit(0);
}

for (const b of empties) {
  const { error } = await admin.from('bills').delete().eq('id', b.id);
  if (error) console.error(`  ✗ ${b.bill_number}: ${error.message}`);
  else console.log(`  ✓ deleted ${b.bill_number}`);
}
