import { parseTallyPdfText } from '@/lib/tally/pdf-parser';

const SAMPLE_TALLY_PDF_TEXT = `
Mahendra Saree House
Tax Invoice

Invoice No. : INV-2025-042
Dated       : 15-Apr-2025
Party       : Company 151 Traders

Sl  Description              Qty      Rate      Amount
1   Banarasi Silk Saree      2 PCS    2500.00   5000.00
2   Cotton Saree Plain       5 Nos    800.00    4000.00

                          Grand Total : 9,000.00
`;

describe('pdf-parser', () => {
  it('parses Tally-style invoice text from PDF', () => {
    const result = parseTallyPdfText(SAMPLE_TALLY_PDF_TEXT);
    expect(result.bill.number).toBe('INV-2025-042');
    expect(result.bill.party).toContain('Company 151');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toContain('Banarasi');
    expect(result.items[0].qty).toBe(2);
    expect(result.items[0].rate).toBe(2500);
    expect(result.bill.totals.amount).toBe(9000);
  });

  it('throws when no line items found', () => {
    expect(() => parseTallyPdfText('Invoice No: 1\nDated: 1-Apr-25')).toThrow(
      'Could not find line items'
    );
  });

  it('throws on empty text', () => {
    expect(() => parseTallyPdfText('')).toThrow('no readable text');
  });
});
