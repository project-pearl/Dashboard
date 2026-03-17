/**
 * Lens Data Story Engine
 *
 * Deterministic, template-based engine that evaluates cache data against
 * threshold rules to produce structured findings and action items per lens.
 * No LLM calls — designed for sub-500ms response times.
 *
 * Architecture:
 *   Lens → Data Domains → Caches → Threshold Rules → Findings + Actions
 */

import { CACHE_META } from './cacheDeltaDescriber';

// ── Types ────────────────────────────────────────────────────────────────────

export interface StoryFinding {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'take-action' | 'monitor';
  title: string;
  detail: string;
  metric?: { label: string; value: string | number };
  sources: string[];
}

export interface LensStory {
  lens: string;
  role: string;
  state: string | null;
  headline: string;
  findings: StoryFinding[];
  dataSources: { name: string; agency: string; freshness: string }[];
  generatedAt: string;
}

// ── Severity ordering ────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 };

function sortFindings(findings: StoryFinding[]): StoryFinding[] {
  return findings.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
}

// ── Lens → Domain mapping ────────────────────────────────────────────────────

type DomainKey =
  | 'sdwis' | 'echo' | 'attains' | 'dam' | 'usdm' | 'nwisIv'
  | 'fema' | 'airQuality' | 'ejscreen' | 'dodPfas' | 'wqp'
  | 'nwsAlerts' | 'pfas' | 'icis' | 'firms';

const LENS_DOMAINS: Record<string, DomainKey[]> = {
  'water-quality':        ['attains', 'wqp', 'echo', 'nwisIv'],
  'compliance':           ['sdwis', 'echo', 'icis'],
  'infrastructure':       ['dam'],
  'monitoring':           ['nwisIv', 'nwsAlerts'],
  'sentinel-monitoring':  ['nwisIv', 'nwsAlerts'],
  'public-health':        ['sdwis', 'ejscreen', 'airQuality'],
  'disaster-emergency':   ['fema', 'usdm', 'nwisIv', 'nwsAlerts'],
  'disaster':             ['fema', 'usdm', 'nwisIv', 'nwsAlerts'],
  'emergency':            ['fema', 'usdm', 'nwisIv', 'nwsAlerts'],
  'military-installations': ['dodPfas', 'pfas'],
  'fire-air-quality':     ['firms', 'airQuality'],
  'habitat-ecology':      ['attains'],
  'habitat':              ['attains'],
  'agricultural-nps':     ['attains', 'wqp'],
  'agriculture':          ['attains', 'wqp'],
  'scorecard':            ['sdwis', 'echo', 'attains', 'dam', 'usdm', 'fema', 'airQuality'],
  'overview':             ['echo', 'attains', 'fema', 'usdm'],
  'briefing':             ['sdwis', 'echo', 'attains', 'fema', 'usdm'],
  'stormwater':           ['echo', 'nwisIv'],
  'funding':              ['sdwis', 'echo'],
  'ej-equity':            ['ejscreen', 'sdwis'],
  'permits':              ['echo', 'icis'],
  'trends':               ['sdwis', 'echo', 'attains'],
  'policy':               ['sdwis', 'echo', 'attains'],
  'political-briefing':   ['sdwis', 'echo', 'attains', 'fema'],
  'reports':              ['sdwis', 'echo', 'attains'],
  'interagency':          ['sdwis', 'echo', 'attains', 'fema'],
};

/** Returns domain keys for a lens, falling back to overview domains. */
export function getDomainsForLens(lens: string): DomainKey[] {
  return LENS_DOMAINS[lens] ?? LENS_DOMAINS['overview']!;
}

// ── Domain → Cache name mapping (for warming) ────────────────────────────────

const DOMAIN_CACHES: Record<DomainKey, string[]> = {
  sdwis:      ['sdwis'],
  echo:       ['echo'],
  attains:    ['attains'],
  dam:        ['dam'],
  usdm:       ['usdm'],
  nwisIv:     ['nwisIv'],
  fema:       ['fema'],
  airQuality: ['airQuality'],
  ejscreen:   ['ejscreen'],
  dodPfas:    ['dodPfas'],
  wqp:        ['wqp'],
  nwsAlerts:  ['nwsAlerts'],
  pfas:       ['pfas'],
  icis:       ['icis'],
  firms:      ['firms'],
};

