'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { getBillStickers, markBillPrinted } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { renderBillPDF } from '@/lib/pdf';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <p className="p-4">Loading preview...</p> }
);

type Props = { billId: string };

export function ReprintButton({ billId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<React.ReactElement | null>(null);
  const [marked, setMarked] = useState(false);

  async function handleOpen() {
    const sticker = await getBillStickers(billId);
    if (!sticker) return;

    const doc = renderBillPDF(
      sticker.bill,
      sticker.items,
      { grid_cols: 3, label_w: 120, label_h: 80, include_fields: ['sku', 'name', 'barcode'] }
    );
    setPdfDoc(doc);
    setOpen(true);
  }

  async function handleMarkPrinted() {
    const result = await markBillPrinted(billId);
    if (result.ok) {
      setMarked(true);
      router.refresh();
    }
  }

  if (!open) {
    return <Button onClick={handleOpen} variant="outline">Reprint</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative h-[90vh] w-[90vw] rounded-lg bg-white">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">Print Preview</h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleMarkPrinted} disabled={marked}>
              {marked ? 'Marked as Printed' : 'Mark as Printed'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </div>
        </div>
        <div className="h-[calc(90vh-60px)]">
          {pdfDoc && (
            <PDFViewer width="100%" height="100%" showToolbar>
              {pdfDoc as never}
            </PDFViewer>
          )}
        </div>
      </div>
    </div>
  );
}
