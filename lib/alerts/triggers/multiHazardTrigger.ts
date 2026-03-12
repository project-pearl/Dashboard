/* ------------------------------------------------------------------ */
/*  PIN Alerts — Multi-Hazard Overlap Alert Trigger                  */
/*                                                                    */
/*  Fires when 2+ hazard categories overlap at a location with a     */
/*  composite score >= 50.                                            */
/*                                                                    */
/*  Scoring:                                                          */
/*    - Flood forecast present             +30                        */
/*    - SDWIS violations in area           +25                        */
/*    - PFAS exceedances in area           +25                        */
/*    - Heavy precipitation (>2in / 48h)   +20                        */
/*                                                                    */
/*  Reads from floodImpactCache, sdwisCache, epaPfasAnalyticsCache,  */
/*  and nwsForecastCache.                                             */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertSeverity } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { gridKey } from '../../cacheUtils';
import {
  getFloodImpactByState,
  ensureWarmed as warmFloodImpact,
} from '../../floodImpactCache';
import type { FloodImpactZone } from '../../floodImpactCache';
import {
  getSdwisForState,
  ensureWarmed as warmSdwis,
} from '../../sdwisCache';
import {
  getEpaPfasAllStates,
  ensureWarmed as warmPfas,
} from '../../epaPfasAnalyticsCache';
import {
  getNwsForecastAll,
  ensureWarmed as warmNwsForecast,
} from '../../nwsForecastCache';

/* ------------------------------------------------------------------ */
/*  Snapshot — tracks which multi-hazard alerts we already sent       */
/* ------------------------------------------------------------------ */

interface MultiHazardSnapshot {
  dispatched: Record<string, string>; // dedupKey -> ISO timestamp
  takenAt: string;
}

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const MIN_SCORE = 50; // minimum composite score to fire

/* ── Scoring Constants ───────────────────────────────────────────── */

const SCORE_FLOOD = 30;
const SCORE_SDWIS = 25;
const SCORE_PFAS = 25;
const SCORE_HEAVY_PRECIP = 20;
const HEAVY_PRECIP_THRESHOLD_IN = 2; // inches over forecast window

/* ── US States list for iteration ────────────────────────────────── */

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC','PR','VI','GU','AS','MP',
];

/* ------------------------------------------------------------------ */
/*  Severity Mapping                                                  */
/* ------------------------------------------------------------------ */

function mapSeverity(score: number): AlertSeverity {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'warning';
  return 'info'; // should not reach here given MIN_SCORE gate
}

/* ------------------------------------------------------------------ */
/*  Build state-level hazard indices                                  */
/* ------------------------------------------------------------------ */

interface HazardProfile {
  state: string;
  locationId: string;   // gridKey or locationId
  lat: number;
  lng: number;
  score: number;
  hazardCount: number;
  components: {
    flood: boolean;
    sdwis: boolean;
    pfas: boolean;
    heavyPrecip: boolean;
  };
  floodStatus: string | null;
  violationCount: number;
  pfasExceedanceCount: number;
  precipTotalIn: number;
}

