# Mahendra Saree House — End-to-End Build Plan

> Paste-ready plan for Cursor and any delegated build tools. Read this top to bottom before executing. Every phase has explicit tasks, exact file paths, and a verify step. Do not skip phases. Do not rewrite working files.

---

## 0. Context for any agent picking this up

**Project:** Mahendra Saree House — Tally bill processing + barcode sticker printing for saree suppliers.
**Root:** `./mahendra`
**Goal:** A multi-tenant Next.js app where suppliers import Tally XML/Excel bills, the system applies per-supplier pricing rules, and admins print barcode sticker sheets.

**Verified current state of the repo (do not re-derive):**
- Next.js 16.2.9 + React 19.2.4, App Router, Turbopack
- Supabase local stack (Postgres + Auth + RLS)
- 18 SQL migrations committed in `supabase/migrations/` (00001..00009, 0008, 010..018)
- Route groups: `app/(auth)/`, `app/admin/`, `app/supplier/`, `app/api/`
- Server actions in `app/actions/`: auth, bills, items, layouts, supplier, suppliers
- Library code in `lib/`: auth, result, logger, validation, pricing, tally (xml + excel), pdf, barcode, utils
- 10 Jest unit tests across 2 files (pricing, xml-parser); 1 duplicate regression suite in `tests/unit/`
- 2 Playwright e2e specs: login, import-print
- Working flows already verified end-to-end: admin invites supplier → supplier logs in with temp password → imports Tally XML → trigger 018 auto-fills `tenant_id` → trigger `compute_bill_item_pricing` applies `company151` (rate × 1.25) → bill appears on supplier dashboard → PDF with barcodes renders
- Known gap: `app/supplier/history/page.tsx` is referenced by the sidebar but does not exist
- Known gap: `app/(auth)/reset-password/page.tsx` is referenced by middleware redirect but may not exist

**Tenancy model:** Single Postgres database, multi-tenant. RLS uses JWT `app_metadata.tenant_id` and `app_metadata.supplier_id`. The service-role key bypasses RLS and is server-only.

**Critical invariants (any agent must follow):**
1. Server actions: file starts with `'use server'`, returns `ActionResult<T>` from `@/lib/result`, wraps body in try/catch, logs via `@/lib/logger`, calls `revalidatePath` on success.
2. Read `app_metadata` from JWT via `@/lib/auth`. Never read `user_metadata` for authorisation.
3. The `SUPABASE_SERVICE_ROLE_KEY` env var is server-only. Never import `@/lib/supabase/service` (or anything that touches the service role) from a file marked `'use client'`.
4. Supplier-side inserts (`bills`, `bill_items`, `items`, `tally_imports`) do NOT set `tenant_id` manually — trigger `trg_auto_tenant_*` (migration 018) fills it from the JWT.
5. New migrations: `supabase/migrations/NNNN_name.sql` with zero-padded 4-digit prefix. Never edit a committed migration — add a new one.
6. Pure functions live in `lib/`. Test them in `__tests__/lib/`. End-to-end flows in `e2e/`.
7. PDF/Barcode: import only from `@/lib/pdf` and `@/lib/barcode`. Never import `@react-pdf/renderer` or `bwip-js` directly from a page.
8. Money: `formatINR()` from `@/lib/pricing`. Dates: `en-IN` locale. Never hardcode `₹` outside `formatINR`.
9. Before editing any file, read it first. If a working version already exists, extend it — do not rewrite from scratch.

---

## PHASE 0 — Repo & environment

