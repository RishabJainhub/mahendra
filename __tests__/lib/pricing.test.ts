import {
  calculateLine,
  calculateCompany151Line,
  formatINR,
  type PricingRule,
} from '@/lib/pricing';

describe('pricing', () => {
  const zeroRule: PricingRule = { model: 'standard', margin_pct: 0, markup_pct: 0, gst_pct: 0 };

  it('zero margin/markup/GST', () => {
    const result = calculateLine({ rate: 100, qty: 2 }, zeroRule);
    expect(result.taxable).toBe(200);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(0);
    expect(result.total).toBe(200);
  });

  it('margin percent', () => {
    const rule: PricingRule = { model: 'standard', margin_pct: 10, markup_pct: 0, gst_pct: 0 };
    const result = calculateLine({ rate: 100, qty: 1 }, rule);
    expect(result.unit_price).toBeCloseTo(110);
    expect(result.taxable).toBeCloseTo(110);
  });

  it('markup percent', () => {
    const rule: PricingRule = { model: 'standard', margin_pct: 0, markup_pct: 20, gst_pct: 0 };
    const result = calculateLine({ rate: 100, qty: 1 }, rule);
    expect(result.unit_price).toBeCloseTo(120);
  });

  it('GST on taxable', () => {
    const rule: PricingRule = { model: 'standard', margin_pct: 0, markup_pct: 0, gst_pct: 12 };
    const result = calculateLine({ rate: 100, qty: 1 }, rule);
    expect(result.cgst + result.sgst).toBeCloseTo(12);
    expect(result.total).toBeCloseTo(112);
  });

  it('CGST/SGST split for intrastate', () => {
    const rule: PricingRule = { model: 'standard', margin_pct: 0, markup_pct: 0, gst_pct: 18 };
    const result = calculateLine({ rate: 100, qty: 1, is_interstate: false }, rule);
    expect(result.cgst).toBeCloseTo(9);
    expect(result.sgst).toBeCloseTo(9);
    expect(result.igst).toBe(0);
  });

  it('IGST for interstate', () => {
    const rule: PricingRule = { model: 'standard', margin_pct: 0, markup_pct: 0, gst_pct: 18 };
    const result = calculateLine({ rate: 100, qty: 1, is_interstate: true }, rule);
    expect(result.igst).toBeCloseTo(18);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
  });

  it('floating point accuracy for company151', () => {
    expect(calculateCompany151Line(100)).toBeCloseTo(125);
    const rule: PricingRule = { model: 'company151', margin_pct: 0, markup_pct: 0, gst_pct: 0 };
    const result = calculateLine({ rate: 80, qty: 3 }, rule);
    expect(result.unit_price).toBeCloseTo(100);
    expect(result.taxable).toBeCloseTo(300);
    expect(formatINR(1234.5)).toMatch(/1,234\.50/);
  });
});
