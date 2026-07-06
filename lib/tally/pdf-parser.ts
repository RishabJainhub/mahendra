import type { TallyBill, TallyItem, TallyParseResult } from './xml-parser';
import { extractHsnFromDescription } from './hsn';

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

// Stacked-column anchors (Sales_1885 style):
//   "6 PCS"       qty + unit
//   "7 %2,640.00" disc % + rate
//   "5 %540752"   gst % + hsn (4-8 digit)
const QTY_UNIT_RE = /^(\d+)\s+(PCS|NOS|MTR|MTRS?|MT|KG|GMS?|GM|BOX|BOXES?)\s*$/i;
const DISC_RATE_RE = /^(\d+(?:\.\d+)?)\s*%\s*(\d+(?:[.,]\d+)*)\s*$/;
const GST_HSN_RE = /^(\d+(?:\.\d+)?)\s*%\s*(\d{4,8})\s*$/;
const SECTION_END_RE =
  /^(Total\s*Rs|Sub\s*Total|IGST\b|CGST\b|SGST\b|Amount\s*Chargeable|Tax\s*Amount|Round\s*Off)/i;
const TOTAL_RS_LINE_RE = /Total\s*Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i;

const MONTH_MAP: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, '')) || 0;
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const monMatch = trimmed.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})$/);
  if (monMatch) {
    const day = monMatch[1].padStart(2, '0');
    const month = MONTH_MAP[monMatch[2].toUpperCase()];
    let year = monMatch[3];
    if (year.length === 2) year = `20${year}`;
    if (month) return `${year}-${month}-${day}`;
  }
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return trimmed;
}

/**
 * Strip the supplier's pre-printed MA/DNA sticker labels (e.g. "DNA2640B")
 * and embedded money amounts (e.g. "14,731.20") from a description, so the
 * label on our re-printed sticker shows just the item name.
 *
 * When `hsn` is known (extracted from the dedicated HSN line below the qty
 * line), use it as a boundary: if the HSN appears in the description and is
 * followed only by amount characters (digits, commas, dots), cut there — this
 * avoids the trailing HSN digit merging with the first amount (e.g.
 * "RJ 540741" + "44,919.00" concatenated as "RJ 54074144,919.00").
 */
