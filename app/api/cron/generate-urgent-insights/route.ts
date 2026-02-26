// app/api/cron/generate-urgent-insights/route.ts
// Lightweight cron that runs every 2 hours — only processes states with active
// critical conditions (USGS threshold exceedances, spill signals, severe weather).
// Generates insights for 3 crisis-relevant roles: MS4, State, Federal.

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getAttainsCacheSummary } from '@/lib/attainsCache';
import {
  setInsights, getInsights, isBuildInProgress,
  hashSignals, ensureWarmed as warmInsights,
  type CacheEntry,
} from '@/lib/insightsCache';
import { ensureWarmed as warmUsgsAlerts } from '@/lib/usgsAlertCache';
import { ensureWarmed as warmNwsAlerts } from '@/lib/nwsAlertCache';
import {
  fetchEnrichmentSnapshot, getStateEnrichment,
  formatEnrichmentForLLM, buildEnrichedSignals, summarizeEnrichment,
} from '@/lib/insightsEnrichment';
import {
  buildSystemPrompt, getConfiguredLLMCaller,
  parseInsights, sleep, type Role,
} from '@/lib/llmHelpers';

// Only these roles get urgent refresh — they're the ones who act on crises
const URGENT_ROLES: Role[] = ['MS4', 'State', 'Federal'];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // If main build is running, bail — no lock contention
  if (isBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Main insight build in progress',
    });
  }

  // Warm caches in parallel
  await Promise.all([warmInsights(), warmUsgsAlerts(), warmNwsAlerts()]);

  const llmConfig = getConfiguredLLMCaller();
  if (!llmConfig) {
    return NextResponse.json(
      { error: 'No AI provider configured.' },
      { status: 503 },
    );
  }
  const { callLLM, provider } = llmConfig;

  // Fetch enrichment snapshot
  let enrichmentSnapshot;
  try {
    enrichmentSnapshot = await fetchEnrichmentSnapshot();
  } catch (err: any) {
    return NextResponse.json({
      status: 'skipped',
      reason: `Enrichment fetch failed: ${err.message}`,
    });
  }

  // Get ATTAINS data for region summaries
  const { states } = getAttainsCacheSummary();

  // Scan all states for critical conditions
  const allStateAbbrs = Object.keys(states);
  const crisisStates: { abbr: string; enrichment: ReturnType<typeof getStateEnrichment> }[] = [];

  for (const abbr of allStateAbbrs) {
    const enrichment = getStateEnrichment(abbr, enrichmentSnapshot);
    if (enrichment.hasCriticalCondition) {
      crisisStates.push({ abbr, enrichment });
    }
  }

  if (crisisStates.length === 0) {
    return NextResponse.json({
      status: 'complete',
      reason: 'No states with critical conditions',
      duration: `${((Date.now()) / 1000).toFixed(1)}s`,
      signalCount: enrichmentSnapshot.signals.length,
    });
  }

  console.log(`[Cron/Urgent] ${crisisStates.length} crisis states: ${crisisStates.map(s => s.abbr).join(', ')}`);

  const startTime = Date.now();
  const results = { generated: 0, deltaSkipped: 0, failed: 0, errors: [] as string[] };

  for (const { abbr, enrichment } of crisisStates) {
    const stateData = states[abbr];
    if (!stateData || stateData.total === 0) continue;

    const regionSummary = {
      totalWaterbodies: stateData.total,
      highAlert: stateData.high,
      mediumAlert: stateData.medium,
      lowAlert: stateData.low,
      topCauses: stateData.topCauses?.slice(0, 10) || [],
    };

    const signals = buildEnrichedSignals(stateData, enrichment);
    const currentHash = hashSignals(signals);
    const enrichmentForLLM = formatEnrichmentForLLM(enrichment);
    const enrichmentSummaryStr = summarizeEnrichment(enrichment);

    for (const role of URGENT_ROLES) {
      try {
        // Delta check — skip if hash unchanged
        const existing = getInsights(abbr, role);
        if (existing && existing.signalsHash === currentHash) {
          results.deltaSkipped++;
          continue;
        }

        const userMessageObj: Record<string, any> = {
          role,
          state: abbr,
          selectedWaterbody: null,
          regionSummary,
        };
        if (enrichmentForLLM.activeAlerts) userMessageObj.activeAlerts = enrichmentForLLM.activeAlerts;
        if (enrichmentForLLM.recentSignals) userMessageObj.recentSignals = enrichmentForLLM.recentSignals;
        if (enrichmentForLLM.weatherAlerts) userMessageObj.weatherAlerts = enrichmentForLLM.weatherAlerts;

        const userMessage = JSON.stringify(userMessageObj);
        const systemPrompt = buildSystemPrompt(role);

        let rawText = '';
        let backoffMs = 2000;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            rawText = await callLLM(systemPrompt, userMessage);
            break;
          } catch (retryErr: any) {
            if (retryErr.message?.includes('429') && attempt < 2) {
              console.warn(`[Cron/Urgent] Rate limited on ${abbr}:${role} — backing off ${backoffMs / 1000}s`);
              await sleep(backoffMs);
              backoffMs *= 2;
              continue;
            }
            throw retryErr;
          }
        }

        const insights = parseInsights(rawText);
        if (insights.length === 0) {
          results.failed++;
          results.errors.push(`${abbr}:${role} — no valid insights parsed`);
          continue;
        }

        const entry: CacheEntry = {
          insights,
          generatedAt: new Date().toISOString(),
          signalsHash: currentHash,
          provider,
          urgentRefresh: true,
          enrichmentSummary: enrichmentSummaryStr,
        };

        setInsights(abbr, role, entry);
        results.generated++;

        await sleep(100);
      } catch (err: any) {
        results.failed++;
        const msg = `${abbr}:${role} — ${err.message?.slice(0, 100) || 'unknown error'}`;
        results.errors.push(msg);
        console.error(`[Cron/Urgent] ${msg}`);
      }
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[Cron/Urgent] Complete in ${durationSec}s — ` +
    `${crisisStates.length} crisis states, ${results.generated} generated, ` +
    `${results.deltaSkipped} delta-skipped, ${results.failed} failed`
  );

  return NextResponse.json({
    status: 'complete',
    duration: `${durationSec}s`,
    provider,
    crisisStates: crisisStates.map(s => s.abbr),
    rolesPerState: URGENT_ROLES.length,
    ...results,
    errors: results.errors.slice(0, 10),
  });
}
