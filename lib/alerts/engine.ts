/* ------------------------------------------------------------------ */
/*  PIN Alerts — Core Dispatch Engine                                 */
/*  Dedup, cooldowns, rate limiting, logging                          */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertLog, DispatchResult } from './types';
import { COOLDOWNS, MAX_EMAILS_PER_HOUR, MAX_ALERT_LOG_SIZE, BLOB_PATHS, DISK_PATHS } from './config';
import { loadRecipients, getRecipientsForAlert } from './recipients';
import { loadSuppressions, isSuppressed } from './suppressions';
import {
  loadSiteThrottleState, saveSiteThrottleState, updateSiteBreaches,
  extractSiteKey, shouldThrottle, markSiteFired, purgeStaleSiteEntries,
} from './siteThrottle';
import { sendAlertEmail } from './channels/email';
import { enrichAlertPayload } from './enrichment';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';
import { loadCacheFromDisk, saveCacheToDisk } from '../cacheUtils';

/* ------------------------------------------------------------------ */
/*  Alert Log Persistence                                             */
/* ------------------------------------------------------------------ */

let _log: AlertLog | null = null;
let _logDiskLoaded = false;
let _logBlobChecked = false;

function defaultLog(): AlertLog {
  return { events: [], lastDispatchAt: null, totalSent: 0, totalSuppressed: 0, totalThrottled: 0, totalErrors: 0, totalLogged: 0 };
}

function ensureLogDiskLoaded(): void {
  if (_logDiskLoaded) return;
  _logDiskLoaded = true;
  const data = loadCacheFromDisk<AlertLog>(DISK_PATHS.alertLog);
  if (data && data.events) _log = data;
}

export async function loadAlertLog(): Promise<AlertLog> {
  ensureLogDiskLoaded();
  if (_log) return _log;

  if (!_logBlobChecked) {
    _logBlobChecked = true;
    const data = await loadCacheFromBlob<AlertLog>(BLOB_PATHS.alertLog);
    if (data && data.events) {
      _log = data;
      saveCacheToDisk(DISK_PATHS.alertLog, data);
      return _log;
    }
  }

  _log = defaultLog();
  return _log;
}

async function saveAlertLog(log: AlertLog): Promise<void> {
  _log = log;
  saveCacheToDisk(DISK_PATHS.alertLog, log);
  await saveCacheToBlob(BLOB_PATHS.alertLog, log);
}

/* ------------------------------------------------------------------ */
/*  Cooldown Check                                                    */
/* ------------------------------------------------------------------ */

function isInCooldown(dedupKey: string, severity: AlertEvent['severity'], log: AlertLog): boolean {
  const window = COOLDOWNS[severity];
  const cutoff = Date.now() - window;

  return log.events.some(
    e => e.dedupKey === dedupKey && e.sent && e.sentAt && new Date(e.sentAt).getTime() > cutoff,
  );
}

/* ------------------------------------------------------------------ */
/*  Rate Limit Check                                                  */
/* ------------------------------------------------------------------ */

function countSentThisHour(log: AlertLog): number {
  const oneHourAgo = Date.now() - 60 * 60_000;
  return log.events.filter(
    e => e.sent && e.sentAt && new Date(e.sentAt).getTime() > oneHourAgo,
  ).length;
}

/* ------------------------------------------------------------------ */
/*  Dispatch                                                          */
/* ------------------------------------------------------------------ */

export async function dispatchAlerts(candidateEvents: AlertEvent[]): Promise<DispatchResult> {
  const log = await loadAlertLog();
  const suppressions = await loadSuppressions();
  const recipients = await loadRecipients();

  // Load site throttle state and update breach counters for this run
  const siteState = await loadSiteThrottleState();
  updateSiteBreaches(candidateEvents, siteState);

  const result: DispatchResult = { sent: 0, suppressed: 0, errors: 0, rateLimited: 0, logged: 0, throttled: 0 };
  let sentThisHour = countSentThisHour(log);

  for (const candidate of candidateEvents) {
    // 1. Suppression check
    if (isSuppressed(candidate.dedupKey, suppressions)) {
      result.suppressed++;
      log.totalSuppressed++;
      continue;
    }

    // 2. Cooldown check (exact-match dedup)
    if (isInCooldown(candidate.dedupKey, candidate.severity, log)) {
      result.suppressed++;
      continue;
    }

    // 3. Site-level throttle (persistence + cooldown + recovery)
    const siteKey = extractSiteKey(candidate.dedupKey);
    if (shouldThrottle(siteKey, candidate.severity, siteState)) {
      result.throttled++;
      log.totalThrottled = (log.totalThrottled || 0) + 1;
      continue;
    }

    // 4. Get matching recipients
    const matchedRecipients = getRecipientsForAlert(candidate.type, candidate.severity, recipients);
    if (matchedRecipients.length === 0) continue;

    // 5. Send to each recipient
    let candidateDispatched = false;
    for (const recipient of matchedRecipients) {
      // Rate limit check
      if (sentThisHour >= MAX_EMAILS_PER_HOUR) {
        result.rateLimited++;
        continue;
      }

      const event: AlertEvent = {
        ...candidate,
        id: crypto.randomUUID(),
        recipientEmail: recipient.email,
      };

      // Enrich sentinel/usgs/coordination alerts with contextual data
      const enrichableTypes = new Set(['sentinel', 'usgs', 'coordination', 'nwss', 'flood_forecast']);
      let enrichment;
      try {
        if (enrichableTypes.has(event.type)) {
          enrichment = enrichAlertPayload(event);
        }
      } catch {
        // Enrichment is best-effort — don't block dispatch
      }

      const sendResult = await sendAlertEmail(event, enrichment);

      if (sendResult.logOnly) {
        // LOG_ONLY mode: mark as "logged" — not sent, not an error
        event.sent = false;
        event.sentAt = new Date().toISOString();
        event.error = 'log_only';
        result.logged++;
        log.totalLogged = (log.totalLogged || 0) + 1;
        candidateDispatched = true;
      } else if (sendResult.success) {
        event.sent = true;
        event.sentAt = new Date().toISOString();
        event.error = null;
        result.sent++;
        log.totalSent++;
        sentThisHour++;
        candidateDispatched = true;
      } else {
        event.sent = false;
        event.sentAt = null;
        event.error = sendResult.error || null;
        result.errors++;
        log.totalErrors++;
      }

      log.events.push(event);
    }

    // Mark site as fired so cooldown starts for this site+parameter
    if (candidateDispatched) {
      markSiteFired(siteKey, siteState);
    }
  }

  // Trim log to max size (FIFO)
  if (log.events.length > MAX_ALERT_LOG_SIZE) {
    log.events = log.events.slice(-MAX_ALERT_LOG_SIZE);
  }

  log.lastDispatchAt = new Date().toISOString();
  await saveAlertLog(log);

  // Persist site throttle state
  purgeStaleSiteEntries(siteState);
  await saveSiteThrottleState(siteState);

  return result;
}
