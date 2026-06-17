# Mahendra Saree House

Multi-tenant Tally bill processing and barcode sticker printing for saree suppliers.

## Stack

- Next.js 16 + React 19 + Supabase (Postgres, Auth, RLS)
- `@react-pdf/renderer` + `bwip-js` for print/barcode

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Start Supabase (requires Docker)
npx supabase start

# 3. Configure environment (copy keys from `supabase status`)
cp .env.example .env.local

# 4. Apply migrations and seed
npx supabase db reset

# 5. Create admin user
node create_admin.js

# 6. Run dev server (port 3001 — avoids clash with other apps on 3000)
npm run dev
# → http://localhost:3001
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

If you run the app from `Downloads/Mahendra project` (not git-linked), pull latest on `~/mahendra` then:

```bash
cd ~/mahendra
git pull origin build/mahendra-phase-0-9
chmod +x scripts/sync-to-local.sh
./scripts/sync-to-local.sh "/Users/rishabpjain/Downloads/Mahendra project"
cd "/Users/rishabpjain/Downloads/Mahendra project"
npm install
npm run dev
```

Or run directly from `~/mahendra` with your `.env.local` copied there.

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
