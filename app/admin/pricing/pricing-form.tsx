'use client';

import { upsertPricingRule } from '@/app/actions/suppliers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Rule = {
  model: string;
  margin_pct: number;
  markup_pct: number;
  gst_pct: number;
};

export function PricingForm({ supplierId, supplierName, rule }: { supplierId: string; supplierName: string; rule?: Rule }) {
  async function handleSubmit(formData: FormData) {
    await upsertPricingRule(formData);
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-4">
      <h3 className="mb-3 font-medium">{supplierName}</h3>
      <input type="hidden" name="supplier_id" value={supplierId} />
      <div className="grid gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm">Model</label>
          <select name="model" defaultValue={rule?.model ?? 'company151'} className="h-10 w-full rounded-md border px-3 text-sm">
            <option value="standard">Standard</option>
            <option value="company151">Company 151</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm">Margin %</label>
          <Input name="margin_pct" type="number" step="0.01" defaultValue={rule?.margin_pct ?? 0} />
        </div>
        <div>
          <label className="mb-1 block text-sm">Markup %</label>
          <Input name="markup_pct" type="number" step="0.01" defaultValue={rule?.markup_pct ?? 0} />
        </div>
        <div>
          <label className="mb-1 block text-sm">GST %</label>
          <Input name="gst_pct" type="number" step="0.01" defaultValue={rule?.gst_pct ?? 5} />
        </div>
      </div>
      <Button type="submit" className="mt-3" size="sm">Save</Button>
    </form>
  );
}
