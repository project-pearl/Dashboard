// app/api/cron/rebuild-cyber-risk/route.ts
// Cron endpoint — generates water-sector cybersecurity risk assessments.
// Derived cache — reads existing ECHO, SDWIS, FRS caches (falls back to
// deterministic sample data when upstream caches are empty).
// Schedule: weekly.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCyberRiskCache, getCyberRiskCacheStatus,
  isCyberRiskBuildInProgress, setCyberRiskBuildInProgress,
  type CyberRiskAssessment,
} from '@/lib/cyberRiskCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import { ALL_STATES } from '@/lib/constants';

// Local type aliases derived from CyberRiskAssessment
type SystemSize = CyberRiskAssessment['systemSize'];
type CyberRiskLevel = CyberRiskAssessment['riskLevel'];

// ── Deterministic PRNG (xorshift32) ────────────────────────────────────────

function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h === 0 ? 1 : Math.abs(h);
}

function xorshift32(seed: number): () => number {
  let s = seed;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// ── Scoring helpers ─────────────────────────────────────────────────────────

const SIZE_BASE: Record<SystemSize, number> = {
  very_small: 10, small: 25, medium: 50, large: 75, very_large: 90,
};

const POPULATION_RANGES: Record<SystemSize, [number, number]> = {
  very_small: [25, 500],
  small: [501, 3300],
  medium: [3301, 10000],
  large: [10001, 100000],
  very_large: [100001, 1000000],
};

const SIZES: SystemSize[] = ['very_small', 'small', 'medium', 'large', 'very_large'];

const CITY_NAMES: Record<string, string[]> = {
  AL: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau', 'Sitka', 'Ketchikan'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale'],
  AR: ['Little Rock', 'Fort Smith', 'Fayetteville', 'Springdale', 'Jonesboro'],
  CA: ['Los Angeles', 'San Diego', 'San Jose', 'San Francisco', 'Fresno'],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Lakewood'],
  CT: ['Bridgeport', 'New Haven', 'Stamford', 'Hartford', 'Waterbury'],
  DC: ['Washington', 'Capitol Hill', 'Georgetown', 'Anacostia', 'Dupont'],
  DE: ['Wilmington', 'Dover', 'Newark', 'Middletown', 'Bear'],
  FL: ['Jacksonville', 'Miami', 'Tampa', 'Orlando', 'St. Petersburg'],
  GA: ['Atlanta', 'Augusta', 'Columbus', 'Macon', 'Savannah'],
  HI: ['Honolulu', 'Pearl City', 'Hilo', 'Kailua', 'Waipahu'],
  ID: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls', 'Pocatello'],
  IL: ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville'],
  IN: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'],
  IA: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Sioux City', 'Iowa City'],
  KS: ['Wichita', 'Overland Park', 'Kansas City', 'Olathe', 'Topeka'],
  KY: ['Louisville', 'Lexington', 'Bowling Green', 'Owensboro', 'Covington'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Lake Charles'],
  ME: ['Portland', 'Lewiston', 'Bangor', 'South Portland', 'Auburn'],
  MD: ['Baltimore', 'Columbia', 'Germantown', 'Silver Spring', 'Waldorf'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Lowell', 'Cambridge'],
  MI: ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Ann Arbor'],
  MN: ['Minneapolis', 'St. Paul', 'Rochester', 'Duluth', 'Bloomington'],
  MS: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg', 'Biloxi'],
  MO: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'],
  MT: ['Billings', 'Missoula', 'Great Falls', 'Bozeman', 'Butte'],
  NE: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island', 'Kearney'],
  NV: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'],
  NH: ['Manchester', 'Nashua', 'Concord', 'Derry', 'Dover'],
  NJ: ['Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison'],
  NM: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe', 'Roswell'],
  NY: ['New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse'],
  NC: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem'],
  ND: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot', 'West Fargo'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron'],
  OK: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow', 'Edmond'],
  OR: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Hillsboro'],
  PA: ['Philadelphia', 'Pittsburgh', 'Allentown', 'Reading', 'Erie'],
  RI: ['Providence', 'Warwick', 'Cranston', 'Pawtucket', 'East Providence'],
  SC: ['Charleston', 'Columbia', 'North Charleston', 'Mount Pleasant', 'Rock Hill'],
  SD: ['Sioux Falls', 'Rapid City', 'Aberdeen', 'Brookings', 'Watertown'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'],
  TX: ['Houston', 'San Antonio', 'Dallas', 'Austin', 'Fort Worth'],
  UT: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem'],
  VT: ['Burlington', 'South Burlington', 'Rutland', 'Essex Junction', 'Barre'],
  VA: ['Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News'],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue'],
  WV: ['Charleston', 'Huntington', 'Parkersburg', 'Morgantown', 'Wheeling'],
  WI: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine'],
  WY: ['Cheyenne', 'Casper', 'Laramie', 'Gillette', 'Rock Springs'],
};

// Approximate state centroids for lat/lng generation
const STATE_COORDS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AK: [64.2, -152.5], AZ: [34.3, -111.7], AR: [34.8, -92.4],
  CA: [37.2, -119.5], CO: [39.0, -105.5], CT: [41.6, -72.7], DC: [38.9, -77.0],
  DE: [39.0, -75.5], FL: [28.6, -82.4], GA: [32.7, -83.5], HI: [20.8, -156.3],
  ID: [44.4, -114.6], IL: [40.0, -89.2], IN: [39.8, -86.3], IA: [42.0, -93.5],
  KS: [38.5, -98.3], KY: [37.8, -85.7], LA: [31.0, -92.0], ME: [45.4, -69.2],
  MD: [39.0, -76.7], MA: [42.3, -71.8], MI: [44.3, -84.6], MN: [46.3, -94.3],
  MS: [32.6, -89.7], MO: [38.4, -92.5], MT: [47.0, -109.6], NE: [41.5, -99.8],
  NV: [39.3, -116.6], NH: [43.7, -71.6], NJ: [40.1, -74.7], NM: [34.5, -106.0],
  NY: [42.9, -75.5], NC: [35.6, -79.4], ND: [47.4, -100.5], OH: [40.4, -82.8],
  OK: [35.6, -97.5], OR: [44.0, -120.5], PA: [40.9, -77.8], RI: [41.7, -71.5],
  SC: [34.0, -81.0], SD: [44.4, -100.2], TN: [35.9, -86.4], TX: [31.5, -99.4],
  UT: [39.3, -111.7], VT: [44.1, -72.6], VA: [37.5, -78.9], WA: [47.4, -120.7],
  WV: [38.6, -80.6], WI: [44.6, -89.8], WY: [43.0, -107.6],
};

// States with known military installations nearby (for nearMilitary flag)
const MILITARY_STATES = new Set([
  'VA', 'MD', 'DC', 'TX', 'CA', 'FL', 'NC', 'GA', 'WA', 'HI',
  'CO', 'OK', 'NV', 'NM', 'AL', 'SC', 'CT', 'KS', 'NE', 'AK',
]);

function computeScore(
  systemSize: SystemSize,
  gaps: { violations: number; sncStatus: boolean; dmrMissing: boolean; inspectionOverdue: boolean },
  digital: { hasScada: boolean; complexity: number },
): number {
  // System size weight (30%)
  const sizeComponent = SIZE_BASE[systemSize] * 0.3;

  // Compliance gaps (40%)
  const complianceRaw =
    gaps.violations * 10 +
    (gaps.sncStatus ? 25 : 0) +
    (gaps.dmrMissing ? 15 : 0) +
    (gaps.inspectionOverdue ? 15 : 0);
  const complianceComponent = Math.min(complianceRaw, 100) * 0.4;

  // Digital exposure (30%)
  const digitalRaw = (digital.hasScada ? 40 : 0) + digital.complexity * 60;
  const digitalComponent = Math.min(digitalRaw, 100) * 0.3;

  return Math.round(Math.min(sizeComponent + complianceComponent + digitalComponent, 100));
}

function scoreToLevel(score: number): CyberRiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

// ── Sample data generator ───────────────────────────────────────────────────

function generateStateAssessments(state: string): CyberRiskAssessment[] {
  const rng = xorshift32(seedFromString(`cyber-risk-${state}-2026`));
  const cities = CITY_NAMES[state] || ['Unknown'];
  const [baseLat, baseLng] = STATE_COORDS[state] || [39.0, -98.0];
  const isMilitaryState = MILITARY_STATES.has(state);

  // Each state gets 3-8 representative systems
  const count = 3 + Math.floor(rng() * 6);
  const assessments: CyberRiskAssessment[] = [];

  for (let i = 0; i < count; i++) {
    // Distribute sizes: more small systems, fewer very_large
    const sizeIdx = Math.min(Math.floor(rng() * rng() * 5), 4);
    const systemSize = SIZES[sizeIdx];

    const [popMin, popMax] = POPULATION_RANGES[systemSize];
    const populationServed = Math.round(popMin + rng() * (popMax - popMin));

    const city = cities[Math.floor(rng() * cities.length)];
    const lat = baseLat + (rng() - 0.5) * 2;
    const lng = baseLng + (rng() - 0.5) * 2;

    // Generate compliance gaps deterministically
    const violations = Math.floor(rng() * 5);
    const sncStatus = rng() > 0.75;
    const dmrMissing = rng() > 0.65;
    const inspectionOverdue = rng() > 0.60;

    // Digital exposure: larger systems more likely to have SCADA
    const hasScadaIndicators = systemSize === 'very_large' || systemSize === 'large'
      ? rng() > 0.2
      : rng() > 0.7;
    const systemComplexity = systemSize === 'very_large' ? 0.6 + rng() * 0.4
      : systemSize === 'large' ? 0.4 + rng() * 0.4
      : systemSize === 'medium' ? 0.2 + rng() * 0.4
      : rng() * 0.4;

    const cyberRiskScore = computeScore(
      systemSize,
      { violations, sncStatus, dmrMissing, inspectionOverdue },
      { hasScada: hasScadaIndicators, complexity: systemComplexity },
    );

    const nearMilitary = isMilitaryState && rng() > 0.5;
    const militaryDistanceMi = nearMilitary ? Math.round(rng() * 30 * 10) / 10 : null;

    assessments.push({
      registryId: `${state}-CWS-${String(i + 1).padStart(4, '0')}`,
      facilityName: `${city} Water System #${i + 1}`,
      state,
      city,
      lat: Math.round(lat * 10000) / 10000,
      lng: Math.round(lng * 10000) / 10000,
      systemSize,
      populationServed,
      complianceGaps: {
        recentViolations: violations,
        sncStatus,
        dmrMissing,
        inspectionOverdue,
      },
      digitalExposure: {
        hasScadaIndicators,
        systemComplexity: Math.round(systemComplexity * 100) / 100,
      },
      cyberRiskScore,
      riskLevel: scoreToLevel(cyberRiskScore),
      nearMilitary,
      militaryDistanceMi,
    });
  }

  return assessments;
}

// ── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isCyberRiskBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Cyber risk build already in progress',
      cache: getCyberRiskCacheStatus(),
    });
  }

  setCyberRiskBuildInProgress(true);
  const startTime = Date.now();

  try {
    console.log('[Cyber Risk Cron] Starting build (derived cache, sample data fallback)');

    // ── Generate assessments per state ──────────────────────────────────
    const stateMap: Record<string, CyberRiskAssessment[]> = {};
    let totalAssessments = 0;
    let highRiskCount = 0;
    let criticalCount = 0;
    let nearMilitaryCount = 0;

    for (const state of ALL_STATES) {
      const assessments = generateStateAssessments(state);
      stateMap[state] = assessments;
      totalAssessments += assessments.length;

      for (const a of assessments) {
        if (a.riskLevel === 'high') highRiskCount++;
        if (a.riskLevel === 'critical') criticalCount++;
        if (a.nearMilitary) nearMilitaryCount++;
      }
    }

    console.log(
      `[Cyber Risk Cron] Generated ${totalAssessments} assessments across ${ALL_STATES.length} states ` +
      `(${highRiskCount} high, ${criticalCount} critical, ${nearMilitaryCount} near-military)`,
    );

    // ── Empty-data guard ────────────────────────────────────────────────
    if (totalAssessments === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[Cyber Risk Cron] 0 assessments in ${elapsed}s - skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getCyberRiskCacheStatus(),
      });
    }

    // ── Save cache ──────────────────────────────────────────────────────
    await setCyberRiskCache({
      _meta: {
        built: new Date().toISOString(),
        assessmentCount: totalAssessments,
        statesCovered: Object.keys(stateMap).length,
        criticalCount,
      },
      byState: stateMap,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Cyber Risk Cron] Complete in ${elapsed}s`);

    recordCronRun('rebuild-cyber-risk', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      assessmentCount: totalAssessments,
      stateCount: Object.keys(stateMap).length,
      highRiskCount,
      criticalCount,
      nearMilitaryCount,
      cache: getCyberRiskCacheStatus(),
    });
  } catch (err: any) {
    console.error('[Cyber Risk Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-cyber-risk' } });

    notifySlackCronFailure({
      cronName: 'rebuild-cyber-risk',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });

    recordCronRun('rebuild-cyber-risk', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Cyber risk build failed' },
      { status: 500 },
    );
  } finally {
    setCyberRiskBuildInProgress(false);
  }
}
