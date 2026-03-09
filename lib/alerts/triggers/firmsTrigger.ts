/* ------------------------------------------------------------------ */
/*  PIN Alerts — FIRMS Fire Detection Trigger                         */
/*                                                                    */
/*  Cross-correlates NASA FIRMS fire data with military installations */
/*  and air quality cache to detect:                                  */
/*    1. Fire Near Installation — high-confidence fire within 25mi    */
/*    2. Fire + Degraded AQ     — fires in region + AQI > 100        */
/*    3. Burn Pit Zone          — fires within 10mi of burn-pit base  */
/*                                                                    */
/*  Cooldown: 12 hours per region+pattern.                            */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';

import {
  ensureWarmed as warmFirms,
  getFirmsAllRegions,
  type FirmsDetection,
  type FirmsRegionSummary,
} from '../../firmsCache';

import {
  ensureWarmed as warmAirQuality,
  getAirQualityAllStates,
} from '../../airQualityCache';

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

interface FirmsSnapshot {
  lastAlertedAt: Record<string, string>;
  takenAt: string;
}

const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
const NEAR_INSTALLATION_RADIUS_MI = 25;
const BURN_PIT_RADIUS_MI = 10;
const AQI_WARNING_THRESHOLD = 101;
const AQI_CRITICAL_THRESHOLD = 151;
const FIRE_COUNT_CRITICAL_THRESHOLD = 6;
const FRP_CRITICAL_THRESHOLD = 100; // MW

/* ------------------------------------------------------------------ */
/*  Cooldown Helper                                                    */
/* ------------------------------------------------------------------ */

function inCooldown(
  pattern: string,
  region: string,
  prevAlerted: Record<string, string>,
  now: Date,
): boolean {
  const key = `${pattern}|${region}`;
  const lastAlerted = prevAlerted[key];
  if (!lastAlerted) return false;
  return (now.getTime() - new Date(lastAlerted).getTime()) < COOLDOWN_MS;
}

/* ------------------------------------------------------------------ */
/*  Main Entry Point                                                   */
/* ------------------------------------------------------------------ */

