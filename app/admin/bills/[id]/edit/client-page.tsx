'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateManualBill, type BillForEdit } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD, TFoot } from '@/components/ui/table';
import { formatINR } from '@/lib/pricing';
import { cn } from '@/lib/utils';
import { FileText, ListChecks, Plus, Trash2, Save, X, AlertCircle, Lock } from 'lucide-react';

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

function rowAmount(row: ItemRow): number {
  return Number(row.qty || 0) * Number(row.rate || 0);
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
    <form onSubmit={handleSubmit} className="max-w-5xl space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Bill details
          </CardTitle>
          <CardDescription>Fix mistakes from manual entry. MA/DNA prices are recomputed automatically on save.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="supplier" className="text-xs font-medium text-muted-foreground">Supplier</Label>
              <div className="flex h-10 w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                <span className="truncate">{supplier?.name ?? 'Unknown'}</span>
              </div>
              <p className="text-xs text-muted-foreground">Supplier can&apos;t be changed after creation.</p>
            </div>
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
              <CardDescription className="mt-1">Update each item on the bill. Amount = Qty × Rate.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add row
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH className="w-10">#</TH>
                  <TH>Description</TH>
                  <TH>HSN</TH>
                  <TH align="right">Qty</TH>
                  <TH align="right">Rate</TH>
                  <TH align="right">Amount</TH>
                  <TH className="w-12"></TH>
                </TR>
              </THead>
              <TBody>
                {items.map((row, idx) => (
                  <TR key={row.id}>
                    <TD className="text-xs text-muted-foreground">{idx + 1}</TD>
                    <TD>
                      <Input
                        value={row.description}
                        onChange={(e) => updateItem(row.id, 'description', e.target.value)}
                        placeholder="Item name"
                        className="h-9"
                      />
                    </TD>
                    <TD>
                      <Input
                        value={row.hsn}
                        onChange={(e) => updateItem(row.id, 'hsn', e.target.value)}
                        placeholder="540741"
                        className="h-9 w-28 font-mono"
                      />
                    </TD>
                    <TD>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={row.qty}
                        onChange={(e) => updateItem(row.id, 'qty', e.target.value)}
                        className="h-9 w-20 text-right ml-auto"
                      />
                    </TD>
                    <TD>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.rate}
                        onChange={(e) => updateItem(row.id, 'rate', e.target.value)}
                        className="h-9 w-28 text-right ml-auto"
                      />
                    </TD>
                    <TD align="right">
                      <div className="flex h-9 w-28 items-center justify-end rounded-md border border-border bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground ml-auto">
                        {rowAmount(row).toFixed(2)}
                      </div>
                    </TD>
                    <TD>
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
                    </TD>
                  </TR>
                ))}
              </TBody>
              <TFoot>
                <TR>
                  <TD colSpan={5} align="right" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Subtotal
                  </TD>
                  <TD align="right" className="text-base font-semibold tabular-nums">
                    {formatINR(subtotal)}
                  </TD>
                  <TD></TD>
                </TR>
              </TFoot>
            </Table>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className={cn(
        'sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-6 py-3 backdrop-blur'
      )}>
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
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
