// app/api/cron/build-briefings/route.ts
// Cron endpoint — builds overnight briefing data from EPA ECHO, SDWIS, ATTAINS, state DEQ systems.
// Aggregates enforcement actions, violations, permit updates, infrastructure alerts.
// Schedule: daily at 1:00 AM UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setBriefingCache, getBuildStatus, setBuildInProgress,
  type ChangeItem, type StakeholderItem, type BriefingData, type BriefingEntityType,
  addBriefingData,
} from '@/lib/briefingCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 30_000;
const PRIORITY_STATES = ['MD', 'VA', 'PA', 'DE', 'WV', 'NY', 'NC', 'FL', 'CA', 'TX'];
const ENTITY_TYPES: BriefingEntityType[] = ['local', 'ms4', 'utility', 'k12', 'ngo', 'university', 'esg', 'biotech', 'investor'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ── Data Source Integrations ─────────────────────────────────────────────────

async function fetchEchoEnforcementActions(): Promise<ChangeItem[]> {
  const changes: ChangeItem[] = [];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  try {
    // EPA ECHO API - enforcement actions in last 24 hours
    const url = `https://echo.epa.gov/echo/rest/case_search/list_cases`;
    const params = new URLSearchParams({
      output: 'JSON',
      start_date: yesterdayStr,
      end_date: todayStr,
      rows: '100',
    });

    const response = await fetchWithTimeout(`${url}?${params}`);
    if (!response.ok) throw new Error(`ECHO API error: ${response.status}`);

    const data = await response.json();
    const cases = data?.Results?.Results || [];

    for (const case_item of cases) {
      changes.push({
        id: `echo-enf-${case_item.case_number || Date.now()}`,
        timestamp: case_item.activity_date || new Date().toISOString(),
        type: 'enforcement',
        source: 'EPA_ECHO',
        severity: case_item.violation_types?.includes('SNC') ? 'high' : 'medium',
        title: `EPA enforcement action: ${case_item.case_name || 'Compliance action initiated'}`,
        summary: `${case_item.facility_name || 'Facility'} - ${case_item.activity_desc || 'Enforcement activity'}`,
        details: [
          `Case Number: ${case_item.case_number || 'N/A'}`,
          `Facility: ${case_item.facility_name || 'Unknown'}`,
          `Activity: ${case_item.activity_desc || 'Enforcement action'}`,
          `Settlement: ${case_item.settlement_amount ? '$' + case_item.settlement_amount : 'TBD'}`,
          `Compliance Date: ${case_item.compliance_date || 'TBD'}`
        ].join('\n'),
        entityRelevance: ['utility', 'esg', 'investor', 'biotech'],
        geography: {
          state: case_item.state_code,
          county: case_item.county_name,
        },
        facilityId: case_item.facility_uin,
        permitId: case_item.permit_id,
        actionRequired: case_item.violation_types?.includes('SNC') || false,
        deadline: case_item.compliance_date,
      });
    }
  } catch (error) {
    console.warn('Failed to fetch ECHO enforcement actions:', error);
  }

  return changes;
}

async function fetchSdwisViolations(): Promise<ChangeItem[]> {
  const changes: ChangeItem[] = [];

  try {
    // Note: SDWIS API access is limited. Using fallback approach via state systems.
    // In production, this would integrate with EPA's Water Quality Portal or state APIs

    // Mock recent violations for development - replace with real API calls
    const mockViolations = [
      {
        system_id: 'MD0010001',
        system_name: 'Baltimore City Water',
        violation_code: 'MCL',
        contaminant: 'Lead',
        value: '18 ppb',
        limit: '15 ppb',
        sample_date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        state: 'MD',
      },
      {
        system_id: 'VA0050002',
        system_name: 'Arlington County Water',
        violation_code: 'MRT',
        contaminant: 'Coliform',
        description: 'Missed required testing',
        sample_date: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        state: 'VA',
      }
    ];

    for (const violation of mockViolations) {
      changes.push({
        id: `sdwis-viol-${violation.system_id}-${Date.now()}`,
        timestamp: violation.sample_date,
        type: 'violation',
        source: 'SDWIS',
        severity: violation.violation_code === 'MCL' ? 'high' : 'medium',
        title: `SDWIS violation: ${violation.system_name} - ${violation.contaminant || violation.violation_code}`,
        summary: violation.value ?
          `${violation.contaminant} exceeded limit (${violation.value} vs ${violation.limit})` :
          violation.description || 'Regulatory violation detected',
        details: [
          `Water System: ${violation.system_name} (${violation.system_id})`,
          `Violation Type: ${violation.violation_code}`,
          violation.contaminant ? `Contaminant: ${violation.contaminant}` : '',
          violation.value ? `Measured Value: ${violation.value}` : '',
          violation.limit ? `Regulatory Limit: ${violation.limit}` : '',
          `Sample Date: ${violation.sample_date}`,
        ].filter(Boolean).join('\n'),
        entityRelevance: ['utility', 'local', 'k12'],
        geography: {
          state: violation.state,
        },
        facilityId: violation.system_id,
        actionRequired: violation.violation_code === 'MCL',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      });
    }
  } catch (error) {
    console.warn('Failed to fetch SDWIS violations:', error);
  }

  return changes;
}

async function fetchAttainsUpdates(): Promise<ChangeItem[]> {
  const changes: ChangeItem[] = [];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // EPA ATTAINS API - waterbody impairment updates
    const url = 'https://attains.epa.gov/attains-public/api/assessments';
    const params = new URLSearchParams({
      format: 'json',
      lastChangeDate: yesterday.toISOString().split('T')[0],
      organizationId: 'EPA',
      returnCountOnly: 'false',
    });

    const response = await fetchWithTimeout(`${url}?${params}`);
    if (!response.ok) throw new Error(`ATTAINS API error: ${response.status}`);

    const data = await response.json();
    const assessments = data?.items || [];

    for (const assessment of assessments.slice(0, 10)) { // Limit to avoid timeout
      const waterbody = assessment.assessmentUnitIdentifier;
      const impairments = assessment.useAttainments || [];

      for (const impairment of impairments.slice(0, 3)) {
        changes.push({
          id: `attains-${waterbody}-${Date.now()}`,
          timestamp: assessment.lastChangeDate || new Date().toISOString(),
          type: 'monitoring',
          source: 'ATTAINS',
          severity: impairment.useAttainmentCode === 'F' ? 'high' : 'medium',
          title: `ATTAINS update: ${assessment.assessmentUnitName || waterbody} impairment status changed`,
          summary: `${impairment.useName} - ${impairment.useAttainmentCode === 'F' ? 'Fully Supporting' : 'Not Supporting'}`,
          details: [
            `Waterbody: ${assessment.assessmentUnitName || 'Unnamed waterbody'}`,
            `Assessment Unit: ${waterbody}`,
            `Designated Use: ${impairment.useName}`,
            `Status: ${impairment.useAttainmentCode === 'F' ? 'Fully Supporting' :
                     impairment.useAttainmentCode === 'N' ? 'Not Supporting' : 'Insufficient Data'}`,
            `Last Updated: ${assessment.lastChangeDate}`,
            `Cycle: ${assessment.reportingCycle}`,
          ].join('\n'),
          entityRelevance: ['ngo', 'university', 'local', 'ms4'],
          geography: {
            state: assessment.stateCode,
          },
          waterbodyId: waterbody,
          actionRequired: impairment.useAttainmentCode === 'N',
        });
      }
    }
  } catch (error) {
    console.warn('Failed to fetch ATTAINS updates:', error);
  }

  return changes;
}

