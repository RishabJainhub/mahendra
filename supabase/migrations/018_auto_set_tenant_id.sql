-- Auto-set tenant_id from JWT app_metadata on supplier inserts
CREATE OR REPLACE FUNCTION public.auto_set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.jwt_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_set_tenant_id() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_auto_tenant_bills ON public.bills;
CREATE TRIGGER trg_auto_tenant_bills
  BEFORE INSERT ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_bill_items ON public.bill_items;
CREATE TRIGGER trg_auto_tenant_bill_items
  BEFORE INSERT ON public.bill_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_items ON public.items;
CREATE TRIGGER trg_auto_tenant_items
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_tally_imports ON public.tally_imports;
CREATE TRIGGER trg_auto_tenant_tally_imports
  BEFORE INSERT ON public.tally_imports
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_tenant_id();
