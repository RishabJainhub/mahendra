'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { getBill, markBillPrinted } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { renderBillPDF } from '@/lib/pdf';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <p className="p-4">Loading preview...</p> }
);

type Props = { billId: string };

export function ReprintButton({ billId }: Props) {
  const [open, setOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<React.ReactElement | null>(null);

  async function handleOpen() {
    const bill = await getBill(billId);
    if (!bill) return;

    const items = (bill.bill_items ?? []).map((item: { sku: string; name: string; qty: number; rate: number; total: number }) => ({
      sku: item.sku,
      name: item.name,
      qty: Number(item.qty),
      rate: Number(item.rate),
      total: Number(item.total),
      barcode_data: item.sku,
    }));

    const doc = renderBillPDF(
      {
        bill_number: bill.bill_number,
        bill_date: bill.bill_date,
        supplier_name: (bill.supplier as { name: string })?.name ?? '',
        tenant_name: 'Mahendra Saree House',
        total_amount: Number(bill.total_amount),
      },
      items,
      { grid_cols: 3, label_w: 120, label_h: 80, include_fields: ['sku', 'name', 'barcode'] }
    );
    setPdfDoc(doc);
    setOpen(true);
    await markBillPrinted(billId);
  }

  if (!open) {
    return <Button onClick={handleOpen} variant="outline">Reprint</Button>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative h-[90vh] w-[90vw] rounded-lg bg-white">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">Print Preview</h3>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
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
