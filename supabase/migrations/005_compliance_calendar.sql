-- 005_compliance_calendar.sql
-- MS4 Compliance Calendar: user-created events + notes with audit trail.
-- Auto-populated events come from existing caches (ms4Permit, icis, sdwis)
-- at query time and are NOT stored here.

CREATE TABLE compliance_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Scoping
  org_id          TEXT NOT NULL,
  state           TEXT NOT NULL,
  created_by_uid  TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  -- Event
  title           TEXT NOT NULL,
  description     TEXT,
  event_date      DATE NOT NULL,
  event_type      TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'compliance',
  priority        TEXT NOT NULL DEFAULT 'medium',
  -- Recurrence
  recurrence      TEXT,
  recurrence_end  DATE,
  -- Status
  status          TEXT NOT NULL DEFAULT 'upcoming'
                  CHECK (status IN ('upcoming','in-progress','completed','overdue','skipped')),
  completed_at    TIMESTAMPTZ,
  completed_by_uid  TEXT,
  completed_by_name TEXT,
  completion_note TEXT,
  -- Linking
  permit_id       TEXT,
  facility_name   TEXT,
  -- Meta
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE compliance_event_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES compliance_events(id) ON DELETE CASCADE,
  user_uid    TEXT,
  user_name   TEXT,
  action      TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comp_events_org   ON compliance_events (org_id, state, event_date);
CREATE INDEX idx_comp_events_date  ON compliance_events (event_date) WHERE status != 'completed';
CREATE INDEX idx_comp_notes_event  ON compliance_event_notes (event_id, created_at DESC);

-- update_updated_at() already exists from migration 002
CREATE TRIGGER trg_comp_events_updated
  BEFORE UPDATE ON compliance_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_event_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON compliance_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON compliance_event_notes FOR ALL USING (true) WITH CHECK (true);
