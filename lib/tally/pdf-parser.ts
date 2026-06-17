import type { TallyBill, TallyItem, TallyParseResult } from './xml-parser';

const BILL_NUMBER_RE =
  /(?:invoice|voucher|bill|inv\.?)\s*(?:no\.?|number|#)\s*[:\-]\s*([A-Za-z0-9][A-Za-z0-9\-\/]*)/i;
const DATE_RE =
  /(?:dated?|date)\s*[:\-]?\s*(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}|\d{8}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i;
const PARTY_RE =
  /(?:party(?:'?s)?\s*name|party|buyer|customer|consignee)\s*[:\-]?\s*(.+)/i;
const TOTAL_RE =
  /(?:grand\s*)?total\s*[:\-]?\s*(?:₹|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/i;

/** Line: optional sl no, description, qty [unit], rate, amount */
const ITEM_LINE_RE =
  /^(?:\d+\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*(?:pcs|nos|mtr|mt|mtrs?)?\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/i;

function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, '')) || 0;
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return trimmed;
}

function slugSku(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'ITEM';
}

/**
 * Parse extracted text from a Tally-printed invoice/sales voucher PDF.
 * Layouts vary by Tally version; this uses common Indian Tally print patterns.
 */
export function parseTallyPdfText(text: string): TallyParseResult {
  if (!text || !text.trim()) {
    throw new Error('PDF contains no readable text — try exporting XML from Tally instead');
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let billNumber = '';
  let billDate = '';
  let party = '';

  for (const line of lines) {
    if (!billNumber) {
      const m = line.match(BILL_NUMBER_RE);
      if (m) billNumber = m[1].trim();
    }
    if (!billDate) {
      const m = line.match(DATE_RE);
      if (m) billDate = normalizeDate(m[1]);
    }
    if (!party) {
      const m = line.match(PARTY_RE);
      if (m) party = m[1].trim().slice(0, 255);
    }
  }

  const items: TallyItem[] = [];
  let totalFromLines = 0;

  for (const line of lines) {
    if (/^(sl|s\.?no|description|item|particulars|qty|rate|amount)/i.test(line)) continue;
    if (/^(sub\s*total|cgst|sgst|igst|round\s*off|total)/i.test(line)) continue;

    const m = line.match(ITEM_LINE_RE);
    if (!m) continue;

    const name = m[1].trim();
    if (name.length < 2) continue;

    const qty = parseAmount(m[2]);
    const rate = parseAmount(m[3]);
    const amount = parseAmount(m[4]);
    if (qty <= 0 || rate < 0) continue;

    items.push({
      sku: slugSku(name),
      name,
      qty,
      rate,
      amount: amount > 0 ? amount : qty * rate,
    });
    totalFromLines += amount > 0 ? amount : qty * rate;
  }

  if (items.length === 0) {
    throw new Error(
      'Could not find line items in this PDF. Export as XML from Tally (Alt+E) for best results.'
    );
  }

  let totalAmount = totalFromLines;
  for (const line of lines) {
    const m = line.match(TOTAL_RE);
    if (m) {
      totalAmount = parseAmount(m[1]);
      break;
    }
  }

  if (!billNumber) {
    billNumber = `PDF-${Date.now().toString(36).toUpperCase()}`;
  }
  if (!billDate) {
    billDate = new Date().toISOString().slice(0, 10);
  }
  if (!party) {
    party = 'Unknown Party';
  }

  return {
    bill: {
      number: billNumber,
      date: billDate,
      party,
      totals: { amount: totalAmount },
    },
    items,
  };
}

export async function parseTallyPdf(buffer: Buffer): Promise<TallyParseResult> {
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return parseTallyPdfText(data.text);
}
