-- Provision a supplier record for invite flow (called with service role after auth user creation)
CREATE OR REPLACE FUNCTION public.provision_supplier_user(
  email text,
  p_tenant_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id uuid;
  v_rule_id     uuid;
  v_name        text;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;

  IF email IS NULL OR trim(email) = '' THEN
    RAISE EXCEPTION 'email is required';
  END IF;

  v_name := split_part(email, '@', 1);

  INSERT INTO public.suppliers (tenant_id, name, email, active)
  VALUES (p_tenant_id, v_name, lower(trim(email)), true)
  RETURNING id INTO v_supplier_id;

  INSERT INTO public.pricing_rules (tenant_id, supplier_id, model, margin_pct, markup_pct, gst_pct)
  VALUES (p_tenant_id, v_supplier_id, 'company151', 0, 0, 5)
  RETURNING id INTO v_rule_id;

  UPDATE public.suppliers
  SET pricing_rule_id = v_rule_id
  WHERE id = v_supplier_id;

  RETURN v_supplier_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_supplier_user(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_supplier_user(text, uuid) TO service_role;
