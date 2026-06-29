# Mahendra Distributors

Multi-tenant Tally bill processing and barcode sticker printing for distributors.

## Stack

- Next.js 16 + React 19 + Supabase (Postgres, Auth, RLS)
- `@react-pdf/renderer` + `bwip-js` for print/barcode

## Quick start

**Fastest path — one script does everything** (needs Docker Desktop running):

```bash
npm install
chmod +x scripts/setup-local.sh
./scripts/setup-local.sh    # starts Supabase, writes .env.local, applies migrations
node create_admin.js        # create your login
npm run dev                 # → http://localhost:3001
```

Manual steps:

```bash
# 1. Install dependencies
npm install

# 2. Start Supabase (requires Docker)
npx supabase start

# 3. Configure environment (copy keys from `supabase status`)
cp .env.example .env.local

# 4. Apply migrations and seed (run from project root — uses supabase/migrations/)
npx supabase db reset

# 5. Create admin user
node create_admin.js

# 6. Run dev server (port 3001 — avoids clash with other apps on 3000)
npm run dev
Open **http://localhost:3001** and sign in.

---

## Cloud Supabase (production / no Docker)

Your cloud project is **`zpdrnblpvuijwghfxmgm`** (Singapore). Schema is already applied (20 migrations).

**One command setup** (from repo root):

```bash
npm install
chmod +x scripts/setup-cloud.sh
npx supabase login          # once — opens browser
./scripts/setup-cloud.sh
```

The script will:
1. Link CLI to your cloud project
2. Push any new migrations
3. Write `.env.local` with cloud keys (CLI or paste from dashboard)
4. Prompt you to set Auth URLs (see below)
5. Run `create_admin.js` for your login

**Non-interactive** (if you have keys ready):

```bash
export SUPABASE_PROJECT_REF=zpdrnblpvuijwghfxmgm
export NEXT_PUBLIC_SUPABASE_ANON_KEY='eyJ...'
export SUPABASE_SERVICE_ROLE_KEY='eyJ...'
export ADMIN_EMAIL='you@example.com'
export ADMIN_PASSWORD='your-secure-password'
./scripts/setup-cloud.sh
```

Get keys from: [Supabase API settings](https://supabase.com/dashboard/project/zpdrnblpvuijwghfxmgm/settings/api)

**Auth URLs** (required once, in dashboard → Authentication → URL configuration):

| Setting | Value |
|---------|--------|
| Site URL | `http://localhost:3001` |
| Redirect URLs | `http://localhost:3001/**` |

Verify and run:

```bash
npm run check:cloud
npm run diagnose-login
npm run dev
# → http://localhost:3001
```

When you deploy (e.g. Vercel), add the same three env vars there and update Site URL to your production domain.

---

Run the diagnostic first:

```bash
npm run check
```

Common fixes:

| Problem | Fix |
|---------|-----|
| Blank page / 500 error | Create `.env.local` with keys from `npx supabase status` |
| `Connection refused` | Run `npm run dev` — app uses **port 3001**, not 3000 |
| Supabase errors | Start **Docker Desktop**, then `npx supabase start` |
| Wrong folder | Use either `~/mahendra` **or** `Downloads/Mahendra project` after sync — not both at once |
| Port in use (`EADDRINUSE`) | Stop other Next apps: `lsof -i :3001` then kill the process, or change port in `package.json` |

**Migration errors?** If `db reset` fails with `tenant_id does not exist` / `idx_audit_log_tenant`, your Downloads folder has **old** migrations. Fix:

```bash
cd ~/mahendra
git pull origin cursor/full-revamp-ui-features-51c0
chmod +x scripts/fix-db-migrations.sh
./scripts/fix-db-migrations.sh "/Users/rishabpjain/Downloads/Mahendra project"
cd "/Users/rishabpjain/Downloads/Mahendra project"
npx supabase db reset
```

Or reset directly from the git clone (simplest):

```bash
cd ~/mahendra
git pull origin cursor/full-revamp-ui-features-51c0
npx supabase db reset
npm run dev
```

## Verify

```bash
npm test          # 19 unit tests
npm run verify    # pricing + barcodes + XML/PDF + health checks
npm run typecheck
npm run build
npm run e2e       # requires dev server + Supabase
```

Admin UI: **System Verify** at `/admin/verify` — runs live checks for formulas, parsers, and barcode PNG generation.

### Sync features into your Downloads/Mahendra project folder

If you run the app from `Downloads/Mahendra project` (not git-linked), use the one-command updater:

```bash
cd ~/mahendra
chmod +x scripts/pull-and-sync.sh
./scripts/pull-and-sync.sh "/Users/rishabpjain/Downloads/Mahendra project"
```

This stashes auto-generated git conflicts, pulls latest, syncs files, and runs `npm run check`.

Manual steps if you prefer:

```bash
cd ~/mahendra
git stash push -m "local" -- next-env.d.ts package-lock.json   # if pull is blocked
git pull origin cursor/restore-tallybill-pro-ui-51c0
chmod +x scripts/sync-to-local.sh
./scripts/sync-to-local.sh "/Users/rishabpjain/Downloads/Mahendra project"
cd "/Users/rishabpjain/Downloads/Mahendra project"
npm install
npm run check
npm run dev
```

## Docs

- `MAHENDRA_BUILD_PLAN.md` — authoritative build spec
- `PLAN.md` — execution work order (PART 1 planning)
- `BUILD_LOG.md` — phase-by-phase build audit trail

## Branch strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production baseline |
| `cursor/plan-mahendra-build-51c0` | Planning (`PLAN.md`) |
| `build/mahendra-phase-0-9` | Application build (PART 2) |
