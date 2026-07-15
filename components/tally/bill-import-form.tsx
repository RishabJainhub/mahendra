'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { importTallyBill, previewTallyBill } from '@/app/actions/bills';
import { getSupplierDefaultImportFormat, saveSupplierDefaultImportFormat } from '@/app/actions/supplier-defaults';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { BillPrintModal } from '@/components/pdf/bill-print-modal';
import { FileDropZone } from '@/components/tally/file-drop-zone';
import { TallyImportHelp } from '@/components/tally/import-help';
import { formatINR } from '@/lib/pricing';
import { DEFAULT_TALLY_MAPPING_ID } from '@/lib/tally/constants';
import {
  prepareImportFile,
  isSpreadsheet,
  detectImportFileType,
  type PreparedImportFile,
} from '@/lib/tally/prepare-file';
import { deleteTallyUploadFromClient } from '@/lib/tally/upload';
import { FileInput, Printer, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, X } from 'lucide-react';

type PreviewItem = {
  sku: string;
  name: string;
  hsn: string | null;
  qty: number;
  rate: number;
  ma: number | null;
  dna: number | null;
};

type DuplicateBill = {
  existingBillId: string;
  billNumber: string;
  supplierName?: string;
};

type QueueStatus = 'pending' | 'processing' | 'imported' | 'replaced' | 'duplicate' | 'error' | 'skipped';

type QueueItem = {
  key: string;
  file: File;
  status: QueueStatus;
  detail?: string;
  billId?: string;
  supplierId?: string;
  supplierName?: string;
};

export type BillImportFormProps = {
  mappings: { id: string; name: string }[];
  /** Admin: pick or auto-detect supplier. Supplier portal: fixed to logged-in supplier. */
  mode: 'admin' | 'supplier';
  suppliers?: { id: string; name: string }[];
  fixedSupplierId?: string;
  initialSupplierId?: string;
  existingBillHref: (billId: string) => string;
  showImportHelp?: boolean;
};

function isColumnDetectError(msg: string): boolean {
  return /column|spreadsheet|header/i.test(msg);
}

