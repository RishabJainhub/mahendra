export type TallyBill = {
  number: string;
  date: string;
  party: string;
  totals: { amount: number };
  state?: string;
};

export type TallyItem = {
  sku: string;
  name: string;
  qty: number;
  rate: number;
  amount: number;
  hsn?: string;
};

export type TallyParseResult = {
  bill: TallyBill;
  items: TallyItem[];
};

const CID_SEGMENT_RE = /<segment>\s*\(cid:(\d+)\)\s*<\/segment>/g;

/** Quick shape check — at least 8 CID segments and no Tally voucher tags. */
export function isCidEncodedXml(xmlText: string): boolean {
  if (!/<segment>\s*\(cid:\d+\)/i.test(xmlText)) return false;
  if (/<ENVELOPE\b/i.test(xmlText)) return false;
  const matches = xmlText.match(/<segment>\s*\(cid:\d+\)/gi);
  return (matches?.length ?? 0) >= 8;
}

/**
 * Decode a CID-encoded "XML" file back into plain text. Each
 * `<segment>(cid:NN)</segment>` becomes the character with that code point.
 * Whitespace between segments in the source XML is ignored — newline
 * characters in the original PDF text are themselves CID-encoded as
 * (cid:10) so they survive the round-trip.
 *
 * If the decoded text contains no newlines (single-line glyph dump from
 * the PDF), insert heuristic line breaks before common Tally invoice
 * anchors so the downstream PDF text parser can lock onto bill number /
 * date / party / item lines / total.
 */
export function decodeCidEncodedXml(xmlText: string): string {
  let out = '';
  CID_SEGMENT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CID_SEGMENT_RE.exec(xmlText)) !== null) {
    const code = Number(match[1]);
    if (Number.isFinite(code) && code >= 0 && code < 0x110000) {
      out += String.fromCodePoint(code);
    }
  }

  if (!out.includes('\n')) {
    out = insertHeuristicLineBreaks(out);
  }

  return out.trim();
}

