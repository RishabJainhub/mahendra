-- Supplier-scoped write policies (supplement admin policies from 011)
CREATE POLICY bills_supplier_insert_jwt ON public.bills
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'supplier'
    AND supplier_id = public.jwt_supplier_id()
  );

CREATE POLICY bills_supplier_update_jwt ON public.bills
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'supplier'
    AND supplier_id = public.jwt_supplier_id()
  )
  WITH CHECK (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'supplier'
    AND supplier_id = public.jwt_supplier_id()
  );

CREATE POLICY bill_items_supplier_insert_jwt ON public.bill_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bills b
      WHERE b.id = bill_items.bill_id
        AND b.tenant_id = public.jwt_tenant_id()
        AND public.jwt_role() = 'supplier'
        AND b.supplier_id = public.jwt_supplier_id()
    )
  );

CREATE POLICY items_supplier_insert_jwt ON public.items
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'supplier'
  );

CREATE POLICY items_supplier_update_jwt ON public.items
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'supplier'
  )
  WITH CHECK (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'supplier'
  );

CREATE POLICY tally_imports_supplier_insert_jwt ON public.tally_imports
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'supplier'
    AND supplier_id = public.jwt_supplier_id()
  );

CREATE POLICY tally_imports_supplier_update_jwt ON public.tally_imports
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'supplier'
    AND supplier_id = public.jwt_supplier_id()
  )
  WITH CHECK (
    tenant_id = public.jwt_tenant_id()
    AND public.jwt_role() = 'supplier'
    AND supplier_id = public.jwt_supplier_id()
  );
