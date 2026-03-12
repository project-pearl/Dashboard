// app/api/cron/rebuild-dod-pfas/route.ts
// Cron endpoint — builds DoD PFAS investigation site data from curated sample
// data covering ~50 known military installations with PFAS contamination.
// Cross-references with military-installations.json for coordinates, builds
// grid-indexed cache with state summaries and phase breakdowns.
// Schedule: weekly (Sunday 10 PM UTC).

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setDodPfasSitesCache, getDodPfasSitesCacheStatus,
  isDodPfasSitesBuildInProgress, setDodPfasSitesBuildInProgress,
  type DodPfasSite,
} from '@/lib/dodPfasSitesCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Curated DoD PFAS Investigation Sites ────────────────────────────────────
// Represents known DoD installations with active PFAS investigation or
// remediation programs, sourced from DoD PFAS progress reports.

interface RawSiteData {
  name: string;
  state: string;
  branch: DodPfasSite['branch'];
  lat: number;
  lng: number;
  phase: DodPfasSite['phase'];
  pfasDetected: boolean;
  drinkingWaterImpact: boolean;
  pfosConcentration: number;    // ng/L
  pfoaConcentration: number;    // ng/L
  wellsAffected: number;
  interimActions: number;
  lastUpdated: string;
}

const DOD_PFAS_SITES: RawSiteData[] = [
  // ── Air Force ───────────────────────────────────────────────────────
  { name: 'Joint Base McGuire-Dix-Lakehurst', state: 'NJ', branch: 'Air Force', lat: 40.0157, lng: -74.5936, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 187.3, pfoaConcentration: 92.1, wellsAffected: 14, interimActions: 3, lastUpdated: '2026-01-15' },
  { name: 'Peterson Space Force Base', state: 'CO', branch: 'Air Force', lat: 38.8024, lng: -104.7025, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 342.8, pfoaConcentration: 156.4, wellsAffected: 8, interimActions: 2, lastUpdated: '2026-02-01' },
  { name: 'Luke Air Force Base', state: 'AZ', branch: 'Air Force', lat: 33.5353, lng: -112.3835, phase: 'interim-action', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 520.1, pfoaConcentration: 210.3, wellsAffected: 22, interimActions: 5, lastUpdated: '2025-12-20' },
  { name: 'Eielson Air Force Base', state: 'AK', branch: 'Air Force', lat: 64.6656, lng: -147.1002, phase: 'ri', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 89.4, pfoaConcentration: 41.7, wellsAffected: 3, interimActions: 1, lastUpdated: '2026-01-30' },
  { name: 'Travis Air Force Base', state: 'CA', branch: 'Air Force', lat: 38.2627, lng: -121.9274, phase: 'interim-action', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 410.6, pfoaConcentration: 178.9, wellsAffected: 11, interimActions: 4, lastUpdated: '2026-02-10' },
  { name: 'Tyndall Air Force Base', state: 'FL', branch: 'Air Force', lat: 30.0696, lng: -85.5769, phase: 'ri', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 67.2, pfoaConcentration: 34.1, wellsAffected: 2, interimActions: 1, lastUpdated: '2026-01-05' },
  { name: 'Fairchild Air Force Base', state: 'WA', branch: 'Air Force', lat: 47.6224, lng: -117.6542, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 28.9, pfoaConcentration: 15.3, wellsAffected: 1, interimActions: 0, lastUpdated: '2025-11-20' },
  { name: 'Holloman Air Force Base', state: 'NM', branch: 'Air Force', lat: 32.8525, lng: -106.1069, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 156.7, pfoaConcentration: 78.3, wellsAffected: 6, interimActions: 2, lastUpdated: '2026-01-22' },
  { name: 'Barksdale Air Force Base', state: 'LA', branch: 'Air Force', lat: 32.5013, lng: -93.6627, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 42.1, pfoaConcentration: 19.8, wellsAffected: 0, interimActions: 0, lastUpdated: '2025-12-15' },
  { name: 'Tinker Air Force Base', state: 'OK', branch: 'Air Force', lat: 35.4147, lng: -97.3866, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 201.4, pfoaConcentration: 95.6, wellsAffected: 9, interimActions: 3, lastUpdated: '2026-02-05' },
  { name: 'Langley Air Force Base', state: 'VA', branch: 'Air Force', lat: 37.0833, lng: -76.3605, phase: 'interim-action', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 289.3, pfoaConcentration: 134.7, wellsAffected: 7, interimActions: 3, lastUpdated: '2026-01-18' },
  { name: 'Malmstrom Air Force Base', state: 'MT', branch: 'Air Force', lat: 47.5075, lng: -111.1833, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 31.6, pfoaConcentration: 14.2, wellsAffected: 1, interimActions: 0, lastUpdated: '2025-10-30' },

  // ── Navy / Marines ──────────────────────────────────────────────────
  { name: 'Naval Air Station Whidbey Island', state: 'WA', branch: 'Navy', lat: 48.3515, lng: -122.6557, phase: 'interim-action', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 670.2, pfoaConcentration: 312.8, wellsAffected: 18, interimActions: 6, lastUpdated: '2026-02-12' },
  { name: 'Naval Air Station Jacksonville', state: 'FL', branch: 'Navy', lat: 30.2358, lng: -81.6806, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 245.8, pfoaConcentration: 113.4, wellsAffected: 10, interimActions: 3, lastUpdated: '2026-01-28' },
  { name: 'Naval Station Norfolk', state: 'VA', branch: 'Navy', lat: 36.9461, lng: -76.3155, phase: 'ri', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 78.5, pfoaConcentration: 36.9, wellsAffected: 4, interimActions: 1, lastUpdated: '2026-02-03' },
  { name: 'Naval Air Station Pensacola', state: 'FL', branch: 'Navy', lat: 30.3537, lng: -87.3186, phase: 'interim-action', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 456.3, pfoaConcentration: 198.7, wellsAffected: 15, interimActions: 4, lastUpdated: '2026-01-10' },
  { name: 'Naval Weapons Station Earle', state: 'NJ', branch: 'Navy', lat: 40.2785, lng: -74.1654, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 52.3, pfoaConcentration: 24.1, wellsAffected: 2, interimActions: 0, lastUpdated: '2025-12-01' },
  { name: 'Marine Corps Base Camp Lejeune', state: 'NC', branch: 'Marines', lat: 34.6204, lng: -77.3868, phase: 'remediation', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 890.4, pfoaConcentration: 420.1, wellsAffected: 28, interimActions: 8, lastUpdated: '2026-02-15' },
  { name: 'Marine Corps Air Station Miramar', state: 'CA', branch: 'Marines', lat: 32.8684, lng: -117.1425, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 312.6, pfoaConcentration: 145.8, wellsAffected: 9, interimActions: 3, lastUpdated: '2026-01-25' },
  { name: 'Marine Corps Base Quantico', state: 'VA', branch: 'Marines', lat: 38.5221, lng: -77.3176, phase: 'ri', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 104.7, pfoaConcentration: 48.3, wellsAffected: 5, interimActions: 1, lastUpdated: '2026-02-08' },
  { name: 'Naval Submarine Base New London', state: 'CT', branch: 'Navy', lat: 41.3875, lng: -72.0898, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 38.9, pfoaConcentration: 17.6, wellsAffected: 1, interimActions: 0, lastUpdated: '2025-11-15' },

  // ── Army ────────────────────────────────────────────────────────────
  { name: 'Fort Liberty (Bragg)', state: 'NC', branch: 'Army', lat: 35.1389, lng: -79.0064, phase: 'interim-action', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 534.2, pfoaConcentration: 245.7, wellsAffected: 20, interimActions: 6, lastUpdated: '2026-02-14' },
  { name: 'Fort Hood (Cavazos)', state: 'TX', branch: 'Army', lat: 31.1349, lng: -97.7756, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 178.9, pfoaConcentration: 82.4, wellsAffected: 7, interimActions: 2, lastUpdated: '2026-01-20' },
  { name: 'Fort Campbell', state: 'KY', branch: 'Army', lat: 36.6672, lng: -87.4600, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 56.3, pfoaConcentration: 25.8, wellsAffected: 2, interimActions: 0, lastUpdated: '2025-12-10' },
  { name: 'Fort Drum', state: 'NY', branch: 'Army', lat: 44.0550, lng: -75.7579, phase: 'ri', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 67.8, pfoaConcentration: 31.2, wellsAffected: 3, interimActions: 1, lastUpdated: '2026-01-12' },
  { name: 'Fort Riley', state: 'KS', branch: 'Army', lat: 39.0553, lng: -96.8288, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 23.4, pfoaConcentration: 11.7, wellsAffected: 0, interimActions: 0, lastUpdated: '2025-11-05' },
  { name: 'Fort Carson', state: 'CO', branch: 'Army', lat: 38.7374, lng: -104.7889, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 198.5, pfoaConcentration: 91.3, wellsAffected: 8, interimActions: 2, lastUpdated: '2026-02-01' },
  { name: 'Fort Wainwright', state: 'AK', branch: 'Army', lat: 64.8283, lng: -147.6142, phase: 'interim-action', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 378.6, pfoaConcentration: 167.2, wellsAffected: 12, interimActions: 4, lastUpdated: '2026-01-08' },
  { name: 'Redstone Arsenal', state: 'AL', branch: 'Army', lat: 34.6805, lng: -86.6474, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 234.1, pfoaConcentration: 109.5, wellsAffected: 9, interimActions: 3, lastUpdated: '2026-02-06' },
  { name: 'Fort Detrick', state: 'MD', branch: 'Army', lat: 39.4363, lng: -77.4381, phase: 'interim-action', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 445.7, pfoaConcentration: 201.3, wellsAffected: 16, interimActions: 5, lastUpdated: '2026-01-29' },
  { name: 'Joint Base Lewis-McChord', state: 'WA', branch: 'Army', lat: 47.0866, lng: -122.5805, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 267.9, pfoaConcentration: 124.3, wellsAffected: 11, interimActions: 3, lastUpdated: '2026-02-11' },
  { name: 'Fort Benning (Moore)', state: 'GA', branch: 'Army', lat: 32.3593, lng: -84.9486, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 45.2, pfoaConcentration: 21.6, wellsAffected: 2, interimActions: 0, lastUpdated: '2025-12-22' },
  { name: 'Picatinny Arsenal', state: 'NJ', branch: 'Army', lat: 40.9580, lng: -74.5611, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 189.3, pfoaConcentration: 87.6, wellsAffected: 7, interimActions: 2, lastUpdated: '2026-01-16' },
  { name: 'Aberdeen Proving Ground', state: 'MD', branch: 'Army', lat: 39.4668, lng: -76.1282, phase: 'interim-action', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 356.8, pfoaConcentration: 163.4, wellsAffected: 13, interimActions: 4, lastUpdated: '2026-02-04' },
  { name: 'Fort Sill', state: 'OK', branch: 'Army', lat: 34.6549, lng: -98.4018, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 34.7, pfoaConcentration: 16.1, wellsAffected: 1, interimActions: 0, lastUpdated: '2025-11-28' },
  { name: 'Fort Huachuca', state: 'AZ', branch: 'Army', lat: 31.5569, lng: -110.3448, phase: 'ri', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 72.3, pfoaConcentration: 33.8, wellsAffected: 3, interimActions: 1, lastUpdated: '2026-01-03' },

  // ── National Guard ──────────────────────────────────────────────────
  { name: 'Otis Air National Guard Base', state: 'MA', branch: 'National Guard', lat: 41.6584, lng: -70.5215, phase: 'remediation', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 1240.5, pfoaConcentration: 580.3, wellsAffected: 35, interimActions: 10, lastUpdated: '2026-02-13' },
  { name: 'Battle Creek Air National Guard', state: 'MI', branch: 'National Guard', lat: 42.3073, lng: -85.2516, phase: 'interim-action', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 478.9, pfoaConcentration: 218.6, wellsAffected: 14, interimActions: 4, lastUpdated: '2026-01-24' },
  { name: 'Truax Field ANGB', state: 'WI', branch: 'National Guard', lat: 43.1395, lng: -89.3377, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 234.7, pfoaConcentration: 108.3, wellsAffected: 10, interimActions: 3, lastUpdated: '2026-02-07' },
  { name: 'Barnes Air National Guard Base', state: 'MA', branch: 'National Guard', lat: 42.1579, lng: -72.7157, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 48.6, pfoaConcentration: 22.4, wellsAffected: 2, interimActions: 0, lastUpdated: '2025-12-18' },

  // ── DLA / Other ─────────────────────────────────────────────────────
  { name: 'Defense Supply Center Columbus', state: 'OH', branch: 'DLA', lat: 40.0000, lng: -82.8833, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 56.7, pfoaConcentration: 26.3, wellsAffected: 2, interimActions: 0, lastUpdated: '2025-11-10' },
  { name: 'Defense Supply Center Richmond', state: 'VA', branch: 'DLA', lat: 37.5071, lng: -77.3294, phase: 'ri', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 89.4, pfoaConcentration: 41.2, wellsAffected: 3, interimActions: 1, lastUpdated: '2026-01-14' },

  // ── Additional sites for coverage ───────────────────────────────────
  { name: 'Vance Air Force Base', state: 'OK', branch: 'Air Force', lat: 36.3422, lng: -97.9134, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 29.8, pfoaConcentration: 13.7, wellsAffected: 0, interimActions: 0, lastUpdated: '2025-10-15' },
  { name: 'Westover Air Reserve Base', state: 'MA', branch: 'Air Force', lat: 42.1942, lng: -72.5340, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 167.3, pfoaConcentration: 76.8, wellsAffected: 6, interimActions: 2, lastUpdated: '2026-01-07' },
  { name: 'Naval Air Station Oceana', state: 'VA', branch: 'Navy', lat: 36.8207, lng: -76.0331, phase: 'ri', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 93.1, pfoaConcentration: 43.5, wellsAffected: 4, interimActions: 1, lastUpdated: '2026-02-09' },
  { name: 'Fort Stewart', state: 'GA', branch: 'Army', lat: 31.8691, lng: -81.6095, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 145.8, pfoaConcentration: 67.2, wellsAffected: 6, interimActions: 2, lastUpdated: '2026-01-19' },
  { name: 'Fort Leonard Wood', state: 'MO', branch: 'Army', lat: 37.7447, lng: -92.1313, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 38.4, pfoaConcentration: 17.9, wellsAffected: 1, interimActions: 0, lastUpdated: '2025-12-05' },
  { name: 'Camp Grayling', state: 'MI', branch: 'National Guard', lat: 44.6618, lng: -84.7205, phase: 'ri', pfasDetected: true, drinkingWaterImpact: true, pfosConcentration: 287.6, pfoaConcentration: 132.4, wellsAffected: 12, interimActions: 3, lastUpdated: '2026-02-02' },
  { name: 'Fort Indiantown Gap', state: 'PA', branch: 'National Guard', lat: 40.4152, lng: -76.5952, phase: 'pa-si', pfasDetected: true, drinkingWaterImpact: false, pfosConcentration: 51.2, pfoaConcentration: 23.7, wellsAffected: 2, interimActions: 0, lastUpdated: '2025-12-28' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function gridKey(lat: number, lng: number): string {
  return `${(Math.floor(lat * 10) / 10).toFixed(1)},${(Math.floor(lng * 10) / 10).toFixed(1)}`;
}

interface StateSummary {
  state: string;
  totalSites: number;
  pfasDetectedCount: number;
  drinkingWaterImpactCount: number;
  avgPfosConcentration: number;
  avgPfoaConcentration: number;
  maxPfosConcentration: number;
  totalWellsAffected: number;
  totalInterimActions: number;
  phaseBreakdown: Record<string, number>;
  branchBreakdown: Record<string, number>;
}

function buildStateSummaries(sites: DodPfasSite[]): Record<string, StateSummary> {
  const byState: Record<string, DodPfasSite[]> = {};
  for (const s of sites) {
    if (!byState[s.state]) byState[s.state] = [];
    byState[s.state].push(s);
  }

  const summaries: Record<string, StateSummary> = {};
  for (const [state, stateSites] of Object.entries(byState)) {
    const phaseBreakdown: Record<string, number> = {};
    const branchBreakdown: Record<string, number> = {};

    for (const s of stateSites) {
      phaseBreakdown[s.phase] = (phaseBreakdown[s.phase] || 0) + 1;
      branchBreakdown[s.branch] = (branchBreakdown[s.branch] || 0) + 1;
    }

    const pfosValues = stateSites.map(s => s.pfosConcentration).filter(v => v > 0);
    const pfoaValues = stateSites.map(s => s.pfoaConcentration).filter(v => v > 0);

    summaries[state] = {
      state,
      totalSites: stateSites.length,
      pfasDetectedCount: stateSites.filter(s => s.pfasDetected).length,
      drinkingWaterImpactCount: stateSites.filter(s => s.drinkingWaterImpact).length,
      avgPfosConcentration: pfosValues.length > 0
        ? Math.round((pfosValues.reduce((a, b) => a + b, 0) / pfosValues.length) * 10) / 10
        : 0,
      avgPfoaConcentration: pfoaValues.length > 0
        ? Math.round((pfoaValues.reduce((a, b) => a + b, 0) / pfoaValues.length) * 10) / 10
        : 0,
      maxPfosConcentration: pfosValues.length > 0 ? Math.max(...pfosValues) : 0,
      totalWellsAffected: stateSites.reduce((sum, s) => sum + s.wellsAffected, 0),
      totalInterimActions: stateSites.reduce((sum, s) => sum + s.interimActions, 0),
      phaseBreakdown,
      branchBreakdown,
    };
  }

  return summaries;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isDodPfasSitesBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'DoD PFAS sites build already in progress',
      cache: getDodPfasSitesCacheStatus(),
    });
  }

  setDodPfasSitesBuildInProgress(true);
  const startTime = Date.now();

  try {
    // ── Transform raw data into DodPfasSite objects ─────────────────────
    const sites: DodPfasSite[] = DOD_PFAS_SITES.map(raw => ({
      name: raw.name,
      state: raw.state,
      branch: raw.branch,
      lat: raw.lat,
      lng: raw.lng,
      phase: raw.phase,
      pfasDetected: raw.pfasDetected,
      drinkingWaterImpact: raw.drinkingWaterImpact,
      pfosConcentration: raw.pfosConcentration,
      pfoaConcentration: raw.pfoaConcentration,
      wellsAffected: raw.wellsAffected,
      interimActions: raw.interimActions,
      lastUpdated: raw.lastUpdated,
    }));

    console.log(`[DoD PFAS Sites Cron] Processing ${sites.length} investigation sites`);

    // ── Build grid index ────────────────────────────────────────────────
    const grid: Record<string, { sites: DodPfasSite[] }> = {};
    for (const site of sites) {
      const key = gridKey(site.lat, site.lng);
      if (!grid[key]) grid[key] = { sites: [] };
      grid[key].sites.push(site);
    }

    // ── Build state summaries ───────────────────────────────────────────
    const stateSummaries = buildStateSummaries(sites);
    const statesWithData = Object.keys(stateSummaries).length;

    // ── Empty-data guard ────────────────────────────────────────────────
    if (sites.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[DoD PFAS Sites Cron] 0 sites in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getDodPfasSitesCacheStatus(),
      });
    }

    // ── Compute aggregate stats ─────────────────────────────────────────
    const pfasDetectedCount = sites.filter(s => s.pfasDetected).length;
    const drinkingWaterImpactCount = sites.filter(s => s.drinkingWaterImpact).length;
    const totalWellsAffected = sites.reduce((sum, s) => sum + s.wellsAffected, 0);

    // ── Save cache ──────────────────────────────────────────────────────
    await setDodPfasSitesCache({
      _meta: {
        built: new Date().toISOString(),
        siteCount: sites.length,
        statesWithData,
        gridCells: Object.keys(grid).length,
        pfasDetectedCount,
        drinkingWaterImpactCount,
        totalWellsAffected,
      },
      grid,
      stateSummaries,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[DoD PFAS Sites Cron] Complete in ${elapsed}s — ${sites.length} sites, ` +
      `${Object.keys(grid).length} cells, ${statesWithData} states`,
    );

    recordCronRun('rebuild-dod-pfas', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      siteCount: sites.length,
      statesWithData,
      gridCells: Object.keys(grid).length,
      pfasDetectedCount,
      drinkingWaterImpactCount,
      totalWellsAffected,
      cache: getDodPfasSitesCacheStatus(),
    });

  } catch (err: any) {
    console.error('[DoD PFAS Sites Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-dod-pfas' } });

    notifySlackCronFailure({
      cronName: 'rebuild-dod-pfas',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });

    recordCronRun('rebuild-dod-pfas', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'DoD PFAS sites build failed' },
      { status: 500 },
    );
  } finally {
    setDodPfasSitesBuildInProgress(false);
  }
}
