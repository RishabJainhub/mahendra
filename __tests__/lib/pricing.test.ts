import {
  applyConsecutiveMarkups,
  calcMA,
  calcDNA,
  formatINR,
  formatLabelPrice,
  formatSupplierCode,
  describeFormula,
  roundUpToNearest,
  type PricingRule,
} from '@/lib/pricing';

describe('pricing', () => {
  const rule: PricingRule = {
    ma_markup1_pct: 28,
    ma_markup2_pct: 5,
    dna_markup1_pct: 20,
    dna_markup2_pct: 5,
    gst_pct: 5,
  };

  it('applies a single chain of consecutive markups', () => {
    expect(applyConsecutiveMarkups(1000, 20, 10)).toBeCloseTo(1320);
    expect(applyConsecutiveMarkups(500, 0, 0)).toBe(500);
  });

  it('calcMA chains both MA markups on the rate and truncates the decimal', () => {
    expect(calcMA(4000, rule)).toBe(5376);
    expect(calcMA(1085, rule)).toBe(1458);
    expect(calcMA(1525.44, { ...rule, ma_markup1_pct: 0, ma_markup2_pct: 0 })).toBe(1525);
    expect(calcMA(1000, rule)).toBe(1344);
  });

  it('calcDNA chains both DNA markups on the rate and rounds up to the next multiple of 5', () => {
    expect(calcDNA(4000, rule)).toBe(5040);
    expect(calcDNA(1085, rule)).toBe(1370);
    expect(calcDNA(1000, rule)).toBe(1260);
  });

  it('roundUpToNearest never rounds down', () => {
    expect(roundUpToNearest(1263, 5)).toBe(1265);
    expect(roundUpToNearest(1267, 5)).toBe(1270);
    expect(roundUpToNearest(1265, 5)).toBe(1265);
    expect(roundUpToNearest(1265 + 1e-10, 5)).toBe(1265);
    expect(roundUpToNearest(1265.01, 5)).toBe(1270);
    expect(roundUpToNearest(0, 5)).toBe(0);
  });

  it('MA and DNA are independent of each other', () => {
    const dnaOnly: PricingRule = {
      ma_markup1_pct: 0,
      ma_markup2_pct: 0,
      dna_markup1_pct: 10,
      dna_markup2_pct: 0,
      gst_pct: 5,
    };
    expect(calcMA(1000, dnaOnly)).toBe(1000);
    expect(calcDNA(1000, dnaOnly)).toBeCloseTo(1100);
  });

  it('formatLabelPrice drops trailing zeros and keeps integers integer', () => {
    expect(formatLabelPrice(5376)).toBe('5376');
    expect(formatLabelPrice(5376.5)).toBe('5376.5');
    expect(formatLabelPrice(5376.5)).not.toContain('.50');
    expect(formatLabelPrice(5376.05)).toBe('5376.05');
  });

  it('formatSupplierCode produces PREFIX(NUMBER)', () => {
    expect(formatSupplierCode('ARN', '540832')).toBe('ARN(540832)');
    expect(formatSupplierCode('', '540832')).toBe('540832');
    expect(formatSupplierCode('ARN', '')).toBe('ARN');
    expect(formatSupplierCode('', '')).toBe('');
    expect(formatSupplierCode(null, null)).toBe('');
  });

  it('describeFormula mentions MA, DNA and GST', () => {
    const summary = describeFormula(rule);
    expect(summary).toContain('MA');
    expect(summary).toContain('DNA');
    expect(summary).toContain('5%');
    expect(summary).toContain('MU28');
    expect(summary).toContain('MU5');
  });

  it('formatINR uses Indian locale', () => {
    expect(formatINR(1234.5)).toMatch(/1,234\.50/);
  });
});
