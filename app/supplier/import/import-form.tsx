'use client';

import { useEffect, useState } from 'react';
import { importTallyBill, previewTallyBill } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { formatINR } from '@/lib/pricing';
import { TallyImportHelp } from '@/components/tally/import-help';
import { DEFAULT_TALLY_MAPPING_ID } from '@/lib/tally/constants';
import { arrayBufferToBase64 } from '@/lib/file-utils';
import {
  uploadTallyFileToStorage,
  deleteTallyUploadFromClient,
  TALLY_INLINE_MAX_BYTES,
} from '@/lib/tally/upload';
import { FileInput, Upload, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, X } from 'lucide-react';

type DuplicateBill = {
  existingBillId: string;
  billNumber: string;
  supplierName: string;
};

type FileType = 'xml' | 'xlsx' | 'xls' | 'pdf';

type Props = {
  mappings: { id: string; name: string }[];
};

type PreviewItem = { sku: string; name: string; qty: number; rate: number };

function detectFileType(fileName: string): FileType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.xls')) return 'xls';
  return 'xlsx';
}

type PreparedFile =
  | { fileName: string; fileType: FileType; fileContent: string; mappingId?: string; storagePath?: string }
  | { fileName: string; fileType: FileType; fileContent?: string; storagePath: string; mappingId?: string };

export function ImportForm({ mappings }: Props) {
  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [billMeta, setBillMeta] = useState<{ number: string; date: string; party: string; total: number } | null>(null);
  const [fileData, setFileData] = useState<PreparedFile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateBill | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  // Clean up any pending Storage upload when the component unmounts.
  useEffect(() => {
    return () => {
      const pending = fileData;
      if (pending && 'storagePath' in pending && pending.storagePath) {
        void deleteTallyUploadFromClient(pending.storagePath);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setMessage(null);
    setError(null);
    setDuplicate(null);
    setLoading(true);
    setUploadProgress(null);

    const fileType = detectFileType(file.name);
    const mappingEl = document.getElementById('mapping_id') as HTMLSelectElement | null;
    const mappingId =
      fileType === 'pdf' || fileType === 'xml'
        ? undefined
        : mappingEl?.value || mappings[0]?.id || DEFAULT_TALLY_MAPPING_ID;

    try {
      // Delete any previous pending upload so the bucket only ever holds the
      // currently-previewed file.
      const prev = fileData;
      if (prev && 'storagePath' in prev && prev.storagePath) {
        void deleteTallyUploadFromClient(prev.storagePath);
      }

      let prepared: PreparedFile;
      if (file.size > TALLY_INLINE_MAX_BYTES) {
        setUploadProgress(
          `Uploading ${(file.size / 1024 / 1024).toFixed(1)} MB to secure storage…`
        );
        const { path } = await uploadTallyFileToStorage(file);
        setUploadProgress('Reading file…');
        prepared = { fileName: file.name, fileType, storagePath: path, mappingId };
      } else {
        setUploadProgress('Reading file…');
        const fileContent =
          fileType === 'xml'
            ? await file.text()
            : arrayBufferToBase64(await file.arrayBuffer());
        prepared = { fileName: file.name, fileType, fileContent, mappingId };
      }

      const result = await previewTallyBill(prepared);

      if (!result.ok) {
        setError(result.error);
        setPreview(null);
        setBillMeta(null);
        // Roll back the upload if preview failed.
        if ('storagePath' in prepared && prepared.storagePath) {
          void deleteTallyUploadFromClient(prepared.storagePath);
        }
        setFileData(null);
        return;
      }

      setPreview(result.data.items);
      setBillMeta(result.data.bill);
      setFileData(prepared);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this file.');
      setFileData(null);
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  }

  async function runImport(replaceExisting: boolean) {
    if (!fileData) return;
    setLoading(true);
    setError(null);
    const result = await importTallyBill({ ...fileData, replaceExisting });
    setLoading(false);
    if (result.ok) {
      setMessage(
        result.data.replaced
          ? `Replaced existing bill — imported ${result.data.itemCount} items`
          : `Imported ${result.data.itemCount} items successfully`
      );
      setPreview(null);
      setBillMeta(null);
      // Server already deleted the storage object; clear local reference.
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

  const showMapping = !fileData || fileData.fileType === 'xlsx' || fileData.fileType === 'xls';

  return (
    <div className="max-w-3xl space-y-6">
      <TallyImportHelp />

      {message && (
        <div className="flex items-start gap-2 rounded-md border border-l-4 border-l-primary border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-l-4 border-l-destructive border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {duplicate && (
        <div className="rounded-md border border-l-4 border-l-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Bill {duplicate.billNumber} already exists.
          </p>
          <p className="mt-1 text-amber-900">
            Open the existing bill, or replace it to re-import this file. Replacing deletes the existing bill and its line items.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ButtonLink href={`/supplier/print?billId=${duplicate.existingBillId}`} variant="outline" size="sm">
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Open existing bill
            </ButtonLink>
            <Button type="button" variant="destructive" size="sm" onClick={handleReplace} disabled={loading}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              {loading ? 'Replacing…' : 'Replace existing'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDuplicate(null)} disabled={loading}>
              <X className="mr-1.5 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-muted-foreground" />
            Upload Tally file
          </CardTitle>
          <CardDescription>Choose a PDF, XML, or Excel export from TallyPrime.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {showMapping && (
            <div className="space-y-1.5">
              <Label htmlFor="mapping_id" className="text-xs font-medium text-muted-foreground">Column Mapping</Label>
              <Select id="mapping_id" defaultValue={mappings[0]?.id ?? DEFAULT_TALLY_MAPPING_ID}>
                {mappings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tally_file" className="text-xs font-medium text-muted-foreground">Tally File</Label>
            <input
              id="tally_file"
              type="file"
              accept=".xml,.xlsx,.xls,.pdf,application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-950 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            <p className="text-xs text-muted-foreground">PDF, XML, or Excel (.xlsx / .xls). Files up to 50 MB are uploaded to secure storage.</p>
          </div>
          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {uploadProgress ?? 'Reading file…'}
            </p>
          )}
        </CardContent>
      </Card>

      {preview && billMeta && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileInput className="h-4 w-4 text-muted-foreground" />
              Preview
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {preview.length} items
              </span>
            </CardTitle>
            <CardDescription>Review the parsed bill before confirming the import.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
              <div><span className="text-muted-foreground">Bill #:</span> <span className="font-medium">{billMeta.number}</span></div>
              <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{billMeta.date}</span></div>
              <div><span className="text-muted-foreground">Party:</span> <span className="font-medium">{billMeta.party}</span></div>
              <div><span className="text-muted-foreground">Total:</span> <span className="font-medium">{formatINR(billMeta.total)}</span></div>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <Table>
                <THead>
                  <TR>
                    <TH>SKU</TH>
                    <TH>Name</TH>
                    <TH align="right">Qty</TH>
                    <TH align="right">Rate</TH>
                  </TR>
                </THead>
                <TBody>
                  {preview.map((item, i) => (
                    <TR key={i}>
                      <TD className="font-mono text-xs">{item.sku}</TD>
                      <TD>{item.name}</TD>
                      <TD align="right">{item.qty}</TD>
                      <TD align="right">{formatINR(item.rate)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleConfirm} disabled={loading}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Confirm Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
