// lib/national-summary.ts
// Single source of truth for national water quality statistics.
// Aggregates from existing server-side caches with a 30-min in-memory TTL.

import { getAttainsCacheSummary, type StateSummary } from './attainsCache';
import { getUsgsIvCacheStatus } from './nwisIvCache';
import { getAllStateFlowScores, type FlowScore } from './flowVulnerability';
import { getAlertCacheStatus } from './usgsAlertCache';
import { getNwpsCacheStatus } from './nwpsCache';
import { getNwpsAllGauges } from './nwpsCache';
import { getCoopsCacheStatus } from './coopsCache';
import { getNdbcCacheStatus } from './ndbcCache';
import { getSnotelCacheStatus } from './snotelCache';
import { getCdcNwssCacheStatus } from './cdcNwssCache';
import { getEchoCacheStatus, getEchoAllData } from './echoCache';
import { getPfasCacheStatus, getPfasAllResults } from './pfasCache';
import { getTriCacheStatus } from './triCache';
import { getUsaceCacheStatus } from './usaceCache';
import { getBwbCacheStatus } from './bwbCache';
import { getNasaCmrCacheStatus } from './nasaCmrCache';
import { getNarsCacheStatus } from './narsCache';
import { getDataGovCacheStatus } from './dataGovCache';
import { getStateIRCacheStatus } from './stateIRCache';
import { getFrsCacheStatus } from './frsCache';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NationalSummary {
  generatedAt: string;
  statesReporting: number;
  totalWaterbodies: number;
  totalImpaired: number;
  totalHealthy: number;
  tmdlGap: number;
  tmdlCompleted: number;
  tmdlAlternative: number;
  averageScore: number;
  highAlertStates: number;
  realtimeSites: number;
  activeAlerts: number;
  criticalAlerts: number;
  topCauses: { cause: string; count: number }[];
  worstStates: { abbr: string; score: number; impaired: number }[];
  flowScores?: Record<string, FlowScore>;
  stateBreakdown: Record<string, {
    total: number;
    impaired: number;
    score: number;
    grade: string;
    flowScore?: number;
  }>;
  dataSources?: {
    nwpsGauges: number;
    nwpsFlooding: number;
    coopsStations: number;
    ndbcBuoys: number;
    snotelStations: number;
    cdcNwssStates: number;
    echoFacilities: number;
    echoViolations: number;
    pfasDetections: number;
    triFacilities: number;
    usaceLocations: number;
    bwbStations: number;
    nasaCmrCollections: number;
    narsSites: number;
    dataGovDatasets: number;
    stateIRsConfirmed: number;
    frsFacilities: number;
    totalDataPoints: number;
  };
}

// ── Scoring ──────────────────────────────────────────────────────────────────

const LEVEL_SCORE: Record<string, number> = { none: 100, low: 85, medium: 65, high: 40 };

function computeStateScore(s: Omit<StateSummary, 'waterbodies'>): number {
  const denom = s.none + s.low + s.medium + s.high;
  if (denom === 0) return -1;
  return Math.round(
    (s.none * LEVEL_SCORE.none + s.low * LEVEL_SCORE.low +
     s.medium * LEVEL_SCORE.medium + s.high * LEVEL_SCORE.high) / denom
  );
}

