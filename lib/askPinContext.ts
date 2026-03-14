/**
 * Ask PIN Context Builder — Question-aware domain detection + direct cache access
 *
 * Analyzes user questions via keyword matching to detect relevant domains,
 * then pulls data directly from server-side caches instead of fetching HTTP endpoints.
 * This gives Ask PIN access to all 80+ cache modules with facility-level granularity.
 * Includes the cross-agency correlation engine for compound risk insights.
 */

// ── Cache imports (original 25) ────────────────────────────────────────────────
import { ensureWarmed as warmPfas, getPfasAllResults, getPfasCacheStatus } from './pfasCache';
import { ensureWarmed as warmDodPfas, getDoDPFASForState, getDoDPFASAllSummaries } from './dodPfasCache';
import { ensureWarmed as warmGw, getNwisGwAllSites, getNwisGwCacheStatus } from './nwisGwCache';
import { ensureWarmed as warmSdwis, getSdwisForState, getSdwisCacheStatus, getSdwisAllData } from './sdwisCache';
import { ensureWarmed as warmIcis, getIcisAllData } from './icisCache';
import { ensureWarmed as warmEcho, getEchoAllData } from './echoCache';
import { ensureWarmed as warmHospital, getHospitalsByState, getHospitalStatistics } from './hospitalCache';
import { ensureWarmed as warmOutbreaks, getOutbreaksByState, getOutbreakStatistics } from './waterborneIllnessCache';
import { ensureWarmed as warmCdcWonder, getTopCauses } from './cdcWonderCache';
import { ensureWarmed as warmEnvHealth, getEnvironmentalHealthByState, getEnvironmentalHealthStatistics } from './environmentalHealthCache';
import { ensureWarmed as warmClimate, getClimateNormals } from './climateNormalsCache';
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

// ── Additional cache imports ───────────────────────────────────────────────────
import { ensureWarmed as warmDodPfasSites, getDodPfasSites, getDodPfasAllSites, getActivePfasInvestigations } from './dodPfasSitesCache';
import { ensureWarmed as warmEpaPfas, getEpaPfasAnalytics, getEpaPfasAllStates, getEpaPfasExceedances } from './epaPfasAnalyticsCache';
import { ensureWarmed as warmTri, getTriAllFacilities } from './triCache';
import { ensureWarmed as warmRcra, getRcraFacilities, getRcraFacilitiesAll } from './rcraCache';
import { ensureWarmed as warmSsoCso, getSsoCsoByState, getSsoCsoAll } from './ssoCsoCache';
import { ensureWarmed as warmMs4, getMs4PermitsByState } from './ms4PermitCache';
import { ensureWarmed as warmDam, getDamAll, getDamsByState } from './damCache';
import { ensureWarmed as warmHpsa, getHpsaByState, getHpsaStatistics } from './hrsaHpsaCache';
import { ensureWarmed as warmEnvTracking, getSignificantFindings, getDrinkingWaterIndicators } from './environmentalTrackingCache';
import { ensureWarmed as warmHealthGov, getHospitalCapacityData } from './healthDataGovCache';
import { ensureWarmed as warmPlaces, getCdcPlacesByState } from './cdcPlacesCache';
import { ensureWarmed as warmCyber, getCyberRisk, getCyberRiskAll, getHighRiskSystems, getCriticalNearMilitary } from './cyberRiskCache';
import { ensureWarmed as warmFloodImpact, getFloodImpactByState, getHighRiskZones } from './floodImpactCache';
import { ensureWarmed as warmNfip, getNfipClaims, getNfipClaimsAll } from './nfipClaimsCache';
import { ensureWarmed as warmEjscreen, getEJScreenCache } from './ejscreenCache';

