// app/api/cron/rebuild-ihs/route.ts
// Cron endpoint — fetches IHS (Indian Health Service) facility data from the
// HIFLD open dataset and IHS facility locations, maps to IHSServiceUnit
// objects, and populates the IHS cache.
// Schedule: daily at 4:30 AM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setIHSCache,
  getIHSCacheInfo,
} from '@/lib/ihsCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

// HIFLD IHS Health Facilities open dataset (ArcGIS FeatureServer)
const HIFLD_IHS_API = 'https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/IHS_Facilities/FeatureServer/0/query';
// Fallback: IHS facility listing via data.gov CKAN
const IHS_DATAGOV_API = 'https://catalog.data.gov/api/3/action/package_show?id=ihs-facilities';
const FETCH_TIMEOUT_MS = 60_000;
const PAGE_SIZE = 1000;

// ── IHS Area codes ───────────────────────────────────────────────────────────

const IHS_AREAS = [
  'Alaska', 'Albuquerque', 'Bemidji', 'Billings', 'California',
  'Great Plains', 'Nashville', 'Navajo', 'Oklahoma City', 'Phoenix',
  'Portland', 'Tucson',
];

// ── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchHIFLDFacilities(): Promise<any[]> {
  const allFeatures: any[] = [];
  let offset = 0;

  for (let page = 0; page < 10; page++) {
    try {
      const params = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        f: 'json',
        resultRecordCount: String(PAGE_SIZE),
        resultOffset: String(offset),
      });

      const res = await fetch(`${HIFLD_IHS_API}?${params}`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        console.warn(`[IHS Cron] HIFLD page ${page}: HTTP ${res.status}`);
        break;
      }

      const data = await res.json();
      const features = data?.features || [];

      if (!Array.isArray(features) || features.length === 0) {
        console.log(`[IHS Cron] HIFLD: finished at page ${page} (${allFeatures.length} features)`);
        break;
      }

      allFeatures.push(...features);
      console.log(`[IHS Cron] HIFLD page ${page}: ${features.length} features (total ${allFeatures.length})`);

      offset += PAGE_SIZE;
      if (features.length < PAGE_SIZE) break;
    } catch (e: any) {
      console.warn(`[IHS Cron] HIFLD page ${page}: ${e.message}`);
      break;
    }
  }

  return allFeatures;
}

