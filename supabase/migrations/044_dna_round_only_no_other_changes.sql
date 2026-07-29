-- 044_dna_round_only_no_other_changes.sql
--
-- Confirm compute_bill_item_pricing matches migration 036 except DNA rounding.
-- Re-apply DNA prices ONLY — do not touch ma_price, unit_price, taxable,
-- cgst, sgst, igst, or total.

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
    -- MA: unchanged (calculator-MU)
    v_ma_divisor1 := 1 - COALESCE(v_rule.ma_markup1_pct, 0) / 100.0;
    v_ma_divisor2 := 1 - COALESCE(v_rule.ma_markup2_pct, 0) / 100.0;
    IF v_ma_divisor1 > 0 AND v_ma_divisor2 > 0 THEN
      v_ma_price := NEW.rate / v_ma_divisor1 / v_ma_divisor2;
    ELSE
      v_ma_price := NEW.rate;
    END IF;

    -- DNA hybrid: unchanged (simple markup then calculator-MU)
    v_dna_price := NEW.rate * (1 + COALESCE(v_rule.dna_markup1_pct, 0) / 100);
    v_dna_divisor := 1 - COALESCE(v_rule.dna_markup2_pct, 0) / 100.0;
    IF v_dna_divisor > 0 THEN
      v_dna_price := v_dna_price / v_dna_divisor;
    END IF;

    v_gst_rate := COALESCE(v_rule.gst_pct, 5);
  END IF;

  -- MA: unchanged (floor decimals)
  v_ma_price  := floor(v_ma_price);
  -- DNA ONLY change: rem 0/1/2 → down; rem 3/4 → up (was floor-then-ceil)
  v_dna_price := floor((floor(v_dna_price) + 2) / 5.0) * 5;

  v_taxable := v_ma_price * COALESCE(NEW.qty, 1);
  v_gst_amount := v_taxable * (v_gst_rate / 100);

  NEW.ma_price   := v_ma_price;
  NEW.dna_price  := v_dna_price;
  NEW.unit_price := v_ma_price;
  NEW.taxable    := round(v_taxable, 2);
  NEW.cgst       := round(v_gst_amount / 2, 2);
  NEW.sgst       := round(v_gst_amount / 2, 2);
  NEW.igst       := 0;
  -- Totals unchanged: purchase rate × qty
  NEW.total      := round(NEW.rate * COALESCE(NEW.qty, 1), 2);

  RETURN NEW;
END;
$$;

-- Update DNA sticker prices only; leave MA / tax / totals as stored.
DO $$
DECLARE
  r RECORD;
  v_dna numeric;
  v_dna_step1 numeric;
  v_dna_div numeric;
BEGIN
  FOR r IN
    SELECT bi.id, bi.rate, pr.dna_markup1_pct, pr.dna_markup2_pct
    FROM public.bill_items bi
    JOIN public.bills b ON b.id = bi.bill_id
    LEFT JOIN public.pricing_rules pr ON pr.supplier_id = b.supplier_id
  LOOP
    v_dna_step1 := r.rate * (1 + COALESCE(r.dna_markup1_pct, 0) / 100);
    v_dna_div := 1 - COALESCE(r.dna_markup2_pct, 0) / 100.0;
    IF v_dna_div > 0 THEN
      v_dna := v_dna_step1 / v_dna_div;
    ELSE
      v_dna := v_dna_step1;
    END IF;
    v_dna := floor((floor(v_dna) + 2) / 5.0) * 5;

    UPDATE public.bill_items
      SET dna_price = v_dna
      WHERE id = r.id
        AND dna_price IS DISTINCT FROM v_dna;
  END LOOP;
END $$;
