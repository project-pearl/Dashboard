// app/api/cron/rebuild-omh/route.ts
// Cron — fetches OMH minority health disparities data from CDC PLACES.
// Schedule: weekly (Sunday 2:30 AM UTC) via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { setOMHCache, getOMHCacheInfo } from '@/lib/omhCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

const CDC_PLACES_URL = 'https://data.cdc.gov/resource/cwsq-ngmh.json';
const FETCH_TIMEOUT_MS = 60_000;

const STATE_CENTERS: Record<string, { lat: number; lng: number }> = {
  AL:{lat:32.81,lng:-86.79},AK:{lat:61.37,lng:-152.40},AZ:{lat:33.73,lng:-111.43},AR:{lat:34.97,lng:-92.37},
  CA:{lat:36.12,lng:-119.68},CO:{lat:39.06,lng:-105.31},CT:{lat:41.60,lng:-72.76},DE:{lat:39.32,lng:-75.51},
  DC:{lat:38.90,lng:-77.03},FL:{lat:27.77,lng:-81.69},GA:{lat:33.04,lng:-83.64},HI:{lat:21.09,lng:-157.50},
  ID:{lat:44.24,lng:-114.48},IL:{lat:40.35,lng:-88.99},IN:{lat:39.85,lng:-86.26},IA:{lat:42.01,lng:-93.21},
  KS:{lat:38.53,lng:-96.73},KY:{lat:37.67,lng:-84.67},LA:{lat:31.17,lng:-91.87},ME:{lat:44.69,lng:-69.38},
  MD:{lat:39.06,lng:-76.80},MA:{lat:42.23,lng:-71.53},MI:{lat:43.33,lng:-84.54},MN:{lat:45.69,lng:-93.90},
  MS:{lat:32.74,lng:-89.68},MO:{lat:38.46,lng:-92.29},MT:{lat:46.92,lng:-110.45},NE:{lat:41.13,lng:-98.27},
  NV:{lat:38.31,lng:-117.06},NH:{lat:43.45,lng:-71.56},NJ:{lat:40.30,lng:-74.52},NM:{lat:34.84,lng:-106.25},
  NY:{lat:42.17,lng:-74.95},NC:{lat:35.63,lng:-79.81},ND:{lat:47.53,lng:-99.78},OH:{lat:40.39,lng:-82.76},
  OK:{lat:35.57,lng:-96.93},OR:{lat:44.57,lng:-122.07},PA:{lat:40.59,lng:-77.21},RI:{lat:41.68,lng:-71.51},
  SC:{lat:33.86,lng:-80.95},SD:{lat:44.30,lng:-99.44},TN:{lat:35.75,lng:-86.69},TX:{lat:31.05,lng:-97.56},
  UT:{lat:40.15,lng:-111.86},VT:{lat:44.05,lng:-72.71},VA:{lat:37.77,lng:-78.17},WA:{lat:47.40,lng:-121.49},
  WV:{lat:38.49,lng:-80.95},WI:{lat:44.27,lng:-89.62},WY:{lat:42.76,lng:-107.30},
};

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const info = getOMHCacheInfo();
  if (info.isBuilding) return NextResponse.json({ status: 'skipped', reason: 'build in progress', cache: info });

  const startTime = Date.now();
  try {
    console.log('[OMH Cron] Fetching CDC PLACES health disparities data...');
    const res = await fetch(`${CDC_PLACES_URL}?$limit=5000&$where=data_value IS NOT NULL`, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    let rawData: any[] = [];
    if (res.ok) { rawData = await res.json(); console.log(`[OMH Cron] Fetched ${rawData.length} PLACES records`); }
    else { console.warn(`[OMH Cron] CDC PLACES HTTP ${res.status}`); }

    if (rawData.length === 0) { recordCronRun('rebuild-omh', 'success', Date.now() - startTime); return NextResponse.json({ status: 'empty' }); }

    // Group by state
    const stateGroups = new Map<string, any[]>();
    for (const row of rawData) {
      const state = row.stateabbr || row.locationabbr || '';
      if (!state || state.length !== 2) continue;
      if (!stateGroups.has(state)) stateGroups.set(state, []);
      stateGroups.get(state)!.push(row);
    }

    const disparitiesData: any[] = [];
    for (const [state, rows] of stateGroups) {
      const center = STATE_CENTERS[state];
      if (!center) continue;
      const getMeasure = (id: string) => { const r = rows.find((r: any) => r.measureid === id); return r ? parseFloat(r.data_value) || 0 : 0; };

      disparitiesData.push({
        dataId: `omh_${state}`, populationGroup: 'african_american', state, county: '', metropolitanArea: '',
        ruralUrbanStatus: 'urban', coordinates: center, totalPopulation: 0, populationPercentage: 0,
        ageDistribution: { under18: 0, age18to64: 0, age65plus: 0 },
        socioeconomicIndicators: { medianIncome: 0, povertyRate: 0, unemploymentRate: 0, educationLevelBachelorPlus: 0, uninsuredRate: getMeasure('ACCESS2') },
        militaryServiceMembers: 0, veteranPopulation: 0, militaryFamilies: 0, activedutySpouses: 0,
        healthOutcomes: { lifeExpectancy: 0, infantMortalityRate: 0, lowBirthWeightRate: getMeasure('LBW'), maternalMortalityRate: 0, preventableDeathRate: 0 },
        chronicDiseaseRates: { diabetes: getMeasure('DIABETES'), hypertension: getMeasure('BPHIGH'), heartDisease: getMeasure('CHD'), cancer: getMeasure('CANCER'), stroke: getMeasure('STROKE'), asthma: getMeasure('CASTHMA'), obesity: getMeasure('OBESITY') },
        mentalHealthIndicators: { depressionRate: getMeasure('DEPRESSION'), anxietyRate: 0, suicideRate: 0, substanceAbuseRate: getMeasure('BINGE'), mentalHealthServiceUtilization: 0 },
        healthcareAccess: { primaryCarePhysicianRatio: 0, specialtyAccessRating: 0, emergencyDepartmentUtilization: 0, preventiveCareUtilization: getMeasure('CHECKUP') },
        militaryHealthcareAccess: { tricareBeneficiaries: 0, vaMedicalCenterAccess: 0, militaryTreatmentFacilityAccess: 0, culturalCompetencyRating: 0 },
        environmentalFactors: { waterQualityScore: 0, airQualityIndex: 0, foodAccessScore: 0, housingQuality: 0, safetyConcerns: 0 },
        socialDeterminants: { transportationAccess: 0, internetAccess: 0, socialSupport: 0, communityEngagement: 0, discrimination: 0 },
        dataYear: new Date().getFullYear(), lastUpdated: new Date().toISOString(),
      });
    }

    await setOMHCache(disparitiesData, [], [], [], []);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[OMH Cron] Complete in ${elapsed}s — ${disparitiesData.length} state records`);
    recordCronRun('rebuild-omh', 'success', Date.now() - startTime);
    return NextResponse.json({ status: 'complete', duration: `${elapsed}s`, recordCount: disparitiesData.length });
  } catch (err: any) {
    console.error('[OMH Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-omh' } });
    notifySlackCronFailure({ cronName: 'rebuild-omh', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-omh', 'error', Date.now() - startTime, err.message);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
