-- Default new users to supplier role unless app_metadata specifies admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, tenant_id, role, supplier_id, must_reset_password)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_app_meta_data ->> 'tenant_id', '')::uuid,
    COALESCE(NEW.raw_app_meta_data ->> 'role', 'supplier'),
    NULLIF(NEW.raw_app_meta_data ->> 'supplier_id', '')::uuid,
    COALESCE((NEW.raw_app_meta_data ->> 'must_reset_password')::boolean, false)
  );
  RETURN NEW;
END;
$$;
