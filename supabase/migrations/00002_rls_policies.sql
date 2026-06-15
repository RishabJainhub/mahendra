-- Enable RLS on all business tables (initial policies; replaced in 011)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tally_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tally_column_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;

-- Helper: current user's tenant from public.users (pre-JWT era)
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid();
$$;

CREATE POLICY tenants_select ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.current_user_tenant_id());

CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_user_tenant_id() OR id = auth.uid());

CREATE POLICY suppliers_tenant ON public.suppliers
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE POLICY items_tenant ON public.items
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE POLICY bills_tenant ON public.bills
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE POLICY bill_items_via_bill ON public.bill_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_items.bill_id
        AND b.tenant_id = public.current_user_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_items.bill_id
        AND b.tenant_id = public.current_user_tenant_id()
    )
  );

CREATE POLICY tally_imports_tenant ON public.tally_imports
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE POLICY tally_mappings_tenant ON public.tally_column_mappings
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE POLICY pricing_rules_tenant ON public.pricing_rules
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE POLICY audit_log_tenant ON public.audit_log
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());

CREATE POLICY layouts_tenant ON public.layouts
  FOR ALL TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());
