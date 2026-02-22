-- Centralized Scheduler Kit: pin_meta schema
-- Run in Supabase SQL Editor, then expose pin_meta in API settings.

CREATE SCHEMA IF NOT EXISTS pin_meta;

-- ────────────────────────────────────────────
-- 1. scheduler — one row per source
-- ────────────────────────────────────────────
CREATE TABLE pin_meta.scheduler (
  source              TEXT PRIMARY KEY,
  enabled             BOOLEAN NOT NULL DEFAULT true,
  base_interval_min   INT NOT NULL,
  max_interval_min    INT NOT NULL DEFAULT 1440,
  jitter_pct          INT NOT NULL DEFAULT 10,
  next_run_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at         TIMESTAMPTZ,
  last_status         TEXT DEFAULT 'unknown',
  fail_count          INT DEFAULT 0,
  lock_owner          TEXT,
  lock_until          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT now(),
  notes               TEXT
);

-- ────────────────────────────────────────────
-- 2. ingest_runs — append-only log
-- ────────────────────────────────────────────
CREATE TABLE pin_meta.ingest_runs (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source          TEXT NOT NULL,
  job             TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  duration_ms     INT,
  status          TEXT NOT NULL,
  processed       INT,
  inserted        INT,
  warnings        INT,
  error_code      TEXT,
  error_message   TEXT,
  meta            JSONB DEFAULT '{}'
);

CREATE INDEX idx_ingest_runs_source
  ON pin_meta.ingest_runs(source, started_at DESC);

-- ────────────────────────────────────────────
-- 3. ingest_health — one row per source
-- ────────────────────────────────────────────
CREATE TABLE pin_meta.ingest_health (
  source          TEXT PRIMARY KEY,
  job             TEXT,
  last_status     TEXT DEFAULT 'unknown',
  last_success    TIMESTAMPTZ,
  last_error      TIMESTAMPTZ,
  error_code      TEXT,
  error_message   TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────────
-- RLS policies
-- ────────────────────────────────────────────
ALTER TABLE pin_meta.scheduler       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_meta.ingest_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_meta.ingest_health   ENABLE ROW LEVEL SECURITY;

-- service_role: full access
CREATE POLICY "service_role full access" ON pin_meta.scheduler
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access" ON pin_meta.ingest_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access" ON pin_meta.ingest_health
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- anon/authenticated: read-only
CREATE POLICY "public read" ON pin_meta.scheduler
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON pin_meta.ingest_runs
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON pin_meta.ingest_health
  FOR SELECT TO anon, authenticated USING (true);

-- ────────────────────────────────────────────
-- Seed scheduler rows — staggered by 2 min
-- ────────────────────────────────────────────
INSERT INTO pin_meta.scheduler (source, base_interval_min, next_run_at, notes)
VALUES
  ('ceden',          1440, now() + interval '0 minutes',  'Daily'),
  ('wqp',            1440, now() + interval '2 minutes',  'Daily'),
  ('state-reports',  1440, now() + interval '4 minutes',  'Daily, after wqp'),
  ('icis',           1440, now() + interval '6 minutes',  'Daily'),
  ('sdwis',          1440, now() + interval '8 minutes',  'Daily'),
  ('nwis-gw',        1440, now() + interval '10 minutes', 'Daily'),
  ('echo',           1440, now() + interval '12 minutes', 'Daily'),
  ('frs',            1440, now() + interval '14 minutes', 'Daily'),
  ('pfas',           1440, now() + interval '16 minutes', 'Daily'),
  ('bwb',            1440, now() + interval '18 minutes', 'Daily'),
  ('attains',         180, now() + interval '20 minutes', 'Every 3h (chunked)'),
  ('insights',        360, now() + interval '22 minutes', 'Every 6h');

INSERT INTO pin_meta.ingest_health (source)
VALUES
  ('ceden'), ('wqp'), ('state-reports'), ('icis'), ('sdwis'), ('nwis-gw'),
  ('echo'), ('frs'), ('pfas'), ('bwb'), ('attains'), ('insights');
