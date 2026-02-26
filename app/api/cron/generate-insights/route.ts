// app/api/cron/generate-insights/route.ts
// Vercel Cron — runs every 6 hours to pre-generate AI insights for all state/role combos.
// Populates the in-memory insightsCache so user requests are served instantly.
// Enriched with real-time data from signals, USGS alerts, and NWS alerts.

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { getAttainsCacheSummary } from '@/lib/attainsCache';
import {
  setInsights, getInsights, setBuildInProgress, setLastFullBuild,
  isBuildInProgress, getCacheStatus as getInsightsCacheStatus,
  hashSignals, ensureWarmed as warmInsights,
  type CacheEntry,
} from '@/lib/insightsCache';
import { ensureWarmed as warmUsgsAlerts } from '@/lib/usgsAlertCache';
import { ensureWarmed as warmNwsAlerts } from '@/lib/nwsAlertCache';
import {
  fetchEnrichmentSnapshot, getStateEnrichment,
  formatEnrichmentForLLM, buildEnrichedSignals, summarizeEnrichment,
  type EnrichmentSnapshot,
} from '@/lib/insightsEnrichment';
import {
  ALL_ROLES, buildSystemPrompt, getConfiguredLLMCaller,
  parseInsights, sleep, type Role,
} from '@/lib/llmHelpers';

// ─── Concurrency semaphore ──────────────────────────────────────────────────

const CONCURRENCY = 4;

async function withSemaphore<T>(
  semaphore: { count: number },
  fn: () => Promise<T>,
): Promise<T> {
  while (semaphore.count <= 0) {
    await sleep(50);
  }
  semaphore.count--;
  try {
    return await fn();
  } finally {
    semaphore.count++;
  }
}

// ─── Delta detection — max age before forced regeneration ───────────────────

