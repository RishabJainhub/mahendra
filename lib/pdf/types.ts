export type BillPDFData = {
  bill_number: string;
  bill_date: string;
  supplier_name: string;
  supplier_code: string;
  tenant_name: string;
  tenant_gstin?: string;
  total_amount: number;
};

export type BillItemPDF = {
  description: string;
  hsn?: string;
  ma_price: number;
  dna_price: number;
  qty: number;
};

export type LayoutPDF = {
  grid_cols: number;
  label_w: number;
  label_h: number;
  include_fields: string[];
};

export type BillStickerBundle = {
  id?: string;
  bill: BillPDFData;
  items: BillItemPDF[];
};
