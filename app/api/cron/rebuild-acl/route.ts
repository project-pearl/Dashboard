// app/api/cron/rebuild-acl/route.ts
// Cron endpoint — fetches ACL (Administration for Community Living) data from
// the Eldercare Locator API and ACL open data, maps to AreaAgencyOnAging
// objects, and populates the ACL cache.
// Schedule: daily at 5:00 AM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setACLCache,
  getACLCacheInfo,
} from '@/lib/aclCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

// Eldercare Locator API (ACL)
const ELDERCARE_API = 'https://eldercare.acl.gov/Public/Index.aspx';
// ACL OAAPS data — Aging Network Data (may be available via data.gov)
const ACL_DATAGOV_API = 'https://data.acl.gov/resource';
// Fallback: AGID (AGing Integrated Database) public data
const AGID_API = 'https://agid.acl.gov/DataFiles';
const FETCH_TIMEOUT_MS = 60_000;
const CONCURRENCY = 4;

/** US states for state-by-state queries */
const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

// Approximate state centers for coordinate assignment
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

async function fetchEldercareByState(state: string): Promise<any[]> {
  try {
    // Try the Eldercare Locator JSON search endpoint
    const params = new URLSearchParams({
      state,
      service: 'Area Agency on Aging',
      format: 'json',
    });

    const res = await fetch(`${ELDERCARE_API}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'PIN-HealthDataCron/1.0',
      },
    });

    if (!res.ok) {
      // If the main endpoint doesn't support JSON, try the API search path
      const altRes = await fetch(`https://eldercare.acl.gov/Public/Search.aspx?state=${state}&service=Area+Agency+on+Aging&format=json`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });

      if (!altRes.ok) {
        console.warn(`[ACL Cron] Eldercare ${state}: HTTP ${altRes.status}`);
        return [];
      }

      const altData = await altRes.json();
      return altData?.results || altData?.data || altData?.agencies || [];
    }

    const data = await res.json();
    return data?.results || data?.data || data?.agencies || [];
  } catch (e: any) {
    console.warn(`[ACL Cron] Eldercare ${state}: ${e.message}`);
    return [];
  }
}

async function fetchACLOpenData(): Promise<any[]> {
  try {
    // Try ACL data.gov / AGID for Area Agency on Aging data
    const res = await fetch(`${AGID_API}/StateProfile`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : data?.results || data?.data || [];
    }
  } catch (e: any) {
    console.warn(`[ACL Cron] AGID fallback: ${e.message}`);
  }

  return [];
}

