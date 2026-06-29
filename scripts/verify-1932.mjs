// Verify the PDF parser against the actual Sales_1932 PDF text.
// Run: node scripts/verify-1932.mjs
import fs from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const pdfParse = req('pdf-parse');

const file = '/Users/rishabpjain/Downloads/Mahendra project/Sales_1932_26-27.pdf';
const buf = fs.readFileSync(file);
const { text } = await pdfParse(buf);

// Use tsx-compatible approach: compile parser on the fly
const { parseTallyPdfText } = await import('../lib/tally/pdf-parser.ts');

const result = parseTallyPdfText(text);
console.log('Bill:', result.bill.number, '|', result.bill.date, '|', result.bill.party);
console.log('Total:', result.bill.totals.amount);
console.log('Items:', result.items.length);
for (const item of result.items) {
  console.log('  name=' + JSON.stringify(item.name), 'hsn=' + item.hsn, 'qty=' + item.qty, 'rate=' + item.rate);
}
