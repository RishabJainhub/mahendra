-- 034_allow_csv_imports.sql
---
-- Add text/csv to the tally-imports bucket's allowed MIME types so suppliers
-- can upload CSV exports from any accounting software (Marg, Busy, Vyapar,
-- Zoho Books, custom sheets). Re-runnable: merges text/csv into the existing
-- array without dropping other types.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT unnest(
    allowed_mime_types || ARRAY['text/csv']
  )
)
WHERE id = 'tally-imports';
