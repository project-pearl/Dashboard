import { NextRequest, NextResponse } from 'next/server';
import { resolutionPlanSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  const parsed = await parseBody(request, resolutionPlanSchema);
  if (!parsed.success) return parsed.error;
  const { prompt } = parsed.data;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[resolution-plan] OpenAI API error ${res.status}: ${body.slice(0, 500)}`);
    return NextResponse.json({ error: 'AI service error' }, { status: 502 });
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';

  return NextResponse.json({ text });
}
