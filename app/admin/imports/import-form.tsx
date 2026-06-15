'use client';

import { useState } from 'react';
import { importTallyBill } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';

type Props = {
  suppliers: { id: string; name: string }[];
  mappings: { id: string; name: string }[];
};

export function ImportForm({ suppliers, mappings }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get('file') as File;
    const supplierId = String(fd.get('supplier_id'));
    const mappingId = String(fd.get('mapping_id'));
    const fileType = file.name.endsWith('.xml') ? 'xml' : file.name.endsWith('.xls') ? 'xls' : 'xlsx';

    let fileContent: string;
    if (fileType === 'xml') {
      fileContent = await file.text();
    } else {
      const buffer = await file.arrayBuffer();
      fileContent = Buffer.from(buffer).toString('base64');
    }

    const result = await importTallyBill({
      fileName: file.name,
      fileType,
      fileContent,
      mappingId,
      supplierId,
    });

    if (result.ok) {
      setMessage(`Imported bill with ${result.data.itemCount} items`);
      form.reset();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <label className="mb-1 block text-sm font-medium">Supplier</label>
        <select name="supplier_id" required className="h-10 w-full rounded-md border px-3 text-sm">
          <option value="">Select supplier</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Column Mapping</label>
        <select name="mapping_id" required className="h-10 w-full rounded-md border px-3 text-sm">
          {mappings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Tally File (.xml, .xlsx, .xls)</label>
        <input type="file" name="file" accept=".xml,.xlsx,.xls" required className="text-sm" />
      </div>
      <Button type="submit">Import</Button>
    </form>
  );
}
