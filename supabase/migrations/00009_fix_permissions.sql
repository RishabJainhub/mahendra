-- Fix function execution permissions and schema access
GRANT EXECUTE ON FUNCTION public.current_user_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_bill_item_pricing() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE ALL ON public.tenants FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM anon;
