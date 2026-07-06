import { readFileSync } from 'fs';
import path from 'path';
import { parseTallyPdf, parseTallyPdfText } from '@/lib/tally/pdf-parser';
import { extractPdfText } from '@/lib/tally/pdf-extract';

const FIXTURE_PDF = path.join(__dirname, '../../fixtures/Sales_1885_26-27.pdf');

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

  it('extracts text from a real Tally PDF buffer (unpdf + fallback)', async () => {
    const buffer = readFileSync(FIXTURE_PDF);
    const text = await extractPdfText(buffer);
    expect(text.length).toBeGreaterThan(100);
    expect(text).toMatch(/Invoice\s*No/i);
  });

  it('parses a real Tally PDF end-to-end', async () => {
    const buffer = readFileSync(FIXTURE_PDF);
    const result = await parseTallyPdf(buffer);
    expect(result.bill.number).toBe('1885/26-27');
    expect(result.items.length).toBeGreaterThanOrEqual(3);
    expect(result.items[0].name).toBe('PUSHKAR');
  });

  // Mirrors Purchase_66.pdf — compressed inline layout where PDF text extraction
  // collapses each item onto one line (common for purchase invoices).
  const INLINE_PURCHASE_66_TEXT = `
INVOICE (Duplicate) MAHENDRA DISTRIBUTORS
Supplier (Bill from) MARUTI CREATION 4002-4003,4TH FLOOR
Invoice No. 66 Supplier Invoice No. & Date. 66 dt. 12-Jun-26
Dated 12-Jun-26
Sl Description of Goods AmountDisc. %perRateQuantityGSTHSN/SAC No. Rate
1 ASHRAY 149 DNA1600B 18,200.00PCS1,300.0014 PCS5 %540710
2 AASMAN 149 DNA1305B 12,720.00PCS1,060.0012 PCS5 %540710
5 DHURANDHAR-2 149 DNA1540B 25,000.00PCS1,250.0020 PCS5 %540710
96,925.00 continued ... INVOICE(Page 2)
Total Rs 1,01,771.0083 PCS
`;

  it('parses compressed inline purchase invoice (Purchase_66 layout)', () => {
    const result = parseTallyPdfText(INLINE_PURCHASE_66_TEXT);
    expect(result.bill.number).toBe('66');
    expect(result.bill.date).toBe('2026-06-12');
    expect(result.bill.party).toBe('MARUTI CREATION');
    expect(result.items).toHaveLength(3);
    expect(result.items[0].name).toBe('ASHRAY');
    expect(result.items[0].rate).toBe(1300);
    expect(result.items[0].qty).toBe(14);
    expect(result.items[2].name).toBe('DHURANDHAR-2');
    expect(result.items[2].rate).toBe(1250);
    expect(result.items[2].qty).toBe(20);
  });

  it('parses real Purchase_66 and Purchase_81 PDF buffers', async () => {
    const p66 = readFileSync(path.join(__dirname, '../../fixtures/Purchase_66.pdf'));
    const p81 = readFileSync(path.join(__dirname, '../../fixtures/Purchase_81.pdf'));

    const r66 = await parseTallyPdf(p66);
    expect(r66.bill.number).toBe('66');
    expect(r66.items).toHaveLength(6);
    expect(r66.items[0].name).toBe('ASHRAY');

    const r81 = await parseTallyPdf(p81);
    expect(r81.bill.number).toBe('81');
    expect(r81.bill.party).toBe('KOYAL DESIGNER');
    expect(r81.items).toHaveLength(1);
    expect(r81.items[0].name).toBe('HOT STAR');
    expect(r81.items[0].rate).toBe(1565);
  });
});
