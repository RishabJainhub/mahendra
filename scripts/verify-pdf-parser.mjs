import fs from 'node:fs';
import { parseTallyPdf } from '../lib/tally/pdf-parser';

(async () => {
  const file = process.argv[2] ?? '/Users/rishabpjain/Downloads/Mahendra project/Sales_1932_26-27.pdf';
  const buf = fs.readFileSync(file);
  const result = await parseTallyPdf(buf);
  console.log('Bill:', result.bill.number, '|', result.bill.date, '|', result.bill.party);
  console.log('Total:', result.bill.totals.amount);
  console.log('Items:', result.items.length);
  for (const item of result.items) {
    console.log('  ', JSON.stringify(item.name), '| HSN:', item.hsn, '| Qty:', item.qty, '| Rate:', item.rate);
  }
})();
