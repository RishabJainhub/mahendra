'use client';

import { useState } from 'react';
import { upsertItem } from '@/app/actions/items';
import { formatINR } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/empty-state';
import { Package, Plus, Pencil } from 'lucide-react';

type Item = {
  id: string;
  sku: string;
  name: string;
  hsn: string | null;
  base_rate: number;
  mrp: number;
  gst_rate: number;
};

const EMPTY_ITEM: Item = { id: '', sku: '', name: '', hsn: '', base_rate: 0, mrp: 0, gst_rate: 5 };

export function ItemsClient({ items }: { items: Item[] }) {
  const [editing, setEditing] = useState<Item | null>(null);

  return (
    <div>
      <PageHeader title="Items catalogue" description="SKUs available for line-item entry.">
        <Button onClick={() => setEditing(EMPTY_ITEM)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add item
        </Button>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="No items yet"
          description="Add an item to reuse it on manual bills."
          actionLabel="Add item"
          onAction={() => setEditing(EMPTY_ITEM)}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <THead>
              <TR>
                <TH>SKU</TH>
                <TH>Name</TH>
                <TH>HSN</TH>
                <TH align="right">Base rate</TH>
                <TH align="right">MRP</TH>
                <TH align="right">GST%</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((item) => (
                <TR key={item.id}>
                  <TD className="font-mono text-xs">{item.sku}</TD>
                  <TD className="font-medium">{item.name}</TD>
                  <TD className="font-mono text-xs text-muted-foreground">{item.hsn ?? '—'}</TD>
                  <TD align="right" className="tabular-nums">{formatINR(Number(item.base_rate))}</TD>
                  <TD align="right" className="tabular-nums">{formatINR(Number(item.mrp))}</TD>
                  <TD align="right" className="tabular-nums">{item.gst_rate}%</TD>
                  <TD align="right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={`Edit ${item.name}`}
                      onClick={() => setEditing(item)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{editing.id ? 'Edit item' : 'Add item'}</h2>
            <form action={async (fd) => { await upsertItem(fd); setEditing(null); }} className="space-y-3">
              {editing.id && <input type="hidden" name="id" value={editing.id} />}
              <div className="space-y-1.5">
                <Label htmlFor="sku" className="text-xs font-medium text-muted-foreground">SKU</Label>
                <Input id="sku" name="sku" placeholder="SKU" defaultValue={editing.sku} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Name</Label>
                <Input id="name" name="name" placeholder="Name" defaultValue={editing.name} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hsn" className="text-xs font-medium text-muted-foreground">HSN</Label>
                <Input id="hsn" name="hsn" placeholder="HSN" defaultValue={editing.hsn ?? ''} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="base_rate" className="text-xs font-medium text-muted-foreground">Base rate</Label>
                  <Input id="base_rate" name="base_rate" type="number" step="0.01" defaultValue={editing.base_rate} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mrp" className="text-xs font-medium text-muted-foreground">MRP</Label>
                  <Input id="mrp" name="mrp" type="number" step="0.01" defaultValue={editing.mrp} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gst_rate" className="text-xs font-medium text-muted-foreground">GST %</Label>
                  <Input id="gst_rate" name="gst_rate" type="number" step="0.01" defaultValue={editing.gst_rate} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit">Save</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
