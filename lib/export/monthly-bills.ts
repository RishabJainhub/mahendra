import { formatSupplierCode } from '@/lib/pricing';

export type MonthBounds = { start: string; end: string; label: string };

/** Parse `YYYY-MM` into inclusive ISO date bounds for bill_date. */
export function monthBounds(month: string): MonthBounds | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  const start = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;
  return { start, end, label: month };
}

export type BillExportRow = {
  id: string;
  bill_number: string;
  bill_date: string;
  status: string;
  total_amount: number;
  supplier_name: string;
  supplier_code: string;
};

export type LineItemExportRow = {
  bill_number: string;
  bill_date: string;
  supplier_name: string;
  supplier_code: string;
  sku: string;
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  ma_price: number;
  dna_price: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

type BillRecord = {
  id: string;
  bill_number: string;
  bill_date: string;
  status: string;
  total_amount: number | string;
  supplier: {
    name: string;
    code_prefix: string | null;
    code_number: string | null;
  } | null;
};

type BillItemRecord = {
  bill_id: string;
  sku: string;
  name: string;
  hsn: string | null;
  qty: number | string;
  rate: number | string;
  ma_price: number | string;
  dna_price: number | string;
  taxable: number | string;
  cgst: number | string;
  sgst: number | string;
  igst: number | string;
  total: number | string;
};

export function billsToSummaryRows(bills: BillRecord[]): Record<string, string | number>[] {
  return bills.map((bill) => {
    const supplier = bill.supplier;
    return {
      'Bill #': bill.bill_number,
      Date: bill.bill_date,
      Supplier: supplier?.name ?? '',
      'Supplier Code': formatSupplierCode(supplier?.code_prefix, supplier?.code_number),
      Status: bill.status,
      'Total (INR)': Number(bill.total_amount),
    };
  });
}

export function billsToLineItemRows(
  bills: BillRecord[],
  itemsByBillId: Map<string, BillItemRecord[]>
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];

  for (const bill of bills) {
    const supplier = bill.supplier;
    const supplierName = supplier?.name ?? '';
    const supplierCode = formatSupplierCode(supplier?.code_prefix, supplier?.code_number);
    const items = itemsByBillId.get(bill.id) ?? [];

    for (const item of items) {
      rows.push({
        'Bill #': bill.bill_number,
        Date: bill.bill_date,
        Supplier: supplierName,
        'Supplier Code': supplierCode,
        SKU: item.sku,
        Description: item.name,
        HSN: item.hsn ?? '',
        Qty: Number(item.qty),
        Rate: Number(item.rate),
        'MA Price': Number(item.ma_price),
        'DNA Price': Number(item.dna_price),
        Taxable: Number(item.taxable),
        CGST: Number(item.cgst),
        SGST: Number(item.sgst),
        IGST: Number(item.igst),
        'Line Total': Number(item.total),
      });
    }
  }

  return rows;
}

export function buildMonthlyWorkbook(
  bills: BillRecord[],
  itemsByBillId: Map<string, BillItemRecord[]>
): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx') as typeof import('xlsx');

  const summary = billsToSummaryRows(bills);
  const lines = billsToLineItemRows(bills, itemsByBillId);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), 'Bills');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(lines), 'Line Items');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
