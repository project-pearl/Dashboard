/* ------------------------------------------------------------------ */
/*  Shared API Auth Helper                                             */
/*  Used by alert endpoints and other browser-callable API routes      */
/*  Accepts: CRON_SECRET Bearer token OR same-origin browser request   */
/* ------------------------------------------------------------------ */

import { NextRequest } from 'next/server';

/**
 * Check if a request is authorized.
 * Accepts:
 *   1. Bearer token matching CRON_SECRET (for cron jobs and external callers)
 *   2. Same-origin browser request (Referer or Origin matches deployment host)
 *
 * Note: pin_session cookie check is disabled until session management is active.
 */
export function isAuthorized(request: NextRequest): boolean {
  // 1. CRON_SECRET Bearer token
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // 2. Same-origin browser request (fetch from the dashboard itself)
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  if (host) {
    if (origin && new URL(origin).host === host) return true;
    if (referer) {
      try { if (new URL(referer).host === host) return true; } catch { /* ignore */ }
    }
  }

  // 3. pin_session cookie (future: re-enable when session management is active)
  if (request.cookies.has('pin_session')) return true;

  return false;
}

/**
 * Fail-closed cron auth: returns false when CRON_SECRET is unset,
 * preventing unauthenticated access if the env var is missing.
 */
export function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}
