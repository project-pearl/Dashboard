// app/api/cron/route.ts
// Legacy insights cron — LLM-powered water quality insights with cache-first strategy.
import { NextRequest, NextResponse } from 'next/server';
import { getInsights } from '@/lib/insightsCache';

// ─── Config ──────────────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

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

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
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

    const body = await request.json();
    const { systemPrompt, userMessage } = body;

    if (!systemPrompt || !userMessage) {
      return NextResponse.json(
        { error: 'systemPrompt and userMessage required' },
        { status: 400 }
      );
    }

    // ── Cache-first: serve pre-generated insights if available ──
    try {
      const parsed = JSON.parse(userMessage);
      const state = parsed?.state || '';
      const role = parsed?.role || '';
      const hasWaterbody = !!parsed?.selectedWaterbody;

      if (state && role && !hasWaterbody) {
        const cached = getInsights(state, role);
        if (cached) {
          return NextResponse.json({
            insights: cached.insights,
            provider: cached.provider,
            generated: cached.generatedAt,
            cached: true,
          });
        }
      }
    } catch { /* parse failed — proceed to on-demand */ }

    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured.' },
        { status: 503 }
      );
    }

    const rawText = await callOpenAI(systemPrompt, userMessage);

    // Parse JSON array from response — LLM may wrap in markdown fences
    let insights: any[] = [];

    try {
      const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.warn('[AI-Insights] JSON parse failed, returning raw text');
      return NextResponse.json({ text: rawText, insights: [] });
    }

    // Validate insight structure
    insights = insights.filter(i =>
      i &&
      typeof i.title === 'string' &&
      typeof i.body === 'string' &&
      ['predictive', 'anomaly', 'comparison', 'recommendation', 'summary'].includes(i.type) &&
      ['info', 'warning', 'critical'].includes(i.severity)
    ).slice(0, 5);

    return NextResponse.json({
      insights,
      provider: 'openai',
      generated: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error('[AI-Insights]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate insights', insights: [] },
      { status: 500 }
    );
  }
}
