-- 030_lock_down_cleanup_tally_imports.sql
---
-- Close a security gap introduced by migration 029: the `cleanup_tally_imports`
-- SECURITY DEFINER function was callable by `anon` and `authenticated` roles
-- via `/rest/v1/rpc/cleanup_tally_imports`. Any unauthenticated visitor could
-- trigger the cleanup (deleting tally-imports storage objects older than 24h).
--
-- The function is meant to be invoked ONLY by the pg_cron job (which runs as
-- the postgres superuser and bypasses EXECUTE grants). Revoke EXECUTE from
-- PUBLIC/anon/authenticated so the function is unreachable via the REST API.
-- Also pin `search_path` to `public, storage` to satisfy the
-- `function_search_path_mutable` security lint and prevent search-path
-- hijacking.
--
-- IMPORTANT: DROP + CREATE resets default privileges (functions are executable
-- by PUBLIC by default), so the REVOKE must run AFTER the recreate.

DROP FUNCTION IF EXISTS public.cleanup_tally_imports();

CREATE FUNCTION public.cleanup_tally_imports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'tally-imports'
    AND created_at < now() - interval '24 hours';
END;
$$;

-- Revoke AFTER recreate so it sticks. GRANT to postgres is implicit but explicit for clarity.
REVOKE EXECUTE ON FUNCTION public.cleanup_tally_imports() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_tally_imports() TO postgres;
