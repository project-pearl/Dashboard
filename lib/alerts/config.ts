/* ------------------------------------------------------------------ */
/*  PIN Alerts — Configuration                                        */
/* ------------------------------------------------------------------ */

import type { AlertSeverity } from './types';

/* ------------------------------------------------------------------ */
/*  Feature Flags (env-var driven)                                    */
/* ------------------------------------------------------------------ */

export const ALERT_FLAGS = {
  get ENABLED()       { return process.env.PIN_ALERTS_ENABLED === 'true'; },
  get EMAIL_ENABLED() { return process.env.PIN_ALERTS_EMAIL !== 'false'; },
  get LOG_ONLY()      { return process.env.PIN_ALERTS_LOG_ONLY === 'true'; },
};

/* ------------------------------------------------------------------ */
/*  Resend                                                            */
/* ------------------------------------------------------------------ */

export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
export const ALERT_FROM_EMAIL = process.env.ALERT_FROM_EMAIL || 'alerts@pin-dashboard.com';
export const ALERT_FROM_NAME = 'PIN Dashboard Alerts';

/* ------------------------------------------------------------------ */
/*  Cooldowns & Rate Limits                                           */
/* ------------------------------------------------------------------ */

export const COOLDOWNS: Record<AlertSeverity, number> = {
  critical: 15 * 60_000,   // 15 min
  warning:  60 * 60_000,   // 1 hr
  info:    240 * 60_000,   // 4 hr
};

export const MAX_EMAILS_PER_HOUR = 20;          // Resend free tier safety
export const MAX_ALERT_LOG_SIZE = 500;           // keep last 500 events

/* ------------------------------------------------------------------ */
/*  Blob / Disk Paths                                                 */
/* ------------------------------------------------------------------ */

export const BLOB_PATHS = {
  alertLog:          'alerts/alert-log.json',
  recipients:        'alerts/recipients.json',
  rules:             'alerts/rules.json',
  suppressions:      'alerts/suppressions.json',
  attainsSnapshot:   'alerts/attains-snapshot.json',
  sentinelSnapshot:  'alerts/sentinel-snapshot.json',
  nwssSnapshot:      'alerts/nwss-snapshot.json',
  usgsSnapshot:      'alerts/usgs-alert-snapshot.json',
  coordinationSnapshot: 'alerts/coordination-snapshot.json',
};

export const DISK_PATHS = {
  alertLog:          'alert-log.json',
  recipients:        'alert-recipients.json',
};

/* ------------------------------------------------------------------ */
/*  Build Lock                                                        */
/* ------------------------------------------------------------------ */

export const BUILD_LOCK_TIMEOUT_MS = 5 * 60_000; // 5 min (fast cron)
