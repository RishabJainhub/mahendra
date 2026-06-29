-- 027_supplier_replace_existing_bill.sql
---
-- Fix: suppliers could not "Replace existing" on re-import because there was
-- no RLS DELETE policy on public.bills for suppliers. The replace path in
-- importTallyBill (app/actions/bills.ts) calls bills.delete().eq('id', existing.id),
-- which RLS blocked (only bills_admin_write_jwt covered DELETE, and that is
-- admin-only). Suppliers re-importing a duplicate bill got a silent RLS error.
--
-- Allow a supplier to DELETE their OWN bills (supplier_id = jwt_supplier_id()).
-- This mirrors bills_supplier_update_jwt and is the minimum needed for the
-- replace-existing flow. Bill items cascade via the FK ON DELETE CASCADE.

CREATE POLICY bills_supplier_delete_jwt ON public.bills
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'supplier'
    AND supplier_id = public.jwt_supplier_id()
  );
