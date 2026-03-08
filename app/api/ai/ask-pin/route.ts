import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI, ROLE_TONE, type Role } from '@/lib/llmHelpers';
import { askPinSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';
import { checkRateLimit } from '@/lib/rateLimit';

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

  const parsed = await parseBody(request, askPinSchema);
  if (!parsed.success) return parsed.error;
  const { sectionId, label, question, role, kbContext } = parsed.data;

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
