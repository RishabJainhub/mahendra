/**
 * Auto-detect spreadsheet column mapping from header names.
 *
 * Works with any accounting software that exports Excel/CSV (Tally, Marg,
 * Busy, Vyapar, Zoho Books, custom sheets) by fuzzy-matching header labels
 * to known field types.
 */

export type ColumnField =
  | 'bill_number'
  | 'bill_date'
  | 'party'
  | 'sku'
  | 'name'
  | 'qty'
  | 'rate'
  | 'amount'
  | 'hsn';

export type ColumnMapping = Partial<Record<ColumnField, string>>;

/** Canonical synonyms for each field — matched case-insensitively. */
const SYNONYMS: Record<ColumnField, string[]> = {
  bill_number: [
    'bill no', 'bill number', 'invoice no', 'invoice number', 'invoice#',
    'voucher no', 'voucher number', 'billno', 'invoiceno', 'inv no',
    'inv number', 'bill #', 'invoice no.', 'voucher no.', 'doc no',
    'document no', 'document number', 'sr no', 'sr. no',
  ],
  bill_date: [
    'date', 'bill date', 'invoice date', 'voucher date', 'doc date',
    'document date', 'inv date', 'dated',
  ],
  party: [
    'party', 'party name', "party's name", 'supplier', 'supplier name',
    'vendor', 'vendor name', 'customer', 'customer name', 'buyer',
    'consignee', 'party a/c', 'party ledger', 'ledger',
  ],
  sku: [
    'sku', 'item code', 'product code', 'item no', 'item number',
    'product no', 'product number', 'code', 'item sku', 'stock item',
    'stockitemname', 'item code.', 'part no', 'part number',
  ],
  name: [
    'item', 'item name', 'product', 'product name', 'description',
    'particulars', 'item description', 'goods', 'description of goods',
    'stock item name', 'product description', 'item details', 'details',
    'item desc', 'product desc',
  ],
  qty: [
    'qty', 'quantity', 'qty.', 'quantity.', 'actual qty', 'billed qty',
    'no of pcs', 'no of nos', 'pcs', 'nos', 'units', 'count',
  ],
  rate: [
    'rate', 'price', 'unit rate', 'unit price', 'rate per pcs',
    'rate per nos', 'rate per unit', 'cost', 'mrp', 'selling price',
    'price per unit', 'rate.', 'price.',
  ],
  amount: [
    'amount', 'amt', 'total', 'line total', 'item amount', 'value',
    'gross', 'net amount', 'amount.', 'amt.', 'total amount',
  ],
  hsn: [
    'hsn', 'hsn/sac', 'hsn code', 'hsn no', 'hsn number', 'sac',
    'hsn/sac code', 'gst hsn', 'gst code', 'hsn.', 'hsn code.',
  ],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function scoreMatch(header: string, synonym: string): number {
  const h = normalize(header);
  const s = normalize(synonym);
  if (!h || !s) return 0;
  if (h === s) return 100;
  // Strong: one fully contains the other (longer contains shorter).
  if (h.includes(s) || s.includes(h)) {
    const shorter = Math.min(h.length, s.length);
    const longer = Math.max(h.length, s.length);
    // Penalize when the shorter is much smaller than the longer (e.g. "item"
    // inside "item code" should score lower than "item" inside "item name").
    return Math.round(70 + 25 * (shorter / longer));
  }
  // Moderate: all words of the synonym appear in the header.
  const wordsS = s.split(' ').filter(Boolean);
  const setH = new Set(h.split(' ').filter(Boolean));
  if (wordsS.length > 0 && wordsS.every((w) => setH.has(w))) {
    return 65;
  }
  return 0;
}

/**
 * Detect the best-matching header column for each field. Returns a mapping
 * of field → column header name. Fields with no confident match are omitted.
 *
 * Uses global best-score-first assignment so a header like "Item" goes to the
 * `name` field (exact match) rather than `sku` (loose "item code" match).
 */
export function detectColumns(headers: string[]): ColumnMapping {
  const candidates: { field: ColumnField; header: string; score: number }[] = [];

  for (const field of Object.keys(SYNONYMS) as ColumnField[]) {
    for (const header of headers) {
      let best = 0;
      for (const synonym of SYNONYMS[field]) {
        const score = scoreMatch(header, synonym);
        if (score > best) best = score;
      }
      if (best >= 55) {
        candidates.push({ field, header, score: best });
      }
    }
  }

  // Sort by score descending — assign the strongest matches first.
  candidates.sort((a, b) => b.score - a.score);

  const mapping: ColumnMapping = {};
  const usedFields = new Set<ColumnField>();
  const usedHeaders = new Set<string>();

  for (const { field, header, score } of candidates) {
    if (usedFields.has(field) || usedHeaders.has(header)) continue;
    // Only accept if the score is clearly the best for this header.
    // (Lower threshold for assignment since we already filtered ≥55.)
    mapping[field] = header;
    usedFields.add(field);
    usedHeaders.add(header);
  }

  return mapping;
}

/**
 * Read spreadsheet rows and return both the headers and the data rows.
 * Works with xlsx, xls, and csv buffers via the `xlsx` library.
 */
export function readSpreadsheet(
  buffer: Buffer,
  isCsv = false
): { headers: string[]; rows: Record<string, unknown>[] } {
  const XLSX = require('xlsx') as typeof import('xlsx');
  const workbook = isCsv
    ? XLSX.read(buffer.toString('utf-8'), { type: 'string', raw: false })
    : XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: '',
  });
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(rows[0]);
  return { headers, rows };
}
