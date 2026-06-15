# Mahendra Saree House — Execution Work Order

> Produced by Cursor Cloud planning agent (PART 1). Authoritative spec: `/workspace/MAHENDRA_BUILD_PLAN.md`. Do not deviate from the spec architecture.

**Repo root:** `/workspace` (local dev equivalent: `/Users/rishabpjain/Downloads/Mahendra project`)

---

## 0. Verifications of current state

> **BLOCKER:** The attached GitHub repo (`RishabJainhub/mahendra`) contains only `README.md` (initial commit). The Next.js application described in `MAHENDRA_BUILD_PLAN.md` is not present in this workspace. All application-path checks below are **MISSING** or **FAIL**. CLI execution MUST NOT begin until the full codebase is committed to the repo.

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | `supabase/migrations/` has files 00001..00018 | **MISSING** | `ls /workspace/supabase/migrations/` → directory does not exist |
| 2 | `middleware.ts` blocks admin from `/supplier/*` and supplier from `/admin/*` | **MISSING** | `test -f /workspace/middleware.ts` → file not found |
| 3 | `app/actions/bills.ts` exports `importTallyBill` returning `ActionResult<T>` | **MISSING** | `test -f /workspace/app/actions/bills.ts` → file not found |
| 4 | `app/supplier/history/page.tsx` exists | **MISSING** | `test -f /workspace/app/supplier/history/page.tsx` → file not found (expected gap per spec) |
| 5 | `app/(auth)/reset-password/page.tsx` exists | **MISSING** | `test -f /workspace/app/\(auth\)/reset-password/page.tsx` → file not found (expected gap per spec) |
| 6 | `lib/audit.ts` exists | **MISSING** | `test -f /workspace/lib/audit.ts` → file not found (expected gap per spec) |
| 7 | `/admin/bills/[id]/page.tsx` has a Reprint button | **MISSING** | `test -f /workspace/app/admin/bills/\[id\]/page.tsx` → file not found (expected gap per spec) |
| 8 | `package.json` has exact deps from MAHENDRA_BUILD_PLAN.md Phase 0 | **MISSING** | `test -f /workspace/package.json` → file not found |
| 9 | `.env.local` has three required vars | **MISSING** | `test -f /workspace/.env.local` → file not found; required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| 10 | `npm test` passes | **FAIL** | `npm test: UNAVAILABLE - no package.json` |

**Summary:** 0 PASS, 1 FAIL, 9 MISSING

**Human action required before PART 2:** Push or sync the full Mahendra Saree House application (migrations 00001–00018, app/, lib/, tests, package.json, etc.) into this repo on `main`, then re-run Section 0 verifications.

---

## 1. Execution order

Phases follow `MAHENDRA_BUILD_PLAN.md` Phases 0–10 in strict order. Do not skip. Do not reorder.

### Phase 0 — Repo & environment

- **Goal:** Confirm dependencies, env vars, and local Supabase stack are ready.
- **Files to touch (read only):**
  - `/workspace/package.json`
  - `/workspace/.env.local`
- **Verify commands:**
  ```bash
  supabase status
  test "$(grep -cE '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=' /workspace/.env.local)" -ge 3
  ```
- **Exit criteria:** `supabase status` exits 0 with API URL, anon key, and service_role key printed; `.env.local` contains all three required variable names; `package.json` lists every dependency from spec Phase 0.

### Phase 1 — Database

- **Goal:** Apply all migrations, confirm schema/RLS/triggers, seed admin, optionally invite demo supplier.
- **Files to touch (read only unless drift found):**
  - `/workspace/supabase/migrations/00001_initial_schema.sql` through `/workspace/supabase/migrations/018_auto_set_tenant_id.sql`
  - `/workspace/create_admin.js`
  - `/workspace/make_admins.js` (optional)
- **Verify commands:**
  ```bash
  supabase db reset
  supabase db diff
  psql "$SUPABASE_DB_URL" -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'"
  psql "$SUPABASE_DB_URL" -c "SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE 'trg_auto_tenant_%'"
  psql "$SUPABASE_DB_URL" -c "SELECT count(*) FROM public.users WHERE role='admin'"
  ```
- **Exit criteria:** `supabase db diff` empty; all business tables have `rowsecurity = true`; four `trg_auto_tenant_*` triggers exist; ≥1 admin user; after invite ≥1 supplier row with matching `auth.users` `app_metadata.role='supplier'`.

