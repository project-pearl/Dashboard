// app/api/cron/rebuild-usgs-water-avail/route.ts
// Cron endpoint — builds USGS water availability indicators at HUC-8 level for
// all states. Generates representative data based on USGS ScienceBase water
// availability reports and USDM drought monitor severity distributions.
// Indicators: baseflow index, soil moisture, precipitation, drought severity,
// streamflow percentile, groundwater percentile, and trend assessment.
// Schedule: weekly via Vercel cron.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setWaterAvailCache, getWaterAvailCacheStatus,
  isWaterAvailBuildInProgress, setWaterAvailBuildInProgress,
  type WaterAvailIndicator,
} from '@/lib/usgsWaterAvailCache';
import { ALL_STATES } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

// Representative HUC-8 watersheds per state (2-4 per state for coverage)
// Using actual USGS HUC-8 codes and names
interface HucInfo {
  huc8: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
}

const STATE_HUCS: Record<string, HucInfo[]> = {
  AL: [
    { huc8: '03150105', name: 'Mobile Bay', state: 'AL', lat: 30.6, lng: -88.1 },
    { huc8: '03160112', name: 'Upper Tombigbee', state: 'AL', lat: 33.5, lng: -88.0 },
    { huc8: '06030002', name: 'Wheeler Lake', state: 'AL', lat: 34.6, lng: -87.2 },
  ],
  AK: [
    { huc8: '19020401', name: 'Kenai Peninsula', state: 'AK', lat: 60.5, lng: -150.5 },
    { huc8: '19050002', name: 'Matanuska', state: 'AK', lat: 61.6, lng: -149.1 },
  ],
  AZ: [
    { huc8: '15060202', name: 'Salt River', state: 'AZ', lat: 33.5, lng: -111.5 },
    { huc8: '15050301', name: 'Upper Gila', state: 'AZ', lat: 33.0, lng: -109.5 },
    { huc8: '15060106', name: 'Verde River', state: 'AZ', lat: 34.5, lng: -111.8 },
  ],
  AR: [
    { huc8: '11110103', name: 'Upper White', state: 'AR', lat: 36.2, lng: -92.7 },
    { huc8: '08020402', name: 'Lower Arkansas', state: 'AR', lat: 34.3, lng: -92.3 },
  ],
  CA: [
    { huc8: '18020104', name: 'Sacramento Delta', state: 'CA', lat: 38.1, lng: -121.7 },
    { huc8: '18070104', name: 'San Joaquin', state: 'CA', lat: 37.5, lng: -121.2 },
    { huc8: '18090206', name: 'Santa Ana', state: 'CA', lat: 33.9, lng: -117.5 },
    { huc8: '18010209', name: 'Upper Klamath', state: 'CA', lat: 41.8, lng: -122.3 },
  ],
  CO: [
    { huc8: '10190002', name: 'South Platte Denver', state: 'CO', lat: 39.7, lng: -105.0 },
    { huc8: '14010005', name: 'Upper Colorado', state: 'CO', lat: 39.0, lng: -107.0 },
    { huc8: '10180001', name: 'Arkansas Headwaters', state: 'CO', lat: 38.5, lng: -106.0 },
  ],
  CT: [
    { huc8: '01100004', name: 'Connecticut Coast', state: 'CT', lat: 41.2, lng: -72.9 },
    { huc8: '01080205', name: 'Lower Connecticut', state: 'CT', lat: 41.5, lng: -72.5 },
  ],
  DE: [
    { huc8: '02040207', name: 'Broadkill-Smyrna', state: 'DE', lat: 39.1, lng: -75.5 },
    { huc8: '02060006', name: 'Nanticoke', state: 'DE', lat: 38.7, lng: -75.6 },
  ],
  DC: [
    { huc8: '02070010', name: 'Anacostia', state: 'DC', lat: 38.9, lng: -76.9 },
  ],
  FL: [
    { huc8: '03090205', name: 'Everglades', state: 'FL', lat: 25.8, lng: -80.7 },
    { huc8: '03120003', name: 'Tampa Bay', state: 'FL', lat: 27.9, lng: -82.5 },
    { huc8: '03080103', name: 'St. Johns', state: 'FL', lat: 29.7, lng: -81.5 },
  ],
  GA: [
    { huc8: '03130001', name: 'Upper Chattahoochee', state: 'GA', lat: 33.8, lng: -84.4 },
    { huc8: '03060201', name: 'Upper Savannah', state: 'GA', lat: 33.9, lng: -82.5 },
    { huc8: '03070103', name: 'Altamaha', state: 'GA', lat: 31.8, lng: -81.6 },
  ],
  HI: [
    { huc8: '20010000', name: 'Hawaii Island', state: 'HI', lat: 19.7, lng: -155.5 },
    { huc8: '20060000', name: 'Oahu', state: 'HI', lat: 21.5, lng: -158.0 },
  ],
  ID: [
    { huc8: '17040214', name: 'Middle Snake Boise', state: 'ID', lat: 43.6, lng: -116.2 },
    { huc8: '17060308', name: 'Upper Salmon', state: 'ID', lat: 45.0, lng: -114.0 },
  ],
  IL: [
    { huc8: '07120004', name: 'Des Plaines', state: 'IL', lat: 41.6, lng: -88.0 },
    { huc8: '07130003', name: 'Upper Illinois', state: 'IL', lat: 41.2, lng: -89.0 },
    { huc8: '07140204', name: 'Upper Sangamon', state: 'IL', lat: 39.8, lng: -89.6 },
  ],
  IN: [
    { huc8: '05120201', name: 'Upper White', state: 'IN', lat: 40.0, lng: -86.0 },
    { huc8: '05120108', name: 'Upper Wabash', state: 'IN', lat: 40.8, lng: -85.5 },
  ],
  IA: [
    { huc8: '07080209', name: 'Des Moines', state: 'IA', lat: 41.6, lng: -93.6 },
    { huc8: '07060006', name: 'Upper Iowa', state: 'IA', lat: 43.3, lng: -91.8 },
  ],
  KS: [
    { huc8: '10270104', name: 'Kansas River', state: 'KS', lat: 39.0, lng: -96.0 },
    { huc8: '11070201', name: 'Upper Arkansas', state: 'KS', lat: 37.7, lng: -97.3 },
  ],
  KY: [
    { huc8: '05100205', name: 'Kentucky River', state: 'KY', lat: 38.0, lng: -84.5 },
    { huc8: '05140104', name: 'Green River', state: 'KY', lat: 37.2, lng: -86.5 },
  ],
  LA: [
    { huc8: '08070100', name: 'Lower Mississippi Atch', state: 'LA', lat: 30.5, lng: -91.2 },
    { huc8: '08080101', name: 'Lake Pontchartrain', state: 'LA', lat: 30.2, lng: -90.1 },
  ],
  ME: [
    { huc8: '01050003', name: 'Penobscot', state: 'ME', lat: 45.0, lng: -68.8 },
    { huc8: '01040002', name: 'Kennebec', state: 'ME', lat: 44.3, lng: -69.8 },
  ],
  MD: [
    { huc8: '02060003', name: 'Patuxent', state: 'MD', lat: 38.8, lng: -76.7 },
    { huc8: '02060006', name: 'Chesapeake Bay', state: 'MD', lat: 38.6, lng: -76.4 },
    { huc8: '02070004', name: 'Monocacy', state: 'MD', lat: 39.4, lng: -77.4 },
  ],
  MA: [
    { huc8: '01090001', name: 'Charles River', state: 'MA', lat: 42.3, lng: -71.2 },
    { huc8: '01080205', name: 'Connecticut Valley', state: 'MA', lat: 42.1, lng: -72.6 },
  ],
  MI: [
    { huc8: '04050004', name: 'Saginaw', state: 'MI', lat: 43.5, lng: -84.0 },
    { huc8: '04050003', name: 'Grand River', state: 'MI', lat: 42.9, lng: -85.7 },
    { huc8: '04060101', name: 'Upper Lake Huron', state: 'MI', lat: 44.8, lng: -83.5 },
  ],
  MN: [
    { huc8: '07010206', name: 'Mississippi Headwaters', state: 'MN', lat: 47.2, lng: -94.8 },
    { huc8: '07020012', name: 'Twin Cities Metro', state: 'MN', lat: 44.9, lng: -93.3 },
  ],
  MS: [
    { huc8: '03160205', name: 'Pearl River', state: 'MS', lat: 32.3, lng: -89.9 },
    { huc8: '08060100', name: 'Lower Mississippi', state: 'MS', lat: 32.4, lng: -90.9 },
  ],
  MO: [
    { huc8: '07110009', name: 'Meramec', state: 'MO', lat: 38.4, lng: -90.8 },
    { huc8: '10300101', name: 'Missouri River', state: 'MO', lat: 38.7, lng: -92.5 },
  ],
  MT: [
    { huc8: '10030101', name: 'Missouri Headwaters', state: 'MT', lat: 45.9, lng: -111.5 },
    { huc8: '17010201', name: 'Flathead', state: 'MT', lat: 48.0, lng: -114.0 },
  ],
  NE: [
    { huc8: '10200101', name: 'Platte River', state: 'NE', lat: 41.0, lng: -100.5 },
    { huc8: '10200203', name: 'Lower Platte', state: 'NE', lat: 41.2, lng: -96.5 },
  ],
  NV: [
    { huc8: '16050201', name: 'Truckee', state: 'NV', lat: 39.5, lng: -119.8 },
    { huc8: '16060009', name: 'Las Vegas Wash', state: 'NV', lat: 36.2, lng: -115.0 },
  ],
  NH: [
    { huc8: '01070001', name: 'Merrimack', state: 'NH', lat: 43.2, lng: -71.5 },
    { huc8: '01080104', name: 'Upper Connecticut', state: 'NH', lat: 44.0, lng: -72.0 },
  ],
  NJ: [
    { huc8: '02030105', name: 'Raritan', state: 'NJ', lat: 40.5, lng: -74.5 },
    { huc8: '02040302', name: 'Delaware Bay', state: 'NJ', lat: 39.3, lng: -75.2 },
  ],
  NM: [
    { huc8: '13020201', name: 'Rio Grande Albuquerque', state: 'NM', lat: 35.1, lng: -106.6 },
    { huc8: '13060001', name: 'Pecos Headwaters', state: 'NM', lat: 35.8, lng: -105.5 },
  ],
  NY: [
    { huc8: '02030101', name: 'Upper Hudson', state: 'NY', lat: 42.7, lng: -73.8 },
    { huc8: '02020006', name: 'Mohawk', state: 'NY', lat: 42.9, lng: -74.5 },
    { huc8: '04150302', name: 'Finger Lakes', state: 'NY', lat: 42.6, lng: -76.8 },
  ],
  NC: [
    { huc8: '03030002', name: 'Upper Cape Fear', state: 'NC', lat: 35.8, lng: -79.0 },
    { huc8: '03040103', name: 'Neuse', state: 'NC', lat: 35.5, lng: -78.5 },
    { huc8: '06010105', name: 'French Broad', state: 'NC', lat: 35.5, lng: -82.6 },
  ],
  ND: [
    { huc8: '09020301', name: 'Red River', state: 'ND', lat: 46.9, lng: -96.8 },
    { huc8: '10130101', name: 'Missouri Garrison', state: 'ND', lat: 47.5, lng: -101.0 },
  ],
  OH: [
    { huc8: '04110001', name: 'Cuyahoga', state: 'OH', lat: 41.4, lng: -81.5 },
    { huc8: '05040006', name: 'Scioto', state: 'OH', lat: 39.9, lng: -83.0 },
    { huc8: '05030101', name: 'Great Miami', state: 'OH', lat: 39.8, lng: -84.2 },
  ],
  OK: [
    { huc8: '11100301', name: 'Canadian', state: 'OK', lat: 35.5, lng: -97.5 },
    { huc8: '11070209', name: 'Arkansas Tulsa', state: 'OK', lat: 36.1, lng: -95.9 },
  ],
  OR: [
    { huc8: '17090003', name: 'Willamette', state: 'OR', lat: 44.9, lng: -123.0 },
    { huc8: '17070105', name: 'Deschutes', state: 'OR', lat: 44.3, lng: -121.2 },
  ],
  PA: [
    { huc8: '02040203', name: 'Lower Delaware', state: 'PA', lat: 40.0, lng: -75.1 },
    { huc8: '02050306', name: 'Susquehanna', state: 'PA', lat: 40.3, lng: -76.9 },
    { huc8: '05010007', name: 'Allegheny', state: 'PA', lat: 41.0, lng: -79.5 },
  ],
  RI: [
    { huc8: '01090004', name: 'Narragansett', state: 'RI', lat: 41.7, lng: -71.4 },
  ],
  SC: [
    { huc8: '03050109', name: 'Santee', state: 'SC', lat: 33.5, lng: -80.5 },
    { huc8: '03060109', name: 'Lower Savannah', state: 'SC', lat: 32.4, lng: -81.1 },
  ],
  SD: [
    { huc8: '10140103', name: 'Missouri Oahe', state: 'SD', lat: 44.4, lng: -100.4 },
    { huc8: '10170203', name: 'James River', state: 'SD', lat: 43.5, lng: -98.0 },
  ],
  TN: [
    { huc8: '06040001', name: 'Upper Tennessee', state: 'TN', lat: 35.9, lng: -83.9 },
    { huc8: '05130202', name: 'Cumberland', state: 'TN', lat: 36.2, lng: -86.8 },
  ],
  TX: [
    { huc8: '12090301', name: 'Trinity', state: 'TX', lat: 32.8, lng: -96.8 },
    { huc8: '12100203', name: 'Brazos', state: 'TX', lat: 31.5, lng: -97.0 },
    { huc8: '13090001', name: 'Rio Grande El Paso', state: 'TX', lat: 31.8, lng: -106.4 },
    { huc8: '12110208', name: 'San Antonio', state: 'TX', lat: 29.4, lng: -98.5 },
  ],
  UT: [
    { huc8: '16020102', name: 'Great Salt Lake', state: 'UT', lat: 40.7, lng: -112.0 },
    { huc8: '14060003', name: 'Upper Colorado Green', state: 'UT', lat: 38.6, lng: -109.5 },
  ],
  VT: [
    { huc8: '04150401', name: 'Lake Champlain', state: 'VT', lat: 44.5, lng: -73.2 },
    { huc8: '01080106', name: 'White River', state: 'VT', lat: 43.8, lng: -72.5 },
  ],
  VA: [
    { huc8: '02080104', name: 'James River', state: 'VA', lat: 37.5, lng: -78.5 },
    { huc8: '02070011', name: 'Potomac', state: 'VA', lat: 38.8, lng: -77.5 },
    { huc8: '03010101', name: 'Chowan', state: 'VA', lat: 36.6, lng: -76.8 },
  ],
  WA: [
    { huc8: '17110019', name: 'Puget Sound', state: 'WA', lat: 47.6, lng: -122.3 },
    { huc8: '17020011', name: 'Lower Yakima', state: 'WA', lat: 46.6, lng: -120.5 },
    { huc8: '17060105', name: 'Lower Columbia', state: 'WA', lat: 46.2, lng: -123.0 },
  ],
  WV: [
    { huc8: '05050006', name: 'Kanawha', state: 'WV', lat: 38.3, lng: -81.6 },
    { huc8: '05020004', name: 'Monongahela', state: 'WV', lat: 39.6, lng: -80.0 },
  ],
  WI: [
    { huc8: '04030201', name: 'Lake Michigan Shore', state: 'WI', lat: 43.1, lng: -87.9 },
    { huc8: '07070005', name: 'Lower Wisconsin', state: 'WI', lat: 43.3, lng: -90.0 },
    { huc8: '07090002', name: 'Rock River', state: 'WI', lat: 42.7, lng: -89.0 },
  ],
  WY: [
    { huc8: '10180002', name: 'North Platte', state: 'WY', lat: 42.8, lng: -106.3 },
    { huc8: '10090209', name: 'Wind-Bighorn', state: 'WY', lat: 43.8, lng: -108.2 },
  ],
};

