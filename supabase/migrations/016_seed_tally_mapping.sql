-- Seed default tenant and Tally column mapping for Excel imports
INSERT INTO public.tenants (id, name, gstin, address)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Mahendra Distributors',
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tally_column_mappings (id, tenant_id, name, column_map)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Default Tally Excel',
  jsonb_build_object(
    'bill_number', 'Bill No',
    'bill_date', 'Date',
    'party', 'Party',
    'sku', 'SKU',
    'name', 'Item',
    'qty', 'Qty',
    'rate', 'Rate',
    'amount', 'Amount',
    'hsn', 'HSN'
  )
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.layouts (id, tenant_id, name, grid_cols, label_w, label_h, include_fields)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000001',
  'Default Sticker Layout',
  3,
  50,
  25,
  '["sku", "name", "mrp", "barcode"]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
