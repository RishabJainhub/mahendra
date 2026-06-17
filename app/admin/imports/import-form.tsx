'use client';

import { useRef, useState } from 'react';
import { importTallyBill, previewTallyBill } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/pricing';
import { TallyImportHelp } from '@/components/tally/import-help';
import {
  ImportFormatPicker,
  acceptForFormat,
  fileTypeFromFormat,
  type ImportFormat,
} from '@/components/tally/import-format-picker';
import { DEFAULT_TALLY_MAPPING_ID } from '@/lib/tally/constants';

type Props = {
  suppliers: { id: string; name: string }[];
  mappings: { id: string; name: string }[];
};

export function ImportForm({ suppliers, mappings }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ImportFormat>('pdf');
  const [supplierId, setSupplierId] = useState('');
  const [mappingId, setMappingId] = useState(mappings[0]?.id ?? DEFAULT_TALLY_MAPPING_ID);
  const [preview, setPreview] = useState<{ sku: string; name: string; qty: number; rate: number }[] | null>(null);
  const [billMeta, setBillMeta] = useState<{ number: string; date: string; party: string; total: number } | null>(null);
  const [fileData, setFileData] = useState<{
    fileName: string;
    fileType: 'pdf' | 'xml' | 'xlsx' | 'xls';
    fileContent: string;
    mappingId?: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleFormatChange(next: ImportFormat) {
    setFormat(next);
    setPreview(null);
    setBillMeta(null);
    setFileData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!supplierId) {
      setError('Select a supplier first');
      return;
    }

    setMessage(null);
    setError(null);
    setLoading(true);

    const fileType = fileTypeFromFormat(format, file.name);
    const effectiveMapping = fileType === 'pdf' || fileType === 'xml' ? undefined : mappingId;

    try {
      let fileContent: string;
      if (fileType === 'xml') {
        fileContent = await file.text();
      } else {
        fileContent = Buffer.from(await file.arrayBuffer()).toString('base64');
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

  async function handleConfirm() {
    if (!fileData || !supplierId) return;
    setLoading(true);
    const result = await importTallyBill({ ...fileData, supplierId });
    setLoading(false);
    if (result.ok) {
      setMessage(`Imported bill with ${result.data.itemCount} items`);
      setPreview(null);
      setBillMeta(null);
      setFileData(null);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <TallyImportHelp />

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
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <ImportFormatPicker value={format} onChange={handleFormatChange} />

      {format === 'excel' && (
        <div>
          <label className="mb-1 block text-sm font-medium">Column Mapping</label>
          <select
            value={mappingId}
            onChange={(e) => setMappingId(e.target.value)}
            className="h-10 w-full rounded-md border px-3 text-sm"
          >
            {mappings.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-6">
        <label className="mb-2 block text-sm font-semibold">
          {format === 'pdf' && 'Upload Tally invoice PDF'}
          {format === 'xml' && 'Upload Tally XML export'}
          {format === 'excel' && 'Upload Tally Excel file'}
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptForFormat(format)}
          onChange={handleFileChange}
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
        />
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Reading file…</p>}

      {preview && billMeta && (
        <div>
          <div className="mb-3 rounded border bg-muted/30 p-3 text-sm">
            <div>Bill #: {billMeta.number}</div>
            <div>Date: {billMeta.date}</div>
            <div>Party: {billMeta.party}</div>
            <div>Total: {formatINR(billMeta.total)}</div>
          </div>
          <Button onClick={handleConfirm} disabled={loading}>
            Confirm Import ({preview.length} items)
          </Button>
        </div>
      )}
    </div>
  );
}