export function BillImportForm({
  mappings,
  mode,
  suppliers = [],
  fixedSupplierId,
  initialSupplierId,
  existingBillHref,
  showImportHelp = false,
}: BillImportFormProps) {
  const router = useRouter();
  const isAdmin = mode === 'admin';
  const [supplierId, setSupplierId] = useState(fixedSupplierId ?? initialSupplierId ?? '');
  const [supplierAutoDetected, setSupplierAutoDetected] = useState(false);
  const [mappingId, setMappingId] = useState(mappings[0]?.id ?? DEFAULT_TALLY_MAPPING_ID);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [preview, setPreview] = useState<PreviewItem[] | null>(null);
  const [billMeta, setBillMeta] = useState<{ number: string; date: string; party: string; total: number } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<PreparedImportFile | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateBill | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  const [lastImportedBillId, setLastImportedBillId] = useState<string | null>(null);
  const [printBillId, setPrintBillId] = useState<string | null>(null);

  const effectiveSupplierId = isAdmin ? supplierId : fixedSupplierId;

  useEffect(() => {
    if (fixedSupplierId) setSupplierId(fixedSupplierId);
  }, [fixedSupplierId]);

  useEffect(() => {
    if (!effectiveSupplierId) return;
    let cancelled = false;
    (async () => {
      const result = await getSupplierDefaultImportFormat(effectiveSupplierId);
      if (cancelled || !result.ok || !result.data) return;
      if (result.data.mapping_id) setMappingId(result.data.mapping_id);
    })();
    return () => { cancelled = true; };
  }, [effectiveSupplierId]);

  useEffect(() => {
    return () => {
      if (fileData?.storagePath) void deleteTallyUploadFromClient(fileData.storagePath);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetMessages() {
    setMessage(null);
    setError(null);
    setDuplicate(null);
    setLastImportedBillId(null);
  }

  function updateQueueItem(key: string, patch: Partial<QueueItem>) {
    setQueue((q) => q.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function handleFiles(files: File[]) {
    resetMessages();
    if (files.length === 1) {
      await previewSingleFile(files[0]);
    } else {
      await runQueue(files);
    }
  }

  async function previewSingleFile(file: File) {
    setLoading(true);
    setUploadProgress(null);
    setQueue([]);
    try {
      if (fileData?.storagePath) void deleteTallyUploadFromClient(fileData.storagePath);

      const prepared = await prepareImportFile(file, mappingId, setUploadProgress);
      const result = await previewTallyBill({
        ...prepared,
        supplierId: isAdmin ? supplierId || undefined : undefined,
      });

      if (!result.ok) {
        setError(
          isColumnDetectError(result.error) && isSpreadsheet(detectImportFileType(file.name))
            ? `${result.error} — pick a column mapping under Advanced and re-select the file.`
            : result.error
        );
        if (isColumnDetectError(result.error)) setShowAdvanced(true);
        setPreview(null);
        setBillMeta(null);
        if (prepared.storagePath) void deleteTallyUploadFromClient(prepared.storagePath);
        setFileData(null);
        setPendingFile(null);
        return;
      }

      if (isAdmin && !supplierId && result.data.supplier) {
        setSupplierId(result.data.supplier.id);
        setSupplierAutoDetected(true);
      }

      setPreview(result.data.items);
      setBillMeta(result.data.bill);
      setFileData(prepared);
      setPendingFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this file.');
      setFileData(null);
      setPendingFile(null);
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  }

  async function runImport(replaceExisting: boolean) {
    if (!fileData || !pendingFile) return;
    if (isAdmin && !supplierId) {
      setError('Could not detect the supplier from this file — select one above, then confirm.');
      return;
    }
    setLoading(true);
    setError(null);

    let payload = fileData;
    if (replaceExisting && fileData.storagePath) {
      try {
        payload = await prepareImportFile(pendingFile, fileData.mappingId, setUploadProgress);
      } catch (err) {
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Could not re-upload the file.');
        return;
      }
    }

    const result = await importTallyBill({
      ...payload,
      ...(isAdmin && supplierId ? { supplierId } : {}),
      replaceExisting,
    });
    setLoading(false);
    setUploadProgress(null);

    if (result.ok) {
      setMessage(
        result.data.replaced
          ? `Replaced existing bill — imported ${result.data.itemCount} items.`
          : `Imported ${result.data.itemCount} items successfully.`
      );
      if (saveAsDefault && effectiveSupplierId) {
        void saveSupplierDefaultImportFormat({
          supplierId: effectiveSupplierId,
          fileType: fileData.fileType,
          mappingId: fileData.mappingId ?? '',
        });
      }
      setLastImportedBillId(result.data.billId);
      setPreview(null);
      setBillMeta(null);
      setFileData(null);
      setPendingFile(null);
      setDuplicate(null);
    } else if (result.code === 'DUPLICATE_BILL' && result.meta?.existingBillId) {
      setDuplicate({
        existingBillId: String(result.meta.existingBillId),
        billNumber: String(result.meta.billNumber ?? billMeta?.number ?? ''),
        supplierName: isAdmin ? String(result.meta.supplierName ?? '') : undefined,
      });
    } else {
      setError(result.error);
    }
  }

  async function runQueue(files: File[]) {
    const items: QueueItem[] = files.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      status: 'pending',
    }));
    setQueue(items);
    setPreview(null);
    setBillMeta(null);
    setFileData(null);
    setPendingFile(null);
    setQueueRunning(true);

    for (const item of items) {
      await processQueueItem(item, false);
    }
    setQueueRunning(false);
  }

  async function processQueueItem(item: QueueItem, replaceExisting: boolean) {
    updateQueueItem(item.key, { status: 'processing', detail: 'Reading…' });
    let prepared: PreparedImportFile | null = null;
    try {
      prepared = await prepareImportFile(item.file, mappingId, (msg) =>
        updateQueueItem(item.key, { detail: msg })
      );

      let importSupplierId = isAdmin ? (replaceExisting && item.supplierId) || supplierId : fixedSupplierId;

      if (isAdmin) {
        updateQueueItem(item.key, { detail: 'Parsing…' });
        const previewResult = await previewTallyBill({
          ...prepared,
          supplierId: importSupplierId || undefined,
        });
        if (!previewResult.ok) {
          if (prepared.storagePath) void deleteTallyUploadFromClient(prepared.storagePath);
          updateQueueItem(item.key, { status: 'error', detail: previewResult.error });
          return;
        }

        const supplier = previewResult.data.supplier;
        if (!supplier) {
          if (prepared.storagePath) void deleteTallyUploadFromClient(prepared.storagePath);
          updateQueueItem(item.key, {
            status: 'error',
            detail: `Could not match party "${previewResult.data.bill.party}" to a supplier. Select a supplier above and re-drop this file.`,
          });
          return;
        }

        importSupplierId = supplier.id;
        updateQueueItem(item.key, {
          detail: `Importing for ${supplier.name}…`,
          supplierId: supplier.id,
          supplierName: supplier.name,
        });
      } else {
        updateQueueItem(item.key, { detail: 'Importing…' });
      }

      const result = await importTallyBill({
        ...prepared,
        ...(isAdmin && importSupplierId ? { supplierId: importSupplierId } : {}),
        replaceExisting,
      });

      if (result.ok) {
        updateQueueItem(item.key, {
          status: result.data.replaced ? 'replaced' : 'imported',
          detail: isAdmin && item.supplierName
            ? `${result.data.itemCount} items · ${item.supplierName}`
            : `${result.data.itemCount} items`,
          billId: result.data.billId,
        });
        if (saveAsDefault && (importSupplierId || fixedSupplierId)) {
          void saveSupplierDefaultImportFormat({
            supplierId: (importSupplierId || fixedSupplierId)!,
            fileType: prepared.fileType,
            mappingId: prepared.mappingId ?? '',
          });
        }
      } else if (result.code === 'DUPLICATE_BILL') {
        updateQueueItem(item.key, {
          status: 'duplicate',
          detail: isAdmin && item.supplierName
            ? `Bill ${String(result.meta?.billNumber ?? '')} already exists for ${item.supplierName}.`
            : `Bill ${String(result.meta?.billNumber ?? '')} already exists.`,
        });
      } else {
        updateQueueItem(item.key, { status: 'error', detail: result.error });
      }
    } catch (err) {
      if (prepared?.storagePath) void deleteTallyUploadFromClient(prepared.storagePath);
      updateQueueItem(item.key, {
        status: 'error',
        detail: err instanceof Error ? err.message : 'Failed to process this file.',
      });
    }
  }

  const importedCount = queue.filter((q) => q.status === 'imported' || q.status === 'replaced').length;

  return (
    <div className="max-w-3xl space-y-6">
      {showImportHelp && <TallyImportHelp />}

      {message && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-l-4 border-l-primary border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
          <span>{message}</span>
          {lastImportedBillId && (
            <Button size="sm" onClick={() => setPrintBillId(lastImportedBillId)} className="ml-auto">
              <Printer className="mr-1.5 h-4 w-4" />
              Print labels now
            </Button>
          )}
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
            Bill {duplicate.billNumber} already exists
            {duplicate.supplierName ? ` for ${duplicate.supplierName}` : ''}.
          </p>
          <p className="mt-1 text-amber-900">
            Open the existing bill, or replace it to re-import this file. Replacing deletes the existing bill and its line items.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isAdmin ? (
              <Link
                href={existingBillHref(duplicate.existingBillId)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
              >
                Open existing bill
              </Link>
            ) : (
              <ButtonLink href={existingBillHref(duplicate.existingBillId)} variant="outline" size="sm">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Open existing bill
              </ButtonLink>
            )}
            <Button type="button" variant="destructive" size="sm" onClick={() => { setDuplicate(null); void runImport(true); }} disabled={loading}>
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

      {isAdmin && (
        <div>
          <label className="mb-1 block text-sm font-medium">
            Supplier{' '}
            <span className="font-normal text-muted-foreground">
              (optional — auto-detected from the file when possible)
            </span>
          </label>
          <select
            value={supplierId}
            onChange={(e) => { setSupplierId(e.target.value); setSupplierAutoDetected(false); }}
            className="h-10 w-full rounded-md border px-3 text-sm"
          >
            <option value="">Auto-detect from file</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {supplierAutoDetected && supplierId && (
            <p className="mt-1 text-xs text-green-700">
              Detected supplier: {suppliers.find((s) => s.id === supplierId)?.name}. Change it above if that&apos;s wrong.
            </p>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileInput className="h-4 w-4 text-muted-foreground" />
            Upload bill files
          </CardTitle>
          <CardDescription>
            PDF, XML, Excel (.xlsx / .xls), or CSV from Tally, Marg, Busy, Vyapar, or any accounting software.
            Drop multiple files to import them one by one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileDropZone onFiles={(files) => void handleFiles(files)} disabled={loading || queueRunning} />

          <details
            open={showAdvanced}
            onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
            className="rounded-md border px-4 py-3"
          >
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              Advanced — column mapping (only for spreadsheets auto-detect can&apos;t read)
            </summary>
            <div className="mt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Excel/CSV columns are detected automatically from the header row. If detection fails,
                pick a saved mapping here and re-select the file. PDFs and XML never use this.
              </p>
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
          </details>

          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {uploadProgress ?? 'Reading file…'}
            </p>
          )}
        </CardContent>
      </Card>

      {queue.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">
              Importing {queue.length} files
              {!queueRunning && ` — ${importedCount} imported`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {queue.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center gap-2 px-6 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{item.file.name}</span>
                  {item.status === 'pending' && <span className="text-xs text-muted-foreground">Waiting…</span>}
                  {item.status === 'processing' && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      {item.detail}
                    </span>
                  )}
                  {(item.status === 'imported' || item.status === 'replaced') && (
                    <>
                      <span className="flex items-center gap-1.5 text-xs text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {item.status === 'replaced' ? 'Replaced' : 'Imported'} · {item.detail}
                      </span>
                      {item.billId && (
                        <Button size="sm" variant="outline" onClick={() => setPrintBillId(item.billId!)}>
                          <Printer className="mr-1 h-3.5 w-3.5" />
                          Print
                        </Button>
                      )}
                    </>
                  )}
                  {item.status === 'duplicate' && (
                    <>
                      <span className="flex items-center gap-1.5 text-xs text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {item.detail}
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={queueRunning}
                        onClick={() => void processQueueItem(item, true)}
                      >
                        Replace
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={queueRunning}
                        onClick={() => updateQueueItem(item.key, { status: 'skipped', detail: 'Skipped' })}
                      >
                        Skip
                      </Button>
                    </>
                  )}
                  {item.status === 'skipped' && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <X className="h-3.5 w-3.5" />
                      Skipped
                    </span>
                  )}
                  {item.status === 'error' && (
                    <span className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {item.detail}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
            {isAdmin && preview.some((i) => i.ma == null) && (
              <p className="text-xs text-amber-700">
                MA/DNA can&apos;t be computed yet — select the supplier above so their pricing formula is applied, then re-select the file.
              </p>
            )}
            <div className="max-h-64 overflow-auto rounded-lg border">
              <Table>
                <THead>
                  <TR>
                    <TH>SKU</TH>
                    <TH>Name</TH>
                    <TH>HSN</TH>
                    <TH align="right">Qty</TH>
                    <TH align="right">Rate</TH>
                    <TH align="right">MA</TH>
                    <TH align="right">DNA</TH>
                  </TR>
                </THead>
                <TBody>
                  {preview.map((item, i) => (
                    <TR key={i}>
                      <TD className="font-mono text-xs">{item.sku}</TD>
                      <TD>{item.name}</TD>
                      <TD className="font-mono text-xs text-muted-foreground">{item.hsn ?? '—'}</TD>
                      <TD align="right">{item.qty}</TD>
                      <TD align="right">{formatINR(item.rate)}</TD>
                      <TD align="right" className="font-medium">{item.ma != null ? formatINR(item.ma) : '—'}</TD>
                      <TD align="right" className="font-medium">{item.dna != null ? formatINR(item.dna) : '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => { setDuplicate(null); void runImport(false); }} disabled={loading}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Confirm Import
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {isAdmin ? "Save as this supplier's default format" : 'Remember this format for next time'}
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {printBillId && (
        <BillPrintModal
          billId={printBillId}
          onClose={() => setPrintBillId(null)}
          onMarked={() => router.refresh()}
        />
      )}
    </div>
  );
}
