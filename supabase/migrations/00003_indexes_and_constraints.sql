-- Indexes and additional constraints
CREATE UNIQUE INDEX items_tenant_sku_uidx ON public.items (tenant_id, sku);
CREATE INDEX items_tenant_id_idx ON public.items (tenant_id);

CREATE INDEX suppliers_tenant_id_idx ON public.suppliers (tenant_id);
CREATE INDEX suppliers_active_idx ON public.suppliers (tenant_id, active) WHERE active = true;

CREATE INDEX bills_tenant_id_idx ON public.bills (tenant_id);
CREATE INDEX bills_supplier_id_idx ON public.bills (supplier_id);
CREATE INDEX bills_status_idx ON public.bills (tenant_id, status);
CREATE INDEX bills_bill_date_idx ON public.bills (tenant_id, bill_date DESC);
CREATE UNIQUE INDEX bills_tenant_supplier_number_uidx ON public.bills (tenant_id, supplier_id, bill_number);

CREATE INDEX bill_items_bill_id_idx ON public.bill_items (bill_id);
CREATE INDEX bill_items_item_id_idx ON public.bill_items (item_id) WHERE item_id IS NOT NULL;

CREATE INDEX tally_imports_tenant_id_idx ON public.tally_imports (tenant_id);
CREATE INDEX tally_imports_supplier_id_idx ON public.tally_imports (supplier_id);
CREATE INDEX tally_imports_status_idx ON public.tally_imports (tenant_id, status);

CREATE INDEX tally_column_mappings_tenant_id_idx ON public.tally_column_mappings (tenant_id);

CREATE UNIQUE INDEX pricing_rules_supplier_uidx ON public.pricing_rules (supplier_id);
CREATE INDEX pricing_rules_tenant_id_idx ON public.pricing_rules (tenant_id);

CREATE INDEX audit_log_tenant_id_idx ON public.audit_log (tenant_id);
CREATE INDEX audit_log_entity_idx ON public.audit_log (tenant_id, entity, entity_id);
CREATE INDEX audit_log_created_at_idx ON public.audit_log (tenant_id, created_at DESC);

CREATE INDEX layouts_tenant_id_idx ON public.layouts (tenant_id);

CREATE INDEX users_tenant_id_idx ON public.users (tenant_id);
CREATE INDEX users_supplier_id_idx ON public.users (supplier_id) WHERE supplier_id IS NOT NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_supplier_role_check
  CHECK (
    (role = 'admin' AND supplier_id IS NULL)
    OR (role = 'supplier')
  );
