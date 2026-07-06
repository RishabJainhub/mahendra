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

  // Mirrors Sales_1885_26-27.pdf extracted text — a column-stacked Tally
  // invoice where description / disc / rate / qty / GST / HSN each land on
  // their own line.
  const STACKED_TALLY_TEXT = `
TAX INVOICE
MAHENDRA DISTRIBUTORS
GSTIN/UIN: 29ABUFM2400R1ZJ
Buyer (Bill to)
LOOK & LIKE -MADANAPALLE
Invoice No.
1885/26-27
Dated
24-Jun-26
Sl
Description of GoodsAmount
Nett.
Disc. %RateQuantityGSTHSN
No.RateRate
1
PUSHKAR 151 DNA2640B14,731.202,455.20
7 %2,640.00
6 PCS
5 %540752
2SIVAKASI LACE 228
DNA1960B
9,114.001,822.80
7 %1,960.00
5 PCS
5 %630790
3
TARINIKA.C 147 DNA1960B9,114.001,822.80
7 %1,960.00
5 PCS
5 %540710
60,636.00
IGST
3,031.80
ROUND OFF
0.20
TotalRs 63,668.00
30 PCS
`;

  it('parses column-stacked Tally invoice (Sales_1885 layout)', () => {
    const result = parseTallyPdfText(STACKED_TALLY_TEXT);
    expect(result.bill.number).toBe('1885/26-27');
    expect(result.bill.date).toBe('2026-06-24');
    expect(result.bill.party).toContain('LOOK & LIKE');
    expect(result.bill.totals.amount).toBe(63668);

    expect(result.items).toHaveLength(3);

    expect(result.items[0].name).toBe('PUSHKAR');
    expect(result.items[0].qty).toBe(6);
    expect(result.items[0].rate).toBe(2640);
    expect(result.items[0].hsn).toBe('540752');

    // Sl number glued to the description ("2SIVAKASI…") is stripped, and
    // the supplier's "DNA1960B" sticker label + company code are removed.
    expect(result.items[1].name).toBe('SIVAKASI LACE');
    expect(result.items[1].qty).toBe(5);
    expect(result.items[1].rate).toBe(1960);
    expect(result.items[1].hsn).toBe('630790');

    expect(result.items[2].name).toBe('TARINIKA.C');
    expect(result.items[2].qty).toBe(5);
    expect(result.items[2].rate).toBe(1960);
    expect(result.items[2].hsn).toBe('540710');
  });

  // Mirrors Sales_1932_26-27.pdf — same stacked layout but the "Invoice No."
  // label shares a line with "e-Way Bill No.", which the strict label regex
  // must still match.
  const STACKED_1932_TEXT = `
TAX INVOICE(ORIGINAL FOR RECIPIENT)
MAHENDRA DISTRIBUTORS
GSTIN/UIN: 29ABUFM2400R1ZJ
Buyer (Bill to)
M P SILKS   KGF
Invoice No.e-Way Bill No.
1932/26-27
Dated
26-Jun-26
Sl
Description of GoodsAmount
Nett.
Disc. %RateQuantityGSTHSN
No.RateRate
1
RJ 54074144,919.00998.20
8 %1,085.00
45 PCS
5 %540741
2
SIDDHARTH SILK17,112.00855.60
8 %930.00
20 PCS
5 %540710
3
540710 HSN 5% SAREES13,579.201,697.40
8 %1,845.00
8 PCS
5 %540710
4
SHRIVALLI  SILK10,465.001,495.00
8 %1,625.00
7 PCS
5 %540710
5
KUNTHU LINEN SELF10,626.00966.00
8 %1,050.00
11 PCS
5 %540754
6
SOUTH COTTON SELF22,972.401,044.20
8 %1,135.00
22 PCS
5 %540710
1,19,673.60
CGST
2,991.85
SGST
2,991.85
ROUND OFF
(-)0.30
TotalRs 1,25,657.00
113 PCS
`;

  it('parses Sales_1932 layout with shared "Invoice No.e-Way Bill No." label', () => {
    const result = parseTallyPdfText(STACKED_1932_TEXT);
    expect(result.bill.number).toBe('1932/26-27');
    expect(result.bill.date).toBe('2026-06-26');
    expect(result.bill.party).toContain('M P SILKS');
    expect(result.items).toHaveLength(6);

    expect(result.items[0].name).toBe('RJ 540741');
    expect(result.items[0].qty).toBe(45);
    expect(result.items[0].rate).toBe(1085);
    expect(result.items[0].hsn).toBe('540741');

    expect(result.items[1].name).toBe('SIDDHARTH SILK');
    expect(result.items[1].qty).toBe(20);
    expect(result.items[1].rate).toBe(930);
    expect(result.items[1].hsn).toBe('540710');

    expect(result.items[2].name).toBe('540710 HSN 5% SAREES');
    expect(result.items[2].hsn).toBe('540710');

    expect(result.items[3].name).toBe('SHRIVALLI SILK');
    expect(result.items[3].hsn).toBe('540710');

    expect(result.items[4].name).toBe('KUNTHU LINEN SELF');
    expect(result.items[4].hsn).toBe('540754');

    expect(result.items[5].name).toBe('SOUTH COTTON SELF');
    expect(result.items[5].hsn).toBe('540710');
  });
});
