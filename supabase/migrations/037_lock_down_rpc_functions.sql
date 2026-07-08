-- 037_lock_down_rpc_functions.sql
--
-- CRITICAL: sync_user_app_metadata and provision_supplier_user were
-- executable by anon/authenticated via PostgREST RPC. sync_user_app_metadata
-- writes role/tenant_id into auth.users.raw_app_meta_data with no internal
-- auth check — any holder of the public anon key could grant themselves
-- admin. These are service-role-only helpers called from server actions.
--
-- Also: pin search_path on the JWT helper functions (advisor warning).

-- Service-role-only RPCs.
REVOKE EXECUTE ON FUNCTION public.sync_user_app_metadata(uuid, uuid, text, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_supplier_user(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_supplier_user(text, uuid, text, text, numeric, numeric, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;

-- Trigger functions cannot be invoked via RPC (they return `trigger`), but
-- revoke anyway so the advisor stops flagging them and defence is layered.
REVOKE EXECUTE ON FUNCTION public.auto_set_tenant_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_bill_item_pricing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_audit_log_tenant_id() FROM PUBLIC, anon, authenticated;

-- current_user_tenant_id and the JWT helpers are referenced inside RLS
-- policy expressions, which execute as the calling role — authenticated must
-- keep EXECUTE. anon has no policies that reference them, so drop anon.
REVOKE EXECUTE ON FUNCTION public.current_user_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_jwt_claims() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.jwt_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.jwt_supplier_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.jwt_role() FROM PUBLIC, anon;

-- Pin search_path on the JWT helpers (advisor: function_search_path_mutable).
ALTER FUNCTION public.get_jwt_claims() SET search_path = public;
ALTER FUNCTION public.jwt_tenant_id() SET search_path = public;
ALTER FUNCTION public.jwt_supplier_id() SET search_path = public;
ALTER FUNCTION public.jwt_role() SET search_path = public;
