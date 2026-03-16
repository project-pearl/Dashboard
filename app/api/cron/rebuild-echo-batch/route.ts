// app/api/cron/rebuild-echo-batch/route.ts
// Batch cron -- rebuilds 4 EPA ECHO caches in one invocation:
//   1. ECHO DMR Violations (discharge monitoring report exceedances)
//   2. ICIS-Air (Clean Air Act compliance/violations)
//   3. MS4 Permits (municipal separate storm sewer system permits)
//   4. ECHO Biosolids (biosolids management and land application)
//
// All 4 use ECHO REST APIs with state-level iteration and grid indexing.
// Fetches states with concurrency=4 to avoid overloading ECHO servers.
//
// Schedule: daily 10:45 AM UTC

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import { gridKey } from '@/lib/cacheUtils';

// DMR Violations imports
import {
  setDmrViolationsCache,
  isDmrViolationsBuildInProgress,
  setDmrViolationsBuildInProgress,
  getDmrViolationsCacheStatus,
} from '@/lib/echoDmrViolationsCache';
import type { DmrViolation } from '@/lib/echoDmrViolationsCache';

// ICIS-Air imports
import {
  setIcisAirCache,
  isIcisAirBuildInProgress,
  setIcisAirBuildInProgress,
  getIcisAirCacheStatus,
} from '@/lib/icisAirCache';
import type { IcisAirViolation } from '@/lib/icisAirCache';

// MS4 Permit imports
import {
  setMs4PermitCache,
  isMs4PermitBuildInProgress,
  setMs4PermitBuildInProgress,
  getMs4PermitCacheStatus,
} from '@/lib/ms4PermitCache';
import type { Ms4Permit } from '@/lib/ms4PermitCache';

// Biosolids imports
import {
  setEchoBiosolidsCache,
  isEchoBiosolidsBuildInProgress,
  setEchoBiosolidsBuildInProgress,
  getEchoBiosolidsCacheStatus,
} from '@/lib/echoBiosolidsCache';
import type { BiosolidsReport } from '@/lib/echoBiosolidsCache';

// ── Constants ────────────────────────────────────────────────────────────────

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const CONCURRENCY = 4;
const REQUEST_TIMEOUT = 30_000;

// ── Types ────────────────────────────────────────────────────────────────────

