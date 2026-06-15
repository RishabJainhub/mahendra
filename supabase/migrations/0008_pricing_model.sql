-- Pricing model refinements and trigger update
ALTER TABLE public.pricing_rules
  ALTER COLUMN model SET DEFAULT 'standard';

COMMENT ON COLUMN public.pricing_rules.model IS 'standard | company151 (rate * 1.25)';

CREATE OR REPLACE FUNCTION public.compute_bill_item_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_id uuid;
  v_rule        public.pricing_rules%ROWTYPE;
  v_unit_price  numeric(12, 2);
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
    v_unit_price := NEW.rate;
    v_gst_rate := 5;
  ELSIF v_rule.model = 'company151' THEN
    v_unit_price := round(NEW.rate * 1.25, 2);
    v_gst_rate := v_rule.gst_pct;
  ELSE
    v_unit_price := NEW.rate;
    IF v_rule.margin_pct > 0 THEN
      v_unit_price := v_unit_price * (1 + v_rule.margin_pct / 100);
    END IF;
    IF v_rule.markup_pct > 0 THEN
      v_unit_price := v_unit_price * (1 + v_rule.markup_pct / 100);
    END IF;
    v_gst_rate := v_rule.gst_pct;
  END IF;

  v_taxable := v_unit_price * COALESCE(NEW.qty, 1);
  v_gst_amount := v_taxable * (v_gst_rate / 100);

  NEW.unit_price := round(v_unit_price, 2);
  NEW.taxable := round(v_taxable, 2);
  NEW.cgst := round(v_gst_amount / 2, 2);
  NEW.sgst := round(v_gst_amount / 2, 2);
  NEW.igst := 0;
  NEW.total := round(v_taxable + v_gst_amount, 2);

  RETURN NEW;
END;
$$;
