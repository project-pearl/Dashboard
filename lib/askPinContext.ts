/**
 * Ask PIN Context Builder — Question-aware domain detection + direct cache access
 *
 * Analyzes user questions via keyword matching to detect relevant domains,
 * then pulls data directly from server-side caches instead of fetching HTTP endpoints.
 * This gives Ask PIN access to all 80+ cache modules with facility-level granularity.
 */

// ── Cache imports ──────────────────────────────────────────────────────────────
import { ensureWarmed as warmPfas, getPfasAllResults, getPfasCacheStatus } from './pfasCache';
import { ensureWarmed as warmDodPfas, getDoDPFASForState, getDoDPFASAllSummaries } from './dodPfasCache';
import { ensureWarmed as warmGw, getNwisGwAllSites, getNwisGwCacheStatus } from './nwisGwCache';
import { ensureWarmed as warmSdwis, getSdwisForState, getSdwisCacheStatus, getSdwisAllData } from './sdwisCache';
import { ensureWarmed as warmIcis, getIcisAllData, getIcisCacheStatus } from './icisCache';
import { ensureWarmed as warmEcho, getEchoAllData, getEchoCacheStatus } from './echoCache';
import { ensureWarmed as warmHospital, getHospitalsByState, getHospitalCacheStatus, getHospitalStatistics } from './hospitalCache';
import { ensureWarmed as warmOutbreaks, getOutbreaksByState, getWaterborneOutbreakCacheStatus, getOutbreakStatistics } from './waterborneIllnessCache';
import { ensureWarmed as warmCdcWonder, getCdcWonderRecords, getTopCauses, getCDCWonderCacheStatus } from './cdcWonderCache';
import { ensureWarmed as warmEnvHealth, getEnvironmentalHealthByState, getEnvironmentalHealthCacheStatus, getEnvironmentalHealthStatistics } from './environmentalHealthCache';
import { ensureWarmed as warmClimate, getClimateNormals, getClimateNormalsCacheStatus } from './climateNormalsCache';
import { ensureWarmed as warmUsdm, getUsdmByState, getUsdmAll } from './usdmCache';
import { ensureWarmed as warmFema, getFemaDeclarations, getFemaRiskIndex } from './femaCache';
import { ensureWarmed as warmIv, getUsgsIvByState, getUsgsIvCacheStatus } from './nwisIvCache';
import { ensureWarmed as warmAir, getAirQualityForState, getAirQualityAllStates } from './airQualityCache';
import { ensureWarmed as warmSuperfund, getSuperfundSites, getSuperfundSitesAll } from './superfundCache';
import { ensureWarmed as warmSems, getSemsSites } from './semsCache';
import { ensureWarmed as warmUsace, getUsaceAllLocations } from './usaceCache';
import { ensureWarmed as warmUsbr, getUsbrAll } from './usbrCache';
import { ensureWarmed as warmAttains, getAttainsStateData } from './attainsCache';
import { ensureWarmed as warmStateReport, getStateReport, getAllStateReports } from './stateReportCache';
import { ensureWarmed as warmEffluent, getEchoEffluent } from './echoEffluentCache';
import { ensureWarmed as warmForecast, getNwsForecast, getHighRiskForecasts } from './nwsForecastCache';
import { ensureWarmed as warmNws, getNwsAlerts, getSevereWeatherAlerts } from './nwsAlertCache';
import { ensureWarmed as warmNwps, getNwpsAllGauges } from './nwpsCache';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DomainMatch {
  domain: string;
  score: number;
  retriever: (state: string | null) => Promise<string>;
}

interface AskPinContextParams {
  question: string;
  role: string;
  state: string | null;
  isMilitary: boolean;
}

interface AskPinContextResult {
  context: string;
  sources: string[];
}

// ── Domain definitions ─────────────────────────────────────────────────────────

interface DomainDef {
  keywords: string[];
  roleBoosts: string[];       // roles that get +2 for this domain
  retriever: (state: string | null) => Promise<string>;
}

