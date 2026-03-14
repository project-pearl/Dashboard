import { NextRequest, NextResponse } from 'next/server';
import { UNIVERSAL_QA_TONE, type UniversalQARole } from '@/lib/llmHelpers';
import { askPinUniversalSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';
import { checkRateLimit } from '@/lib/rateLimit';
import { buildAskPinContext } from '@/lib/askPinContext';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  // Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rateLimited = await checkRateLimit(ip);
  if (rateLimited) return rateLimited;

  const parsed = await parseBody(request, askPinUniversalSchema);
  if (!parsed.success) return parsed.error;
  const { question, role, state, jurisdiction, isMilitary, conversationHistory } = parsed.data;

  // ── Build context from caches directly ───────────────────────────────────────
  const { context, sources } = await buildAskPinContext({ question, role, state: state ?? null, isMilitary: isMilitary ?? false });

  // ── Jurisdiction context ──────────────────────────────────────────────────
  const jurisdictionLine = jurisdiction ? `User jurisdiction: ${jurisdiction}` : '';

  // ── Military CISA context ─────────────────────────────────────────────────
  const cisaLine = isMilitary
    ? 'CISA advisory posture: Monitor water/wastewater SCADA systems for active cyber threats. Current CISA alert level applies to all critical infrastructure sectors including water treatment and distribution.'
    : '';

  // ── Build system prompt ───────────────────────────────────────────────────
  const toneKey: UniversalQARole = (role === 'Federal' && isMilitary) ? 'Federal+Military' : role;
  const tone = UNIVERSAL_QA_TONE[toneKey] || UNIVERSAL_QA_TONE.Federal;

  const systemPrompt = [
    tone,
    'Answer the user\'s question using ONLY the live data context below.',
    'Be direct and substantive — cite specific states, numbers, and trends when available.',
    'STRICT RULES:',
    '1. IMPAIRED is always a SUBSET of ASSESSED — impaired count must be ≤ total assessed. Double-check before stating.',
    '2. "Data monitoring score" measures data availability and freshness, NOT actual water quality. Never describe it as water quality.',
    '3. Never invent metrics, scores, indices, or rankings not present in the data. If you do not see a specific number, do not fabricate one.',
    '4. For national-level questions, cite 4-6 diverse states from different regions — do not focus on one or two.',
    '5. Cross-agency correlations show spatial proximity, NOT proven causation. Say "co-located" or "spatially correlated," never "caused by."',
    '6. Do not claim trends (increasing, decreasing, worsening) unless the data explicitly shows time-series comparisons. A single snapshot is not a trend.',
    '7. When the data says "violations on record" or "violation records," these are cumulative records, not necessarily all currently active.',
    'If data is insufficient to answer fully, say what you can and note what data would be needed.',
    'Keep answers concise but thorough (3-5 paragraphs max).',
    jurisdictionLine,
    cisaLine,
    context ? `\n--- LIVE DATA CONTEXT ---\n${context}` : '',
  ].filter(Boolean).join(' ');

  // ── Build messages array with conversation history ────────────────────────
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Include up to 5 prior Q&A pairs for context
  if (conversationHistory?.length) {
    for (const msg of conversationHistory.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: 'user', content: question });

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const aiData = await res.json();
    const answer = aiData?.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      answer: answer || 'I wasn\'t able to generate an answer. Please try rephrasing your question.',
      sources,
    });
  } catch (err: any) {
    console.error(`[ask-pin-universal] AI error:`, err?.message || err);
    return NextResponse.json({ error: 'AI service error' }, { status: 502 });
  }
}
