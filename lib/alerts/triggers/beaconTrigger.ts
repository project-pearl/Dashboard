/* ------------------------------------------------------------------ */
/*  PIN Alerts — EPA BEACON Beach Advisory Trigger                    */
/*                                                                    */
/*  Evaluates beach advisories/closures and generates alerts based    */
/*  on EPA recreational water quality criteria thresholds.            */
/*                                                                    */
/*  Cooldown: 24 hours per beach+indicator.                           */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { ensureWarmed, getBeaconAll, type BeachAdvisory } from '../../beaconCache';

/* ------------------------------------------------------------------ */
/*  Indicator Thresholds (CFU per 100mL)                              */
/* ------------------------------------------------------------------ */

interface IndicatorThreshold {
  warning: number;
  critical: number;
}

const INDICATOR_THRESHOLDS: Record<string, IndicatorThreshold> = {
  'e. coli':       { warning: 235, critical: 576 },  // STV
  'enterococcus':  { warning:  70, critical: 130 },
  'fecal coliform': { warning: 400, critical: 800 },
};

function getIndicatorThreshold(indicator: string): IndicatorThreshold | null {
  const lower = indicator.toLowerCase();
  for (const [key, val] of Object.entries(INDICATOR_THRESHOLDS)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Snapshot — tracks which beaches we've alerted on                  */
/* ------------------------------------------------------------------ */

interface BeaconAlertSnapshot {
  /** beachId_indicator → last alert ISO timestamp */
  lastAlertedAt: Record<string, string>;
  takenAt: string;
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateBeaconAlerts(): Promise<AlertEvent[]> {
  await ensureWarmed();

  const advisories = getBeaconAll();
  if (advisories.length === 0) return [];

  const previousSnapshot = await loadCacheFromBlob<BeaconAlertSnapshot>(BLOB_PATHS.beaconSnapshot);
  const prevAlerted = previousSnapshot?.lastAlertedAt ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const events: AlertEvent[] = [];
  const newAlerted: Record<string, string> = { ...prevAlerted };

  for (const adv of advisories) {
    const isClosed = adv.advisoryStatus === 'closed';
    const threshold = getIndicatorThreshold(adv.indicator);

    // Beach closures are always critical alerts
    if (isClosed) {
      const key = `${adv.beachId}_closure`;

      // Cooldown check
      const lastAlerted = prevAlerted[key];
      if (lastAlerted && (now.getTime() - new Date(lastAlerted).getTime()) < COOLDOWN_MS) {
        continue;
      }

      events.push({
        id: crypto.randomUUID(),
        type: 'beacon',
        severity: 'critical',
        title: `Beach closed — ${adv.beachName}, ${adv.state}`,
        body: `${adv.beachName} in ${adv.state} has been closed. ` +
          (adv.indicator ? `Indicator: ${adv.indicator}. ` : '') +
          (adv.value > 0 ? `Value: ${adv.value} CFU/100mL. ` : ''),
        entityId: adv.beachId,
        entityLabel: `${adv.beachName}, ${adv.state}`,
        dedupKey: `beacon:${adv.beachId}:closure:critical`,
        createdAt: nowIso,
        channel: 'email',
        recipientEmail: '',
        sent: false,
        sentAt: null,
        error: null,
        ruleId: null,
        metadata: {
          beachId: adv.beachId,
          beachName: adv.beachName,
          state: adv.state,
          indicator: adv.indicator,
          value: adv.value,
          advisoryStatus: adv.advisoryStatus,
          lat: adv.lat,
          lng: adv.lng,
          sampleDate: adv.sampleDate,
        },
      });

      newAlerted[key] = nowIso;
      continue;
    }

    // Threshold-based alerts for non-closure advisories
    if (!threshold || adv.value <= 0) continue;
    if (adv.value < threshold.warning) continue;

    const key = `${adv.beachId}_${adv.indicator}`;

    // Cooldown check
    const lastAlerted = prevAlerted[key];
    if (lastAlerted && (now.getTime() - new Date(lastAlerted).getTime()) < COOLDOWN_MS) {
      continue;
    }

    const severity = adv.value >= threshold.critical ? 'critical' : 'warning';

    events.push({
      id: crypto.randomUUID(),
      type: 'beacon',
      severity,
      title: `${adv.indicator} ${severity === 'critical' ? 'exceedance' : 'elevated'} — ${adv.beachName}, ${adv.state}`,
      body: `${adv.beachName} in ${adv.state}: ${adv.indicator} at ${adv.value} CFU/100mL ` +
        `(warning: ${threshold.warning}, critical: ${threshold.critical}).`,
      entityId: adv.beachId,
      entityLabel: `${adv.beachName}, ${adv.state}`,
      dedupKey: `beacon:${adv.beachId}:${adv.indicator}:${severity}`,
      createdAt: nowIso,
      channel: 'email',
      recipientEmail: '',
      sent: false,
      sentAt: null,
      error: null,
      ruleId: null,
      metadata: {
        beachId: adv.beachId,
        beachName: adv.beachName,
        state: adv.state,
        indicator: adv.indicator,
        value: adv.value,
        warningThreshold: threshold.warning,
        criticalThreshold: threshold.critical,
        advisoryStatus: adv.advisoryStatus,
        lat: adv.lat,
        lng: adv.lng,
        sampleDate: adv.sampleDate,
      },
    });

    newAlerted[key] = nowIso;
  }

  // Save updated snapshot
  await saveCacheToBlob(BLOB_PATHS.beaconSnapshot, {
    lastAlertedAt: newAlerted,
    takenAt: nowIso,
  });

  return events;
}
