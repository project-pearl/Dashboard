// app/api/data-summaries/route.ts
// Returns pre-computed summary metrics from 13 cache modules that feed
// the "Data Pending" placeholder cards in management centers.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';

import { getUsgsOgcAllStations, getUsgsOgcCacheStatus, ensureWarmed as warmUsgsOgc } from '@/lib/usgsOgcCache';
import { getNgwmnAllSites, getNgwmnCacheStatus, ensureWarmed as warmNgwmn } from '@/lib/ngwmnCache';
import { getFloodImpactCacheStatus, getHighRiskZones, ensureWarmed as warmFloodImpact } from '@/lib/floodImpactCache';
import { getEpaPfasAnalyticsCacheStatus, getEpaPfasExceedances, ensureWarmed as warmEpaPfas } from '@/lib/epaPfasAnalyticsCache';
import { getNwsForecastCacheStatus, ensureWarmed as warmNwsForecast } from '@/lib/nwsForecastCache';
import { getWaterAvailCacheStatus, ensureWarmed as warmWaterAvail } from '@/lib/usgsWaterAvailCache';
import { getCyberRiskCacheStatus, getCriticalNearMilitary, ensureWarmed as warmCyberRisk } from '@/lib/cyberRiskCache';
import { getGemsStatAll, getGemsStatCacheStatus, ensureWarmed as warmGemStat } from '@/lib/gemstatCache';
import { getWqxModernCacheStatus, ensureWarmed as warmWqxModern } from '@/lib/wqxModernCache';
import { getStnFloodCacheStatus, ensureWarmed as warmStnFlood } from '@/lib/stnFloodCache';
import { getDmrViolationsCacheStatus, ensureWarmed as warmDmrViolations } from '@/lib/echoDmrViolationsCache';
import { getHabForecastCacheStatus, ensureWarmed as warmHabForecast } from '@/lib/habForecastCache';
import { getCdcPlacesCacheStatus, ensureWarmed as warmCdcPlaces } from '@/lib/cdcPlacesCache';
import { getSwdiCacheStatus, ensureWarmed as warmSwdi } from '@/lib/swdiCache';
import { getNexradQpeCacheStatus, ensureWarmed as warmNexradQpe } from '@/lib/nexradQpeCache';
import { getCongressCacheStatus, ensureWarmed as warmCongress } from '@/lib/congressCache';

