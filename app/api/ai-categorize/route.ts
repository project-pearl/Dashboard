import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are a water quality restoration categorizer. Given a custom item (module, partner, or event) with a name and description, return a JSON object with suggested categorization.

For modules, return:
{ "category": one of "Infrastructure"|"Interception"|"PEARL ALIA"|"Biological"|"Mechanical"|"Chemical"|"Source Control"|"DO Mgmt"|"Emerging", "pillars": array of "GW"|"SW"|"SurfW"|"DW"|"WW" }

For partners, return:
{ "category": a brief partner type like "Research & Science" or "Ecological Engineering", "pillars": array of pillar codes, "strengths": array of "monitoring"|"advocacy"|"habitat"|"engineering"|"education"|"funding"|"legal"|"research" }

For events, return:
{ "category": one of "Stewardship"|"Monitoring"|"Habitat"|"Restoration"|"Education"|"Engagement", "pillars": array of pillar codes }

Respond ONLY with valid JSON, no markdown or explanation.`;

export async function POST(request: Request) {
  try {
    const { type, name, description } = await request.json();

    if (!type || !name) {
      return NextResponse.json({ error: 'Missing type or name' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const userMessage = `Type: ${type}\nName: ${name}\nDescription: ${description || 'N/A'}`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Anthropic API error:', errText);
      return NextResponse.json({ error: 'AI categorization failed' }, { status: 502 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';

    // Parse the JSON response
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error('ai-categorize error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
