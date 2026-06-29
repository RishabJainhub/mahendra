import type { TallyBill, TallyItem } from './xml-parser';
import { extractHsnFromDescription } from './hsn';
import { normalizeTallyDate } from './dates';

export type ColumnMapping = Record<string, string>;

export function parseTallyXlsx(
  buffer: Buffer,
  mapping: ColumnMapping
): { bill: TallyBill; items: TallyItem[] } {
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

  if (rows.length === 0) {
    throw new Error('Empty spreadsheet');
  }

  const first = rows[0];
  const billNumber = String(first[mapping.bill_number ?? 'Bill No'] ?? '');
  const billDateRaw = String(first[mapping.bill_date ?? 'Date'] ?? '');
  const billDate = normalizeTallyDate(billDateRaw);
  const party = String(first[mapping.party ?? 'Party'] ?? '');

  const items: TallyItem[] = rows.map((row) => {
    const sku = String(row[mapping.sku ?? 'SKU'] ?? row[mapping.name ?? 'Item'] ?? '');
    const name = String(row[mapping.name ?? 'Item'] ?? sku);
    const qty = Number(row[mapping.qty ?? 'Qty'] ?? 0);
    const rate = Number(row[mapping.rate ?? 'Rate'] ?? 0);
    const amount = Number(row[mapping.amount ?? 'Amount'] ?? qty * rate);
    const explicitHsn = row[mapping.hsn ?? 'HSN'] ? String(row[mapping.hsn ?? 'HSN']) : undefined;
    const hsn = explicitHsn || extractHsnFromDescription(name);
    return { sku, name, qty, rate, amount, hsn };
  });

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

  return {
    bill: { number: billNumber, date: billDate, party, totals: { amount: totalAmount } },
    items,
  };
}
