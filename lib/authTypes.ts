// ─── Auth Types ─────────────────────────────────────────────────────────────
// Shared types for the PEARL authentication & authorization system.

export type UserRole = 'Federal' | 'State' | 'Local' | 'MS4' | 'Corporate' | 'Researcher' | 'College' | 'NGO' | 'K12' | 'Temp' | 'Pearl'
  | 'Utility' | 'Agriculture' | 'Lab' | 'Biotech' | 'Investor';
export type AccountStatus = 'active' | 'pending' | 'rejected' | 'deactivated';
export type AdminLevel = 'super_admin' | 'role_admin' | 'none';

export function normalizeUserRole(role: string | undefined): UserRole {
  const key = (role || '').trim().toLowerCase();
  const roleMap: Record<string, UserRole> = {
    federal: 'Federal',
    state: 'State',
    local: 'Local',
    ms4: 'MS4',
    corporate: 'Corporate',
    researcher: 'Researcher',
    college: 'College',
    university: 'College',
    ngo: 'NGO',
    k12: 'K12',
    temp: 'Temp',
    pearl: 'Pearl',
    utility: 'Utility',
    agriculture: 'Agriculture',
    lab: 'Lab',
    biotech: 'Biotech',
    investor: 'Investor',
  };
  return roleMap[key] ?? 'NGO';
}

/** Roles that require admin approval + jurisdiction binding */
export const OPERATOR_ROLES: UserRole[] = ['MS4', 'State', 'Local', 'Federal', 'Corporate', 'Utility', 'Agriculture', 'Lab', 'Biotech', 'Investor'];
/** Roles that get instant access on self-signup */
export const EXPLORER_ROLES: UserRole[] = ['K12', 'College', 'Researcher', 'NGO', 'Temp'];

export function isOperatorRole(role: UserRole): boolean {
  return OPERATOR_ROLES.includes(role);
}

export interface PearlUser {
  uid: string;                      // Firebase/Supabase UID or internal ID
  email: string;
  name: string;
  role: UserRole;
  organization?: string;            // e.g. "Anne Arundel County DPW"
  state?: string;                   // e.g. "MD"
  region?: string;                  // e.g. "maryland_middle_branch"
  ms4Jurisdiction?: string;         // e.g. "anne_arundel_county" — admin-bound for operator roles
  avatar?: string;                   // Initials or emoji avatar
  title?: string;                    // Job title, e.g. "Water Quality Manager"
  // ── Auth fields ──
  status: AccountStatus;            // 'active' for explorers, 'pending' until admin approves operators
  isAdmin: boolean;                 // Backward compat — true when adminLevel !== 'none'
  adminLevel: AdminLevel;           // Tiered: super_admin > role_admin > none
  isSuperAdmin: boolean;            // Convenience: adminLevel === 'super_admin'
  isMilitary?: boolean;             // Federal sub-type flag
  createdAt: string;                // ISO timestamp
  invitedBy?: string;               // UID of admin who sent invite (if invite path)
  inviteToken?: string;             // Token used to create account (for audit trail)
  approvedBy?: string;              // UID of admin who approved (for operator accounts)
  approvedAt?: string;              // ISO timestamp of approval
  lastLoginAt?: string;             // ISO timestamp
}

/** Invite token payload — encoded into the invite URL */
export interface InvitePayload {
  role: UserRole;
  jurisdiction?: string;            // Pre-bound jurisdiction for MS4/State
  state?: string;                   // Pre-set state
  organization?: string;            // Pre-filled org name
  invitedBy: string;                // Admin UID
  email?: string;                   // Optional — lock to specific email
  isMilitary?: boolean;             // Federal sub-type flag
  createdAt: string;                // ISO timestamp
  expiresAt: string;                // ISO timestamp — default 7 days
}

/** Pending user row for admin approval panel */
export interface PendingUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  organization?: string;
  state?: string;
  requestedJurisdiction?: string;   // What they asked for
  createdAt: string;
}

// ─── Admin list — loaded from environment variables for security ──────────────

// Admin access is now purely database-driven via the admin_level column in Supabase profiles.
// No environment variable fallback - all admin management goes through the UI and database.

/** Resolve effective admin level from database only — no environment variable fallback */
export function resolveAdminLevel(dbValue: string | undefined | null, email: string): AdminLevel {
  const level = (dbValue || 'none') as AdminLevel;
  if (level === 'super_admin' || level === 'role_admin') return level;
  return 'none';
}
