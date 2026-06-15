-- Tighten grants: revoke broad table access, re-grant per role needs
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

GRANT SELECT ON public.tenants TO authenticated;
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.suppliers TO authenticated;
GRANT SELECT ON public.items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.bills TO authenticated;
GRANT SELECT, INSERT ON public.bill_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tally_imports TO authenticated;
GRANT SELECT ON public.tally_column_mappings TO authenticated;
GRANT SELECT ON public.pricing_rules TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT SELECT ON public.layouts TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
