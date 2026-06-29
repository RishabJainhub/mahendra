-- 028_remove_supplier_items_write.sql
---
-- Close a residual data-exfiltration path on public.items.
--
-- Migration 026 locked items SELECT to admin-only. But migration 017 still
-- granted suppliers INSERT and UPDATE on items via:
--   items_supplier_insert_jwt  (FOR INSERT)
--   items_supplier_update_jwt  (FOR UPDATE)
--
-- In PostgREST, a supplier can send `PATCH /rest/v1/items?sku=eq.<known_sku>`
-- with header `Prefer: return=representation` and a trivial body. The UPDATE
-- policy passes for any tenant item, and the response body returns the full
-- row — including base_rate and mrp (the admin's cost reference) — even
-- though SELECT is blocked. This defeats the 026 lockdown.
--
-- Suppliers do not use the items table in any UI flow (HSN is stored on
-- bill_items.hsn; label rendering uses bill_items + supplier code). Drop
-- both supplier write policies. Admins retain full access via
-- items_admin_write_jwt (FOR ALL, admin-only).

DROP POLICY IF EXISTS items_supplier_insert_jwt ON public.items;
DROP POLICY IF EXISTS items_supplier_update_jwt ON public.items;
