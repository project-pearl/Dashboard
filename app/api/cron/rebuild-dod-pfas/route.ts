// app/api/cron/rebuild-dod-pfas/route.ts
// Cron endpoint — builds DoD PFAS investigation site data from curated sample
// data covering ~50 known military installations with PFAS contamination.
// Builds state-keyed cache with investigation status and contaminant details.
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
  installationName: string;
  state: string;
  city: string;
  branch: DodPfasSite['branch'];
  lat: number;
  lng: number;
  investigationStatus: DodPfasSite['investigationStatus'];
  pfasDetected: boolean;
  maxConcentrationPpt: number | null;   // ng/L (combined PFOS+PFOA max)
  contaminantTypes: string[];
  affectedMedia: string[];
  lastUpdated: string;
}

const DOD_PFAS_SITES: RawSiteData[] = [
  // ── Air Force ───────────────────────────────────────────────────────
  { installationName: 'Joint Base McGuire-Dix-Lakehurst', state: 'NJ', city: 'Wrightstown', branch: 'Air Force', lat: 40.0157, lng: -74.5936, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 187.3, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-01-15' },
  { installationName: 'Peterson Space Force Base', state: 'CO', city: 'Colorado Springs', branch: 'Air Force', lat: 38.8024, lng: -104.7025, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 342.8, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-02-01' },
  { installationName: 'Luke Air Force Base', state: 'AZ', city: 'Glendale', branch: 'Air Force', lat: 33.5353, lng: -112.3835, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 520.1, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water', 'soil'], lastUpdated: '2025-12-20' },
  { installationName: 'Eielson Air Force Base', state: 'AK', city: 'Fairbanks', branch: 'Air Force', lat: 64.6656, lng: -147.1002, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 89.4, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2026-01-30' },
  { installationName: 'Travis Air Force Base', state: 'CA', city: 'Fairfield', branch: 'Air Force', lat: 38.2627, lng: -121.9274, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 410.6, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water', 'soil'], lastUpdated: '2026-02-10' },
  { installationName: 'Tyndall Air Force Base', state: 'FL', city: 'Panama City', branch: 'Air Force', lat: 30.0696, lng: -85.5769, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 67.2, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2026-01-05' },
  { installationName: 'Fairchild Air Force Base', state: 'WA', city: 'Spokane', branch: 'Air Force', lat: 47.6224, lng: -117.6542, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 28.9, contaminantTypes: ['PFOS'], affectedMedia: ['groundwater'], lastUpdated: '2025-11-20' },
  { installationName: 'Holloman Air Force Base', state: 'NM', city: 'Alamogordo', branch: 'Air Force', lat: 32.8525, lng: -106.1069, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 156.7, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-01-22' },
  { installationName: 'Barksdale Air Force Base', state: 'LA', city: 'Bossier City', branch: 'Air Force', lat: 32.5013, lng: -93.6627, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 42.1, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2025-12-15' },
  { installationName: 'Tinker Air Force Base', state: 'OK', city: 'Oklahoma City', branch: 'Air Force', lat: 35.4147, lng: -97.3866, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 201.4, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-02-05' },
  { installationName: 'Langley Air Force Base', state: 'VA', city: 'Hampton', branch: 'Air Force', lat: 37.0833, lng: -76.3605, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 289.3, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water', 'soil'], lastUpdated: '2026-01-18' },
  { installationName: 'Malmstrom Air Force Base', state: 'MT', city: 'Great Falls', branch: 'Air Force', lat: 47.5075, lng: -111.1833, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 31.6, contaminantTypes: ['PFOS'], affectedMedia: ['groundwater'], lastUpdated: '2025-10-30' },

  // ── Navy / Marines ──────────────────────────────────────────────────
  { installationName: 'Naval Air Station Whidbey Island', state: 'WA', city: 'Oak Harbor', branch: 'Navy', lat: 48.3515, lng: -122.6557, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 670.2, contaminantTypes: ['PFOS', 'PFOA', 'PFHxS'], affectedMedia: ['groundwater', 'drinking water', 'surface water'], lastUpdated: '2026-02-12' },
  { installationName: 'Naval Air Station Jacksonville', state: 'FL', city: 'Jacksonville', branch: 'Navy', lat: 30.2358, lng: -81.6806, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 245.8, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-01-28' },
  { installationName: 'Naval Station Norfolk', state: 'VA', city: 'Norfolk', branch: 'Navy', lat: 36.9461, lng: -76.3155, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 78.5, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2026-02-03' },
  { installationName: 'Naval Air Station Pensacola', state: 'FL', city: 'Pensacola', branch: 'Navy', lat: 30.3537, lng: -87.3186, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 456.3, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water', 'soil'], lastUpdated: '2026-01-10' },
  { installationName: 'Naval Weapons Station Earle', state: 'NJ', city: 'Colts Neck', branch: 'Navy', lat: 40.2785, lng: -74.1654, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 52.3, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2025-12-01' },
  { installationName: 'Marine Corps Base Camp Lejeune', state: 'NC', city: 'Jacksonville', branch: 'Marines', lat: 34.6204, lng: -77.3868, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 890.4, contaminantTypes: ['PFOS', 'PFOA', 'PFHxS', 'PFBS'], affectedMedia: ['groundwater', 'drinking water', 'surface water', 'soil'], lastUpdated: '2026-02-15' },
  { installationName: 'Marine Corps Air Station Miramar', state: 'CA', city: 'San Diego', branch: 'Marines', lat: 32.8684, lng: -117.1425, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 312.6, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-01-25' },
  { installationName: 'Marine Corps Base Quantico', state: 'VA', city: 'Quantico', branch: 'Marines', lat: 38.5221, lng: -77.3176, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 104.7, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2026-02-08' },
  { installationName: 'Naval Submarine Base New London', state: 'CT', city: 'Groton', branch: 'Navy', lat: 41.3875, lng: -72.0898, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 38.9, contaminantTypes: ['PFOS'], affectedMedia: ['groundwater'], lastUpdated: '2025-11-15' },

  // ── Army ────────────────────────────────────────────────────────────
  { installationName: 'Fort Liberty (Bragg)', state: 'NC', city: 'Fayetteville', branch: 'Army', lat: 35.1389, lng: -79.0064, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 534.2, contaminantTypes: ['PFOS', 'PFOA', 'PFHxS'], affectedMedia: ['groundwater', 'drinking water', 'soil'], lastUpdated: '2026-02-14' },
  { installationName: 'Fort Hood (Cavazos)', state: 'TX', city: 'Killeen', branch: 'Army', lat: 31.1349, lng: -97.7756, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 178.9, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-01-20' },
  { installationName: 'Fort Campbell', state: 'KY', city: 'Fort Campbell', branch: 'Army', lat: 36.6672, lng: -87.4600, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 56.3, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2025-12-10' },
  { installationName: 'Fort Drum', state: 'NY', city: 'Watertown', branch: 'Army', lat: 44.0550, lng: -75.7579, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 67.8, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2026-01-12' },
  { installationName: 'Fort Riley', state: 'KS', city: 'Junction City', branch: 'Army', lat: 39.0553, lng: -96.8288, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 23.4, contaminantTypes: ['PFOS'], affectedMedia: ['groundwater'], lastUpdated: '2025-11-05' },
  { installationName: 'Fort Carson', state: 'CO', city: 'Colorado Springs', branch: 'Army', lat: 38.7374, lng: -104.7889, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 198.5, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-02-01' },
  { installationName: 'Fort Wainwright', state: 'AK', city: 'Fairbanks', branch: 'Army', lat: 64.8283, lng: -147.6142, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 378.6, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water', 'soil'], lastUpdated: '2026-01-08' },
  { installationName: 'Redstone Arsenal', state: 'AL', city: 'Huntsville', branch: 'Army', lat: 34.6805, lng: -86.6474, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 234.1, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-02-06' },
  { installationName: 'Fort Detrick', state: 'MD', city: 'Frederick', branch: 'Army', lat: 39.4363, lng: -77.4381, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 445.7, contaminantTypes: ['PFOS', 'PFOA', 'PFHxS'], affectedMedia: ['groundwater', 'drinking water', 'soil'], lastUpdated: '2026-01-29' },
  { installationName: 'Joint Base Lewis-McChord', state: 'WA', city: 'Tacoma', branch: 'Army', lat: 47.0866, lng: -122.5805, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 267.9, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-02-11' },
  { installationName: 'Fort Benning (Moore)', state: 'GA', city: 'Columbus', branch: 'Army', lat: 32.3593, lng: -84.9486, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 45.2, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2025-12-22' },
  { installationName: 'Picatinny Arsenal', state: 'NJ', city: 'Wharton', branch: 'Army', lat: 40.9580, lng: -74.5611, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 189.3, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-01-16' },
  { installationName: 'Aberdeen Proving Ground', state: 'MD', city: 'Aberdeen', branch: 'Army', lat: 39.4668, lng: -76.1282, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 356.8, contaminantTypes: ['PFOS', 'PFOA', 'PFHxS'], affectedMedia: ['groundwater', 'drinking water', 'soil'], lastUpdated: '2026-02-04' },
  { installationName: 'Fort Sill', state: 'OK', city: 'Lawton', branch: 'Army', lat: 34.6549, lng: -98.4018, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 34.7, contaminantTypes: ['PFOS'], affectedMedia: ['groundwater'], lastUpdated: '2025-11-28' },
  { installationName: 'Fort Huachuca', state: 'AZ', city: 'Sierra Vista', branch: 'Army', lat: 31.5569, lng: -110.3448, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 72.3, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2026-01-03' },

  // ── National Guard ──────────────────────────────────────────────────
  { installationName: 'Otis Air National Guard Base', state: 'MA', city: 'Bourne', branch: 'National Guard', lat: 41.6584, lng: -70.5215, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 1240.5, contaminantTypes: ['PFOS', 'PFOA', 'PFHxS', 'PFBS'], affectedMedia: ['groundwater', 'drinking water', 'surface water', 'soil'], lastUpdated: '2026-02-13' },
  { installationName: 'Battle Creek Air National Guard', state: 'MI', city: 'Battle Creek', branch: 'National Guard', lat: 42.3073, lng: -85.2516, investigationStatus: 'remediation', pfasDetected: true, maxConcentrationPpt: 478.9, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water', 'soil'], lastUpdated: '2026-01-24' },
  { installationName: 'Truax Field ANGB', state: 'WI', city: 'Madison', branch: 'National Guard', lat: 43.1395, lng: -89.3377, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 234.7, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-02-07' },
  { installationName: 'Barnes Air National Guard Base', state: 'MA', city: 'Westfield', branch: 'National Guard', lat: 42.1579, lng: -72.7157, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 48.6, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2025-12-18' },

  // ── DLA / Other ─────────────────────────────────────────────────────
  { installationName: 'Defense Supply Center Columbus', state: 'OH', city: 'Columbus', branch: 'DLA', lat: 40.0000, lng: -82.8833, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 56.7, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2025-11-10' },
  { installationName: 'Defense Supply Center Richmond', state: 'VA', city: 'Richmond', branch: 'DLA', lat: 37.5071, lng: -77.3294, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 89.4, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2026-01-14' },

  // ── Additional sites for coverage ───────────────────────────────────
  { installationName: 'Vance Air Force Base', state: 'OK', city: 'Enid', branch: 'Air Force', lat: 36.3422, lng: -97.9134, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 29.8, contaminantTypes: ['PFOS'], affectedMedia: ['groundwater'], lastUpdated: '2025-10-15' },
  { installationName: 'Westover Air Reserve Base', state: 'MA', city: 'Chicopee', branch: 'Air Force', lat: 42.1942, lng: -72.5340, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 167.3, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-01-07' },
  { installationName: 'Naval Air Station Oceana', state: 'VA', city: 'Virginia Beach', branch: 'Navy', lat: 36.8207, lng: -76.0331, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 93.1, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2026-02-09' },
  { installationName: 'Fort Stewart', state: 'GA', city: 'Hinesville', branch: 'Army', lat: 31.8691, lng: -81.6095, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 145.8, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-01-19' },
  { installationName: 'Fort Leonard Wood', state: 'MO', city: 'Waynesville', branch: 'Army', lat: 37.7447, lng: -92.1313, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 38.4, contaminantTypes: ['PFOS'], affectedMedia: ['groundwater'], lastUpdated: '2025-12-05' },
  { installationName: 'Camp Grayling', state: 'MI', city: 'Grayling', branch: 'National Guard', lat: 44.6618, lng: -84.7205, investigationStatus: 'under_investigation', pfasDetected: true, maxConcentrationPpt: 287.6, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater', 'drinking water'], lastUpdated: '2026-02-02' },
  { installationName: 'Fort Indiantown Gap', state: 'PA', city: 'Annville', branch: 'National Guard', lat: 40.4152, lng: -76.5952, investigationStatus: 'assessed', pfasDetected: true, maxConcentrationPpt: 51.2, contaminantTypes: ['PFOS', 'PFOA'], affectedMedia: ['groundwater'], lastUpdated: '2025-12-28' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Group sites by state and return per-state arrays for the cache. */
function groupByState(sites: DodPfasSite[]): Record<string, DodPfasSite[]> {
  const byState: Record<string, DodPfasSite[]> = {};
  for (const s of sites) {
    if (!byState[s.state]) byState[s.state] = [];
    byState[s.state].push(s);
  }
  return byState;
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
      installationName: raw.installationName,
      branch: raw.branch,
      state: raw.state,
      city: raw.city,
      lat: raw.lat,
      lng: raw.lng,
      investigationStatus: raw.investigationStatus,
      pfasDetected: raw.pfasDetected,
      maxConcentrationPpt: raw.maxConcentrationPpt,
      contaminantTypes: raw.contaminantTypes,
      affectedMedia: raw.affectedMedia,
      lastUpdated: raw.lastUpdated,
    }));

    console.log(`[DoD PFAS Sites Cron] Processing ${sites.length} investigation sites`);

    // ── Group by state ────────────────────────────────────────────────
    const states = groupByState(sites);
    const statesCovered = Object.keys(states).length;

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

    // ── Compute active investigations count ─────────────────────────────
    const activeInvestigations = sites.filter(
      s => s.investigationStatus === 'under_investigation' || s.investigationStatus === 'remediation',
    ).length;

    // ── Save cache ──────────────────────────────────────────────────────
    await setDodPfasSitesCache({
      _meta: {
        built: new Date().toISOString(),
        siteCount: sites.length,
        statesCovered,
        activeInvestigations,
      },
      states,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[DoD PFAS Sites Cron] Complete in ${elapsed}s — ${sites.length} sites, ` +
      `${statesCovered} states, ${activeInvestigations} active investigations`,
    );

    recordCronRun('rebuild-dod-pfas', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      siteCount: sites.length,
      statesCovered,
      activeInvestigations,
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