### Tasks
1. Read `package.json`. Confirm these exact dependencies and devDependencies are present:
   - `dependencies`: `next@^16.2.9`, `react@^19.2.4`, `react-dom@^19.2.4`, `@supabase/ssr@^0.12`, `@supabase/supabase-js@^2.108`, `@react-pdf/renderer@^4.5`, `bwip-js@^4.11`, `fast-xml-parser@^5.8`, `xlsx@^0.18`, `zod@^3.23`, `pg@^8.21`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`, `framer-motion`
   - `devDependencies`: `@playwright/test@^1.60`, `jest`, `ts-jest`, `typescript`
2. Read `.env.local`. Required variables (do not log values):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Start local Supabase: `supabase start`
4. Verify stack: `supabase status` — must show `API URL`, `anon key`, `service_role key` and exit 0.
5. If `.env.local` is missing any var, stop and ask the user before continuing. Do not invent values.

### Verify
- `supabase status` exits 0 and prints the three keys above.
- `cat .env.local | wc -l` ≥ 3.

---

## PHASE 1 — Database

### Tasks
1. Reset and apply all migrations: `supabase db reset`
2. Confirm tables exist (run `psql "$SUPABASE_DB_URL" -c "\dt public.*"` or use the Supabase dashboard):
   - `tenants`
   - `users` (profile mirror of `auth.users`, plus role, tenant_id, must_reset_password, supplier_id)
   - `suppliers` (id, tenant_id, name, contact info, pricing_rule_id)
   - `items` (catalogue: sku, name, hsn, base_rate, mrp, gst_rate)
   - `bills` (id, tenant_id, supplier_id, bill_number, bill_date, totals, status)
   - `bill_items` (id, bill_id, item_id, qty, rate, computed fields from trigger)
   - `tally_imports` (id, tenant_id, supplier_id, file_name, file_type, mapping_id, status, error)
   - `tally_column_mappings` (id, tenant_id, name, column_map jsonb)
   - `pricing_rules` (id, tenant_id, supplier_id, model enum, margin_pct, markup_pct, gst_pct)
   - `audit_log` (id, tenant_id, actor_id, action, entity, entity_id, diff jsonb, created_at)
   - `layouts` (id, tenant_id, name, grid_cols, label_w, label_h, include_fields jsonb)
3. Confirm RLS is enabled on every business table:
   - `psql ... -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'"`
   - Every row in the result must show `rowsecurity = true`.
4. Confirm trigger `trg_auto_tenant_*` exists on `bills`, `bill_items`, `items`, `tally_imports`:
   - `psql ... -c "SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE 'trg_auto_tenant_%'"`
5. Seed the first admin user: `node create_admin.js` (interactive — prompts for email and password, sets `role=admin` and `tenant_id` in `app_metadata`, sets `must_reset_password=false`).
6. Optional: `node make_admins.js` to bulk-promote (idempotent).
7. For a demo supplier: log in as admin, go to `/admin/suppliers`, click "Invite Supplier", submit the form. The invite action uses `auth.admin.createUser` + RPC `provision_supplier_user(email, tenant_id)` (migration 015) and returns a one-time temp password.
8. Run `supabase db diff` — output must be empty (no drift).

### Verify
- `supabase db diff` prints nothing.
- `\d+ public.bills` in psql shows `Row security: enabled` and trigger `trg_auto_tenant_bills`.
- `select count(*) from public.users where role='admin'` ≥ 1.
- After invite: `select count(*) from public.suppliers` ≥ 1 and a corresponding row in `auth.users` with `app_metadata.role='supplier'`.

---

## PHASE 2 — Server-side foundation (`lib/`)

