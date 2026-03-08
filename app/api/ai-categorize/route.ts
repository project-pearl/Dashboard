import { NextResponse } from 'next/server';
import { aiCategorizeSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are a water quality restoration categorizer. Given a custom item (module, partner, or event) with a name and description, return a JSON object with suggested categorization.

For modules, return:
{ "category": one of "Infrastructure"|"Interception"|"PIN"|"Biological"|"Mechanical"|"Chemical"|"Source Control"|"DO Mgmt"|"Emerging", "pillars": array of "GW"|"SW"|"SurfW"|"DW"|"WW" }

For partners, return:
{ "category": a brief partner type like "Research & Science" or "Ecological Engineering", "pillars": array of pillar codes, "strengths": array of "monitoring"|"advocacy"|"habitat"|"engineering"|"education"|"funding"|"legal"|"research" }

For events, return:
{ "category": one of "Stewardship"|"Monitoring"|"Habitat"|"Restoration"|"Education"|"Engagement", "pillars": array of pillar codes }

Respond ONLY with valid JSON, no markdown or explanation.`;

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, aiCategorizeSchema);
    if (!parsed.success) return parsed.error;
    const { type, name, description } = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const userMessage = `Type: ${type}\nName: ${name}\nDescription: ${description || 'N/A'}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 256,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenAI API error:', errText);
      return NextResponse.json({ error: 'AI categorization failed' }, { status: 502 });
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '{}';

    // Parse the JSON response
    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch (err) {
    console.error('ai-categorize error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
