// app/api/cron/rebuild-dod-pfas/route.ts
// Cron endpoint — loads DoD PFAS assessment data from curated static JSON,
// cross-references with military-installations.json for coordinates,
// optionally enriches via EPA ECHO, and builds the grid-indexed cache.
// Schedule: weekly (Sunday 10 PM UTC).

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setDoDPFASCache, getDoDPFASCacheStatus,
  isDoDPFASBuildInProgress, setDoDPFASBuildInProgress,
  gridKey,
  type DoDPFASAssessment, type DoDPFASStateSummary,
} from '@/lib/dodPfasCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Types for static data ───────────────────────────────────────────────────

interface RawAssessment {
  installationName: string;
  state: string | null;
  branch: string;
  siteType: string;
  phase: string;
  pfasDetected: boolean;
  drinkingWaterExceedance: boolean;
  interimActionCount: number;
  lastUpdated: string;
}

interface MilitaryInstallation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  branch: string;
  state: string | null;
  type: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(joint base|air force base|air force|air reserve base|air national guard base|naval air station|naval station|marine corps (air station|base)|camp|fort)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function findInstallationMatch(
  assessmentName: string,
  assessmentState: string | null,
  installations: MilitaryInstallation[],
): MilitaryInstallation | null {
  const normName = normalizeForMatch(assessmentName);

  // First pass: exact name + state match
  for (const inst of installations) {
    if (assessmentState && inst.state && inst.state !== assessmentState) continue;
    const instNorm = normalizeForMatch(inst.name);
    if (instNorm === normName) return inst;
  }

  // Second pass: substring match within same state
  for (const inst of installations) {
    if (assessmentState && inst.state && inst.state !== assessmentState) continue;
    const instNorm = normalizeForMatch(inst.name);
    if (instNorm.includes(normName) || normName.includes(instNorm)) return inst;
  }

  return null;
}

function buildStateSummaries(
  assessments: DoDPFASAssessment[],
): Record<string, DoDPFASStateSummary> {
  const byState: Record<string, DoDPFASAssessment[]> = {};
  for (const a of assessments) {
    if (!a.state) continue;
    if (!byState[a.state]) byState[a.state] = [];
    byState[a.state].push(a);
  }

  const summaries: Record<string, DoDPFASStateSummary> = {};
  for (const [state, stateAssessments] of Object.entries(byState)) {
    const phaseBreakdown: Record<string, number> = {};
    for (const a of stateAssessments) {
      phaseBreakdown[a.phase] = (phaseBreakdown[a.phase] || 0) + 1;
    }

    summaries[state] = {
      state,
      totalAssessments: stateAssessments.length,
      pfasDetectedCount: stateAssessments.filter(a => a.pfasDetected).length,
      drinkingWaterExceedanceCount: stateAssessments.filter(a => a.drinkingWaterExceedance).length,
      interimActionTotal: stateAssessments.reduce((sum, a) => sum + a.interimActionCount, 0),
      phaseBreakdown,
    };
  }

  return summaries;
}

// ── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isDoDPFASBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'DoD PFAS build already in progress',
      cache: getDoDPFASCacheStatus(),
    });
  }

  setDoDPFASBuildInProgress(true);
  const startTime = Date.now();

  try {
    // ── Load static data files ──────────────────────────────────────────
    const fs = require('fs');
    const path = require('path');

    const assessmentsPath = path.join(process.cwd(), 'data', 'dod-pfas-assessments.json');
    const installationsPath = path.join(process.cwd(), 'data', 'military-installations.json');

    if (!fs.existsSync(assessmentsPath)) {
      throw new Error('dod-pfas-assessments.json not found');
    }

    const rawAssessments: RawAssessment[] = JSON.parse(
      fs.readFileSync(assessmentsPath, 'utf-8'),
    );
    const installations: MilitaryInstallation[] = JSON.parse(
      fs.readFileSync(installationsPath, 'utf-8'),
    );

    console.log(
      `[DoD PFAS Cron] Loaded ${rawAssessments.length} assessments, ${installations.length} installations`,
    );

    // ── Cross-reference with military installations for coordinates ─────
    const assessments: DoDPFASAssessment[] = [];
    let matched = 0;
    let unmatched = 0;

    for (const raw of rawAssessments) {
      const match = findInstallationMatch(raw.installationName, raw.state, installations);

      if (match) {
        matched++;
        assessments.push({
          installationName: raw.installationName,
          state: raw.state?.toUpperCase() || null,
          branch: raw.branch as DoDPFASAssessment['branch'],
          siteType: raw.siteType as DoDPFASAssessment['siteType'],
          phase: raw.phase as DoDPFASAssessment['phase'],
          pfasDetected: raw.pfasDetected,
          drinkingWaterExceedance: raw.drinkingWaterExceedance,
          interimActionCount: raw.interimActionCount,
          lastUpdated: raw.lastUpdated,
          lat: match.lat,
          lng: match.lng,
          matchedInstallationId: match.id,
        });
      } else {
        unmatched++;
        console.warn(`[DoD PFAS Cron] No coordinate match for: ${raw.installationName} (${raw.state})`);
      }
    }

    console.log(`[DoD PFAS Cron] Matched ${matched}/${rawAssessments.length} to coordinates (${unmatched} unmatched)`);

    // ── Build grid index ────────────────────────────────────────────────
    const grid: Record<string, { assessments: DoDPFASAssessment[] }> = {};
    for (const a of assessments) {
      const key = gridKey(a.lat, a.lng);
      if (!grid[key]) grid[key] = { assessments: [] };
      grid[key].assessments.push(a);
    }

    // ── Build state summaries ───────────────────────────────────────────
    const stateSummaries = buildStateSummaries(assessments);
    const statesWithData = Object.keys(stateSummaries).length;

    // ── Empty-data guard ────────────────────────────────────────────────
    if (assessments.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[DoD PFAS Cron] 0 assessments in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getDoDPFASCacheStatus(),
      });
    }

    // ── Save cache ──────────────────────────────────────────────────────
    const pfasDetectedCount = assessments.filter(a => a.pfasDetected).length;
    const drinkingWaterExceedanceCount = assessments.filter(a => a.drinkingWaterExceedance).length;

    await setDoDPFASCache({
      _meta: {
        built: new Date().toISOString(),
        assessmentCount: assessments.length,
        statesWithData,
        gridCells: Object.keys(grid).length,
        pfasDetectedCount,
        drinkingWaterExceedanceCount,
      },
      grid,
      stateSummaries,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[DoD PFAS Cron] Complete in ${elapsed}s — ${assessments.length} assessments, ` +
      `${Object.keys(grid).length} cells, ${statesWithData} states`,
    );

    recordCronRun('rebuild-dod-pfas', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      assessmentCount: assessments.length,
      matched,
      unmatched,
      gridCells: Object.keys(grid).length,
      statesWithData,
      pfasDetectedCount,
      drinkingWaterExceedanceCount,
      cache: getDoDPFASCacheStatus(),
    });
  } catch (err: any) {
    console.error('[DoD PFAS Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-dod-pfas' } });

    notifySlackCronFailure({
      cronName: 'rebuild-dod-pfas',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });

    recordCronRun('rebuild-dod-pfas', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'DoD PFAS build failed' },
      { status: 500 },
    );
  } finally {
    setDoDPFASBuildInProgress(false);
  }
}