const MAX_ENTRY_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── GET Handler (invoked by Vercel Cron) ────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Warm caches in parallel: insights (for delta detection) + alert caches (for enrichment)
  await Promise.all([warmInsights(), warmUsgsAlerts(), warmNwsAlerts()]);

  if (isBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Build already in progress',
      cache: getInsightsCacheStatus(),
    });
  }

  const llmConfig = getConfiguredLLMCaller();
  if (!llmConfig) {
    return NextResponse.json(
      { error: 'No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.' },
      { status: 503 },
    );
  }
  const { callLLM, provider } = llmConfig;

  // Get ATTAINS state data (lightweight — no waterbody arrays)
  const { cacheStatus, states } = getAttainsCacheSummary();
  const loadedStates = cacheStatus.statesLoaded;

  if (loadedStates.length < 5) {
    return NextResponse.json({
      status: 'skipped',
      reason: `ATTAINS cache not yet warm (${loadedStates.length} states loaded, need >= 5)`,
      attainsCacheStatus: cacheStatus.status,
    });
  }

  // Fetch real-time enrichment snapshot once (signals have 5-min internal cache)
  let enrichmentSnapshot: EnrichmentSnapshot | null = null;
  try {
    enrichmentSnapshot = await fetchEnrichmentSnapshot();
    console.log(`[Cron/Insights] Enrichment snapshot: ${enrichmentSnapshot.signals.length} signals from ${enrichmentSnapshot.sources.filter(s => s.status === 'ok').length}/${enrichmentSnapshot.sources.length} sources`);
  } catch (err: any) {
    console.warn(`[Cron/Insights] Enrichment fetch failed, proceeding ATTAINS-only: ${err.message}`);
  }

  console.log(`[Cron/Insights] Starting build — ${loadedStates.length} states × ${ALL_ROLES.length} roles = ${loadedStates.length * ALL_ROLES.length} combos`);
  setBuildInProgress(true);

  const results = {
    generated: 0, failed: 0, skipped: 0, deltaSkipped: 0,
    enrichedStates: 0, criticalStates: 0,
    errors: [] as string[],
  };
  const startTime = Date.now();
  const semaphore = { count: CONCURRENCY };

  try {
    const statePromises = loadedStates.map(stateAbbr =>
      withSemaphore(semaphore, async () => {
        const stateData = states[stateAbbr];
        if (!stateData || stateData.total === 0) {
          results.skipped += ALL_ROLES.length;
          return;
        }

        const regionSummary = {
          totalWaterbodies: stateData.total,
          highAlert: stateData.high,
          mediumAlert: stateData.medium,
          lowAlert: stateData.low,
          topCauses: stateData.topCauses?.slice(0, 10) || [],
        };

        // Get per-state enrichment (synchronous filter of pre-fetched snapshot)
        const enrichment = enrichmentSnapshot
          ? getStateEnrichment(stateAbbr, enrichmentSnapshot)
          : null;

        if (enrichment && (enrichment.usgsAlerts.length > 0 || enrichment.signals.length > 0)) {
          results.enrichedStates++;
        }
        if (enrichment?.hasCriticalCondition) {
          results.criticalStates++;
        }

        // Build enriched signals array for delta hash (includes USGS + signal IDs)
        const signals = enrichment
          ? buildEnrichedSignals(stateData, enrichment)
          : [
              { type: 'summary', severity: 'info', title: `${stateData.total} waterbodies` },
              { type: 'summary', severity: stateData.high > 0 ? 'critical' : 'info', title: `${stateData.high} high alert` },
              ...(stateData.topCauses || []).map((c: string) => ({ type: 'cause', severity: 'info', title: c })),
            ];
        const currentHash = hashSignals(signals);

        // Format enrichment for LLM user message
        const enrichmentForLLM = enrichment ? formatEnrichmentForLLM(enrichment) : null;
        const enrichmentSummaryStr = enrichment ? summarizeEnrichment(enrichment) : undefined;

        for (const role of ALL_ROLES) {
          try {
            const existing = getInsights(stateAbbr, role);
            if (existing && existing.signalsHash === currentHash) {
              const entryAge = Date.now() - new Date(existing.generatedAt).getTime();
              if (entryAge < MAX_ENTRY_AGE_MS) {
                results.deltaSkipped++;
                continue;
              }
            }

            // Build user message with enrichment data alongside regionSummary
            const userMessageObj: Record<string, any> = {
              role,
              state: stateAbbr,
              selectedWaterbody: null,
              regionSummary,
            };
            if (enrichmentForLLM?.activeAlerts) {
              userMessageObj.activeAlerts = enrichmentForLLM.activeAlerts;
            }
            if (enrichmentForLLM?.recentSignals) {
              userMessageObj.recentSignals = enrichmentForLLM.recentSignals;
            }
            if (enrichmentForLLM?.weatherAlerts) {
              userMessageObj.weatherAlerts = enrichmentForLLM.weatherAlerts;
            }

            const userMessage = JSON.stringify(userMessageObj);
            const systemPrompt = buildSystemPrompt(role as Role);

            let rawText = '';
            let backoffMs = 2000;
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                rawText = await callLLM(systemPrompt, userMessage);
                break;
              } catch (retryErr: any) {
                if (retryErr.message?.includes('429') && attempt < 2) {
                  console.warn(`[Cron/Insights] Rate limited on ${stateAbbr}:${role} — backing off ${backoffMs / 1000}s`);
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
              results.errors.push(`${stateAbbr}:${role} — no valid insights parsed`);
              continue;
            }

            const entry: CacheEntry = {
              insights,
              generatedAt: new Date().toISOString(),
              signalsHash: currentHash,
              provider,
              enrichmentSummary: enrichmentSummaryStr,
            };

            setInsights(stateAbbr, role, entry);
            results.generated++;

            await sleep(100);
          } catch (err: any) {
            results.failed++;
            const msg = `${stateAbbr}:${role} — ${err.message?.slice(0, 100) || 'unknown error'}`;
            results.errors.push(msg);
            console.error(`[Cron/Insights] ${msg}`);
          }
        }
      })
    );

    await Promise.all(statePromises);
    setLastFullBuild(new Date().toISOString());
  } finally {
    setBuildInProgress(false);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[Cron/Insights] Build complete in ${durationSec}s — ` +
    `${results.generated} generated, ${results.deltaSkipped} delta-skipped, ` +
    `${results.failed} failed, ${results.skipped} skipped, ` +
    `${results.enrichedStates} enriched states, ${results.criticalStates} critical`
  );

  return NextResponse.json({
    status: 'complete',
    duration: `${durationSec}s`,
    provider,
    statesProcessed: loadedStates.length,
    rolesPerState: ALL_ROLES.length,
    ...results,
    enrichment: enrichmentSnapshot ? {
      signalCount: enrichmentSnapshot.signals.length,
      sources: enrichmentSnapshot.sources,
    } : null,
    errors: results.errors.slice(0, 20),
    cache: getInsightsCacheStatus(),
  });
}
