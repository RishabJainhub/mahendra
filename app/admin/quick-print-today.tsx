'use client';

import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  getBulkBillStickers,
  getPrintableBills,
  markBillPrinted,
  markBillsPrinted,
  unmarkBillsPrinted,
} from '@/app/actions/bills';
import { renderBulkBillPDF, renderLabelRollPDF, DEFAULT_LABEL_LAYOUT } from '@/lib/pdf';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { PdfPrintTools } from '@/components/pdf/pdf-print-tools';
import { Printer } from 'lucide-react';

type Bundles = Awaited<ReturnType<typeof getBulkBillStickers>>;

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * One-click dashboard action: gather every unprinted bill dated today and
 * open the print modal with the bulk roll PDF ready.
 */
export function QuickPrintToday() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bundles, setBundles] = useState<Bundles>([]);
  const [rollMode, setRollMode] = useState(true);
  const [marked, setMarked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleOpen() {
    setLoading(true);
    setNotice(null);
    try {
      const date = todayISO();
      const { bills } = await getPrintableBills({ status: 'imported', from: date, to: date });
      if (bills.length === 0) {
        setNotice('No unprinted bills dated today.');
        return;
      }
      const loaded = await getBulkBillStickers(bills.map((b) => b.id));
      if (loaded.length === 0) {
        setNotice('Could not load today\u2019s bills.');
        return;
      }
      setBundles(loaded);
      setMarked(false);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPrinted(): Promise<boolean> {
    const ids = bundles.map((b) => b.id);
    const result = ids.length === 1 ? await markBillPrinted(ids[0]) : await markBillsPrinted(ids);
    if (result.ok) {
      setMarked(true);
      router.refresh();
      toast({
        title: `Marked ${ids.length} bill${ids.length !== 1 ? 's' : ''} as printed`,
        variant: 'success',
        action: {
          label: 'Undo',
          onClick: async () => {
            const undo = await unmarkBillsPrinted(ids);
            if (undo.ok) {
              setMarked(false);
              router.refresh();
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

  const doc = useMemo<ReactElement | null>(() => {
    if (bundles.length === 0) return null;
    const mapped = bundles.map((b) => ({ id: b.id, bill: b.bill, items: b.items }));
    return rollMode
      ? renderLabelRollPDF(mapped)
      : renderBulkBillPDF(mapped, DEFAULT_LABEL_LAYOUT);
  }, [bundles, rollMode]);

  return (
    <>
      <Button variant="outline" onClick={() => void handleOpen()} disabled={loading}>
        <Printer className="mr-1.5 h-4 w-4" />
        {loading ? 'Loading…' : "Print today's labels"}
      </Button>
      {notice && <span className="text-sm text-muted-foreground">{notice}</span>}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[95vh] w-full max-w-5xl flex-col rounded-lg bg-white">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="font-semibold">
                Print today&apos;s labels — {bundles.length} bill{bundles.length !== 1 ? 's' : ''}
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
                    : 'A4 sheets with multiple labels — for preview or regular printers.'}
                </span>
              </div>
              <PdfPrintTools
                doc={doc}
                fileName={`labels-${todayISO()}-${bundles.length}-bills.pdf`}
                onMarkPrinted={handleMarkPrinted}
                marked={marked}
                markLabel={bundles.length > 1 ? `Mark ${bundles.length} as Printed` : 'Mark as Printed'}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
