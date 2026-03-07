// lib/adminHierarchy.ts
// Role hierarchy and scope enforcement for invite delegation.

import type { UserRole } from './authTypes';
import { OPERATOR_ROLES, EXPLORER_ROLES } from './authTypes';

export type AdminLevel = 'super_admin' | 'role_admin' | 'none';

const ALL_ROLES: UserRole[] = [...OPERATOR_ROLES, ...EXPLORER_ROLES];

// Which roles each admin+role combination can invite
const INVITABLE_ROLES: Record<string, UserRole[]> = {
  'super_admin:any':       ALL_ROLES,
  'role_admin:Federal':    ['Federal', 'State', 'Local', 'MS4'],
  'role_admin:State':      ['State', 'Local', 'MS4'],
  'role_admin:Local':      ['Local'],
  'role_admin:MS4':        ['MS4', 'Local'],
  'role_admin:Corporate':  ['Corporate'],
  'role_admin:Utility':    ['Utility'],
  'role_admin:K12':        ['K12'],
  'role_admin:College':    ['College'],
  'role_admin:Researcher': ['Researcher'],
  'role_admin:NGO':        ['NGO'],
  'role_admin:Agriculture':['Agriculture'],
  'role_admin:Lab':        ['Lab'],
  'role_admin:Biotech':    ['Biotech'],
  'role_admin:Investor':   ['Investor'],
};

/** Get the list of roles this admin can invite. */
export function getInvitableRoles(level: AdminLevel, callerRole: UserRole): UserRole[] {
  if (level === 'none') return [];
  if (level === 'super_admin') return INVITABLE_ROLES['super_admin:any'];
  return INVITABLE_ROLES[`role_admin:${callerRole}`] || [];
}

interface CallerScope {
  adminLevel: AdminLevel;
  role: UserRole;
  state?: string;
  jurisdiction?: string;
}

interface TargetScope {
  role: UserRole;
  state?: string;
  jurisdiction?: string;
  adminLevel?: AdminLevel;
}

/** Check whether caller can invite a user with target role + scope. */
export function canInviteRole(
  caller: CallerScope,
  target: TargetScope,
): { ok: boolean; reason?: string } {
  // No invite capability
  if (caller.adminLevel === 'none') {
    return { ok: false, reason: 'You do not have invite permissions.' };
  }

  // Only super_admin can grant admin privileges
  if (target.adminLevel && target.adminLevel !== 'none' && caller.adminLevel !== 'super_admin') {
    return { ok: false, reason: 'Only super admins can grant admin privileges.' };
  }

  // Check role is in invitable list
  const allowed = getInvitableRoles(caller.adminLevel, caller.role);
  if (!allowed.includes(target.role)) {
    return { ok: false, reason: `Your admin level cannot invite ${target.role} users.` };
  }

  // Super admins have no scope constraints
  if (caller.adminLevel === 'super_admin') {
    return { ok: true };
  }

  // Federal role_admins can invite to any state
  if (caller.role === 'Federal') {
    return { ok: true };
  }

  // State constraint: non-Federal role_admins must match their own state
  if (caller.state && target.state && target.state !== caller.state) {
    return { ok: false, reason: `You can only invite users within your state (${caller.state}).` };
  }

  // Jurisdiction constraint for Local/MS4 role_admins
  if ((caller.role === 'Local' || caller.role === 'MS4') && caller.jurisdiction) {
    if (target.jurisdiction && target.jurisdiction !== caller.jurisdiction) {
      return { ok: false, reason: `You can only invite users within your jurisdiction (${caller.jurisdiction}).` };
    }
  }

  return { ok: true };
}
