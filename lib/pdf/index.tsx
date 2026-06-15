import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { formatINR } from '@/lib/pricing';

export type BillPDFData = {
  bill_number: string;
  bill_date: string;
  supplier_name: string;
  tenant_name: string;
  tenant_gstin?: string;
  total_amount: number;
};

export type BillItemPDF = {
  sku: string;
  name: string;
  qty: number;
  rate: number;
  total: number;
  barcode_data?: string;
};

export type LayoutPDF = {
  grid_cols: number;
  label_w: number;
  label_h: number;
  include_fields: string[];
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10 },
  header: { marginBottom: 20 },
  title: { fontSize: 16, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  label: {
    border: '1pt solid #ccc',
    padding: 4,
    margin: 2,
    width: 120,
    minHeight: 80,
  },
  barcode: { width: 100, height: 30, marginBottom: 2 },
  itemName: { fontSize: 8 },
  itemSku: { fontSize: 7, color: '#666' },
});

export function renderBillPDF(
  bill: BillPDFData,
  items: BillItemPDF[],
  layout: LayoutPDF
): React.ReactElement {
  const labelWidth = layout.label_w || 120;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{bill.tenant_name}</Text>
          {bill.tenant_gstin && <Text>GSTIN: {bill.tenant_gstin}</Text>}
          <Text>Bill: {bill.bill_number} | Date: {bill.bill_date}</Text>
          <Text>Supplier: {bill.supplier_name}</Text>
          <Text>Total: {formatINR(bill.total_amount)}</Text>
        </View>
        <View style={styles.row}>
          {items.map((item, idx) => (
            <View key={idx} style={[styles.label, { width: labelWidth }]}>
              {item.barcode_data && (
                <Image style={styles.barcode} src={`/api/bills/0/barcodes?data=${encodeURIComponent(item.barcode_data)}`} />
              )}
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemSku}>{item.sku}</Text>
              <Text>Qty: {item.qty} | {formatINR(item.rate)}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
