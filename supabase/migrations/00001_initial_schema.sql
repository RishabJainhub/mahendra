-- Mahendra Saree House — initial schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.bill_status AS ENUM ('draft', 'imported', 'printed', 'cancelled');

CREATE TABLE public.tenants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  gstin      text,
  address    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text,
  phone           text,
  pricing_rule_id uuid,
  active          boolean NOT NULL DEFAULT true
);

CREATE TABLE public.pricing_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE CASCADE,
  model       text NOT NULL DEFAULT 'standard' CHECK (model IN ('standard', 'company151')),
  margin_pct  numeric(8, 4) NOT NULL DEFAULT 0,
  markup_pct  numeric(8, 4) NOT NULL DEFAULT 0,
  gst_pct     numeric(8, 4) NOT NULL DEFAULT 5
);

ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_pricing_rule_id_fkey
  FOREIGN KEY (pricing_rule_id) REFERENCES public.pricing_rules (id) ON DELETE SET NULL;

CREATE TABLE public.users (
  id                   uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id            uuid REFERENCES public.tenants (id) ON DELETE SET NULL,
  role                 text NOT NULL CHECK (role IN ('admin', 'supplier')),
  supplier_id          uuid REFERENCES public.suppliers (id) ON DELETE SET NULL,
  must_reset_password  boolean NOT NULL DEFAULT false,
  email                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  sku        text NOT NULL,
  name       text NOT NULL,
  hsn        text,
  base_rate  numeric(12, 2) NOT NULL DEFAULT 0,
  mrp        numeric(12, 2) NOT NULL DEFAULT 0,
  gst_rate   numeric(8, 4) NOT NULL DEFAULT 5
);

CREATE TABLE public.bills (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  supplier_id  uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE CASCADE,
  bill_number  text NOT NULL,
  bill_date    date NOT NULL,
  total_amount numeric(14, 2) NOT NULL DEFAULT 0,
  status       public.bill_status NOT NULL DEFAULT 'draft'
);

CREATE TABLE public.bill_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    uuid NOT NULL REFERENCES public.bills (id) ON DELETE CASCADE,
  item_id    uuid REFERENCES public.items (id) ON DELETE SET NULL,
  sku        text NOT NULL,
  name       text NOT NULL,
  qty        numeric(12, 3) NOT NULL DEFAULT 1,
  rate       numeric(12, 2) NOT NULL DEFAULT 0,
  taxable    numeric(14, 2) NOT NULL DEFAULT 0,
  cgst       numeric(14, 2) NOT NULL DEFAULT 0,
  sgst       numeric(14, 2) NOT NULL DEFAULT 0,
  igst       numeric(14, 2) NOT NULL DEFAULT 0,
  total      numeric(14, 2) NOT NULL DEFAULT 0,
  unit_price numeric(12, 2) NOT NULL DEFAULT 0
);

CREATE TABLE public.tally_column_mappings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name        text NOT NULL,
  column_map  jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.tally_imports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_type   text NOT NULL,
  mapping_id  uuid REFERENCES public.tally_column_mappings (id) ON DELETE SET NULL,
  status      text NOT NULL DEFAULT 'pending',
  error       text
);

CREATE TABLE public.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  actor_id   uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text NOT NULL,
  entity_id  uuid,
  diff       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.layouts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  name            text NOT NULL,
  grid_cols       integer NOT NULL DEFAULT 3,
  label_w         numeric(8, 2) NOT NULL DEFAULT 50,
  label_h         numeric(8, 2) NOT NULL DEFAULT 25,
  include_fields  jsonb NOT NULL DEFAULT '[]'::jsonb
);
