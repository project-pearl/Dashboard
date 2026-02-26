// app/api/cron/generate-insights/route.ts
// Vercel Cron — runs every 6 hours to pre-generate AI insights for all state/role combos.
// Populates the in-memory insightsCache so user requests are served instantly.

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { getAttainsCacheSummary } from '@/lib/attainsCache';
import {
  setInsights, getInsights, setBuildInProgress, setLastFullBuild,
  isBuildInProgress, getCacheStatus as getInsightsCacheStatus,
  hashSignals, ensureWarmed as warmInsights,
  type CacheEntry, type CachedInsight,
} from '@/lib/insightsCache';

// ─── Role definitions (mirrors AIInsightsEngine) ─────────────────────────────

type Role = 'MS4' | 'State' | 'Federal' | 'Corporate' | 'K12' | 'College' | 'Researcher' | 'NGO';

const ALL_ROLES: Role[] = ['MS4', 'State', 'Federal', 'Corporate', 'K12', 'College', 'Researcher', 'NGO'];

const ROLE_TONE: Record<Role, string> = {
  MS4: 'Focus on compliance risk, permit deadlines, cost optimization, and MS4 regulatory obligations.',
  State: 'Focus on statewide trends, impairment reclassification risk, resource allocation, and TMDL progress.',
  Federal: 'Focus on cross-state patterns, national trends, policy impact, and Clean Water Act implications.',
  Corporate: 'Focus on portfolio risk, ESG disclosure readiness, supply chain water risk, and investor-relevant metrics.',
  K12: 'Focus on fun discoveries, wildlife impacts, "did you know" style facts, and engaging educational content for students.',
  College: 'Focus on research-worthy anomalies, data quality assessment, publication-ready findings, and methodology rigor.',
  Researcher: 'Focus on statistical anomalies, research-worthy patterns, data quality, and peer-comparable findings.',
  NGO: 'Focus on community impact, advocacy opportunities, environmental justice, and public health connections.',
};

function buildSystemPrompt(role: Role): string {
  return `You are a water quality data analyst for the PEARL platform. Generate actionable insights based on the provided water quality data. Be specific, cite parameter values, and provide early warnings. When analyzing waterbody data near major infrastructure (CSO outfalls, interceptors, treatment plants), flag sudden multi-parameter anomalies (simultaneous E. coli spike + DO crash + turbidity surge) as potential sewage discharge events. Reference the January 2026 Potomac Interceptor collapse as an example of why early detection matters — 200M+ gallons went unmonitored because no independent continuous monitoring existed. ${ROLE_TONE[role]} Format your response as a JSON array of exactly 4 objects, each with: {type: "predictive"|"anomaly"|"comparison"|"recommendation"|"summary", severity: "info"|"warning"|"critical", title: string, body: string, waterbody?: string, timeframe?: string}. Return ONLY the JSON array, no markdown or extra text.`;
}

// ─── LLM Callers (same pattern as ai-insights/route.ts) ─────────────────────

async function callAnthropic(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

async function callOpenAI(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ─── Parse + validate insights ───────────────────────────────────────────────

function parseInsights(rawText: string): CachedInsight[] {
  const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((i: any) =>
    i &&
    typeof i.title === 'string' &&
    typeof i.body === 'string' &&
    ['predictive', 'anomaly', 'comparison', 'recommendation', 'summary'].includes(i.type) &&
    ['info', 'warning', 'critical'].includes(i.severity)
  ).slice(0, 5);
}

// ─── Delay helper to avoid rate-limiting ─────────────────────────────────────

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Concurrency semaphore ──────────────────────────────────────────────────

const CONCURRENCY = 4; // Process 4 states concurrently

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
  // Verify cron secret (Vercel sets this header automatically)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Warm from blob so delta detection can see existing entries
  await warmInsights();

  // Prevent concurrent builds
  if (isBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Build already in progress',
      cache: getInsightsCacheStatus(),
    });
  }

  // Read API keys at request time
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

  if (!ANTHROPIC_API_KEY && !OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.' },
      { status: 503 },
    );
  }

  const provider = ANTHROPIC_API_KEY ? 'anthropic' : 'openai';
  const callLLM = ANTHROPIC_API_KEY
    ? (sys: string, msg: string) => callAnthropic(ANTHROPIC_API_KEY, sys, msg)
    : (sys: string, msg: string) => callOpenAI(OPENAI_API_KEY, sys, msg);

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

  console.log(`[Cron/Insights] Starting build — ${loadedStates.length} states × ${ALL_ROLES.length} roles = ${loadedStates.length * ALL_ROLES.length} combos`);
  setBuildInProgress(true);

  const results = { generated: 0, failed: 0, skipped: 0, deltaSkipped: 0, errors: [] as string[] };
  const startTime = Date.now();
  const semaphore = { count: CONCURRENCY };

  try {
    // Process states concurrently using semaphore
    const statePromises = loadedStates.map(stateAbbr =>
      withSemaphore(semaphore, async () => {
        const stateData = states[stateAbbr];
        if (!stateData || stateData.total === 0) {
          results.skipped += ALL_ROLES.length;
          return;
        }

        // Build region summary matching AIInsightsEngine format
        const regionSummary = {
          totalWaterbodies: stateData.total,
          highAlert: stateData.high,
          mediumAlert: stateData.medium,
          lowAlert: stateData.low,
          topCauses: stateData.topCauses?.slice(0, 10) || [],
        };

        // Compute signals hash for delta detection
        const signals = [
          { type: 'summary', severity: 'info', title: `${stateData.total} waterbodies` },
          { type: 'summary', severity: stateData.high > 0 ? 'critical' : 'info', title: `${stateData.high} high alert` },
          ...(stateData.topCauses || []).map((c: string) => ({ type: 'cause', severity: 'info', title: c })),
        ];
        const currentHash = hashSignals(signals);

        for (const role of ALL_ROLES) {
          try {
            // Delta detection: skip if hash matches and entry is fresh
            const existing = getInsights(stateAbbr, role);
            if (existing && existing.signalsHash === currentHash) {
              const entryAge = Date.now() - new Date(existing.generatedAt).getTime();
              if (entryAge < MAX_ENTRY_AGE_MS) {
                results.deltaSkipped++;
                continue;
              }
            }

            const userMessage = JSON.stringify({
              role,
              state: stateAbbr,
              selectedWaterbody: null,
              regionSummary,
            });

            const systemPrompt = buildSystemPrompt(role);

            // Exponential backoff on rate limits
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
            };

            setInsights(stateAbbr, role, entry);
            results.generated++;

            // Small throttle between calls within a state
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
  console.log(`[Cron/Insights] Build complete in ${durationSec}s — ${results.generated} generated, ${results.deltaSkipped} delta-skipped, ${results.failed} failed, ${results.skipped} skipped`);

  return NextResponse.json({
    status: 'complete',
    duration: `${durationSec}s`,
    provider,
    statesProcessed: loadedStates.length,
    rolesPerState: ALL_ROLES.length,
    ...results,
    errors: results.errors.slice(0, 20), // cap error list
    cache: getInsightsCacheStatus(),
  });
}
