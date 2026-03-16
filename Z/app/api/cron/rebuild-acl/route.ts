// app/api/cron/rebuild-acl/route.ts
// Cron — fetches ACL aging services data from the Eldercare Locator API.
// Schedule: weekly (Sunday 3:00 AM UTC) via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { setACLCache, getACLCacheInfo } from '@/lib/aclCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

const ELDERCARE_API = 'https://eldercare.acl.gov/Public/api';
const FETCH_TIMEOUT_MS = 30_000;
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const info = getACLCacheInfo();
  if (info.isBuilding) return NextResponse.json({ status: 'skipped', reason: 'build in progress', cache: info });

  const startTime = Date.now();
  try {
    const allAgencies: any[] = [];
    for (let i = 0; i < STATES.length; i += 5) {
      const batch = STATES.slice(i, i + 5);
      const results = await Promise.allSettled(batch.map(async (state) => {
        try {
          const res = await fetch(`${ELDERCARE_API}/Services?State=${state}&ServiceType=AreaAgencyOnAging&PageSize=100`, {
            headers: { 'User-Agent': 'PEARL-Platform/1.0', Accept: 'application/json' },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data?.results) ? data.results : Array.isArray(data?.services) ? data.services : Array.isArray(data) ? data : [];
        } catch { return []; }
      }));
      for (const r of results) if (r.status === 'fulfilled' && Array.isArray(r.value)) allAgencies.push(...r.value);
    }
    console.log(`[ACL Cron] Fetched ${allAgencies.length} raw agencies`);

    if (allAgencies.length === 0) {
      console.log('[ACL Cron] Trying AGID fallback...');
      try {
        const res = await fetch('https://agid.acl.gov/DataFiles/Programs/SPR/National_SPR_Data.csv', {
          headers: { 'User-Agent': 'PEARL-Platform/1.0' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (res.ok) {
          const text = await res.text(); const lines = text.split('\n');
          if (lines.length > 1) {
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            for (let j = 1; j < Math.min(lines.length, 1000); j++) {
              const values = lines[j].split(',').map(v => v.trim().replace(/"/g, ''));
              if (values.length >= headers.length) {
                const row: Record<string, string> = {};
                for (let k = 0; k < headers.length; k++) row[headers[k]] = values[k] || '';
                allAgencies.push(row);
              }
            }
          }
        }
      } catch (e: any) { console.warn(`[ACL Cron] AGID fallback failed: ${e.message}`); }
    }

    if (allAgencies.length === 0) { recordCronRun('rebuild-acl', 'success', Date.now() - startTime); return NextResponse.json({ status: 'empty' }); }

    const areaAgencies = allAgencies.map((raw: any) => ({
      agencyId: raw.id?.toString() || raw.agency_id || `acl_${Math.random().toString(36).slice(2)}`,
      agencyName: raw.name || raw.agency_name || raw.OrganizationName || 'Unknown Agency',
      planningServiceArea: raw.service_area || raw.psa || '',
      address: raw.address || raw.Address1 || '', city: raw.city || raw.City || '',
      state: raw.state || raw.State || '', zipCode: raw.zip || raw.ZipCode || '',
      county: raw.county || raw.County || '', serviceAreaCounties: [],
      coordinates: { lat: parseFloat(raw.latitude || raw.Latitude || '0'), lng: parseFloat(raw.longitude || raw.Longitude || '0') },
      totalPopulation60Plus: parseInt(raw.population_60plus || '0') || 0,
      populationTargetGroups: { minorityOlderAdults: 0, lowIncomeOlderAdults: 0, ruralOlderAdults: 0, limitedEnglishProficiency: 0 },
      veteransServed: 0, militarySpousesServed: 0, goldStarFamiliesServed: 0, veteranCaregiversSupported: 0,
      congregateMeals: { sitesOperated: 0, mealsServedAnnually: 0, participantsServed: 0 },
      homeDeliveredMeals: { mealsDeliveredAnnually: 0, recipientsServed: 0, waitingList: 0 },
      transportation: { tripsProvidedAnnually: 0, individualsServed: 0, medicalTrips: 0, shoppingTrips: 0 },
      informationAssistance: { contactsAnnually: 0, benefitsCounselingCases: 0, healthInsuranceCounseling: 0 },
      caregiverSupport: { familyCaregivers: 0, grandfamilyCaregivers: 0, supportGroups: 0, respiteCareHours: 0 },
      healthPromotion: { evidenceBasedPrograms: [], participantsServed: 0, fallsPrevention: 0, chronicDiseaseManagement: 0 },
      veteranDirectedCare: false, militaryFamilyLifeLine: false, ptsdCaregiverSupport: false, tbiSupportServices: false,
      ombudsmanProgram: { complaintsCases: 0, facilitiesVisited: 0, advocacyContacts: 0 },
      elderAbusePrevention: { casesInvestigated: 0, educationPrograms: 0, guardiansupport: 0 },
      homeSafetyAssessments: 0, weatherizationReferrals: 0, waterQualityEducation: false,
      oaaFunding: 0, stateFunding: 0, localFunding: 0, totalBudget: 0,
      fiscalYear: new Date().getFullYear(), lastUpdated: new Date().toISOString(),
    })).filter((a: any) => a.coordinates.lat !== 0 && a.coordinates.lng !== 0);

    await setACLCache(areaAgencies, [], [], [], [], []);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[ACL Cron] Complete in ${elapsed}s — ${areaAgencies.length} area agencies`);
    recordCronRun('rebuild-acl', 'success', Date.now() - startTime);
    return NextResponse.json({ status: 'complete', duration: `${elapsed}s`, recordCount: areaAgencies.length });
  } catch (err: any) {
    console.error('[ACL Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-acl' } });
    notifySlackCronFailure({ cronName: 'rebuild-acl', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-acl', 'error', Date.now() - startTime, err.message);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  }
}
