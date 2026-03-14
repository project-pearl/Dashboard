// app/api/ai-insights/route.ts
// LLM-powered water quality insights — serves pre-generated cache when available,
// falls back to on-demand generation. Receives context from AIInsightsEngine.
import { NextRequest, NextResponse } from 'next/server';
import { getInsights, ensureWarmed as warmInsights } from '@/lib/insightsCache';
import { aiInsightsSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';
import { checkRateLimit } from '@/lib/rateLimit';

// ─── OpenAI ──────────────────────────────────────────────────────────────────

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
      temperature: 0.3,
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
    const rateLimited = await checkRateLimit(ip);
    if (rateLimited) return rateLimited;

    // Read API key at request time (not module scope) so Vercel env vars are always fresh
    const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();

    const parsed = await parseBody(request, aiInsightsSchema);
    if (!parsed.success) return parsed.error;
    const { systemPrompt, userMessage } = parsed.data;

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
    } catch (cacheErr: unknown) {
      cacheStatus = 'error';
      const msg = cacheErr instanceof Error ? cacheErr.message : 'Unknown error';
      console.warn(`[AI-Insights] Cache lookup failed: ${msg} — proceeding to on-demand LLM`);
    }

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured.', stage: 'provider-check' },
        { status: 503 }
      );
    }

    let rawText = '';
    try {
      rawText = await callOpenAI(OPENAI_API_KEY, systemPrompt, userMessage);
    } catch (llmErr: unknown) {
      const msg = llmErr instanceof Error ? llmErr.message : 'Unknown LLM error';
      console.error(`[AI-Insights] OpenAI call failed for ${requestState}:${requestRole}: ${msg}`);
      return NextResponse.json(
        { error: 'AI service unavailable', stage: 'llm-call', cacheStatus, insights: [] },
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
        { error: 'LLM returned unparseable response', stage: 'json-parse', provider: 'openai', state: requestState, role: requestRole, cacheStatus, insights: [] },
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
      provider: 'openai',
      generated: new Date().toISOString(),
      cacheStatus,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[AI-Insights] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Failed to generate insights', stage: 'unhandled', insights: [] },
      { status: 500 }
    );
  }
}
