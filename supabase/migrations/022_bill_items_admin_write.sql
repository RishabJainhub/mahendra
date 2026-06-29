-- Admin write policies for bill_items.
--
-- Migration 011 added bill_items_select_jwt (admins can read) and migration
-- 017 added bill_items_supplier_insert_jwt (suppliers can insert). Neither
-- allows admins to INSERT/UPDATE/DELETE bill_items, so admin-driven Tally
-- imports created the bills row but the line items silently dropped (RLS
-- WITH CHECK violation). This adds the missing admin policies.

CREATE POLICY bill_items_admin_insert_jwt ON public.bill_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_items.bill_id
        AND b.tenant_id = public.jwt_tenant_id()
        AND public.jwt_role() = 'admin'
    )
  );

CREATE POLICY bill_items_admin_update_jwt ON public.bill_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_items.bill_id
        AND b.tenant_id = public.jwt_tenant_id()
        AND public.jwt_role() = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_items.bill_id
        AND b.tenant_id = public.jwt_tenant_id()
        AND public.jwt_role() = 'admin'
    )
  );

CREATE POLICY bill_items_admin_delete_jwt ON public.bill_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_items.bill_id
        AND b.tenant_id = public.jwt_tenant_id()
        AND public.jwt_role() = 'admin'
    )
  );

GRANT INSERT, UPDATE, DELETE ON public.bill_items TO authenticated;