function mapToServiceUnit(feature: any): any {
  const attrs = feature.attributes || feature.properties || feature;
  const geom = feature.geometry || {};

  const lat = geom.y ?? geom.latitude ?? parseFloat(attrs.LATITUDE || attrs.latitude || attrs.Y || '0');
  const lng = geom.x ?? geom.longitude ?? parseFloat(attrs.LONGITUDE || attrs.longitude || attrs.X || '0');

  return {
    serviceUnitId: attrs.OBJECTID?.toString() || attrs.ID?.toString() || attrs.FACILITYID || `ihs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    serviceUnitName: attrs.NAME || attrs.FACILITY_NAME || attrs.name || 'Unknown IHS Facility',
    area: attrs.IHS_AREA || attrs.AREA || determineIHSArea(attrs.STATE || attrs.state || ''),

    address: attrs.ADDRESS || attrs.STREET || attrs.address || '',
    city: attrs.CITY || attrs.city || '',
    state: attrs.STATE || attrs.state || '',
    zipCode: attrs.ZIP || attrs.ZIPCODE || attrs.zip || '',
    county: attrs.COUNTY || attrs.county || '',
    tribalLands: attrs.TRIBAL_LANDS ? String(attrs.TRIBAL_LANDS).split(',').map((s: string) => s.trim()) : [],

    coordinates: { lat, lng },

    servicePopulation: parseInt(attrs.SERVICE_POP || attrs.POPULATION) || 0,
    registeredUsers: parseInt(attrs.REGISTERED_USERS) || 0,
    activePatients: parseInt(attrs.ACTIVE_PATIENTS) || 0,
    annualVisits: parseInt(attrs.ANNUAL_VISITS) || 0,

    hospitalFacilities: parseInt(attrs.HOSPITALS) || (attrs.TYPE === 'Hospital' ? 1 : 0),
    healthCenterFacilities: parseInt(attrs.HEALTH_CENTERS) || (attrs.TYPE === 'Health Center' ? 1 : 0),
    healthStationFacilities: parseInt(attrs.HEALTH_STATIONS) || (attrs.TYPE === 'Health Station' ? 1 : 0),
    alaskaVillageClinics: parseInt(attrs.VILLAGE_CLINICS) || 0,

    physicians: parseInt(attrs.PHYSICIANS) || 0,
    nurses: parseInt(attrs.NURSES) || 0,
    dentists: parseInt(attrs.DENTISTS) || 0,
    mentalHealthProviders: parseInt(attrs.MENTAL_HEALTH_PROVIDERS) || 0,
    communityHealthRepresentatives: parseInt(attrs.CHR) || 0,
    traditionalHealers: parseInt(attrs.TRADITIONAL_HEALERS) || 0,

    diabetesProgram: parseBool(attrs.DIABETES_PROGRAM),
    elderCareProgram: parseBool(attrs.ELDER_CARE),
    maternalChildHealthProgram: parseBool(attrs.MATERNAL_CHILD_HEALTH),
    mentalHealthProgram: parseBool(attrs.MENTAL_HEALTH_PROGRAM),
    substanceAbuseProgram: parseBool(attrs.SUBSTANCE_ABUSE_PROGRAM),
    environmentalHealthProgram: parseBool(attrs.ENVIRONMENTAL_HEALTH),

    nativeVeteransServed: parseInt(attrs.NATIVE_VETERANS) || 0,
    militaryServiceMembersServed: parseInt(attrs.MILITARY_MEMBERS) || 0,
    veteranHealthcarePartnership: parseBool(attrs.VETERAN_PARTNERSHIP),
    militaryFamiliesInTribalCommunity: parseInt(attrs.MILITARY_FAMILIES) || 0,

    traditionalHealingPrograms: parseBool(attrs.TRADITIONAL_HEALING),
    culturalCompetencyTraining: parseBool(attrs.CULTURAL_TRAINING),
    nativeLanguageServices: parseBool(attrs.LANGUAGE_SERVICES),
    ceremonialAccommodations: parseBool(attrs.CEREMONIAL_ACCOMMODATIONS),

    waterQualityMonitoring: parseBool(attrs.WATER_MONITORING),
    environmentalHealthSpecialists: parseInt(attrs.ENV_HEALTH_SPECIALISTS) || 0,
    waterSystemCompliance: parseFloat(attrs.WATER_COMPLIANCE) || 85,
    wasteManagementPrograms: parseBool(attrs.WASTE_MANAGEMENT),

    lastUpdated: new Date().toISOString(),
  };
}

function parseBool(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return ['yes', 'true', '1', 'y'].includes(val.toLowerCase());
  return false;
}

function determineIHSArea(state: string): string {
  const stateAreaMap: Record<string, string> = {
    AK: 'Alaska', NM: 'Albuquerque', CO: 'Albuquerque', TX: 'Albuquerque',
    MN: 'Bemidji', MI: 'Bemidji', WI: 'Bemidji', IA: 'Bemidji',
    MT: 'Billings', WY: 'Billings',
    CA: 'California',
    SD: 'Great Plains', ND: 'Great Plains', NE: 'Great Plains',
    ME: 'Nashville', NY: 'Nashville', NC: 'Nashville', FL: 'Nashville',
    CT: 'Nashville', RI: 'Nashville', MS: 'Nashville', LA: 'Nashville',
    AL: 'Nashville', SC: 'Nashville', TN: 'Nashville', VA: 'Nashville',
    AZ: 'Phoenix', NV: 'Phoenix', UT: 'Phoenix',
    OK: 'Oklahoma City', KS: 'Oklahoma City',
    OR: 'Portland', WA: 'Portland', ID: 'Portland',
  };
  return stateAreaMap[state.toUpperCase()] || 'Unknown';
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cacheInfo = getIHSCacheInfo();
  if (cacheInfo.isBuilding) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'IHS build already in progress',
      cache: cacheInfo,
    });
  }

  const startTime = Date.now();

  try {
    // ── Fetch IHS facilities from HIFLD ─────────────────────────────
    console.log('[IHS Cron] Fetching IHS facility data from HIFLD...');
    let rawFeatures = await fetchHIFLDFacilities();

    if (rawFeatures.length === 0) {
      console.warn('[IHS Cron] HIFLD returned no data, attempting data.gov fallback...');
      try {
        const res = await fetch(IHS_DATAGOV_API, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const pkg = await res.json();
          const resources = pkg?.result?.resources || [];
          // Try to find a GeoJSON or CSV resource
          for (const resource of resources) {
            if (resource.format === 'GeoJSON' || resource.format === 'JSON') {
              const dataRes = await fetch(resource.url, {
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                headers: { Accept: 'application/json' },
              });
              if (dataRes.ok) {
                const geoData = await dataRes.json();
                rawFeatures = geoData?.features || [];
                console.log(`[IHS Cron] data.gov fallback: ${rawFeatures.length} features`);
                break;
              }
            }
          }
        }
      } catch (e: any) {
        console.warn(`[IHS Cron] data.gov fallback failed: ${e.message}`);
      }
    }

    // ── Map to service units ─────────────────────────────────────────
    const serviceUnits = rawFeatures.map(mapToServiceUnit);
    console.log(`[IHS Cron] Mapped ${serviceUnits.length} IHS service units`);

    // ── Empty-data guard ─────────────────────────────────────────────
    if (serviceUnits.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[IHS Cron] No IHS facilities returned in ${elapsed}s — skipping cache save`);
      recordCronRun('rebuild-ihs', 'success', Date.now() - startTime);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getIHSCacheInfo(),
      });
    }

    // ── Save to cache — other arrays empty for now ───────────────────
    await setIHSCache(
      serviceUnits,   // serviceUnits
      [],             // tribalPrograms — populated as APIs become available
      [],             // urbanPrograms
      [],             // healthOutcomes
      [],             // contractServices
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[IHS Cron] Complete in ${elapsed}s — ${serviceUnits.length} IHS facilities`);

    recordCronRun('rebuild-ihs', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      serviceUnits: serviceUnits.length,
      tribalPrograms: 0,
      urbanPrograms: 0,
      healthOutcomes: 0,
      contractServices: 0,
      cache: getIHSCacheInfo(),
    });

  } catch (err: any) {
    console.error('[IHS Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-ihs' } });

    notifySlackCronFailure({ cronName: 'rebuild-ihs', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-ihs', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'IHS build failed' },
      { status: 500 },
    );
  }
}
