-- Track month-end Excel exports before allowing month close.
CREATE TABLE IF NOT EXISTS public.tenant_month_exports (
  tenant_id   uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  month       text NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  exported_at timestamptz NOT NULL DEFAULT now(),
  exported_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  PRIMARY KEY (tenant_id, month)
);

CREATE INDEX IF NOT EXISTS tenant_month_exports_month_idx
  ON public.tenant_month_exports (tenant_id, month DESC);

ALTER TABLE public.tenant_month_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_month_exports_admin_jwt ON public.tenant_month_exports
  FOR ALL TO authenticated
  USING (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin')
  WITH CHECK (tenant_id = public.jwt_tenant_id() AND public.jwt_role() = 'admin');

GRANT SELECT, INSERT, DELETE ON public.tenant_month_exports TO authenticated;
