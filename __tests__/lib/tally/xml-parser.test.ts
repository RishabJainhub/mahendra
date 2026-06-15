import { parseTallyXml, isInterstate } from '@/lib/tally/xml-parser';

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
});
