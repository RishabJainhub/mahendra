import { calculateCompany151Line, formatINR } from '@/lib/pricing';

describe('pricing regression', () => {
  it('company151 multiplier', () => {
    expect(calculateCompany151Line(200)).toBe(250);
  });

  it('formatINR produces Indian locale', () => {
    expect(formatINR(1000)).toContain('1,000');
  });
});