async function generateStakeholderData(state: string): Promise<StakeholderItem[]> {
  const stakeholders: StakeholderItem[] = [];

  // Mock stakeholder data - replace with real media monitoring, public records, etc.
  const mockStakeholders = [
    {
      type: 'media' as const,
      title: `${state} environmental groups call for stronger PFAS regulation`,
      description: 'Coalition advocates for lower detection limits',
      source: `${state} Environmental News`,
      priority: 'medium' as const,
    },
    {
      type: 'public_comment' as const,
      title: `Public comment period open for ${state} water quality standards`,
      description: 'DEQ seeking input on revised aquatic life criteria',
      source: `${state} DEQ`,
      priority: 'high' as const,
    },
    {
      type: 'council' as const,
      title: `County council hearing on stormwater utility expansion`,
      description: 'Proposed fee increase to fund MS4 compliance',
      source: `${state} County Council`,
      priority: 'high' as const,
    }
  ];

  mockStakeholders.forEach((item, idx) => {
    stakeholders.push({
      id: `stakeholder-${state}-${idx}-${Date.now()}`,
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      type: item.type,
      source: item.source,
      priority: item.priority,
      title: item.title,
      description: item.description,
      details: `Detailed information about ${item.title.toLowerCase()}. This would contain full article text, meeting details, or comment submission information.`,
      entityRelevance: ['local', 'ngo', 'ms4'],
      geography: { state },
      status: item.priority === 'high' ? 'review_needed' : 'monitor',
      tags: ['regulation', 'public-engagement', state.toLowerCase()],
    });
  });

  return stakeholders;
}

