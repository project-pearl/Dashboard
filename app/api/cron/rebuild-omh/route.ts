// app/api/cron/rebuild-omh/route.ts
// Cron endpoint — fetches OMH (Office of Minority Health) health disparities
// data from HHS open data / Socrata, maps to HealthDisparitiesData objects,
// and populates the OMH cache.
// Schedule: daily at 4:45 AM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setOMHCache,
  getOMHCacheInfo,
} from '@/lib/omhCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

// HHS Socrata open data endpoint — minority health / health disparities
const HHS_SOCRATA_API = 'https://data.hhs.gov/resource';

// Known OMH-related datasets on HHS open data
const HEALTH_DISPARITIES_DATASET = 'pqnx-2p5b'; // Minority health indicators
const FETCH_TIMEOUT_MS = 60_000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 10;

// State FIPS-to-name mapping for coordinate approximation
const STATE_CENTERS: Record<string, { lat: number; lng: number }> = {
  AL: { lat: 32.806671, lng: -86.791130 }, AK: { lat: 61.370716, lng: -152.404419 },
  AZ: { lat: 33.729759, lng: -111.431221 }, AR: { lat: 34.969704, lng: -92.373123 },
  CA: { lat: 36.116203, lng: -119.681564 }, CO: { lat: 39.059811, lng: -105.311104 },
  CT: { lat: 41.597782, lng: -72.755371 }, DE: { lat: 39.318523, lng: -75.507141 },
  DC: { lat: 38.897438, lng: -77.026817 }, FL: { lat: 27.766279, lng: -81.686783 },
  GA: { lat: 33.040619, lng: -83.643074 }, HI: { lat: 21.094318, lng: -157.498337 },
  ID: { lat: 44.240459, lng: -114.478828 }, IL: { lat: 40.349457, lng: -88.986137 },
  IN: { lat: 39.849426, lng: -86.258278 }, IA: { lat: 42.011539, lng: -93.210526 },
  KS: { lat: 38.526600, lng: -96.726486 }, KY: { lat: 37.668140, lng: -84.670067 },
  LA: { lat: 31.169546, lng: -91.867805 }, ME: { lat: 44.693947, lng: -69.381927 },
  MD: { lat: 39.063946, lng: -76.802101 }, MA: { lat: 42.230171, lng: -71.530106 },
  MI: { lat: 43.326618, lng: -84.536095 }, MN: { lat: 45.694454, lng: -93.900192 },
  MS: { lat: 32.741646, lng: -89.678696 }, MO: { lat: 38.456085, lng: -92.288368 },
  MT: { lat: 46.921925, lng: -110.454353 }, NE: { lat: 41.125370, lng: -98.268082 },
  NV: { lat: 38.313515, lng: -117.055374 }, NH: { lat: 43.452492, lng: -71.563896 },
  NJ: { lat: 40.298904, lng: -74.521011 }, NM: { lat: 34.840515, lng: -106.248482 },
  NY: { lat: 42.165726, lng: -74.948051 }, NC: { lat: 35.630066, lng: -79.806419 },
  ND: { lat: 47.528912, lng: -99.784012 }, OH: { lat: 40.388783, lng: -82.764915 },
  OK: { lat: 35.565342, lng: -96.928917 }, OR: { lat: 44.572021, lng: -122.070938 },
  PA: { lat: 40.590752, lng: -77.209755 }, RI: { lat: 41.680893, lng: -71.511780 },
  SC: { lat: 33.856892, lng: -80.945007 }, SD: { lat: 44.299782, lng: -99.438828 },
  TN: { lat: 35.747845, lng: -86.692345 }, TX: { lat: 31.054487, lng: -97.563461 },
  UT: { lat: 40.150032, lng: -111.862434 }, VT: { lat: 44.045876, lng: -72.710686 },
  VA: { lat: 37.769337, lng: -78.169968 }, WA: { lat: 47.400902, lng: -121.490494 },
  WV: { lat: 38.491226, lng: -80.954453 }, WI: { lat: 44.268543, lng: -89.616508 },
  WY: { lat: 42.755966, lng: -107.302490 },
};

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchHHSSocrataDataset(datasetId: string, label: string): Promise<any[]> {
  const allRows: any[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    try {
      const params = new URLSearchParams({
        '$limit': String(PAGE_SIZE),
        '$offset': String(offset),
      });

      const res = await fetch(`${HHS_SOCRATA_API}/${datasetId}.json?${params}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        console.warn(`[OMH Cron] ${label} page ${page}: HTTP ${res.status}`);
        break;
      }

      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`[OMH Cron] ${label}: finished at page ${page} (${allRows.length} rows)`);
        break;
      }

      allRows.push(...rows);
      console.log(`[OMH Cron] ${label} page ${page}: ${rows.length} rows (total ${allRows.length})`);

      if (rows.length < PAGE_SIZE) break;
    } catch (e: any) {
      console.warn(`[OMH Cron] ${label} page ${page}: ${e.message}`);
      break;
    }
  }

  return allRows;
}

type PopulationGroup = 'african_american' | 'hispanic_latino' | 'american_indian_alaska_native' | 'asian_american' | 'native_hawaiian_pacific_islander' | 'multiracial';

function determinePopulationGroup(raw: any): PopulationGroup {
  const group = (raw.race || raw.population_group || raw.ethnicity || raw.group || '').toLowerCase();
  if (group.includes('african') || group.includes('black')) return 'african_american';
  if (group.includes('hispanic') || group.includes('latino')) return 'hispanic_latino';
  if (group.includes('indian') || group.includes('native') || group.includes('alaska')) return 'american_indian_alaska_native';
  if (group.includes('asian')) return 'asian_american';
  if (group.includes('hawaiian') || group.includes('pacific')) return 'native_hawaiian_pacific_islander';
  return 'multiracial';
}

function mapToDisparitiesData(raw: any): any {
  const stateAbbr = (raw.state || raw.state_abbr || raw.locationabbr || '').toUpperCase();
  const coords = STATE_CENTERS[stateAbbr] || { lat: 39.8283, lng: -98.5795 }; // US center fallback

  return {
    dataId: `omh_${raw.id || raw.row_id || Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    populationGroup: determinePopulationGroup(raw),

    state: stateAbbr || raw.state || 'Unknown',
    county: raw.county || raw.county_name || '',
    metropolitanArea: raw.metro_area || raw.metropolitan_area || '',
    ruralUrbanStatus: determineRuralUrban(raw.rural_urban || raw.urbanicity),

    coordinates: {
      lat: parseFloat(raw.latitude || raw.lat) || coords.lat,
      lng: parseFloat(raw.longitude || raw.lng) || coords.lng,
    },

    totalPopulation: parseInt(raw.population || raw.total_population) || 0,
    populationPercentage: parseFloat(raw.population_percentage || raw.pct) || 0,
    ageDistribution: {
      under18: parseFloat(raw.under18 || raw.age_under_18) || 0,
      age18to64: parseFloat(raw.age18_64 || raw.age_18_64) || 0,
      age65plus: parseFloat(raw.age65plus || raw.age_65_plus) || 0,
    },

    socioeconomicIndicators: {
      medianIncome: parseInt(raw.median_income || raw.income) || 0,
      povertyRate: parseFloat(raw.poverty_rate || raw.poverty) || 0,
      unemploymentRate: parseFloat(raw.unemployment_rate || raw.unemployment) || 0,
      educationLevelBachelorPlus: parseFloat(raw.education_bachelor || raw.bachelor_plus) || 0,
      uninsuredRate: parseFloat(raw.uninsured_rate || raw.uninsured) || 0,
    },

    militaryServiceMembers: parseInt(raw.military_members) || 0,
    veteranPopulation: parseInt(raw.veteran_population || raw.veterans) || 0,
    militaryFamilies: parseInt(raw.military_families) || 0,
    activedutySpouses: parseInt(raw.active_duty_spouses) || 0,

    healthOutcomes: {
      lifeExpectancy: parseFloat(raw.life_expectancy) || 0,
      infantMortalityRate: parseFloat(raw.infant_mortality || raw.infant_mortality_rate) || 0,
      lowBirthWeightRate: parseFloat(raw.low_birth_weight) || 0,
      maternalMortalityRate: parseFloat(raw.maternal_mortality) || 0,
      preventableDeathRate: parseFloat(raw.preventable_deaths) || 0,
    },

    chronicDiseaseRates: {
      diabetes: parseFloat(raw.diabetes_rate || raw.diabetes) || 0,
      hypertension: parseFloat(raw.hypertension_rate || raw.hypertension) || 0,
      heartDisease: parseFloat(raw.heart_disease_rate || raw.heart_disease) || 0,
      cancer: parseFloat(raw.cancer_rate || raw.cancer) || 0,
      stroke: parseFloat(raw.stroke_rate || raw.stroke) || 0,
      asthma: parseFloat(raw.asthma_rate || raw.asthma) || 0,
      obesity: parseFloat(raw.obesity_rate || raw.obesity) || 0,
    },

    mentalHealthIndicators: {
      depressionRate: parseFloat(raw.depression_rate) || 0,
      anxietyRate: parseFloat(raw.anxiety_rate) || 0,
      suicideRate: parseFloat(raw.suicide_rate) || 0,
      substanceAbuseRate: parseFloat(raw.substance_abuse_rate) || 0,
      mentalHealthServiceUtilization: parseFloat(raw.mh_utilization) || 0,
    },

    healthcareAccess: {
      primaryCarePhysicianRatio: parseFloat(raw.pcp_ratio) || 0,
      specialtyAccessRating: parseFloat(raw.specialty_access) || 0,
      emergencyDepartmentUtilization: parseFloat(raw.ed_utilization) || 0,
      preventiveCareUtilization: parseFloat(raw.preventive_care) || 0,
    },

    militaryHealthcareAccess: {
      tricareBeneficiaries: parseInt(raw.tricare_beneficiaries) || 0,
      vaMedicalCenterAccess: parseFloat(raw.va_access) || 0,
      militaryTreatmentFacilityAccess: parseFloat(raw.mtf_access) || 0,
      culturalCompetencyRating: parseFloat(raw.cultural_competency) || 0,
    },

    environmentalFactors: {
      waterQualityScore: parseFloat(raw.water_quality) || 50,
      airQualityIndex: parseFloat(raw.air_quality) || 50,
      foodAccessScore: parseFloat(raw.food_access) || 50,
      housingQuality: parseFloat(raw.housing_quality) || 50,
      safetyConcerns: parseFloat(raw.safety) || 50,
    },

    socialDeterminants: {
      transportationAccess: parseFloat(raw.transportation) || 50,
      internetAccess: parseFloat(raw.internet_access) || 50,
      socialSupport: parseFloat(raw.social_support) || 50,
      communityEngagement: parseFloat(raw.community_engagement) || 50,
      discrimination: parseFloat(raw.discrimination) || 0,
    },

    dataYear: parseInt(raw.year || raw.data_year) || new Date().getFullYear(),
    lastUpdated: new Date().toISOString(),
  };
}

function determineRuralUrban(val: any): 'urban' | 'suburban' | 'rural' {
  const v = (val || '').toLowerCase();
  if (v.includes('urban') || v.includes('metro')) return 'urban';
  if (v.includes('suburban')) return 'suburban';
  if (v.includes('rural') || v.includes('nonmetro')) return 'rural';
  return 'urban';
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cacheInfo = getOMHCacheInfo();
  if (cacheInfo.isBuilding) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'OMH build already in progress',
      cache: cacheInfo,
    });
  }

  const startTime = Date.now();

  try {
    // ── Fetch health disparities data from HHS Socrata ──────────────
    console.log('[OMH Cron] Fetching health disparities data from HHS open data...');
    const rawRows = await fetchHHSSocrataDataset(HEALTH_DISPARITIES_DATASET, 'Health Disparities');
    console.log(`[OMH Cron] Fetched ${rawRows.length} raw disparity records`);

    // ── Map to HealthDisparitiesData objects ─────────────────────────
    const disparitiesData = rawRows.map(mapToDisparitiesData);
    console.log(`[OMH Cron] Mapped ${disparitiesData.length} disparity records`);

    // ── Even if the primary dataset returned no data, save what we can
    if (disparitiesData.length === 0) {
      console.warn('[OMH Cron] No disparities data returned — saving empty cache');
    }

    // ── Save to cache — other arrays empty for now ───────────────────
    await setOMHCache(
      disparitiesData,   // disparitiesData
      [],                // culturalCompetencyPrograms — populated as APIs become available
      [],                // communityHealthWorkers
      [],                // healthEquityGrants
      [],                // surveillanceData
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[OMH Cron] Complete in ${elapsed}s — ${disparitiesData.length} disparity records`);

    recordCronRun('rebuild-omh', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      disparitiesData: disparitiesData.length,
      culturalCompetencyPrograms: 0,
      communityHealthWorkers: 0,
      healthEquityGrants: 0,
      surveillanceData: 0,
      cache: getOMHCacheInfo(),
    });

  } catch (err: any) {
    console.error('[OMH Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-omh' } });

    notifySlackCronFailure({ cronName: 'rebuild-omh', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-omh', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'OMH build failed' },
      { status: 500 },
    );
  }
}
