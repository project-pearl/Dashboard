-- ============================================================
-- Migration 004: Triage Queue
-- Persistent alert triage workflow for management centers.
-- ============================================================

CREATE TABLE triage_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source alert linkage
  alert_dedup_key  TEXT NOT NULL UNIQUE,
  alert_type       TEXT NOT NULL,
  alert_severity   TEXT NOT NULL CHECK (alert_severity IN ('anomaly','critical','warning','info')),
  -- Content (copied from AlertEvent at creation)
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  entity_id        TEXT NOT NULL,
  entity_label     TEXT NOT NULL,
  -- Geography (for role-scoping)
  state            TEXT,
  huc8             TEXT,
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  -- Workflow
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','acknowledged','investigating','resolved')),
  priority         INTEGER NOT NULL DEFAULT 0,
  -- Assignment
  assigned_to_uid  TEXT,
  assigned_to_name TEXT,
  assigned_at      TIMESTAMPTZ,
  -- Resolution
  resolved_by_uid  TEXT,
  resolved_by_name TEXT,
  resolution_note  TEXT,
  resolved_at      TIMESTAMPTZ,
  -- Extra context
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE triage_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triage_item_id  UUID NOT NULL REFERENCES triage_items(id) ON DELETE CASCADE,
  user_uid        TEXT,
  user_name       TEXT,
  action          TEXT NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for primary query patterns
CREATE INDEX idx_triage_status   ON triage_items (status, priority DESC, created_at DESC);
CREATE INDEX idx_triage_state    ON triage_items (state, status, created_at DESC);
CREATE INDEX idx_triage_assigned ON triage_items (assigned_to_uid, status) WHERE assigned_to_uid IS NOT NULL;
CREATE INDEX idx_triage_notes    ON triage_notes (triage_item_id, created_at DESC);

-- Reuse existing trigger from 002_deployment_alerts.sql
CREATE TRIGGER trg_triage_updated
  BEFORE UPDATE ON triage_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: permissive (auth at API route level, matching existing pattern)
ALTER TABLE triage_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON triage_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON triage_notes FOR ALL USING (true) WITH CHECK (true);
