/**
 * PIN Outreach — Configuration
 *
 * Feature flags, email settings, rate limits, and blob/disk paths.
 */

/* ------------------------------------------------------------------ */
/*  Feature Flags (env-var driven)                                    */
/* ------------------------------------------------------------------ */

export const OUTREACH_FLAGS = {
  get ENABLED()       { return process.env.PIN_OUTREACH_ENABLED !== 'false'; },
  get LOG_ONLY()      { return process.env.PIN_OUTREACH_LOG_ONLY === 'true'; },
};

/* ------------------------------------------------------------------ */
/*  Resend (reuses same API key as alerts)                            */
/* ------------------------------------------------------------------ */

export const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
export const OUTREACH_FROM_EMAIL = process.env.OUTREACH_FROM_EMAIL || 'outreach@pin-dashboard.com';
export const OUTREACH_FROM_NAME = 'PIN — PEARL Intelligence Network';

/* ------------------------------------------------------------------ */
/*  Rate Limits                                                       */
/* ------------------------------------------------------------------ */

/** Max AI generation requests per minute per user. */
export const AI_RATE_LIMIT = 5;
/** Max outreach emails per hour. */
export const MAX_OUTREACH_EMAILS_PER_HOUR = 50;

/* ------------------------------------------------------------------ */
/*  Blob / Disk Paths                                                 */
/* ------------------------------------------------------------------ */

export const BLOB_PATHS = {
  profile:   'outreach/business-profile.json',
  segments:  'outreach/segments.json',
  campaigns: 'outreach/campaigns.json',
  contacts:  'outreach/contacts.json',
  sendLog:   'outreach/send-log.json',
};

export const DISK_PATHS = {
  profile:   'outreach-profile.json',
  segments:  'outreach-segments.json',
  campaigns: 'outreach-campaigns.json',
  contacts:  'outreach-contacts.json',
  sendLog:   'outreach-send-log.json',
};
