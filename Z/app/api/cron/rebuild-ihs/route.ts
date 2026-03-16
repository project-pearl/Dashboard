// app/api/cron/rebuild-ihs/route.ts
// Cron — fetches IHS facility data from HIFLD ArcGIS FeatureServer.
// Schedule: weekly (Sunday 2:00 AM UTC) via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { setIHSCache, getIHSCacheInfo } from '@/lib/ihsCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

const HIFLD_IHS_URL = 'https://services1.arcgis.com/Hp6G80Pky0om6HgA/arcgis/rest/services/IHS_Facilities/FeatureServer/0/query';
const FETCH_TIMEOUT_MS = 60_000;

const STATE_TO_AREA: Record<string, string> = {
  AK:'Alaska',AZ:'Phoenix',NM:'Albuquerque',CO:'Albuquerque',MN:'Bemidji',WI:'Bemidji',MI:'Bemidji',
  OK:'Oklahoma City',KS:'Oklahoma City',TX:'Oklahoma City',MT:'Billings',WY:'Billings',
  ND:'Great Plains',SD:'Great Plains',NE:'Great Plains',OR:'Portland',WA:'Portland',ID:'Portland',
  CA:'California',NV:'Phoenix',UT:'Phoenix',NC:'Nashville',TN:'Nashville',AL:'Nashville',MS:'Nashville',
};

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const info = getIHSCacheInfo();
  if (info.isBuilding) return NextResponse.json({ status: 'skipped', reason: 'build in progress', cache: info });

  const startTime = Date.now();
  try {
    const params = new URLSearchParams({ where: '1=1', outFields: '*', f: 'json', resultRecordCount: '5000' });
    console.log('[IHS Cron] Fetching from HIFLD ArcGIS...');
    const res = await fetch(`${HIFLD_IHS_URL}?${params}`, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HIFLD returned HTTP ${res.status}`);

    const data = await res.json();
    const features = data?.features || [];
    console.log(`[IHS Cron] Fetched ${features.length} facilities`);
    if (features.length === 0) { recordCronRun('rebuild-ihs', 'success', Date.now() - startTime); return NextResponse.json({ status: 'empty' }); }

    const serviceUnits = features.map((f: any) => {
      const a = f.attributes || {}; const g = f.geometry || {}; const st = a.STATE || a.ST || '';
      return {
        serviceUnitId: a.OBJECTID?.toString() || `ihs_${Math.random().toString(36).slice(2)}`,
        serviceUnitName: a.NAME || a.FACILITY_NAME || 'Unknown IHS Facility',
        area: STATE_TO_AREA[st] || 'Nashville', address: a.ADDRESS || '', city: a.CITY || '',
        state: st, zipCode: a.ZIP || '', county: a.COUNTY || '', tribalLands: [],
        coordinates: { lat: g.y || parseFloat(a.LATITUDE || '0'), lng: g.x || parseFloat(a.LONGITUDE || '0') },
        servicePopulation: parseInt(a.POPULATION || '0') || 0, registeredUsers: 0, activePatients: 0, annualVisits: 0,
        hospitalFacilities: a.TYPE === 'Hospital' ? 1 : 0, healthCenterFacilities: a.TYPE === 'Health Center' ? 1 : 0,
        healthStationFacilities: a.TYPE === 'Health Station' ? 1 : 0, alaskaVillageClinics: st === 'AK' ? 1 : 0,
        physicians: 0, nurses: 0, dentists: 0, mentalHealthProviders: 0, communityHealthRepresentatives: 0, traditionalHealers: 0,
        diabetesProgram: true, elderCareProgram: false, maternalChildHealthProgram: false, mentalHealthProgram: false,
        substanceAbuseProgram: false, environmentalHealthProgram: false,
        nativeVeteransServed: 0, militaryServiceMembersServed: 0, veteranHealthcarePartnership: false, militaryFamiliesInTribalCommunity: 0,
        traditionalHealingPrograms: false, culturalCompetencyTraining: false, nativeLanguageServices: false, ceremonialAccommodations: false,
        waterQualityMonitoring: false, environmentalHealthSpecialists: 0, waterSystemCompliance: 90, wasteManagementPrograms: false,
        lastUpdated: new Date().toISOString(),
      };
    }).filter((u: any) => u.coordinates.lat !== 0 && u.coordinates.lng !== 0);

    await setIHSCache(serviceUnits, [], [], [], []);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[IHS Cron] Complete in ${elapsed}s — ${serviceUnits.length} service units`);
    recordCronRun('rebuild-ihs', 'success', Date.now() - startTime);
    return NextResponse.json({ status: 'complete', duration: `${elapsed}s`, serviceUnits: serviceUnits.length });
  } catch (err: any) {
    console.error('[IHS Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-ihs' } });
    notifySlackCronFailure({ cronName: 'rebuild-ihs', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-ihs', 'error', Date.now() - startTime, err.message);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
