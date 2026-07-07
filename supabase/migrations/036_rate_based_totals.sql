-- 036_rate_based_totals.sql
--
-- Line-item TOTAL and bill SUBTOTAL use the original purchase rate (rate × qty),
-- not MA/DNA pricing with GST. MA/DNA columns and taxable/cgst/sgst remain for
-- sticker/label and tax reporting.

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
  v_ma_divisor1 numeric;
  v_ma_divisor2 numeric;
  v_dna_divisor numeric;
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
    -- MA: calculator-MU (margin) formula
    v_ma_divisor1 := 1 - COALESCE(v_rule.ma_markup1_pct, 0) / 100.0;
    v_ma_divisor2 := 1 - COALESCE(v_rule.ma_markup2_pct, 0) / 100.0;
    IF v_ma_divisor1 > 0 AND v_ma_divisor2 > 0 THEN
      v_ma_price := NEW.rate / v_ma_divisor1 / v_ma_divisor2;
    ELSE
      v_ma_price := NEW.rate;
    END IF;

    -- DNA: hybrid — simple markup then calculator-MU
    v_dna_price := NEW.rate * (1 + COALESCE(v_rule.dna_markup1_pct, 0) / 100);
    v_dna_divisor := 1 - COALESCE(v_rule.dna_markup2_pct, 0) / 100.0;
    IF v_dna_divisor > 0 THEN
      v_dna_price := v_dna_price / v_dna_divisor;
    END IF;

    v_gst_rate := COALESCE(v_rule.gst_pct, 5);
  END IF;

  -- MA: drop the decimal portion without rounding.
  v_ma_price  := floor(v_ma_price);
  -- DNA: floor-then-ceil to nearest 5. 2070.34 → 2070, 2051 → 2055.
  v_dna_price := ceil(floor(v_dna_price) / 5.0) * 5;

  v_taxable := v_ma_price * COALESCE(NEW.qty, 1);
  v_gst_amount := v_taxable * (v_gst_rate / 100);

  NEW.ma_price   := v_ma_price;
  NEW.dna_price  := v_dna_price;
  NEW.unit_price := v_ma_price;
  NEW.taxable    := round(v_taxable, 2);
  NEW.cgst       := round(v_gst_amount / 2, 2);
  NEW.sgst       := round(v_gst_amount / 2, 2);
  NEW.igst       := 0;
  NEW.total      := round(NEW.rate * COALESCE(NEW.qty, 1), 2);

  RETURN NEW;
END;
$$;

-- Backfill: set line totals from rate × qty for all existing bill_items.
UPDATE public.bill_items
SET total = round(rate * COALESCE(qty, 1), 2);

-- Refresh bills.total_amount from rate-based line totals.
UPDATE public.bills b
SET total_amount = COALESCE((
  SELECT round(sum(bi.total), 2)
  FROM public.bill_items bi
  WHERE bi.bill_id = b.id
), 0)
WHERE EXISTS (SELECT 1 FROM public.bill_items bi WHERE bi.bill_id = b.id);
