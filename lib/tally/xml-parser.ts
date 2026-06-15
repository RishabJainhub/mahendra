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

function getText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (typeof node === 'object' && node !== null && '#text' in node) {
    return String((node as { '#text': unknown })['#text']);
  }
  return '';
}

export function parseTallyXml(xmlText: string): TallyParseResult {
  if (!xmlText || !xmlText.trim()) {
    throw new Error('Empty XML input');
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
  const billDate = getText(v.DATE ?? v.date);
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
    const hsn = getText(entry.HSNCODE ?? entry.hsncode) || undefined;
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