function scoreToGrade(score: number): string {
  if (score < 0) return 'N/A';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ── Cache ────────────────────────────────────────────────────────────────────

const TTL_MS = 30 * 60 * 1000; // 30 min
let _cached: NationalSummary | null = null;
let _cachedAt = 0;

export function getNationalSummary(): NationalSummary {
  const now = Date.now();
  if (_cached && now - _cachedAt < TTL_MS) return _cached;

  const attains = getAttainsCacheSummary();
  const nwisIv = getUsgsIvCacheStatus();
  const alerts = getAlertCacheStatus();

  const states = attains.states;
  const stateEntries = Object.entries(states);

  // Aggregation accumulators
  let totalWaterbodies = 0;
  let totalImpaired = 0;
  let totalHealthy = 0;
  let tmdlGap = 0;
  let tmdlCompleted = 0;
  let tmdlAlternative = 0;
  let highAlertStates = 0;
  let weightedScoreSum = 0;
  let weightedScoreDenom = 0;

  const causeFreq = new Map<string, number>();
  const stateScores: { abbr: string; score: number; impaired: number }[] = [];
  const stateBreakdown: NationalSummary['stateBreakdown'] = {};

  // Flow vulnerability scores (NWIS IV discharge data)
  const flowScores = getAllStateFlowScores();

  for (const [abbr, s] of stateEntries) {
    totalWaterbodies += s.total;
    const impaired = s.high + s.medium + s.low;
    totalImpaired += impaired;
    totalHealthy += s.none;
    tmdlGap += s.tmdlNeeded;
    tmdlCompleted += s.tmdlCompleted;
    tmdlAlternative += s.tmdlAlternative;

    if (s.high > 0) highAlertStates++;

    const attainsScore = computeStateScore(s);
    const flow = flowScores[abbr];
    const score = (attainsScore >= 0 && flow)
      ? Math.round(attainsScore * 0.85 + flow.score * 0.15)
      : attainsScore;
    const denom = s.none + s.low + s.medium + s.high;
    if (score >= 0 && denom > 0) {
      weightedScoreSum += score * denom;
      weightedScoreDenom += denom;
      stateScores.push({ abbr, score, impaired });
    }

    stateBreakdown[abbr] = {
      total: s.total,
      impaired,
      score,
      grade: scoreToGrade(score),
      flowScore: flow?.score,
    };

    // Merge top causes
    if (s.topCauses) {
      for (const cause of s.topCauses) {
        causeFreq.set(cause, (causeFreq.get(cause) || 0) + 1);
      }
    }
  }

  // Weighted national average score
  const averageScore = weightedScoreDenom > 0
    ? Math.round(weightedScoreSum / weightedScoreDenom)
    : -1;

  // Top 15 causes by frequency
  const topCauses = [...causeFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([cause, count]) => ({ cause, count }));

  // Bottom 10 states by score
  const worstStates = [...stateScores]
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);

  // Real-time monitoring stats
  const realtimeSites = nwisIv.loaded ? (nwisIv as any).siteCount || 0 : 0;
  const activeAlerts = alerts.loaded ? (alerts as any).alertCount || 0 : 0;
  const criticalAlerts = alerts.loaded ? (alerts as any).criticalCount || 0 : 0;

  // Data source counts from all 15 caches
  const nwpsStatus = getNwpsCacheStatus();
  const coopsStatus = getCoopsCacheStatus();
  const ndbcStatus = getNdbcCacheStatus();
  const snotelStatus = getSnotelCacheStatus();
  const cdcNwssStatus = getCdcNwssCacheStatus();
  const echoStatus = getEchoCacheStatus();
  const pfasStatus = getPfasCacheStatus();
  const triStatus = getTriCacheStatus();
  const usaceStatus = getUsaceCacheStatus();
  const bwbStatus = getBwbCacheStatus();
  const nasaCmrStatus = getNasaCmrCacheStatus();
  const narsStatus = getNarsCacheStatus();
  const dataGovStatus = getDataGovCacheStatus();
  const stateIrStatus = getStateIRCacheStatus();
  const frsStatus = getFrsCacheStatus();

  const nwpsGauges = nwpsStatus.loaded ? (nwpsStatus as any).gaugeCount || 0 : 0;
  const nwpsFlooding = getNwpsAllGauges().filter(g => g.status === 'minor' || g.status === 'moderate' || g.status === 'major').length;
  const coopsStations = coopsStatus.loaded ? (coopsStatus as any).stationCount || 0 : 0;
  const ndbcBuoys = ndbcStatus.loaded ? (ndbcStatus as any).stationCount || 0 : 0;
  const snotelStations = snotelStatus.loaded ? (snotelStatus as any).stationCount || 0 : 0;
  const cdcNwssStates = cdcNwssStatus.loaded ? (cdcNwssStatus as any).stateCount || 0 : 0;
  const echoFacilities = echoStatus.loaded ? (echoStatus as any).facilityCount || 0 : 0;
  const echoViolations = echoStatus.loaded ? (echoStatus as any).violationCount || 0 : 0;
  const pfasDetections = pfasStatus.loaded ? (pfasStatus as any).resultCount || 0 : 0;
  const triFacilities = triStatus.loaded ? (triStatus as any).facilityCount || 0 : 0;
  const usaceLocations = usaceStatus.loaded ? (usaceStatus as any).locationCount || 0 : 0;
  const bwbStations = bwbStatus.loaded ? (bwbStatus as any).stationCount || 0 : 0;
  const nasaCmrCollections = nasaCmrStatus.loaded ? (nasaCmrStatus as any).collectionCount || 0 : 0;
  const narsSites = narsStatus.loaded ? (narsStatus as any).siteCount || 0 : 0;
  const dataGovDatasets = dataGovStatus.loaded ? (dataGovStatus as any).datasetCount || 0 : 0;
  const stateIRsConfirmed = stateIrStatus.loaded ? (stateIrStatus as any).confirmedStates || 0 : 0;
  const frsFacilities = frsStatus.loaded ? (frsStatus as any).facilityCount || 0 : 0;

  const totalDataPoints = nwpsGauges + coopsStations + ndbcBuoys + snotelStations +
    echoFacilities + pfasDetections + triFacilities + usaceLocations + bwbStations +
    nasaCmrCollections + narsSites + dataGovDatasets + frsFacilities;

  _cached = {
    generatedAt: new Date().toISOString(),
    statesReporting: stateEntries.length,
    totalWaterbodies,
    totalImpaired,
    totalHealthy,
    tmdlGap,
    tmdlCompleted,
    tmdlAlternative,
    averageScore,
    highAlertStates,
    realtimeSites,
    activeAlerts,
    criticalAlerts,
    topCauses,
    worstStates,
    stateBreakdown,
    flowScores: Object.keys(flowScores).length > 0 ? flowScores : undefined,
    dataSources: {
      nwpsGauges, nwpsFlooding, coopsStations, ndbcBuoys, snotelStations,
      cdcNwssStates, echoFacilities, echoViolations, pfasDetections,
      triFacilities, usaceLocations, bwbStations, nasaCmrCollections,
      narsSites, dataGovDatasets, stateIRsConfirmed, frsFacilities, totalDataPoints,
    },
  };
  _cachedAt = now;

  return _cached;
}