// ── Main Build Function ──────────────────────────────────────────────────────

async function buildBriefingData(): Promise<any> {
  const startTime = Date.now();
  console.log('[Briefing Cron] Starting overnight briefing data build...');

  // Fetch data from all sources in parallel
  const [echoChanges, sdwisChanges, attainsChanges] = await Promise.all([
    fetchEchoEnforcementActions(),
    fetchSdwisViolations(),
    fetchAttainsUpdates(),
  ]);

  const allChanges = [...echoChanges, ...sdwisChanges, ...attainsChanges];
  console.log(`[Briefing Cron] Collected ${allChanges.length} overnight changes`);

  // Build briefing data for priority states and entity types
  const briefings: BriefingData[] = [];
  let totalStakeholderItems = 0;

  for (const state of PRIORITY_STATES) {
    const stakeholders = await generateStakeholderData(state);
    totalStakeholderItems += stakeholders.length;

    for (const entityType of ENTITY_TYPES) {
      // Filter changes relevant to this entity type and state
      const relevantChanges = allChanges.filter(change =>
        change.entityRelevance.includes(entityType) &&
        (!change.geography?.state || change.geography.state === state)
      );

      const entityStakeholders = stakeholders.filter(s =>
        s.entityRelevance.includes(entityType)
      );

      if (relevantChanges.length > 0 || entityStakeholders.length > 0) {
        briefings.push({
          entityType,
          entityName: `Sample ${entityType} Entity`, // In production, loop through actual entities
          state,
          changes: relevantChanges,
          stakeholders: entityStakeholders,
          lastUpdated: new Date().toISOString(),
          totalChanges: relevantChanges.length,
          criticalCount: relevantChanges.filter(c => c.severity === 'critical').length,
          actionRequiredCount: relevantChanges.filter(c => c.actionRequired).length,
        });
      }
    }
  }

  // Create cache data structure
  const newCacheData = {
    _meta: {
      built: new Date().toISOString(),
      totalBriefings: briefings.length,
      totalChanges: allChanges.length,
      totalStakeholderItems,
      entitiesProcessed: briefings.length,
      statesProcessed: PRIORITY_STATES,
      sourcesProcessed: ['EPA_ECHO', 'SDWIS', 'ATTAINS'],
      gridCells: PRIORITY_STATES.length,
    },
    grid: {} as Record<string, any>,
    _buildInProgress: false,
    _buildStartedAt: null,
  };

  // Organize briefings into grid structure
  briefings.forEach(briefing => {
    const stateKey = briefing.state.toLowerCase();
    if (!newCacheData.grid[stateKey]) {
      newCacheData.grid[stateKey] = { briefings: {} };
    }
    const briefingKey = `${briefing.entityType}-${briefing.entityName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${briefing.state.toLowerCase()}`;
    newCacheData.grid[stateKey].briefings[briefingKey] = briefing;
  });

  await setBriefingCache(newCacheData);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Briefing Cron] Built ${briefings.length} briefings in ${elapsed}s`);

  return {
    briefings: briefings.length,
    changes: allChanges.length,
    stakeholders: totalStakeholderItems,
    states: PRIORITY_STATES.length,
  };
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const buildStatus = getBuildStatus();
  if (buildStatus.inProgress) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Briefing build already in progress',
      buildStatus,
    });
  }

  setBuildInProgress(true);
  const startTime = Date.now();

  try {
    const result = await buildBriefingData();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Briefing Cron] Completed in ${elapsed}s`);

    recordCronRun('build-briefings', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      ...result,
    });

  } catch (err: any) {
    console.error('[Briefing Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'build-briefings' } });
    notifySlackCronFailure({
      cronName: 'build-briefings',
      error: err.message || 'build failed',
      duration: Date.now() - startTime
    });

    recordCronRun('build-briefings', 'error', Date.now() - startTime, err.message);

    return NextResponse.json(
      { status: 'error', error: err.message || 'Briefing build failed' },
      { status: 500 },
    );
  } finally {
    setBuildInProgress(false);
  }
}