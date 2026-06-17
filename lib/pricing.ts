export type PricingModel = 'standard' | 'company151';

export type PricingRule = {
  model: PricingModel;
  margin_pct: number;
  markup_pct: number;
  gst_pct: number;
};

export const PRICING_MODELS: {
  value: PricingModel;
  label: string;
  description: string;
}[] = [
  {
    value: 'company151',
    label: 'Company 151',
    description: 'Sticker rate = Tally rate × 1.25. Margin and markup are ignored.',
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Apply margin % then markup % on the Tally rate, then GST.',
  },
];

export function formatModelLabel(model: string): string {
  return PRICING_MODELS.find((m) => m.value === model)?.label ?? model;
}

export function describeFormula(rule: PricingRule, sampleRate = 1000): string {
  if (rule.model === 'company151') {
    const unit = calculateCompany151Line(sampleRate);
    return `Rate ${formatINR(sampleRate)} → sticker ${formatINR(unit)} (×1.25) + ${rule.gst_pct}% GST`;
  }
  const line = calculateLine({ rate: sampleRate, qty: 1 }, rule);
  const parts = [`Base ${formatINR(sampleRate)}`];
  if (rule.margin_pct > 0) parts.push(`+${rule.margin_pct}% margin`);
  if (rule.markup_pct > 0) parts.push(`+${rule.markup_pct}% markup`);
  parts.push(`= ${formatINR(line.unit_price)} + ${rule.gst_pct}% GST`);
  return parts.join(' ');
}

export type LineInput = {
  rate: number;
  qty: number;
  gst_rate?: number;
  is_interstate?: boolean;
};

export type LineResult = {
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  unit_price: number;
};

export function calculateCompany151Line(rate: number): number {
  return rate * 1.25;
}

export function calculateLine(input: LineInput, rule: PricingRule): LineResult {
  const qty = input.qty;
  let unitPrice = input.rate;

  if (rule.model === 'company151') {
    unitPrice = calculateCompany151Line(input.rate);
  } else {
    if (rule.margin_pct > 0) {
      unitPrice = input.rate * (1 + rule.margin_pct / 100);
    }
    if (rule.markup_pct > 0) {
      unitPrice = unitPrice * (1 + rule.markup_pct / 100);
    }
  }

  const taxable = unitPrice * qty;
  const gstRate = input.gst_rate ?? rule.gst_pct;
  const gstAmount = taxable * (gstRate / 100);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (input.is_interstate) {
    igst = gstAmount;
  } else {
    cgst = gstAmount / 2;
    sgst = gstAmount / 2;
  }

  return {
    taxable,
    cgst,
    sgst,
    igst,
    total: taxable + cgst + sgst + igst,
    unit_price: unitPrice,
  };
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
