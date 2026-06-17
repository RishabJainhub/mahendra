'use client';

import { useMemo, useState } from 'react';
import { describeFormula, PRICING_MODELS, type PricingModel } from '@/lib/pricing';
import { Input } from '@/components/ui/input';
import { Label, SelectField } from '@/components/ui/field';

export type PricingRuleValues = {
  model: PricingModel;
  margin_pct: number;
  markup_pct: number;
  gst_pct: number;
};

type Props = {
  prefix?: string;
  defaultValues?: Partial<PricingRuleValues>;
  showPreview?: boolean;
};

function fieldName(prefix: string | undefined, key: string) {
  return prefix ? `${prefix}_${key}` : key;
}

export function PricingRuleFields({ prefix, defaultValues, showPreview = true }: Props) {
  const [model, setModel] = useState<PricingModel>(defaultValues?.model ?? 'company151');
  const [margin, setMargin] = useState(String(defaultValues?.margin_pct ?? 0));
  const [markup, setMarkup] = useState(String(defaultValues?.markup_pct ?? 0));
  const [gst, setGst] = useState(String(defaultValues?.gst_pct ?? 5));

  const preview = useMemo(
    () =>
      describeFormula({
        model,
        margin_pct: Number(margin) || 0,
        markup_pct: Number(markup) || 0,
        gst_pct: Number(gst) || 0,
      }),
    [model, margin, markup, gst]
  );

  const isStandard = model === 'standard';
  const modelMeta = PRICING_MODELS.find((m) => m.value === model);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-slate-950">
      <div>
        <p className="text-sm font-semibold text-slate-950">Pricing formula</p>
        <p className="text-xs text-slate-600">Applied automatically when this supplier imports a Tally bill.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={fieldName(prefix, 'model')}>Formula type</Label>
          <SelectField
            name={fieldName(prefix, 'model')}
            id={fieldName(prefix, 'model')}
            value={model}
            onChange={(e) => setModel(e.target.value as PricingModel)}
          >
            {PRICING_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </SelectField>
          {modelMeta && <p className="mt-1 text-xs text-slate-600">{modelMeta.description}</p>}
        </div>

        <div>
          <Label htmlFor={fieldName(prefix, 'margin_pct')}>Margin %</Label>
          <Input
            id={fieldName(prefix, 'margin_pct')}
            name={fieldName(prefix, 'margin_pct')}
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
            disabled={!isStandard}
          />
        </div>
        <div>
          <Label htmlFor={fieldName(prefix, 'markup_pct')}>Markup %</Label>
          <Input
            id={fieldName(prefix, 'markup_pct')}
            name={fieldName(prefix, 'markup_pct')}
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            disabled={!isStandard}
          />
        </div>
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
    </div>
  );
}
