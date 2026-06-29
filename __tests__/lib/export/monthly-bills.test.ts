import { monthBounds } from '@/lib/export/monthly-bills';

describe('monthBounds', () => {
  it('returns valid ISO date range for a month', () => {
    expect(monthBounds('2026-06')).toEqual({
      start: '2026-06-01',
      end: '2026-06-30',
      label: '2026-06',
    });
  });

  it('handles February in a leap year', () => {
    expect(monthBounds('2024-02')).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
      label: '2024-02',
    });
  });
});
