-- Wipe all test data. Keeps: tenants, users (admin), tally_column_mappings,
-- layouts. Deletes: bills, bill_items, suppliers (cascades pricing_rules),
-- items, tally_imports, audit_log, tenant_month_exports, tally-imports bucket objects.
--
-- Run in Supabase SQL editor as postgres (bypasses RLS). Idempotent.

BEGIN;

-- BEFORE counts
SELECT 'bills' AS table, count(*)::text AS rows FROM public.bills
UNION ALL SELECT 'bill_items', count(*)::text FROM public.bill_items
UNION ALL SELECT 'suppliers', count(*)::text FROM public.suppliers
UNION ALL SELECT 'pricing_rules', count(*)::text FROM public.pricing_rules
UNION ALL SELECT 'items', count(*)::text FROM public.items
UNION ALL SELECT 'tally_imports', count(*)::text FROM public.tally_imports
UNION ALL SELECT 'audit_log', count(*)::text FROM public.audit_log
UNION ALL SELECT 'tenant_month_exports', count(*)::text FROM public.tenant_month_exports
UNION ALL SELECT 'storage.tally-imports', count(*)::text FROM storage.objects WHERE bucket_id = 'tally-imports';

-- 1. tally_imports (FK to suppliers — delete before suppliers)
DELETE FROM public.tally_imports;

-- 2. bills (CASCADE removes bill_items)
DELETE FROM public.bills;

-- 3. items (tenant master SKUs — test data)
DELETE FROM public.items;

-- 4. tenant_month_exports (month-close tracking)
DELETE FROM public.tenant_month_exports;

-- 5. audit_log (all entries — test history)
DELETE FROM public.audit_log;

-- 6. storage objects in tally-imports bucket (pending test uploads)
DELETE FROM storage.objects WHERE bucket_id = 'tally-imports';

-- 7. suppliers (CASCADE removes pricing_rules; users.supplier_id becomes NULL)
DELETE FROM public.suppliers;

COMMIT;

-- AFTER counts (should all be 0 except users/tenants/mappings/layouts)
SELECT 'bills' AS table, count(*)::text AS rows FROM public.bills
UNION ALL SELECT 'bill_items', count(*)::text FROM public.bill_items
UNION ALL SELECT 'suppliers', count(*)::text FROM public.suppliers
UNION ALL SELECT 'pricing_rules', count(*)::text FROM public.pricing_rules
UNION ALL SELECT 'items', count(*)::text FROM public.items
UNION ALL SELECT 'tally_imports', count(*)::text FROM public.tally_imports
UNION ALL SELECT 'audit_log', count(*)::text FROM public.audit_log
UNION ALL SELECT 'tenant_month_exports', count(*)::text FROM public.tenant_month_exports
UNION ALL SELECT 'storage.tally-imports', count(*)::text FROM storage.objects WHERE bucket_id = 'tally-imports'
UNION ALL SELECT 'users (kept)', count(*)::text FROM public.users
UNION ALL SELECT 'tenants (kept)', count(*)::text FROM public.tenants
UNION ALL SELECT 'tally_column_mappings (kept)', count(*)::text FROM public.tally_column_mappings
UNION ALL SELECT 'layouts (kept)', count(*)::text FROM public.layouts;
