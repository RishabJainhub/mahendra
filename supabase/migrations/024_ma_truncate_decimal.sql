-- MA price drops the decimal (truncate, not round): 1458.24 → 1458, 1458.99 → 1458.
-- DNA continues to round UP to the next multiple of 5 (migration 023).
--
-- Re-creates compute_bill_item_pricing() with floor() on MA and backfills
-- existing bill_items rows so old data matches.

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

  -- MA: drop the decimal portion without rounding.
  v_ma_price  := floor(v_ma_price);
  -- DNA: always round UP to the next multiple of 5.
  v_dna_price := ceil(v_dna_price / 5.0) * 5;

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

-- Backfill: drop decimals on existing MA prices (and the unit_price mirror).
-- Derived columns (taxable / cgst / sgst / total) are left as-is here; an
-- admin can refresh them on any bill via the "Recompute MA/DNA" action which
-- now uses the same floor logic.
UPDATE public.bill_items
SET
  ma_price = floor(ma_price),
  unit_price = floor(unit_price)
WHERE ma_price IS NOT NULL
  AND ma_price <> floor(ma_price);
