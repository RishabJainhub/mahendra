'use client';

import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { getBillStickers, markBillPrinted } from '@/app/actions/bills';
import { renderBillPDF, renderLabelRollPDF, DEFAULT_LABEL_LAYOUT } from '@/lib/pdf';
import { Button } from '@/components/ui/button';
import { PdfPrintTools } from '@/components/pdf/pdf-print-tools';
import { Printer } from 'lucide-react';

type Props = { billId: string };

type Sticker = Awaited<ReturnType<typeof getBillStickers>>;

export function ReprintButton({ billId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sticker, setSticker] = useState<Sticker>(null);
  const [rollMode, setRollMode] = useState(true);
  const [marked, setMarked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    const s = await getBillStickers(billId);
    setLoading(false);
    if (!s) return;
    setSticker(s);
    setMarked(false);
    setOpen(true);
  }

  async function handleMarkPrinted() {
    const result = await markBillPrinted(billId);
    if (result.ok) {
      setMarked(true);
      router.refresh();
    }
  }

  // Rebuild the PDF only when the bill data or roll mode changes — a stable doc
  // reference keeps the preview iframe from regenerating on every render.
  const doc = useMemo<ReactElement | null>(() => {
    if (!sticker) return null;
    return rollMode
      ? renderLabelRollPDF([{ id: billId, bill: sticker.bill, items: sticker.items }])
      : renderBillPDF(sticker.bill, sticker.items, DEFAULT_LABEL_LAYOUT);
  }, [sticker, rollMode, billId]);

  if (!open) {
    return (
      <Button onClick={() => void handleOpen()} variant="outline" disabled={loading}>
        <Printer className="mr-1.5 h-4 w-4" />
        {loading ? 'Loading…' : 'Print'}
      </Button>
    );
  }

  const fileName = sticker ? `labels-${sticker.bill.bill_number}.pdf` : 'labels.pdf';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col rounded-lg bg-white">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">
            Print labels{sticker ? ` — Bill ${sticker.bill.bill_number}` : ''}
          </h3>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
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
        </div>
      </div>
    </div>
  );
}
