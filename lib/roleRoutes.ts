// ─── Role → Route Configuration ──────────────────────────────────────────────
// Maps each UserRole to its primary dashboard page and allowed route prefixes.
// Pearl (admin) bypasses all restrictions.

import type { PearlUser, UserRole } from './authTypes';

// ─── Primary route per role (may contain placeholders resolved at runtime) ───

const ROLE_PRIMARY_ROUTE: Record<UserRole, string> = {
  Federal:    '/dashboard/federal',
  State:      '/dashboard/state/{state}',
  MS4:        '/dashboard/ms4/{ms4Jurisdiction}',
  Corporate:  '/dashboard/esg',
  Utility:    '/dashboard/utility/{systemId}',
  Agriculture:'/dashboard/infrastructure',
  Lab:        '/dashboard/aqua-lo',
  K12:        '/dashboard/k12',
  College:    '/dashboard/university',
  Researcher: '/dashboard/university',
  NGO:        '/dashboard/ngo',
  Temp:       '/dashboard/k12',
  Pearl:      '/dashboard/federal', // admin default landing
};

// ─── Allowed route prefixes per role ─────────────────────────────────────────

const ROLE_ALLOWED_ROUTES: Record<UserRole, string[]> = {
  Federal:    ['/dashboard/federal', '/dashboard/site-intelligence'],
  State:      ['/dashboard/state', '/dashboard/site-intelligence'],
  MS4:        ['/dashboard/ms4', '/dashboard/site-intelligence'],
  Corporate:  ['/dashboard/esg', '/dashboard/site-intelligence'],
  Utility:    ['/dashboard/utility', '/dashboard/infrastructure', '/dashboard/site-intelligence'],
  Agriculture:['/dashboard/infrastructure', '/dashboard/site-intelligence'],
  Lab:        ['/dashboard/aqua-lo', '/dashboard/site-intelligence'],
  K12:        ['/dashboard/k12', '/dashboard/site-intelligence'],
  College:    ['/dashboard/university', '/dashboard/site-intelligence'],
  Researcher: ['/dashboard/university', '/dashboard/site-intelligence'],
  NGO:        ['/dashboard/ngo', '/dashboard/site-intelligence'],
  Temp:       ['/dashboard/k12', '/dashboard/site-intelligence'],
  Pearl:      [], // special-cased: admin sees everything
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve the primary dashboard route for a given user, filling in dynamic segments. */
export function getPrimaryRoute(user: PearlUser): string {
  const template = ROLE_PRIMARY_ROUTE[user.role] ?? '/dashboard/federal';

  return template
    .replace('{state}', user.state || 'MD')
    .replace('{ms4Jurisdiction}', user.ms4Jurisdiction || 'default')
    .replace('{systemId}', 'default');
}

/** Check whether a user is allowed to access a given pathname. */
export function canAccessRoute(user: PearlUser, pathname: string): boolean {
  // Admins and Pearl role can access everything
  if (user.role === 'Pearl' || user.isAdmin) return true;

  // Non-dashboard routes are accessible to everyone
  if (!pathname.startsWith('/dashboard')) return true;

  const allowed = ROLE_ALLOWED_ROUTES[user.role] ?? [];
  return allowed.some((prefix) => pathname.startsWith(prefix));
}
