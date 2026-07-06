import { parseTallyXml, isInterstate, isCidEncodedXml, decodeCidEncodedXml } from '@/lib/tally/xml-parser';

function toCidXml(text: string): string {
  const segments = Array.from(text)
    .map((ch) => `<segment>(cid:${ch.codePointAt(0) ?? 32})</segment>`)
    .join('');
  return `<?xml version='1.0' encoding='utf-8'?><root>${segments}</root>`;
}

const VALID_XML = `<?xml version="1.0"?>
<ENVELOPE>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <VOUCHER>
            <VOUCHERNUMBER>INV-001</VOUCHERNUMBER>
            <DATE>20250401</DATE>
            <PARTYNAME>Test Party</PARTYNAME>
            <STATENAME>Gujarat</STATENAME>
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>SAREE-001</STOCKITEMNAME>
              <ACTUALQTY>2 PCS</ACTUALQTY>
              <RATE>500</RATE>
              <AMOUNT>1000</AMOUNT>
              <HSNCODE>5208</HSNCODE>
            </ALLINVENTORYENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

const INTERSTATE_XML = VALID_XML.replace('<STATENAME>Gujarat</STATENAME>', '<STATENAME>Maharashtra</STATENAME>');

describe('xml-parser', () => {
  it('parses valid Tally XML', () => {
    const result = parseTallyXml(VALID_XML);
    expect(result.bill.number).toBe('INV-001');
    expect(result.bill.party).toBe('Test Party');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].sku).toBe('SAREE-001');
    expect(result.items[0].qty).toBe(2);
    expect(result.items[0].rate).toBe(500);
    expect(result.items[0].hsn).toBe('5208');
  });

  // Mirrors real Tally purchase XML (Koyal.xml) — HSN is NOT in HSNCODE but in
  // GSTHSNNAME / HSNSTOCKGROUPSOURCE / GSTSTOCKGROUPSOURCE.
  const TALLY_STOCKGROUP_HSN_XML = `<?xml version="1.0"?>
<ENVELOPE>
  <BODY>
    <IMPORTDATA>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <VOUCHER>
            <VOUCHERNUMBER>81</VOUCHERNUMBER>
            <DATE>20260602</DATE>
            <PARTYNAME>KOYAL DESIGNER</PARTYNAME>
            <STATENAME>Gujarat</STATENAME>
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>S/N1102 63 DNA1605B</STOCKITEMNAME>
              <GSTSTOCKGROUPSOURCE>540822 HSN 5% SAREES</GSTSTOCKGROUPSOURCE>
              <HSNSOURCETYPE>Stock Group</HSNSOURCETYPE>
              <HSNSTOCKGROUPSOURCE>540822 HSN 5% SAREES</HSNSTOCKGROUPSOURCE>
              <GSTHSNNAME>540822</GSTHSNNAME>
              <GSTHSNDESCRIPTION>SAREES</GSTHSNDESCRIPTION>
              <ACTUALQTY>47 PCS</ACTUALQTY>
              <RATE>1250.00/PCS</RATE>
              <AMOUNT>-58750.00</AMOUNT>
            </ALLINVENTORYENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  it('extracts HSN from GSTHSNNAME when HSNCODE is absent (real Tally export)', () => {
    const result = parseTallyXml(TALLY_STOCKGROUP_HSN_XML);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].hsn).toBe('540822');
  });

  it('extracts HSN from HSNSTOCKGROUPSOURCE label when GSTHSNNAME is absent', () => {
    const xml = TALLY_STOCKGROUP_HSN_XML
      .replace('<GSTHSNNAME>540822</GSTHSNNAME>', '')
      .replace('<GSTHSNDESCRIPTION>SAREES</GSTHSNDESCRIPTION>', '');
    const result = parseTallyXml(xml);
    expect(result.items[0].hsn).toBe('540822');
  });

  it('throws on invalid XML', () => {
    expect(() => parseTallyXml('not xml')).toThrow();
    expect(() => parseTallyXml('')).toThrow('Empty XML input');
  });

  it('state extraction for IGST vs CGST', () => {
    const local = parseTallyXml(VALID_XML);
    const remote = parseTallyXml(INTERSTATE_XML);
    expect(isInterstate(local.bill, 'Gujarat')).toBe(false);
    expect(isInterstate(remote.bill, 'Gujarat')).toBe(true);
  });

  it('detects CID-encoded XML', () => {
    expect(isCidEncodedXml(toCidXml('TAX INVOICE'))).toBe(true);
    expect(isCidEncodedXml(VALID_XML)).toBe(false);
    expect(isCidEncodedXml('<segment>(cid:65)</segment>')).toBe(false);
  });

  it('decodes CID segments back to text', () => {
    const cid = toCidXml('TAX INVOICE 1885');
    expect(decodeCidEncodedXml(cid)).toContain('TAX INVOICE 1885');
  });

  it('parses CID-encoded XML through the PDF text parser', () => {
    const pdfLikeText = [
      'TAX INVOICE',
      'Invoice No: 1885/26-27',
      'Dated: 26-Jun-2026',
      "Party's Name: Mahendra Distributors",
      '1 Test Saree 5 PCS 200.00 1000.00',
      'Grand Total: 1,000.00',
    ].join('\n');
    const result = parseTallyXml(toCidXml(pdfLikeText));
    expect(result.bill.number).toBe('1885/26-27');
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items[0].rate).toBe(200);
  });

  it('falls back to heuristic line-splitting when CID dump has no newlines', () => {
    const flat = toCidXml(
      'TAX INVOICE Invoice No: 1885/26-27 Dated: 26-Jun-2026 1 Test Saree 5 PCS 200.00 1000.00 Grand Total: 1,000.00'
    );
    const result = parseTallyXml(flat);
    expect(result.bill.number).toBe('1885/26-27');
  });
});
