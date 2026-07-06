-- 035_supplier_default_import_format.sql
---
-- Per-supplier default import format so suppliers don't reconfigure file type
-- + column mapping every time they import. One row per supplier (UNIQUE on
-- supplier_id). RLS-scoped to the supplier's tenant.

CREATE TABLE IF NOT EXISTS public.supplier_default_import_format (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE CASCADE,
  file_type   text NOT NULL CHECK (file_type IN ('xml', 'xlsx', 'xls', 'csv', 'pdf')),
  mapping_id  uuid REFERENCES public.tally_column_mappings (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_default_import_format_supplier
  ON public.supplier_default_import_format (supplier_id);

ALTER TABLE public.supplier_default_import_format
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_default_import_format_select ON public.supplier_default_import_format;
CREATE POLICY supplier_default_import_format_select ON public.supplier_default_import_format
  FOR SELECT TO authenticated
  USING (tenant_id = public.jwt_tenant_id());

DROP POLICY IF EXISTS supplier_default_import_format_upsert ON public.supplier_default_import_format;
CREATE POLICY supplier_default_import_format_upsert ON public.supplier_default_import_format
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.jwt_tenant_id());

DROP POLICY IF EXISTS supplier_default_import_format_update ON public.supplier_default_import_format;
CREATE POLICY supplier_default_import_format_update ON public.supplier_default_import_format
  FOR UPDATE TO authenticated
  USING (tenant_id = public.jwt_tenant_id())
  WITH CHECK (tenant_id = public.jwt_tenant_id());

DROP POLICY IF EXISTS supplier_default_import_format_delete ON public.supplier_default_import_format;
CREATE POLICY supplier_default_import_format_delete ON public.supplier_default_import_format
  FOR DELETE TO authenticated
  USING (tenant_id = public.jwt_tenant_id());
