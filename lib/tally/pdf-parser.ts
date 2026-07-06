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
  /^(?:\d+\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*(?:pcs|nos|mtr|mt|mtrs?)?\s+(\d+(?:[.,]\d+)*)\s+(\d+(?:[.,]\d+)*)\s*$/i;

// Generic invoice item line — works on normalized (single-space) text.
// Matches: "Silk Saree Model XYZ 2 500.00 1,000.00"
// Description is non-greedy; qty/rate/amount are the last three numeric tokens.
const GENERIC_ITEM_RE =
  /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:[.,]\d+)*)\s+(\d+(?:[.,]\d+)*)\s*$/;

// Generic "qty rate amount" continuation line (when description is on the
// previous line). Matches: "2  500.00  1,000.00" or "2 500.00 1000.00".
const QTY_RATE_AMOUNT_RE =
  /^(\d+(?:\.\d+)?)\s+(\d+(?:[.,]\d+)*)\s+(\d+(?:[.,]\d+)*)\s*$/;

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

// Inline/compressed layout (Purchase_66 style) — PDF text extraction puts each
// item on one continuous line instead of stacked columns:
//   "1 ASHRAY 149 DNA1600B 18,200.00PCS1,300.0014 PCS5 %540710"
// Description charset excludes % and commas so trailing "5 %540710" (GST) on
// the previous item cannot be mistaken for sl-no "5" on the next.
const INLINE_ITEM_RE =
  /(\d+)\s+((?:[A-Za-z0-9/.\-\s&']+?))\s+(?:MA|D\s*\/?\s*NA)\s*(\d+(?:\.\d+)?)\s*B\s*([\d,]+\.\d{2})PCS([\d,]+\.\d{2})(\d+)\s+PCS\s*(\d+(?:\.\d+)?)\s*%\s*(\d{4,8})/gi;

const SUPPLIER_PARTY_RE =
  /Supplier\s*\(\s*Bill\s*from\s*\)\s+([A-Za-z][A-Za-z0-9\s&.\-'/]+?)(?=\s+(?:HOUSE|SHOP|SHOP\s*NO|4002|\d{3,}))/i;
const INLINE_INVOICE_NO_RE = /Invoice\s*No\.?\s*(\d+(?:\/[\w-]+)?)/i;
const INLINE_DATE_RE =
  /(?:Dated|dt\.)\s*(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}|\d{8}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i;

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
/**
 * Clean a raw item description so only the human-readable item name remains on
 * the printed label. Strips, in order:
 *
 *   1. The supplier's pre-printed DNA/MA sticker label — "DNA1605B", "MA1827B".
 *      Also handles PDF-extraction artifacts where a line break splits "DNA"
 *      into "D/NA" or "D / NA".
 *   2. Trailing amount strings — "18,200.00", "1600.00".
 *   3. The trailing company code — a standalone 2-3 digit number after the
 *      item name (e.g. "ASHRAY 149" → "ASHRAY", "S/N1102 63" → "S/N1102").
 *      Numbers that are part of the name (like "DHURANDHAR-2" or "S/N1102")
 *      are preserved because they aren't preceded by a space.
 *   4. The HSN if it appears as a trailing boundary.
 */
function cleanDescription(raw: string, hsn?: string): string {
  if (hsn) {
    const idx = raw.indexOf(hsn);
    if (idx >= 0) {
      const after = raw.slice(idx + hsn.length);
      if (after && /^[\s\d,.\-]+$/.test(after)) {
        return raw.slice(0, idx + hsn.length).trim();
      }
    }
  }

  // If the description has a "<company_code> <DNA/MA label>" pattern, take
  // everything BEFORE the company code — that's the item name. The company
  // code is a short standalone number (149, 215, 63) between the name and the
  // DNA/MA sticker label.
  const labelMatch = raw.match(/^(.+?)\s+\d+\s+(?:MA|D\s*\/?\s*NA)\s*\d+(?:\.\d+)?\s*B/i);
  if (labelMatch && labelMatch[1].trim().length > 0) {
    // Strip a leading sl-no digit glued to the name (e.g. "2SIVAKASI" → "SIVAKASI").
    return labelMatch[1].trim().replace(/^\d+(?=[A-Za-z])/, '').trim();
  }

  // No DNA/MA label found — just strip amounts, unit markers, and decimals.
  return raw
    .replace(/\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?/g, ' ')
    .replace(/\d+\.\d{2}/g, ' ')
    .replace(/\b(PCS|NOS|MTRS?|MT|KG|GMS?|GM|BOXES?|PR|PRS|SET|SETS?)\b/gi, ' ')
    .replace(/^\s*\d+(?=[A-Za-z])/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// cleanItemNameForLabel has moved to lib/tally/clean-name.ts (browser-safe,
// no pdf-parse dependency) so it can be imported from client components.
export { cleanItemNameForLabel } from '@/lib/tally/clean-name';

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

  // Try stacked-column, inline/compressed, and generic invoice layouts.
  // Keep whichever finds the most items.
  const structured = parseStructuredTallyInvoice(lines);
  const inline = parseInlineTallyInvoice(text);
  const generic = parseGenericInvoice(lines);
  const candidates = [structured, inline, generic].filter(
    (r): r is TallyParseResult => r !== null && r.items.length > 0
  );
  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.items.length - a.items.length)[0];
  }

  throw new Error(
    'Could not find line items in this PDF. Export as XML or Excel from your accounting software for best results.'
  );
}

export async function parseTallyPdf(buffer: Buffer): Promise<TallyParseResult> {
  const { extractPdfText } = await import('./pdf-extract');
  const text = await extractPdfText(buffer);
  return parseTallyPdfText(text);
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

/**
 * Parser for compressed/inline Tally invoices (Purchase_66 style) where PDF
 * text extraction collapses each item onto one line:
 *   "1 ASHRAY 149 DNA1600B 18,200.00PCS1,300.0014 PCS5 %540710"
 */
function parseInlineTallyInvoice(text: string): TallyParseResult | null {
  // Split on page continuations so repeated headers on page 2+ don't pollute matches.
  const segments = text.split(/continued\s*\.\.\.|INVOICE\s*\(\s*Page\s*\d+\s*\)/i);
  const items: TallyItem[] = [];
  const re = new RegExp(INLINE_ITEM_RE.source, INLINE_ITEM_RE.flags);

  for (const segment of segments) {
    const headerIdx = segment.search(/Sl\s*Description\s*of\s*Goods/i);
    const rawSection = headerIdx >= 0 ? segment.slice(headerIdx) : segment;
    // PDF extractors vary: unpdf collapses to one line, pdf-parse inserts
    // newlines and may glue "DNA1600B" directly to "18,200.00" with no space.
    const searchText = rawSection.replace(/\s+/g, ' ');

    let match: RegExpExecArray | null;
    while ((match = re.exec(searchText)) !== null) {
      const rawDesc = match[2].trim();
      const hsn = match[8];
      const rate = parseAmount(match[5]);
      const qty = Number(match[6]);
      if (!rawDesc || rate <= 0 || !Number.isFinite(qty) || qty <= 0) continue;

      const description = cleanDescription(`${rawDesc} DNA${match[3]}B`, hsn);
      if (!description) continue;

      items.push({
        sku: slugSku(description),
        name: description,
        qty,
        rate,
        amount: qty * rate,
        hsn: hsn || extractHsnFromDescription(description),
      });
    }
  }

  if (items.length === 0) return null;

  const billNumber =
    text.match(INLINE_INVOICE_NO_RE)?.[1]?.trim() ?? '';
  const billDate = normalizeDate(text.match(INLINE_DATE_RE)?.[1]?.trim() ?? '');
  const party = (text.match(SUPPLIER_PARTY_RE)?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 255);

  let totalAmount = items.reduce((s, x) => s + x.amount, 0);
  const totalMatch = text.match(TOTAL_RS_LINE_RE);
  if (totalMatch) {
    const parsed = parseAmount(totalMatch[1]);
    if (parsed > 0) totalAmount = parsed;
  }

  const fallbackBillNumber = `PDF-${Date.now().toString(36).toUpperCase()}`;
  const fallbackDate = billDate || new Date().toISOString().slice(0, 10);

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

/**
 * Generic invoice parser for non-Tally PDFs (Marg, Busy, Zoho Books, Vyapar,
 * custom invoices). Handles two common layouts:
 *
 * 1. Tabular — columns separated by 2+ spaces:
 *      "Silk Saree Model XYZ   2   500.00   1,000.00"
 * 2. Multi-line — description on one line, qty/rate/amount on the next:
 *      "Silk Saree Model XYZ"
 *      "2  500.00  1,000.00"
 *
 * Bill meta (number/date/party) is extracted from common label patterns.
 */
function parseGenericInvoice(lines: string[]): TallyParseResult | null {
  // Bound the item section: from after a header containing "description" or
  // "item" up to the first totals marker.
  const headerIdx = lines.findIndex(
    (l) =>
      /description|item\s*name|particulars|product/i.test(l) &&
      /\b(qty|quantity|rate|price|amount)\b/i.test(l)
  );
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0;
  const totalIdx = lines.findIndex(
    (l, i) => i > startIdx && SECTION_END_RE.test(l)
  );
  const endIdx = totalIdx > startIdx ? totalIdx : lines.length;

  const items: TallyItem[] = [];

  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];

    if (
      /^(sl|s\.?no|description|item|particulars|qty|rate|amount|subtotal|sub\s*total|cgst|sgst|igst|round\s*off|total)/i.test(
        line
      )
    )
      continue;
    if (/^\d+\s*$/i.test(line)) continue;

    // Try tabular: "Description<2+spaces>Qty<spaces>Rate<spaces>Amount"
    let m = line.match(GENERIC_ITEM_RE);
    if (m) {
      const name = m[1].trim();
      const qty = Number(m[2]) || 0;
      const rate = parseAmount(m[3]);
      const amount = parseAmount(m[4]);
      if (name.length >= 2 && qty > 0 && rate > 0) {
        items.push({
          sku: slugSku(name),
          name,
          qty,
          rate,
          amount: amount > 0 ? amount : qty * rate,
          hsn: extractHsnFromDescription(name),
        });
        continue;
      }
    }

    // Try multi-line: description on this line, qty/rate/amount on the next.
    const next = lines[i + 1];
    if (next && QTY_RATE_AMOUNT_RE.test(next) && !GENERIC_ITEM_RE.test(next)) {
      const nm = next.match(QTY_RATE_AMOUNT_RE);
      if (nm) {
        const name = line.replace(/^\d+\s+/, '').trim();
        const qty = Number(nm[1]) || 0;
        const rate = parseAmount(nm[2]);
        const amount = parseAmount(nm[3]);
        if (
          name.length >= 2 &&
          qty > 0 &&
          rate > 0 &&
          !/^(total|subtotal|cgst|sgst|igst|round)/i.test(name)
        ) {
          items.push({
            sku: slugSku(name),
            name,
            qty,
            rate,
            amount: amount > 0 ? amount : qty * rate,
            hsn: extractHsnFromDescription(name),
          });
          i++;
          continue;
        }
      }
    }

    // Try the original single-line pattern as a last resort.
    const sm = line.match(ITEM_LINE_RE);
    if (sm) {
      const name = sm[1].trim();
      const qty = parseAmount(sm[2]);
      const rate = parseAmount(sm[3]);
      const amount = parseAmount(sm[4]);
      if (name.length >= 2 && qty > 0 && rate > 0) {
        items.push({
          sku: slugSku(name),
          name,
          qty,
          rate,
          amount: amount > 0 ? amount : qty * rate,
          hsn: extractHsnFromDescription(name),
        });
      }
    }
  }

  if (items.length === 0) return null;

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

  let totalAmount = items.reduce((s, x) => s + x.amount, 0);
  for (const line of lines) {
    const m = line.match(TOTAL_RE);
    if (m) {
      const parsed = parseAmount(m[1]);
      if (parsed > 0) {
        totalAmount = parsed;
        break;
      }
    }
  }

  const fallbackBillNumber = `PDF-${Date.now().toString(36).toUpperCase()}`;
  const fallbackDate = billDate || new Date().toISOString().slice(0, 10);

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
