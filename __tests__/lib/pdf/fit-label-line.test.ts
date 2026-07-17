import { fitLabelDescriptionLine, ROLL_LINE1_FIT } from '@/lib/pdf/fit-label-line';

describe('fitLabelDescriptionLine', () => {
  it('keeps full short text at max font size', () => {
    const result = fitLabelDescriptionLine('S/N1102', ROLL_LINE1_FIT);
    expect(result.text).toBe('S/N1102');
    expect(result.fontSize).toBe(14);
  });

  it('does not truncate long names with ellipsis', () => {
    const long = 'GAJJI AJRAK PATTA DNX';
    const result = fitLabelDescriptionLine(long, ROLL_LINE1_FIT);
    expect(result.text).toBe(long);
    expect(result.text).not.toContain('…');
    expect(result.fontSize).toBeLessThan(14);
    expect(result.fontSize).toBeGreaterThanOrEqual(ROLL_LINE1_FIT.minFontSize);
  });

  it('shrinks further for very long names but still shows all characters', () => {
    const veryLong = 'NEW AJRAK GALLA CHOKDA DNX EXTRA LONG NAME';
    const result = fitLabelDescriptionLine(veryLong, ROLL_LINE1_FIT);
    expect(result.text).toBe(veryLong);
    expect(result.fontSize).toBeLessThan(ROLL_LINE1_FIT.maxFontSize);
    expect(result.fontSize).toBeGreaterThanOrEqual(ROLL_LINE1_FIT.minFontSize);
  });

  it('normalizes whitespace', () => {
    const result = fitLabelDescriptionLine('  SMART   GIRL  ', ROLL_LINE1_FIT);
    expect(result.text).toBe('SMART GIRL');
  });
});
