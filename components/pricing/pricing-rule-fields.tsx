'use client';

import { useMemo, useState } from 'react';
import { describeFormula, calcMA, calcDNA, formatINR } from '@/lib/pricing';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';

export type PricingRuleValues = {
  ma_markup1_pct: number;
  ma_markup2_pct: number;
  dna_markup1_pct: number;
  dna_markup2_pct: number;
  gst_pct: number;
};

type Props = {
  prefix?: string;
  defaultValues?: Partial<PricingRuleValues>;
  showPreview?: boolean;
  /** Interactive tester: type any purchase rate, see the MA/DNA it produces. */
  showTester?: boolean;
};

function fieldName(prefix: string | undefined, key: string) {
  return prefix ? `${prefix}_${key}` : key;
}

export function PricingRuleFields({ prefix, defaultValues, showPreview = true, showTester = false }: Props) {
  const [maM1, setMaM1] = useState(String(defaultValues?.ma_markup1_pct ?? 0));
  const [maM2, setMaM2] = useState(String(defaultValues?.ma_markup2_pct ?? 0));
  const [dnaM1, setDnaM1] = useState(String(defaultValues?.dna_markup1_pct ?? 0));
  const [dnaM2, setDnaM2] = useState(String(defaultValues?.dna_markup2_pct ?? 0));
  const [gst, setGst] = useState(String(defaultValues?.gst_pct ?? 5));
  const [testRate, setTestRate] = useState('1000');

  const rule = useMemo(
    () => ({
      ma_markup1_pct: Number(maM1) || 0,
      ma_markup2_pct: Number(maM2) || 0,
      dna_markup1_pct: Number(dnaM1) || 0,
      dna_markup2_pct: Number(dnaM2) || 0,
      gst_pct: Number(gst) || 0,
    }),
    [maM1, maM2, dnaM1, dnaM2, gst]
  );

  const preview = useMemo(() => describeFormula(rule), [rule]);

  const testResult = useMemo(() => {
    const rate = Number(testRate);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return { ma: calcMA(rate, rule), dna: calcDNA(rate, rule) };
  }, [testRate, rule]);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-slate-950">
      <div>
        <p className="text-sm font-semibold text-slate-950">Pricing formula</p>
        <p className="text-xs text-slate-600">
          Two consecutive markups are applied to the Tally rate to produce MA and DNA prices on
          each label.
        </p>
      </div>

      <fieldset className="rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          MA price
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={fieldName(prefix, 'ma_markup1_pct')}>Markup 1 %</Label>
            <Input
              id={fieldName(prefix, 'ma_markup1_pct')}
              name={fieldName(prefix, 'ma_markup1_pct')}
              type="number"
              step="0.01"
              min="0"
              value={maM1}
              onChange={(e) => setMaM1(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={fieldName(prefix, 'ma_markup2_pct')}>Markup 2 %</Label>
            <Input
              id={fieldName(prefix, 'ma_markup2_pct')}
              name={fieldName(prefix, 'ma_markup2_pct')}
              type="number"
              step="0.01"
              min="0"
              value={maM2}
              onChange={(e) => setMaM2(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          DNA price
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={fieldName(prefix, 'dna_markup1_pct')}>% on rate</Label>
            <Input
              id={fieldName(prefix, 'dna_markup1_pct')}
              name={fieldName(prefix, 'dna_markup1_pct')}
              type="number"
              step="0.01"
              min="0"
              value={dnaM1}
              onChange={(e) => setDnaM1(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={fieldName(prefix, 'dna_markup2_pct')}>Markup %</Label>
            <Input
              id={fieldName(prefix, 'dna_markup2_pct')}
              name={fieldName(prefix, 'dna_markup2_pct')}
              type="number"
              step="0.01"
              min="0"
              value={dnaM2}
              onChange={(e) => setDnaM2(e.target.value)}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          DNA = rate + (% on rate), then × (1 + Markup %).
        </p>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={fieldName(prefix, 'gst_pct')}>GST %</Label>
          <Input
            id={fieldName(prefix, 'gst_pct')}
            name={fieldName(prefix, 'gst_pct')}
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={gst}
            onChange={(e) => setGst(e.target.value)}
          />
        </div>
      </div>

      {showPreview && (
        <div className="rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
          <span className="font-medium">Preview: </span>
          {preview}
        </div>
      )}

      {showTester && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Try a rate
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="number"
              min="0"
              step="1"
              value={testRate}
              onChange={(e) => setTestRate(e.target.value)}
              className="w-32"
              aria-label="Test purchase rate"
            />
            {testResult ? (
              <div className="flex items-center gap-4 text-sm">
                <span>
                  MA <span className="font-semibold tabular-nums">{formatINR(testResult.ma)}</span>
                </span>
                <span>
                  DNA <span className="font-semibold tabular-nums">{formatINR(testResult.dna)}</span>
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">Enter a purchase rate to see the sticker prices.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
