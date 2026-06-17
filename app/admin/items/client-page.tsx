'use client';

import { useState } from 'react';
import { upsertItem } from '@/app/actions/items';
import { formatINR } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Item = {
  id: string;
  sku: string;
  name: string;
  hsn: string | null;
  base_rate: number;
  mrp: number;
  gst_rate: number;
};

export function ItemsClient({ items }: { items: Item[] }) {
  const [editing, setEditing] = useState<Item | null>(null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Items Catalogue</h1>
        <Button onClick={() => setEditing({ id: '', sku: '', name: '', hsn: '', base_rate: 0, mrp: 0, gst_rate: 5 })}>
          Add Item
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">SKU</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">HSN</th>
              <th className="px-4 py-3 text-right">Base Rate</th>
              <th className="px-4 py-3 text-right">MRP</th>
              <th className="px-4 py-3 text-right">GST%</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3">{item.sku}</td>
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3">{item.hsn}</td>
                <td className="px-4 py-3 text-right">{formatINR(Number(item.base_rate))}</td>
                <td className="px-4 py-3 text-right">{formatINR(Number(item.mrp))}</td>
                <td className="px-4 py-3 text-right">{item.gst_rate}%</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="cursor-pointer"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => setEditing(item)}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">{editing.id ? 'Edit Item' : 'Add Item'}</h2>
            <form action={async (fd) => { await upsertItem(fd); setEditing(null); }} className="space-y-3">
              {editing.id && <input type="hidden" name="id" value={editing.id} />}
              <Input name="sku" placeholder="SKU" defaultValue={editing.sku} required />
              <Input name="name" placeholder="Name" defaultValue={editing.name} required />
              <Input name="hsn" placeholder="HSN" defaultValue={editing.hsn ?? ''} />
              <Input name="base_rate" type="number" step="0.01" placeholder="Base Rate" defaultValue={editing.base_rate} />
              <Input name="mrp" type="number" step="0.01" placeholder="MRP" defaultValue={editing.mrp} />
              <Input name="gst_rate" type="number" step="0.01" placeholder="GST %" defaultValue={editing.gst_rate} />
              <div className="flex gap-2">
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
