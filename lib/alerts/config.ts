/**
 * PIN Alerts — Configuration
 *
 * Centralizes all alert system constants: feature flags, email settings,
 * cooldown windows, rate limits, and blob/disk persistence paths.
 */

import type { AlertSeverity } from './types';

/* ------------------------------------------------------------------ */
/*  Feature Flags (env-var driven)                                    */
/* ------------------------------------------------------------------ */

/** Runtime feature flags read from environment variables. */
export const ALERT_FLAGS = {
  get ENABLED()       { return process.env.PIN_ALERTS_ENABLED === 'true'; },
  get EMAIL_ENABLED() { return process.env.PIN_ALERTS_EMAIL !== 'false'; },
  get LOG_ONLY()      { return process.env.PIN_ALERTS_LOG_ONLY === 'true'; },
};

/* ------------------------------------------------------------------ */
/*  Resend                                                            */
/* ------------------------------------------------------------------ */

/** Resend API key for sending alert emails. */
export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
/** Sender email address for alert notifications. */
export const ALERT_FROM_EMAIL = process.env.ALERT_FROM_EMAIL || 'alerts@pin-dashboard.com';
/** Display name for the alert email sender. */
export const ALERT_FROM_NAME = 'PIN Dashboard Alerts';

/* ------------------------------------------------------------------ */
/*  Cooldowns & Rate Limits                                           */
/* ------------------------------------------------------------------ */

/** Per-severity cooldown windows (ms) before the same dedupKey can fire again. */
export const COOLDOWNS: Record<AlertSeverity, number> = {
  anomaly:   5 * 60_000,   // 5 min
  critical: 15 * 60_000,   // 15 min
  warning:  60 * 60_000,   // 1 hr
  info:    240 * 60_000,   // 4 hr
};

/** Site-level cooldown before the same site can trigger another alert (4 hours). */
export const SITE_COOLDOWN_MS = 4 * 60 * 60_000;
/** Number of consecutive dispatch runs a critical alert must persist before escalation. */
export const CRITICAL_PERSISTENCE_THRESHOLD = 2;
/** Gap (ms) after which a site is considered recovered (10 min = 2 missed runs). */
export const RECOVERY_GAP_MS = 10 * 60_000;

/** Maximum emails per hour (Resend free tier safety limit). */
export const MAX_EMAILS_PER_HOUR = 20;
/** Maximum alert events retained in the log (FIFO trim). */
export const MAX_ALERT_LOG_SIZE = 500;

/* ------------------------------------------------------------------ */
/*  Blob / Disk Paths                                                 */
/* ------------------------------------------------------------------ */

/** Vercel Blob storage paths for alert system persistence. */
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
  floodForecastSnapshot: 'alerts/flood-forecast-snapshot.json',
  deploymentSnapshot:    'alerts/deployment-snapshot.json',
  habSnapshot:           'alerts/hab-snapshot.json',
  beaconSnapshot:        'alerts/beacon-snapshot.json',
  fusionSnapshot:        'alerts/fusion-snapshot.json',
  firmsSnapshot:         'alerts/firms-snapshot.json',
  nwsWeatherSnapshot:    'alerts/nws-weather-snapshot.json',
  siteThrottle:          'alerts/site-throttle.json',
};

/** Local disk paths (under `.cache/`) for alert system persistence. */
export const DISK_PATHS = {
  alertLog:          'alert-log.json',
  recipients:        'alert-recipients.json',
};

/* ------------------------------------------------------------------ */
/*  Build Lock                                                        */
/* ------------------------------------------------------------------ */

/** Auto-clear timeout for alert build locks (5 min for fast cron cycle). */
export const BUILD_LOCK_TIMEOUT_MS = 5 * 60_000;
