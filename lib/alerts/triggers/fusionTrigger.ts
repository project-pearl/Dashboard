/* ------------------------------------------------------------------ */
/*  PIN Alerts — Fusion Cross-Source Anomaly Detection Trigger        */
/*                                                                    */
/*  Cross-correlates data from multiple federal caches to detect      */
/*  multi-source convergence patterns that no single adapter catches. */
/*                                                                    */
/*  Patterns:                                                         */
/*    1. Compliance Cascade    — ICIS + ECHO + SDWIS convergence      */
/*    2. Contamination Conv.   — PFAS + Superfund + TRI co-location   */
/*    3. Weather × Water Qual. — NWS floods + USGS IV spikes         */
/*    4. Infrastructure Stress — expired permits + violations + gaps  */
/*    5. Pathogen Convergence  — NWSS + HAB + USGS bacteria           */
/*                                                                    */
/*  Cooldown: 24 hours per state+pattern.                             */
/* ------------------------------------------------------------------ */

import type { AlertEvent } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { ALL_STATES } from '../../constants';

/* -- Cache warm + data access ---------------------------------------- */
import { ensureWarmed as warmIcis, getIcisAllData } from '../../icisCache';
import type { IcisViolation, IcisPermit, IcisInspection, IcisEnforcement } from '../../icisCache';

import { ensureWarmed as warmEcho, getEchoAllData } from '../../echoCache';
import type { EchoViolation } from '../../echoCache';

import { ensureWarmed as warmSdwis, getSdwisAllData } from '../../sdwisCache';
import type { SdwisViolation } from '../../sdwisCache';

import { ensureWarmed as warmPfas, getPfasAllResults } from '../../pfasCache';
import type { PfasResult } from '../../pfasCache';

import { ensureWarmed as warmSuperfund, getSuperfundSitesAll } from '../../superfundCache';
import type { SuperfundSite } from '../../superfundCache';

import { ensureWarmed as warmTri, getTriAllFacilities } from '../../triCache';
import type { TriFacility } from '../../triCache';

import { ensureWarmed as warmNws, getNwsAlertsByState } from '../../nwsAlertCache';

import { ensureWarmed as warmNwisIv, getUsgsIvByState } from '../../nwisIvCache';
import type { UsgsIvReading } from '../../nwisIvCache';

import { ensureWarmed as warmNwss, getNwssAnomalies } from '../../nwss/nwssCache';
import type { NWSSAnomaly } from '../../nwss/types';

import { ensureWarmed as warmHab, getHabsosAll } from '../../habsosCache';
import type { HabObservation } from '../../habsosCache';

/* ------------------------------------------------------------------ */
/*  Snapshot — tracks cooldowns per state+pattern                     */
/* ------------------------------------------------------------------ */