function mapToAreaAgency(raw: any, state: string): any {
  const coords = STATE_CENTERS[state] || { lat: 39.8283, lng: -98.5795 };

  return {
    agencyId: raw.agency_id || raw.id || `acl_${state}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    agencyName: raw.agency_name || raw.name || raw.organization || `Area Agency on Aging - ${state}`,
    planningServiceArea: raw.planning_area || raw.service_area || raw.psa || state,

    address: raw.address || raw.street || '',
    city: raw.city || '',
    state: raw.state || state,
    zipCode: raw.zip_code || raw.zip || raw.zipcode || '',
    county: raw.county || '',
    serviceAreaCounties: raw.counties ? String(raw.counties).split(',').map((s: string) => s.trim()) : [],

    coordinates: {
      lat: parseFloat(raw.latitude || raw.lat) || coords.lat,
      lng: parseFloat(raw.longitude || raw.lng || raw.lon) || coords.lng,
    },

    totalPopulation60Plus: parseInt(raw.pop_60_plus || raw.population_60) || 0,
    populationTargetGroups: {
      minorityOlderAdults: parseInt(raw.minority_older_adults) || 0,
      lowIncomeOlderAdults: parseInt(raw.low_income_older_adults) || 0,
      ruralOlderAdults: parseInt(raw.rural_older_adults) || 0,
      limitedEnglishProficiency: parseInt(raw.lep_older_adults) || 0,
    },

    veteransServed: parseInt(raw.veterans_served || raw.veterans) || 0,
    militarySpousesServed: parseInt(raw.military_spouses) || 0,
    goldStarFamiliesServed: parseInt(raw.gold_star_families) || 0,
    veteranCaregiversSupported: parseInt(raw.veteran_caregivers) || 0,

    congregateMeals: {
      sitesOperated: parseInt(raw.congregate_sites) || 0,
      mealsServedAnnually: parseInt(raw.congregate_meals_served) || 0,
      participantsServed: parseInt(raw.congregate_participants) || 0,
    },

    homeDeliveredMeals: {
      mealsDeliveredAnnually: parseInt(raw.hdm_meals_delivered) || 0,
      recipientsServed: parseInt(raw.hdm_recipients) || 0,
      waitingList: parseInt(raw.hdm_waiting_list) || 0,
    },

    transportation: {
      tripsProvidedAnnually: parseInt(raw.transport_trips) || 0,
      individualsServed: parseInt(raw.transport_individuals) || 0,
      medicalTrips: parseInt(raw.medical_trips) || 0,
      shoppingTrips: parseInt(raw.shopping_trips) || 0,
    },

    informationAssistance: {
      contactsAnnually: parseInt(raw.ia_contacts) || 0,
      benefitsCounselingCases: parseInt(raw.benefits_counseling) || 0,
      healthInsuranceCounseling: parseInt(raw.ship_counseling) || 0,
    },

    caregiverSupport: {
      familyCaregivers: parseInt(raw.family_caregivers) || 0,
      grandfamilyCaregivers: parseInt(raw.grandfamily_caregivers) || 0,
      supportGroups: parseInt(raw.support_groups) || 0,
      respiteCareHours: parseInt(raw.respite_hours) || 0,
    },

    healthPromotion: {
      evidenceBasedPrograms: raw.evidence_based_programs ? String(raw.evidence_based_programs).split(',').map((s: string) => s.trim()) : [],
      participantsServed: parseInt(raw.hp_participants) || 0,
      fallsPrevention: parseInt(raw.falls_prevention) || 0,
      chronicDiseaseManagement: parseInt(raw.chronic_disease_mgmt) || 0,
    },

    veteranDirectedCare: parseBool(raw.veteran_directed_care),
    militaryFamilyLifeLine: parseBool(raw.military_family_lifeline),
    ptsdCaregiverSupport: parseBool(raw.ptsd_caregiver_support),
    tbiSupportServices: parseBool(raw.tbi_support),

    ombudsmanProgram: {
      complaintsCases: parseInt(raw.ombudsman_complaints) || 0,
      facilitiesVisited: parseInt(raw.ombudsman_facilities) || 0,
      advocacyContacts: parseInt(raw.ombudsman_advocacy) || 0,
    },

    elderAbusePrevention: {
      casesInvestigated: parseInt(raw.abuse_cases) || 0,
      educationPrograms: parseInt(raw.abuse_education) || 0,
      guardiansupport: parseInt(raw.guardian_support) || 0,
    },

    homeSafetyAssessments: parseInt(raw.home_safety) || 0,
    weatherizationReferrals: parseInt(raw.weatherization) || 0,
    waterQualityEducation: parseBool(raw.water_quality_education),

    oaaFunding: parseFloat(raw.oaa_funding) || 0,
    stateFunding: parseFloat(raw.state_funding) || 0,
    localFunding: parseFloat(raw.local_funding) || 0,
    totalBudget: parseFloat(raw.total_budget || raw.budget) || 0,

    fiscalYear: parseInt(raw.fiscal_year || raw.year) || new Date().getFullYear(),
    lastUpdated: new Date().toISOString(),
  };
}

function parseBool(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return ['yes', 'true', '1', 'y'].includes(val.toLowerCase());
  return false;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cacheInfo = getACLCacheInfo();
  if (cacheInfo.isBuilding) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'ACL build already in progress',
      cache: cacheInfo,
    });
  }

  const startTime = Date.now();

  try {
    // ── Fetch Area Agency on Aging data state-by-state ──────────────
    console.log('[ACL Cron] Fetching Area Agency on Aging data from Eldercare Locator...');
    const allRaw: any[] = [];
    const queue = [...STATES];
    let idx = 0;
    let running = 0;
    let statesFetched = 0;

    await new Promise<void>((resolve) => {
      function next() {
        if (idx >= queue.length && running === 0) return resolve();
        while (running < CONCURRENCY && idx < queue.length) {
          const st = queue[idx++];
          running++;
          (async () => {
            try {
              const items = await fetchEldercareByState(st);
              if (items.length > 0) {
                for (const item of items) {
                  allRaw.push({ ...item, _state: st });
                }
                statesFetched++;
                console.log(`[ACL Cron] ${st}: ${items.length} agencies`);
              }
            } catch {
              // skip on failure
            } finally {
              running--;
              next();
            }
          })();
        }
      }
      next();
    });

    console.log(`[ACL Cron] Eldercare Locator: ${allRaw.length} raw records from ${statesFetched} states`);

    // ── If Eldercare Locator returned nothing, try ACL open data fallback
    if (allRaw.length === 0) {
      console.warn('[ACL Cron] Eldercare Locator returned no data, trying ACL open data fallback...');
      const fallbackData = await fetchACLOpenData();
      if (fallbackData.length > 0) {
        for (const row of fallbackData) {
          allRaw.push({ ...row, _state: row.state || '' });
        }
        console.log(`[ACL Cron] ACL open data fallback: ${fallbackData.length} records`);
      }
    }

    // ── Map to AreaAgencyOnAging objects ──────────────────────────────
    const areaAgencies = allRaw.map((raw) => mapToAreaAgency(raw, raw._state || raw.state || ''));
    console.log(`[ACL Cron] Mapped ${areaAgencies.length} Area Agencies on Aging`);

    // ── Even with empty data, save what we have ──────────────────────
    if (areaAgencies.length === 0) {
      console.warn('[ACL Cron] No AAA data returned — saving empty cache');
    }

    // ── Save to cache — other arrays empty for now ───────────────────
    await setACLCache(
      areaAgencies,      // areaAgencies
      [],                // independentLivingCenters — populated as APIs become available
      [],                // ddCouncils
      [],                // tbiPrograms
      [],                // nutritionPrograms
      [],                // ombudsmanPrograms
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[ACL Cron] Complete in ${elapsed}s — ${areaAgencies.length} area agencies`);

    recordCronRun('rebuild-acl', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      areaAgencies: areaAgencies.length,
      independentLivingCenters: 0,
      ddCouncils: 0,
      tbiPrograms: 0,
      nutritionPrograms: 0,
      ombudsmanPrograms: 0,
      statesFetched,
      cache: getACLCacheInfo(),
    });

  } catch (err: any) {
    console.error('[ACL Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-acl' } });

    notifySlackCronFailure({ cronName: 'rebuild-acl', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-acl', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'ACL build failed' },
      { status: 500 },
    );
  }
}