### Phase 2 — Server-side foundation (`lib/`)

- **Goal:** Confirm all `lib/` modules exist, follow invariants, and typecheck cleanly.
- **Files to touch (read; create only `/workspace/lib/audit.ts` if still missing — defer to Phase 7 Gap 3):**
  - `/workspace/lib/auth.ts`
  - `/workspace/lib/result.ts`
  - `/workspace/lib/logger.ts`
  - `/workspace/lib/validation.ts`
  - `/workspace/lib/pricing.ts`
  - `/workspace/lib/tally/xml-parser.ts`
  - `/workspace/lib/tally/excel-parser.ts`
  - `/workspace/lib/supabase/server.ts`
  - `/workspace/lib/supabase/client.ts`
  - `/workspace/lib/supabase/service.ts`
  - `/workspace/lib/pdf/index.ts`
  - `/workspace/lib/barcode/index.ts`
  - `/workspace/lib/utils.ts`
  - `/workspace/lib/audit.ts` (read or note MISSING for Phase 7)
- **Verify commands:**
  ```bash
  grep -r "user_metadata" /workspace/lib/ | grep -v __tests__ | grep -v tests/
  grep -rE "TODO|FIXME" /workspace/lib/
  npx tsc --noEmit
  ```
- **Exit criteria:** No `user_metadata` in `/workspace/lib/auth.ts`; zero TODO/FIXME in production `lib/` paths; `tsc --noEmit` exits 0.

### Phase 3 — Auth & route protection

- **Goal:** Confirm login, middleware role guards, and reset-password redirect logic.
- **Files to touch (read; create reset-password in Phase 7 if MISSING):**
  - `/workspace/app/layout.tsx`
  - `/workspace/app/(auth)/login/page.tsx`
  - `/workspace/app/(auth)/reset-password/page.tsx`
  - `/workspace/middleware.ts`
  - `/workspace/app/actions/auth.ts`
- **Verify commands:**
  ```bash
  curl -i http://localhost:3000/admin  # expect 302 → /login without cookies
  # Manual: admin → /admin OK, /supplier → 403; supplier → /supplier OK, /admin → 403
  # Manual: supplier with must_reset_password=true → /reset-password
  ```
- **Exit criteria:** All four middleware rules implemented; role redirects work; reset-password redirect fires for flagged suppliers.

### Phase 4 — Admin app

- **Goal:** Confirm admin pages, server actions, invite flow, and pricing re-import behaviour.
- **Files to touch (read; Reprint button deferred to Phase 7 Gap 4):**
  - `/workspace/app/admin/layout.tsx`
  - `/workspace/app/admin/page.tsx`
  - `/workspace/app/admin/bills/page.tsx`
  - `/workspace/app/admin/bills/[id]/page.tsx`
  - `/workspace/app/admin/suppliers/page.tsx`
  - `/workspace/app/admin/suppliers/client-page.tsx`
  - `/workspace/app/admin/items/page.tsx`
  - `/workspace/app/admin/items/client-page.tsx`
  - `/workspace/app/admin/imports/page.tsx`
  - `/workspace/app/admin/imports/import-form.tsx`
  - `/workspace/app/admin/pricing/page.tsx`
  - `/workspace/app/admin/layouts/page.tsx`
  - `/workspace/app/admin/layouts/LayoutClient.tsx`
  - `/workspace/app/admin/print/page.tsx`
  - `/workspace/app/admin/print/PrintClient.tsx`
  - `/workspace/app/admin/settings/page.tsx`
  - `/workspace/app/actions/suppliers.ts`
  - `/workspace/app/actions/bills.ts`
  - `/workspace/app/actions/items.ts`
  - `/workspace/app/actions/layouts.ts`
- **Verify commands:**
  ```bash
  # Manual: invite supplier → temp password modal with Copy; auth user has app_metadata.role=supplier
  # Manual: edit pricing rule → re-import Tally bill → trigger applies new model
  ```
- **Exit criteria:** All admin pages render; actions return `ActionResult<T>`; invite shows one-time temp password; pricing re-import applies updated rule.

### Phase 5 — Supplier app

- **Goal:** Confirm supplier dashboard, import, print; build history page if missing (Phase 7).
- **Files to touch (read; history deferred to Phase 7 Gap 1):**
  - `/workspace/app/supplier/layout.tsx`
  - `/workspace/app/supplier/page.tsx`
  - `/workspace/app/supplier/import/page.tsx`
  - `/workspace/app/supplier/import/import-form.tsx`
  - `/workspace/app/supplier/print/page.tsx`
  - `/workspace/app/supplier/history/page.tsx`
  - `/workspace/components/layout/supplier-layout.tsx`
