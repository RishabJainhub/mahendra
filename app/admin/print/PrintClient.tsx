'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  getBulkBillStickers,
  getPrintableBills,
  markBillPrinted,
  markBillsPrinted,
  type PrintableBillRow,
} from '@/app/actions/bills';
import { renderBillPDF, renderBulkBillPDF, renderLabelRollPDF } from '@/lib/pdf';
import type { LayoutPDF } from '@/lib/pdf/types';
import { PdfPrintTools } from '@/components/pdf/pdf-print-tools';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { Printer, RefreshCw, FileDown, AlertCircle, FileText } from 'lucide-react';

type LayoutOption = LayoutPDF & { id: string; name: string };

type Props = {
  layouts: LayoutOption[];
  initialDate: string;
  bulkPrintEnabled?: boolean;
};

function pdfFileName(prefix: string, date: string, count: number): string {
  return `${prefix}-${date}${count > 1 ? `-${count}-bills` : ''}.pdf`;
}

export function PrintClient({ layouts, initialDate, bulkPrintEnabled = true }: Props) {
  const router = useRouter();
  const [filterDate, setFilterDate] = useState(initialDate);
  const [status, setStatus] = useState<'imported' | 'printed' | ''>('imported');
  const [search, setSearch] = useState('');
  const [billId, setBillId] = useState('');
  const [layoutId, setLayoutId] = useState(layouts[0]?.id ?? '');
  const [bills, setBills] = useState<PrintableBillRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<ReactElement | null>(null);
  const [pdfFile, setPdfFile] = useState('');
  const [selectedBulkIds, setSelectedBulkIds] = useState<string[]>([]);
  const [marked, setMarked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [rollMode, setRollMode] = useState(false);

  const layout = useMemo(
    () => layouts.find((l) => l.id === layoutId) ?? layouts[0] ?? null,
    [layouts, layoutId]
  );

  const loadBills = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    const result = await getPrintableBills({
      status: status || undefined,
      from: filterDate,
      to: filterDate,
      search: search.trim() || undefined,
    });
    setBills(result.bills);
    setLoadingList(false);
    if (result.bills.length === 1) setBillId(result.bills[0].id);
  }, [filterDate, search, status]);

  useEffect(() => {
    void loadBills();
  }, [loadBills]);

  const unprintedToday = bills.filter((b) => b.status === 'imported');

  async function handleSinglePdf() {
    if (!billId) return;
    setLoadingPdf(true);
    setError(null);
    setMarked(false);
    setPdfDoc(null);
    setSelectedBulkIds([]);
    setProgress(null);
    try {
      const bundles = await getBulkBillStickers([billId]);
      if (bundles.length === 0) {
        setError('Could not load this bill.');
        return;
      }
      const bundle = bundles[0];
      const doc = rollMode
        ? renderLabelRollPDF([{ id: billId, bill: bundle.bill, items: bundle.items }])
        : renderBillPDF(bundle.bill, bundle.items, layout);
      setPdfDoc(doc);
      setPdfFile(pdfFileName('labels', bundle.bill.bill_date, 1));
      setSelectedBulkIds([billId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this bill.');
    } finally {
      setLoadingPdf(false);
    }
  }

  async function handleBulkPdf() {
    const ids = unprintedToday.map((b) => b.id);
    if (ids.length === 0) {
      setError('No unprinted bills for this date.');
      return;
    }

    setLoadingPdf(true);
    setError(null);
    setMarked(false);
    setPdfDoc(null);
    setProgress(`Loading 0 / ${ids.length} bills…`);

    try {
      const bundles = await getBulkBillStickers(ids);
      if (bundles.length === 0) {
        setError('Could not load bills for bulk print.');
        return;
      }

      setProgress(`Building PDF for ${bundles.length} bills…`);
      const doc = rollMode
        ? renderLabelRollPDF(bundles.map((b) => ({ id: b.id, bill: b.bill, items: b.items })))
        : renderBulkBillPDF(
            bundles.map((b) => ({ id: b.id, bill: b.bill, items: b.items })),
            layout
          );
      setPdfDoc(doc);
      setPdfFile(pdfFileName('labels', filterDate, bundles.length));
      setSelectedBulkIds(bundles.map((b) => b.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load bills for bulk print.');
    } finally {
      setLoadingPdf(false);
      setProgress(null);
    }
  }

  async function handleMarkPrinted() {
    if (selectedBulkIds.length === 0) return;
    const result =
      selectedBulkIds.length === 1
        ? await markBillPrinted(selectedBulkIds[0])
        : await markBillsPrinted(selectedBulkIds);

    if (result.ok) {
      setMarked(true);
      router.refresh();
      await loadBills();
    } else {
      setError(result.error);
    }
  }

  return (
    <div>
      <PageHeader
        title="Print labels"
        description="Labels are paginated across A4 pages (~40–50 per page). Download the PDF for reliable printing; use bulk print for all unprinted bills on a date."
      />

      <Card className="mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="h-4 w-4 text-muted-foreground" />
            Print options
          </CardTitle>
          <CardDescription>Filter the bill list, choose a layout, then generate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="filterDate" className="text-xs font-medium text-muted-foreground">Bill date</Label>
              <Input
                id="filterDate"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'imported' | 'printed' | '')}
                className="w-48"
              >
                <option value="imported">Unprinted (imported)</option>
                <option value="printed">Printed</option>
                <option value="">All</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="search" className="text-xs font-medium text-muted-foreground">Search bill #</Label>
              <Input
                id="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Optional"
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="layoutId" className="text-xs font-medium text-muted-foreground">Layout</Label>
              <Select
                id="layoutId"
                value={layoutId}
                onChange={(e) => setLayoutId(e.target.value)}
                className="w-56"
              >
                {layouts.length === 0 ? (
                  <option value="">Default (2 col, 250×54)</option>
                ) : (
                  layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))
                )}
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadBills()} disabled={loadingList}>
              <RefreshCw className="mr-1.5 h-4 w-4" />
              {loadingList ? 'Loading…' : 'Refresh list'}
            </Button>
          </div>

          <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={rollMode}
                onChange={(e) => setRollMode(e.target.checked)}
                className="h-4 w-4"
              />
              Label roll mode (Argox CP-2140)
            </label>
            <span className="text-xs text-muted-foreground">
              {rollMode
                ? 'One 50×25mm sticker per page. In Argox driver: media 50×25mm, Landscape, auto-rotate OFF. Calibrate sensor once.'
                : 'A4 sheet with multiple labels — for preview or regular printers.'}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            {loadingList
              ? 'Loading bills…'
              : `${bills.length} bill(s) on ${filterDate}${status === 'imported' ? ` · ${unprintedToday.length} unprinted` : ''}`}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="billId" className="text-xs font-medium text-muted-foreground">Bill</Label>
              <Select
                id="billId"
                value={billId}
                onChange={(e) => setBillId(e.target.value)}
                className="min-w-[220px]"
              >
                <option value="">Select bill</option>
                {bills.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bill_number} — {b.supplier_name} ({b.status})
                  </option>
                ))}
              </Select>
            </div>
            <Button type="button" onClick={() => void handleSinglePdf()} disabled={!billId || loadingPdf}>
              <FileText className="mr-1.5 h-4 w-4" />
              {loadingPdf && !progress ? 'Generating…' : 'Single bill PDF'}
            </Button>
            {bulkPrintEnabled && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleBulkPdf()}
                disabled={loadingPdf || unprintedToday.length === 0}
              >
                {loadingPdf && progress ? progress : `Bulk: all unprinted (${unprintedToday.length})`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {billId ? (
          <ButtonLink
            href={`/api/admin/export/stickers?billId=${encodeURIComponent(billId)}`}
            variant="outline"
          >
            <FileDown className="mr-1.5 h-4 w-4" />
            Download CSV (BarTender)
          </ButtonLink>
        ) : (
          <Button type="button" variant="outline" disabled>
            <FileDown className="mr-1.5 h-4 w-4" />
            Download CSV (BarTender)
          </Button>
        )}
        {bulkPrintEnabled && unprintedToday.length > 0 && (
          <ButtonLink
            href={`/api/admin/export/stickers?${unprintedToday.map((b) => `billId=${encodeURIComponent(b.id)}`).join('&')}`}
            variant="outline"
          >
            <FileDown className="mr-1.5 h-4 w-4" />
            Download CSV — all unprinted ({unprintedToday.length})
          </ButtonLink>
        )}
        <span className="text-xs text-muted-foreground">
          For BarTender / label software — one row per line item with Qty column.
        </span>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <PdfPrintTools
        doc={pdfDoc}
        fileName={pdfFile}
        onMarkPrinted={selectedBulkIds.length > 0 ? handleMarkPrinted : undefined}
        marked={marked}
        markLabel={selectedBulkIds.length > 1 ? `Mark ${selectedBulkIds.length} as Printed` : 'Mark as Printed'}
      />
    </div>
  );
}
