/* ------------------------------------------------------------------ */
/*  PIN Outreach — AI Profile Generation from Freeform Text           */
/*  POST: paste a description, get a structured business profile      */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { checkRateLimit } from '@/lib/rateLimit';
import { parseBody } from '@/lib/validateRequest';
import { outreachGenerateProfileSchema } from '@/lib/schemas';
import { buildProfileFromDescriptionPrompt } from '@/lib/outreach/promptBuilder';
import { callOpenAI } from '@/lib/llmHelpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await checkRateLimit('outreach-gen-profile');
  if (rl) return rl;

  const parsed = await parseBody(request, outreachGenerateProfileSchema);
  if (!parsed.success) return parsed.error;

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  const { system, user } = buildProfileFromDescriptionPrompt(parsed.data.description);

  try {
    const raw = await callOpenAI(apiKey, system, user, 'gpt-4o', 3000, 0.7);
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(jsonStr);

    return NextResponse.json({
      success: true,
      profile: {
        name: result.name || '',
        tagline: result.tagline || '',
        valueProps: result.valueProps || [],
        stats: result.stats || [],
        differentiators: result.differentiators || [],
      },
    });
  } catch (err: any) {
    console.error('[Outreach] Profile generation failed:', err.message);
    return NextResponse.json(
      { error: `Profile generation failed: ${err.message}` },
      { status: 500 },
    );
  }
}