function insertHeuristicLineBreaks(flat: string): string {
  // 1. Collapse runs of whitespace to a single space so the anchors below
  //    match consistently.
  let result = flat.replace(/\s+/g, ' ');

  // 2. Break before recognised section headers / totals. Order matters
  //    inside the alternation: longest variants first.
  result = result.replace(
    /\s*\b(TAX\s*INVOICE|Invoice\s*No\.?|Voucher\s*No\.?|Bill\s*No\.?|Dated|Date\b|Party(?:'s)?\s*Name|Buyer|Consignee|Sub\s*Total|Grand\s*Total|Round\s*Off|CGST|SGST|IGST)\b/gi,
    '\n$1'
  );

  // 3. Break right after a date so the next thing (often the first item
  //    line) starts on its own line.
  result = result.replace(
    /(\d{1,2}[-/](?:[A-Za-z]{3}|\d{1,2})[-/]\d{2,4})\s+/g,
    '$1\n'
  );

  // 4. Break before a likely item-line start: an amount-looking number,
  //    then optional whitespace, then a serial digit and an uppercase
  //    word (e.g. "1000.00 2 ITEM NAME 3 PCS 100.00 300.00").
  result = result.replace(
    /(\d+(?:\.\d+)?)\s+(?=\d+\s+[A-Za-z])/g,
    '$1\n'
  );

  return result;
}

function getText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (typeof node === 'object' && node !== null && '#text' in node) {
    return String((node as { '#text': unknown })['#text']);
  }
  return '';
}

/** Pull the leading 4-8 digit HSN out of a label like "540822 HSN 5% SAREES". */
function extractLeadingHsn(field: string): string {
  if (!field) return '';
  const m = field.match(/\b(\d{4,8})\b/);
  return m ? m[1] : '';
}

export function parseTallyXml(xmlText: string): TallyParseResult {
  if (!xmlText || !xmlText.trim()) {
    throw new Error('Empty XML input');
  }

  // Fallback: some "XML" exports are actually a PDF text dump where each
  // glyph is wrapped in <segment>(cid:NN)</segment>. Detect that shape,
  // decode it back into plain text, and route through the PDF text parser.
  if (isCidEncodedXml(xmlText)) {
    const { parseTallyPdfText } = require('./pdf-parser') as typeof import('./pdf-parser');
    const decoded = decodeCidEncodedXml(xmlText);
    if (!decoded || !decoded.trim()) {
      throw new Error('CID-encoded XML decoded to empty text — re-export from Tally as XML or Excel');
    }
    try {
      return parseTallyPdfText(decoded);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'unknown';
      throw new Error(
        `This file is a CID-encoded PDF text dump, not a Tally voucher. Decoded text could not be parsed (${reason}). Re-export from Tally as XML or Excel.`
      );
    }
  }

  const { XMLParser } = require('fast-xml-parser');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xmlText);
  } catch {
    throw new Error('Malformed XML');
  }

  const envelope = parsed.ENVELOPE ?? parsed.envelope;
  if (!envelope) {
    throw new Error('Invalid Tally XML: missing ENVELOPE');
  }

  const body = (envelope as Record<string, unknown>).BODY ?? (envelope as Record<string, unknown>).body;
  const importData = (body as Record<string, unknown>)?.IMPORTDATA ?? (body as Record<string, unknown>)?.importdata;
  const requestData = (importData as Record<string, unknown>)?.REQUESTDATA ?? (importData as Record<string, unknown>)?.requestdata;
  const tallyRequest = (requestData as Record<string, unknown>)?.TALLYMESSAGE ?? (requestData as Record<string, unknown>)?.tallymessage;

  const messages = Array.isArray(tallyRequest) ? tallyRequest : [tallyRequest];
  const voucherMsg = messages.find((m) => m && typeof m === 'object' && ('VOUCHER' in m || 'voucher' in m));
  const voucher = (voucherMsg as Record<string, unknown>)?.VOUCHER ?? (voucherMsg as Record<string, unknown>)?.voucher;

  if (!voucher) {
    throw new Error('Invalid Tally XML: missing VOUCHER');
  }

  const v = voucher as Record<string, unknown>;
  const billNumber = getText(v.VOUCHERNUMBER ?? v.vouchernumber);
  const billDateRaw = getText(v.DATE ?? v.date);
  const billDate = (require('./dates') as typeof import('./dates')).normalizeTallyDate(billDateRaw);
  const party = getText(v.PARTYNAME ?? v.partyname);
  const state = getText(v.STATENAME ?? v.statename) || undefined;

  const entries = v['ALLINVENTORYENTRIES.LIST'] ?? v['allinventoryentries.list'];
  const entryList = Array.isArray(entries) ? entries : entries ? [entries] : [];

  if (entryList.length === 0) {
    throw new Error('Invalid Tally XML: no inventory entries');
  }

  const items: TallyItem[] = entryList.map((entry: Record<string, unknown>) => {
    const sku = getText(entry.STOCKITEMNAME ?? entry.stockitemname);
    const name = sku;
    const qty = parseFloat(getText(entry.ACTUALQTY ?? entry.actualqty).replace(/[^0-9.-]/g, '')) || 0;
    const rate = parseFloat(getText(entry.RATE ?? entry.rate)) || 0;
    const amount = parseFloat(getText(entry.AMOUNT ?? entry.amount)) || qty * rate;
    // Tally stores the HSN in several possible fields depending on version and
    // whether it's a stock-group-level or item-level HSN:
    //   HSNCODE              — explicit item-level override (rare)
    //   GSTHSNNAME           — "540822" (clean code, most common)
    //   HSNSTOCKGROUPSOURCE  — "540822 HSN 5% SAREES" (code + label)
    //   GSTSTOCKGROUPSOURCE  — same as above, GST-side mirror
    const explicitHsn =
      getText(entry.HSNCODE ?? entry.hsncode) ||
      getText(entry.GSTHSNNAME ?? entry.gsthsnname) ||
      extractLeadingHsn(
        getText(entry.HSNSTOCKGROUPSOURCE ?? entry.hsnstockgroupsource)
      ) ||
      extractLeadingHsn(
        getText(entry.GSTSTOCKGROUPSOURCE ?? entry.gststockgroupsource)
      ) ||
      undefined;
    const hsn =
      explicitHsn ??
      (require('./hsn') as typeof import('./hsn')).extractHsnFromDescription(name);
    return { sku, name, qty, rate, amount, hsn };
  });

  const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

  return {
    bill: {
      number: billNumber,
      date: billDate,
      party,
      totals: { amount: totalAmount },
      state,
    },
    items,
  };
}

export function isInterstate(bill: TallyBill, homeState = 'Gujarat'): boolean {
  if (!bill.state) return false;
  return bill.state.toLowerCase() !== homeState.toLowerCase();
}
