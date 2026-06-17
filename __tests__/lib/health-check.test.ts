import {
  runPricingFormulaChecks,
  runImportParserChecks,
  runBarcodeChecks,
  runAllHealthChecks,
} from '@/lib/health-check';

describe('health-check', () => {
  it('all pricing formula checks pass', () => {
    const results = runPricingFormulaChecks();
    expect(results.every((r) => r.pass)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(4);
  });

  it('import parser checks pass (XML + PDF)', () => {
    const results = runImportParserChecks();
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it('barcode checks produce real PNG output', async () => {
    const results = await runBarcodeChecks();
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it('full health check suite passes', async () => {
    const { allPass, fail } = await runAllHealthChecks();
    expect(fail).toBe(0);
    expect(allPass).toBe(true);
  });
});
