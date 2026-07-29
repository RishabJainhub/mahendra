-- 043_dna_round_threshold_2.sql
--
-- DNA rounding to nearest 5 with a 2-threshold:
--   drop decimals, then rem 0/1/2 → down, rem 3/4 → up.
--
--   2070 → 2070, 2071 → 2070, 2072 → 2070
--   2073 → 2075, 2074 → 2075, 2075 → 2075
--
-- Formula: floor((floor(v_dna_price) + 2) / 5.0) * 5

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
  -- DNA: rem 0/1/2 → down to multiple of 5; rem 3/4 → up.
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
  -- Line total stays purchase rate × qty (see migration 036).
  NEW.total      := round(NEW.rate * COALESCE(NEW.qty, 1), 2);

  RETURN NEW;
END;
$$;

-- Backfill DNA (and MA for consistency) on existing line items.
DO $$
DECLARE
  r RECORD;
  v_ma numeric;
  v_dna numeric;
  v_dna_step1 numeric;
  v_dna_div numeric;
  v_taxable numeric;
  v_gst numeric;
  v_div1 numeric;
  v_div2 numeric;
BEGIN
  FOR r IN
    SELECT bi.id, bi.rate, bi.qty, pr.ma_markup1_pct, pr.ma_markup2_pct,
           pr.dna_markup1_pct, pr.dna_markup2_pct, pr.gst_pct
    FROM public.bill_items bi
    JOIN public.bills b ON b.id = bi.bill_id
    LEFT JOIN public.pricing_rules pr ON pr.supplier_id = b.supplier_id
  LOOP
    v_div1 := 1 - COALESCE(r.ma_markup1_pct, 0) / 100.0;
    v_div2 := 1 - COALESCE(r.ma_markup2_pct, 0) / 100.0;
    IF v_div1 > 0 AND v_div2 > 0 THEN
      v_ma := floor(r.rate / v_div1 / v_div2);
    ELSE
      v_ma := floor(r.rate);
    END IF;

    v_dna_step1 := r.rate * (1 + COALESCE(r.dna_markup1_pct, 0) / 100);
    v_dna_div := 1 - COALESCE(r.dna_markup2_pct, 0) / 100.0;
    IF v_dna_div > 0 THEN
      v_dna := v_dna_step1 / v_dna_div;
    ELSE
      v_dna := v_dna_step1;
    END IF;
    v_dna := floor((floor(v_dna) + 2) / 5.0) * 5;

    v_taxable := v_ma * COALESCE(r.qty, 1);
    v_gst := v_taxable * (COALESCE(r.gst_pct, 5) / 100.0);

    UPDATE public.bill_items
      SET ma_price   = v_ma,
          dna_price  = v_dna,
          unit_price = v_ma,
          taxable    = round(v_taxable, 2),
          cgst       = round(v_gst / 2, 2),
          sgst       = round(v_gst / 2, 2),
          igst       = 0,
          total      = round(r.rate * COALESCE(r.qty, 1), 2)
      WHERE id = r.id;
  END LOOP;
END $$;
