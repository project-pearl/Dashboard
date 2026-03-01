-- Shared cache tables for cross-instance data coordination.
-- Run this in the Supabase SQL editor when ready.
-- The system works without these tables (falls back to Vercel Blob).

CREATE TABLE IF NOT EXISTS public.data_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  data_json JSONB NOT NULL,
  record_count INT DEFAULT 0,
  size_bytes INT DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  fetched_by TEXT,
  fetch_duration_ms INT,
  UNIQUE(source, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_lookup
  ON public.data_snapshots(source, scope_key);

CREATE TABLE IF NOT EXISTS public.data_refresh_locks (
  source TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  locked_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(source, scope_key)
);

-- Allow service-role full access (RLS disabled for these tables)
ALTER TABLE public.data_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_refresh_locks ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically, but add permissive policies
-- so the Supabase dashboard can view the data too
CREATE POLICY "Allow all for service role" ON public.data_snapshots
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON public.data_refresh_locks
  FOR ALL USING (true) WITH CHECK (true);
