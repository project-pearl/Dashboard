import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI, BRIEFING_QA_TONE, type BriefingQARole } from '@/lib/llmHelpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Simple in-memory rate limiter (10 req / 60s per IP) ─────────────────────
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const max = 10;
  const times = (hits.get(ip) || []).filter(t => now - t < window);
  if (times.length >= max) return true;
  times.push(now);
  hits.set(ip, times);
  return false;
}

// ── Internal fetch helper ───────────────────────────────────────────────────
async function fetchInternal(request: NextRequest, path: string): Promise<any> {
  const origin = request.nextUrl.origin;
  try {
    const res = await fetch(`${origin}${path}`, {
      headers: { 'Cookie': request.headers.get('cookie') || '' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  // Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.question !== 'string' || !body.question.trim()) {
    return NextResponse.json({ error: 'Missing question' }, { status: 400 });
  }

  const { question, role, state, jurisdiction, isMilitary } = body as {
    question: string;
    role: 'Federal' | 'State' | 'MS4' | 'Local';
    state?: string;
    jurisdiction?: string;
    isMilitary?: boolean;
  };

  // ── Gather role-specific context ──────────────────────────────────────────
  const sources: string[] = [];
  const contextParts: string[] = [];

  // Cache status — data freshness for all roles
  const cacheStatus = await fetchInternal(request, '/api/cache-status');
  if (cacheStatus) {
    sources.push('cache-status');
    const summaryLines = Object.entries(cacheStatus)
      .filter(([, v]: [string, any]) => v && typeof v === 'object' && v.lastUpdated)
      .map(([k, v]: [string, any]) => `${k}: ${v.recordCount ?? '?'} records, updated ${v.lastUpdated}`)
      .slice(0, 12);
    if (summaryLines.length) {
      contextParts.push(`Data freshness:\n${summaryLines.join('\n')}`);
    }
  }

  // Federal briefing metrics (Federal only)
  if (role === 'Federal') {
    const metrics = await fetchInternal(request, '/api/federal-briefing-metrics');
    if (metrics) {
      sources.push('federal-briefing-metrics');
      contextParts.push(`Federal metrics: ${JSON.stringify(metrics).slice(0, 800)}`);
    }
  }

  // NWS alerts (when state provided)
  if (state) {
    const alerts = await fetchInternal(request, `/api/nws-alerts?state=${state}`);
    if (alerts) {
      sources.push('nws-alerts');
      const alertSummary = Array.isArray(alerts)
        ? alerts.slice(0, 5).map((a: any) => `${a.event || a.headline || 'Alert'}: ${a.description?.slice(0, 120) || ''}`).join('\n')
        : JSON.stringify(alerts).slice(0, 600);
      contextParts.push(`Active NWS alerts for ${state}:\n${alertSummary}`);
    }
  }

  // Military CISA context
  if (isMilitary) {
    contextParts.push('CISA advisory posture: Monitor water/wastewater SCADA systems for active cyber threats. Current CISA alert level applies to all critical infrastructure sectors including water treatment and distribution.');
  }

  // ── Build system prompt ───────────────────────────────────────────────────
  const toneKey: BriefingQARole = (role === 'Federal' && isMilitary) ? 'Federal+Military' : role;
  const tone = BRIEFING_QA_TONE[toneKey] || BRIEFING_QA_TONE.Federal;

  const systemPrompt = [
    tone,
    'Answer the user\'s situational awareness question using the live data context below.',
    'Be concise (3-5 sentences). Cite specific numbers and timeframes when available.',
    'If data is insufficient to answer fully, say what you can and note what data would be needed.',
    contextParts.length ? `\n--- LIVE DATA CONTEXT ---\n${contextParts.join('\n\n')}` : '',
  ].filter(Boolean).join(' ');

  try {
    const answer = await callOpenAI(apiKey, systemPrompt, question, 'gpt-4o', 1500);
    return NextResponse.json({
      answer: answer || 'I wasn\'t able to generate an answer. Please try rephrasing your question.',
      sources,
    });
  } catch (err: any) {
    console.error(`[briefing-qa] AI error:`, err?.message || err);
    return NextResponse.json({ error: 'AI service error' }, { status: 502 });
  }
}