- **Verify commands:**
  ```bash
  # Manual: supplier sees own bills only; import XML → dashboard; /supplier/print PDF with barcodes
  # Manual: direct API read of another supplier's bill → RLS denial
  ```
- **Exit criteria:** Supplier RLS isolation verified; import and print flows work.

### Phase 6 — API routes

- **Goal:** Confirm upload and barcode API routes with correct auth and query parsing.
- **Files to touch (read or modify query parsing only):**
  - `/workspace/app/api/bills/upload/route.ts`
  - `/workspace/app/api/bills/[id]/barcodes/route.ts`
- **Verify commands:**
  ```bash
  curl -i "http://localhost:3000/api/bills/<id>/barcodes?data=12345"
  curl -i -X POST http://localhost:3000/api/bills/upload  # without admin cookies → 403
  ```
- **Exit criteria:** Barcodes route returns 200 PNG; upload route returns 403 for non-admin.

### Phase 7 — Gaps to close

- **Goal:** Build the four known gaps (history page, reset-password, audit wiring, admin Reprint).
- **Files to touch:** See Section 2 (Gap closure plan).
- **Verify commands:**
  ```bash
  # Manual: /supplier/history with status + date filters
  # Manual: /reset-password clears must_reset_password
  psql "$SUPABASE_DB_URL" -c "SELECT count(*) FROM public.audit_log"  # before and after importTallyBill
  # Manual: admin Reprint opens PDF preview
  ```
- **Exit criteria:** All four gaps verified per `MAHENDRA_BUILD_PLAN.md` Phase 7 verify block.

### Phase 8 — Tests

- **Goal:** All unit and e2e tests pass; add tests only for new pure functions.
- **Files to touch (read; add tests only if new pure `lib/` functions introduced):**
  - `/workspace/__tests__/lib/pricing.test.ts`
  - `/workspace/__tests__/lib/tally/xml-parser.test.ts`
  - `/workspace/tests/unit/pricing.test.ts`
  - `/workspace/e2e/login.spec.ts`
  - `/workspace/e2e/import-print.spec.ts`
- **Verify commands:**
  ```bash
  npm test
  npm run e2e
  ```
- **Exit criteria:** `npm test` exits 0 with 10 passing; `npm run e2e` exits 0 with 2 specs passing.

### Phase 9 — Manual smoke

- **Goal:** Complete 10-step manual checklist including RLS denial test.
- **Files to touch:** None (verification only).
- **Verify commands:** 10 manual steps from `MAHENDRA_BUILD_PLAN.md` Phase 9.
- **Exit criteria:** All 10 steps pass; step 10 RLS denial confirmed.

### Phase 10 — Hardening (post-MVP)

- **Goal:** Optional rate limiting, deploy config — do not block demo.
- **Files to touch (only if explicitly approved):**
  - `/workspace/middleware.ts` (rate limit)
  - `/workspace/vercel.json` (create if deploying)
- **Verify commands:** N/A for MVP demo.
- **Exit criteria:** Skippable for initial ship; document if deferred.

---

## 2. Gap closure plan (Phase 7)

### Gap 1 — Supplier bill history page

- **ID:** GAP-1
- **Description:** `/supplier/history` referenced by sidebar but page does not exist.
- **Files:**
  - **Create:** `/workspace/app/supplier/history/page.tsx`
  - **Create:** `/workspace/app/supplier/history/history-filters.tsx` (client filter form)
  - **Modify:** `/workspace/components/layout/supplier-layout.tsx` (confirm sidebar link)
- **Signatures:**
  ```ts
  // /workspace/app/supplier/history/page.tsx
  import type { Metadata } from 'next';
  export default async function SupplierHistoryPage(props: {
    searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>;
  }): Promise<JSX.Element>

  // /workspace/app/supplier/history/history-filters.tsx
  'use client';
  export function HistoryFilters(props: {
    status?: string; from?: string; to?: string;
  }): JSX.Element
  ```
- **Imports (page):**
  ```ts
  import { requireSupplier } from '@/lib/auth';
  import { createClient } from '@/lib/supabase/server';
  import { formatINR } from '@/lib/pricing';
  import { HistoryFilters } from './history-filters';
  import Link from 'next/link';
  ```
