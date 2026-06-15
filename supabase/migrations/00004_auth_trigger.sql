-- Mirror auth.users into public.users on signup
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
    COALESCE(NEW.raw_app_meta_data ->> 'role', 'admin'),
    NULLIF(NEW.raw_app_meta_data ->> 'supplier_id', '')::uuid,
    COALESCE((NEW.raw_app_meta_data ->> 'must_reset_password')::boolean, false)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