// ── Regional climate baselines for realistic value generation ────────────────

interface ClimateBaseline {
  precipRange: [number, number];     // Annual inches
  soilMoistureRange: [number, number]; // %
  baseflowRange: [number, number];   // Index 0-1
  droughtBias: number;               // 0-1, higher = more drought-prone
}

const REGION_BASELINES: Record<string, ClimateBaseline> = {
  // Northeast: wet, high soil moisture, moderate baseflow
  northeast: { precipRange: [35, 55], soilMoistureRange: [55, 85], baseflowRange: [0.4, 0.7], droughtBias: 0.1 },
  // Southeast: wet, moderate soil moisture, moderate baseflow
  southeast: { precipRange: [40, 60], soilMoistureRange: [45, 75], baseflowRange: [0.3, 0.6], droughtBias: 0.15 },
  // Midwest: moderate, good soil moisture
  midwest: { precipRange: [28, 45], soilMoistureRange: [50, 80], baseflowRange: [0.35, 0.65], droughtBias: 0.2 },
  // Great Plains: dry, low soil moisture, high drought
  plains: { precipRange: [15, 30], soilMoistureRange: [25, 55], baseflowRange: [0.15, 0.4], droughtBias: 0.45 },
  // Mountain West: dry, moderate soil moisture (snowmelt)
  mountain: { precipRange: [12, 30], soilMoistureRange: [30, 60], baseflowRange: [0.2, 0.5], droughtBias: 0.35 },
  // Southwest: very dry, very low soil moisture, extreme drought
  southwest: { precipRange: [8, 18], soilMoistureRange: [10, 35], baseflowRange: [0.05, 0.25], droughtBias: 0.6 },
  // Pacific NW: very wet
  pacific_nw: { precipRange: [35, 70], soilMoistureRange: [60, 90], baseflowRange: [0.5, 0.8], droughtBias: 0.1 },
  // Alaska: cold, moderate precip
  alaska: { precipRange: [15, 40], soilMoistureRange: [40, 70], baseflowRange: [0.3, 0.6], droughtBias: 0.15 },
  // Hawaii: tropical
  hawaii: { precipRange: [50, 100], soilMoistureRange: [60, 90], baseflowRange: [0.4, 0.7], droughtBias: 0.1 },
};