const DOMAINS: Record<string, DomainDef> = {
  pfas: {
    keywords: ['pfas', 'forever chemical', 'contamination', 'mcl', 'ucmr', 'per- and polyfluoroalkyl'],
    roleBoosts: ['Federal', 'State', 'Utility'],
    retriever: retrievePfasContext,
  },
  groundwater: {
    keywords: ['groundwater', 'aquifer', 'well', 'water table', 'gw level', 'ground water'],
    roleBoosts: ['Federal', 'State'],
    retriever: retrieveGroundwaterContext,
  },
  compliance: {
    keywords: ['violation', 'permit', 'enforcement', 'npdes', 'sdwis', 'compliance', 'inspection', 'penalty', 'fine'],
    roleBoosts: ['Federal', 'State', 'MS4', 'Utility'],
    retriever: retrieveComplianceContext,
  },
  health: {
    keywords: ['health', 'hospital', 'disease', 'illness', 'mortality', 'cancer', 'outbreak', 'death', 'waterborne'],
    roleBoosts: ['Federal', 'K-12'],
    retriever: retrieveHealthContext,
  },
  military: {
    keywords: ['military', 'base', 'installation', 'dod', 'army', 'navy', 'air force', 'marine', 'defense'],
    roleBoosts: ['Federal'],
    retriever: retrieveMilitaryContext,
  },
  climate: {
    keywords: ['climate', 'weather', 'drought', 'flood', 'temperature', 'precipitation', 'forecast', 'storm'],
    roleBoosts: ['Federal', 'State'],
    retriever: retrieveClimateContext,
  },
  realtime: {
    keywords: ['current', 'realtime', 'real-time', 'right now', 'today', 'stream', 'flow', 'gauge', 'streamflow', 'gage'],
    roleBoosts: ['State', 'MS4', 'Utility'],
    retriever: retrieveRealtimeContext,
  },
  superfund: {
    keywords: ['superfund', 'cercla', 'cleanup', 'brownfield', 'hazardous', 'toxic site'],
    roleBoosts: ['Federal', 'State'],
    retriever: retrieveSuperfundContext,
  },
  infrastructure: {
    keywords: ['dam', 'reservoir', 'infrastructure', 'levee', 'pipe', 'utility', 'corps of engineers', 'usace', 'reclamation'],
    roleBoosts: ['Federal', 'State', 'Utility'],
    retriever: retrieveInfrastructureContext,
  },
  ej: {
    keywords: ['environmental justice', 'ej', 'equity', 'disadvantaged', 'underserved', 'ejscreen', 'overburdened'],
    roleBoosts: ['Federal', 'NGO', 'ESG'],
    retriever: retrieveEjContext,
  },
  'water-quality': {
    keywords: ['water quality', 'impaired', 'tmdl', '303d', 'assessment', 'attains', 'impairment', 'waterbody', 'waterbodies'],
    roleBoosts: ['Federal', 'State', 'MS4'],
    retriever: retrieveWaterQualityContext,
  },
  stormwater: {
    keywords: ['stormwater', 'ms4', 'cso', 'sso', 'runoff', 'overflow', 'combined sewer', 'effluent', 'discharge'],
    roleBoosts: ['MS4', 'Utility', 'State'],
    retriever: retrieveStormwaterContext,
  },
};

// ── Domain detection ───────────────────────────────────────────────────────────

