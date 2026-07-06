import type { TallyBill, TallyItem } from './xml-parser';
import { extractHsnFromDescription } from './hsn';
import { normalizeTallyDate } from './dates';
import { detectColumns, readSpreadsheet, type ColumnMapping } from './column-detector';

export type { ColumnMapping } from './column-detector';

/**
 * Parse an Excel (.xlsx/.xls) or CSV spreadsheet into a bill + line items.
 *
 * If `mapping` is provided, uses it directly. Otherwise auto-detects columns
 * from the header row via fuzzy matching — works with any accounting software
 * that exports a spreadsheet (Tally, Marg, Busy, Vyapar, Zoho Books, etc.).
 *
 * Bill meta (number/date/party) is taken from the first data row if those
 * columns exist; otherwise falls back to sensible defaults.
 */
export function parseTallyXlsx(
  buffer: Buffer,
  mapping?: ColumnMapping,
  isCsv = false
): { bill: TallyBill; items: TallyItem[] } {
  const { headers, rows } = readSpreadsheet(buffer, isCsv);
  if (rows.length === 0) {
    throw new Error('Empty spreadsheet');
  }

  // Auto-detect if no explicit mapping provided.
  const effective = mapping && Object.keys(mapping).length > 0
    ? normalizeMapping(mapping)
    : detectColumns(headers);

  const first = rows[0];
  const billNumber = String(first[effective.bill_number ?? ''] ?? '').trim();
  const billDateRaw = String(first[effective.bill_date ?? ''] ?? '').trim();
  const billDate = billDateRaw ? normalizeTallyDate(billDateRaw) : '';
  const party = String(first[effective.party ?? ''] ?? '').trim();

  const items: TallyItem[] = [];
  for (const row of rows) {
    const skuRaw = String(row[effective.sku ?? ''] ?? '').trim();
    const nameRaw = String(row[effective.name ?? ''] ?? '').trim();
    const name = nameRaw || skuRaw;
    if (!name) continue;

    const qty = Number(row[effective.qty ?? ''] ?? 0) || 0;
    const rate = Number(row[effective.rate ?? ''] ?? 0) || 0;
    if (qty <= 0 || rate <= 0) continue;

    const amount = Number(row[effective.amount ?? ''] ?? 0) || qty * rate;
    const explicitHsn = row[effective.hsn ?? '']
      ? String(row[effective.hsn ?? '']).trim()
      : '';
    const hsn = explicitHsn || extractHsnFromDescription(name);

    items.push({
      sku: skuRaw || name,
      name,
      qty,
      rate,
      amount,
      hsn,
    });
  }

  if (items.length === 0) {
    throw new Error(
      'No valid line items found. Check that the spreadsheet has columns for item name, quantity, and rate.'
    );
  }

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

  return {
    bill: {
      number: billNumber || `IMPORT-${Date.now().toString(36).toUpperCase()}`,
      date: billDate || new Date().toISOString().slice(0, 10),
      party: party || 'Unknown Party',
      totals: { amount: totalAmount },
    },
    items,
  };
}

/** Accept either the old Record<string, string> or the new ColumnMapping. */
function normalizeMapping(m: Record<string, string>): ColumnMapping {
  const out: ColumnMapping = {};
  for (const [k, v] of Object.entries(m)) {
    if (v) (out as Record<string, string>)[k] = v;
  }
  return out;
}
