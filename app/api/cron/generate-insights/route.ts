// app/api/cron/generate-insights/route.ts
// Vercel Cron — runs every 6 hours to pre-generate AI insights for all state/role combos.
// Populates the in-memory insightsCache so user requests are served instantly.
import { NextRequest, NextResponse } from 'next/server';
import { getAttainsCacheSummary } from '@/lib/attainsCache';
import {
  setInsights, setBuildInProgress, setLastFullBuild,
  isBuildInProgress, getCacheStatus as getInsightsCacheStatus,
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

// ─── GET Handler (invoked by Vercel Cron) ────────────────────────────────────

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header automatically)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  if (loadedStates.length === 0) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'No ATTAINS data loaded yet',
      attainsCacheStatus: cacheStatus.status,
    });
  }

  console.log(`[Cron/Insights] Starting build — ${loadedStates.length} states × ${ALL_ROLES.length} roles = ${loadedStates.length * ALL_ROLES.length} combos`);
  setBuildInProgress(true);

  const results = { generated: 0, failed: 0, skipped: 0, errors: [] as string[] };
  const startTime = Date.now();

  try {
    for (const stateAbbr of loadedStates) {
      const stateData = states[stateAbbr];
      if (!stateData || stateData.total === 0) {
        results.skipped += ALL_ROLES.length;
        continue;
      }

      // Build region summary matching AIInsightsEngine format
      const regionSummary = {
        totalWaterbodies: stateData.total,
        highAlert: stateData.high,
        mediumAlert: stateData.medium,
        lowAlert: stateData.low,
        topCauses: stateData.topCauses?.slice(0, 10) || [],
      };

      for (const role of ALL_ROLES) {
        try {
          const userMessage = JSON.stringify({
            role,
            state: stateAbbr,
            selectedWaterbody: null,
            regionSummary,
          });

          const systemPrompt = buildSystemPrompt(role);
          const rawText = await callLLM(systemPrompt, userMessage);
          const insights = parseInsights(rawText);

          if (insights.length === 0) {
            results.failed++;
            results.errors.push(`${stateAbbr}:${role} — no valid insights parsed`);
            continue;
          }

          const entry: CacheEntry = {
            insights,
            generatedAt: new Date().toISOString(),
            signalsHash: '',
            provider,
          };

          setInsights(stateAbbr, role, entry);
          results.generated++;

          // Throttle: ~200ms between calls to avoid rate limits
          await sleep(200);
        } catch (err: any) {
          results.failed++;
          const msg = `${stateAbbr}:${role} — ${err.message?.slice(0, 100) || 'unknown error'}`;
          results.errors.push(msg);
          console.error(`[Cron/Insights] ${msg}`);

          // On rate limit, back off longer
          if (err.message?.includes('429')) {
            console.warn('[Cron/Insights] Rate limited — backing off 30s');
            await sleep(30_000);
          }
        }
      }
    }

    setLastFullBuild(new Date().toISOString());
  } finally {
    setBuildInProgress(false);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Cron/Insights] Build complete in ${durationSec}s — ${results.generated} generated, ${results.failed} failed, ${results.skipped} skipped`);

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