- **Verify:**
  ```bash
  curl -i -b supplier-cookies.txt http://localhost:3000/supplier/history?status=imported
  curl -i -b supplier-cookies.txt "http://localhost:3000/supplier/history?from=2025-01-01&to=2025-12-31"
  ```

### Gap 2 — Reset password page

- **ID:** GAP-2
- **Description:** Middleware redirects `must_reset_password` suppliers but page may be missing.
- **Files:**
  - **Create:** `/workspace/app/(auth)/reset-password/page.tsx`
  - **Create:** `/workspace/app/(auth)/reset-password/reset-form.tsx` (client form)
  - **Modify:** `/workspace/app/actions/auth.ts` (confirm `resetPassword` clears flag via service role)
- **Signatures:**
  ```ts
  // /workspace/app/(auth)/reset-password/page.tsx
  export default async function ResetPasswordPage(): Promise<JSX.Element>

  // /workspace/app/(auth)/reset-password/reset-form.tsx
  'use client';
  export function ResetPasswordForm(): JSX.Element

  // /workspace/app/actions/auth.ts (existing — confirm signature)
  export async function resetPassword(formData: FormData): Promise<ActionResult<{ redirectTo: string }>>
  ```
- **Imports (page):**
  ```ts
  import { requireUser } from '@/lib/auth';
  import { redirect } from 'next/navigation';
  import { ResetPasswordForm } from './reset-form';
  ```
- **Verify:**
  ```bash
  # Login supplier with must_reset_password=true → lands on /reset-password
  # Submit new password → redirect to /supplier; psql confirms must_reset_password=false
  psql "$SUPABASE_DB_URL" -c "SELECT must_reset_password FROM public.users WHERE id='<uid>'"
  ```

### Gap 3 — Audit log module and wiring

- **ID:** GAP-3
- **Description:** `lib/audit.ts` missing; audit writes not wired into key server actions.
- **Files:**
  - **Create:** `/workspace/lib/audit.ts`
  - **Modify:** `/workspace/app/actions/bills.ts` (`importTallyBill`, `cancelBill`, `markBillPrinted`)
  - **Modify:** `/workspace/app/actions/suppliers.ts` or pricing action file (`upsertPricingRule`)
  - **Modify:** `/workspace/app/actions/suppliers.ts` (`inviteSupplier`)
- **Signatures:**
  ```ts
  // /workspace/lib/audit.ts
  'use server';
  export async function writeAudit(
    action: string,
    entity: string,
    entityId: string,
    diff?: Record<string, unknown>
  ): Promise<void>
  ```
- **Imports (`lib/audit.ts`):**
  ```ts
  import { createClient } from '@/lib/supabase/server';
  import { newRequestId } from '@/lib/logger';
  ```
- **Wire points (add call after successful mutation, inside existing try block):**
  - `importTallyBill` → `writeAudit('import', 'bill', billId, { itemCount })`
  - `cancelBill` → `writeAudit('cancel', 'bill', billId, {})`
  - `markBillPrinted` → `writeAudit('print', 'bill', billId, {})`
  - `upsertPricingRule` → `writeAudit('upsert', 'pricing_rule', ruleId, { model })`
  - `inviteSupplier` → `writeAudit('invite', 'supplier', supplierId, { email })`
- **Verify:**
  ```bash
  COUNT_BEFORE=$(psql "$SUPABASE_DB_URL" -t -c "SELECT count(*) FROM public.audit_log")
  # run importTallyBill via UI or action
  COUNT_AFTER=$(psql "$SUPABASE_DB_URL" -t -c "SELECT count(*) FROM public.audit_log")
  test "$COUNT_AFTER" -gt "$COUNT_BEFORE"
  ```

### Gap 4 — Admin Reprint button

- **ID:** GAP-4
- **Description:** Admin bill detail lacks Reprint button using shared PDF path.
- **Files:**
  - **Modify:** `/workspace/app/admin/bills/[id]/page.tsx`
  - **Create:** `/workspace/app/admin/bills/[id]/reprint-button.tsx` (client preview modal)
- **Signatures:**
  ```ts
  // /workspace/app/admin/bills/[id]/reprint-button.tsx
  'use client';
  import type { Bill, BillItem, Layout } from '@/lib/types'; // or inline props from getBill
  export function ReprintButton(props: {
    bill: Bill; items: BillItem[]; layout: Layout;
  }): JSX.Element
  ```
