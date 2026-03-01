// app/api/ai-insights/route.ts
// LLM-powered water quality insights — serves pre-generated cache when available,
// falls back to on-demand generation. Receives context from AIInsightsEngine.
import { NextRequest, NextResponse } from 'next/server';
import { getInsights, ensureWarmed as warmInsights } from '@/lib/insightsCache';

// ─── Config ──────────────────────────────────────────────────────────────────

// Rate limit: simple in-memory throttle (per-deployment, resets on cold start)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

// ─── Anthropic Claude ────────────────────────────────────────────────────────

async function callAnthropic(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error(`[AI-Insights] Anthropic error ${res.status}: ${errBody.slice(0, 300)}`);
    throw new Error(`Anthropic API error: ${res.status} — ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

// ─── OpenAI Fallback ─────────────────────────────────────────────────────────

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
    console.error(`[AI-Insights] OpenAI error ${res.status}: ${errBody.slice(0, 300)}`);
    throw new Error(`OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

// ─── POST Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP (basic protection)
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again in a minute.' },
        { status: 429 }
      );
    }

    // Read API keys at request time (not module scope) so Vercel env vars are always fresh
    const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
    const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
    console.log('[AI-Insights] ENV CHECK:', {
      hasAnthropicKey: !!ANTHROPIC_API_KEY,
      anthropicKeyLen: ANTHROPIC_API_KEY.length,
      anthropicKeyPrefix: ANTHROPIC_API_KEY.slice(0, 7),
      hasOpenAIKey: !!OPENAI_API_KEY,
    });

    const body = await request.json();
    const { systemPrompt, userMessage } = body;

    if (!systemPrompt || !userMessage) {
      return NextResponse.json(
        { error: 'systemPrompt and userMessage required' },
        { status: 400 }
      );
    }

    // ── Cache-first: serve pre-generated insights if available ──
    // Cron job pre-generates for state/role combos every 6 hours
    // Only fall through to on-demand LLM call if cache misses
    let cacheStatus: 'hit' | 'miss' | 'skipped' | 'error' = 'skipped';
    let requestState = '';
    let requestRole = '';
    try {
      const parsed = JSON.parse(userMessage);
      requestState = parsed?.state || '';
      requestRole = parsed?.role || '';
      const hasWaterbody = !!parsed?.selectedWaterbody;

      // Cache is keyed by state:role — only use for general views (no specific waterbody)
      if (requestState && requestRole && !hasWaterbody) {
        await warmInsights();
        const cached = getInsights(requestState, requestRole);
        if (cached) {
          cacheStatus = 'hit';
          return NextResponse.json({
            insights: cached.insights,
            provider: cached.provider,
            generated: cached.generatedAt,
            cached: true,
          });
        }
        cacheStatus = 'miss';
        console.log(`[AI-Insights] Cache miss for ${requestState}:${requestRole} — falling through to on-demand LLM`);
      }
    } catch (cacheErr: any) {
      cacheStatus = 'error';
      console.warn(`[AI-Insights] Cache lookup failed: ${cacheErr.message} — proceeding to on-demand LLM`);
    }

    // Pick provider: Anthropic preferred, OpenAI fallback
    const provider = ANTHROPIC_API_KEY ? 'anthropic' : OPENAI_API_KEY ? 'openai' : null;
    if (!provider) {
      return NextResponse.json(
        { error: 'No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in environment.', stage: 'provider-check' },
        { status: 503 }
      );
    }

    let rawText = '';
    try {
      if (provider === 'anthropic') {
        rawText = await callAnthropic(ANTHROPIC_API_KEY, systemPrompt, userMessage);
      } else {
        rawText = await callOpenAI(OPENAI_API_KEY, systemPrompt, userMessage);
      }
    } catch (llmErr: any) {
      const msg = llmErr.message || 'Unknown LLM error';
      console.error(`[AI-Insights] ${provider} call failed for ${requestState}:${requestRole}: ${msg}`);
      return NextResponse.json(
        { error: `${provider} call failed: ${msg}`, stage: 'llm-call', provider, state: requestState, role: requestRole, cacheStatus, insights: [] },
        { status: 502 }
      );
    }

    // Parse JSON array from response — LLM may wrap in markdown fences
    let insights: any[] = [];

    try {
      // Strip markdown fences if present
      const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.warn(`[AI-Insights] JSON parse failed for ${requestState}:${requestRole}. Raw text (first 200): ${rawText.slice(0, 200)}`);
      return NextResponse.json(
        { error: `LLM returned unparseable response from ${provider}`, stage: 'json-parse', provider, state: requestState, role: requestRole, cacheStatus, insights: [] },
        { status: 502 }
      );
    }

    // Validate insight structure
    const preFilterCount = insights.length;
    insights = insights.filter(i =>
      i &&
      typeof i.title === 'string' &&
      typeof i.body === 'string' &&
      ['predictive', 'anomaly', 'comparison', 'recommendation', 'summary'].includes(i.type) &&
      ['info', 'warning', 'critical'].includes(i.severity)
    ).slice(0, 5);

    if (insights.length === 0 && preFilterCount > 0) {
      console.warn(`[AI-Insights] All ${preFilterCount} insights filtered out for ${requestState}:${requestRole} — invalid structure`);
    }

    return NextResponse.json({
      insights,
      provider,
      generated: new Date().toISOString(),
      cacheStatus,
    });

  } catch (err: any) {
    console.error('[AI-Insights] Unhandled error:', err.message || err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate insights', stage: 'unhandled', insights: [], detail: String(err.message || '').slice(0, 300) },
      { status: 500 }
    );
  }
}
