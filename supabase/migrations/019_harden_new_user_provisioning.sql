-- Security hardening: fail closed when a user is created without proper
-- provisioning metadata. Suppliers/admins are always created with explicit
-- app_metadata (role + tenant_id) via service-role flows (create_admin.js,
-- inviteSupplier). A user arriving without a role/tenant can only come from
-- an unintended public signup, so reject it at the database boundary instead
-- of silently defaulting to the privileged 'supplier' role (see 00005).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      text := NEW.raw_app_meta_data ->> 'role';
  v_tenant_id uuid := NULLIF(NEW.raw_app_meta_data ->> 'tenant_id', '')::uuid;
BEGIN
  IF v_role IS NULL OR v_role NOT IN ('admin', 'supplier') THEN
    RAISE EXCEPTION 'User must be provisioned with a valid role (admin|supplier)';
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'User must be provisioned with a tenant_id';
  END IF;

  INSERT INTO public.users (id, email, tenant_id, role, supplier_id, must_reset_password)
  VALUES (
    NEW.id,
    NEW.email,
    v_tenant_id,
    v_role,
    NULLIF(NEW.raw_app_meta_data ->> 'supplier_id', '')::uuid,
    COALESCE((NEW.raw_app_meta_data ->> 'must_reset_password')::boolean, false)
  );

  RETURN NEW;
END;
$$;
