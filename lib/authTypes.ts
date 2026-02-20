// ─── Auth Types ─────────────────────────────────────────────────────────────
// Shared types for the PEARL authentication & authorization system.

export type UserRole = 'Federal' | 'State' | 'MS4' | 'Corporate' | 'Researcher' | 'College' | 'NGO' | 'K12' | 'Temp';
export type AccountStatus = 'active' | 'pending' | 'rejected' | 'deactivated';

/** Roles that require admin approval + jurisdiction binding */
export const OPERATOR_ROLES: UserRole[] = ['MS4', 'State', 'Federal', 'Corporate'];
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
  // ── Auth fields ──
  status: AccountStatus;            // 'active' for explorers, 'pending' until admin approves operators
  isAdmin: boolean;                 // Admin capability bit — Doug/Steve/Gwen
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

// ─── Admin list — hardcoded for now, move to DB flag later ──────────────────

export const ADMIN_EMAILS = [
  'doug@project-pearl.org',
  'steve@project-pearl.org',
  'gwen@project-pearl.org',
];

/** Quick check — used by authContext to set isAdmin on login */
export function checkIsAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}