// ── Correlation engine ─────────────────────────────────────────────────────────
import {
  discoverPfasHealthDeserts,
  discoverFloodWaterContamination,
  discoverDischargeImpairmentLinks,
  discoverDamCascadeRisk,
  discoverDroughtWaterStress,
  type CorrelationFinding,
} from './correlationDiscovery';
import { PRIORITY_STATES } from './constants';

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
    keywords: ['violation', 'permit', 'enforcement', 'npdes', 'sdwis', 'compliance', 'inspection', 'penalty', 'fine', 'toxic', 'hazardous waste', 'rcra', 'tri'],
    roleBoosts: ['Federal', 'State', 'MS4', 'Utility'],
    retriever: retrieveComplianceContext,
  },
  health: {
    keywords: ['health', 'hospital', 'disease', 'illness', 'mortality', 'cancer', 'outbreak', 'death', 'waterborne', 'shortage', 'hpsa', 'chronic', 'diabetes', 'asthma'],
    roleBoosts: ['Federal', 'K-12'],
    retriever: retrieveHealthContext,
  },
  military: {
    keywords: ['military', 'base', 'installation', 'dod', 'army', 'navy', 'air force', 'marine', 'defense', 'cyber'],
    roleBoosts: ['Federal'],
    retriever: retrieveMilitaryContext,
  },
  climate: {
    keywords: ['climate', 'weather', 'drought', 'flood', 'temperature', 'precipitation', 'forecast', 'storm', 'fema', 'nfip', 'insurance claim'],
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
    keywords: ['dam', 'reservoir', 'infrastructure', 'levee', 'pipe', 'utility', 'corps of engineers', 'usace', 'reclamation', 'dam failure', 'dam safety'],
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
    keywords: ['stormwater', 'ms4', 'cso', 'sso', 'runoff', 'overflow', 'combined sewer', 'effluent', 'discharge', 'sanitary sewer'],
    roleBoosts: ['MS4', 'Utility', 'State'],
    retriever: retrieveStormwaterContext,
  },
  correlations: {
    keywords: ['correlation', 'cross-agency', 'breakthrough', 'compound risk', 'cascade', 'connected', 'pattern', 'converge', 'health desert', 'downstream'],
    roleBoosts: ['Federal'],
    retriever: retrieveCorrelationsContext,
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

  // If 2+ non-correlation domains matched, auto-boost correlations (compound question)
  const nonCorrelation = matches.filter(m => m.domain !== 'correlations');
  const hasCorrelations = matches.some(m => m.domain === 'correlations');
  if (nonCorrelation.length >= 2 && !hasCorrelations) {
    matches.push({ domain: 'correlations', score: 3, retriever: retrieveCorrelationsContext });
    matches.sort((a, b) => b.score - a.score);
  }

  // Cap at 5 domains to stay within token budget
  return matches.slice(0, 5);
}

// ── Retriever functions ────────────────────────────────────────────────────────

