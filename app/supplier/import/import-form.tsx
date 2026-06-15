'use client';

import { useState } from 'react';
import { importTallyBill } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/pricing';

type Props = {
  mappings: { id: string; name: string }[];
};

export function ImportForm({ mappings }: Props) {
  const [preview, setPreview] = useState<{ sku: string; name: string; qty: number; rate: number }[] | null>(null);
  const [fileData, setFileData] = useState<{ fileName: string; fileType: 'xml' | 'xlsx' | 'xls'; fileContent: string; mappingId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const mappingId = (document.getElementById('mapping_id') as HTMLSelectElement)?.value;
    const fileType = file.name.endsWith('.xml') ? 'xml' as const : file.name.endsWith('.xls') ? 'xls' as const : 'xlsx' as const;

    let fileContent: string;
    if (fileType === 'xml') {
      fileContent = await file.text();
      const { parseTallyXml } = await import('@/lib/tally/xml-parser');
      const result = parseTallyXml(fileContent);
      setPreview(result.items);
    } else {
      const buffer = await file.arrayBuffer();
      fileContent = Buffer.from(buffer).toString('base64');
      setPreview([{ sku: '—', name: 'Excel preview on confirm', qty: 0, rate: 0 }]);
    }

    setFileData({ fileName: file.name, fileType, fileContent, mappingId });
    setMessage(null);
    setError(null);
  }

  async function handleConfirm() {
    if (!fileData) return;
    const result = await importTallyBill(fileData);
    if (result.ok) {
      setMessage(`Imported ${result.data.itemCount} items successfully`);
      setPreview(null);
      setFileData(null);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium">Column Mapping</label>
        <select id="mapping_id" className="h-10 w-full rounded-md border px-3 text-sm">
          {mappings.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Tally File</label>
        <input type="file" accept=".xml,.xlsx,.xls" onChange={handleFileChange} className="text-sm" />
      </div>

      {preview && (
        <div>
          <h3 className="mb-2 font-medium">Preview ({preview.length} items)</h3>
          <div className="max-h-64 overflow-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{item.sku}</td>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-right">{item.qty}</td>
                    <td className="px-3 py-2 text-right">{formatINR(item.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={handleConfirm} className="mt-3">Confirm Import</Button>
        </div>
      )}
    </div>
  );
}
