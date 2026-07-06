-- 031_ma_margin_formula.sql
---
-- Fix MA to use the calculator-MU (margin) formula instead of simple markup.
--
-- The user's MA formula is "MU28 MU5" — the MU button on a physical
-- calculator, which computes selling price from cost at a given margin:
--     price = cost / (1 - margin/100)
-- Two stacked markups:  rate / (1 - m1/100) / (1 - m2/100)
--
-- Example: rate 1250, MU28, MU5 → 1250 / 0.72 / 0.95 = 1827.49 → floor 1827.
-- The old formula (rate × 1.28 × 1.05 = 1680) was wrong.
--
-- DNA is unchanged (simple markup, round up to nearest 5).
-- taxable/total still include GST (used for accounting columns); the bill
-- header total_amount is now recomputed from line-item totals after insert
-- so it always matches the sticker math, never the parsed-PDF grand total.

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
    -- MA: calculator-MU (margin) formula: rate / (1 - m1/100) / (1 - m2/100)
    v_ma_divisor1 := 1 - COALESCE(v_rule.ma_markup1_pct, 0) / 100.0;
    v_ma_divisor2 := 1 - COALESCE(v_rule.ma_markup2_pct, 0) / 100.0;
    IF v_ma_divisor1 > 0 AND v_ma_divisor2 > 0 THEN
      v_ma_price := NEW.rate / v_ma_divisor1 / v_ma_divisor2;
    ELSE
      v_ma_price := NEW.rate;
    END IF;

    -- DNA: simple markup chain (unchanged).
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

-- Backfill existing bill_items with the corrected MA (margin) formula.
-- Recomputes ma_price, taxable, cgst, sgst, total from rate + supplier rule.
DO $$
DECLARE
  r RECORD;
  v_ma numeric;
  v_dna numeric;
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

    v_dna := r.rate
             * (1 + COALESCE(r.dna_markup1_pct, 0) / 100)
             * (1 + COALESCE(r.dna_markup2_pct, 0) / 100);
    v_dna := ceil(v_dna / 5.0) * 5;

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
          total      = round(v_taxable + v_gst, 2)
      WHERE id = r.id;
  END LOOP;
END $$;

-- Recompute bills.total_amount as the sum of line-item totals so the header
-- always matches the sticker math (was previously seeded from the parsed
-- Tally/PDF grand total, which could be wrong/negative for PDFs).
UPDATE public.bills b
SET total_amount = COALESCE((
  SELECT round(sum(bi.total), 2)
  FROM public.bill_items bi
  WHERE bi.bill_id = b.id
), 0)
WHERE EXISTS (SELECT 1 FROM public.bill_items bi WHERE bi.bill_id = b.id);
