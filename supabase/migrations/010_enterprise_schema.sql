-- Enterprise schema additions
CREATE TYPE public.import_status AS ENUM ('pending', 'processing', 'completed', 'failed');

ALTER TABLE public.bill_items
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE;

ALTER TABLE public.tally_imports
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.tally_imports
  ALTER COLUMN status TYPE public.import_status
  USING (
    CASE status
      WHEN 'pending' THEN 'pending'::public.import_status
      WHEN 'processing' THEN 'processing'::public.import_status
      WHEN 'completed' THEN 'completed'::public.import_status
      WHEN 'failed' THEN 'failed'::public.import_status
      ELSE 'pending'::public.import_status
    END
  );

ALTER TABLE public.tally_imports
  ALTER COLUMN status SET DEFAULT 'pending'::public.import_status;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS bill_items_tenant_id_idx ON public.bill_items (tenant_id);

-- Backfill bill_items.tenant_id from parent bill
UPDATE public.bill_items bi
SET tenant_id = b.tenant_id
FROM public.bills b
WHERE bi.bill_id = b.id
  AND bi.tenant_id IS NULL;
