'use client';

import { useState } from 'react';
import { upsertLayout, deleteLayout } from '@/app/actions/layouts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Layout = {
  id: string;
  name: string;
  grid_cols: number;
  label_w: number;
  label_h: number;
  include_fields: string[];
};

export function LayoutClient({ layouts }: { layouts: Layout[] }) {
  const [editing, setEditing] = useState<Layout | null>(null);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sticker Layouts</h1>
        <Button onClick={() => setEditing({ id: '', name: '', grid_cols: 3, label_w: 50, label_h: 25, include_fields: ['sku', 'name', 'barcode'] })}>
          Add Layout
        </Button>
      </div>

      <div className="space-y-3">
        {layouts.map((layout) => (
          <div key={layout.id} className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="font-medium">{layout.name}</div>
              <div className="text-sm text-muted-foreground">
                {layout.grid_cols} cols · {layout.label_w}×{layout.label_h}mm
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="cursor-pointer"
                aria-label={`Edit ${layout.name}`}
                onClick={() => setEditing(layout)}
              >
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="cursor-pointer"
                aria-label={`Delete ${layout.name}`}
                onClick={async () => { await deleteLayout(layout.id); }}
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">{editing.id ? 'Edit Layout' : 'Add Layout'}</h2>
            <form action={async (fd) => { await upsertLayout(fd); setEditing(null); }} className="space-y-3">
              {editing.id && <input type="hidden" name="id" value={editing.id} />}
              <Input name="name" placeholder="Name" defaultValue={editing.name} required />
              <Input name="grid_cols" type="number" placeholder="Grid Columns" defaultValue={editing.grid_cols} />
              <Input name="label_w" type="number" step="0.01" placeholder="Label Width (mm)" defaultValue={editing.label_w} />
              <Input name="label_h" type="number" step="0.01" placeholder="Label Height (mm)" defaultValue={editing.label_h} />
              <Input name="include_fields" placeholder='Fields JSON' defaultValue={JSON.stringify(editing.include_fields)} />
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
