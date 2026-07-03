'use client';

import { useState } from 'react';
import { upsertLayout, deleteLayout } from '@/app/actions/layouts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/empty-state';
import { LayoutTemplate, Plus, Pencil, Trash2 } from 'lucide-react';

type Layout = {
  id: string;
  name: string;
  grid_cols: number;
  label_w: number;
  label_h: number;
  include_fields: string[];
};

const EMPTY_LAYOUT: Layout = {
  id: '',
  name: '',
  grid_cols: 3,
  label_w: 50,
  label_h: 25,
  include_fields: ['sku', 'name', 'barcode'],
};

export function LayoutClient({ layouts }: { layouts: Layout[] }) {
  const [editing, setEditing] = useState<Layout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Layout | null>(null);

  async function handleSave(fd: FormData) {
    setSaving(true);
    setError(null);
    const result = await upsertLayout(fd);
    setSaving(false);
    if (result.ok) {
      setEditing(null);
    } else {
      setError(result.error);
    }
  }

  async function handleDelete(layout: Layout) {
    const result = await deleteLayout(layout.id);
    if (!result.ok) setError(result.error);
    setPendingDelete(null);
  }

  return (
    <div>
      <PageHeader
        title="Sticker layouts"
        description="Page geometry for A4 label sheets used during printing."
      >
        <Button onClick={() => setEditing(EMPTY_LAYOUT)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add layout
        </Button>
      </PageHeader>

      {layouts.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="h-10 w-10" />}
          title="No layouts yet"
          description="Add a label sheet layout to control column count and sticker size."
          actionLabel="Add layout"
          onAction={() => setEditing(EMPTY_LAYOUT)}
        />
      ) : (
        <div className="space-y-3">
          {layouts.map((layout) => (
            <Card key={layout.id}>
              <CardContent className="flex items-center justify-between p-4">
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
                    aria-label={`Edit ${layout.name}`}
                    onClick={() => { setEditing(layout); setError(null); }}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    aria-label={`Delete ${layout.name}`}
                    onClick={() => setPendingDelete(layout)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold">Delete layout?</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Delete <span className="font-medium">{pendingDelete.name}</span>? This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="destructive" onClick={() => void handleDelete(pendingDelete)}>
                Delete
              </Button>
              <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{editing.id ? 'Edit layout' : 'Add layout'}</h2>
            <form action={handleSave} className="space-y-3">
              {editing.id && <input type="hidden" name="id" value={editing.id} />}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Name</Label>
                <Input id="name" name="name" placeholder="Name" defaultValue={editing.name} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="grid_cols" className="text-xs font-medium text-muted-foreground">Columns</Label>
                  <Input id="grid_cols" name="grid_cols" type="number" defaultValue={editing.grid_cols} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="label_w" className="text-xs font-medium text-muted-foreground">Width (mm)</Label>
                  <Input id="label_w" name="label_w" type="number" step="0.01" defaultValue={editing.label_w} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="label_h" className="text-xs font-medium text-muted-foreground">Height (mm)</Label>
                  <Input id="label_h" name="label_h" type="number" step="0.01" defaultValue={editing.label_h} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="include_fields" className="text-xs font-medium text-muted-foreground">Fields (JSON)</Label>
                <Input id="include_fields" name="include_fields" placeholder='Fields JSON' defaultValue={JSON.stringify(editing.include_fields)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
