import { detectColumns } from '@/lib/tally/column-detector';
import { parseTallyXlsx } from '@/lib/tally/excel-parser';

describe('column-detector', () => {
  it('detects standard Tally column names', () => {
    const mapping = detectColumns([
      'Bill No', 'Date', 'Party', 'Item', 'Qty', 'Rate', 'Amount', 'HSN',
    ]);
    expect(mapping.bill_number).toBe('Bill No');
    expect(mapping.bill_date).toBe('Date');
    expect(mapping.party).toBe('Party');
    expect(mapping.name).toBe('Item');
    expect(mapping.qty).toBe('Qty');
    expect(mapping.rate).toBe('Rate');
    expect(mapping.amount).toBe('Amount');
    expect(mapping.hsn).toBe('HSN');
  });

  it('detects Marg/Busy style column names', () => {
    const mapping = detectColumns([
      'Invoice Number', 'Invoice Date', 'Supplier Name', 'Product Name',
      'Quantity', 'Price', 'Total Amount', 'HSN Code',
    ]);
    expect(mapping.bill_number).toBe('Invoice Number');
    expect(mapping.bill_date).toBe('Invoice Date');
    expect(mapping.party).toBe('Supplier Name');
    expect(mapping.name).toBe('Product Name');
    expect(mapping.qty).toBe('Quantity');
    expect(mapping.rate).toBe('Price');
    expect(mapping.amount).toBe('Total Amount');
    expect(mapping.hsn).toBe('HSN Code');
  });

  it('detects Zoho Books style column names', () => {
    const mapping = detectColumns([
      'Voucher No.', 'Dated', 'Customer', 'Description', 'Nos', 'Unit Price',
      'Line Total', 'HSN/SAC',
    ]);
    expect(mapping.bill_number).toBe('Voucher No.');
    expect(mapping.party).toBe('Customer');
    expect(mapping.name).toBe('Description');
    expect(mapping.rate).toBe('Unit Price');
    expect(mapping.hsn).toBe('HSN/SAC');
  });

  it('detects Vyapar style with Hindi-English mix', () => {
    const mapping = detectColumns([
      'Bill No.', 'Date', 'Party Name', 'Item Name', 'PCS', 'Rate',
      'Amount', 'HSN/SAC Code',
    ]);
    expect(mapping.bill_number).toBe('Bill No.');
    expect(mapping.party).toBe('Party Name');
    expect(mapping.name).toBe('Item Name');
    expect(mapping.rate).toBe('Rate');
    expect(mapping.hsn).toBe('HSN/SAC Code');
  });

  it('omits fields with no matching header', () => {
    const mapping = detectColumns(['Item', 'Qty', 'Rate']);
    expect(mapping.name).toBe('Item');
    expect(mapping.qty).toBe('Qty');
    expect(mapping.rate).toBe('Rate');
    expect(mapping.bill_number).toBeUndefined();
    expect(mapping.hsn).toBeUndefined();
  });

  it('does not assign the same header to two fields', () => {
    const mapping = detectColumns(['Item', 'Qty', 'Rate', 'Amount']);
    expect(mapping.name).toBe('Item');
    expect(mapping.qty).toBe('Qty');
    expect(mapping.rate).toBe('Rate');
    expect(mapping.amount).toBe('Amount');
  });
});

describe('parseTallyXlsx auto-detection', () => {
  // Build a minimal xlsx buffer in-memory using the xlsx library.
  function buildXlsx(rows: Record<string, unknown>[]): Buffer {
    const XLSX = require('xlsx') as typeof import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  function buildCsv(rows: Record<string, unknown>[]): string {
    const XLSX = require('xlsx') as typeof import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    return XLSX.utils.sheet_to_csv(ws);
  }

  it('parses xlsx without explicit mapping (auto-detect)', () => {
    const buf = buildXlsx([
      {
        'Bill No': 'INV-001', 'Date': '01-Apr-2025', 'Party': 'Test Party',
        'Item': 'Silk Saree', 'Qty': 2, 'Rate': 500, 'Amount': 1000, 'HSN': '5407',
      },
      {
        'Bill No': 'INV-001', 'Date': '01-Apr-2025', 'Party': 'Test Party',
        'Item': 'Cotton Saree', 'Qty': 5, 'Rate': 300, 'Amount': 1500, 'HSN': '5408',
      },
    ]);
    const result = parseTallyXlsx(buf);
    expect(result.bill.number).toBe('INV-001');
    expect(result.bill.party).toBe('Test Party');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].name).toBe('Silk Saree');
    expect(result.items[0].qty).toBe(2);
    expect(result.items[0].rate).toBe(500);
    expect(result.items[0].hsn).toBe('5407');
  });

  it('parses CSV with auto-detection', () => {
    const csv = buildCsv([
      {
        'Invoice Number': 'MARG-100', 'Invoice Date': '2025-06-15',
        'Supplier': 'Marg Supplier',
        'Product Name': 'Item A', 'Quantity': 10, 'Price': 250,
        'Amount': 2500, 'HSN Code': '540822',
      },
    ]);
    const buf = Buffer.from(csv, 'utf-8');
    const result = parseTallyXlsx(buf, undefined, true);
    expect(result.bill.number).toBe('MARG-100');
    expect(result.bill.party).toBe('Marg Supplier');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Item A');
    expect(result.items[0].qty).toBe(10);
    expect(result.items[0].rate).toBe(250);
    expect(result.items[0].hsn).toBe('540822');
  });

  it('throws on empty spreadsheet', () => {
    const XLSX = require('xlsx') as typeof import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([[]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'S');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    expect(() => parseTallyXlsx(buf)).toThrow('Empty spreadsheet');
  });

  it('throws when no valid line items found', () => {
    const buf = buildXlsx([
      { 'Item': 'Test', 'Qty': 0, 'Rate': 0 },
    ]);
    expect(() => parseTallyXlsx(buf)).toThrow(/No valid line items/);
  });
});