async function retrievePfasContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmPfas(), warmDodPfas(), warmDodPfasSites(), warmEpaPfas()]);

    const allPfas = getPfasAllResults();
    if (allPfas.length > 0) {
      const aboveMcl = allPfas.filter((r: any) => r.exceedsMcl || r.aboveMCL);
      if (state) {
        const stateResults = allPfas.filter((r: any) => r.state === state || r.stateCode === state);
        const stateAboveMcl = stateResults.filter((r: any) => r.exceedsMcl || r.aboveMCL);
        parts.push(`PFAS in ${state}: ${stateResults.length} detections, ${stateAboveMcl.length} above MCL threshold.`);
      }
      parts.push(`PFAS nationally: ${allPfas.length} total detections, ${aboveMcl.length} above MCL (${allPfas.length > 0 ? Math.round(aboveMcl.length / allPfas.length * 100) : 0}%).`);

      // State breakdown for national view
      if (!state) {
        const byState = new Map<string, { total: number; aboveMcl: number }>();
        for (const r of allPfas as any[]) {
          const st = r.state || r.stateCode || '';
          if (!st) continue;
          const entry = byState.get(st) || { total: 0, aboveMcl: 0 };
          entry.total++;
          if (r.exceedsMcl || r.aboveMCL) entry.aboveMcl++;
          byState.set(st, entry);
        }
        const topStates = [...byState.entries()]
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 8);
        if (topStates.length > 0) {
          parts.push(`Top states by PFAS detections: ${topStates.map(([st, d]) => `${st} (${d.total} detections, ${d.aboveMcl} above MCL)`).join(', ')}.`);
        }
      }
    }

    // DoD PFAS assessment data
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

    // DoD PFAS investigation sites (more detailed)
    if (state) {
      const sites = getDodPfasSites(state);
      if (sites.length > 0) {
        const active = sites.filter(s => s.investigationStatus !== 'complete');
        parts.push(`DoD PFAS investigation sites in ${state}: ${sites.length} sites, ${active.length} active investigations.`);
      }
    } else {
      const activeInvestigations = getActivePfasInvestigations();
      if (activeInvestigations.length > 0) {
        parts.push(`Active DoD PFAS investigations: ${activeInvestigations.length} sites nationally.`);
      }
    }

    // EPA PFAS analytics (ECHO-derived)
    if (state) {
      const epaPfas = getEpaPfasAnalytics(state);
      if (epaPfas) {
        parts.push(`EPA PFAS analytics in ${state}: ${epaPfas.facilities?.length || 0} facilities tracked.`);
      }
    } else {
      const exceedances = getEpaPfasExceedances();
      if (exceedances.length > 0) {
        parts.push(`EPA PFAS exceedances: ${exceedances.length} facilities with PFAS limit exceedances.`);
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
    await Promise.all([warmSdwis(), warmIcis(), warmEcho(), warmTri(), warmRcra()]);

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
      const sdwisAll = getSdwisAllData();
      const systems = sdwisAll.systems || [];
      const violations = sdwisAll.violations || [];
      const enforcement = sdwisAll.enforcement || [];
      if (systems.length > 0) {
        const healthBased = violations.filter((v: any) => v.isHealthBased || v.violationCategory === 'Health-Based');
        parts.push(`SDWIS nationally: ${systems.length.toLocaleString()} drinking water systems, ${violations.length.toLocaleString()} violations, ${enforcement.length.toLocaleString()} enforcement actions.`);
        if (healthBased.length > 0) parts.push(`  ${healthBased.length.toLocaleString()} health-based violations.`);
        // Top states by violations
        const byState = new Map<string, number>();
        for (const v of violations as any[]) {
          const st = v.state || v.stateCode || '';
          if (st) byState.set(st, (byState.get(st) || 0) + 1);
        }
        const topViolStates = [...byState.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (topViolStates.length > 0) {
          parts.push(`  Top states by violations: ${topViolStates.map(([st, n]) => `${st} (${n})`).join(', ')}.`);
        }
      } else {
        const sdwisStatus = getSdwisCacheStatus();
        if ('systemCount' in sdwisStatus && sdwisStatus.systemCount) parts.push(`SDWIS nationally: ${sdwisStatus.systemCount} drinking water systems tracked.`);
      }
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
        const echoViolations = echoAll.violations || [];
        parts.push(`ECHO nationally: ${facilities.length.toLocaleString()} facilities tracked, ${nonCompliant.length.toLocaleString()} in significant non-compliance, ${echoViolations.length.toLocaleString()} violation records.`);
      }
    }

    // TRI (Toxic Release Inventory)
    const triAll = getTriAllFacilities();
    if (triAll.length > 0) {
      if (state) {
        const stateTri = triAll.filter((f: any) => f.state === state || f.stateCode === state);
        parts.push(`TRI in ${state}: ${stateTri.length} toxic release facilities.`);
      } else {
        parts.push(`TRI nationally: ${triAll.length} toxic release facilities tracked.`);
      }
    }

    // RCRA (hazardous waste)
    if (state) {
      const rcraState = getRcraFacilities(state);
      if (rcraState && rcraState.length > 0) {
        parts.push(`RCRA in ${state}: ${rcraState.length} hazardous waste facilities.`);
      }
    } else {
      const rcraAll = getRcraFacilitiesAll();
      if (rcraAll.length > 0) {
        parts.push(`RCRA nationally: ${rcraAll.length} hazardous waste facilities.`);
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveHealthContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmHospital(), warmOutbreaks(), warmCdcWonder(), warmEnvHealth(), warmHpsa(), warmEnvTracking(), warmHealthGov(), warmPlaces()]);

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

    // HRSA Health Professional Shortage Areas
    if (state) {
      const hpsa = getHpsaByState(state);
      if (hpsa.length > 0) {
        const stats = getHpsaStatistics(state);
        parts.push(`Health professional shortage areas in ${state}: ${hpsa.length} designations, avg severity ${stats.avgScore?.toFixed(1) ?? '?'}/26.`);
      }
    } else {
      const stats = getHpsaStatistics();
      if (stats.totalDesignations > 0) {
        parts.push(`HRSA: ${stats.totalDesignations} health professional shortage area designations nationally.`);
      }
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

    // Environmental Tracking Network
    const findings = getSignificantFindings();
    if (findings && findings.length > 0) {
      if (state) {
        const stateFindings = findings.filter((f: any) => f.state === state || f.stateCode === state);
        if (stateFindings.length > 0) parts.push(`Environmental tracking significant findings in ${state}: ${stateFindings.length}.`);
      } else {
        parts.push(`Environmental tracking: ${findings.length} significant findings nationally.`);
      }
    }

    // Drinking water health indicators
    const dwIndicators = getDrinkingWaterIndicators();
    if (dwIndicators && dwIndicators.length > 0) {
      parts.push(`Drinking water health indicators: ${dwIndicators.length} tracked metrics.`);
    }

    // HealthData.gov hospital capacity
    if (state) {
      const capacity = getHospitalCapacityData(state);
      if (capacity && capacity.length > 0) {
        parts.push(`HealthData.gov: ${capacity.length} hospital capacity records for ${state}.`);
      }
    }

    // CDC PLACES (chronic disease prevalence)
    if (state) {
      const places = getCdcPlacesByState(state);
      if (places && places.length > 0) {
        parts.push(`CDC PLACES in ${state}: ${places.length} community health profiles.`);
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveMilitaryContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmDodPfas(), warmDodPfasSites(), warmCyber()]);

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

      // DoD PFAS investigation sites
      const sites = getDodPfasSites(state);
      if (sites.length > 0) {
        const active = sites.filter(s => s.investigationStatus !== 'complete');
        if (active.length > 0) parts.push(`Active DoD PFAS investigations in ${state}: ${active.length} sites.`);
      }
    } else {
      const summaries = getDoDPFASAllSummaries();
      const entries = Object.entries(summaries);
      if (entries.length > 0) {
        const totalSites = entries.reduce((sum, [, s]: [string, any]) => sum + (s.totalSites || s.siteCount || 0), 0);
        const withExceedance = entries.reduce((sum, [, s]: [string, any]) => sum + (s.drinkingWaterExceedances || 0), 0);
        parts.push(`DoD PFAS program: ${totalSites} installations across ${entries.length} states assessed.`);
        if (withExceedance > 0) parts.push(`${withExceedance} installations with drinking water PFAS exceedances.`);

        const topStates = entries
          .map(([st, s]: [string, any]) => ({ state: st, count: s.totalSites || s.siteCount || 0 }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        if (topStates.length > 0) {
          parts.push(`Top states by DoD PFAS sites: ${topStates.map(s => `${s.state} (${s.count})`).join(', ')}.`);
        }
      }
    }

    // Cyber risk for water utilities
    if (state) {
      const cyberState = getCyberRisk(state);
      if (cyberState.length > 0) {
        const high = cyberState.filter((c: any) => c.riskLevel === 'high' || c.riskLevel === 'critical');
        parts.push(`Water utility cyber risk in ${state}: ${cyberState.length} systems assessed, ${high.length} high/critical risk.`);
      }
    } else {
      const highRisk = getHighRiskSystems();
      const nearMil = getCriticalNearMilitary();
      if (highRisk.length > 0) parts.push(`Cyber risk: ${highRisk.length} high-risk water systems nationally.`);
      if (nearMil.length > 0) parts.push(`${nearMil.length} critical-risk water systems near military installations.`);
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

async function retrieveClimateContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    await Promise.all([warmClimate(), warmUsdm(), warmFema(), warmForecast(), warmNws(), warmFloodImpact(), warmNfip()]);

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

    // Flood impact zones
    if (state) {
      const floodZones = getFloodImpactByState(state);
      if (floodZones.length > 0) {
        parts.push(`Flood impact zones in ${state}: ${floodZones.length} areas at risk.`);
      }
    } else {
      const highRiskFlood = getHighRiskZones();
      if (highRiskFlood.length > 0) parts.push(`High-risk flood zones nationally: ${highRiskFlood.length}.`);
    }

    // NFIP flood claims
    if (state) {
      const claims = getNfipClaims(state);
      if (claims && claims.length > 0) {
        const totalPaid = claims.reduce((s: number, c: any) => s + (c.amountPaidOnBuildingClaim || 0) + (c.amountPaidOnContentsClaim || 0), 0);
        parts.push(`NFIP flood claims in ${state}: ${claims.length} claims, $${(totalPaid / 1_000_000).toFixed(1)}M in damages.`);
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
    await Promise.all([warmUsace(), warmUsbr(), warmDam()]);

    // Dams
    if (state) {
      const dams = getDamsByState(state);
      if (dams.length > 0) {
        const highHazard = dams.filter((d: any) => d.hazard?.toLowerCase().includes('high'));
        parts.push(`Dams in ${state}: ${dams.length} total, ${highHazard.length} high-hazard.`);
      }
    } else {
      const allDams = getDamAll();
      if (allDams.length > 0) {
        const highHazard = allDams.filter((d: any) => d.hazard?.toLowerCase().includes('high'));
        parts.push(`National dam inventory: ${allDams.length} dams, ${highHazard.length} high-hazard.`);
      }
    }

    // USACE
    const usaceLocations = getUsaceAllLocations();
    if (usaceLocations.length > 0) {
      if (state) {
        const stateLocs = usaceLocations.filter((l: any) => l.state === state || l.stateCode === state);
        parts.push(`USACE infrastructure in ${state}: ${stateLocs.length} projects/locations.`);
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
    await Promise.all([warmEnvHealth(), warmHpsa()]);

    if (state) {
      const envHealth = getEnvironmentalHealthByState(state);
      if (envHealth && envHealth.length > 0) {
        const ejPriority = envHealth.filter((m: any) =>
          (m.ejPercentile ?? m.ejScreenPercentile ?? 0) >= 80 ||
          m.riskLevel === 'high'
        );
        parts.push(`Environmental justice in ${state}: ${envHealth.length} areas assessed, ${ejPriority.length} high EJ-priority communities.`);
      }

      // HPSA (healthcare shortage in EJ context)
      const hpsa = getHpsaByState(state);
      if (hpsa.length > 0) {
        parts.push(`Healthcare shortage areas in ${state}: ${hpsa.length} HPSA designations (health desert indicator).`);
      }
    } else {
      const stats = getEnvironmentalHealthStatistics();
      if (stats?.total) {
        parts.push(`Environmental health nationally: ${stats.total} areas tracked.`);
        if (stats.highRiskAreas) parts.push(`${stats.highRiskAreas} high-risk environmental areas identified.`);
        if (stats.environmentalJusticeAreas) parts.push(`${stats.environmentalJusticeAreas} environmental justice priority areas.`);
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
      const report = getStateReport(state);
      if (report) {
        parts.push(`Water quality report for ${state}:`);
        parts.push(`  Water quality score: ${report.aiReadinessScore}/100 (grade: ${report.aiReadinessGrade}).`);
        const assessed = report.assessedCount || ((report.impairedCount || 0) + (report.healthyCount || 0));
        const impPctSt = assessed ? Math.round(((report.impairedCount || 0) / assessed) * 100) : null;
        parts.push(`  ${assessed} waterbodies assessed, ${report.impairedCount} impaired${impPctSt !== null ? ` (${impPctSt}%)` : ''}.`);
        if (report.topCauses && report.topCauses.length > 0) {
          parts.push(`  Top impairment causes: ${report.topCauses.slice(0, 5).join(', ')}.`);
        }
        parts.push(`  Coverage: ${report.coverageGrade}, Freshness: ${report.freshnessGrade}.`);
      }

      const attains = await getAttainsStateData(state);
      if (attains) {
        const impPct = attains.total > 0 ? Math.round((attains.high + attains.medium) / attains.total * 100) : 0;
        parts.push(`ATTAINS: ${attains.total} waterbodies, ${attains.high + attains.medium} impaired (${impPct}%).`);
        if (attains.tmdlNeeded) parts.push(`  TMDLs needed: ${attains.tmdlNeeded}.`);
        if (attains.topCauses?.length) parts.push(`  ATTAINS top causes: ${attains.topCauses.slice(0, 5).join(', ')}.`);
      }
    } else {
      const allReports = getAllStateReports();
      if (allReports?.reports) {
        const entries = Object.entries(allReports.reports);
        if (entries.length > 0) {
          const worst = [...entries]
            .sort(([, a], [, b]) => a.aiReadinessScore - b.aiReadinessScore)
            .slice(0, 5);
          if (worst.length > 0) {
            parts.push(`States with lowest water quality scores:`);
            for (const [st, r] of worst) {
              const assessed = r.assessedCount || ((r.impairedCount || 0) + (r.healthyCount || 0));
              parts.push(`  ${st}: score ${r.aiReadinessScore}/100, ${r.impairedCount}/${assessed} waterbodies impaired.`);
            }
          }
          const best = [...entries]
            .sort(([, a], [, b]) => b.aiReadinessScore - a.aiReadinessScore)
            .slice(0, 5);
          if (best.length > 0) {
            parts.push(`States with highest water quality scores:`);
            for (const [st, r] of best) {
              parts.push(`  ${st}: score ${r.aiReadinessScore}/100.`);
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
    await Promise.all([warmEffluent(), warmSsoCso(), warmMs4()]);

    // Effluent (DMR)
    if (state) {
      const effluent = getEchoEffluent(state);
      if (effluent && effluent.length > 0) {
        const violations = effluent.filter((r: any) => r.violationStatus || r.inViolation);
        parts.push(`Discharge monitoring in ${state}: ${effluent.length} effluent records, ${violations.length} with violations.`);
      }
    } else {
      const echoAll = getEchoAllData();
      if (echoAll?.facilities) {
        const cwaPerm = echoAll.facilities.filter((f: any) => f.programAcronym === 'CWA' || f.cwaPermit);
        parts.push(`CWA discharge facilities nationally: ${cwaPerm.length} tracked.`);
      }
    }

    // SSO/CSO (sanitary/combined sewer overflows)
    if (state) {
      const ssoEvents = getSsoCsoByState(state);
      if (ssoEvents.length > 0) {
        parts.push(`SSO/CSO events in ${state}: ${ssoEvents.length} overflow events.`);
      }
    } else {
      const allSso = getSsoCsoAll();
      if (allSso.length > 0) {
        parts.push(`SSO/CSO nationally: ${allSso.length} overflow events tracked.`);
      }
    }

    // MS4 stormwater permits
    if (state) {
      const ms4 = getMs4PermitsByState(state);
      if (ms4.length > 0) {
        parts.push(`MS4 permits in ${state}: ${ms4.length} stormwater permits.`);
      }
    }
  } catch { /* cache not available */ }
  return parts.join('\n');
}

// ── Correlation Engine Retriever ───────────────────────────────────────────────

async function retrieveCorrelationsContext(state: string | null): Promise<string> {
  const parts: string[] = [];
  try {
    // Warm all caches needed by the 5 breakthrough discoveries
    await Promise.allSettled([
      warmDodPfasSites(), warmHpsa(), warmEjscreen(),
      warmNfip(), warmSdwis(), warmEcho(),
      warmDam(), warmUsdm(), warmUsbr(),
    ]);

    const allFindings: CorrelationFinding[] = [];

    // ── Breakthrough 1: PFAS × Healthcare Deserts
    try {
      const allPfasSites = getDodPfasAllSites();
      const pfasSitesFlat = Object.values(allPfasSites).flat();
      const pfasStates = [...new Set(pfasSitesFlat.map(s => s.state))];
      const hpsaFlat = pfasStates.flatMap(st => getHpsaByState(st));
      const ejSeen = new Set<string>();
      const ejFlat: { state: string; lat: number; lng: number; ejIndex: number; minorityPct: number; lowIncomePct: number }[] = [];
      for (const site of pfasSitesFlat.slice(0, 200)) {
        const nearby = getEJScreenCache(site.lat, site.lng);
        if (nearby) {
          for (const r of nearby) {
            if (!ejSeen.has(r.blockGroupId)) {
              ejSeen.add(r.blockGroupId);
              ejFlat.push({ state: r.state, lat: r.lat, lng: r.lng, ejIndex: r.ejIndex, minorityPct: r.minorityPct, lowIncomePct: r.lowIncomePct });
            }
          }
        }
      }
      allFindings.push(...discoverPfasHealthDeserts(pfasSitesFlat, hpsaFlat, ejFlat));
    } catch { /* skip */ }

    // ── Breakthrough 2: Flood → DW Contamination
    try {
      const nfipAll = getNfipClaimsAll();
      const sdwisAll = getSdwisAllData();
      const ejSeen2 = new Set<string>();
      const ejFlat2: { state: string; lat: number; lng: number; ejIndex: number; lowIncomePct: number }[] = [];
      for (const claim of nfipAll.slice(0, 300)) {
        if (claim.lat != null && claim.lng != null) {
          const nearby = getEJScreenCache(claim.lat, claim.lng);
          if (nearby) {
            for (const r of nearby) {
              if (!ejSeen2.has(r.blockGroupId)) {
                ejSeen2.add(r.blockGroupId);
                ejFlat2.push({ state: r.state, lat: r.lat, lng: r.lng, ejIndex: r.ejIndex, lowIncomePct: r.lowIncomePct });
              }
            }
          }
        }
      }
      const systemStateMap = new Map(sdwisAll.systems.map(s => [s.pwsid, s.state]));
      const violsWithState = sdwisAll.violations.map(v => ({
        ...v,
        state: systemStateMap.get(v.pwsid) || v.pwsid.slice(0, 2),
      }));
      allFindings.push(...discoverFloodWaterContamination(nfipAll, violsWithState, ejFlat2));
    } catch { /* skip */ }

    // ── Breakthrough 3: Discharge → Impairment
    try {
      const echoAll = getEchoAllData();
      const sncFacilities = echoAll.facilities
        .filter(f => f.snc)
        .map(f => ({ registryId: f.registryId, name: f.name, state: f.state, lat: f.lat, lng: f.lng, permitId: f.permitId, pollutant: undefined }));
      const impairedProxy = echoAll.violations.map(v => ({
        id: v.registryId, name: v.name, lat: v.lat, lng: v.lng, causes: [v.pollutant].filter(Boolean), state: v.state,
      }));
      allFindings.push(...discoverDischargeImpairmentLinks(sncFacilities, impairedProxy));
    } catch { /* skip */ }

    // ── Breakthrough 4: Dam Cascade Risk
    try {
      const dams = getDamAll();
      const echoAll = getEchoAllData();
      const hazmatSites = echoAll.facilities
        .filter(f => f.snc || f.qtrsInViolation >= 4)
        .map(f => ({ facilityName: f.name, state: f.state, lat: f.lat, lng: f.lng, sncFlag: f.snc }));
      const sdwisAll = getSdwisAllData();
      const dwSystems = sdwisAll.systems.map(s => ({
        pwsid: s.pwsid, state: s.state, lat: s.lat, lng: s.lng, populationServed: s.population,
      }));
      allFindings.push(...discoverDamCascadeRisk(dams, hazmatSites, dwSystems));
    } catch { /* skip */ }

    // ── Breakthrough 5: Drought × Reservoir × Violations
    try {
      const usdmAll = getUsdmAll();
      const reservoirs = getUsbrAll();
      const violsByState = new Map<string, { total: number; healthBased: number }>();
      const statesToCheck = state ? [state] : PRIORITY_STATES;
      for (const st of statesToCheck) {
        const stateData = getSdwisForState(st);
        if (stateData) {
          violsByState.set(st, {
            total: stateData.violations.length,
            healthBased: stateData.violations.filter(v => v.isHealthBased).length,
          });
        }
      }
      const droughtStates = Object.values(usdmAll);
      allFindings.push(...discoverDroughtWaterStress(droughtStates, reservoirs, violsByState));
    } catch { /* skip */ }

    // Filter by state if provided
    const filtered = state ? allFindings.filter(f => f.state === state) : allFindings;

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, moderate: 2, informational: 3 };
    filtered.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    if (filtered.length > 0) {
      const critical = filtered.filter(f => f.severity === 'critical').length;
      const high = filtered.filter(f => f.severity === 'high').length;
      parts.push(`Cross-agency correlations: ${filtered.length} findings (${critical} critical, ${high} high).`);

      // Top 5 findings with narratives
      for (const f of filtered.slice(0, 5)) {
        parts.push(`[${f.severity.toUpperCase()}] ${f.title}`);
        parts.push(`  ${f.narrative}`);
        parts.push(`  Agencies: ${f.agencies.join(', ')} | Datasets: ${f.datasets.join(', ')}`);
      }
    }
  } catch { /* correlation engine failed */ }
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
      const totalAssessed = reps.reduce((sum, r) => sum + (r.assessedCount || ((r.impairedCount || 0) + (r.healthyCount || 0)) || 0), 0);
      const avgScore = reps.reduce((sum, r) => sum + (r.aiReadinessScore || 0), 0) / (stateCount || 1);
      const impPct = totalAssessed ? Math.round((totalImpaired / totalAssessed) * 100) : null;
      parts.push(`National overview (${stateCount} states): ${totalAssessed.toLocaleString()} waterbodies assessed, ${totalImpaired.toLocaleString()} impaired${impPct !== null ? ` (${impPct}%)` : ''}. Avg water quality score ${avgScore.toFixed(0)}/100.`);
    }
  } catch { /* cache not available */ }

  if (state) parts.push(`User is asking about: ${state}.`);
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

function extractStatesFromQuestion(question: string, providedState: string | null): string[] {
  const states: string[] = [];
  if (providedState) states.push(providedState.toUpperCase());

  const q = question.toLowerCase();

  // Check full state names
  for (const [name, abbr] of Object.entries(STATE_ABBREVS)) {
    if (q.includes(name) && !states.includes(abbr)) states.push(abbr);
  }

  // Check 2-letter abbreviations (with word boundary simulation)
  const words = question.toUpperCase().split(/\s+/);
  for (const w of words) {
    if (ABBREV_SET.has(w) && !states.includes(w)) states.push(w);
  }

  return states;
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function buildAskPinContext(params: AskPinContextParams): Promise<AskPinContextResult> {
  const { question, role, isMilitary } = params;
  const allStates = extractStatesFromQuestion(question, params.state);
  const state = allStates.length > 0 ? allStates[0] : null;
  const comparisonStates = allStates.length >= 2 ? allStates.slice(0, 3) : []; // max 3 states for comparison
  const sources: string[] = [];

  // Detect relevant domains
  const domains = detectDomains(question, role, isMilitary);

  // Always build base context
  let baseContext = await buildBaseContext(comparisonStates.length > 0 ? null : state, role);
  if (comparisonStates.length >= 2) {
    baseContext += `\nUser is comparing states: ${comparisonStates.join(' vs ')}. Provide data for EACH state side by side.`;
  }
  sources.push('state-reports');

  // For comparison questions, retrieve each state's data separately
  const emptyDomains: string[] = [];
  let domainContext = '';

  if (comparisonStates.length >= 2) {
    // Multi-state comparison: run retrievers for each state
    const stateResults: string[] = [];
    for (const st of comparisonStates) {
      const stateSection = await Promise.all(
        domains.map(async (d) => {
          try {
            const text = await d.retriever(st);
            if (text.trim()) {
              sources.push(d.domain);
              return text;
            }
          } catch { /* skip */ }
          return '';
        })
      );
      const combined = stateSection.filter(Boolean).join('\n');
      if (combined.trim()) {
        stateResults.push(`[${st} DATA]\n${combined}`);
      }
    }
    domainContext = stateResults.join('\n\n');
    // Track empty domains from the first state's perspective
    for (const d of domains) {
      if (!sources.includes(d.domain)) emptyDomains.push(d.domain);
    }
  } else {
    // Single-state or national: original behavior
    const domainResults = await Promise.all(
      domains.map(async (d) => {
        try {
          const text = await d.retriever(state);
          if (text.trim()) {
            sources.push(d.domain);
            return `[${d.domain.toUpperCase()}]\n${text}`;
          } else {
            emptyDomains.push(d.domain);
          }
        } catch {
          emptyDomains.push(d.domain);
        }
        return '';
      })
    );
    domainContext = domainResults.filter(Boolean).join('\n\n');
  }

  // If no domains matched (generic question), provide a broader overview
  let fallbackContext = '';
  if (domains.length === 0) {
    try {
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

  // Tell the AI which data sources were queried but had no data
  let availabilityNote = '';
  if (emptyDomains.length > 0) {
    const domainLabels: Record<string, string> = {
      pfas: 'PFAS contamination data',
      military: 'DoD military installation data',
      health: 'hospital/healthcare shortage/mortality data',
      groundwater: 'USGS groundwater monitoring data',
      compliance: 'SDWIS/NPDES/ECHO compliance data',
      climate: 'drought/flood/climate data',
      realtime: 'real-time stream gauge/air quality data',
      superfund: 'Superfund/CERCLA site data',
      infrastructure: 'dam/reservoir/USACE infrastructure data',
      ej: 'environmental justice/EJScreen data',
      'water-quality': 'ATTAINS water quality assessment data',
      stormwater: 'SSO/CSO/stormwater data',
      correlations: 'cross-agency correlation analysis',
    };
    const labels = emptyDomains.map(d => domainLabels[d] || d);
    availabilityNote = `[DATA AVAILABILITY NOTE]\nThe following data sources were queried for this question but are not currently loaded: ${labels.join('; ')}. Answers are based only on the data shown above. Do not speculate about data you do not have — instead state what is available and note what additional data would strengthen the analysis.`;
  }

  const context = [baseContext, domainContext, fallbackContext, militaryExtra, availabilityNote].filter(Boolean).join('\n\n');

  return { context, sources: [...new Set(sources)] };
}
