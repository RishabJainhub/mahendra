'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { getBillStickers, markBillPrinted, unmarkBillsPrinted } from '@/app/actions/bills';
import { renderBillPDF, renderLabelRollPDF, DEFAULT_LABEL_LAYOUT } from '@/lib/pdf';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { PdfPrintTools } from '@/components/pdf/pdf-print-tools';

type Sticker = Awaited<ReturnType<typeof getBillStickers>>;

type Props = {
  billId: string;
  onClose: () => void;
  /** Called after the bill is marked printed (auto or manual). */
  onMarked?: () => void;
};

/**
 * Shared print modal for a single bill: Argox roll mode (default on), live
 * preview, download, direct print with auto-mark-printed. Used from the bill
 * detail page and right after an import succeeds.
 */
export function BillPrintModal({ billId, onClose, onMarked }: Props) {
  const { toast } = useToast();
  const [sticker, setSticker] = useState<Sticker>(null);
  const [rollMode, setRollMode] = useState(true);
  const [marked, setMarked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoMarkedRef = useRef(false);

  useEffect(() => {
    autoMarkedRef.current = false;
  }, [billId]);

  useEffect(() => {
    let cancelled = false;
    void getBillStickers(billId).then((s) => {
      if (cancelled) return;
      if (s) setSticker(s);
      else setError('Could not load this bill for printing.');
    });
    return () => {
      cancelled = true;
    };
  }, [billId]);

  useEffect(() => {
    if (!sticker || autoMarkedRef.current) return;
    autoMarkedRef.current = true;
    void handleMarkPrinted();
  }, [sticker]);

  async function handleMarkPrinted(): Promise<boolean> {
    const result = await markBillPrinted(billId);
    if (result.ok) {
      setMarked(true);
      onMarked?.();
      toast({
        title: 'Marked as printed',
        description: sticker ? `Bill ${sticker.bill.bill_number}` : undefined,
        variant: 'success',
        action: {
          label: 'Undo',
          onClick: async () => {
            const undo = await unmarkBillsPrinted([billId]);
            if (undo.ok) {
              setMarked(false);
              onMarked?.();
            }
          },
        },
      });
      return true;
    }
    toast({
      title: 'Could not mark as printed',
      description: result.error,
      variant: 'destructive',
    });
    return false;
  }

  // Stable doc reference so the preview iframe doesn't regenerate every render.
  const doc = useMemo<ReactElement | null>(() => {
    if (!sticker) return null;
    return rollMode
      ? renderLabelRollPDF([{ id: billId, bill: sticker.bill, items: sticker.items }])
      : renderBillPDF(sticker.bill, sticker.items, DEFAULT_LABEL_LAYOUT);
  }, [sticker, rollMode, billId]);

  const fileName = sticker ? `labels-${sticker.bill.bill_number}.pdf` : 'labels.pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col rounded-lg bg-white">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">
            Print labels{sticker ? ` — Bill ${sticker.bill.bill_number}` : ''}
          </h3>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!sticker && !error && (
            <p className="text-sm text-muted-foreground">Loading labels…</p>
          )}
          {sticker && (
            <>
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
                    ? 'One 50×25mm sticker per page. In the Argox driver: media 50×25mm, Landscape, auto-rotate OFF.'
                    : 'A4 sheet with multiple labels — for preview or regular printers.'}
                </span>
              </div>
              <PdfPrintTools
                doc={doc}
                fileName={fileName}
                onMarkPrinted={handleMarkPrinted}
                marked={marked}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
