-- 026_lock_down_supplier_data_access.sql
---
-- Close three data-leak surfaces identified in the security audit:
--
--   1. pricing_rules — suppliers could SELECT their own row and read the full
--      MA/DNA markup formula (ma_markup1_pct, ma_markup2_pct,
--      dna_markup1_pct, dna_markup2_pct, gst_pct) directly via the REST API,
--      bypassing the UI. Suppliers never need to read this table: the
--      `compute_bill_item_pricing` trigger writes ma_price/dna_price onto
--      bill_items at import time, and labels read those computed values.
--
--   2. users — suppliers could SELECT every user in the tenant (admin emails,
--      other supplier emails, role/supplier_id mappings) because the policy
--      allowed `tenant_id = jwt_tenant_id()`. Restrict to self for non-admins.
--
--   3. items — suppliers could SELECT the entire tenant item catalog
--      including base_rate and mrp (admin's cost reference). Suppliers do not
--      use the items table in any UI flow; HSN is stored on bill_items.hsn.
--
-- Grants stay as-is (table-level GRANT SELECT to authenticated is required so
-- admins can read). RLS now does the actual blocking for suppliers.

-- 1. pricing_rules: admin-only SELECT.
DROP POLICY IF EXISTS pricing_rules_select_jwt ON public.pricing_rules;
CREATE POLICY pricing_rules_select_jwt ON public.pricing_rules
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'admin'
  );

-- 2. users: self only, plus admin tenant-wide read.
DROP POLICY IF EXISTS users_select_jwt ON public.users;
CREATE POLICY users_select_jwt ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (
      tenant_id = public.jwt_tenant_id()
      AND public.jwt_role() = 'admin'
    )
  );

-- 3. items: admin-only SELECT. (items_admin_write_jwt already allows admin
--    FOR ALL; this explicit select policy keeps the intent readable and
--    blocks suppliers.)
DROP POLICY IF EXISTS items_select_jwt ON public.items;
CREATE POLICY items_select_jwt ON public.items
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'admin'
  );