### Files (read, do not rewrite)
- `lib/auth.ts` — exports `getUser()`, `requireUser()`, `requireAdmin()`, `requireSupplier()`. All read `app_metadata` from the JWT. Returns the `users` row joined with tenant and supplier context.
- `lib/result.ts` — exports `ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string }` and helpers `ok(data)`, `fail(error, code?)`, `fromZod(error)`.
- `lib/logger.ts` — exports `logger.{info,warn,error}(msg, meta)` and `newRequestId()`. Every server action should call `newRequestId()` at the top and include it in logs.
- `lib/validation.ts` — zod schemas: `TallyImportInput`, `BillItemInput`, `SupplierInviteInput`, `PricingRuleInput`. Plus helpers `parseFormData(formData, schema)`.
- `lib/pricing.ts` — `calculateLine(input, rule)` and `calculateCompany151Line(rate)` (rate × 1.25). Pure functions, no I/O. `formatINR(amount)`.
- `lib/tally/xml-parser.ts` — `parseTallyXml(xmlText) → { bill: { number, date, party, totals }, items: [...] }`. Maps `<VOUCHER>` + `<ALLINVENTORYENTRIES.LIST>`. Throws on malformed input.
- `lib/tally/excel-parser.ts` — `parseTallyXlsx(buffer, mapping) → { bill, items[] }`. Uses column mapping from `tally_column_mappings`.
- `lib/supabase/server.ts` — `createClient()` using `@supabase/ssr` cookies. Used in server components and server actions.
- `lib/supabase/client.ts` — browser client. Used only for auth UI.
- `lib/supabase/service.ts` — service-role client. Server-only. Used by invite supplier, reset password, admin bulk ops.
- `lib/pdf/index.ts` — `renderBillPDF(bill, items, layout) → JSX.Element` for `@react-pdf/renderer`.
- `lib/barcode/index.ts` — `generateBarcodePng({ data, type, scale, height }) → Buffer` using `bwip-js`. Default `type='code128'`, `scale=2`, `height=10`.
- `lib/utils.ts` — `cn(...classes)`, `formatINR()`.
- `lib/audit.ts` — `writeAudit(action, entity, entityId, diff)`. If this file is missing, create it (see Phase 7 gap #3).

### Tasks
1. Read every file above. If any file is missing, STOP and ask the user. Do not invent.
2. Confirm no file has `TODO` or `FIXME` markers in the production path.
3. Confirm `lib/auth.ts` reads `app_metadata` (not `user_metadata`) — grep for `user_metadata` should return zero hits in `lib/auth.ts`.
4. Confirm `lib/pricing.ts` is pure: grep for `import.*supabase` should return zero hits in that file.
5. Confirm `lib/pdf/index.ts` and `lib/barcode/index.ts` do not re-export from each other or from page code.

### Verify
- `grep -r "user_metadata" lib/` returns only hits in test fixtures, not in `lib/auth.ts`.
- `grep -r "TODO\|FIXME" lib/` returns zero hits in production paths.
- `tsc --noEmit` exits 0.

---

## PHASE 3 — Auth & route protection

### Files
- `app/layout.tsx` — root html, font, `SupabaseListener` for auth events.
- `app/(auth)/login/page.tsx` — email + password form. Server action `signIn` reads `app_metadata.role` from the returned session and redirects:
  - `admin` → `/admin`
  - `supplier` → `/supplier`
- `app/(auth)/reset-password/page.tsx` — IF MISSING, build it (see Phase 7 gap #2).
- `middleware.ts` — uses `@supabase/ssr` to refresh the session cookie on every request. Must also:
  - Redirect unauthenticated requests to `/login` (except `/login`, `/reset-password`, public assets)
  - Block `admin` role from `/supplier/*` (return 403)
  - Block `supplier` role from `/admin/*` (return 403)
  - If `must_reset_password=true`, force redirect to `/reset-password` (suppliers only — admins reset via Supabase dashboard)
- `app/actions/auth.ts` — exports `signIn`, `signOut`, `resetPassword`.

### Tasks
1. Read `app/layout.tsx`. Confirm `SupabaseListener` is mounted.
2. Read `app/(auth)/login/page.tsx`. Confirm the signIn action reads `app_metadata.role` and redirects correctly.
3. Read `middleware.ts`. Confirm all four rules above are implemented.
4. Read `app/actions/auth.ts`. Confirm `signIn`, `signOut`, `resetPassword` exist.
5. If `reset-password` page is missing, build it (Phase 7).

### Verify
- `curl -i http://localhost:3000/admin` without cookies → 302 to `/login`.
- Login as admin → `/admin` loads. Try `/supplier` → 403.
- Login as supplier → `/supplier` loads. Try `/admin` → 403.
- Supplier with `must_reset_password=true` → forced to `/reset-password` after login.

---

## PHASE 4 — Admin app

### Files
- `app/admin/layout.tsx` — server component, `requireAdmin()`, renders `<AdminShell>` with sidebar: Dashboard, Bills, Suppliers, Items, Imports, Pricing, Layouts, Print, Settings.
- `app/admin/page.tsx` — tenant KPIs: total bills, total value, active suppliers, bills today.
- `app/admin/bills/page.tsx` — server-rendered table. Filters: status, supplier, date range. Row click → `/admin/bills/[id]`.
- `app/admin/bills/[id]/page.tsx` — full bill detail, items table, audit trail, "Reprint" and "Cancel" buttons (admin-only).
- `app/admin/suppliers/page.tsx` + `client-page.tsx` — list + "Invite Supplier" modal. Invite form posts to `inviteSupplier`.
- `app/admin/items/page.tsx` + `client-page.tsx` — catalogue, edit price/rate, bulk import.
- `app/admin/imports/page.tsx` + `import-form.tsx` — admin-side Tally import (for admin imports on a supplier's behalf).
- `app/admin/pricing/page.tsx` — per-supplier pricing rule editor (model: `standard` | `company151`, margins, GST%). Posts to `upsertPricingRule`.
- `app/admin/layouts/page.tsx` + `LayoutClient.tsx` — sticker layout editor (grid cols, label size, include/exclude fields). Persists to `layouts` table.
- `app/admin/print/page.tsx` + `PrintClient.tsx` — bill picker → render PDF preview → print.
- `app/admin/settings/page.tsx` — tenant name, GSTIN, address (used on PDF header).

### Server actions (`app/actions/`)
- `suppliers.ts`: `getSuppliers`, `inviteSupplier`, `updateSupplier`, `deactivateSupplier`.
- `bills.ts`: `getBills`, `getBill(id)`, `importTallyBill(input)`, `cancelBill`, `markBillPrinted`.
- `items.ts`: `getItems`, `upsertItem`, `bulkImportItems`.
- `layouts.ts`: `getLayouts`, `upsertLayout`, `deleteLayout`.

### `importTallyBill` contract
```ts
type ImportTallyBillInput = {
  fileName: string;          // 1..255
  fileType: 'xml' | 'xlsx' | 'xls';
  fileContent: string;       // XML is text; Excel is base64
  mappingId: string;         // uuid
};
type ImportTallyBillResult =
  | { ok: true; data: { billId: string; itemCount: number } }
  | { ok: false; error: string; code?: string };
```
Validation: zod. Parse: `parseTallyXml` or `parseTallyXlsx`. Insert bill, then bill_items. Trigger 018 fills `tenant_id`; trigger `compute_bill_item_pricing` fills computed fields. RLS narrows to the calling supplier.

### Tasks
1. Read every admin page and confirm structure matches the list above.
2. For any page that uses a server action, confirm the action returns `ActionResult<T>`.
3. Confirm the supplier invite flow ends with a one-time temp password shown in a modal with a "Copy" button — never emailed, never logged.
4. Confirm `/admin/bills/[id]` has a "Reprint" button that calls the same `lib/pdf` path as `/supplier/print`. If missing, add it (Phase 7 gap #4).

### Verify
- As admin: invite a supplier → temp password shown once → new auth user exists with `app_metadata.role='supplier'` and `app_metadata.supplier_id` set.
- As admin: edit a pricing rule → re-import a Tally bill for that supplier → trigger applies new model.

---

## PHASE 5 — Supplier app

### Files
- `app/supplier/layout.tsx` — `SupplierLayout` shell. Sidebar: Dashboard, Import, Print, History. Header shows real supplier name + initials. Amber banner if `must_reset_password=true`. Sign Out is a real form action.
- `app/supplier/page.tsx` — server component dashboard. KPIs (total bills, total stickers printed, last import time, pricing model label), recent bills table, recent imports list. Buttons: "Import Tally Bill" → `/supplier/import`, "Print Barcodes" → `/supplier/print`.
- `app/supplier/import/page.tsx` + `import-form.tsx` — upload `.xml` or `.xlsx`/`.xls`, choose column mapping (default seeded via migration 016), preview parsed rows, confirm. On confirm → `importTallyBill`.
- `app/supplier/print/page.tsx` — renders PDF using `lib/pdf` + `lib/barcode`.
- `app/supplier/history/page.tsx` — IF MISSING, build it (see Phase 7 gap #1).

### Tasks
1. Read every supplier page.
2. Confirm `/supplier` shows the supplier's own data only (RLS enforcement — verified by switching `supplier_id` in JWT and seeing a different dataset).
3. Build `/supplier/history` if missing.

### Verify
- Supplier logs in → `/supplier` shows their own bills only.
- Import a Tally XML → bill appears in dashboard.
- `/supplier/print` renders a PDF with barcodes.
- Attempting to read another supplier's bill via direct API → RLS denial.

---

## PHASE 6 — API routes

### Files
- `app/api/bills/upload/route.ts` — `POST` multipart, admin-only. Stores raw file in Supabase Storage bucket `tally-imports` and returns a URL.
- `app/api/bills/[id]/barcodes/route.ts` — `GET` returns a PNG stream using `bwip-js`. Must accept query params:
  - `data` (required) — the string to encode
  - `type` (default `code128`)
  - `scale` (default `2`)
  - `height` (default `10`)

### Tasks
1. Read both route files.
2. If the barcodes route doesn't parse query params, add the parsing. Do not change the response shape.
3. Confirm the upload route is admin-only (checks `app_metadata.role === 'admin'`).

### Verify
- `curl -i "http://localhost:3000/api/bills/<id>/barcodes?data=12345"` returns `200` with `Content-Type: image/png` and a non-empty body.
- `curl -i -X POST http://localhost:3000/api/bills/upload` without admin cookies → 403.

---

## PHASE 7 — Gaps to close (build these — do not refactor existing code)

### Gap 1: `app/supplier/history/page.tsx` (currently missing)
Build as a server component:
- Call `requireSupplier()`.
- Read search params: `status` (draft|imported|printed|cancelled), `from` (ISO date), `to` (ISO date), `page` (default 1, page size 20).
- Query the supplier's bills (RLS narrows automatically).
- Render a table with columns: Bill #, Date, Supplier (own name), Items count, Total (`formatINR`), Status badge, View link.
- Status badge variants: `draft` → outline, `imported` → secondary, `printed` → default, `cancelled` → destructive.
- Filters: client component for the form, server reads `searchParams`.
- Add a link from the supplier sidebar (`components/layout/supplier-layout.tsx`) to `/supplier/history` if not already present.

### Gap 2: `app/(auth)/reset-password/page.tsx` (may be missing)
Build as a server component:
- Call `requireUser()`.
- If `!user.must_reset_password`, redirect to `/supplier` (or `/admin`).
- Form: `newPassword`, `confirmPassword` (zod: min 8, must match).
- Posts to `resetPassword` action.
- Action: `supabase.auth.updateUser({ password })`, then `UPDATE public.users SET must_reset_password = false WHERE id = auth.uid()` (use service role for the update).
- On success: redirect to role-specific dashboard.

### Gap 3: `lib/audit.ts` and audit log wiring
If `lib/audit.ts` is missing, create it:
```ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { newRequestId } from '@/lib/logger';

export async function writeAudit(
  action: string,
  entity: string,
  entityId: string,
  diff: Record<string, unknown> = {}
): Promise<void> {
  const reqId = newRequestId();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('audit_log').insert({
      actor_id: user.id,
      action,
      entity,
      entity_id: entityId,
      diff,
    });
  } catch (err) {
    // Never throw from audit — log and continue
    // eslint-disable-next-line no-console
    console.error('[audit]', { reqId, action, entity, entityId, err });
  }
}
```
Wire `writeAudit` calls from: `importTallyBill`, `cancelBill`, `markBillPrinted`, `upsertPricingRule`, `inviteSupplier`. Add the call inside the same try block, after the successful insert/update. Do not refactor surrounding code.

### Gap 4: Admin Reprint button on `/admin/bills/[id]`
If absent, add a button to `app/admin/bills/[id]/page.tsx` that opens a print preview using the same `lib/pdf/renderBillPDF` used by `/supplier/print`. Server action `getBill(id)` already exists. Reuse it; add a client component for the preview modal.

### Verify (after all gaps)
- `/supplier/history` renders the supplier's own bills only, with working status + date filters.
- `/reset-password` accepts a new password and clears the `must_reset_password` flag.
- `select count(*) from audit_log` increases by 1 after a successful `importTallyBill`.
- Admin "Reprint" button on `/admin/bills/[id]` opens a PDF preview.

---

## PHASE 8 — Tests

### Current state (verified)
- `__tests__/lib/pricing.test.ts` — 7 cases: zero margin/markup/GST, margin percent, markup percent, GST on taxable, CGST/SGST split, IGST for interstate, floating point accuracy.
- `__tests__/lib/tally/xml-parser.test.ts` — 3 cases: valid Tally XML, invalid XML throws, state extraction for IGST vs CGST.
- `tests/unit/pricing.test.ts` — 2 cases, duplicate regression suite, keep as-is.
- `e2e/login.spec.ts` — admin + supplier login paths.
- `e2e/import-print.spec.ts` — full import → print flow.

### Tasks
1. `npm test` — expect 10/10 green. Fix any red before continuing.
2. `npm run e2e` — expect all green.
3. If you add a new pure function in `lib/`, add a test in `__tests__/lib/<name>.test.ts`.
4. If you add a new flow (page + action), add an `e2e/<flow>.spec.ts`.
5. Do not delete the existing `tests/unit/pricing.test.ts` — it serves as a regression suite.

### Verify
- `npm test` exits 0 with 10 passing tests.
- `npm run e2e` exits 0 with all specs passing.

---

## PHASE 9 — Manual smoke (10 minutes, do not skip)

1. `npm run dev` → http://localhost:3000 loads.
2. Log in as admin → land on `/admin` with KPIs.
3. Invite a supplier → copy the temp password.
4. Open incognito → log in as supplier → land on `/supplier` with KPIs.
5. Import a sample Tally XML → preview parsed rows → confirm.
6. Bill appears in `/supplier` dashboard.
7. Open `/supplier/print` → pick the bill → PDF renders with barcodes.
8. Switch back to admin → `/admin/bills/[id]` shows the supplier's bill with correct tenant.
9. `/supplier/history` lists all bills for this supplier with filters working.
10. Attempt to read another tenant's data via direct Supabase REST call (using a curl with a supplier's JWT against a different tenant's bill id) → expect RLS denial (empty result or 403).

### Verify
- All ten steps pass. If step 10 does not show RLS denial, STOP and fix policies before continuing. Do not declare done with a broken RLS boundary.

---

## PHASE 10 — Hardening (post-MVP, do not block demo)

- Rate limit `importTallyBill`: 10 requests/min per supplier. Add to `middleware.ts` keyed on `app_metadata.supplier_id`.
- Move audit log writes off the request path via a Supabase Edge Function if latency bites (only after measuring).
- Vercel deploy: set all env vars in the Vercel project, add `vercel.json` with `regions: ["bom1"]` (Mumbai) for supplier region latency.
- Jest → Vitest migration: only if a contributor hits a Jest + Next 16 incompatibility. Do not migrate preemptively.

---

## Done criteria (the build is "done" when ALL of these are true)

- Phases 0 through 9 are complete and each verify step passed.
- `npm test` exits 0 with 10/10 tests passing.
- `npm run e2e` exits 0 with all specs passing.
- Manual smoke checklist (10 steps) passes, including the RLS denial test.
- `grep -r "SUPABASE_SERVICE_ROLE_KEY" app/` returns hits ONLY in server-action files (never in a file marked `'use client'`).
- `grep -r "₹" app/ lib/` returns hits ONLY inside `formatINR` (or in test fixtures).
- All four Phase 7 gaps are closed and verified.
- No `TODO` or `FIXME` markers remain in production code paths.

---

## Quick reference — file map

```
app/
  layout.tsx                          # root + SupabaseListener
  page.tsx                            # root redirect
  (auth)/
    login/page.tsx
    reset-password/page.tsx           # GAP 2
  admin/
    layout.tsx
    page.tsx
    bills/page.tsx
    bills/[id]/page.tsx               # add Reprint button (GAP 4)
    suppliers/page.tsx
    suppliers/client-page.tsx
    items/page.tsx
    items/client-page.tsx
    imports/page.tsx
    imports/import-form.tsx
    pricing/page.tsx
    layouts/page.tsx
    layouts/LayoutClient.tsx
    print/page.tsx
    print/PrintClient.tsx
    settings/page.tsx
  supplier/
    layout.tsx
    page.tsx
    import/page.tsx
    import/import-form.tsx
    print/page.tsx
    history/page.tsx                  # GAP 1 — MISSING
  actions/
    auth.ts
    bills.ts
    items.ts
    layouts.ts
    supplier.ts
    suppliers.ts
  api/
    bills/upload/route.ts
    bills/[id]/barcodes/route.ts      # add query param parsing if missing
components/
  layout/
    admin-layout.tsx
    supplier-layout.tsx
  ui/                                # shadcn primitives
lib/
  auth.ts
  result.ts
  logger.ts
  validation.ts
  pricing.ts
  audit.ts                            # GAP 3 — may be missing
  tally/
    xml-parser.ts
    excel-parser.ts
  supabase/
    server.ts
    client.ts
    service.ts
  pdf/
    index.ts
  barcode/
    index.ts
  utils.ts
supabase/
  migrations/
    00001_initial_schema.sql
    00002_rls_policies.sql
    00003_indexes_and_constraints.sql
    00004_auth_trigger.sql
    00005_fix_auth_trigger_role_default.sql
    00006_supplier_pricing.sql
    00007_table_grants.sql
    00009_fix_permissions.sql
    0008_pricing_model.sql
    010_enterprise_schema.sql
    011_rls_with_jwt_claims.sql
    012_grants_and_grants_revoke.sql
    013_audit_log_tenant_id.sql
    014_jwt_app_metadata.sql
    015_provision_supplier_rpc.sql
    016_seed_tally_mapping.sql
    017_supplier_write_policies.sql
    018_auto_set_tenant_id.sql
__tests__/
  lib/
    pricing.test.ts                   # 7 cases
    tally/xml-parser.test.ts          # 3 cases
tests/
  unit/
    pricing.test.ts                   # 2 cases, regression
e2e/
  login.spec.ts
  import-print.spec.ts
middleware.ts
```

---

## How to delegate this

Hand the full file path to any tool (Cursor, Claude Code, Codex, subagent):

> Read `MAHENDRA_BUILD_PLAN.md` end to end. Execute phases 0 through 9 in order. After each phase, run the verify step and STOP if it fails. Do not skip phases. Do not rewrite working files. Follow the rules in section 0.

That's the whole context. Paste the file path, not the contents, and the tool has everything.