interface SubCronResult {
  name: string;
  status: 'success' | 'skipped' | 'empty' | 'error';
  durationMs: number;
  recordCount?: number;
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Run an async function for each state with limited concurrency. */
async function forEachStateConcurrent<T>(
  states: string[],
  fn: (st: string) => Promise<T[]>,
): Promise<T[]> {
  const allResults: T[] = [];
  const queue = [...states];

  async function runNext(): Promise<void> {
    while (queue.length > 0) {
      const st = queue.shift()!;
      try {
        const items = await fn(st);
        allResults.push(...items);
      } catch (err: any) {
        console.warn(`[ECHO Batch] State ${st} failed: ${err.message}`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => runNext());
  await Promise.all(workers);
  return allResults;
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── Sub-cron 1: ECHO DMR Violations ─────────────────────────────────────────

async function fetchDmrForState(st: string): Promise<DmrViolation[]> {
  // EPA DMR REST services are deprecated; use CWA facility info with violation filters.
  // Step 1: Get QID for CWA facilities with violations in last 4 quarters
  const qidUrl = `https://echodata.epa.gov/echo/cwa_rest_services.get_facility_info?p_st=${st}&p_qiv=SNC&output=JSON&responseset=500`;
  const qidResp = await fetch(qidUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!qidResp.ok) throw new Error(`CWA QID HTTP ${qidResp.status}`);
  const qidJson = await qidResp.json();
  const qid = qidJson?.Results?.QueryID;
  const queryRows = parseInt(qidJson?.Results?.QueryRows || '0', 10);
  if (!qid || queryRows === 0) return [];

  // Step 2: Get facility details
  const resUrl = `https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?qid=${qid}&output=JSON&responseset=500`;
  const resResp = await fetch(resUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!resResp.ok) throw new Error(`CWA Results HTTP ${resResp.status}`);
  const resJson = await resResp.json();
  const facilities = resJson?.Results?.Facilities || [];

  const violations: DmrViolation[] = [];
  for (const fac of facilities) {
    const lat = parseFloat(fac.FacLat || fac.Lat || '0');
    const lng = parseFloat(fac.FacLong || fac.Lng || '0');
    if (!lat || !lng) continue;

    // CWA facility info includes violation summary fields
    const qtrsInViol = parseInt(fac.CWPQtrsInNC || fac.QtrsInViolation || '0', 10);
    if (qtrsInViol === 0) continue;

    violations.push({
      permitId: fac.CWPPermitStatusDesc ? fac.SourceID || '' : fac.SourceID || fac.CWPNpdesIds || '',
      facilityName: fac.CWPName || fac.FacName || '',
      facilityLat: lat,
      facilityLng: lng,
      state: st,
      parameter: fac.CWPCurrentSNCStatus || 'DMR Non-Report/Effluent Violation',
      limitValue: null,
      dmrValue: null,
      exceedancePct: null,
      violationCategory: fac.CWPSNCStatus || fac.CWPCurrentSNCStatus || 'SNC',
      reportingPeriod: `Last ${qtrsInViol} quarters`,
      reportDate: fac.CWPDateLastInspection || '',
      sourceId: `ECHO-CWA-${fac.SourceID || fac.RegistryID || ''}`,
    });
  }
  return violations;
}

async function buildDmrViolations(): Promise<SubCronResult> {
  const start = Date.now();

  if (isDmrViolationsBuildInProgress()) {
    return { name: 'echo-dmr-violations', status: 'skipped', durationMs: Date.now() - start };
  }

  setDmrViolationsBuildInProgress(true);
  try {
    const allViolations = await forEachStateConcurrent(ALL_STATES, fetchDmrForState);

    if (allViolations.length === 0) {
      console.warn('[ECHO Batch] DMR Violations: no data returned -- skipping cache save');
      recordCronRun('rebuild-echo-dmr-violations', 'success', Date.now() - start);
      return { name: 'echo-dmr-violations', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    // Build byState + grid
    const byState: Record<string, DmrViolation[]> = {};
    const grid: Record<string, DmrViolation[]> = {};
    const facilityIds = new Set<string>();

    for (const v of allViolations) {
      (byState[v.state] ??= []).push(v);
      const gk = gridKey(v.facilityLat, v.facilityLng);
      (grid[gk] ??= []).push(v);
      facilityIds.add(`${v.state}-${v.permitId}`);
    }

    await setDmrViolationsCache({
      _meta: {
        built: new Date().toISOString(),
        violationCount: allViolations.length,
        facilityCount: facilityIds.size,
        stateCount: Object.keys(byState).length,
      },
      byState,
      grid,
    });

    console.log(`[ECHO Batch] DMR Violations: ${allViolations.length} violations from ${Object.keys(byState).length} states`);
    recordCronRun('rebuild-echo-dmr-violations', 'success', Date.now() - start);
    return { name: 'echo-dmr-violations', status: 'success', durationMs: Date.now() - start, recordCount: allViolations.length };
  } catch (err: any) {
    console.error('[ECHO Batch] DMR Violations failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-echo-dmr-violations', batch: 'echo-batch' } });
    recordCronRun('rebuild-echo-dmr-violations', 'error', Date.now() - start, err.message);
    return { name: 'echo-dmr-violations', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setDmrViolationsBuildInProgress(false);
  }
}

// ── Sub-cron 2: ICIS-Air ────────────────────────────────────────────────────

async function fetchIcisAirForState(st: string): Promise<IcisAirViolation[]> {
  const url = `https://echo.epa.gov/api/air_rest_services.get_facility_info?p_st=${st}&output=JSON`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const facilities = json?.Results?.Facilities || [];

  const violations: IcisAirViolation[] = [];
  for (const fac of facilities) {
    const lat = parseFloat(fac.Lat || fac.FacLat || '0');
    const lng = parseFloat(fac.Lng || fac.FacLong || '0');
    if (!lat || !lng) continue;

    violations.push({
      programId: fac.AIRIDs || fac.ProgramID || '',
      facilityName: fac.FacName || fac.CWPName || '',
      state: st,
      violationType: fac.CAACurrVioStatus || fac.ViolationType || '',
      pollutant: fac.CAAPollutants || '',
      complianceStatus: fac.CAAComplianceStatus || fac.ComplianceStatus || '',
      lastInspectionDate: fac.CAALastInspDate || fac.LastInspection || null,
      penaltyAmount: fac.CAAPenalties != null ? parseFloat(fac.CAAPenalties) : null,
      lat,
      lng,
    });
  }
  return violations;
}

async function buildIcisAir(): Promise<SubCronResult> {
  const start = Date.now();

  if (isIcisAirBuildInProgress()) {
    return { name: 'icis-air', status: 'skipped', durationMs: Date.now() - start };
  }

  setIcisAirBuildInProgress(true);
  try {
    const allViolations = await forEachStateConcurrent(ALL_STATES, fetchIcisAirForState);

    if (allViolations.length === 0) {
      console.warn('[ECHO Batch] ICIS-Air: no data returned -- skipping cache save');
      recordCronRun('rebuild-icis-air', 'success', Date.now() - start);
      return { name: 'icis-air', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const byState: Record<string, IcisAirViolation[]> = {};
    const grid: Record<string, IcisAirViolation[]> = {};
    const facilityIds = new Set<string>();

    for (const v of allViolations) {
      (byState[v.state] ??= []).push(v);
      const gk = gridKey(v.lat, v.lng);
      (grid[gk] ??= []).push(v);
      facilityIds.add(`${v.state}-${v.programId}`);
    }

    await setIcisAirCache({
      _meta: {
        built: new Date().toISOString(),
        violationCount: allViolations.length,
        facilityCount: facilityIds.size,
        stateCount: Object.keys(byState).length,
      },
      byState,
      grid,
    });

    console.log(`[ECHO Batch] ICIS-Air: ${allViolations.length} facilities from ${Object.keys(byState).length} states`);
    recordCronRun('rebuild-icis-air', 'success', Date.now() - start);
    return { name: 'icis-air', status: 'success', durationMs: Date.now() - start, recordCount: allViolations.length };
  } catch (err: any) {
    console.error('[ECHO Batch] ICIS-Air failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-icis-air', batch: 'echo-batch' } });
    recordCronRun('rebuild-icis-air', 'error', Date.now() - start, err.message);
    return { name: 'icis-air', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setIcisAirBuildInProgress(false);
  }
}

// ── Sub-cron 3: MS4 Permits ─────────────────────────────────────────────────

async function fetchMs4ForState(st: string): Promise<Ms4Permit[]> {
  const url = `https://echo.epa.gov/api/cwa_rest_services.get_facility_info?p_st=${st}&p_permit_type=MS4&output=JSON`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const facilities = json?.Results?.Facilities || [];

  const permits: Ms4Permit[] = [];
  const now = new Date().toISOString();

  for (const fac of facilities) {
    const lat = parseFloat(fac.Lat || fac.FacLat || '0');
    const lng = parseFloat(fac.Lng || fac.FacLong || '0');
    if (!lat || !lng) continue;

    const expDate = fac.CWPExpirationDate || fac.ExpirationDate || '';
    const effDate = fac.CWPIssueDate || fac.EffectiveDate || '';

    permits.push({
      permitId: fac.CWPPermitNmbr || fac.SourceID || '',
      permittee: fac.FacName || fac.CWPName || '',
      state: st,
      permitType: (fac.CWPPermitType || '').includes('Phase I')
        ? 'Phase I'
        : (fac.CWPPermitType || '').includes('Phase II')
          ? 'Phase II'
          : 'General',
      effectiveDate: effDate,
      expirationDate: expDate,
      complianceStatus: fac.CWPComplianceStatus || fac.ComplianceStatus || '',
      populationServed: fac.CWPPopulation != null ? parseInt(fac.CWPPopulation, 10) : null,
      areaSqMi: fac.CWPAreaSqMi != null ? parseFloat(fac.CWPAreaSqMi) : null,
      lat,
      lng,
      bmps: (fac.BMPs || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    });
  }
  return permits;
}

async function buildMs4Permits(): Promise<SubCronResult> {
  const start = Date.now();

  if (isMs4PermitBuildInProgress()) {
    return { name: 'ms4-permits', status: 'skipped', durationMs: Date.now() - start };
  }

  setMs4PermitBuildInProgress(true);
  try {
    const allPermits = await forEachStateConcurrent(ALL_STATES, fetchMs4ForState);

    if (allPermits.length === 0) {
      console.warn('[ECHO Batch] MS4 Permits: no data returned -- skipping cache save');
      recordCronRun('rebuild-ms4-permits', 'success', Date.now() - start);
      return { name: 'ms4-permits', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const byState: Record<string, Ms4Permit[]> = {};
    const grid: Record<string, Ms4Permit[]> = {};
    const now = new Date().toISOString();
    let expiredCount = 0;

    for (const p of allPermits) {
      (byState[p.state] ??= []).push(p);
      const gk = gridKey(p.lat, p.lng);
      (grid[gk] ??= []).push(p);
      if (p.expirationDate && p.expirationDate < now) expiredCount++;
    }

    await setMs4PermitCache({
      _meta: {
        built: new Date().toISOString(),
        permitCount: allPermits.length,
        stateCount: Object.keys(byState).length,
        expiredCount,
      },
      byState,
      grid,
    });

    console.log(`[ECHO Batch] MS4 Permits: ${allPermits.length} permits from ${Object.keys(byState).length} states`);
    recordCronRun('rebuild-ms4-permits', 'success', Date.now() - start);
    return { name: 'ms4-permits', status: 'success', durationMs: Date.now() - start, recordCount: allPermits.length };
  } catch (err: any) {
    console.error('[ECHO Batch] MS4 Permits failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-ms4-permits', batch: 'echo-batch' } });
    recordCronRun('rebuild-ms4-permits', 'error', Date.now() - start, err.message);
    return { name: 'ms4-permits', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setMs4PermitBuildInProgress(false);
  }
}

// ── Sub-cron 4: ECHO Biosolids ──────────────────────────────────────────────

async function fetchBiosolidsForState(st: string): Promise<BiosolidsReport[]> {
  const url = `https://echo.epa.gov/api/cwa_rest_services.get_facility_info?p_st=${st}&p_biosolids=Y&output=JSON`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const facilities = json?.Results?.Facilities || [];

  const reports: BiosolidsReport[] = [];
  for (const fac of facilities) {
    const lat = parseFloat(fac.Lat || fac.FacLat || '0');
    const lng = parseFloat(fac.Lng || fac.FacLong || '0');
    if (!lat || !lng) continue;

    reports.push({
      permitId: fac.CWPPermitNmbr || fac.SourceID || '',
      facilityName: fac.FacName || fac.CWPName || '',
      state: st,
      biosolidsGeneratedDryTons: fac.BiosolidsGenerated != null ? parseFloat(fac.BiosolidsGenerated) : null,
      landAppliedDryTons: fac.BiosolidsLandApplied != null ? parseFloat(fac.BiosolidsLandApplied) : null,
      disposalMethod: fac.BiosolidsDisposalMethod || fac.DisposalMethod || 'Unknown',
      reportingYear: fac.BiosolidsReportingYear != null ? parseInt(fac.BiosolidsReportingYear, 10) : new Date().getFullYear(),
      pollutantLimits: fac.BiosolidsPollutantLimits === 'Y' || fac.BiosolidsPollutantLimits === true,
      lat,
      lng,
    });
  }
  return reports;
}

async function buildEchoBiosolids(): Promise<SubCronResult> {
  const start = Date.now();

  if (isEchoBiosolidsBuildInProgress()) {
    return { name: 'echo-biosolids', status: 'skipped', durationMs: Date.now() - start };
  }

  setEchoBiosolidsBuildInProgress(true);
  try {
    const allReports = await forEachStateConcurrent(ALL_STATES, fetchBiosolidsForState);

    if (allReports.length === 0) {
      console.warn('[ECHO Batch] Biosolids: no data returned -- skipping cache save');
      recordCronRun('rebuild-echo-biosolids', 'success', Date.now() - start);
      return { name: 'echo-biosolids', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const byState: Record<string, BiosolidsReport[]> = {};
    const grid: Record<string, BiosolidsReport[]> = {};
    const facilityIds = new Set<string>();
    let totalDryTons = 0;

    for (const r of allReports) {
      (byState[r.state] ??= []).push(r);
      const gk = gridKey(r.lat, r.lng);
      (grid[gk] ??= []).push(r);
      facilityIds.add(`${r.state}-${r.permitId}`);
      if (r.biosolidsGeneratedDryTons != null) totalDryTons += r.biosolidsGeneratedDryTons;
    }

    await setEchoBiosolidsCache({
      _meta: {
        built: new Date().toISOString(),
        reportCount: allReports.length,
        facilityCount: facilityIds.size,
        stateCount: Object.keys(byState).length,
        totalDryTons: Math.round(totalDryTons),
      },
      byState,
      grid,
    });

    console.log(`[ECHO Batch] Biosolids: ${allReports.length} reports from ${Object.keys(byState).length} states`);
    recordCronRun('rebuild-echo-biosolids', 'success', Date.now() - start);
    return { name: 'echo-biosolids', status: 'success', durationMs: Date.now() - start, recordCount: allReports.length };
  } catch (err: any) {
    console.error('[ECHO Batch] Biosolids failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-echo-biosolids', batch: 'echo-batch' } });
    recordCronRun('rebuild-echo-biosolids', 'error', Date.now() - start, err.message);
    return { name: 'echo-biosolids', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setEchoBiosolidsBuildInProgress(false);
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchStart = Date.now();
  const results: SubCronResult[] = [];

  console.log('[ECHO Batch] Starting batch rebuild of 4 ECHO caches...');

  // Run sequentially to avoid overwhelming ECHO servers and stay within
  // the 300s function timeout. Each sub-cron has its own try/catch so a
  // failure in one does not block the others.

  results.push(await buildDmrViolations());
  results.push(await buildIcisAir());
  results.push(await buildMs4Permits());
  results.push(await buildEchoBiosolids());

  const totalDurationMs = Date.now() - batchStart;
  const elapsed = (totalDurationMs / 1000).toFixed(1);
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const empty = results.filter(r => r.status === 'empty').length;

  console.log(`[ECHO Batch] Complete in ${elapsed}s -- ${succeeded} succeeded, ${failed} failed, ${skipped} skipped, ${empty} empty`);

  // Record overall batch cron run
  const overallStatus = failed === results.length ? 'error' : 'success';
  recordCronRun('rebuild-echo-batch', overallStatus, totalDurationMs,
    failed > 0 ? `${failed}/${results.length} sub-crons failed` : undefined);

  // Notify Slack if any sub-cron failed
  if (failed > 0) {
    const failedNames = results.filter(r => r.status === 'error').map(r => r.name).join(', ');
    notifySlackCronFailure({
      cronName: 'rebuild-echo-batch',
      error: `Sub-crons failed: ${failedNames}`,
      duration: totalDurationMs,
    });
  }

  const httpStatus = failed === results.length ? 500 : 200;

  return NextResponse.json({
    status: overallStatus,
    duration: `${elapsed}s`,
    summary: { succeeded, failed, skipped, empty, total: results.length },
    results: results.map(r => ({
      name: r.name,
      status: r.status,
      duration: `${(r.durationMs / 1000).toFixed(1)}s`,
      recordCount: r.recordCount,
      error: r.error,
    })),
    cacheStatus: {
      echoDmrViolations: getDmrViolationsCacheStatus(),
      icisAir: getIcisAirCacheStatus(),
      ms4Permits: getMs4PermitCacheStatus(),
      echoBiosolids: getEchoBiosolidsCacheStatus(),
    },
  }, { status: httpStatus });
}
