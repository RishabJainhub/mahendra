-- 042_fix_admin_select_bypass_soft_delete.sql
--
-- Bug: bills_admin_write_jwt was FOR ALL, which includes SELECT.
-- Postgres ORs permissive policies, so admins could still see soft-deleted
-- bills (admin_hidden_at set) via the write policy even though
-- bills_select_jwt correctly requires admin_hidden_at IS NULL.
--
-- Fix: split admin write into INSERT / UPDATE / DELETE only — never SELECT.

DROP POLICY IF EXISTS bills_admin_write_jwt ON public.bills;

CREATE POLICY bills_admin_insert_jwt ON public.bills
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'admin'
  );

CREATE POLICY bills_admin_update_jwt ON public.bills
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'admin'
  )
  WITH CHECK (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'admin'
  );

CREATE POLICY bills_admin_delete_jwt ON public.bills
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'admin'
  );

-- Defense in depth: keep select policy as the only SELECT path.
DROP POLICY IF EXISTS bills_select_jwt ON public.bills;
CREATE POLICY bills_select_jwt ON public.bills
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND (
      (
        public.jwt_role() = 'supplier'
        AND supplier_id = public.jwt_supplier_id()
        AND supplier_hidden_at IS NULL
      )
      OR (
        public.jwt_role() = 'admin'
        AND admin_hidden_at IS NULL
      )
    )
  );
