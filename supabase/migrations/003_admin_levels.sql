-- 003_admin_levels.sql
-- Add tiered admin levels, military flag, and invite audit log

-- Add admin_level column (keep is_admin temporarily for backward compat)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_level TEXT NOT NULL DEFAULT 'none'
  CHECK (admin_level IN ('super_admin', 'role_admin', 'none'));

-- Add military flag for Federal sub-type
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_military BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing super admins
UPDATE profiles SET admin_level = 'super_admin'
  WHERE email IN ('doug@project-pearl.org', 'steve@project-pearl.org', 'gwen@project-pearl.org');

-- Audit log table
CREATE TABLE IF NOT EXISTS invite_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,  -- 'invite_created' | 'invite_redeemed' | 'admin_granted' | 'admin_revoked'
  actor_id UUID NOT NULL,
  actor_email TEXT NOT NULL,
  actor_admin_level TEXT NOT NULL,
  target_email TEXT,
  target_role TEXT NOT NULL,
  target_state TEXT,
  target_jurisdiction TEXT,
  target_admin_level TEXT DEFAULT 'none',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_audit_actor ON invite_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_invite_audit_created ON invite_audit_log(created_at);