interface FusionSnapshot {
  /** "pattern|state" → last alert ISO timestamp */
  lastAlertedAt: Record<string, string>;
  takenAt: string;
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/* ------------------------------------------------------------------ */
/*  USGS IV spike thresholds                                          */
/* ------------------------------------------------------------------ */

const IV_SPIKE_THRESHOLDS: Record<string, number> = {
  '63680': 100,   // Turbidity > 100 NTU
  '00095': 2500,  // Conductivity > 2500 µS/cm
};

/* ------------------------------------------------------------------ */
/*  NWS flood-related event keywords                                  */
/* ------------------------------------------------------------------ */

const FLOOD_EVENT_KEYWORDS = [
  'flood warning', 'flash flood', 'flood watch', 'river flood',
  'coastal flood', 'flood advisory', 'flood statement',
];

function isFloodAlert(event: string): boolean {
  const lower = event.toLowerCase();
  return FLOOD_EVENT_KEYWORDS.some(kw => lower.includes(kw));
}

/* ------------------------------------------------------------------ */
/*  State-keyed data index (built once per evaluation)                */
/* ------------------------------------------------------------------ */

interface StateData {
  icisViolations: IcisViolation[];
  icisPermits: IcisPermit[];
  icisInspections: IcisInspection[];
  icisEnforcement: IcisEnforcement[];
  echoViolations: EchoViolation[];
  sdwisViolations: SdwisViolation[];
  pfasDetections: PfasResult[];
  superfundSites: SuperfundSite[];
  triFacilities: TriFacility[];
  nwssAnomalies: NWSSAnomaly[];
  habObservations: HabObservation[];
}

function groupByState<T>(items: T[], stateKey: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const st = stateKey(item);
    if (!st) continue;
    const arr = map.get(st);
    if (arr) arr.push(item);
    else map.set(st, [item]);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  Main Entry Point                                                  */
/* ------------------------------------------------------------------ */

export async function evaluateFusionAlerts(): Promise<AlertEvent[]> {
  // 1. Warm all caches in parallel
  await Promise.allSettled([
    warmIcis(), warmEcho(), warmSdwis(), warmPfas(),
    warmSuperfund(), warmTri(), warmNws(), warmNwisIv(),
    warmNwss(), warmHab(),
  ]);

  // 2. Pull all data and index by state
  const icis = getIcisAllData();
  const echo = getEchoAllData();
  const sdwis = getSdwisAllData();
  const pfasAll = getPfasAllResults();
  const superfundAll = getSuperfundSitesAll();
  const triAll = getTriAllFacilities();
  const nwsByState = getNwsAlertsByState();
  const nwssAnomalies = getNwssAnomalies();
  const habAll = getHabsosAll();

  // Build permit→state map (ICIS violations reference permits, not states directly)
  const permitStateMap = new Map<string, string>();
  for (const p of icis.permits) {
    if (p.state) permitStateMap.set(p.permit, p.state);
  }

  // Group flat arrays by state
  const icisViolsByState = groupByState(icis.violations, v => permitStateMap.get(v.permit) ?? '');
  const icisPermitsByState = groupByState(icis.permits, p => p.state);
  const icisInspByState = groupByState(icis.inspections, i => {
    return permitStateMap.get(i.permit) ?? '';
  });
  const icisEnfByState = groupByState(icis.enforcement, e => {
    return permitStateMap.get(e.permit) ?? '';
  });

  const echoViolsByState = groupByState(echo.violations, v => v.state);

  // Build pwsid→state map (SDWIS violations reference systems, not states directly)
  const pwsidStateMap = new Map<string, string>();
  for (const sys of sdwis.systems) {
    if (sys.state) pwsidStateMap.set(sys.pwsid, sys.state);
  }
  const sdwisViolsByState = groupByState(sdwis.violations, v => pwsidStateMap.get(v.pwsid) ?? '');

  const pfasByState = groupByState(pfasAll, p => p.state);
  const superfundByState = groupByState(superfundAll, s => s.stateAbbr);
  const triByState = groupByState(triAll, t => t.state);
  const nwssByState = groupByState(nwssAnomalies, a => a.jurisdiction);
  const habByState = groupByState(habAll, h => h.state);

  // 3. Load cooldown snapshot
  const prevSnapshot = await loadCacheFromBlob<FusionSnapshot>(BLOB_PATHS.fusionSnapshot);
  const prevAlerted = prevSnapshot?.lastAlertedAt ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const newAlerted: Record<string, string> = { ...prevAlerted };

  // 4. Run detection patterns across all states
  const events: AlertEvent[] = [];

  for (const state of ALL_STATES) {
    const stateData: StateData = {
      icisViolations: icisViolsByState.get(state) ?? [],
      icisPermits: icisPermitsByState.get(state) ?? [],
      icisInspections: icisInspByState.get(state) ?? [],
      icisEnforcement: icisEnfByState.get(state) ?? [],
      echoViolations: echoViolsByState.get(state) ?? [],
      sdwisViolations: sdwisViolsByState.get(state) ?? [],
      pfasDetections: (pfasByState.get(state) ?? []).filter(p => p.detected),
      superfundSites: superfundByState.get(state) ?? [],
      triFacilities: triByState.get(state) ?? [],
      nwssAnomalies: nwssByState.get(state) ?? [],
      habObservations: habByState.get(state) ?? [],
    };

    // NWS alerts and USGS IV are accessed via their own by-state APIs
    const nwsAlerts = nwsByState.get(state) ?? [];
    const usgsReadings = getUsgsIvByState(state);

    // Pattern 1: Compliance Cascade
    const p1 = detectComplianceCascade(state, stateData);
    if (p1 && !inCooldown('compliance_cascade', state, prevAlerted, now)) {
      events.push(p1);
      newAlerted[`compliance_cascade|${state}`] = nowIso;
    }

    // Pattern 2: Contamination Convergence
    const p2 = detectContaminationConvergence(state, stateData);
    if (p2 && !inCooldown('contamination_convergence', state, prevAlerted, now)) {
      events.push(p2);
      newAlerted[`contamination_convergence|${state}`] = nowIso;
    }

    // Pattern 3: Weather × Water Quality
    const p3 = detectWeatherWaterQuality(state, nwsAlerts, usgsReadings);
    if (p3 && !inCooldown('weather_water_quality', state, prevAlerted, now)) {
      events.push(p3);
      newAlerted[`weather_water_quality|${state}`] = nowIso;
    }

    // Pattern 4: Infrastructure Stress
    const p4 = detectInfrastructureStress(state, stateData);
    if (p4 && !inCooldown('infrastructure_stress', state, prevAlerted, now)) {
      events.push(p4);
      newAlerted[`infrastructure_stress|${state}`] = nowIso;
    }

    // Pattern 5: Pathogen Convergence
    const p5 = detectPathogenConvergence(state, stateData, usgsReadings);
    if (p5 && !inCooldown('pathogen_convergence', state, prevAlerted, now)) {
      events.push(p5);
      newAlerted[`pathogen_convergence|${state}`] = nowIso;
    }
  }

  // 5. Save updated cooldown snapshot
  await saveCacheToBlob(BLOB_PATHS.fusionSnapshot, {
    lastAlertedAt: newAlerted,
    takenAt: nowIso,
  });

  return events;
}

/* ------------------------------------------------------------------ */
/*  Cooldown Helper                                                   */
/* ------------------------------------------------------------------ */

function inCooldown(
  pattern: string,
  state: string,
  prevAlerted: Record<string, string>,
  now: Date,
): boolean {
  const key = `${pattern}|${state}`;
  const lastAlerted = prevAlerted[key];
  if (!lastAlerted) return false;
  return (now.getTime() - new Date(lastAlerted).getTime()) < COOLDOWN_MS;
}

/* ------------------------------------------------------------------ */
/*  Pattern 1: Compliance Cascade                                     */
/*  ICIS violations + ECHO enforcement/SNC + SDWIS violations         */
/* ------------------------------------------------------------------ */

function detectComplianceCascade(state: string, data: StateData): AlertEvent | null {
  const rncViolations = data.icisViolations.filter(v => v.rnc);
  const sncFacilities = data.echoViolations.filter(v => v.qtrsInNc >= 2);
  const healthViolations = data.sdwisViolations.filter(v => v.isHealthBased);

  const hasIcisRnc = rncViolations.length > 0;
  const hasEchoSnc = sncFacilities.length > 0;
  const hasSdwisHealth = healthViolations.length > 0;

  const sourceCount = [hasIcisRnc, hasEchoSnc, hasSdwisHealth].filter(Boolean).length;
  if (sourceCount < 2) return null;

  const severity = sourceCount === 3 ? 'critical' : 'warning';
  const sources: string[] = [];
  if (hasIcisRnc) sources.push(`${rncViolations.length} ICIS RNC violations`);
  if (hasEchoSnc) sources.push(`${sncFacilities.length} ECHO SNC facilities`);
  if (hasSdwisHealth) sources.push(`${healthViolations.length} SDWIS health-based violations`);

  return {
    id: crypto.randomUUID(),
    type: 'fusion',
    severity,
    title: `Compliance cascade ${severity === 'critical' ? 'crisis' : 'alert'} — ${state}`,
    body: `Multi-source compliance convergence detected in ${state}: ${sources.join(', ')}. ` +
      `${sourceCount} independent federal data sources show concurrent violations.`,
    entityId: state,
    entityLabel: `${state} — Compliance Cascade`,
    dedupKey: `fusion|compliance_cascade|${state}|${severity}`,
    createdAt: new Date().toISOString(),
    channel: 'email',
    recipientEmail: '',
    sent: false,
    sentAt: null,
    error: null,
    ruleId: null,
    metadata: {
      pattern: 'compliance_cascade',
      convergingSources: sourceCount,
      icisRncCount: rncViolations.length,
      echoSncCount: sncFacilities.length,
      sdwisHealthCount: healthViolations.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Pattern 2: Contamination Convergence                              */
/*  PFAS detections + Superfund NPL + TRI carcinogen releases         */
/* ------------------------------------------------------------------ */

function detectContaminationConvergence(state: string, data: StateData): AlertEvent | null {
  const pfasHits = data.pfasDetections;
  const nplSites = data.superfundSites.filter(s =>
    s.status?.toLowerCase().includes('npl') ||
    s.status?.toLowerCase().includes('final') ||
    s.status?.toLowerCase().includes('proposed')
  );
  const triCarcinogen = data.triFacilities.filter(t => t.carcinogenReleases > 0);

  const hasPfas = pfasHits.length > 0;
  const hasNpl = nplSites.length > 0;
  const hasTriCarcinogen = triCarcinogen.length > 0;

  const sourceCount = [hasPfas, hasNpl, hasTriCarcinogen].filter(Boolean).length;
  if (sourceCount < 2) return null;

  const severity = sourceCount === 3 ? 'critical' : 'warning';
  const sources: string[] = [];
  if (hasPfas) sources.push(`${pfasHits.length} PFAS detections`);
  if (hasNpl) sources.push(`${nplSites.length} Superfund NPL sites`);
  if (hasTriCarcinogen) sources.push(`${triCarcinogen.length} TRI carcinogen facilities`);

  return {
    id: crypto.randomUUID(),
    type: 'fusion',
    severity,
    title: `Contamination convergence ${severity === 'critical' ? 'crisis' : 'alert'} — ${state}`,
    body: `Multi-source contamination pattern in ${state}: ${sources.join(', ')}. ` +
      `Co-located environmental contamination signals from ${sourceCount} federal databases.`,
    entityId: state,
    entityLabel: `${state} — Contamination Convergence`,
    dedupKey: `fusion|contamination_convergence|${state}|${severity}`,
    createdAt: new Date().toISOString(),
    channel: 'email',
    recipientEmail: '',
    sent: false,
    sentAt: null,
    error: null,
    ruleId: null,
    metadata: {
      pattern: 'contamination_convergence',
      convergingSources: sourceCount,
      pfasCount: pfasHits.length,
      nplCount: nplSites.length,
      triCarcinogenCount: triCarcinogen.length,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Pattern 3: Weather × Water Quality                                */
/*  NWS flood alerts + USGS IV turbidity/conductivity spikes          */
/* ------------------------------------------------------------------ */

function detectWeatherWaterQuality(
  state: string,
  nwsAlerts: { event: string; severity: string }[],
  usgsReadings: UsgsIvReading[],
): AlertEvent | null {
  const floodAlerts = nwsAlerts.filter(a => isFloodAlert(a.event));
  if (floodAlerts.length === 0) return null;

  // Check for USGS IV parameter spikes
  const spikes = usgsReadings.filter(r => {
    const threshold = IV_SPIKE_THRESHOLDS[r.parameterCd];
    return threshold != null && r.value > threshold;
  });
  if (spikes.length === 0) return null;

  const hasExtreme = floodAlerts.some(a => a.severity === 'Extreme');
  const hasSevere = floodAlerts.some(a => a.severity === 'Severe');
  const multiSpikes = spikes.length >= 3;

  let severity: 'critical' | 'warning';
  if (hasExtreme && multiSpikes) severity = 'critical';
  else if (hasExtreme || (hasSevere && multiSpikes)) severity = 'critical';
  else severity = 'warning';

  const spikeParams = [...new Set(spikes.map(s => s.parameterName || s.parameterCd))];

  return {
    id: crypto.randomUUID(),
    type: 'fusion',
    severity,
    title: `Weather × water quality ${severity === 'critical' ? 'crisis' : 'alert'} — ${state}`,
    body: `Flood conditions coinciding with water quality anomalies in ${state}: ` +
      `${floodAlerts.length} flood alert(s) + ${spikes.length} USGS parameter spike(s) (${spikeParams.join(', ')}). ` +
      `Converging weather and sensor data suggest active contamination risk.`,
    entityId: state,
    entityLabel: `${state} — Weather × Water Quality`,
    dedupKey: `fusion|weather_water_quality|${state}|${severity}`,
    createdAt: new Date().toISOString(),
    channel: 'email',
    recipientEmail: '',
    sent: false,
    sentAt: null,
    error: null,
    ruleId: null,
    metadata: {
      pattern: 'weather_water_quality',
      floodAlertCount: floodAlerts.length,
      maxFloodSeverity: hasExtreme ? 'Extreme' : hasSevere ? 'Severe' : 'Moderate',
      spikeCount: spikes.length,
      spikeParameters: spikeParams,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Pattern 4: Infrastructure Stress                                  */
/*  Expired permits + active violations + inspection gaps             */
/* ------------------------------------------------------------------ */

const INSPECTION_GAP_DAYS = 180;
const EXPIRED_PERMIT_THRESHOLD = 3;
const UNINSPECTED_THRESHOLD = 5;

function detectInfrastructureStress(state: string, data: StateData): AlertEvent | null {
  // Expired or expiring permits
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const expiredPermits = data.icisPermits.filter(p => {
    if (p.status?.toLowerCase() === 'expired') return true;
    if (!p.expiration) return false;
    const expDate = new Date(p.expiration).getTime();
    return !isNaN(expDate) && expDate < now + thirtyDaysMs;
  });

  if (expiredPermits.length < EXPIRED_PERMIT_THRESHOLD) return null;

  // Active violations across SDWIS + ICIS
  const totalViolations = data.icisViolations.length + data.sdwisViolations.length;
  if (totalViolations === 0) return null;

  // Facilities with no inspection in the last 180 days
  const inspectionCutoff = now - INSPECTION_GAP_DAYS * 24 * 60 * 60 * 1000;
  const recentlyInspected = new Set<string>();
  for (const insp of data.icisInspections) {
    const inspDate = new Date(insp.date).getTime();
    if (!isNaN(inspDate) && inspDate > inspectionCutoff) {
      recentlyInspected.add(insp.permit);
    }
  }
  const allPermitIds = new Set(data.icisPermits.map(p => p.permit));
  const uninspected = [...allPermitIds].filter(id => !recentlyInspected.has(id));

  if (uninspected.length < UNINSPECTED_THRESHOLD) return null;

  return {
    id: crypto.randomUUID(),
    type: 'fusion',
    severity: 'warning',
    title: `Infrastructure stress alert — ${state}`,
    body: `Administrative risk pattern in ${state}: ${expiredPermits.length} expired/expiring permits, ` +
      `${totalViolations} active violations (ICIS + SDWIS), and ${uninspected.length} facilities ` +
      `with no inspection in ${INSPECTION_GAP_DAYS} days.`,
    entityId: state,
    entityLabel: `${state} — Infrastructure Stress`,
    dedupKey: `fusion|infrastructure_stress|${state}|warning`,
    createdAt: new Date().toISOString(),
    channel: 'email',
    recipientEmail: '',
    sent: false,
    sentAt: null,
    error: null,
    ruleId: null,
    metadata: {
      pattern: 'infrastructure_stress',
      expiredPermitCount: expiredPermits.length,
      totalViolationCount: totalViolations,
      uninspectedFacilityCount: uninspected.length,
      inspectionGapDays: INSPECTION_GAP_DAYS,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Pattern 5: Pathogen Convergence                                   */
/*  NWSS wastewater anomalies + HAB observations + USGS bacteria      */
/* ------------------------------------------------------------------ */

/** USGS parameter codes that indicate bacterial contamination */
const BACTERIA_PARAM_CDS = new Set([
  '31625',  // Fecal coliform
  '31648',  // E. coli
  '61199',  // Total coliform
  '50468',  // Enterococci
]);

function detectPathogenConvergence(
  state: string,
  data: StateData,
  usgsReadings: UsgsIvReading[],
): AlertEvent | null {
  // NWSS anomalies with sigma >= 3.0 (significant)
  const significantAnomalies = data.nwssAnomalies.filter(a => a.sigma >= 3.0);
  if (significantAnomalies.length === 0) return null;

  // Supporting signals: HAB observations or elevated bacteria readings
  const habObs = data.habObservations.filter(h => h.cellCount > 0);
  const bacteriaReadings = usgsReadings.filter(r => BACTERIA_PARAM_CDS.has(r.parameterCd));

  const hasHab = habObs.length > 0;
  const hasBacteria = bacteriaReadings.length > 0;

  if (!hasHab && !hasBacteria) return null;

  const maxSigma = Math.max(...significantAnomalies.map(a => a.sigma));
  const severity = maxSigma >= 4.0 || (hasHab && hasBacteria) ? 'critical' : 'warning';

  const pathogens = [...new Set(significantAnomalies.map(a => a.pathogen))];
  const sources: string[] = [`${significantAnomalies.length} NWSS anomalies (${pathogens.join(', ')})`];
  if (hasHab) sources.push(`${habObs.length} HAB observations`);
  if (hasBacteria) sources.push(`${bacteriaReadings.length} USGS bacteria readings`);

  return {
    id: crypto.randomUUID(),
    type: 'fusion',
    severity,
    title: `Pathogen convergence ${severity === 'critical' ? 'crisis' : 'alert'} — ${state}`,
    body: `Public health threat in ${state}: ${sources.join(' + ')}. ` +
      `Multiple pathogen indicators converging — wastewater surveillance, ` +
      `${hasHab ? 'algal blooms, ' : ''}${hasBacteria ? 'bacterial readings, ' : ''}` +
      `max sigma deviation ${maxSigma.toFixed(1)}.`,
    entityId: state,
    entityLabel: `${state} — Pathogen Convergence`,
    dedupKey: `fusion|pathogen_convergence|${state}|${severity}`,
    createdAt: new Date().toISOString(),
    channel: 'email',
    recipientEmail: '',
    sent: false,
    sentAt: null,
    error: null,
    ruleId: null,
    metadata: {
      pattern: 'pathogen_convergence',
      nwssAnomalyCount: significantAnomalies.length,
      maxSigma,
      pathogens,
      habCount: habObs.length,
      bacteriaReadingCount: bacteriaReadings.length,
    },
  };
}