function cleanDescription(raw: string, hsn?: string): string {
  if (hsn) {
    const idx = raw.indexOf(hsn);
    if (idx >= 0) {
      const after = raw.slice(idx + hsn.length);
      // If everything after the HSN is only amount characters, the description
      // ends at (and includes) the HSN.
      if (after && /^[\s\d,.\-]+$/.test(after)) {
        return raw.slice(0, idx + hsn.length).trim();
      }
    }
  }

  return raw
    .replace(/\b(MA|DNA)\d+(?:\.\d+)?B/gi, '')
    .replace(/\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?/g, ' ')
    .replace(/\d+\.\d{2}/g, ' ')
    .replace(/^\s*\d+(?=[A-Za-z])/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findFieldAfterLabel(lines: string[], labelRegex: RegExp): string | null {
  for (let i = 0; i < lines.length - 1; i++) {
    if (labelRegex.test(lines[i])) {
      const value = lines[i + 1]?.trim();
      if (value && !labelRegex.test(value)) return value;
    }
  }
  return null;
}

/** Like findFieldAfterLabel but the label may have trailing text on the same line. */
function findFieldAfterLabelPrefix(lines: string[], labelRegex: RegExp): string | null {
  for (let i = 0; i < lines.length - 1; i++) {
    const m = lines[i].match(labelRegex);
    if (m) {
      const value = lines[i + 1]?.trim();
      if (value && !labelRegex.test(value)) return value;
    }
  }
  return null;
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

  // Prefer the column-stacked Tally layout (Sales_1885-style) when we can
  // detect it. Fall back to the single-line regex parser for other templates.
  const structured = parseStructuredTallyInvoice(lines);
  if (structured) return structured;

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
      hsn: extractHsnFromDescription(name),
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
  // Import the internal lib directly to bypass pdf-parse's index.js self-test,
  // which tries to read ./test/data/05-versions-space.pdf when module.parent
  // is undefined. On Vercel (and any bundled serverless env) that file isn't
  // deployed and the import crashes. The lib-only path has no such side effect.
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const data = await pdfParse(buffer);
  return parseTallyPdfText(data.text);
}

/**
 * Structured parser for column-stacked Tally invoices (Sales_1885 layout):
 *   sl-no                         e.g. "1"
 *   description + amounts         e.g. "PUSHKAR 151 DNA2640B14,731.202,455.20"
 *   disc% + rate                  e.g. "7 %2,640.00"
 *   qty + unit                    e.g. "6 PCS"
 *   gst% + hsn                    e.g. "5 %540752"
 *
 * Anchors on the qty/unit line because it's the most distinctive marker,
 * then walks one line up for the rate, one line down for the HSN, and
 * upward across 1-3 lines for the description (cleaning out the supplier's
 * pre-printed "DNAxxxxB" sticker labels and amount tails).
 */
function parseStructuredTallyInvoice(lines: string[]): TallyParseResult | null {
  const billNumber =
    findFieldAfterLabelPrefix(lines, /^Invoice\s*No\.?/i) ??
    findFieldAfterLabelPrefix(lines, /^Voucher\s*No\.?/i) ??
    findFieldAfterLabelPrefix(lines, /^Bill\s*No\.?/i) ??
    findFieldAfterLabel(lines, /^Invoice\s*No\.?$/i) ??
    findFieldAfterLabel(lines, /^Voucher\s*No\.?$/i) ??
    findFieldAfterLabel(lines, /^Bill\s*No\.?$/i) ??
    '';

  const billDate = findFieldAfterLabel(lines, /^Dated?$/i) ?? '';
  const party =
    findFieldAfterLabel(lines, /^Buyer\b.*$/i) ??
    findFieldAfterLabel(lines, /^Consignee\b.*$/i) ??
    findFieldAfterLabel(lines, /^Party(?:'s)?\s*Name/i) ??
    '';

  // Bound the item section: from after the "Description of Goods" header
  // (or the start) up to the first totals marker.
  const headerIdx = lines.findIndex((l) => /Description\s*of\s*Goods/i.test(l));
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;
  const totalIdx = lines.findIndex(
    (l, i) => i > startIdx && SECTION_END_RE.test(l)
  );
  const endIdx = totalIdx > startIdx ? totalIdx : lines.length;

  const items: TallyItem[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const qm = lines[i].match(QTY_UNIT_RE);
    if (!qm) continue;
    const qty = Number(qm[1]);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const rateLine = lines[i - 1];
    if (!rateLine) continue;
    const rm = rateLine.match(DISC_RATE_RE);
    if (!rm) continue;
    const rate = parseAmount(rm[2]);
    if (rate <= 0) continue;

    let hsn: string | undefined;
    const hsnLine = lines[i + 1];
    if (hsnLine) {
      const hm = hsnLine.match(GST_HSN_RE);
      if (hm) hsn = hm[2];
    }

    const descParts: string[] = [];
    for (let j = i - 2; j >= 0 && i - j <= 6; j--) {
      const line = lines[j];
      if (!line) break;
      if (QTY_UNIT_RE.test(line)) break;
      if (DISC_RATE_RE.test(line)) break;
      if (GST_HSN_RE.test(line)) break;
      if (SECTION_END_RE.test(line)) break;
      if (/^\d+$/.test(line)) break;
      descParts.unshift(line);
    }

    const description = cleanDescription(descParts.join(' '), hsn);
    if (!description) continue;

    if (!hsn) {
      hsn = extractHsnFromDescription(description);
    }

    items.push({
      sku: slugSku(description),
      name: description,
      qty,
      rate,
      amount: qty * rate,
      hsn,
    });
  }

  if (items.length === 0) return null;

  // Prefer the printed "Total Rs ..." value when available; otherwise sum items.
  let totalAmount = items.reduce((s, x) => s + x.amount, 0);
  for (const line of lines) {
    const m = line.match(TOTAL_RS_LINE_RE);
    if (m) {
      const parsed = parseAmount(m[1]);
      if (parsed > 0) {
        totalAmount = parsed;
        break;
      }
    }
  }

  const fallbackBillNumber = `PDF-${Date.now().toString(36).toUpperCase()}`;
  const fallbackDate = normalizeDate(billDate) || new Date().toISOString().slice(0, 10);

  return {
    bill: {
      number: billNumber || fallbackBillNumber,
      date: fallbackDate,
      party: party || 'Unknown Party',
      totals: { amount: totalAmount },
    },
    items,
  };
}
