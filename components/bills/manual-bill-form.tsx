'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createManualBill } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Trash2, Save, X, FileText, ListChecks } from 'lucide-react';
import { formatINR } from '@/lib/pricing';
import { cn } from '@/lib/utils';

type Supplier = { id: string; name: string };

type ItemRow = {
  id: number;
  description: string;
  hsn: string;
  qty: string;
  rate: string;
};

type Props = {
  suppliers?: Supplier[];
  fixedSupplierId?: string;
  billDetailBase: string;
};

function nextId(n: number): number {
  return n + 1;
}

function rowAmount(row: ItemRow): number {
  return Number(row.qty || 0) * Number(row.rate || 0);
}

export function ManualBillForm({ suppliers = [], fixedSupplierId, billDetailBase }: Props) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(fixedSupplierId ?? suppliers[0]?.id ?? '');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<ItemRow[]>([
    { id: 1, description: '', hsn: '', qty: '1', rate: '0' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedSupplierId = fixedSupplierId ?? supplierId;
  const showSupplierPicker = !fixedSupplierId && suppliers.length > 0;

  const subtotal = items.reduce((sum, r) => sum + rowAmount(r), 0);
  const validItemCount = items.filter((r) => r.description.trim() && Number(r.qty) > 0).length;

  function updateItem(id: number, field: keyof ItemRow, value: string) {
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setItems((rows) => [
      ...rows,
      { id: nextId(rows[rows.length - 1]?.id ?? 0), description: '', hsn: '', qty: '1', rate: '0' },
    ]);
  }

  function removeRow(id: number) {
    setItems((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const cleanItems = items
      .filter((r) => r.description.trim() && Number(r.qty) > 0)
      .map((r) => ({
        description: r.description.trim(),
        hsn: r.hsn.trim() || undefined,
        qty: Number(r.qty),
        rate: Number(r.rate),
      }));

    if (!resolvedSupplierId) {
      setError('Select a supplier');
      setSaving(false);
      return;
    }
    if (!billNumber.trim()) {
      setError('Enter a bill number');
      setSaving(false);
      return;
    }
    if (cleanItems.length === 0) {
      setError('Add at least one line item with a description and qty');
      setSaving(false);
      return;
    }

    const result = await createManualBill({
      supplierId: resolvedSupplierId,
      billNumber: billNumber.trim(),
      billDate,
      items: cleanItems,
    });

    setSaving(false);
    if (result.ok) {
      router.push(`${billDetailBase}${result.data.billId}`);
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl space-y-6">
      {/* Bill details card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Bill details
          </CardTitle>
          <CardDescription>Identify the bill. MA/DNA prices compute automatically on save.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cn('grid gap-4', showSupplierPicker ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            {showSupplierPicker && (
              <div className="space-y-1.5">
                <Label htmlFor="supplier" className="text-xs font-medium text-muted-foreground">Supplier</Label>
                <select
                  id="supplier"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  required
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="billNumber" className="text-xs font-medium text-muted-foreground">Bill number</Label>
              <Input
                id="billNumber"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder="e.g. 1933/26-27"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billDate" className="text-xs font-medium text-muted-foreground">Bill date</Label>
              <Input
                id="billDate"
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line items card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                Line items
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {validItemCount} of {items.length}
                </span>
              </CardTitle>
              <CardDescription className="mt-1">Add each item on the bill. Amount = Qty × Rate.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add row
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-left font-medium">#</th>
                  <th className="px-3 py-2.5 text-left font-medium">Description</th>
                  <th className="px-3 py-2.5 text-left font-medium">HSN</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rate</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="w-12 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 align-middle text-xs text-muted-foreground">{idx + 1}</td>
                    <td className="px-3 py-2 align-middle">
                      <Input
                        value={row.description}
                        onChange={(e) => updateItem(row.id, 'description', e.target.value)}
                        placeholder="Item name"
                        className="h-9"
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <Input
                        value={row.hsn}
                        onChange={(e) => updateItem(row.id, 'hsn', e.target.value)}
                        placeholder="540741"
                        className="h-9 w-28 font-mono"
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={row.qty}
                        onChange={(e) => updateItem(row.id, 'qty', e.target.value)}
                        className="h-9 w-20 text-right ml-auto"
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.rate}
                        onChange={(e) => updateItem(row.id, 'rate', e.target.value)}
                        className="h-9 w-28 text-right ml-auto"
                      />
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      <div className="flex h-9 w-28 items-center justify-end rounded-md border border-border bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground ml-auto">
                        {rowAmount(row).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(row.id)}
                        disabled={items.length === 1}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30">
                  <td colSpan={5} className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Subtotal
                  </td>
                  <td className="px-3 py-3 text-right text-base font-semibold tabular-nums">
                    {formatINR(subtotal)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div className="text-sm text-muted-foreground">
          {validItemCount > 0 ? (
            <span><span className="font-medium text-foreground">{validItemCount}</span> item{validItemCount !== 1 ? 's' : ''} · <span className="font-medium text-foreground">{formatINR(subtotal)}</span></span>
          ) : (
            <span>Add at least one item to save</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            <X className="mr-1.5 h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" disabled={saving || validItemCount === 0}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? 'Saving…' : 'Save bill'}
          </Button>
        </div>
      </div>
    </form>
  );
}
