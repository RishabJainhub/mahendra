-- Ensure audit_log always has tenant_id populated from JWT
ALTER TABLE public.audit_log
  ALTER COLUMN tenant_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_audit_log_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.jwt_tenant_id();
  END IF;

  IF NEW.actor_id IS NULL THEN
    NEW.actor_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_tenant_id ON public.audit_log;

CREATE TRIGGER trg_audit_log_tenant_id
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.set_audit_log_tenant_id();

GRANT EXECUTE ON FUNCTION public.set_audit_log_tenant_id() TO authenticated, service_role;
