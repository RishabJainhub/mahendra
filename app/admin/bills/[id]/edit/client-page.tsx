'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateManualBill, type BillForEdit } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';

type Supplier = { id: string; name: string };

type ItemRow = {
  id: number;
  description: string;
  hsn: string;
  qty: string;
  rate: string;
};

function nextId(n: number): number {
  return n + 1;
}

export function EditBillForm({
  suppliers,
  bill,
}: {
  suppliers: Supplier[];
  bill: BillForEdit;
}) {
  const router = useRouter();
  const [billNumber, setBillNumber] = useState(bill.billNumber);
  const [billDate, setBillDate] = useState(bill.billDate);
  const [items, setItems] = useState<ItemRow[]>(
    bill.items.map((i, idx) => ({
      id: idx + 1,
      description: i.description,
      hsn: i.hsn,
      qty: String(i.qty),
      rate: String(i.rate),
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplier = suppliers.find((s) => s.id === bill.supplierId);

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

    const result = await updateManualBill({
      billId: bill.id,
      billNumber: billNumber.trim(),
      billDate,
      items: cleanItems,
    });

    setSaving(false);
    if (result.ok) {
      router.push(`/admin/bills/${result.data.billId}`);
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="supplier">Supplier</Label>
          <input
            id="supplier"
            value={supplier?.name ?? 'Unknown'}
            disabled
            className="h-10 w-full rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground"
          />
          <p className="mt-1 text-xs text-muted-foreground">Supplier can&apos;t be changed after creation.</p>
        </div>
        <div>
          <Label htmlFor="billNumber">Bill number</Label>
          <Input
            id="billNumber"
            value={billNumber}
            onChange={(e) => setBillNumber(e.target.value)}
            placeholder="e.g. 1933/26-27"
            required
          />
        </div>
        <div>
          <Label htmlFor="billDate">Bill date</Label>
          <Input
            id="billDate"
            type="date"
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Line items</h2>
          <Button type="button" variant="outline" onClick={addRow}>+ Add row</Button>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-left">HSN</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Rate</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <Input
                      value={row.description}
                      onChange={(e) => updateItem(row.id, 'description', e.target.value)}
                      placeholder="Item name"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={row.hsn}
                      onChange={(e) => updateItem(row.id, 'hsn', e.target.value)}
                      placeholder="540741"
                      className="w-28"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={row.qty}
                      onChange={(e) => updateItem(row.id, 'qty', e.target.value)}
                      className="w-20 text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={row.rate}
                      onChange={(e) => updateItem(row.id, 'rate', e.target.value)}
                      className="w-28 text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {(Number(row.qty) * Number(row.rate)).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeRow(row.id)}
                      disabled={items.length === 1}
                      className="h-8 px-2 text-destructive"
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
