-- Sync auth.users app_metadata with public.users profile fields
CREATE OR REPLACE FUNCTION public.sync_user_app_metadata(
  p_user_id uuid,
  p_tenant_id uuid,
  p_role text,
  p_supplier_id uuid DEFAULT NULL,
  p_must_reset_password boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'tenant_id', p_tenant_id::text,
    'role', p_role,
    'supplier_id', CASE WHEN p_supplier_id IS NULL THEN NULL ELSE p_supplier_id::text END,
    'must_reset_password', p_must_reset_password
  )
  WHERE id = p_user_id;

  UPDATE public.users
  SET
    tenant_id = p_tenant_id,
    role = p_role,
    supplier_id = p_supplier_id,
    must_reset_password = p_must_reset_password
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata', '{}'::jsonb);
$$;

REVOKE ALL ON FUNCTION public.sync_user_app_metadata(uuid, uuid, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_user_app_metadata(uuid, uuid, text, uuid, boolean) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_jwt_claims() TO authenticated, service_role;