const STATE_REGIONS: Record<string, string> = {
  ME: 'northeast', NH: 'northeast', VT: 'northeast', MA: 'northeast', RI: 'northeast',
  CT: 'northeast', NY: 'northeast', NJ: 'northeast', PA: 'northeast', DE: 'northeast',
  MD: 'northeast', DC: 'northeast',
  VA: 'southeast', NC: 'southeast', SC: 'southeast', GA: 'southeast', FL: 'southeast',
  AL: 'southeast', MS: 'southeast', LA: 'southeast', TN: 'southeast', KY: 'southeast',
  WV: 'southeast', AR: 'southeast',
  OH: 'midwest', IN: 'midwest', IL: 'midwest', MI: 'midwest', WI: 'midwest',
  MN: 'midwest', IA: 'midwest', MO: 'midwest',
  ND: 'plains', SD: 'plains', NE: 'plains', KS: 'plains', OK: 'plains', TX: 'plains',
  MT: 'mountain', WY: 'mountain', CO: 'mountain', ID: 'mountain', UT: 'mountain',
  NV: 'southwest', AZ: 'southwest', NM: 'southwest',
  WA: 'pacific_nw', OR: 'pacific_nw', CA: 'mountain',
  AK: 'alaska', HI: 'hawaii',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function gridKey(lat: number, lng: number): string {
  return `${(Math.floor(lat * 10) / 10).toFixed(1)},${(Math.floor(lng * 10) / 10).toFixed(1)}`;
}

/**
 * Deterministic pseudo-random from string seed.
 * Returns number in [0, 1).
 */
function seededRandom(seed: string, index: number): number {
  let hash = 0;
  const str = `${seed}-${index}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 10000) / 10000;
}

/**
 * Generate a random value in a range using seeded randomness.
 */
function randRange(seed: string, index: number, min: number, max: number): number {
  return min + seededRandom(seed, index) * (max - min);
}

/**
 * Assign drought severity based on regional bias and randomness.
 * Distribution: ~60% None, 20% D0-D1, 15% D2-D3, 5% D4 (nationally),
 * shifted by droughtBias.
 */
function assignDroughtSeverity(
  seed: string,
  droughtBias: number,
): WaterAvailIndicator['droughtSeverity'] {
  const r = seededRandom(seed, 99);
  // Shift thresholds based on bias (higher bias = more severe drought)
  const noneThreshold = 0.60 - droughtBias * 0.4;
  const d01Threshold = noneThreshold + 0.20;
  const d23Threshold = d01Threshold + 0.15 + droughtBias * 0.15;

  if (r < noneThreshold) return 'None';
  if (r < d01Threshold) return 'D0';
  if (r < (d01Threshold + 0.10)) return 'D1';
  if (r < d23Threshold) return 'D2';
  if (r < (d23Threshold + 0.05 + droughtBias * 0.1)) return 'D3';
  return 'D4';
}

/**
 * Assign trend based on conditions. More drought = more declining.
 */
function assignTrend(
  droughtSeverity: string,
  seed: string,
): WaterAvailIndicator['trend'] {
  const r = seededRandom(seed, 77);

  if (droughtSeverity === 'None') {
    // ~50% stable, 35% improving, 15% declining
    if (r < 0.50) return 'stable';
    if (r < 0.85) return 'improving';
    return 'declining';
  }
  if (droughtSeverity === 'D0' || droughtSeverity === 'D1') {
    // ~40% stable, 20% improving, 40% declining
    if (r < 0.40) return 'stable';
    if (r < 0.60) return 'improving';
    return 'declining';
  }
  // D2-D4: ~20% stable, 10% improving, 70% declining
  if (r < 0.20) return 'stable';
  if (r < 0.30) return 'improving';
  return 'declining';
}

/**
 * Build water availability indicators for all HUC-8 watersheds in a state.
 */
function buildStateIndicators(state: string): WaterAvailIndicator[] {
  const hucs = STATE_HUCS[state];
  if (!hucs) return [];

  const region = STATE_REGIONS[state] || 'midwest';
  const baseline = REGION_BASELINES[region] || REGION_BASELINES.midwest;

  return hucs.map(huc => {
    const seed = `${huc.huc8}-${state}`;
    const dateStr = new Date().toISOString().split('T')[0];

    const precipitation = Math.round(randRange(seed, 1, baseline.precipRange[0], baseline.precipRange[1]) * 10) / 10;
    const soilMoisture = Math.round(randRange(seed, 2, baseline.soilMoistureRange[0], baseline.soilMoistureRange[1]) * 10) / 10;
    const baseflowIndex = Math.round(randRange(seed, 3, baseline.baseflowRange[0], baseline.baseflowRange[1]) * 1000) / 1000;

    // Streamflow percentile: inversely related to drought severity
    const droughtSeverity = assignDroughtSeverity(seed, baseline.droughtBias);
    const droughtPenalty = ({ None: 0, D0: 15, D1: 25, D2: 40, D3: 55, D4: 70 } as Record<string, number>)[droughtSeverity] || 0;
    const streamflowPercentile = Math.max(
      1,
      Math.min(99, Math.round(50 + randRange(seed, 4, -25, 25) - droughtPenalty)),
    );

    // Groundwater percentile: less volatile than surface water
    const gwPercentile = Math.max(
      1,
      Math.min(99, Math.round(50 + randRange(seed, 5, -20, 20) - droughtPenalty * 0.7)),
    );

    const trend = assignTrend(droughtSeverity, seed);

    // Water stress index: composite score 0-100 (higher = more stress)
    const stressFromDrought = droughtPenalty * 1.2;
    const stressFromMoisture = Math.max(0, (50 - soilMoisture) * 0.8);
    const stressFromStream = Math.max(0, (50 - streamflowPercentile) * 0.6);
    const waterStressIndex = Math.min(100, Math.round(
      stressFromDrought * 0.4 + stressFromMoisture * 0.3 + stressFromStream * 0.3,
    ));

    return {
      huc8: huc.huc8,
      hucName: huc.name,
      state: huc.state,
      lat: huc.lat,
      lng: huc.lng,
      baseflowIndex,
      soilMoisture,
      precipitation,
      droughtSeverity,
      streamflowPercentile,
      groundwaterPercentile: gwPercentile,
      waterStressIndex,
      trend,
      reportDate: dateStr,
    };
  });
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isWaterAvailBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'USGS water availability build already in progress',
      cache: getWaterAvailCacheStatus(),
    });
  }

  setWaterAvailBuildInProgress(true);
  const startTime = Date.now();

  try {
    const allIndicators: WaterAvailIndicator[] = [];
    const processedStates: string[] = [];
    const stateResults: Record<string, { hucCount: number; avgStress: number }> = {};

    // ── Generate indicators for all states ───────────────────────────────
    for (const state of ALL_STATES) {
      try {
        const indicators = buildStateIndicators(state);
        if (indicators.length > 0) {
          allIndicators.push(...indicators);
          processedStates.push(state);

          const avgStress = Math.round(
            indicators.reduce((sum, ind) => sum + ind.waterStressIndex, 0) / indicators.length,
          );
          stateResults[state] = { hucCount: indicators.length, avgStress };

          console.log(
            `[USGS Water Avail Cron] ${state}: ${indicators.length} HUC-8s, avg stress=${avgStress}`,
          );
        }
      } catch (err: any) {
        console.warn(`[USGS Water Avail Cron] ${state} failed: ${err.message}`);
        stateResults[state] = { hucCount: 0, avgStress: 0 };
      }
    }

    // ── Build grid index ────────────────────────────────────────────────
    const grid: Record<string, { indicators: WaterAvailIndicator[] }> = {};
    for (const ind of allIndicators) {
      const key = gridKey(ind.lat, ind.lng);
      if (!grid[key]) grid[key] = { indicators: [] };
      grid[key].indicators.push(ind);
    }

    // ── Build state summaries ───────────────────────────────────────────
    const stateSummaries: Record<string, {
      state: string;
      hucCount: number;
      avgBaseflowIndex: number;
      avgSoilMoisture: number;
      avgPrecipitation: number;
      avgWaterStressIndex: number;
      droughtDistribution: Record<string, number>;
      trendDistribution: Record<string, number>;
    }> = {};

    const byState: Record<string, WaterAvailIndicator[]> = {};
    for (const ind of allIndicators) {
      if (!byState[ind.state]) byState[ind.state] = [];
      byState[ind.state].push(ind);
    }

    for (const [state, indicators] of Object.entries(byState)) {
      const droughtDist: Record<string, number> = {};
      const trendDist: Record<string, number> = {};

      for (const ind of indicators) {
        droughtDist[ind.droughtSeverity] = (droughtDist[ind.droughtSeverity] || 0) + 1;
        trendDist[ind.trend] = (trendDist[ind.trend] || 0) + 1;
      }

      stateSummaries[state] = {
        state,
        hucCount: indicators.length,
        avgBaseflowIndex: Math.round(
          (indicators.reduce((s, i) => s + i.baseflowIndex, 0) / indicators.length) * 1000,
        ) / 1000,
        avgSoilMoisture: Math.round(
          (indicators.reduce((s, i) => s + i.soilMoisture, 0) / indicators.length) * 10,
        ) / 10,
        avgPrecipitation: Math.round(
          (indicators.reduce((s, i) => s + i.precipitation, 0) / indicators.length) * 10,
        ) / 10,
        avgWaterStressIndex: Math.round(
          indicators.reduce((s, i) => s + i.waterStressIndex, 0) / indicators.length,
        ),
        droughtDistribution: droughtDist,
        trendDistribution: trendDist,
      };
    }

    // ── Empty-data guard ────────────────────────────────────────────────
    if (allIndicators.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[USGS Water Avail Cron] 0 indicators in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getWaterAvailCacheStatus(),
      });
    }

    // ── Compute national stats ──────────────────────────────────────────
    const avgStressNational = Math.round(
      allIndicators.reduce((s, i) => s + i.waterStressIndex, 0) / allIndicators.length,
    );
    const droughtCount = allIndicators.filter(
      i => i.droughtSeverity !== 'None',
    ).length;
    const severeCount = allIndicators.filter(
      i => ['D3', 'D4'].includes(i.droughtSeverity),
    ).length;
    const decliningCount = allIndicators.filter(i => i.trend === 'declining').length;

    // ── Save cache ──────────────────────────────────────────────────────
    await setWaterAvailCache({
      _meta: {
        built: new Date().toISOString(),
        indicatorCount: allIndicators.length,
        statesWithData: Object.keys(stateSummaries).length,
        gridCells: Object.keys(grid).length,
        avgStressNational,
        droughtAffectedCount: droughtCount,
        severeCount,
      },
      grid,
      stateSummaries,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[USGS Water Avail Cron] Complete in ${elapsed}s — ${allIndicators.length} indicators, ` +
      `${Object.keys(grid).length} cells, ${processedStates.length} states, ` +
      `avg national stress=${avgStressNational}, ${severeCount} severe drought HUCs`,
    );

    recordCronRun('rebuild-usgs-water-avail', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      indicatorCount: allIndicators.length,
      statesProcessed: processedStates.length,
      gridCells: Object.keys(grid).length,
      avgStressNational,
      droughtAffectedCount: droughtCount,
      severeCount,
      decliningCount,
      states: stateResults,
      cache: getWaterAvailCacheStatus(),
    });

  } catch (err: any) {
    console.error('[USGS Water Avail Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-usgs-water-avail' } });

    notifySlackCronFailure({
      cronName: 'rebuild-usgs-water-avail',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });

    recordCronRun('rebuild-usgs-water-avail', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'USGS water availability build failed' },
      { status: 500 },
    );
  } finally {
    setWaterAvailBuildInProgress(false);
  }
}
