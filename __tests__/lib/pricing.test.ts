import {
  applyConsecutiveMarkups,
  applyConsecutiveMU,
  applyMarkupThenMU,
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

  it('calcMA chains both MA markups via calculator-MU (margin) and truncates the decimal', () => {
    // MU28 + MU5 on 1250: 1250 / 0.72 / 0.95 = 1827.49 → trunc 1827
    expect(calcMA(1250, rule)).toBe(1827);
    // 4000 / 0.72 / 0.95 = 5847.95 → trunc 5847
    expect(calcMA(4000, rule)).toBe(5847);
    // 1085 / 0.72 / 0.95 = 1586.04 → trunc 1586
    expect(calcMA(1085, rule)).toBe(1586);
    expect(calcMA(1525.44, { ...rule, ma_markup1_pct: 0, ma_markup2_pct: 0 })).toBe(1525);
    // 1000 / 0.72 / 0.95 = 1461.99 → trunc 1461
    expect(calcMA(1000, rule)).toBe(1461);
  });

  it('calcDNA: rate × 1.20 then MU5% (hybrid), round up to nearest 5', () => {
    // 1250 × 1.20 = 1500 → 1500 / 0.95 = 1578.95 → round up to 5 = 1580
    expect(calcDNA(1250, rule)).toBe(1580);
    // 1600 × 1.20 = 1920 → 1920 / 0.95 = 2021.05 → round up to 5 = 2025
    expect(calcDNA(1600, rule)).toBe(2025);
    // 4000 × 1.20 = 4800 → 4800 / 0.95 = 5052.63 → round up to 5 = 5055
    expect(calcDNA(4000, rule)).toBe(5055);
    // 1000 × 1.20 = 1200 → 1200 / 0.95 = 1263.16 → round up to 5 = 1265
    expect(calcDNA(1000, rule)).toBe(1265);
  });

  it('roundUpToNearest always rounds up to the next multiple of 5', () => {
    expect(roundUpToNearest(2051, 5)).toBe(2055);
    expect(roundUpToNearest(2054, 5)).toBe(2055);
    expect(roundUpToNearest(2056, 5)).toBe(2060);
    expect(roundUpToNearest(2059, 5)).toBe(2060);
    expect(roundUpToNearest(2050, 5)).toBe(2050);
    expect(roundUpToNearest(1263, 5)).toBe(1265);
    expect(roundUpToNearest(1265, 5)).toBe(1265);
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
    // 1000 × 1.10 = 1100 → 1100 / 1.0 = 1100 → round up to 5 = 1100
    expect(calcDNA(1000, dnaOnly)).toBe(1100);
  });

  it('applyConsecutiveMU uses the margin formula (rate / (1 - m/100))', () => {
    // 1000 MU 28 = 1000 / 0.72 = 1388.89
    expect(applyConsecutiveMU(1000, 28, 0)).toBeCloseTo(1388.89);
    // 1000 MU 28 MU 5 = 1000 / 0.72 / 0.95 = 1461.99
    expect(applyConsecutiveMU(1000, 28, 5)).toBeCloseTo(1461.99);
    expect(applyConsecutiveMU(1000, 0, 0)).toBe(1000);
  });

  it('applyMarkupThenMU: simple markup then calculator MU', () => {
    // 1600 × 1.22 = 1952 → 1952 / 0.95 = 2054.74
    expect(applyMarkupThenMU(1600, 22, 5)).toBeCloseTo(2054.74);
    // 1000 × 1.10 = 1100 → 1100 / 0.95 = 1157.89
    expect(applyMarkupThenMU(1000, 10, 5)).toBeCloseTo(1157.89);
    expect(applyMarkupThenMU(1000, 0, 0)).toBe(1000);
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
