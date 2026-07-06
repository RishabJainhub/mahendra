export type PricingRule = {
  ma_markup1_pct: number;
  ma_markup2_pct: number;
  dna_markup1_pct: number;
  dna_markup2_pct: number;
  gst_pct: number;
};

/**
 * Apply two consecutive markups (simple percentage multipliers).
 * Used by DNA. `rate × (1 + m1/100) × (1 + m2/100)`.
 */
export function applyConsecutiveMarkups(
  rate: number,
  m1: number | null | undefined,
  m2: number | null | undefined
): number {
  const a = Number(m1) || 0;
  const b = Number(m2) || 0;
  return rate * (1 + a / 100) * (1 + b / 100);
}

/**
 * Apply two consecutive calculator-MU (margin) markups.
 * Used by MA. This is the "MU" button on a physical calculator:
 *   price = cost / (1 - margin/100)
 * so two stacked markups are:  rate / (1 - m1/100) / (1 - m2/100).
 *
 * Example: rate 1250, MU28, MU5 → 1250 / 0.72 / 0.95 = 1827.49 → trunc 1827.
 */
export function applyConsecutiveMU(
  rate: number,
  m1: number | null | undefined,
  m2: number | null | undefined
): number {
  const a = Number(m1) || 0;
  const b = Number(m2) || 0;
  const d1 = 1 - a / 100;
  const d2 = 1 - b / 100;
  if (d1 <= 0 || d2 <= 0) return rate;
  return rate / d1 / d2;
}

export function calcMA(rate: number, rule: PricingRule): number {
  const raw = applyConsecutiveMU(rate, rule.ma_markup1_pct, rule.ma_markup2_pct);
  // Drop the decimal without rounding — 1827.49 → 1827, 1827.99 → 1827.
  return Math.trunc(raw);
}

export function calcDNA(rate: number, rule: PricingRule): number {
  const raw = applyConsecutiveMarkups(rate, rule.dna_markup1_pct, rule.dna_markup2_pct);
  return roundUpToNearest(raw, 5);
}

/**
 * Round `value` up to the nearest positive `step`. Treats values already at a
 * multiple (within float epsilon) as exact — so 1265.0000001 stays at 1265,
 * but 1263 goes to 1265.
 */
export function roundUpToNearest(value: number, step: number): number {
  if (!Number.isFinite(value) || value <= 0 || step <= 0) return 0;
  const eps = 1e-9;
  return Math.ceil((value - eps) / step) * step;
}

/** Render a sticker price without trailing zeros — e.g. 5326, 4205.5 */
export function formatLabelPrice(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Render a supplier code as "PREFIX(NUMBER)". Returns "" if nothing to show. */
export function formatSupplierCode(
  prefix?: string | null,
  number?: string | null
): string {
  const p = (prefix ?? '').trim();
  const n = (number ?? '').trim();
  if (!p && !n) return '';
  if (!n) return p;
  if (!p) return n;
  return `${p}(${n})`;
}

type ChainOp = 'MU' | 'PCT';

function describeChain(
  label: string,
  m1: number,
  m2: number,
  sampleRate: number,
  op1: ChainOp = 'MU',
  op2: ChainOp = 'MU'
): string {
  const parts: string[] = [];
  if (m1 > 0) parts.push(formatOp(m1, op1));
  if (m2 > 0) parts.push(formatOp(m2, op2));
  const chain = parts.length ? parts.join('+') : 'flat';
  // MA chain uses the calculator-MU (margin) formula; DNA uses simple markup.
  const price = label === 'MA'
    ? applyConsecutiveMU(sampleRate, m1, m2)
    : applyConsecutiveMarkups(sampleRate, m1, m2);
  return `${label}: ${chain} → ${formatLabelPrice(price)}`;
}

function formatOp(pct: number, op: ChainOp): string {
  const value = stripTrailingZeros(pct);
  return op === 'MU' ? `MU${value}` : `${value}%`;
}

function stripTrailingZeros(n: number): string {
  const r = Math.round(n * 1000) / 1000;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function describeFormula(rule: PricingRule, sampleRate = 1000): string {
  const ma = describeChain(
    'MA',
    Number(rule.ma_markup1_pct) || 0,
    Number(rule.ma_markup2_pct) || 0,
    sampleRate,
    'MU',
    'MU'
  );
  const dna = describeChain(
    'DNA',
    Number(rule.dna_markup1_pct) || 0,
    Number(rule.dna_markup2_pct) || 0,
    sampleRate,
    'PCT',
    'MU'
  );
  return `On rate ${formatINR(sampleRate)} → ${ma} · ${dna} (+ ${stripTrailingZeros(Number(rule.gst_pct) || 0)}% GST)`;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
