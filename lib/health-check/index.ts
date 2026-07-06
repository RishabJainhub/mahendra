import { calcMA, calcDNA, formatINR } from '@/lib/pricing';
import { parseTallyXml } from '@/lib/tally/xml-parser';
import { parseTallyPdfText } from '@/lib/tally/pdf-parser';
import { generateBarcodePng } from '@/lib/barcode';

export type HealthCheckResult = {
  id: string;
  category: 'pricing' | 'barcode' | 'import' | 'format';
  name: string;
  pass: boolean;
  expected: string;
  actual: string;
};

const SAMPLE_XML = `<?xml version="1.0"?>
<ENVELOPE><BODY><IMPORTDATA><REQUESTDATA><TALLYMESSAGE><VOUCHER>
<VOUCHERNUMBER>HC-001</VOUCHERNUMBER><DATE>20250601</DATE><PARTYNAME>Health Check</PARTYNAME>
<ALLINVENTORYENTRIES.LIST><STOCKITEMNAME>TEST-SKU</STOCKITEMNAME><ACTUALQTY>1 PCS</ACTUALQTY>
<RATE>100</RATE><AMOUNT>100</AMOUNT></ALLINVENTORYENTRIES.LIST>
</VOUCHER></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;

const SAMPLE_PDF_TEXT = `
Invoice No. : HC-PDF-01
Dated       : 01-Jun-2025
Party       : Health Check PDF
1   Test Saree   2 PCS   500.00   1000.00
Grand Total : 1,000.00
`;

export function runPricingFormulaChecks(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];

  const rule = {
    ma_markup1_pct: 28,
    ma_markup2_pct: 5,
    dna_markup1_pct: 20,
    dna_markup2_pct: 5,
    gst_pct: 5,
  };

  const maPrice = calcMA(4000, rule);
  results.push({
    id: 'pricing-ma-consecutive',
    category: 'pricing',
    name: 'MA consecutive MU markups (rate / 0.72 / 0.95)',
    pass: Math.abs(maPrice - 5847) < 0.001,
    expected: '5847',
    actual: maPrice.toFixed(2),
  });

  const dnaPrice = calcDNA(4000, rule);
  results.push({
    id: 'pricing-dna-consecutive',
    category: 'pricing',
    name: 'DNA consecutive markups (rate × 1.20 × 1.05)',
    pass: Math.abs(dnaPrice - 5040) < 0.001,
    expected: '5040',
    actual: dnaPrice.toFixed(2),
  });

  const flat = calcMA(1000, {
    ma_markup1_pct: 0,
    ma_markup2_pct: 0,
    dna_markup1_pct: 0,
    dna_markup2_pct: 0,
    gst_pct: 0,
  });
  results.push({
    id: 'pricing-flat',
    category: 'pricing',
    name: 'Zero markups pass rate through unchanged',
    pass: Math.abs(flat - 1000) < 0.001,
    expected: '1000',
    actual: String(flat),
  });

  const inr = formatINR(1234.5);
  results.push({
    id: 'format-inr',
    category: 'format',
    name: 'INR formatting (en-IN)',
    pass: inr.includes('1,234.50') && inr.includes('₹'),
    expected: '₹1,234.50 style',
    actual: inr,
  });

  return results;
}

export function runImportParserChecks(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];

  try {
    const xml = parseTallyXml(SAMPLE_XML);
    results.push({
      id: 'import-xml',
      category: 'import',
      name: 'Tally XML parser',
      pass: xml.bill.number === 'HC-001' && xml.items.length === 1 && xml.items[0].rate === 100,
      expected: 'HC-001, 1 item @ 100',
      actual: `${xml.bill.number}, ${xml.items.length} items @ ${xml.items[0].rate}`,
    });
  } catch (e) {
    results.push({
      id: 'import-xml',
      category: 'import',
      name: 'Tally XML parser',
      pass: false,
      expected: 'HC-001, 1 item @ 100',
      actual: e instanceof Error ? e.message : 'parse failed',
    });
  }

  try {
    const pdf = parseTallyPdfText(SAMPLE_PDF_TEXT);
    results.push({
      id: 'import-pdf',
      category: 'import',
      name: 'Tally PDF text parser',
      pass: pdf.bill.number === 'HC-PDF-01' && pdf.items.length >= 1,
      expected: 'HC-PDF-01 with line items',
      actual: `${pdf.bill.number}, ${pdf.items.length} items`,
    });
  } catch (e) {
    results.push({
      id: 'import-pdf',
      category: 'import',
      name: 'Tally PDF text parser',
      pass: false,
      expected: 'HC-PDF-01 with line items',
      actual: e instanceof Error ? e.message : 'parse failed',
    });
  }

  return results;
}

export async function runBarcodeChecks(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = [];
  const testData = 'MAHENDRA-TEST-12345';

  try {
    const png = await generateBarcodePng({ data: testData, type: 'code128', scale: 2, height: 10 });
    const isPng = png.length > 50 && png[0] === 0x89 && png[1] === 0x50;
    results.push({
      id: 'barcode-png',
      category: 'barcode',
      name: 'Barcode PNG generation (Code128)',
      pass: isPng,
      expected: 'Valid PNG buffer (>50 bytes, PNG header)',
      actual: `${png.length} bytes, header ${png.slice(0, 4).toString('hex')}`,
    });
  } catch (e) {
    results.push({
      id: 'barcode-png',
      category: 'barcode',
      name: 'Barcode PNG generation (Code128)',
      pass: false,
      expected: 'Valid PNG buffer',
      actual: e instanceof Error ? e.message : 'generation failed',
    });
  }

  try {
    const png = await generateBarcodePng({ data: 'SKU-999', type: 'code128' });
    results.push({
      id: 'barcode-sku',
      category: 'barcode',
      name: 'SKU barcode encodes without error',
      pass: png.length > 50,
      expected: 'Non-empty PNG for SKU-999',
      actual: `${png.length} bytes`,
    });
  } catch (e) {
    results.push({
      id: 'barcode-sku',
      category: 'barcode',
      name: 'SKU barcode encodes without error',
      pass: false,
      expected: 'Non-empty PNG',
      actual: e instanceof Error ? e.message : 'failed',
    });
  }

  return results;
}

export async function runAllHealthChecks(): Promise<{
  results: HealthCheckResult[];
  pass: number;
  fail: number;
  allPass: boolean;
}> {
  const results = [
    ...runPricingFormulaChecks(),
    ...runImportParserChecks(),
    ...(await runBarcodeChecks()),
  ];
  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  return { results, pass, fail, allPass: fail === 0 };
}
