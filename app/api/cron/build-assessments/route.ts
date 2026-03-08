/**
 * Build Assessments Cron — daily snapshot + comprehensive assessment builder.
 *
 * 1. Warms all source caches (ATTAINS, ICIS, SDWIS, ECHO, PFAS, signals, NWIS-GW, state reports)
 * 2. Compiles today's DailyStateSnapshot for each state from source caches
 * 3. Appends snapshots to the rolling 365-day snapshot cache
 * 4. Runs comprehensiveAssessment for all states
 * 5. Persists assessments to disk + blob
 *
 * Schedule: daily at 18:30 UTC (after all other caches are built)
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { ALL_STATES } from '@/lib/constants';
import type { DailyStateSnapshot } from '@/lib/analytics/types';
import type { ComprehensiveAssessment } from '@/lib/analytics/types';

// Source caches
import { ensureWarmed as warmAttains, getAttainsCacheSummary } from '@/lib/attainsCache';
import { ensureWarmed as warmIcis, getIcisAllData } from '@/lib/icisCache';
import { ensureWarmed as warmSdwis, getSdwisForState } from '@/lib/sdwisCache';
import { ensureWarmed as warmEcho, getEchoAllData } from '@/lib/echoCache';
import { ensureWarmed as warmPfas, getPfasAllResults } from '@/lib/pfasCache';
import { ensureWarmed as warmSignals, getArchivedSignals } from '@/lib/signalArchiveCache';
import { ensureWarmed as warmNwisGw, getNwisGwAllTrends, getNwisGwAllSites } from '@/lib/nwisGwCache';
import { ensureWarmed as warmStateReports, getStateReport } from '@/lib/stateReportCache';

// Snapshot + assessment
import {
  ensureWarmed as warmSnapshots,
  appendSnapshot,
  saveSnapshotCache,
  getAllSnapshots,
} from '@/lib/analytics/stateSnapshotCache';
import { buildAllAssessments } from '@/lib/analytics/comprehensiveAssessment';
import { saveCacheToBlob } from '@/lib/blobPersistence';
import { saveCacheToDisk } from '@/lib/cacheUtils';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Assessment Cache (simple in-memory + disk + blob) ────────────────────────

const ASSESSMENT_BLOB_PATH = 'cache/assessments.json';
const ASSESSMENT_DISK_FILE = 'assessments.json';

// ── Snapshot Compilation ─────────────────────────────────────────────────────

/**
 * Compile today's snapshot for a single state from warmed source caches.
 * No API calls — reads only from in-memory caches.
 */
