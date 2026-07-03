-- 029_tally_imports_bucket.sql
---
-- Maintenance-free large-file imports.
--
-- Tally PDF/XLSX exports can exceed Vercel's 4.5 MB serverless request body
-- limit (Hobby AND Pro). Routing uploads through Supabase Storage removes that
-- ceiling entirely: the browser uploads directly to a private bucket, then the
-- server action downloads the object with the service role, parses it, and
-- deletes it.
--
-- RLS scoping: every object is stored under a path prefixed by the uploader's
-- auth.uid() — `tally-imports/<user_id>/<timestamp>-<rand>.<ext>`. A user can
-- only read/write/delete their own objects. The service role bypasses RLS for
-- the server-side download + cleanup.
--
-- Orphan cleanup: if a user uploads but never confirms (or closes the tab),
-- the object would linger. A daily pg_cron job deletes objects older than 24h
-- so the bucket is self-cleaning.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tally-imports',
  'tally-imports',
  false,
  52428800, -- 50 MB hard cap per object
  ARRAY[
    'application/pdf',
    'application/xml',
    'text/xml',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE
SET file_size_limit   = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types,
    public             = EXCLUDED.public;

-- Drop & recreate policies idempotently (migration is re-runnable).
DROP POLICY IF EXISTS tally_imports_insert ON storage.objects;
DROP POLICY IF EXISTS tally_imports_select ON storage.objects;
DROP POLICY IF EXISTS tally_imports_delete ON storage.objects;

-- Path prefix is `<auth.uid()>/<rest>`. storage.foldername(name)[1] is the
-- first segment of the object name.
CREATE POLICY tally_imports_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tally-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY tally_imports_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'tally-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY tally_imports_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tally-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Daily cleanup: delete tally-imports objects older than 24 hours. Uses the
-- storage.objects table directly; Supabase reaps the underlying blob on row
-- delete. Safe to run repeatedly.
CREATE OR REPLACE FUNCTION public.cleanup_tally_imports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'tally-imports'
    AND created_at < now() - interval '24 hours';
END;
$$;

-- Schedule the cleanup daily at 03:00 UTC. Re-runnable: drops the job first.
-- Uses a distinct dollar-quote tag ($cron$) so the inner string literal does
-- not collide with the outer DO $$ ... $$ block.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.unschedule('tally-imports-cleanup');
    PERFORM cron.schedule(
      'tally-imports-cleanup',
      '0 3 * * *',
      $cron$SELECT public.cleanup_tally_imports();$cron$
    );
  END IF;
END
$$;
