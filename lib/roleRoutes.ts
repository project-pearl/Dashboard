// ─── Role → Route Configuration ──────────────────────────────────────────────
// Maps each UserRole to its primary dashboard page and allowed route prefixes.
// Pearl (admin) bypasses all restrictions.

import { normalizeUserRole, type PearlUser, type UserRole } from './authTypes';

// ─── Primary route per role (may contain placeholders resolved at runtime) ───

const ROLE_PRIMARY_ROUTE: Record<UserRole, string> = {
  Federal:    '/dashboard/federal',
  State:      '/dashboard/state/{state}',
  Local:      '/dashboard/local/{jurisdictionId}',
  MS4:        '/dashboard/ms4/{ms4Jurisdiction}',
  Corporate:  '/dashboard/esg',
  Utility:    '/dashboard/utility/{systemId}',
  Agriculture:'/dashboard/infrastructure',
  Lab:        '/dashboard/aqua-lo',
  Biotech:    '/dashboard/biotech',
  Investor:   '/dashboard/investor',
  K12:        '/dashboard/k12',
  College:    '/dashboard/university',
  Researcher: '/dashboard/university',
  NGO:        '/dashboard/ngo',
  Temp:       '/dashboard/k12',
  Pearl:      '/dashboard/pearl',
};

// ─── Allowed route prefixes per role ─────────────────────────────────────────

const ROLE_ALLOWED_ROUTES: Record<UserRole, string[]> = {
  Federal:    ['/dashboard/federal'],
  State:      ['/dashboard/state'],
  Local:      ['/dashboard/local'],
  MS4:        ['/dashboard/ms4'],
  Corporate:  ['/dashboard/esg', '/dashboard/site-intelligence'],
  Utility:    ['/dashboard/utility', '/dashboard/infrastructure', '/dashboard/site-intelligence'],
  Agriculture:['/dashboard/infrastructure', '/dashboard/site-intelligence'],
  Lab:        ['/dashboard/aqua-lo'],
  Biotech:    ['/dashboard/biotech', '/dashboard/site-intelligence'],
  Investor:   ['/dashboard/investor', '/dashboard/site-intelligence'],
  K12:        ['/dashboard/k12'],
  College:    ['/dashboard/university'],
  Researcher: ['/dashboard/university'],
  NGO:        ['/dashboard/ngo'],
  Temp:       ['/dashboard/k12'],
  Pearl:      [], // special-cased: admin sees everything
};

// Dashboard routes intentionally open to all authenticated roles.
const GLOBAL_DASHBOARD_ALLOWLIST = ['/dashboard/trivia'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve the primary dashboard route for a given user, filling in dynamic segments. */
export function getPrimaryRoute(user: PearlUser): string {
  const normalizedRole = normalizeUserRole(user.role);
  const template = ROLE_PRIMARY_ROUTE[normalizedRole] ?? '/dashboard/ngo';

  return template
    .replace('{state}', user.state || 'MD')
    .replace('{jurisdictionId}', user.ms4Jurisdiction || 'default')
    .replace('{ms4Jurisdiction}', user.ms4Jurisdiction || 'default')
    .replace('{systemId}', 'default');
}

/** Check whether a user is allowed to access a given pathname. */
export function canAccessRoute(user: PearlUser, pathname: string): boolean {
  const normalizedRole = normalizeUserRole(user.role);

  // Admins and Pearl role can access everything
  if (normalizedRole === 'Pearl' || user.isAdmin) return true;

  // Non-dashboard routes are accessible to everyone
  if (!pathname.startsWith('/dashboard')) return true;

  if (GLOBAL_DASHBOARD_ALLOWLIST.some((prefix) => pathname.startsWith(prefix))) return true;

  const allowed = ROLE_ALLOWED_ROUTES[normalizedRole] ?? [];
  return allowed.some((prefix) => pathname.startsWith(prefix));
}
