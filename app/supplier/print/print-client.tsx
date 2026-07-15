'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { getBillStickers, markBillPrinted } from '@/app/actions/bills';
import { renderBillPDF, renderLabelRollPDF, DEFAULT_LABEL_LAYOUT } from '@/lib/pdf';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PdfPrintTools } from '@/components/pdf/pdf-print-tools';
import { Printer, FileText, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';

type Props = {
  bills: { id: string; bill_number: string; bill_date: string; status?: string }[];
  layout: { grid_cols: number; label_w: number; label_h: number; include_fields: string[] } | null;
  initialBillId?: string;
};

export function PrintPageClient({ bills, layout, initialBillId }: Props) {
  const router = useRouter();
  const [billId, setBillId] = useState(initialBillId ?? '');
  const [pdfDoc, setPdfDoc] = useState<ReactElement | null>(null);
  const [fileName, setFileName] = useState('labels.pdf');
  const [loading, setLoading] = useState(false);
  const [marked, setMarked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Roll mode is the daily default — labels go to the Argox CP-2140.
  const [rollMode, setRollMode] = useState(true);

  const layoutConfig = layout ?? DEFAULT_LABEL_LAYOUT;

  useEffect(() => {
    if (initialBillId) setBillId(initialBillId);
  }, [initialBillId]);

  async function handleGenerate() {
    if (!billId) return;
    setLoading(true);
    setError(null);
    setMarked(false);
    setPdfDoc(null);
    try {
      const sticker = await getBillStickers(billId);
      if (!sticker) {
        setError('Could not load this bill.');
        return;
      }
      const doc = rollMode
        ? renderLabelRollPDF([{ id: billId, bill: sticker.bill, items: sticker.items }])
        : renderBillPDF(sticker.bill, sticker.items, layoutConfig);
      setPdfDoc(doc);
      setFileName(
        rollMode
          ? `labels-roll-${sticker.bill.bill_number}.pdf`
          : `labels-${sticker.bill.bill_number}.pdf`
      );
      const result = await markBillPrinted(billId);
      if (result.ok) {
        setMarked(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this bill.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPrinted(): Promise<boolean> {
    if (!billId) return false;
    const result = await markBillPrinted(billId);
    if (result.ok) {
      setMarked(true);
      router.refresh();
      return true;
    }
    setError(result.error);
    return false;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="h-4 w-4 text-muted-foreground" />
            Print options
          </CardTitle>
          <CardDescription>Generate sticker sheets with barcodes. Preview first, then mark as printed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bill" className="text-xs font-medium text-muted-foreground">Bill</Label>
            <Select
              id="bill"
              value={billId}
              onChange={(e) => setBillId(e.target.value)}
              className="max-w-sm"
            >
              <option value="">Select bill</option>
              {bills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bill_number} — {b.bill_date}
                  {b.status === 'printed' ? ' (printed)' : ''}
                </option>
              ))}
            </Select>
          </div>

          <button
            type="button"
            onClick={() => { setRollMode((v) => !v); setPdfDoc(null); }}
            className="flex w-full items-center justify-between rounded-lg border bg-muted/20 p-4 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex items-start gap-3">
              {rollMode ? (
                <ToggleRight className="h-6 w-6 text-primary" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-muted-foreground" />
              )}
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  Label roll mode (Argox CP-2140)
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {rollMode
                    ? 'One 50×25mm sticker per page. In Argox driver: media 50×25mm, Landscape, auto-rotate OFF. Calibrate sensor once.'
                    : 'A4 sheet with multiple labels — for preview or regular printers.'}
                </div>
              </div>
            </div>
            <span className={`ml-3 rounded-full px-2.5 py-0.5 text-xs font-semibold ${rollMode ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {rollMode ? 'ON' : 'OFF'}
            </span>
          </button>

          <div className="flex gap-2">
            <Button onClick={() => void handleGenerate()} disabled={!billId || loading}>
              <FileText className="mr-1.5 h-4 w-4" />
              {loading ? 'Generating…' : 'Generate PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-l-4 border-l-destructive border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
        </div>
      )}

      {pdfDoc ? (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PdfPrintTools
              doc={pdfDoc}
              fileName={fileName}
              onMarkPrinted={pdfDoc ? handleMarkPrinted : undefined}
              marked={marked}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-base font-semibold">No preview yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Select a bill and click Generate PDF to preview the sticker sheet.</p>
        </div>
      )}
    </div>
  );
}