- **Imports (client component):**
  ```ts
  import { PDFViewer } from '@react-pdf/renderer'; // ONLY if existing /supplier/print pattern uses it; prefer wrapping via @/lib/pdf
  import { renderBillPDF } from '@/lib/pdf';
  ```
- **Verify:**
  ```bash
  # Manual: open /admin/bills/<id> as admin → click Reprint → PDF preview modal opens with barcodes
  ```

---

## 3. Test plan

### Existing test files (per spec — verify after codebase sync)

| File | Coverage |
|------|----------|
| `/workspace/__tests__/lib/pricing.test.ts` | 7 cases: zero margin/markup/GST, margin %, markup %, GST on taxable, CGST/SGST split, IGST interstate, floating-point accuracy |
| `/workspace/__tests__/lib/tally/xml-parser.test.ts` | 3 cases: valid Tally XML parse, invalid XML throws, state extraction for IGST vs CGST |
| `/workspace/tests/unit/pricing.test.ts` | 2 cases: duplicate regression suite (keep as-is, do not delete) |
| `/workspace/e2e/login.spec.ts` | Admin and supplier login paths |
| `/workspace/e2e/import-print.spec.ts` | Full import → print flow |

### New test files to add

| File | Reason |
|------|--------|
| *(none required)* | Phase 7 gaps add pages and server-side wiring, not new pure `lib/` functions. No new unit test files unless a new pure function is extracted during implementation. |

Optional future addition (not blocking): `/workspace/e2e/supplier-history.spec.ts` if e2e coverage for history filters is desired — not required by spec.

### Commands

```bash
npm test
npm run e2e
```

### Expected pass count after build

- **Unit:** 10 passing (7 pricing + 3 xml-parser + 2 regression) + **0 new** = **10 total**
- **E2E:** **2** specs (login, import-print)

---

## 4. Risk register

| Risk | Likelihood | Impact | Mitigation | Owner phase |
|------|------------|--------|------------|-------------|
| RLS misconfiguration allowing cross-tenant reads | Medium | Critical | Verify `rowsecurity=true` on all business tables (Phase 1); run step-10 smoke RLS denial curl (Phase 9); never bypass RLS in client code | Phase 1, 9 |
| Service-role key leaking to client bundle | Low | Critical | Grep `SUPABASE_SERVICE_ROLE_KEY` and `createServiceClient` in `app/` after every client-file edit; forbid imports in `'use client'` files | Phase 2, all |
| Trigger 018 not firing on supplier inserts | Medium | High | Phase 1 verify `trg_auto_tenant_*` on bills, bill_items, items, tally_imports; supplier inserts must omit manual `tenant_id` | Phase 1, 5 |
| `compute_bill_item_pricing` trigger not applying correct pricing model | Medium | High | Phase 4 verify: edit pricing rule → re-import bill → inspect computed line fields in DB | Phase 4 |
| PDF rendering failure on a specific bill | Medium | Medium | Reuse `@/lib/pdf` only; test Reprint and supplier print with sample bill; log render errors via `@/lib/logger` | Phase 5, 7 |
| Barcode generation mismatch with sticker layout | Medium | Medium | Route all barcode gen through `@/lib/barcode`; confirm API query params match layout scale/height defaults | Phase 6 |
| Empty repo / missing codebase blocks all phases | **Current** | Critical | Sync full application to `main` before PART 2; re-run Section 0 | Pre-Phase 0 |
| `writeAudit` failure blocking bill import | Low | Medium | Audit must never throw (spec); catch and `console.error` only | Phase 7 |
| Reset-password not clearing `must_reset_password` | Medium | High | Service-role update on `public.users` after `auth.updateUser`; verify in psql | Phase 7 |
| Test regression during gap closure | Medium | Medium | Run `npm test` after each phase; halt on any previously passing test failure | Phase 8 |

---

## 5. Stop conditions

Execution MUST halt and escalate to the human when any of the following occur:

