'use client';

import { useState } from 'react';
import Link from 'next/link';
import { importTallyBill, previewTallyBill } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/pricing';
import { DEFAULT_TALLY_MAPPING_ID } from '@/lib/tally/constants';
import { arrayBufferToBase64 } from '@/lib/file-utils';

type DuplicateBill = {
  existingBillId: string;
  billNumber: string;
  supplierName: string;
};

type FileType = 'xml' | 'xlsx' | 'xls' | 'pdf';

type Props = {
  suppliers: { id: string; name: string }[];
  mappings: { id: string; name: string }[];
};

function detectFileType(fileName: string): FileType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.xls')) return 'xls';
  return 'xlsx';
}

export function ImportForm({ suppliers, mappings }: Props) {
  const [supplierId, setSupplierId] = useState('');
  const [mappingId, setMappingId] = useState(mappings[0]?.id ?? DEFAULT_TALLY_MAPPING_ID);
  const [preview, setPreview] = useState<{ sku: string; name: string; qty: number; rate: number }[] | null>(null);
  const [billMeta, setBillMeta] = useState<{ number: string; date: string; party: string; total: number } | null>(null);
  const [fileData, setFileData] = useState<{
    fileName: string;
    fileType: FileType;
    fileContent: string;
    mappingId?: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateBill | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!supplierId) {
      setError('Select a supplier first');
      return;
    }

    setMessage(null);
    setError(null);
    setDuplicate(null);
    setLoading(true);

    const fileType = detectFileType(file.name);
    const effectiveMapping =
      fileType === 'pdf' || fileType === 'xml' ? undefined : mappingId;

    try {
      let fileContent: string;
      if (fileType === 'xml') {
        fileContent = await file.text();
      } else {
        fileContent = arrayBufferToBase64(await file.arrayBuffer());
      }

      const result = await previewTallyBill({
        fileName: file.name,
        fileType,
        fileContent,
        mappingId: effectiveMapping,
      });

      if (!result.ok) {
        setError(result.error);
        setPreview(null);
        setBillMeta(null);
        setFileData(null);
        return;
      }

      setPreview(result.data.items);
      setBillMeta(result.data.bill);
      setFileData({ fileName: file.name, fileType, fileContent, mappingId: effectiveMapping });
    } finally {
      setLoading(false);
    }
  }

  async function runImport(replaceExisting: boolean) {
    if (!fileData || !supplierId) return;
    setLoading(true);
    setError(null);
    const result = await importTallyBill({ ...fileData, supplierId, replaceExisting });
    setLoading(false);
    if (result.ok) {
      setMessage(
        result.data.replaced
          ? `Replaced existing bill — imported ${result.data.itemCount} items`
          : `Imported bill with ${result.data.itemCount} items`
      );
      setPreview(null);
      setBillMeta(null);
      setFileData(null);
      setDuplicate(null);
    } else if (result.code === 'DUPLICATE_BILL' && result.meta?.existingBillId) {
      setDuplicate({
        existingBillId: String(result.meta.existingBillId),
        billNumber: String(result.meta.billNumber ?? billMeta?.number ?? ''),
        supplierName: String(result.meta.supplierName ?? ''),
      });
    } else {
      setError(result.error);
    }
  }

  function handleConfirm() {
    setDuplicate(null);
    void runImport(false);
  }

  function handleReplace() {
    void runImport(true);
  }

  return (
    <div className="max-w-2xl space-y-4">
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {duplicate && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">
            Bill {duplicate.billNumber} already exists
            {duplicate.supplierName ? ` for ${duplicate.supplierName}` : ''}.
          </p>
          <p className="mt-1 text-amber-900">
            Open the existing bill, or replace it to re-import this file.
            Replacing deletes the existing bill and its line items.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/admin/bills/${duplicate.existingBillId}`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
            >
              Open existing bill
            </Link>
            <Button
              type="button"
              variant="destructive"
              onClick={handleReplace}
              disabled={loading}
            >
              {loading ? 'Replacing…' : 'Replace existing'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDuplicate(null)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Supplier</label>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          required
          className="h-10 w-full rounded-md border px-3 text-sm"
        >
          <option value="">Select supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Column Mapping</label>
        <select
          value={mappingId}
          onChange={(e) => setMappingId(e.target.value)}
          className="h-10 w-full rounded-md border px-3 text-sm"
        >
          {mappings.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Tally File</label>
        <input
          type="file"
          accept=".xml,.xlsx,.xls,.pdf,application/pdf"
          onChange={handleFileChange}
          className="text-sm"
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Reading file…</p>}

      {preview && billMeta && (
        <div>
          <div className="mb-3 rounded-md border bg-muted/30 p-3 text-sm">
            <div>Bill #: {billMeta.number}</div>
            <div>Date: {billMeta.date}</div>
            <div>Party: {billMeta.party}</div>
            <div>Total: {formatINR(billMeta.total)}</div>
          </div>
          <h3 className="mb-2 font-medium">Preview ({preview.length} items)</h3>
          <div className="max-h-64 overflow-auto rounded-md border">
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
          <Button onClick={handleConfirm} disabled={loading} className="mt-3">
            Confirm Import
          </Button>
        </div>
      )}
    </div>
  );
}
