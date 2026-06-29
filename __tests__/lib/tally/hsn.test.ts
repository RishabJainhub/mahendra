import { extractHsnFromDescription, stripHsnFromDescription } from '@/lib/tally/hsn';

describe('extractHsnFromDescription', () => {
  it('extracts HSN from "HSN" keyword', () => {
    expect(extractHsnFromDescription('540710 HSN 5% SAREES')).toBe('540710');
    expect(extractHsnFromDescription('HSN 540710 Cotton')).toBe('540710');
    expect(extractHsnFromDescription('HSN:540710 Saree')).toBe('540710');
    expect(extractHsnFromDescription('HSN#540710')).toBe('540710');
  });

  it('extracts leading 6-8 digit number, optionally after a short alpha token', () => {
    expect(extractHsnFromDescription('RJ 540741')).toBe('540741');
    expect(extractHsnFromDescription('540752 SAREES')).toBe('540752');
    expect(extractHsnFromDescription('6204 WOMENS DRESS')).toBe('6204');
  });

  it('extracts HSN with known textile prefix from anywhere in the string', () => {
    expect(extractHsnFromDescription('SAREES 540710')).toBe('540710');
    expect(extractHsnFromDescription('COTTON FABRIC 520811')).toBe('520811');
  });

  it('returns undefined when no plausible HSN is present', () => {
    expect(extractHsnFromDescription('SIDDHARTH SILK')).toBeUndefined();
    expect(extractHsnFromDescription('SHRIVALLI SILK')).toBeUndefined();
    expect(extractHsnFromDescription('KUNTHU LINEN SELF')).toBeUndefined();
  });

  it('handles empty/null input', () => {
    expect(extractHsnFromDescription('')).toBeUndefined();
    expect(extractHsnFromDescription(null)).toBeUndefined();
    expect(extractHsnFromDescription(undefined)).toBeUndefined();
  });
});

describe('stripHsnFromDescription', () => {
  it('removes the HSN token and "HSN" keyword', () => {
    expect(stripHsnFromDescription('540710 HSN 5% SAREES', '540710')).toBe('5% SAREES');
    expect(stripHsnFromDescription('RJ 540741', '540741')).toBe('RJ');
  });
});
