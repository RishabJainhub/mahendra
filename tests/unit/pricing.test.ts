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

  it('DNA: rate × 1.20 then MU5% (hybrid), round up to 5', () => {
    // 4000 × 1.20 = 4800 → 4800 / 0.95 = 5052.63 → round up to 5 = 5055
    expect(calcDNA(4000, rule)).toBe(5055);
  });

  it('formatLabelPrice keeps integer prices without ".00"', () => {
    expect(formatLabelPrice(5376)).toBe('5376');
  });

  it('formatINR produces Indian locale', () => {
    expect(formatINR(1000)).toContain('1,000');
  });
});
