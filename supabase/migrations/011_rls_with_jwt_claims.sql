-- JWT app_metadata helpers for RLS policies
CREATE OR REPLACE FUNCTION public.jwt_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.jwt_supplier_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'supplier_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;

GRANT EXECUTE ON FUNCTION public.jwt_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.jwt_supplier_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.jwt_role() TO authenticated, service_role;

-- Drop legacy policies from 00002
DROP POLICY IF EXISTS tenants_select ON public.tenants;
DROP POLICY IF EXISTS users_select ON public.users;
DROP POLICY IF EXISTS suppliers_tenant ON public.suppliers;
DROP POLICY IF EXISTS items_tenant ON public.items;
DROP POLICY IF EXISTS bills_tenant ON public.bills;
DROP POLICY IF EXISTS bill_items_via_bill ON public.bill_items;
DROP POLICY IF EXISTS tally_imports_tenant ON public.tally_imports;
DROP POLICY IF EXISTS tally_mappings_tenant ON public.tally_column_mappings;
DROP POLICY IF EXISTS pricing_rules_tenant ON public.pricing_rules;
DROP POLICY IF EXISTS audit_log_tenant ON public.audit_log;
DROP POLICY IF EXISTS layouts_tenant ON public.layouts;

-- Tenants
CREATE POLICY tenants_select_jwt ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.jwt_tenant_id());

-- Users
CREATE POLICY users_select_jwt ON public.users
  FOR SELECT TO authenticated
  USING (tenant_id = public.jwt_tenant_id() OR id = auth.uid());

CREATE POLICY users_update_self_jwt ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Suppliers
CREATE POLICY suppliers_select_jwt ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND (
      public.jwt_role() = 'admin'
      OR id = public.jwt_supplier_id()
    )
  );

CREATE POLICY suppliers_admin_write_jwt ON public.suppliers
  FOR ALL TO authenticated
  USING (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin')
  WITH CHECK (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin');

-- Items
CREATE POLICY items_select_jwt ON public.items
  FOR SELECT TO authenticated
  USING (tenant_id = public.jwt_tenant_id());

CREATE POLICY items_admin_write_jwt ON public.items
  FOR ALL TO authenticated
  USING (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin')
  WITH CHECK (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin');

-- Bills
CREATE POLICY bills_select_jwt ON public.bills
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND (
      public.jwt_role() = 'admin'
      OR supplier_id = public.jwt_supplier_id()
    )
  );

CREATE POLICY bills_admin_write_jwt ON public.bills
  FOR ALL TO authenticated
  USING (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin')
  WITH CHECK (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin');

-- Bill items
CREATE POLICY bill_items_select_jwt ON public.bill_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_items.bill_id
        AND b.tenant_id = public.jwt_tenant_id()
        AND (
          public.jwt_role() = 'admin'
          OR b.supplier_id = public.jwt_supplier_id()
        )
    )
  );

-- Tally imports
CREATE POLICY tally_imports_select_jwt ON public.tally_imports
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND (
      public.jwt_role() = 'admin'
      OR supplier_id = public.jwt_supplier_id()
    )
  );

CREATE POLICY tally_imports_admin_write_jwt ON public.tally_imports
  FOR ALL TO authenticated
  USING (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin')
  WITH CHECK (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin');

-- Tally column mappings
CREATE POLICY tally_mappings_select_jwt ON public.tally_column_mappings
  FOR SELECT TO authenticated
  USING (tenant_id = public.jwt_tenant_id());

CREATE POLICY tally_mappings_admin_write_jwt ON public.tally_column_mappings
  FOR ALL TO authenticated
  USING (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin')
  WITH CHECK (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin');

-- Pricing rules
CREATE POLICY pricing_rules_select_jwt ON public.pricing_rules
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND (
      public.jwt_role() = 'admin'
      OR supplier_id = public.jwt_supplier_id()
    )
  );

CREATE POLICY pricing_rules_admin_write_jwt ON public.pricing_rules
  FOR ALL TO authenticated
  USING (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin')
  WITH CHECK (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin');

-- Audit log
CREATE POLICY audit_log_select_jwt ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'admin'
  );

CREATE POLICY audit_log_insert_jwt ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.jwt_tenant_id());

-- Layouts
CREATE POLICY layouts_select_jwt ON public.layouts
  FOR SELECT TO authenticated
  USING (tenant_id = public.jwt_tenant_id());

CREATE POLICY layouts_admin_write_jwt ON public.layouts
  FOR ALL TO authenticated
  USING (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin')
  WITH CHECK (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin');
