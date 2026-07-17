-- 041_prevent_duplicate_visible_bills.sql
-- Soft-delete previously used a single partial unique index that only covered
-- rows visible to BOTH portals. That meant:
--   • supplier hides bill → admin can re-import same # → admin sees TWO bills
--   • admin hides bill → re-import → supplier sees OLD + NEW (same bill #)
--
-- Fix: keep uniqueness separately for each portal's visible set, and make
-- "Replace existing" hide the old row from both portals before inserting.

-- Retire older duplicates so the new unique indexes can be created.
-- Keep the newest row visible; hide older copies from both portals.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id, supplier_id, bill_number
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.bills
  WHERE admin_hidden_at IS NULL
)
UPDATE public.bills b
SET admin_hidden_at = COALESCE(b.admin_hidden_at, now())
FROM ranked r
WHERE b.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id, supplier_id, bill_number
      ORDER BY created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.bills
  WHERE supplier_hidden_at IS NULL
)
UPDATE public.bills b
SET supplier_hidden_at = COALESCE(b.supplier_hidden_at, now())
FROM ranked r
WHERE b.id = r.id AND r.rn > 1;

DROP INDEX IF EXISTS bills_tenant_supplier_number_uidx;

-- At most one admin-visible bill per (tenant, supplier, bill_number).
CREATE UNIQUE INDEX bills_admin_visible_number_uidx
  ON public.bills (tenant_id, supplier_id, bill_number)
  WHERE admin_hidden_at IS NULL;

-- At most one supplier-visible bill per (tenant, supplier, bill_number).
CREATE UNIQUE INDEX bills_supplier_visible_number_uidx
  ON public.bills (tenant_id, supplier_id, bill_number)
  WHERE supplier_hidden_at IS NULL;
