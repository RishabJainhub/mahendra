-- MA/DNA sticker labels: supplier code, two independent consecutive-markup pricing
-- formulas (MA and DNA) computed per bill line, plus HSN/MA/DNA on bill_items.

-- 1. Supplier identification code (rendered on labels as "{prefix}({number})").
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS code_prefix text,
  ADD COLUMN IF NOT EXISTS code_number text;

-- 2. Two independent consecutive markup chains on pricing_rules. Legacy
--    model/margin_pct/markup_pct columns are kept around for now and removed
--    in a later cleanup once nothing reads them.
ALTER TABLE public.pricing_rules
  ADD COLUMN IF NOT EXISTS ma_markup1_pct  numeric(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ma_markup2_pct  numeric(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dna_markup1_pct numeric(8, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dna_markup2_pct numeric(8, 4) NOT NULL DEFAULT 0;

-- Backfill: existing company151 rows historically applied a single 25% markup
-- to produce the sticker price -> preserve that as MA's first markup.
UPDATE public.pricing_rules
SET ma_markup1_pct = 25
WHERE model = 'company151'
  AND ma_markup1_pct = 0
  AND ma_markup2_pct = 0;

-- 3. Per-line storage for HSN + the two label prices.
ALTER TABLE public.bill_items
  ADD COLUMN IF NOT EXISTS hsn       text,
  ADD COLUMN IF NOT EXISTS ma_price  numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dna_price numeric(12, 2) NOT NULL DEFAULT 0;

-- 4. Rewrite the BEFORE INSERT trigger to compute MA and DNA prices from the
--    new markup columns. `unit_price` keeps tracking the MA price so existing
--    aggregates (taxable / cgst / sgst / total) on the bill remain meaningful.
CREATE OR REPLACE FUNCTION public.compute_bill_item_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id uuid;
  v_rule        public.pricing_rules%ROWTYPE;
  v_ma_price    numeric(12, 2);
  v_dna_price   numeric(12, 2);
  v_taxable     numeric(14, 2);
  v_gst_amount  numeric(14, 2);
  v_gst_rate    numeric(8, 4);
BEGIN
  SELECT b.supplier_id
  INTO v_supplier_id
  FROM public.bills b
  WHERE b.id = NEW.bill_id;

  IF v_supplier_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pr.*
  INTO v_rule
  FROM public.pricing_rules pr
  WHERE pr.supplier_id = v_supplier_id
  LIMIT 1;

  IF NOT FOUND THEN
    v_ma_price := NEW.rate;
    v_dna_price := NEW.rate;
    v_gst_rate := 5;
  ELSE
    v_ma_price := NEW.rate
                  * (1 + COALESCE(v_rule.ma_markup1_pct, 0) / 100)
                  * (1 + COALESCE(v_rule.ma_markup2_pct, 0) / 100);
    v_dna_price := NEW.rate
                   * (1 + COALESCE(v_rule.dna_markup1_pct, 0) / 100)
                   * (1 + COALESCE(v_rule.dna_markup2_pct, 0) / 100);
    v_gst_rate := COALESCE(v_rule.gst_pct, 5);
  END IF;

  v_ma_price  := round(v_ma_price, 2);
  v_dna_price := round(v_dna_price, 2);
  v_taxable := v_ma_price * COALESCE(NEW.qty, 1);
  v_gst_amount := v_taxable * (v_gst_rate / 100);

  NEW.ma_price   := v_ma_price;
  NEW.dna_price  := v_dna_price;
  NEW.unit_price := v_ma_price;
  NEW.taxable    := round(v_taxable, 2);
  NEW.cgst       := round(v_gst_amount / 2, 2);
  NEW.sgst       := round(v_gst_amount / 2, 2);
  NEW.igst       := 0;
  NEW.total      := round(v_taxable + v_gst_amount, 2);

  RETURN NEW;
END;
$$;

-- 5. Recompute MA/DNA for existing bill_items (the trigger above only fires on
--    INSERT). UPDATE pricing_rules-driven prices using the rule that exists at
--    migration time; rows with no rule are left at 0.
UPDATE public.bill_items bi
SET
  ma_price = round(
    bi.rate
    * (1 + COALESCE(pr.ma_markup1_pct, 0) / 100)
    * (1 + COALESCE(pr.ma_markup2_pct, 0) / 100),
    2
  ),
  dna_price = round(
    bi.rate
    * (1 + COALESCE(pr.dna_markup1_pct, 0) / 100)
    * (1 + COALESCE(pr.dna_markup2_pct, 0) / 100),
    2
  )
FROM public.bills b
JOIN public.pricing_rules pr ON pr.supplier_id = b.supplier_id
WHERE bi.bill_id = b.id;

-- 6. Extend provision_supplier_user to capture supplier code + per-supplier
--    MA/DNA markups at invite time. Drop the legacy signature first so the
--    server-side admin action picks up the new one cleanly.
DROP FUNCTION IF EXISTS public.provision_supplier_user(text, uuid, text, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.provision_supplier_user(
  email text,
  p_tenant_id uuid,
  p_code_prefix text DEFAULT NULL,
  p_code_number text DEFAULT NULL,
  p_ma_markup1_pct numeric DEFAULT 0,
  p_ma_markup2_pct numeric DEFAULT 0,
  p_dna_markup1_pct numeric DEFAULT 0,
  p_dna_markup2_pct numeric DEFAULT 0,
  p_gst_pct numeric DEFAULT 5
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

  INSERT INTO public.suppliers (
    tenant_id, name, email, code_prefix, code_number, active
  )
  VALUES (
    p_tenant_id,
    v_name,
    lower(trim(email)),
    NULLIF(trim(COALESCE(p_code_prefix, '')), ''),
    NULLIF(trim(COALESCE(p_code_number, '')), ''),
    true
  )
  RETURNING id INTO v_supplier_id;

  INSERT INTO public.pricing_rules (
    tenant_id, supplier_id, model,
    ma_markup1_pct, ma_markup2_pct,
    dna_markup1_pct, dna_markup2_pct,
    gst_pct
  )
  VALUES (
    p_tenant_id,
    v_supplier_id,
    'standard',
    GREATEST(0, COALESCE(p_ma_markup1_pct, 0)),
    GREATEST(0, COALESCE(p_ma_markup2_pct, 0)),
    GREATEST(0, COALESCE(p_dna_markup1_pct, 0)),
    GREATEST(0, COALESCE(p_dna_markup2_pct, 0)),
    GREATEST(0, COALESCE(p_gst_pct, 5))
  )
  RETURNING id INTO v_rule_id;

  UPDATE public.suppliers
  SET pricing_rule_id = v_rule_id
  WHERE id = v_supplier_id;

  RETURN v_supplier_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_supplier_user(
  text, uuid, text, text, numeric, numeric, numeric, numeric, numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_supplier_user(
  text, uuid, text, text, numeric, numeric, numeric, numeric, numeric
) TO service_role;
