#!/usr/bin/env node
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const TIMEOUT_MS = 8000;
const issues = [];

if (!fs.existsSync('.env.local')) {
  issues.push('Missing .env.local — run: cp .env.example .env.local');
} else {
  const env = fs.readFileSync('.env.local', 'utf8');
  if (!env.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
    issues.push('.env.local is missing NEXT_PUBLIC_SUPABASE_URL');
  }
  if (env.includes('your-anon-key') || env.includes('your-service-role-key')) {
    issues.push('.env.local still has placeholder keys — copy real values from `npx supabase status`');
  }
}

try {
  execSync('npx supabase status', { stdio: 'pipe', timeout: TIMEOUT_MS });
} catch {
  issues.push('Supabase is not running (or Docker is starting) — open Docker, then: npx supabase start');
}

console.log('\nTallyBill Pro — local check\n');
console.log('App URL: http://localhost:3001  (not 3000, not a Cursor cloud tab)\n');

if (issues.length === 0) {
  console.log('✓ Setup looks good. Run: npm run dev\n');
  process.exit(0);
}

console.log('Issues found:\n');
issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
console.log('\nQuick fix:\n');
console.log('  npx supabase start');
console.log('  cp .env.example .env.local');
console.log('  npx supabase status   # copy API URL, anon key, service_role key into .env.local');
console.log('  npm run dev\n');
process.exit(1);
