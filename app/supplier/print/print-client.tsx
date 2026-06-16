'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getBillStickers, markBillPrinted } from '@/app/actions/bills';
import { renderBillPDF } from '@/lib/pdf';
import { Button } from '@/components/ui/button';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <p className="p-4">Loading preview...</p> }
);

type Props = {
  bills: { id: string; bill_number: string; bill_date: string; status?: string }[];
  layout: { grid_cols: number; label_w: number; label_h: number; include_fields: string[] } | null;
};

export function PrintPageClient({ bills, layout }: Props) {
  const router = useRouter();
  const [billId, setBillId] = useState('');
  const [pdfDoc, setPdfDoc] = useState<React.ReactElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [marked, setMarked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
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
      const doc = renderBillPDF(
        sticker.bill,
        sticker.items,
        layout ?? { grid_cols: 3, label_w: 120, label_h: 80, include_fields: ['sku', 'name', 'barcode'] }
      );
      setPdfDoc(doc);
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
      <h1 className="mb-6 text-2xl font-bold">Print Barcodes</h1>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={billId} onChange={(e) => setBillId(e.target.value)} className="h-10 rounded-md border px-3 text-sm">
          <option value="">Select bill</option>
          {bills.map((b) => (
            <option key={b.id} value={b.id}>
              {b.bill_number} — {b.bill_date}
              {b.status === 'printed' ? ' (printed)' : ''}
            </option>
          ))}
        </select>
        <Button onClick={handlePreview} disabled={!billId || loading}>
          {loading ? 'Generating…' : 'Generate Preview'}
        </Button>
        {pdfDoc && (
          <Button variant="outline" onClick={handleMarkPrinted} disabled={marked}>
            {marked ? 'Marked as Printed' : 'Mark as Printed'}
          </Button>
        )}
      </div>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      {pdfDoc && (
        <div className="h-[80vh] rounded-lg border">
          <PDFViewer width="100%" height="100%" showToolbar>
            {pdfDoc as never}
          </PDFViewer>
        </div>
      )}
    </div>
  );
}