export async function evaluateFirmsAlerts(): Promise<AlertEvent[]> {
  // 1. Warm caches
  await Promise.allSettled([warmFirms(), warmAirQuality()]);

  // 2. Pull data
  const allRegions = getFirmsAllRegions();
  const aqStates = getAirQualityAllStates();

  if (allRegions.length === 0) return [];

  // 3. Load cooldown snapshot
  const prevSnapshot = await loadCacheFromBlob<FirmsSnapshot>(BLOB_PATHS.firmsSnapshot);
  const prevAlerted = prevSnapshot?.lastAlertedAt ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const newAlerted: Record<string, string> = { ...prevAlerted };

  // Build max AQI per region by checking state-level readings
  // (rough mapping: use average AQI of all states as proxy for region AQ)
  const maxAqiByRegion = new Map<string, number>();
  for (const reading of aqStates) {
    if (reading.usAqi != null && reading.usAqi > 0) {
      // We'll map all readings to provide region-level AQ later
      // For now, track max across all states as general indicator
      for (const region of allRegions) {
        const current = maxAqiByRegion.get(region.region) ?? 0;
        if (reading.usAqi > current) {
          maxAqiByRegion.set(region.region, reading.usAqi);
        }
      }
    }
  }

  const events: AlertEvent[] = [];

  for (const region of allRegions) {
    if (region.detectionCount === 0) continue;

    // ── Pattern 1: Fire Near Installation ──
    const nearInstallationFires = region.detections.filter(
      d => d.confidence === 'high' && d.distanceToInstallationMi != null && d.distanceToInstallationMi <= NEAR_INSTALLATION_RADIUS_MI
    );

    if (nearInstallationFires.length > 0 && !inCooldown('fire_near_installation', region.region, prevAlerted, now)) {
      const isCritical = nearInstallationFires.length >= FIRE_COUNT_CRITICAL_THRESHOLD ||
        nearInstallationFires.some(f => f.frp > FRP_CRITICAL_THRESHOLD);
      const severity = isCritical ? 'critical' : 'warning';

      const affectedBases = [...new Set(nearInstallationFires.map(f => f.nearestInstallation).filter(Boolean))];
      const closestDist = Math.min(...nearInstallationFires.map(f => f.distanceToInstallationMi ?? 999));

      events.push({
        id: crypto.randomUUID(),
        type: 'firms',
        severity,
        title: `Fire near military installation — ${region.label}`,
        body: `${nearInstallationFires.length} high-confidence fire detection(s) within ${NEAR_INSTALLATION_RADIUS_MI}mi of ` +
          `${affectedBases.join(', ')}. Closest fire: ${closestDist.toFixed(1)}mi. ` +
          `Max FRP: ${Math.max(...nearInstallationFires.map(f => f.frp)).toFixed(1)} MW.`,
        entityId: region.region,
        entityLabel: `${region.label} — Fire Near Installation`,
        dedupKey: `firms|fire_near_installation|${region.region}|${severity}`,
        createdAt: nowIso,
        channel: 'email',
        recipientEmail: '',
        sent: false,
        sentAt: null,
        error: null,
        ruleId: null,
        metadata: {
          pattern: 'fire_near_installation',
          fireCount: nearInstallationFires.length,
          affectedBases,
          closestDistanceMi: closestDist,
          maxFrp: Math.max(...nearInstallationFires.map(f => f.frp)),
        },
      });
      newAlerted[`fire_near_installation|${region.region}`] = nowIso;
    }

    // ── Pattern 2: Fire + Degraded AQ Convergence ──
    const regionAqi = maxAqiByRegion.get(region.region) ?? 0;
    if (region.detectionCount > 0 && regionAqi > AQI_WARNING_THRESHOLD &&
        !inCooldown('fire_aq_convergence', region.region, prevAlerted, now)) {
      const severity = regionAqi > AQI_CRITICAL_THRESHOLD ? 'critical' : 'warning';

      events.push({
        id: crypto.randomUUID(),
        type: 'firms',
        severity,
        title: `Fire + degraded air quality — ${region.label}`,
        body: `${region.detectionCount} active fire(s) detected in ${region.label} region concurrent with ` +
          `elevated AQI (${regionAqi}). Combined fire-smoke and air quality degradation poses health risk ` +
          `to military personnel and dependents in the area.`,
        entityId: region.region,
        entityLabel: `${region.label} — Fire + AQ Convergence`,
        dedupKey: `firms|fire_aq_convergence|${region.region}|${severity}`,
        createdAt: nowIso,
        channel: 'email',
        recipientEmail: '',
        sent: false,
        sentAt: null,
        error: null,
        ruleId: null,
        metadata: {
          pattern: 'fire_aq_convergence',
          fireCount: region.detectionCount,
          regionAqi,
          maxFrp: region.maxFrp,
        },
      });
      newAlerted[`fire_aq_convergence|${region.region}`] = nowIso;
    }

    // ── Pattern 3: Burn Pit Zone ──
    const burnPitInstallations = INSTALLATIONS.filter(i => i.burnPitHistory && i.region === region.region);
    for (const inst of burnPitInstallations) {
      const nearbyFires = region.detections.filter(d => {
        if (d.distanceToInstallationMi == null) return false;
        // Recompute distance to this specific burn-pit installation
        const dist = haversineMi(d.lat, d.lng, inst.lat, inst.lng);
        return dist <= BURN_PIT_RADIUS_MI;
      });

      if (nearbyFires.length > 0 && !inCooldown(`burn_pit_zone|${inst.id}`, region.region, prevAlerted, now)) {
        events.push({
          id: crypto.randomUUID(),
          type: 'firms',
          severity: 'critical',
          title: `Burn pit zone fire alert — ${inst.name}`,
          body: `${nearbyFires.length} active fire(s) detected within ${BURN_PIT_RADIUS_MI}mi of ${inst.name}, ` +
            `a known burn pit exposure site. This installation has documented burn pit history relevant to ` +
            `PACT Act health surveillance. Immediate air quality monitoring recommended.`,
          entityId: inst.id,
          entityLabel: `${inst.name} — Burn Pit Zone`,
          dedupKey: `firms|burn_pit_zone|${inst.id}|critical`,
          createdAt: nowIso,
          channel: 'email',
          recipientEmail: '',
          sent: false,
          sentAt: null,
          error: null,
          ruleId: null,
          metadata: {
            pattern: 'burn_pit_zone',
            installation: inst.name,
            installationId: inst.id,
            branch: inst.branch,
            fireCount: nearbyFires.length,
            maxFrp: Math.max(...nearbyFires.map(f => f.frp)),
            region: region.region,
          },
        });
        newAlerted[`burn_pit_zone|${inst.id}|${region.region}`] = nowIso;
      }
    }
  }

  // 4. Save updated cooldown snapshot
  await saveCacheToBlob(BLOB_PATHS.firmsSnapshot, {
    lastAlertedAt: newAlerted,
    takenAt: nowIso,
  });

  return events;
}

/* ------------------------------------------------------------------ */
/*  Haversine                                                          */
/* ------------------------------------------------------------------ */

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
