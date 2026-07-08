'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { importTallyBill, previewTallyBill } from '@/app/actions/bills';
import { getSupplierDefaultImportFormat, saveSupplierDefaultImportFormat } from '@/app/actions/supplier-defaults';
import { Button } from '@/components/ui/button';
import { BillPrintModal } from '@/components/pdf/bill-print-modal';
import { FileDropZone } from '@/components/tally/file-drop-zone';
import { formatINR } from '@/lib/pricing';
import { DEFAULT_TALLY_MAPPING_ID } from '@/lib/tally/constants';
import {
  prepareImportFile,
  matchSupplierByParty,
  isSpreadsheet,
  detectImportFileType,
  type PreparedImportFile,
} from '@/lib/tally/prepare-file';
import { deleteTallyUploadFromClient } from '@/lib/tally/upload';
import { Printer, CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';

type DuplicateBill = {
  existingBillId: string;
  billNumber: string;
  supplierName: string;
};

type Props = {
  suppliers: { id: string; name: string }[];
  mappings: { id: string; name: string }[];
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

/** Errors that mean column auto-detection failed → surface the mapping UI. */
function isColumnDetectError(msg: string): boolean {
  return /column|spreadsheet|header/i.test(msg);
}

export function ImportForm({ suppliers, mappings }: Props) {
  const [supplierId, setSupplierId] = useState('');
  const [supplierAutoDetected, setSupplierAutoDetected] = useState(false);
  const [mappingId, setMappingId] = useState(mappings[0]?.id ?? DEFAULT_TALLY_MAPPING_ID);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Single-file preview flow.
  const [preview, setPreview] = useState<{ sku: string; name: string; qty: number; rate: number }[] | null>(null);
  const [billMeta, setBillMeta] = useState<{ number: string; date: string; party: string; total: number } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<PreparedImportFile | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateBill | null>(null);

  // Multi-file queue flow.
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [queueRunning, setQueueRunning] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [saveAsDefault, setSaveAsDefault] = useState(true);
  // Bill id of the most recent successful import — powers "Print labels now".
  const [lastImportedBillId, setLastImportedBillId] = useState<string | null>(null);
  // Bill id currently open in the print modal.
  const [printBillId, setPrintBillId] = useState<string | null>(null);

  // When the supplier changes, load their saved default import format.
  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;
    (async () => {
      const result = await getSupplierDefaultImportFormat(supplierId);
      if (cancelled || !result.ok || !result.data) return;
      if (result.data.mapping_id) setMappingId(result.data.mapping_id);
    })();
    return () => { cancelled = true; };
  }, [supplierId]);

  // Clean up a pending Storage upload when the component unmounts.
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

  /** Resolve which supplier a parsed bill belongs to. */
  function resolveSupplier(party: string): { id: string; name: string } | null {
    if (supplierId) {
      const chosen = suppliers.find((s) => s.id === supplierId);
      if (chosen) return chosen;
    }
    const matched = matchSupplierByParty(party, suppliers);
    if (matched) {
      const s = suppliers.find((x) => x.id === matched);
      if (s) return s;
    }
    return null;
  }

  async function handleFiles(files: File[]) {
    resetMessages();
    if (files.length === 1) {
      await previewSingleFile(files[0]);
    } else {
      await runQueue(files);
    }
  }

  // ---------- Single file: preview → confirm → print ----------

  async function previewSingleFile(file: File) {
    setLoading(true);
    setUploadProgress(null);
    setQueue([]);
    try {
      // Drop any previous pending upload so the bucket only holds the
      // currently-previewed file.
      if (fileData?.storagePath) void deleteTallyUploadFromClient(fileData.storagePath);

      const prepared = await prepareImportFile(file, mappingId, setUploadProgress);
      const result = await previewTallyBill(prepared);

      if (!result.ok) {
        setError(result.error);
        if (isColumnDetectError(result.error) && isSpreadsheet(detectImportFileType(file.name))) {
          setShowAdvanced(true);
          setError(`${result.error} — pick a column mapping under Advanced and re-select the file.`);
        }
        setPreview(null);
        setBillMeta(null);
        if (prepared.storagePath) void deleteTallyUploadFromClient(prepared.storagePath);
        setFileData(null);
        setPendingFile(null);
        return;
      }

      // Auto-detect the supplier from the parsed party name.
      if (!supplierId) {
        const matched = matchSupplierByParty(result.data.bill.party, suppliers);
        if (matched) {
          setSupplierId(matched);
          setSupplierAutoDetected(true);
        }
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
    if (!supplierId) {
      setError('Could not detect the supplier from this file — select one above, then confirm.');
      return;
    }
    setLoading(true);
    setError(null);

    // The server frees the Storage object after every attempt (success or
    // duplicate), so a retry must re-prepare from the original File.
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

    const result = await importTallyBill({ ...payload, supplierId, replaceExisting });
    setLoading(false);
    setUploadProgress(null);

    if (result.ok) {
      setMessage(
        result.data.replaced
          ? `Replaced existing bill — imported ${result.data.itemCount} items.`
          : `Imported bill with ${result.data.itemCount} items.`
      );
      if (saveAsDefault) {
        void saveSupplierDefaultImportFormat({
          supplierId,
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
        supplierName: String(result.meta.supplierName ?? ''),
      });
    } else {
      setError(result.error);
    }
  }

  // ---------- Multi-file queue: auto-import each ----------

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

      updateQueueItem(item.key, { detail: 'Parsing…' });
      const previewResult = await previewTallyBill(prepared);
      if (!previewResult.ok) {
        if (prepared.storagePath) void deleteTallyUploadFromClient(prepared.storagePath);
        updateQueueItem(item.key, { status: 'error', detail: previewResult.error });
        return;
      }

      const supplier = replaceExisting && item.supplierId
        ? suppliers.find((s) => s.id === item.supplierId) ?? null
        : resolveSupplier(previewResult.data.bill.party);
      if (!supplier) {
        if (prepared.storagePath) void deleteTallyUploadFromClient(prepared.storagePath);
        updateQueueItem(item.key, {
          status: 'error',
          detail: `Could not match party "${previewResult.data.bill.party}" to a supplier. Select a supplier above and re-drop this file.`,
        });
        return;
      }

      updateQueueItem(item.key, {
        detail: `Importing for ${supplier.name}…`,
        supplierId: supplier.id,
        supplierName: supplier.name,
      });

      const result = await importTallyBill({
        ...prepared,
        supplierId: supplier.id,
        replaceExisting,
      });

      if (result.ok) {
        updateQueueItem(item.key, {
          status: result.data.replaced ? 'replaced' : 'imported',
          detail: `${result.data.itemCount} items · ${supplier.name}`,
          billId: result.data.billId,
        });
        if (saveAsDefault) {
          void saveSupplierDefaultImportFormat({
            supplierId: supplier.id,
            fileType: prepared.fileType,
            mappingId: prepared.mappingId ?? '',
          });
        }
      } else if (result.code === 'DUPLICATE_BILL') {
        updateQueueItem(item.key, {
          status: 'duplicate',
          detail: `Bill ${String(result.meta?.billNumber ?? '')} already exists for ${supplier.name}.`,
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
    <div className="max-w-3xl space-y-4">
      {message && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
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
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

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
            <Button type="button" variant="destructive" onClick={() => { setDuplicate(null); void runImport(true); }} disabled={loading}>
              {loading ? 'Replacing…' : 'Replace existing'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDuplicate(null)} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      )}

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

      {queue.length > 0 && (
        <div className="rounded-md border">
          <div className="border-b bg-muted/30 px-4 py-2 text-sm font-medium">
            Importing {queue.length} files
            {!queueRunning && ` — ${importedCount} imported`}
          </div>
          <ul className="divide-y">
            {queue.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
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
        </div>
      )}

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
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button onClick={() => { setDuplicate(null); void runImport(false); }} disabled={loading}>
              Confirm Import
            </Button>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Save as this supplier&apos;s default format
            </label>
          </div>
        </div>
      )}

      {printBillId && (
        <BillPrintModal billId={printBillId} onClose={() => setPrintBillId(null)} />
      )}
    </div>
  );
}
