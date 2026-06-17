'use client';

import { useState } from 'react';
import { upsertPricingRule } from '@/app/actions/suppliers';
import { Button } from '@/components/ui/button';
import { PricingRuleFields } from '@/components/pricing/pricing-rule-fields';
import type { PricingModel } from '@/lib/pricing';

type Rule = {
  model: string;
  margin_pct: number;
  markup_pct: number;
  gst_pct: number;
};

export function PricingForm({
  supplierId,
  supplierName,
  rule,
}: {
  supplierId: string;
  supplierName: string;
  rule?: Rule;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setMessage(null);
    setError(null);
    formData.set('supplier_id', supplierId);
    const result = await upsertPricingRule(formData);
    setLoading(false);
    if (result.ok) {
      setMessage('Formula saved. Re-import bills to apply changes to new line items.');
    } else {
      setError(result.error);
    }
  }

  return (
    <form action={handleSubmit} className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">{supplierName}</h3>
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Saving…' : 'Save Formula'}
        </Button>
      </div>

      {message && <p className="mb-3 text-sm text-green-600">{message}</p>}
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <PricingRuleFields
        defaultValues={{
          model: (rule?.model as PricingModel) ?? 'company151',
          margin_pct: rule?.margin_pct ?? 0,
          markup_pct: rule?.markup_pct ?? 0,
          gst_pct: rule?.gst_pct ?? 5,
        }}
      />
    </form>
  );
}
