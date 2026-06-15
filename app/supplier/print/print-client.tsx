'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { getBill, markBillPrinted } from '@/app/actions/bills';
import { renderBillPDF } from '@/lib/pdf';
import { Button } from '@/components/ui/button';

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  { ssr: false, loading: () => <p className="p-4">Loading preview...</p> }
);

type Props = {
  bills: { id: string; bill_number: string; bill_date: string }[];
  layout: { grid_cols: number; label_w: number; label_h: number; include_fields: string[] } | null;
};

export function PrintPageClient({ bills, layout }: Props) {
  const [billId, setBillId] = useState('');
  const [pdfDoc, setPdfDoc] = useState<React.ReactElement | null>(null);

  async function handlePreview() {
    if (!billId) return;
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
      layout ?? { grid_cols: 3, label_w: 120, label_h: 80, include_fields: ['sku', 'name', 'barcode'] }
    );
    setPdfDoc(doc);
    await markBillPrinted(billId);
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Print Barcodes</h1>
      <div className="mb-4 flex gap-3">
        <select value={billId} onChange={(e) => setBillId(e.target.value)} className="h-10 rounded-md border px-3 text-sm">
          <option value="">Select bill</option>
          {bills.map((b) => (
            <option key={b.id} value={b.id}>{b.bill_number} — {b.bill_date}</option>
          ))}
        </select>
        <Button onClick={handlePreview}>Preview & Print</Button>
      </div>
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