function buildHazardProfiles(): HazardProfile[] {
  const profiles: HazardProfile[] = [];
  const pfasStates = getEpaPfasAllStates();
  const forecastAll = getNwsForecastAll();

  for (const state of US_STATES) {
    /* ── Flood zones for this state ────────────────────────────── */
    const floodZones = getFloodImpactByState(state);
    const floodGrids = new Map<string, FloodImpactZone>();
    if (floodZones) {
      for (const z of floodZones) {
        if (z.floodStatus !== 'none') {
          floodGrids.set(z.gridKey, z);
        }
      }
    }

    /* ── SDWIS violations for this state ──────────────────────── */
    const sdwisData = getSdwisForState(state);
    const sdwisGrids = new Set<string>();
    const sdwisViolationsByGrid = new Map<string, number>();
    if (sdwisData) {
      for (const v of sdwisData.violations) {
        if (v.lat && v.lng) {
          const gk = gridKey(v.lat, v.lng);
          sdwisGrids.add(gk);
          sdwisViolationsByGrid.set(gk, (sdwisViolationsByGrid.get(gk) || 0) + 1);
        }
      }
    }

    /* ── PFAS exceedances for this state ─────────────────────── */
    const pfasGrids = new Set<string>();
    const pfasCountByGrid = new Map<string, number>();
    if (pfasStates?.[state]) {
      for (const fac of pfasStates[state].facilities) {
        const exceedances = fac.pfasAnalytes.filter(a => a.exceedsAdvisory);
        if (exceedances.length > 0 && fac.lat && fac.lng) {
          const gk = gridKey(fac.lat, fac.lng);
          pfasGrids.add(gk);
          pfasCountByGrid.set(gk, (pfasCountByGrid.get(gk) || 0) + exceedances.length);
        }
      }
    }

    /* ── Heavy precipitation forecasts for this state ────────── */
    const precipGrids = new Map<string, { precipIn: number; lat: number; lng: number }>();
    if (forecastAll?.[state]) {
      for (const fc of forecastAll[state]) {
        if (fc.precipTotal7d >= HEAVY_PRECIP_THRESHOLD_IN && fc.lat && fc.lng) {
          const gk = gridKey(fc.lat, fc.lng);
          precipGrids.set(gk, {
            precipIn: fc.precipTotal7d,
            lat: fc.lat,
            lng: fc.lng,
          });
        }
      }
    }

    /* ── Union all grid keys and score each ───────────────────── */
    const allGridKeys = new Set([
      ...floodGrids.keys(),
      ...sdwisGrids,
      ...pfasGrids,
      ...precipGrids.keys(),
    ]);

    for (const gk of allGridKeys) {
      const hasFlood = floodGrids.has(gk);
      const hasSdwis = sdwisGrids.has(gk);
      const hasPfas = pfasGrids.has(gk);
      const hasPrecip = precipGrids.has(gk);

      let score = 0;
      let hazardCount = 0;
      if (hasFlood)  { score += SCORE_FLOOD;       hazardCount++; }
      if (hasSdwis)  { score += SCORE_SDWIS;       hazardCount++; }
      if (hasPfas)   { score += SCORE_PFAS;        hazardCount++; }
      if (hasPrecip) { score += SCORE_HEAVY_PRECIP; hazardCount++; }

      // Require 2+ hazard categories AND score >= 50
      if (hazardCount < 2 || score < MIN_SCORE) continue;

      // Determine representative lat/lng from available data
      const floodZone = floodGrids.get(gk);
      const precipData = precipGrids.get(gk);
      const lat = floodZone?.lat ?? precipData?.lat ?? parseFloat(gk.split('_')[0]);
      const lng = floodZone?.lng ?? precipData?.lng ?? parseFloat(gk.split('_')[1]);

      profiles.push({
        state,
        locationId: gk,
        lat,
        lng,
        score,
        hazardCount,
        components: {
          flood: hasFlood,
          sdwis: hasSdwis,
          pfas: hasPfas,
          heavyPrecip: hasPrecip,
        },
        floodStatus: floodZone?.floodStatus ?? null,
        violationCount: sdwisViolationsByGrid.get(gk) ?? 0,
        pfasExceedanceCount: pfasCountByGrid.get(gk) ?? 0,
        precipTotalIn: precipData?.precipIn ?? 0,
      });
    }
  }

  return profiles;
}

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateMultiHazards(): Promise<AlertEvent[]> {
  await Promise.all([
    warmFloodImpact(),
    warmSdwis(),
    warmPfas(),
    warmNwsForecast(),
  ]);

  const profiles = buildHazardProfiles();
  if (profiles.length === 0) return [];

  const snapshot = await loadCacheFromBlob<MultiHazardSnapshot>(
    BLOB_PATHS.multiHazardSnapshot,
  );
  const prevDispatched = snapshot?.dispatched ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const events: AlertEvent[] = [];
  const newDispatched: Record<string, string> = { ...prevDispatched };

  for (const profile of profiles) {
    const dedupKey = `multi-hazard-${profile.state}-${profile.locationId}`;

    // Cooldown check
    const lastDispatched = prevDispatched[dedupKey];
    if (
      lastDispatched &&
      now.getTime() - new Date(lastDispatched).getTime() < COOLDOWN_MS
    ) {
      continue;
    }

    const severity = mapSeverity(profile.score);

    // Build human-readable hazard list
    const hazards: string[] = [];
    if (profile.components.flood) hazards.push(`flood (${profile.floodStatus})`);
    if (profile.components.sdwis) hazards.push(`SDWIS violations (${profile.violationCount})`);
    if (profile.components.pfas) hazards.push(`PFAS exceedances (${profile.pfasExceedanceCount})`);
    if (profile.components.heavyPrecip) hazards.push(`heavy precip (${profile.precipTotalIn.toFixed(1)}in)`);
    const hazardList = hazards.join(' + ');

    events.push({
      id: crypto.randomUUID(),
      type: 'multi_hazard',
      severity,
      title: `Multi-Hazard Overlap: ${profile.state} grid ${profile.locationId} — score ${profile.score}`,
      body: `${profile.hazardCount} hazard categories overlap at ${profile.state} (${profile.lat.toFixed(2)}, ${profile.lng.toFixed(2)}): ${hazardList}. Composite score: ${profile.score}/100.`,
      entityId: profile.locationId,
      entityLabel: `${profile.state} — ${profile.locationId}`,
      dedupKey,
      createdAt: nowIso,
      channel: 'email',
      recipientEmail: '',
      sent: false,
      sentAt: null,
      error: null,
      ruleId: null,
      metadata: {
        state: profile.state,
        locationId: profile.locationId,
        lat: profile.lat,
        lng: profile.lng,
        score: profile.score,
        hazardCount: profile.hazardCount,
        components: profile.components,
        floodStatus: profile.floodStatus,
        violationCount: profile.violationCount,
        pfasExceedanceCount: profile.pfasExceedanceCount,
        precipTotalIn: profile.precipTotalIn,
      },
    });

    newDispatched[dedupKey] = nowIso;
  }

  // Expire old entries (>48h)
  const expiryCutoff = now.getTime() - 48 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(newDispatched)) {
    if (new Date(ts).getTime() < expiryCutoff) {
      delete newDispatched[key];
    }
  }

  await saveCacheToBlob(BLOB_PATHS.multiHazardSnapshot, {
    dispatched: newDispatched,
    takenAt: nowIso,
  });

  return events;
}
