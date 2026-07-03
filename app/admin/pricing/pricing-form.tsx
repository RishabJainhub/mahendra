'use client';

import { useState } from 'react';
import { upsertPricingRule } from '@/app/actions/suppliers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PricingRuleFields } from '@/components/pricing/pricing-rule-fields';
import { IndianRupee, Save } from 'lucide-react';

type Rule = {
  ma_markup1_pct: number;
  ma_markup2_pct: number;
  dna_markup1_pct: number;
  dna_markup2_pct: number;
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
    <form action={handleSubmit}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                {supplierName}
              </CardTitle>
              <CardDescription>MA and DNA markups applied on import.</CardDescription>
            </div>
            <Button type="submit" size="sm" disabled={loading}>
              <Save className="mr-1.5 h-4 w-4" />
              {loading ? 'Saving…' : 'Save formula'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {message && <p className="mb-3 text-sm text-green-600">{message}</p>}
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <PricingRuleFields
            defaultValues={{
              ma_markup1_pct: Number(rule?.ma_markup1_pct) || 0,
              ma_markup2_pct: Number(rule?.ma_markup2_pct) || 0,
              dna_markup1_pct: Number(rule?.dna_markup1_pct) || 0,
              dna_markup2_pct: Number(rule?.dna_markup2_pct) || 0,
              gst_pct: Number(rule?.gst_pct) || 5,
            }}
          />
        </CardContent>
      </Card>
    </form>
  );
}
