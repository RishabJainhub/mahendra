'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { getBillStickers, markBillPrinted } from '@/app/actions/bills';
import { renderBillPDF, DEFAULT_LABEL_LAYOUT } from '@/lib/pdf';
import { Button } from '@/components/ui/button';
import { PdfPrintTools } from '@/components/pdf/pdf-print-tools';

type Props = { billId: string };

export function ReprintButton({ billId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<ReactElement | null>(null);
  const [fileName, setFileName] = useState('labels.pdf');
  const [marked, setMarked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    const sticker = await getBillStickers(billId);
    setLoading(false);
    if (!sticker) return;

    const doc = renderBillPDF(sticker.bill, sticker.items, DEFAULT_LABEL_LAYOUT);
    setPdfDoc(doc);
    setFileName(`labels-${sticker.bill.bill_number}.pdf`);
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

  if (!open) {
    return (
      <Button onClick={() => void handleOpen()} variant="outline" disabled={loading}>
        {loading ? 'Loading…' : 'Reprint'}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col rounded-lg bg-white">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">Print Labels</h3>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        <div className="overflow-y-auto p-4">
          <PdfPrintTools
            doc={pdfDoc}
            fileName={fileName}
            onMarkPrinted={handleMarkPrinted}
            marked={marked}
          />
        </div>
      </div>
    </div>
  );
}