function detectDomains(question: string, role: string, isMilitary: boolean): DomainMatch[] {
  const q = question.toLowerCase();
  const matches: DomainMatch[] = [];

  for (const [name, def] of Object.entries(DOMAINS)) {
    let score = 0;

    // Keyword matching: +3 for each keyword found in question
    for (const kw of def.keywords) {
      if (q.includes(kw)) score += 3;
    }

    // Role boost: +2 if user's role is boosted for this domain
    if (def.roleBoosts.includes(role)) score += 2;

    // Military boost for military/dod domains
    if (isMilitary && name === 'military') score += 4;
    if (isMilitary && name === 'pfas') score += 2; // PFAS highly relevant to military

    if (score > 0) {
      matches.push({ domain: name, score, retriever: def.retriever });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Cap at 4 domains to stay within token budget
  return matches.slice(0, 4);
}

// ── Retriever functions ────────────────────────────────────────────────────────

async function retrievePfasContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmPfas(), warmDodPfas()]);

    const allPfas = getPfasAllResults();
    if (allPfas.length > 0) {
      const aboveMcl = allPfas.filter((r: any) => r.exceedsMcl || r.aboveMCL);
      if (state) {
        const stateResults = allPfas.filter((r: any) => r.state === state || r.stateCode === state);
        const stateAboveMcl = stateResults.filter((r: any) => r.exceedsMcl || r.aboveMCL);
        parts.push(`PFAS in ${state}: ${stateResults.length} detections, ${stateAboveMcl.length} above MCL threshold.`);
      }
      parts.push(`PFAS nationally: ${allPfas.length} total detections, ${aboveMcl.length} above MCL (${allPfas.length > 0 ? Math.round(aboveMcl.length / allPfas.length * 100) : 0}%).`);
    }

    // DoD PFAS data
    if (state) {
      const dodState = getDoDPFASForState(state);
      if (dodState.length > 0) {
        const names = dodState.slice(0, 5).map((d: any) => d.installationName || d.name).filter(Boolean);
        parts.push(`DoD PFAS in ${state}: ${dodState.length} installation(s) with assessments${names.length ? ': ' + names.join(', ') : ''}.`);
      }
    } else {
      const allSummaries = getDoDPFASAllSummaries();
      const statesWithPfas = Object.keys(allSummaries).length;
      const totalSites = Object.values(allSummaries).reduce((sum: number, s: any) => sum + (s.totalSites || s.siteCount || 0), 0);
      if (statesWithPfas > 0) {
        parts.push(`DoD PFAS: ${totalSites} military sites across ${statesWithPfas} states with PFAS assessments.`);
      }
    }

    const status = getPfasCacheStatus();
    if ('resultCount' in status && status.resultCount) parts.push(`(${status.resultCount} PFAS records in cache)`);
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveGroundwaterContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await warmGw();
    const allSites = getNwisGwAllSites();

    if (allSites.length > 0) {
      if (state) {
        const stateSites = allSites.filter((s: any) => s.state === state || s.stateCode === state || s.state_cd === state);
        parts.push(`Groundwater monitoring in ${state}: ${stateSites.length} USGS wells being tracked.`);
        if (stateSites.length > 0) {
          const withLevels = stateSites.filter((s: any) => s.latestLevel != null || s.value != null);
          parts.push(`${withLevels.length} wells with recent water level measurements.`);
        }
      }
      parts.push(`National groundwater network: ${allSites.length} USGS monitoring wells.`);
    }

    const status = getNwisGwCacheStatus();
    if ('built' in status && status.built) parts.push(`(Last updated: ${new Date(status.built).toLocaleDateString()})`);
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveComplianceContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmSdwis(), warmIcis(), warmEcho()]);

    // SDWIS (drinking water violations)
    if (state) {
      const sdwisState = getSdwisForState(state);
      if (sdwisState) {
        const systems = sdwisState.systems || [];
        const violations = sdwisState.violations || [];
        const enforcement = sdwisState.enforcement || [];
        parts.push(`SDWIS in ${state}: ${systems.length} drinking water systems, ${violations.length} violations, ${enforcement.length} enforcement actions.`);
        const healthBased = violations.filter((v: any) => v.isHealthBased || v.violationCategory === 'Health-Based');
        if (healthBased.length > 0) parts.push(`  ${healthBased.length} health-based violations.`);
      }
    } else {
      const sdwisStatus = getSdwisCacheStatus();
      if ('systemCount' in sdwisStatus && sdwisStatus.systemCount) parts.push(`SDWIS nationally: ${sdwisStatus.systemCount} drinking water systems tracked.`);
    }

    // ICIS (NPDES permits)
    const icisAll = getIcisAllData();
    if (icisAll) {
      const permits = icisAll.permits || [];
      const violations = icisAll.violations || [];
      if (state) {
        const statePermits = permits.filter((p: any) => p.state === state || p.stateCode === state);
        const stateViolations = violations.filter((v: any) => v.state === state || v.stateCode === state);
        parts.push(`NPDES in ${state}: ${statePermits.length} permits, ${stateViolations.length} violations.`);
      } else {
        parts.push(`NPDES nationally: ${permits.length} permits, ${violations.length} violations tracked.`);
      }
    }

    // ECHO (enforcement/compliance)
    const echoAll = getEchoAllData();
    if (echoAll) {
      const facilities = echoAll.facilities || [];
      if (state) {
        const stateFac = facilities.filter((f: any) => f.state === state || f.stateCode === state);
        const nonCompliant = stateFac.filter((f: any) => f.inSignificantNoncompliance || f.snc || f.qncr === 'Yes');
        parts.push(`ECHO in ${state}: ${stateFac.length} facilities, ${nonCompliant.length} in significant non-compliance.`);
      } else {
        const nonCompliant = facilities.filter((f: any) => f.inSignificantNoncompliance || f.snc || f.qncr === 'Yes');
        parts.push(`ECHO nationally: ${facilities.length} facilities tracked, ${nonCompliant.length} in significant non-compliance.`);
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveHealthContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmHospital(), warmOutbreaks(), warmCdcWonder(), warmEnvHealth()]);

    // Hospitals
    if (state) {
      const hospitals = getHospitalsByState(state);
      if (hospitals && hospitals.length > 0) {
        parts.push(`Hospitals in ${state}: ${hospitals.length} facilities tracked.`);
      }
    } else {
      const stats = getHospitalStatistics();
      if (stats?.total) parts.push(`National hospital network: ${stats.total} facilities.`);
    }

    // Waterborne illness outbreaks
    if (state) {
      const outbreaks = getOutbreaksByState(state);
      if (outbreaks && outbreaks.length > 0) {
        parts.push(`Waterborne illness in ${state}: ${outbreaks.length} outbreak records.`);
      }
    } else {
      const stats = getOutbreakStatistics();
      if (stats?.total) parts.push(`Waterborne illness nationally: ${stats.total} outbreak records.`);
    }

    // CDC WONDER mortality
    const topCauses = getTopCauses(5);
    if (topCauses && topCauses.length > 0) {
      const causeList = topCauses.map((c: any) => `${c.cause || c.category}: ${c.deaths?.toLocaleString() || c.count?.toLocaleString() || '?'}`).join('; ');
      parts.push(`CDC WONDER top environmental mortality causes: ${causeList}.`);
    }

    // Environmental health
    if (state) {
      const envHealth = getEnvironmentalHealthByState(state);
      if (envHealth && envHealth.length > 0) {
        const highRisk = envHealth.filter((m: any) => m.riskLevel === 'high' || m.riskScore > 70);
        parts.push(`Environmental health in ${state}: ${envHealth.length} metrics, ${highRisk.length} high-risk areas.`);
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveMilitaryContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await warmDodPfas();

    if (state) {
      const dodState = getDoDPFASForState(state);
      if (dodState.length > 0) {
        for (const site of dodState.slice(0, 8)) {
          const name = site.installationName || 'Unknown';
          const pfasDetected = site.pfasDetected ? 'PFAS detected' : 'No PFAS';
          const drinkingWater = site.drinkingWaterExceedance ? 'drinking water exceedance' : '';
          const phase = site.phase || '';
          const details = [pfasDetected, drinkingWater, phase].filter(Boolean).join(', ');
          parts.push(`  ${name}${details ? ': ' + details : ''}`);
        }
        if (parts.length > 0) parts.unshift(`Military installations in ${state} with PFAS data (${dodState.length} total):`);
      }
    } else {
      const summaries = getDoDPFASAllSummaries();
      const entries = Object.entries(summaries);
      if (entries.length > 0) {
        const totalSites = entries.reduce((sum, [, s]: [string, any]) => sum + (s.totalSites || s.siteCount || 0), 0);
        const withExceedance = entries.reduce((sum, [, s]: [string, any]) => sum + (s.drinkingWaterExceedances || 0), 0);
        parts.push(`DoD PFAS program: ${totalSites} installations across ${entries.length} states assessed.`);
        if (withExceedance > 0) parts.push(`${withExceedance} installations with drinking water PFAS exceedances.`);

        // Top 5 states by site count
        const topStates = entries
          .map(([st, s]: [string, any]) => ({ state: st, count: s.totalSites || s.siteCount || 0 }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        if (topStates.length > 0) {
          parts.push(`Top states by DoD PFAS sites: ${topStates.map(s => `${s.state} (${s.count})`).join(', ')}.`);
        }
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveClimateContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmClimate(), warmUsdm(), warmFema(), warmForecast(), warmNws()]);

    // Climate normals
    if (state) {
      const normals = getClimateNormals(state);
      if (normals && normals.length > 0) {
        const avgTemp = normals.reduce((sum: number, c: any) => sum + (c.annualMeanTemp || c.avgTemp || 0), 0) / normals.length;
        const avgPrecip = normals.reduce((sum: number, c: any) => sum + (c.annualPrecip || c.totalPrecip || 0), 0) / normals.length;
        parts.push(`Climate normals for ${state}: ${normals.length} counties, avg temp ${avgTemp.toFixed(1)}°F, avg precip ${avgPrecip.toFixed(1)}".`);
      }
    }

    // Drought (USDM)
    if (state) {
      const drought = getUsdmByState(state);
      if (drought) {
        const pctDrought = 100 - drought.none;
        if (pctDrought > 0) parts.push(`Drought in ${state}: ${pctDrought.toFixed(0)}% area in some drought.`);
        const extreme = drought.d3 + drought.d4;
        if (extreme > 0) parts.push(`Extreme/exceptional drought: ${extreme.toFixed(1)}% of ${state}.`);
      }
    } else {
      const allDrought = getUsdmAll();
      const entries = Object.entries(allDrought);
      const statesInDrought = entries.filter(([, d]) => (100 - d.none) > 0).length;
      parts.push(`USDM: ${statesInDrought}/${entries.length} states reporting drought conditions.`);
    }

    // FEMA risk/declarations
    if (state) {
      const risk = getFemaRiskIndex(state);
      if (risk) {
        parts.push(`FEMA risk index for ${state}: overall score ${risk.riskScore ?? '?'}.`);
      }
      const declarations = getFemaDeclarations(state);
      if (declarations && declarations.length > 0) {
        const recent = declarations.slice(0, 3).map((d: any) => `${d.declarationType || d.type} - ${d.title || d.incidentType || 'unknown'} (${d.declarationDate || d.date || '?'})`);
        parts.push(`Recent FEMA declarations in ${state}: ${recent.join('; ')}.`);
      }
    }

    // NWS alerts
    if (state) {
      const alerts = getNwsAlerts(state);
      if (alerts && alerts.length > 0) {
        const byEvent: Record<string, number> = {};
        for (const a of alerts) { byEvent[a.event || 'Alert'] = (byEvent[a.event || 'Alert'] || 0) + 1; }
        const summary = Object.entries(byEvent).slice(0, 5).map(([e, c]) => `${e}: ${c}`).join(', ');
        parts.push(`Active NWS alerts in ${state}: ${alerts.length} total (${summary}).`);
      }
    } else {
      const severe = getSevereWeatherAlerts();
      if (severe.length > 0) parts.push(`${severe.length} severe weather alerts active nationally.`);
    }

    // Forecasts
    if (state) {
      const forecasts = getNwsForecast(state);
      if (forecasts && forecasts.length > 0) {
        parts.push(`NWS forecasts for ${state}: ${forecasts.length} station forecasts available.`);
      }
    } else {
      const highRisk = getHighRiskForecasts();
      if (highRisk.length > 0) parts.push(`${highRisk.length} high-risk weather forecasts active nationally.`);
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveRealtimeContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmIv(), warmAir(), warmNwps()]);

    // USGS real-time streamflow
    if (state) {
      const ivData = getUsgsIvByState(state);
      if (ivData && ivData.length > 0) {
        parts.push(`USGS real-time gauges in ${state}: ${ivData.length} stations reporting.`);
        const withFlow = ivData.filter((r: any) => r.streamflow != null || r.discharge != null || r.value != null);
        if (withFlow.length > 0) {
          const flowValues = withFlow.map((r: any) => r.streamflow ?? r.discharge ?? r.value).filter(Boolean);
          if (flowValues.length > 0) {
            const avg = flowValues.reduce((s: number, v: number) => s + v, 0) / flowValues.length;
            parts.push(`Average streamflow: ${avg.toFixed(1)} cfs across ${flowValues.length} gauges.`);
          }
        }
      }
    } else {
      const status = getUsgsIvCacheStatus();
      if ('readingCount' in status && status.readingCount) parts.push(`USGS real-time network: ${status.readingCount} instantaneous value readings.`);
    }

    // Air quality
    if (state) {
      const aq = getAirQualityForState(state);
      if (aq) {
        parts.push(`Air quality in ${state}: AQI ${aq.usAqi ?? '?'}, PM2.5 ${aq.pm25 ?? '?'} µg/m³, Ozone ${aq.ozone ?? '?'} ppb.`);
      }
    } else {
      const allAq = getAirQualityAllStates();
      if (allAq.length > 0) {
        const unhealthy = allAq.filter(s => (s.usAqi ?? 0) > 100);
        parts.push(`Air quality: ${allAq.length} states reporting, ${unhealthy.length} with AQI > 100.`);
      }
    }

    // Flood gauges (NWPS)
    const allGauges = getNwpsAllGauges();
    if (allGauges.length > 0) {
      const flooding = allGauges.filter((g: any) => g.status === 'flooding' || g.floodCategory === 'major' || g.floodCategory === 'moderate');
      if (state) {
        const stateGauges = allGauges.filter((g: any) => g.state === state || g.stateCode === state);
        const stateFlooding = stateGauges.filter((g: any) => g.status === 'flooding' || g.floodCategory === 'major' || g.floodCategory === 'moderate');
        parts.push(`Flood gauges in ${state}: ${stateGauges.length} gauges, ${stateFlooding.length} at flood stage.`);
      } else if (flooding.length > 0) {
        parts.push(`NWPS: ${flooding.length}/${allGauges.length} gauges at flood stage nationally.`);
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveSuperfundContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmSuperfund(), warmSems()]);

    if (state) {
      const sites = getSuperfundSites(state);
      if (sites && sites.length > 0) {
        const npl = sites.filter((s: any) => s.nplStatus === 'Currently on the Final NPL' || s.onNPL);
        parts.push(`Superfund sites in ${state}: ${sites.length} total, ${npl.length} on NPL.`);
        const active = sites.filter((s: any) => s.status === 'active' || s.constructionComplete !== true);
        if (active.length > 0) parts.push(`${active.length} with active cleanup.`);
        // List top 3 by name
        const topSites = sites.slice(0, 3).map((s: any) => s.siteName || s.name).filter(Boolean);
        if (topSites.length > 0) parts.push(`Notable sites: ${topSites.join(', ')}.`);
      }

      const semsSites = getSemsSites(state);
      if (semsSites && semsSites.length > 0) {
        parts.push(`SEMS sites in ${state}: ${semsSites.length} tracked.`);
      }
    } else {
      const allSites = getSuperfundSitesAll();
      if (allSites.length > 0) {
        parts.push(`Superfund nationally: ${allSites.length} sites tracked.`);
        // States with most sites
        const bySt: Record<string, number> = {};
        for (const s of allSites) { const st = (s as any).state || (s as any).stateCode; if (st) bySt[st] = (bySt[st] || 0) + 1; }
        const topStates = Object.entries(bySt).sort(([, a], [, b]) => b - a).slice(0, 5);
        if (topStates.length > 0) {
          parts.push(`Most Superfund sites: ${topStates.map(([st, c]) => `${st} (${c})`).join(', ')}.`);
        }
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveInfrastructureContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmUsace(), warmUsbr()]);

    // USACE
    const usaceLocations = getUsaceAllLocations();
    if (usaceLocations.length > 0) {
      if (state) {
        const stateLocs = usaceLocations.filter((l: any) => l.state === state || l.stateCode === state);
        parts.push(`USACE infrastructure in ${state}: ${stateLocs.length} projects/locations.`);
        if (stateLocs.length > 0) {
          const types: Record<string, number> = {};
          for (const l of stateLocs) { const t = (l as any).type || 'other'; types[t] = (types[t] || 0) + 1; }
          const typeList = Object.entries(types).map(([t, c]) => `${t}: ${c}`).join(', ');
          if (typeList) parts.push(`Types: ${typeList}.`);
        }
      } else {
        parts.push(`USACE: ${usaceLocations.length} infrastructure locations nationwide.`);
      }
    }

    // USBR reservoirs
    const reservoirs = getUsbrAll();
    if (reservoirs.length > 0) {
      if (state) {
        const stateRes = reservoirs.filter((r: any) => r.state === state || r.stateCode === state);
        if (stateRes.length > 0) {
          const avgStorage = stateRes.reduce((s: number, r: any) => s + (r.percentCapacity || r.pctFull || 0), 0) / stateRes.length;
          parts.push(`USBR reservoirs in ${state}: ${stateRes.length} reservoirs, avg ${avgStorage.toFixed(0)}% capacity.`);
        }
      } else {
        const avgStorage = reservoirs.reduce((s: number, r: any) => s + (r.percentCapacity || r.pctFull || 0), 0) / reservoirs.length;
        parts.push(`USBR: ${reservoirs.length} reservoirs nationally, avg ${avgStorage.toFixed(0)}% capacity.`);
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveEjContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await warmEnvHealth();

    if (state) {
      const envHealth = getEnvironmentalHealthByState(state);
      if (envHealth && envHealth.length > 0) {
        const ejPriority = envHealth.filter((m: any) =>
          (m.ejPercentile ?? m.ejScreenPercentile ?? 0) >= 80 ||
          m.riskLevel === 'high'
        );
        parts.push(`Environmental justice in ${state}: ${envHealth.length} areas assessed, ${ejPriority.length} high EJ-priority communities.`);
      }
    } else {
      const stats = getEnvironmentalHealthStatistics();
      if (stats?.total) {
        parts.push(`Environmental health nationally: ${stats.total} areas tracked.`);
        if (stats.highRiskAreas) parts.push(`${stats.highRiskAreas} high-risk environmental areas identified.`);
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveWaterQualityContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmAttains(), warmStateReport()]);

    if (state) {
      // Use state report for aggregated data
      const report = getStateReport(state);
      if (report) {
        parts.push(`Water quality report for ${state}:`);
        parts.push(`  AI readiness score: ${report.aiReadinessScore}/100 (${report.aiReadinessGrade}).`);
        parts.push(`  ${report.totalWaterbodies} waterbodies assessed, ${report.impairedCount} impaired.`);
        if (report.topCauses && report.topCauses.length > 0) {
          parts.push(`  Top impairment causes: ${report.topCauses.slice(0, 5).join(', ')}.`);
        }
        parts.push(`  Coverage: ${report.coverageGrade}, Freshness: ${report.freshnessGrade}.`);
      }

      // ATTAINS data
      const attains = await getAttainsStateData(state);
      if (attains) {
        const impPct = attains.total > 0 ? Math.round((attains.high + attains.medium) / attains.total * 100) : 0;
        parts.push(`ATTAINS: ${attains.total} waterbodies, ${attains.high + attains.medium} impaired (${impPct}%).`);
        if (attains.tmdlNeeded) parts.push(`  TMDLs needed: ${attains.tmdlNeeded}.`);
        if (attains.topCauses?.length) parts.push(`  ATTAINS top causes: ${attains.topCauses.slice(0, 5).join(', ')}.`);
      }
    } else {
      // National overview from all state reports
      const allReports = getAllStateReports();
      if (allReports?.reports) {
        const entries = Object.entries(allReports.reports);
        if (entries.length > 0) {
          const worst = [...entries]
            .sort(([, a], [, b]) => a.aiReadinessScore - b.aiReadinessScore)
            .slice(0, 5);
          if (worst.length > 0) {
            parts.push(`States with lowest data readiness scores:`);
            for (const [st, r] of worst) {
              parts.push(`  ${st}: ${r.aiReadinessScore}/100, ${r.impairedCount} impaired waterbodies.`);
            }
          }
          const best = [...entries]
            .sort(([, a], [, b]) => b.aiReadinessScore - a.aiReadinessScore)
            .slice(0, 5);
          if (best.length > 0) {
            parts.push(`States with highest data readiness scores:`);
            for (const [st, r] of best) {
              parts.push(`  ${st}: ${r.aiReadinessScore}/100.`);
            }
          }
        }
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveStormwaterContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await warmEffluent();

    if (state) {
      const effluent = getEchoEffluent(state);
      if (effluent && effluent.length > 0) {
        const violations = effluent.filter((r: any) => r.violationStatus || r.inViolation);
        parts.push(`Discharge monitoring in ${state}: ${effluent.length} effluent records, ${violations.length} with violations.`);
      }
    } else {
      // Get overall stats from ECHO
      const echoAll = getEchoAllData();
      if (echoAll?.facilities) {
        const cwaPerm = echoAll.facilities.filter((f: any) => f.programAcronym === 'CWA' || f.cwaPermit);
        parts.push(`CWA discharge facilities nationally: ${cwaPerm.length} tracked.`);
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

// ── Base context (always included) ─────────────────────────────────────────────

async function buildBaseContext(state: string | null, role: string): Promise<string> {
  const parts: string[] = [];
  try {
    await warmStateReport();
    const allReports = getAllStateReports();
    if (allReports?.reports) {
      const reps = Object.values(allReports.reports);
      const stateCount = reps.length;
      const totalImpaired = reps.reduce((sum, r) => sum + (r.impairedCount || 0), 0);
      const totalWaterbodies = reps.reduce((sum, r) => sum + (r.totalWaterbodies || 0), 0);
      const avgScore = reps.reduce((sum, r) => sum + (r.aiReadinessScore || 0), 0) / (stateCount || 1);
      parts.push(`National overview (${stateCount} states): ${totalWaterbodies.toLocaleString()} waterbodies, ${totalImpaired.toLocaleString()} impaired, avg readiness score ${avgScore.toFixed(0)}/100.`);
    }
  } catch { /* cache not available */ }

  if (state) parts.push(`User is focused on: ${state}.`);
  parts.push(`User role: ${role}.`);

  return parts.join('\n');
}

// ── State extraction from question ─────────────────────────────────────────────

const STATE_ABBREVS: Record<string, string> = {
  alabama:'AL',alaska:'AK',arizona:'AZ',arkansas:'AR',california:'CA',colorado:'CO',
  connecticut:'CT',delaware:'DE','district of columbia':'DC',florida:'FL',georgia:'GA',
  hawaii:'HI',idaho:'ID',illinois:'IL',indiana:'IN',iowa:'IA',kansas:'KS',kentucky:'KY',
  louisiana:'LA',maine:'ME',maryland:'MD',massachusetts:'MA',michigan:'MI',minnesota:'MN',
  mississippi:'MS',missouri:'MO',montana:'MT',nebraska:'NE',nevada:'NV','new hampshire':'NH',
  'new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND',
  ohio:'OH',oklahoma:'OK',oregon:'OR',pennsylvania:'PA','rhode island':'RI','south carolina':'SC',
  'south dakota':'SD',tennessee:'TN',texas:'TX',utah:'UT',vermont:'VT',virginia:'VA',
  washington:'WA','west virginia':'WV',wisconsin:'WI',wyoming:'WY',
};

const ABBREV_SET = new Set(Object.values(STATE_ABBREVS));

function extractStateFromQuestion(question: string, providedState: string | null): string | null {
  if (providedState) return providedState.toUpperCase();

  const q = question.toLowerCase();

  // Check full state names
  for (const [name, abbr] of Object.entries(STATE_ABBREVS)) {
    if (q.includes(name)) return abbr;
  }

  // Check 2-letter abbreviations (with word boundary simulation)
  const words = question.toUpperCase().split(/\s+/);
  for (const w of words) {
    if (ABBREV_SET.has(w)) return w;
  }

  return null;
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function buildAskPinContext(params: AskPinContextParams): Promise<AskPinContextResult> {
  const { question, role, isMilitary } = params;
  const state = extractStateFromQuestion(question, params.state);
  const sources: string[] = [];

  // Detect relevant domains
  const domains = detectDomains(question, role, isMilitary);

  // Always build base context
  const baseContext = await buildBaseContext(state, role);
  sources.push('state-reports');

  // Retrieve domain-specific context in parallel
  const domainResults = await Promise.all(
    domains.map(async (d) => {
      try {
        const text = await d.retriever(state);
        if (text.trim()) {
          sources.push(d.domain);
          return `[${d.domain.toUpperCase()}]\n${text}`;
        }
      } catch { /* skip failed domain */ }
      return '';
    })
  );

  const domainContext = domainResults.filter(Boolean).join('\n\n');

  // If no domains matched (generic question), provide a broader overview
  let fallbackContext = '';
  if (domains.length === 0) {
    try {
      // Provide water quality + compliance overview for generic questions
      const [wqText, compText] = await Promise.all([
        retrieveWaterQualityContext(state),
        retrieveComplianceContext(state),
      ]);
      if (wqText.trim()) { fallbackContext += `[WATER-QUALITY]\n${wqText}\n\n`; sources.push('water-quality'); }
      if (compText.trim()) { fallbackContext += `[COMPLIANCE]\n${compText}\n\n`; sources.push('compliance'); }
    } catch { /* skip */ }
  }

  // Military context boost
  let militaryExtra = '';
  if (isMilitary && !domains.some(d => d.domain === 'military')) {
    try {
      const milText = await retrieveMilitaryContext(state);
      if (milText.trim()) { militaryExtra = `[MILITARY]\n${milText}`; sources.push('military'); }
    } catch { /* skip */ }
  }

  const context = [baseContext, domainContext, fallbackContext, militaryExtra].filter(Boolean).join('\n\n');

  return { context, sources: [...new Set(sources)] };
}
