/* ------------------------------------------------------------------ */
/*  PIN Alerts — USGS IV Threshold Alert Trigger                      */
/*                                                                    */
/*  Maps UsgsAlert[] from usgsAlertCache → AlertEvent[] for the       */
/*  PIN alert dispatch pipeline.                                      */
/*                                                                    */
/*  Cooldown: snapshot-based (same pattern as sentinelTrigger).       */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertSeverity } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { getAllAlerts, ensureWarmed } from '../../usgsAlertCache';
import type { UsgsAlert } from '../../usgsAlertEngine';

/* ------------------------------------------------------------------ */
/*  Snapshot — tracks which USGS alerts we've already dispatched      */
/* ------------------------------------------------------------------ */

interface UsgsAlertSnapshot {
  /** alertId → last dispatched ISO timestamp */
  dispatched: Record<string, string>;
  takenAt: string;
}

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per alert

/* ------------------------------------------------------------------ */
/*  Severity Mapping                                                  */
/* ------------------------------------------------------------------ */

function mapSeverity(usgsLevel: 'critical' | 'warning'): AlertSeverity {
  switch (usgsLevel) {
    case 'critical': return 'critical';
    case 'warning':  return 'warning';
    default:         return 'info';
  }
}

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateUsgsAlerts(): Promise<AlertEvent[]> {
  await ensureWarmed();

  const allAlerts = getAllAlerts();
  if (allAlerts.length === 0) return [];

  const previousSnapshot = await loadCacheFromBlob<UsgsAlertSnapshot>(BLOB_PATHS.usgsSnapshot);
  const prevDispatched = previousSnapshot?.dispatched ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const events: AlertEvent[] = [];
  const newDispatched: Record<string, string> = { ...prevDispatched };

  for (const alert of allAlerts) {
    const dedupKey = `usgs-iv-${alert.siteNumber}-${alert.parameterCd}-${alert.severity}`;

    // Cooldown check — 1 hour per site+param+severity
    const lastDispatched = prevDispatched[dedupKey];
    if (lastDispatched && (now.getTime() - new Date(lastDispatched).getTime()) < COOLDOWN_MS) {
      continue;
    }

    const severity = mapSeverity(alert.severity);

    events.push({
      id: crypto.randomUUID(),
      type: 'usgs',
      severity,
      title: alert.title,
      body: alert.message,
      entityId: alert.siteNumber,
      entityLabel: `${alert.siteName} (${alert.state})`,
      dedupKey,
      createdAt: nowIso,
      channel: 'email',
      recipientEmail: '',
      sent: false,
      sentAt: null,
      error: null,
      ruleId: null,
      metadata: {
        siteNumber: alert.siteNumber,
        parameter: alert.parameter,
        parameterCd: alert.parameterCd,
        value: alert.value,
        unit: alert.unit,
        threshold: alert.threshold,
        alertType: alert.type,
        readingTime: alert.readingTime,
        lat: alert.lat,
        lng: alert.lng,
      },
    });

    newDispatched[dedupKey] = nowIso;
  }

  // Expire old snapshot entries (>24h)
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(newDispatched)) {
    if (new Date(ts).getTime() < cutoff) {
      delete newDispatched[key];
    }
  }

  await saveCacheToBlob(BLOB_PATHS.usgsSnapshot, {
    dispatched: newDispatched,
    takenAt: nowIso,
  });

  return events;
}
