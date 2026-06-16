-- tally_imports had no timestamp, so "last import" / "recent imports" could not
-- be ordered chronologically (the UI was sorting by the random UUID primary key
-- and rendering new Date(uuid) -> "Invalid Date"). Add a created_at column.
ALTER TABLE public.tally_imports
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS tally_imports_created_at_idx
  ON public.tally_imports (created_at DESC);
