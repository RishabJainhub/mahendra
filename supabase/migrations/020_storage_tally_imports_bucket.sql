-- Security hardening: the tally-imports bucket holds raw supplier bill files
-- (sensitive financial data). It must be PRIVATE and tenant-isolated. Access
-- is granted only to admins of the tenant whose id is the top-level folder in
-- the object path (uploads are written under `<tenant_id>/...`). Files are
-- served via short-lived signed URLs, never public URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('tally-imports', 'tally-imports', false, 52428800)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 52428800;

DROP POLICY IF EXISTS tally_imports_admin_select ON storage.objects;
DROP POLICY IF EXISTS tally_imports_admin_insert ON storage.objects;
DROP POLICY IF EXISTS tally_imports_admin_update ON storage.objects;
DROP POLICY IF EXISTS tally_imports_admin_delete ON storage.objects;

CREATE POLICY tally_imports_admin_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'tally-imports'
    AND public.jwt_role() = 'admin'
    AND (storage.foldername(name))[1] = public.jwt_tenant_id()::text
  );

CREATE POLICY tally_imports_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tally-imports'
    AND public.jwt_role() = 'admin'
    AND (storage.foldername(name))[1] = public.jwt_tenant_id()::text
  );

CREATE POLICY tally_imports_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tally-imports'
    AND public.jwt_role() = 'admin'
    AND (storage.foldername(name))[1] = public.jwt_tenant_id()::text
  )
  WITH CHECK (
    bucket_id = 'tally-imports'
    AND public.jwt_role() = 'admin'
    AND (storage.foldername(name))[1] = public.jwt_tenant_id()::text
  );

CREATE POLICY tally_imports_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tally-imports'
    AND public.jwt_role() = 'admin'
    AND (storage.foldername(name))[1] = public.jwt_tenant_id()::text
  );