function compileSnapshot(
  state: string,
  today: string,
  precomputed: {
    attainsSummary: ReturnType<typeof getAttainsCacheSummary>;
    icisPermitStateMap: Map<string, string>;
    icisViolations: { permit: string }[];
    echoViolationsByState: Map<string, number>;
    pfasByState: Map<string, number>;
    gwFallingByState: Map<string, number>;
  },
): DailyStateSnapshot {
  // ATTAINS: impairment data
  const attainsState = precomputed.attainsSummary?.states?.[state];
  const totalAssessed = attainsState
    ? attainsState.high + attainsState.medium + attainsState.low + attainsState.none
    : 0;
  const impairedWaterbodies = attainsState ? attainsState.high + attainsState.medium : 0;
  const impairmentPct = totalAssessed > 0 ? (impairedWaterbodies / totalAssessed) * 100 : 0;

  // ICIS: violation count for this state (join via permit→state map)
  let violationCount = 0;
  for (const v of precomputed.icisViolations) {
    if (precomputed.icisPermitStateMap.get(v.permit) === state) {
      violationCount++;
    }
  }

  // SDWIS: enforcement for this state
  const sdwisData = getSdwisForState(state);
  const sdwisViolations = sdwisData?.violations.length ?? 0;
  const enforcementActions = sdwisData?.enforcement.length ?? 0;
  violationCount += sdwisViolations;

  // ECHO: additional violations
  violationCount += precomputed.echoViolationsByState.get(state) ?? 0;

  // PFAS: detection count
  const pfasDetections = precomputed.pfasByState.get(state) ?? 0;

  // Signals: count + high-severity
  const stateSignals = getArchivedSignals({ state });
  const signalCount = stateSignals.length;
  const highSeveritySignals = stateSignals.filter(
    s => s.category === 'contamination' || s.category === 'spill' || s.category === 'enforcement',
  ).length;

  // NWIS-GW: falling groundwater trends
  const gwTrendFalling = precomputed.gwFallingByState.get(state) ?? 0;

  // State Reports: AI readiness score
  const stateReport = getStateReport(state);
  const aiReadinessScore = stateReport?.aiReadinessScore ?? 0;

  // Risk score: simplified aggregate (mirrors scenarioModeler scoring)
  const wqScore = Math.min(100, impairmentPct);
  const compScore = Math.min(100, violationCount * 2 + enforcementActions * 5);
  const contScore = Math.min(100, pfasDetections * 8 + highSeveritySignals * 10);
  const infraScore = Math.min(100, gwTrendFalling * 3);
  const monScore = Math.max(0, 100 - aiReadinessScore);
  const riskScore = Math.round(
    (wqScore * 0.30 + compScore * 0.25 + contScore * 0.20 + infraScore * 0.15 + monScore * 0.10) * 10,
  ) / 10;

  return {
    date: today,
    riskScore,
    impairmentPct: Math.round(impairmentPct * 10) / 10,
    violationCount,
    signalCount,
    highSeveritySignals,
    impairedWaterbodies,
    totalAssessed,
    enforcementActions,
    pfasDetections,
    aiReadinessScore,
    gwTrendFalling,
  };
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  try {
    console.log('[Assessments Cron] Starting build...');

    // 1. Warm all source caches in parallel
    await Promise.allSettled([
      warmAttains(),
      warmIcis(),
      warmSdwis(),
      warmEcho(),
      warmPfas(),
      warmSignals(),
      warmNwisGw(),
      warmStateReports(),
      warmSnapshots(),
    ]);

    const warmElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Assessments Cron] Caches warmed in ${warmElapsed}s`);

    // 2. Precompute cross-state lookups once
    const attainsSummary = getAttainsCacheSummary();

    // ICIS: build permit→state lookup
    const icisData = getIcisAllData();
    const icisPermitStateMap = new Map<string, string>();
    for (const p of icisData.permits) {
      if (p.state) icisPermitStateMap.set(p.permit, p.state);
    }

    // ECHO: violations by state
    const echoData = getEchoAllData();
    const echoViolationsByState = new Map<string, number>();
    for (const v of echoData.violations) {
      if (v.state) echoViolationsByState.set(v.state, (echoViolationsByState.get(v.state) ?? 0) + 1);
    }

    // PFAS: detections by state
    const pfasResults = getPfasAllResults();
    const pfasByState = new Map<string, number>();
    for (const r of pfasResults) {
      if (r.state && r.detected) pfasByState.set(r.state, (pfasByState.get(r.state) ?? 0) + 1);
    }

    // NWIS-GW: falling trends by state (join trends→sites via siteNumber)
    const gwTrends = getNwisGwAllTrends();
    const gwSites = getNwisGwAllSites();
    const siteStateMap = new Map<string, string>();
    for (const s of gwSites) {
      if (s.state) siteStateMap.set(s.siteNumber, s.state);
    }
    const gwFallingByState = new Map<string, number>();
    for (const t of gwTrends) {
      if (t.trend === 'falling') {
        const st = siteStateMap.get(t.siteNumber);
        if (st) gwFallingByState.set(st, (gwFallingByState.get(st) ?? 0) + 1);
      }
    }

    const precomputed = {
      attainsSummary,
      icisPermitStateMap,
      icisViolations: icisData.violations,
      echoViolationsByState,
      pfasByState,
      gwFallingByState,
    };

    // 3. Compile today's snapshot for each state
    let snapshotsAdded = 0;
    for (const state of ALL_STATES) {
      const snapshot = compileSnapshot(state, today, precomputed);
      appendSnapshot(state, snapshot);
      snapshotsAdded++;
    }

    console.log(`[Assessments Cron] Compiled ${snapshotsAdded} state snapshots`);

    // 4. Save snapshot cache (disk + blob)
    await saveSnapshotCache();

    // 5. Build comprehensive assessments
    const allSnapshots = getAllSnapshots();
    const assessments = buildAllAssessments(allSnapshots);

    // 6. Save assessments (disk + blob)
    const assessmentData = {
      _meta: {
        built: new Date().toISOString(),
        stateCount: Object.keys(assessments).length,
      },
      assessments,
    };

    // Empty-data guard
    if (Object.keys(assessments).length === 0) {
      console.warn('[Assessments Cron] No assessments generated — skipping save');
      return NextResponse.json({
        status: 'skipped',
        reason: 'No assessments generated (source caches may be empty)',
      });
    }

    saveCacheToDisk(ASSESSMENT_DISK_FILE, assessmentData);
    await saveCacheToBlob(ASSESSMENT_BLOB_PATH, assessmentData);

    // 7. Compute summary stats
    const assessmentValues = Object.values(assessments) as ComprehensiveAssessment[];
    const avgCompleteness = assessmentValues.length > 0
      ? Math.round(assessmentValues.reduce((s, a) => s + a.dataCompleteness, 0) / assessmentValues.length)
      : 0;
    const criticalStates = assessmentValues
      .filter(a => a.currentRiskLevel === 'red')
      .map(a => a.stateCode);
    const avgHistoricalDays = assessmentValues.length > 0
      ? Math.round(assessmentValues.reduce((s, a) => s + a.historicalDays, 0) / assessmentValues.length)
      : 0;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[Assessments Cron] Complete in ${elapsed}s — ${snapshotsAdded} states, ` +
      `avg completeness ${avgCompleteness}%, ${criticalStates.length} critical`,
    );

    recordCronRun('build-assessments', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      statesProcessed: snapshotsAdded,
      avgDataCompleteness: avgCompleteness,
      avgHistoricalDays,
      criticalStates,
      built: assessmentData._meta.built,
    });
  } catch (err: any) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Assessments Cron] Failed after ${elapsed}s:`, err);

    Sentry.captureException(err, { tags: { cron: 'build-assessments' } });

    notifySlackCronFailure({ cronName: 'build-assessments', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('build-assessments', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Assessment build failed', duration: `${elapsed}s` },
      { status: 500 },
    );
  }
}
