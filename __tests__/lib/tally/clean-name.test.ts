import { cleanItemNameForLabel } from '@/lib/tally/clean-name';

describe('cleanItemNameForLabel', () => {
  it('keeps only the item name before company code + DNA label', () => {
    expect(cleanItemNameForLabel('S/N1102 63 DNA1605B')).toBe('S/N1102');
    expect(cleanItemNameForLabel('ASHRAY 149 DNA1600B18,200.00PCS1,300.00')).toBe('ASHRAY');
    expect(cleanItemNameForLabel('PUSHKAR 151 DNA2640B14,731.202,455.20')).toBe('PUSHKAR');
  });

  it('preserves hyphens and slashes in the item name', () => {
    expect(cleanItemNameForLabel('DHURANDHAR-2 149 DNA1540B')).toBe('DHURANDHAR-2');
    expect(cleanItemNameForLabel('S/N1102 63 DNA1605B')).toBe('S/N1102');
  });

  it('handles MA labels and PDF extraction artifacts (D/NA)', () => {
    expect(cleanItemNameForLabel('SMART GIRL 215 D/NA1375B')).toBe('SMART GIRL');
    expect(cleanItemNameForLabel('ITEM 100 MA1827B')).toBe('ITEM');
  });

  it('strips leading sl-no digits glued to the name', () => {
    expect(cleanItemNameForLabel('2SIVAKASI LACE 228 DNA1960B')).toBe('SIVAKASI LACE');
  });

  it('leaves names without DNA/MA sticker labels unchanged (except amount tails)', () => {
    expect(cleanItemNameForLabel('540710 HSN 5% SAREES')).toBe('540710 HSN 5% SAREES');
    expect(cleanItemNameForLabel('SIDDHARTH SILK')).toBe('SIDDHARTH SILK');
    expect(cleanItemNameForLabel('RJ 540741')).toBe('RJ 540741');
  });

  it('handles empty and whitespace input', () => {
    expect(cleanItemNameForLabel('')).toBe('');
    expect(cleanItemNameForLabel('   ')).toBe('');
  });
});
