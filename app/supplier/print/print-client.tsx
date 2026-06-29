'use client';

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { getBillStickers, markBillPrinted } from '@/app/actions/bills';
import { renderBillPDF, DEFAULT_LABEL_LAYOUT } from '@/lib/pdf';
import { Button } from '@/components/ui/button';
import { PdfPrintTools } from '@/components/pdf/pdf-print-tools';

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
      const doc = renderBillPDF(sticker.bill, sticker.items, layoutConfig);
      setPdfDoc(doc);
      setFileName(`labels-${sticker.bill.bill_number}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPrinted() {
    if (!billId) return;
    const result = await markBillPrinted(billId);
    if (result.ok) {
      setMarked(true);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Print Labels</h1>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={billId}
          onChange={(e) => setBillId(e.target.value)}
          className="h-10 rounded-md border px-3 text-sm"
        >
          <option value="">Select bill</option>
          {bills.map((b) => (
            <option key={b.id} value={b.id}>
              {b.bill_number} — {b.bill_date}
              {b.status === 'printed' ? ' (printed)' : ''}
            </option>
          ))}
        </select>
        <Button onClick={() => void handleGenerate()} disabled={!billId || loading}>
          {loading ? 'Generating…' : 'Generate PDF'}
        </Button>
      </div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      <PdfPrintTools
        doc={pdfDoc}
        fileName={fileName}
        onMarkPrinted={pdfDoc ? handleMarkPrinted : undefined}
        marked={marked}
      />
    </div>
  );
}
