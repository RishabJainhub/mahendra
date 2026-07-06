import { calcMA, calcDNA, formatINR, formatLabelPrice } from '@/lib/pricing';

describe('pricing regression', () => {
  const rule = {
    ma_markup1_pct: 28,
    ma_markup2_pct: 5,
    dna_markup1_pct: 20,
    dna_markup2_pct: 5,
    gst_pct: 5,
  };

  it('MA consecutive MU markups (MU28 then MU5) using margin formula', () => {
    // 4000 / 0.72 / 0.95 = 5847.95 → trunc 5847
    expect(calcMA(4000, rule)).toBe(5847);
  });

  it('DNA consecutive markups (20% then 5%)', () => {
    expect(calcDNA(4000, rule)).toBeCloseTo(5040);
  });

  it('formatLabelPrice keeps integer prices without ".00"', () => {
    expect(formatLabelPrice(5376)).toBe('5376');
  });

  it('formatINR produces Indian locale', () => {
    expect(formatINR(1000)).toContain('1,000');
  });
});