1. **Any FAIL in Section 0 verifications** — including missing `package.json`, missing migrations, or failing `npm test`.
2. **Any MISSING critical path** not listed as an expected Phase 7 gap (e.g., missing `lib/auth.ts`, missing `middleware.ts`, missing migration files).
3. **Any RLS bypass discovered during testing** — cross-tenant data visible via UI, API, or direct Supabase REST.
4. **Any service-role key in a `'use client'` file** — `grep` hit for `SUPABASE_SERVICE_ROLE_KEY` or `createServiceClient` inside client components.
5. **Any data loss or destructive action not explicitly approved** — e.g., `supabase db reset` after Phase 1 initial verification (forbidden per PART 2 rules), dropping tables, bulk deletes.
6. **Any test regression** — previously passing unit or e2e test now fails.
7. **Missing required env vars** — `.env.local` lacks `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`.
8. **`supabase db diff` shows drift** after migrations applied — indicates uncommitted schema changes.
9. **Attempt to install new npm packages** without explicit human approval (per PART 2 forbidden actions).
10. **Attempt to modify** `/workspace/MAHENDRA_BUILD_PLAN.md` or `/workspace/PLAN.md`.

---

## 6. Handoff contract to Cursor CLI

### Allowed to create or modify

**Phase 7 gap files (create):**
- `/workspace/app/supplier/history/page.tsx`
- `/workspace/app/supplier/history/history-filters.tsx`
- `/workspace/app/(auth)/reset-password/page.tsx`
- `/workspace/app/(auth)/reset-password/reset-form.tsx`
- `/workspace/lib/audit.ts`
- `/workspace/app/admin/bills/[id]/reprint-button.tsx`

**Phase 7 gap files (modify):**
- `/workspace/components/layout/supplier-layout.tsx`
- `/workspace/app/actions/auth.ts`
- `/workspace/app/actions/bills.ts`
- `/workspace/app/actions/suppliers.ts` (and pricing action file if `upsertPricingRule` lives elsewhere)
- `/workspace/app/admin/bills/[id]/page.tsx`

**Phase 6 (modify only if query parsing missing):**
- `/workspace/app/api/bills/[id]/barcodes/route.ts`

**Phase 10 (only with approval):**
- `/workspace/middleware.ts`
- `/workspace/vercel.json`

**Build artefact (append only):**
- `/workspace/BUILD_LOG.md`

**New migrations (only if schema change required — prefer none for Phase 7):**
- `/workspace/supabase/migrations/NNNN_<name>.sql` (zero-padded, never edit 00001–00018)

**New tests (only if new pure functions added):**
- `/workspace/__tests__/lib/<name>.test.ts`
- `/workspace/e2e/<flow>.spec.ts`

**All other existing application files:** read-only unless a phase verify step exposes a concrete bug. Extend; do not rewrite.

### FORBIDDEN to touch

- `/workspace/MAHENDRA_BUILD_PLAN.md`
- `/workspace/PLAN.md`
- `/workspace/supabase/migrations/00001_initial_schema.sql` through `/workspace/supabase/migrations/018_auto_set_tenant_id.sql` (committed migrations — never edit)
- `/workspace/tests/unit/pricing.test.ts` (regression suite — do not delete or gut)
- Seed admin/supplier account scripts content (`/workspace/create_admin.js`, `/workspace/make_admins.js`) — do not modify seeded credentials logic
- `.git/config`, CI secrets, `.env.local` values (read var names only)
- Any file outside the allowed lists above without explicit human approval
- `main` branch (work on `build/mahendra-phase-0-9` branched from this plan branch)

### Verify command per phase

| Phase | Command |
|-------|---------|
| 0 | `supabase status && test "$(grep -cE '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)=' /workspace/.env.local)" -ge 3` |
| 1 | `supabase db diff` (empty) + RLS/trigger psql queries (Section 1) |
| 2 | `npx tsc --noEmit` + grep checks (Section 1) |
| 3 | `curl -i http://localhost:3000/admin` + manual role redirects |
| 4 | Manual invite + pricing re-import |
| 5 | Manual supplier import/print + RLS isolation |
| 6 | `curl` barcodes + upload 403 |
| 7 | History filters + reset-password + audit count + Reprint modal |
| 8 | `npm test && npm run e2e` |
| 9 | 10-step manual smoke checklist |
| 10 | N/A (optional) |

### Database table paths

- **Audit log table:** `public.audit_log`
- **Pricing rules table:** `public.pricing_rules`

### Branch strategy (from APPENDIX C)

- Planning branch: `cursor/plan-mahendra-build-51c0` (this branch, contains `PLAN.md`)
- Execution branch: `build/mahendra-phase-0-9` (branched from plan branch by CLI agent)
- Review compares `build/mahendra-phase-0-9` against `main`