export async function GET(_req: NextRequest) {
  // Warm all caches in parallel
  await Promise.allSettled([
    warmUsgsOgc(), warmNgwmn(), warmFloodImpact(), warmEpaPfas(),
    warmNwsForecast(), warmWaterAvail(), warmCyberRisk(), warmGemStat(),
    warmWqxModern(), warmStnFlood(), warmDmrViolations(), warmHabForecast(),
    warmCdcPlaces(), warmSwdi(), warmNexradQpe(), warmCongress(),
  ]);

  // ── USGS OGC ────────────────────────────────────────────────────────────
  const ogcStatus = getUsgsOgcCacheStatus();
  let ogcSiteTypes = 0, ogcAgencies = 0;
  if (ogcStatus.loaded) {
    const stations = getUsgsOgcAllStations();
    ogcSiteTypes = new Set(stations.map(s => s.siteType)).size;
    ogcAgencies = new Set(stations.map(s => s.agencyCode)).size;
  }

  // ── NGWMN ───────────────────────────────────────────────────────────────
  const ngwmnStatus = getNgwmnCacheStatus();
  let ngwmnQualityResults = 0, ngwmnStates = 0;
  if (ngwmnStatus.loaded) {
    const sites = getNgwmnAllSites();
    ngwmnQualityResults = sites.reduce((sum, s) => sum + (s.waterQuality?.length || 0), 0);
    ngwmnStates = new Set(sites.map(s => s.state)).size;
  }

  // ── Flood Impact ────────────────────────────────────────────────────────
  const floodStatus = getFloodImpactCacheStatus();
  let floodInfraAtRisk = 0;
  if (floodStatus.loaded) {
    const zones = getHighRiskZones();
    floodInfraAtRisk = zones.reduce((sum, z) => sum + (z.nearbyInfrastructure?.length || 0), 0);
  }

  // ── EPA PFAS Analytics ──────────────────────────────────────────────────
  const pfasStatus = getEpaPfasAnalyticsCacheStatus();
  let pfasNearMilitary = 0;
  if (pfasStatus.loaded) {
    pfasNearMilitary = getEpaPfasExceedances().filter(f => f.nearMilitary).length;
  }

  // ── NWS Forecast ────────────────────────────────────────────────────────
  const nwsStatus = getNwsForecastCacheStatus();

  // ── Water Availability ──────────────────────────────────────────────────
  const waterAvailStatus = getWaterAvailCacheStatus();

  // ── Cyber Risk ──────────────────────────────────────────────────────────
  const cyberStatus = getCyberRiskCacheStatus();
  let cyberNearMilitary = 0;
  if (cyberStatus.loaded) {
    cyberNearMilitary = getCriticalNearMilitary().length;
  }

  // ── GEMStat ─────────────────────────────────────────────────────────────
  const gemstatStatus = getGemsStatCacheStatus();
  let gemstatLatestYear = 0;
  if (gemstatStatus.loaded) {
    const countries = getGemsStatAll();
    gemstatLatestYear = Math.max(...Object.values(countries).map(c => c.latestYear || 0));
  }

  // ── WQX Modern ──────────────────────────────────────────────────────────
  const wqxStatus = getWqxModernCacheStatus();

  // ── STN Flood Events ────────────────────────────────────────────────────
  const stnStatus = getStnFloodCacheStatus();

  // ── DMR Violations ──────────────────────────────────────────────────────
  const dmrStatus = getDmrViolationsCacheStatus();

  // ── HAB Forecast ────────────────────────────────────────────────────────
  const habStatus = getHabForecastCacheStatus();

  // ── CDC PLACES ──────────────────────────────────────────────────────────
  const cdcStatus = getCdcPlacesCacheStatus();

  // ── SWDI Severe Weather ───────────────────────────────────────────────
  const swdiStatus = getSwdiCacheStatus();

  // ── NEXRAD QPE ────────────────────────────────────────────────────────
  const nexradStatus = getNexradQpeCacheStatus();

  // ── Congress ──────────────────────────────────────────────────────────
  const congressStatus = getCongressCacheStatus();

  return NextResponse.json({
    usgsOgc: {
      loaded: ogcStatus.loaded,
      totalStations: ogcStatus.loaded ? ogcStatus.stationCount : 0,
      siteTypes: ogcSiteTypes,
      agencies: ogcAgencies,
      states: ogcStatus.loaded ? ogcStatus.statesCovered : 0,
    },
    ngwmn: {
      loaded: ngwmnStatus.loaded,
      totalSites: ngwmnStatus.loaded ? ngwmnStatus.siteCount : 0,
      providers: ngwmnStatus.loaded ? ngwmnStatus.providerCount : 0,
      qualityResults: ngwmnQualityResults,
      states: ngwmnStates,
    },
    floodImpact: {
      loaded: floodStatus.loaded,
      zones: floodStatus.loaded ? floodStatus.zoneCount : 0,
      highRisk: floodStatus.loaded ? floodStatus.highRiskCount : 0,
      infraAtRisk: floodInfraAtRisk,
      states: floodStatus.loaded ? floodStatus.gridCells : 0,
    },
    epaPfas: {
      loaded: pfasStatus.loaded,
      facilities: pfasStatus.loaded ? pfasStatus.facilityCount : 0,
      exceedances: pfasStatus.loaded ? pfasStatus.totalExceedances : 0,
      nearMilitary: pfasNearMilitary,
      states: pfasStatus.loaded ? pfasStatus.statesCovered : 0,
    },
    nwsForecast: {
      loaded: nwsStatus.loaded,
      locations: nwsStatus.loaded ? nwsStatus.locationCount : 0,
      highRisk: nwsStatus.loaded ? nwsStatus.highRiskCount : 0,
      states: nwsStatus.loaded ? nwsStatus.statesCovered : 0,
    },
    waterAvail: {
      loaded: waterAvailStatus.loaded,
      huc8Indicators: waterAvailStatus.loaded ? waterAvailStatus.indicatorCount : 0,
      droughtHucs: waterAvailStatus.loaded ? waterAvailStatus.droughtHucCount : 0,
      declining: waterAvailStatus.loaded ? waterAvailStatus.decliningCount : 0,
      states: waterAvailStatus.loaded ? waterAvailStatus.stateCount : 0,
    },
    cyberRisk: {
      loaded: cyberStatus.loaded,
      assessed: cyberStatus.loaded ? cyberStatus.assessmentCount : 0,
      highCritical: cyberStatus.loaded ? cyberStatus.criticalCount : 0,
      nearMilitary: cyberNearMilitary,
      states: cyberStatus.loaded ? cyberStatus.statesCovered : 0,
    },
    gemstat: {
      loaded: gemstatStatus.loaded,
      countries: gemstatStatus.loaded ? gemstatStatus.countryCount : 0,
      stations: gemstatStatus.loaded ? gemstatStatus.totalStations : 0,
      latestYear: gemstatLatestYear || null,
    },
    wqxModern: {
      loaded: wqxStatus.loaded,
      records: wqxStatus.loaded ? wqxStatus.recordCount : 0,
      states: wqxStatus.loaded ? wqxStatus.stateCount : 0,
    },
    stnFlood: {
      loaded: stnStatus.loaded,
      events: stnStatus.loaded ? stnStatus.eventCount : 0,
      states: stnStatus.loaded ? stnStatus.stateCount : 0,
    },
    dmrViolations: {
      loaded: dmrStatus.loaded,
      violations: dmrStatus.loaded ? dmrStatus.violationCount : 0,
      facilities: dmrStatus.loaded ? dmrStatus.facilityCount : 0,
      states: dmrStatus.loaded ? dmrStatus.stateCount : 0,
    },
    habForecast: {
      loaded: habStatus.loaded,
      forecasts: habStatus.loaded ? habStatus.forecastCount : 0,
      highRisk: habStatus.loaded ? habStatus.highRiskCount : 0,
      waterbodies: habStatus.loaded ? habStatus.waterbodyCount : 0,
    },
    cdcPlaces: {
      loaded: cdcStatus.loaded,
      tracts: cdcStatus.loaded ? (cdcStatus as any).tractCount ?? 0 : 0,
      states: cdcStatus.loaded ? (cdcStatus as any).stateCount ?? 0 : 0,
    },
    swdi: {
      loaded: swdiStatus.loaded,
      events: swdiStatus.loaded ? (swdiStatus as any).eventCount ?? 0 : 0,
      severe: swdiStatus.loaded ? (swdiStatus as any).severeCount ?? 0 : 0,
      states: swdiStatus.loaded ? (swdiStatus as any).stateCount ?? 0 : 0,
    },
    nexradQpe: {
      loaded: nexradStatus.loaded,
      cells: nexradStatus.loaded ? (nexradStatus as any).cellCount ?? 0 : 0,
      maxPrecipMm: nexradStatus.loaded ? (nexradStatus as any).maxPrecipMm ?? 0 : 0,
      flashFloodHigh: nexradStatus.loaded ? (nexradStatus as any).flashFloodHighCount ?? 0 : 0,
    },
    congress: {
      loaded: congressStatus.loaded,
      bills: congressStatus.loaded ? (congressStatus as any).billCount ?? 0 : 0,
      active: congressStatus.loaded ? (congressStatus as any).activeCount ?? 0 : 0,
      enacted: congressStatus.loaded ? (congressStatus as any).enactedCount ?? 0 : 0,
    },
  });
}
