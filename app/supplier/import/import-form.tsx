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
  mappings: { id: string; name: string }[];
};

type PreviewItem = { sku: string; name: string; qty: number; rate: number };

export function ImportForm({ mappings }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ImportFormat>('pdf');
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
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
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  function handleFormatChange(next: ImportFormat) {
    setFormat(next);
    setPreview(null);
    setBillMeta(null);
    setFileData(null);
    setSelectedFileName(null);
    setError(null);
    setMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage(null);
    setError(null);
    setLoading(true);
    setSelectedFileName(file.name);

    const fileType = fileTypeFromFormat(format, file.name);
    const mappingEl = document.getElementById('mapping_id') as HTMLSelectElement | null;
    const mappingId =
      fileType === 'pdf' || fileType === 'xml'
        ? undefined
        : mappingEl?.value || mappings[0]?.id || DEFAULT_TALLY_MAPPING_ID;

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
        mappingId,
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
      setFileData({ fileName: file.name, fileType, fileContent, mappingId });
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!fileData) return;
    setLoading(true);
    setError(null);
    const result = await importTallyBill(fileData);
    setLoading(false);
    if (result.ok) {
      setMessage(`Imported ${result.data.itemCount} items successfully`);
      setPreview(null);
      setBillMeta(null);
      setFileData(null);
      setSelectedFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <TallyImportHelp />

      <ImportFormatPicker value={format} onChange={handleFormatChange} />

      {format === 'excel' && (
        <div>
          <label className="mb-1 block text-sm font-medium">Column Mapping</label>
          <select id="mapping_id" className="h-10 w-full rounded-md border px-3 text-sm">
            {mappings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
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
          className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
        />
        {selectedFileName && (
          <p className="mt-2 text-xs text-muted-foreground">Selected: {selectedFileName}</p>
        )}
        {format === 'pdf' && (
          <p className="mt-2 text-xs text-muted-foreground">
            In Tally: open voucher → Alt+P → choose &quot;Microsoft Print to PDF&quot; → save → upload here.
          </p>
        )}
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Reading file…</p>}

      {preview && billMeta && (
        <div>
          <div className="mb-3 rounded border bg-muted/30 p-3 text-sm">
            <div><span className="font-medium">Bill #:</span> {billMeta.number}</div>
            <div><span className="font-medium">Date:</span> {billMeta.date}</div>
            <div><span className="font-medium">Party:</span> {billMeta.party}</div>
            <div><span className="font-medium">Total:</span> {formatINR(billMeta.total)}</div>
          </div>
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
          <Button onClick={handleConfirm} className="mt-3" disabled={loading}>
            Confirm Import
          </Button>
        </div>
      )}
    </div>
  );
}
