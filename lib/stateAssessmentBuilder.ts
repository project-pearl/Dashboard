/**
 * State Assessment Builder — Assembles StateAssessmentData from all caches
 * for a single state. Used by the state-assessment API endpoint.
 */

import type { StateAssessmentData } from './stateFindings';
import { getAttainsCache } from './attainsCache';
import { getSdwisAllData } from './sdwisCache';
import { getIcisAllData } from './icisCache';
import { getEchoAllData } from './echoCache';
import { getNwisGwAllSites } from './nwisGwCache';
import { getPfasAllResults } from './pfasCache';
import { getEJScore } from './ejVulnerability';
import { getStateReport } from './stateReportCache';

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
  LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};

export function buildStateAssessmentData(stateCode: string): StateAssessmentData {
  const sc = stateCode.toUpperCase();
  const stateName = STATE_NAMES[sc] || sc;

  // ── ATTAINS ──
  const attains = getAttainsCache();
  const stateAttains = attains.states[sc];

  const total = stateAttains?.total ?? 0;
  const high = stateAttains?.high ?? 0;
  const medium = stateAttains?.medium ?? 0;
  const low = stateAttains?.low ?? 0;
  const none = stateAttains?.none ?? 0;
  const tmdlCompleted = stateAttains?.tmdlCompleted ?? 0;
  const tmdlNeeded = stateAttains?.tmdlNeeded ?? 0;
  const tmdlAlternative = stateAttains?.tmdlAlternative ?? 0;
  const waterbodies = stateAttains?.waterbodies ?? [];

  // Derive category breakdowns from waterbodies
  let cat1 = 0, cat2 = 0, cat3 = 0, cat4a = 0, cat4b = 0, cat4c = 0, cat5 = 0;
  for (const wb of waterbodies) {
    switch (wb.category) {
      case '1': cat1++; break;
      case '2': cat2++; break;
      case '3': cat3++; break;
      case '4A': case '4a': cat4a++; break;
      case '4B': case '4b': cat4b++; break;
      case '4C': case '4c': cat4c++; break;
      case '5': cat5++; break;
    }
  }
  // If we have no waterbody-level categories, approximate from alert levels
  if (cat1 + cat2 + cat3 + cat4a + cat4b + cat4c + cat5 === 0) {
    cat5 = high;
    cat4a = tmdlCompleted;
    cat4b = tmdlAlternative;
    cat3 = low;
    cat1 = none;
  }

  // Top causes from waterbodies
  const causeFreq: Record<string, number> = {};
  for (const wb of waterbodies) {
    for (const c of wb.causes) {
      causeFreq[c] = (causeFreq[c] || 0) + 1;
    }
  }
  const totalImpaired = cat4a + cat4b + cat4c + cat5;
  const sortedCauses = Object.entries(causeFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cause, count]) => ({
      cause,
      count,
      percentage: totalImpaired > 0 ? (count / totalImpaired) * 100 : 0,
    }));

  // ── SDWIS ──
  const sdwis = getSdwisAllData();
  const sdwisSystems = sdwis.systems.filter(s => s.state === sc);
  const sdwisViolations = sdwis.violations.filter(v => v.lat !== 0); // filter by state via systems
  // Filter violations by matching pwsid to state systems
  const statePwsids = new Set(sdwisSystems.map(s => s.pwsid));
  const sdwisStateViolations = sdwis.violations.filter(v => statePwsids.has(v.pwsid));

  // ── ICIS ──
  const icis = getIcisAllData();
  const icisPermits = icis.permits.filter(p => p.state === sc);
  const icisPermitIds = new Set(icisPermits.map(p => p.permit));
  const icisViolatingPermits = new Set(
    icis.violations.filter(v => icisPermitIds.has(v.permit)).map(v => v.permit)
  );

  // ── ECHO ──
  const echo = getEchoAllData();
  const echoFacilities = echo.facilities.filter(f => f.state === sc);
  const echoViolating = echoFacilities.filter(f => f.qtrsInViolation > 0);

  // Combine ICIS + ECHO for NPDES counts (prefer ECHO if available, fall back to ICIS)
  const npdesPermits = echoFacilities.length > 0 ? echoFacilities.length : icisPermits.length;
  const npdesViolating = echoViolating.length > 0 ? echoViolating.length : icisViolatingPermits.size;

  // ── NWIS-GW ──
  const gwSites = getNwisGwAllSites().filter(s => s.state === sc);

  // ── PFAS ──
  const pfasResults = getPfasAllResults().filter(r => r.state === sc);
  const pfasDetected = pfasResults.filter(r => r.detected);

  // ── EJ ──
  const ejScore = getEJScore(sc);

  // ── State Report ──
  const report = getStateReport(sc);
  const stationsTotal = report?.wqpStationCount ?? 0;
  const staleStations = report?.freshnessTiers
    ?.filter(t => t.freshness === 'stale' || t.freshness === 'archival')
    .reduce((sum, t) => sum + t.count, 0) ?? 0;
  const recentStations = stationsTotal - staleStations;

  // Assessed = total waterbodies we have data for; unassessed approximated
  const assessedUnits = total;
  // Use a rough approximation for unassessed (category 3 captures "insufficient data")
  const unassessedUnits = cat3;

  // Impairment rate for current cycle
  const impairmentRateCurrent = assessedUnits > 0
    ? ((totalImpaired / assessedUnits) * 100) : 0;

  return {
    stateCode: sc,
    stateName,
    reportingCycle: '2022',
    lastUpdated: attains.cacheStatus.lastBuilt || new Date().toISOString(),

    totalAssessmentUnits: total,
    assessedUnits,
    unassessedUnits,

    category1: cat1,
    category2: cat2,
    category3: cat3,
    category4a: cat4a,
    category4b: cat4b,
    category4c: cat4c,
    category5: cat5,

    totalUseAssessments: 0,
    usesFullySupporting: 0,
    usesNotSupporting: 0,
    usesInsufficientInfo: 0,

    topCauses: sortedCauses,
    topSources: [],

    tmdlsCompleted: tmdlCompleted,
    tmdlsNeeded: tmdlNeeded,

    surfaceWaterUnits: total,
    drinkingWaterSystems: sdwisSystems.length,
    drinkingWaterViolations: sdwisStateViolations.length,
    npdesPermits,
    npdesViolatingFacilities: npdesViolating,
    ms4Permits: 0,
    groundwaterSites: gwSites.length,

    monitoringStations: stationsTotal,
    stationsWithRecentData: recentStations,
    stationsStale: staleStations,

    avgEjIndex: ejScore,
    highEjUnits: 0,
    populationInHighEj: 0,

    impairmentTrend: 'insufficient_data',
    impairmentRateCurrentCycle: impairmentRateCurrent,
    impairmentRatePriorCycle: 0,
    priorCycleYear: '',

    estimatedGrantEligibility: 0,
    activeGrantPrograms: 0,

    pfasDetections: pfasDetected.length,
    pfasMonitoredSites: pfasResults.length,
  };
}