/** Returns the unique set of cache names needed to warm for a given lens. */
export function getCacheNamesForLens(lens: string): string[] {
  const domains = getDomainsForLens(lens);
  const caches = new Set<string>();
  for (const d of domains) {
    for (const c of (DOMAIN_CACHES[d] ?? [])) caches.add(c);
  }
  return [...caches];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function mkId(domain: string): string {
  return `ls-${domain}-${(++_idCounter).toString(36)}`;
}

function safeGet<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function freshness(cacheName: string): string {
  const meta = CACHE_META[cacheName];
  return meta?.cadence ?? 'Unknown';
}

function cacheSource(cacheName: string): { name: string; agency: string; freshness: string } {
  const meta = CACHE_META[cacheName];
  return {
    name: meta?.friendlyName ?? cacheName,
    agency: meta?.agency ?? 'Unknown',
    freshness: freshness(cacheName),
  };
}

// ── Domain evaluators ────────────────────────────────────────────────────────
// Each evaluator reads from pre-warmed caches via synchronous getter functions
// and returns StoryFinding[] based on threshold rules.

function evaluateSdwis(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getSdwisAllData } = require('./sdwisCache');
    const data = getSdwisAllData();
    if (!data) return findings;

    const healthBased = data.violations?.filter((v: any) =>
      v.violationType === 'Health-Based' || v.contaminantGroup === 'Health-Based'
    ) ?? [];
    const totalViolations = data.violations?.length ?? 0;

    if (healthBased.length > 0) {
      findings.push({
        id: mkId('sdwis'), severity: 'critical', category: 'take-action',
        title: `${healthBased.length} health-based drinking water violation${healthBased.length > 1 ? 's' : ''}`,
        detail: `Health-based violations in public water systems require immediate attention. These indicate potential risk to public health.`,
        metric: { label: 'Health-Based Violations', value: healthBased.length },
        sources: ['sdwis'],
      });
    }
    if (totalViolations > 20) {
      findings.push({
        id: mkId('sdwis'), severity: 'warning', category: 'take-action',
        title: `${totalViolations} total drinking water violations`,
        detail: `Elevated violation count across public water systems. Review for patterns and systemic issues.`,
        metric: { label: 'Total Violations', value: totalViolations },
        sources: ['sdwis'],
      });
    } else if (totalViolations > 0 && healthBased.length === 0) {
      findings.push({
        id: mkId('sdwis'), severity: 'info', category: 'monitor',
        title: `${totalViolations} drinking water violation${totalViolations > 1 ? 's' : ''} (non-health-based)`,
        detail: `Minor or monitoring/reporting violations detected. No immediate health risk but should be tracked.`,
        metric: { label: 'Violations', value: totalViolations },
        sources: ['sdwis'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateEcho(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getEchoAllData } = require('./echoCache');
    const data = getEchoAllData();
    if (!data?.facilities) return findings;

    const sncFacilities = data.facilities.filter((f: any) =>
      f.complianceStatus === 'Significant Non-Compliance' || f.complianceStatus === 'SNC'
    );
    const chronicViolators = data.facilities.filter((f: any) => f.qtrsInViolation >= 4);
    const avgQtrs = data.facilities.length > 0
      ? data.facilities.reduce((sum: number, f: any) => sum + (f.qtrsInViolation || 0), 0) / data.facilities.length
      : 0;

    if (sncFacilities.length > 5) {
      findings.push({
        id: mkId('echo'), severity: 'critical', category: 'take-action',
        title: `${sncFacilities.length} facilities in Significant Non-Compliance`,
        detail: `Multiple facilities flagged by EPA for significant non-compliance. Enforcement action may be warranted.`,
        metric: { label: 'SNC Facilities', value: sncFacilities.length },
        sources: ['echo'],
      });
    } else if (sncFacilities.length > 0) {
      findings.push({
        id: mkId('echo'), severity: 'warning', category: 'take-action',
        title: `${sncFacilities.length} facilit${sncFacilities.length > 1 ? 'ies' : 'y'} in Significant Non-Compliance`,
        detail: `Facilities flagged for significant non-compliance with NPDES permits.`,
        metric: { label: 'SNC Facilities', value: sncFacilities.length },
        sources: ['echo'],
      });
    }

    if (avgQtrs > 4) {
      findings.push({
        id: mkId('echo'), severity: 'warning', category: 'monitor',
        title: `Average ${avgQtrs.toFixed(1)} quarters in violation`,
        detail: `Tracked facilities average over 4 quarters in violation status, suggesting persistent compliance challenges.`,
        metric: { label: 'Avg Quarters in Violation', value: avgQtrs.toFixed(1) },
        sources: ['echo'],
      });
    }

    if (chronicViolators.length > 0) {
      findings.push({
        id: mkId('echo'), severity: 'info', category: 'monitor',
        title: `${chronicViolators.length} chronic violator${chronicViolators.length > 1 ? 's' : ''} (4+ quarters)`,
        detail: `Facilities with sustained violation histories should be monitored for escalation.`,
        metric: { label: 'Chronic Violators', value: chronicViolators.length },
        sources: ['echo'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateAttains(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getAttainsCacheSummary } = require('./attainsCache');
    const summary = getAttainsCacheSummary();
    if (!summary) return findings;

    const impaired = summary.totalImpaired ?? summary.impairedCount ?? 0;
    const total = summary.totalAssessed ?? summary.assessedCount ?? 0;

    if (impaired > 0 && total > 0) {
      const pct = ((impaired / total) * 100).toFixed(1);
      const sev = Number(pct) > 50 ? 'warning' : 'info';
      findings.push({
        id: mkId('attains'), severity: sev, category: 'monitor',
        title: `${pct}% of assessed waterbodies impaired (${impaired.toLocaleString()} of ${total.toLocaleString()})`,
        detail: `EPA ATTAINS data shows ${impaired.toLocaleString()} impaired waterbodies out of ${total.toLocaleString()} assessed.`,
        metric: { label: 'Impaired Waterbodies', value: impaired },
        sources: ['attains'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateDam(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getDamAll } = require('./damCache');
    const dams = getDamAll();
    if (!dams || dams.length === 0) return findings;

    const highHazard = dams.filter((d: any) => d.hazardPotential === 'High' || d.hazardPotential === 'H');
    const poorCondition = highHazard.filter((d: any) =>
      d.conditionAssessment === 'Poor' || d.conditionAssessment === 'Unsatisfactory'
    );

    if (poorCondition.length > 0) {
      findings.push({
        id: mkId('dam'), severity: 'critical', category: 'take-action',
        title: `${poorCondition.length} high-hazard dam${poorCondition.length > 1 ? 's' : ''} in poor condition`,
        detail: `Dams classified as high-hazard with poor or unsatisfactory condition require immediate inspection and remediation planning.`,
        metric: { label: 'High-Hazard Poor Condition', value: poorCondition.length },
        sources: ['dam'],
      });
    }

    if (highHazard.length > 0 && poorCondition.length === 0) {
      findings.push({
        id: mkId('dam'), severity: 'info', category: 'monitor',
        title: `${highHazard.length} high-hazard dam${highHazard.length > 1 ? 's' : ''} tracked`,
        detail: `High-hazard potential dams are being monitored. No poor-condition assessments currently.`,
        metric: { label: 'High-Hazard Dams', value: highHazard.length },
        sources: ['dam'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateUsdm(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getUsdmAllStates } = require('./usdmCache');
    const states = getUsdmAllStates?.();
    if (!states || typeof states !== 'object') return findings;

    let totalD3Plus = 0;
    let totalD1Plus = 0;
    let stateCount = 0;

    for (const [, data] of Object.entries(states)) {
      const d = data as any;
      stateCount++;
      if (d.d3 != null) totalD3Plus += d.d3;
      if (d.d4 != null) totalD3Plus += d.d4;
      if (d.d1 != null) totalD1Plus += d.d1;
      if (d.d2 != null) totalD1Plus += d.d2;
      totalD1Plus += totalD3Plus;
    }

    if (totalD3Plus > 20) {
      findings.push({
        id: mkId('usdm'), severity: 'critical', category: 'take-action',
        title: `Extreme drought (D3+) affecting significant area`,
        detail: `US Drought Monitor shows extreme or exceptional drought conditions. Water conservation measures should be evaluated.`,
        metric: { label: 'D3+ Coverage', value: `${totalD3Plus}%` },
        sources: ['usdm'],
      });
    } else if (totalD1Plus > 40) {
      findings.push({
        id: mkId('usdm'), severity: 'warning', category: 'monitor',
        title: `Moderate drought (D1+) widespread`,
        detail: `Moderate to severe drought conditions are present across a significant area.`,
        metric: { label: 'D1+ Coverage', value: `${totalD1Plus}%` },
        sources: ['usdm'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateNwisIv(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getNwpsAllGauges } = require('./nwpsCache');
    const gauges = getNwpsAllGauges();
    if (!gauges || gauges.length === 0) return findings;

    const floodStage = gauges.filter((g: any) =>
      g.status === 'minor' || g.status === 'moderate' || g.status === 'major'
    );
    const majorFlood = gauges.filter((g: any) => g.status === 'major');

    if (floodStage.length > 3) {
      findings.push({
        id: mkId('nwisIv'), severity: 'critical', category: 'take-action',
        title: `${floodStage.length} river gauges at flood stage`,
        detail: `Multiple USGS stream gauges are reporting flood-level conditions${majorFlood.length > 0 ? ` (${majorFlood.length} at major flood stage)` : ''}.`,
        metric: { label: 'Flood Stage Gauges', value: floodStage.length },
        sources: ['nwisIv', 'nwps'],
      });
    } else if (floodStage.length > 0) {
      findings.push({
        id: mkId('nwisIv'), severity: 'warning', category: 'monitor',
        title: `${floodStage.length} gauge${floodStage.length > 1 ? 's' : ''} at flood stage`,
        detail: `Stream gauges reporting above-flood-stage conditions. Monitor for escalation.`,
        metric: { label: 'Flood Stage Gauges', value: floodStage.length },
        sources: ['nwisIv', 'nwps'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateFema(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getFemaDeclarationsAll } = require('./femaCache');
    const declarations = getFemaDeclarationsAll();
    if (!declarations || declarations.length === 0) return findings;

    // Count recent declarations (last 90 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const recent = declarations.filter((d: any) => {
      const dt = new Date(d.declarationDate || d.incidentBeginDate || '');
      return dt >= cutoff;
    });

    if (recent.length > 0) {
      findings.push({
        id: mkId('fema'), severity: 'critical', category: 'monitor',
        title: `${recent.length} active FEMA disaster declaration${recent.length > 1 ? 's' : ''} (last 90 days)`,
        detail: `Active federal disaster declarations may affect water infrastructure and operations.`,
        metric: { label: 'Active Declarations', value: recent.length },
        sources: ['fema'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateAirQuality(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getAirQualityAllData } = require('./airQualityCache');
    const data = getAirQualityAllData?.();
    if (!data) return findings;

    const readings = Array.isArray(data) ? data : data.readings ?? data.stations ?? [];
    const unhealthy = readings.filter((r: any) => (r.aqi ?? r.AQI ?? 0) > 150);
    const moderate = readings.filter((r: any) => {
      const aqi = r.aqi ?? r.AQI ?? 0;
      return aqi > 100 && aqi <= 150;
    });

    if (unhealthy.length > 0) {
      findings.push({
        id: mkId('airQuality'), severity: 'critical', category: 'take-action',
        title: `${unhealthy.length} area${unhealthy.length > 1 ? 's' : ''} with unhealthy air quality (AQI > 150)`,
        detail: `Air quality index exceeds unhealthy threshold. Sensitive groups and outdoor workers are at risk.`,
        metric: { label: 'Unhealthy AQI Areas', value: unhealthy.length },
        sources: ['airQuality'],
      });
    } else if (moderate.length > 0) {
      findings.push({
        id: mkId('airQuality'), severity: 'warning', category: 'monitor',
        title: `${moderate.length} area${moderate.length > 1 ? 's' : ''} with unhealthy-for-sensitive-groups AQI`,
        detail: `AQI between 100–150: unhealthy for sensitive groups. Monitor for deterioration.`,
        metric: { label: 'USG AQI Areas', value: moderate.length },
        sources: ['airQuality'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateEjscreen(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getEjscreenAllData } = require('./ejscreenCache');
    const data = getEjscreenAllData?.();
    if (!data) return findings;

    const entries = Array.isArray(data) ? data : data.records ?? [];
    const highEJ = entries.filter((e: any) =>
      (e.ejIndex ?? e.ej_percentile ?? 0) >= 80
    );

    if (highEJ.length > 0) {
      findings.push({
        id: mkId('ejscreen'), severity: 'warning', category: 'take-action',
        title: `${highEJ.length} area${highEJ.length > 1 ? 's' : ''} with high EJ vulnerability index`,
        detail: `EPA EJScreen identifies areas with elevated environmental justice indices. Prioritize these communities for compliance oversight.`,
        metric: { label: 'High EJ Areas', value: highEJ.length },
        sources: ['ejscreen'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateDodPfas(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getDodPfasAllSites } = require('./dodPfasCache');
    const sites = getDodPfasAllSites?.();
    if (!sites || sites.length === 0) return findings;

    const exceedance = sites.filter((s: any) =>
      s.exceedsDrinkingWaterStandard || s.exceedsMCL ||
      (s.pfosConcentration != null && s.pfosConcentration > 4) ||
      (s.pfoaConcentration != null && s.pfoaConcentration > 4)
    );

    if (exceedance.length > 0) {
      findings.push({
        id: mkId('dodPfas'), severity: 'critical', category: 'take-action',
        title: `${exceedance.length} DoD PFAS site${exceedance.length > 1 ? 's' : ''} exceeding drinking water standards`,
        detail: `Military installations with PFAS contamination above EPA drinking water advisory levels require remediation planning.`,
        metric: { label: 'PFAS Exceedances', value: exceedance.length },
        sources: ['dodPfas'],
      });
    } else if (sites.length > 0) {
      findings.push({
        id: mkId('dodPfas'), severity: 'info', category: 'monitor',
        title: `${sites.length} DoD PFAS investigation site${sites.length > 1 ? 's' : ''} tracked`,
        detail: `DoD PFAS investigation sites are being monitored. No current drinking water exceedances.`,
        metric: { label: 'PFAS Sites', value: sites.length },
        sources: ['dodPfas'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateWqp(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getWqpAllRecords } = require('./wqpCache');
    const records = getWqpAllRecords?.();
    if (!records || records.length === 0) return findings;

    findings.push({
      id: mkId('wqp'), severity: 'info', category: 'monitor',
      title: `${records.length.toLocaleString()} WQP monitoring records available`,
      detail: `Water Quality Portal data from EPA/USGS is available for trend analysis.`,
      metric: { label: 'WQP Records', value: records.length.toLocaleString() },
      sources: ['wqp'],
    });
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateNwsAlerts(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getNwsAlertAll } = require('./nwsAlertCache');
    const alerts = getNwsAlertAll?.();
    if (!alerts || alerts.length === 0) return findings;

    const waterRelated = alerts.filter((a: any) => {
      const event = (a.event || a.headline || '').toLowerCase();
      return event.includes('flood') || event.includes('water') ||
        event.includes('storm') || event.includes('surge') ||
        event.includes('hurricane') || event.includes('tornado');
    });

    if (waterRelated.length > 0) {
      findings.push({
        id: mkId('nwsAlerts'), severity: waterRelated.length > 5 ? 'critical' : 'warning', category: 'monitor',
        title: `${waterRelated.length} active NWS water-related alert${waterRelated.length > 1 ? 's' : ''}`,
        detail: `National Weather Service alerts related to flooding, storms, or other water hazards are active.`,
        metric: { label: 'Water Alerts', value: waterRelated.length },
        sources: ['nwsAlerts'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluatePfas(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getPfasAllResults } = require('./pfasCache');
    const results = getPfasAllResults();
    if (!results || results.length === 0) return findings;

    const detected = results.filter((r: any) => r.detected && r.resultValue > 0);

    if (detected.length > 0) {
      findings.push({
        id: mkId('pfas'), severity: 'warning', category: 'monitor',
        title: `${detected.length} PFAS detection${detected.length > 1 ? 's' : ''} in drinking water`,
        detail: `EPA UCMR data shows PFAS compounds detected in public water systems.`,
        metric: { label: 'PFAS Detections', value: detected.length },
        sources: ['pfas'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateIcis(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getIcisAllData } = require('./icisCache');
    const data = getIcisAllData();
    if (!data) return findings;

    const totalActions = data.enforcements?.length ?? data.actions?.length ?? 0;

    if (totalActions > 0) {
      findings.push({
        id: mkId('icis'), severity: totalActions > 10 ? 'warning' : 'info', category: 'monitor',
        title: `${totalActions} NPDES enforcement action${totalActions > 1 ? 's' : ''} tracked`,
        detail: `ICIS-NPDES enforcement actions are being tracked for NPDES-permitted facilities.`,
        metric: { label: 'Enforcement Actions', value: totalActions },
        sources: ['icis'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

function evaluateFirms(): StoryFinding[] {
  const findings: StoryFinding[] = [];
  try {
    const { getFirmsAllDetections } = require('./firmsCache');
    const detections = getFirmsAllDetections?.();
    if (!detections || detections.length === 0) return findings;

    const highConf = detections.filter((d: any) =>
      d.confidence === 'high' || d.confidence === 'h' || (d.confidence != null && d.confidence >= 80)
    );

    if (highConf.length > 0) {
      findings.push({
        id: mkId('firms'), severity: highConf.length > 10 ? 'critical' : 'warning', category: 'monitor',
        title: `${highConf.length} high-confidence fire detection${highConf.length > 1 ? 's' : ''} (NASA FIRMS)`,
        detail: `NASA satellite fire detections may impact air quality and water infrastructure.`,
        metric: { label: 'Fire Detections', value: highConf.length },
        sources: ['firms'],
      });
    }
  } catch { /* cache not loaded */ }
  return findings;
}

// ── Domain evaluator registry ────────────────────────────────────────────────

const EVALUATORS: Record<DomainKey, () => StoryFinding[]> = {
  sdwis: evaluateSdwis,
  echo: evaluateEcho,
  attains: evaluateAttains,
  dam: evaluateDam,
  usdm: evaluateUsdm,
  nwisIv: evaluateNwisIv,
  fema: evaluateFema,
  airQuality: evaluateAirQuality,
  ejscreen: evaluateEjscreen,
  dodPfas: evaluateDodPfas,
  wqp: evaluateWqp,
  nwsAlerts: evaluateNwsAlerts,
  pfas: evaluatePfas,
  icis: evaluateIcis,
  firms: evaluateFirms,
};

// ── Headline builder ─────────────────────────────────────────────────────────

function buildHeadline(lens: string, findings: StoryFinding[]): string {
  const critical = findings.filter(f => f.severity === 'critical');
  const warnings = findings.filter(f => f.severity === 'warning');

  if (critical.length > 0) {
    return critical[0].title;
  }
  if (warnings.length > 0) {
    return warnings[0].title;
  }
  if (findings.length > 0) {
    return findings[0].title;
  }
  return `No actionable findings for ${lens.replace(/-/g, ' ')}`;
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function generateLensStory(
  lens: string,
  role: string,
  state: string | null,
): Promise<LensStory> {
  _idCounter = 0;
  const domains = getDomainsForLens(lens);
  const allFindings: StoryFinding[] = [];
  const sourceSet = new Set<string>();

  for (const domain of domains) {
    const evaluator = EVALUATORS[domain];
    if (!evaluator) continue;
    const domainFindings = safeGet(evaluator, []);
    allFindings.push(...domainFindings);
    for (const f of domainFindings) {
      for (const s of f.sources) sourceSet.add(s);
    }
  }

  // For scorecard/overview, limit to top findings
  let findings = sortFindings(allFindings);
  if (lens === 'overview' || lens === 'briefing' || lens === 'political-briefing') {
    findings = findings.slice(0, 5);
  }

  // Build data source list
  const dataSources = [...sourceSet].map(name => cacheSource(name));

  return {
    lens,
    role,
    state,
    headline: buildHeadline(lens, findings),
    findings,
    dataSources,
    generatedAt: new Date().toISOString(),
  };
}
