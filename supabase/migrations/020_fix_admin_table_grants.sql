-- Migration 012 revoked broad table access and re-granted SELECT-only on several
-- admin-managed tables. RLS policies in 011 allow admin writes, but PostgreSQL
-- checks table-level GRANT before RLS — causing "permission denied for table ...".

GRANT INSERT, UPDATE, DELETE ON public.pricing_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tally_column_mappings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.layouts TO authenticated;
GRANT DELETE ON public.bills TO authenticated;

-- Settings page updates tenant profile
GRANT UPDATE ON public.tenants TO authenticated;

CREATE POLICY tenants_admin_update_jwt ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = public.jwt_tenant_id() AND public.jwt_role() = 'admin')
  WITH CHECK (id = public.jwt_tenant_id() AND public.jwt_role() = 'admin');
