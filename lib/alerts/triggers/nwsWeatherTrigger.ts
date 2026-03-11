/* ------------------------------------------------------------------ */
/*  PIN Alerts — NWS Severe Weather Trigger                           */
/*                                                                    */
/*  Cross-correlates NWS severe weather warnings with military        */
/*  installations to detect:                                          */
/*    1. Tornado Warning near CONUS installation    (critical, 25mi)  */
/*    2. Flash Flood Warning near CONUS installation (warning, 10mi)  */
/*                                                                    */
/*  Cooldown: 4 hours per installation+alert pattern.                 */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import {
  ensureWarmed as warmNwsAlerts,
  getNwsAlertsAll,
  type NwsAlert,
} from '../../nwsAlertCache';
import { haversineMi } from '../../geoUtils';

import installationsJson from '@/data/military-installations.json';

/* ------------------------------------------------------------------ */
/*  Types & Constants                                                  */
/* ------------------------------------------------------------------ */

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  burnPitHistory: boolean;
}

const INSTALLATIONS: Installation[] = installationsJson as Installation[];

/** CONUS installations + Pearl Harbor (covered by NWS despite indo-pacific region). */
const NWS_ELIGIBLE_INSTALLATIONS = INSTALLATIONS.filter(
  i => i.region === 'conus' || i.id === 'pearl-harbor-hickam',
);

interface NwsWeatherSnapshot {
  lastAlertedAt: Record<string, string>; // dedupKey → ISO timestamp
  takenAt: string;
}

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours
const SNAPSHOT_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours

/* ------------------------------------------------------------------ */
/*  Alert Pattern Definitions                                          */
/* ------------------------------------------------------------------ */

interface AlertPattern {
  id: string;
  eventMatches: string[];          // lowercase partial matches on NWS event type
  radiusMi: number;
  severity: 'critical' | 'warning';
  titleTemplate: (inst: Installation, alert: NwsAlert, distMi: number) => string;
  bodyTemplate: (inst: Installation, alert: NwsAlert, distMi: number) => string;
}

const PATTERNS: AlertPattern[] = [
  {
    id: 'tornado',
    eventMatches: ['tornado warning', 'tornado emergency'],
    radiusMi: 25,
    severity: 'critical',
    titleTemplate: (inst, alert, dist) =>
      `Tornado Warning near ${inst.name}`,
    bodyTemplate: (inst, alert, dist) =>
      `NWS ${alert.event} active within ${dist.toFixed(1)}mi of ${inst.name} (${inst.branch}). ` +
      `${alert.headline || alert.areaDesc}. Personnel should take shelter immediately.`,
  },
  {
    id: 'flash_flood',
    eventMatches: ['flash flood warning', 'flash flood emergency'],
    radiusMi: 10,
    severity: 'warning',
    titleTemplate: (inst, alert, dist) =>
      `Flash Flood Warning near ${inst.name}`,
    bodyTemplate: (inst, alert, dist) =>
      `NWS ${alert.event} active within ${dist.toFixed(1)}mi of ${inst.name} (${inst.branch}). ` +
      `${alert.headline || alert.areaDesc}. Monitor water levels and drainage infrastructure.`,
  },
];

/* ------------------------------------------------------------------ */
/*  Cooldown Helper                                                    */
/* ------------------------------------------------------------------ */

function inCooldown(
  key: string,
  prevAlerted: Record<string, string>,
  now: Date,
): boolean {
  const lastAlerted = prevAlerted[key];
  if (!lastAlerted) return false;
  return now.getTime() - new Date(lastAlerted).getTime() < COOLDOWN_MS;
}

/* ------------------------------------------------------------------ */
/*  Main Entry Point                                                   */
/* ------------------------------------------------------------------ */

export async function evaluateNwsWeatherAlerts(): Promise<AlertEvent[]> {
  // 1. Warm cache
  await warmNwsAlerts();

  // 2. Pull all non-expired NWS alerts
  const allAlerts = getNwsAlertsAll();
  if (allAlerts.length === 0) return [];

  // 3. Load cooldown snapshot
  const prevSnapshot = await loadCacheFromBlob<NwsWeatherSnapshot>(
    BLOB_PATHS.nwsWeatherSnapshot,
  );
  const prevAlerted = prevSnapshot?.lastAlertedAt ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const newAlerted: Record<string, string> = {};

  // Carry forward non-expired entries
  for (const [key, ts] of Object.entries(prevAlerted)) {
    if (nowMs - new Date(ts).getTime() < SNAPSHOT_EXPIRY_MS) {
      newAlerted[key] = ts;
    }
  }

  const events: AlertEvent[] = [];

  // 4. For each pattern, check each installation against matching alerts
  for (const pattern of PATTERNS) {
    // Pre-filter alerts matching this pattern's event types
    const matchingAlerts = allAlerts.filter(a => {
      const lower = a.event.toLowerCase();
      return pattern.eventMatches.some(m => lower.includes(m));
    });

    if (matchingAlerts.length === 0) continue;

    for (const inst of NWS_ELIGIBLE_INSTALLATIONS) {
      // Find closest matching alert within radius
      let closestAlert: NwsAlert | null = null;
      let closestDist = Infinity;

      for (const alert of matchingAlerts) {
        if (alert.centroidLat == null || alert.centroidLng == null) continue;
        const dist = haversineMi(inst.lat, inst.lng, alert.centroidLat, alert.centroidLng);
        if (dist <= pattern.radiusMi && dist < closestDist) {
          closestDist = dist;
          closestAlert = alert;
        }
      }

      if (!closestAlert) continue;

      const dedupKey = `nws_weather:${pattern.id}:${inst.id}:${pattern.severity}`;
      if (inCooldown(dedupKey, newAlerted, now)) continue;

      events.push({
        id: crypto.randomUUID(),
        type: 'nws_weather',
        severity: pattern.severity,
        title: pattern.titleTemplate(inst, closestAlert, closestDist),
        body: pattern.bodyTemplate(inst, closestAlert, closestDist),
        entityId: inst.id,
        entityLabel: `${inst.name} — ${closestAlert.event}`,
        dedupKey,
        createdAt: nowIso,
        channel: 'email',
        recipientEmail: '',
        sent: false,
        sentAt: null,
        error: null,
        ruleId: null,
        metadata: {
          pattern: pattern.id,
          installation: inst.name,
          installationId: inst.id,
          branch: inst.branch,
          nwsEvent: closestAlert.event,
          nwsAlertId: closestAlert.id,
          distanceMi: Math.round(closestDist * 10) / 10,
          areaDesc: closestAlert.areaDesc,
        },
      });
      newAlerted[dedupKey] = nowIso;
    }
  }

  // 5. Save updated cooldown snapshot
  await saveCacheToBlob(BLOB_PATHS.nwsWeatherSnapshot, {
    lastAlertedAt: newAlerted,
    takenAt: nowIso,
  });

  return events;
}
