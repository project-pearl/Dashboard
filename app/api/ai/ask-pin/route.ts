import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI, ROLE_TONE, type Role } from '@/lib/llmHelpers';

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

  const { sectionId, label, question, role, kbContext } = body as {
    sectionId?: string;
    label?: string;
    question: string;
    role?: string;
    kbContext?: string;
  };

  // Build system prompt
  const roleTone = ROLE_TONE[(role || 'Federal') as Role] || ROLE_TONE.Federal;
  const systemPrompt = [
    'You are a water quality dashboard assistant for the PEARL Intelligence Network (PIN).',
    label ? `Answer the user\'s question about the "${label}" card.` : 'Answer the user\'s question about the dashboard.',
    'Be concise (2-4 sentences). If you don\'t know, say so.',
    kbContext ? `Context about the card: ${kbContext}` : '',
    roleTone,
  ].filter(Boolean).join(' ');

  try {
    const answer = await callOpenAI(apiKey, systemPrompt, question, 'gpt-4o-mini', 500);
    return NextResponse.json({ answer: answer || 'I wasn\'t able to generate an answer. Please try rephrasing your question.' });
  } catch (err: any) {
    console.error(`[ask-pin] AI error:`, err?.message || err);
    return NextResponse.json({ error: 'AI service error' }, { status: 502 });
  }
}
