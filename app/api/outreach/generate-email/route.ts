/* ------------------------------------------------------------------ */
/*  PIN Outreach — AI Email Generation                                */
/*  POST: generate email draft for a segment                          */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { checkRateLimit } from '@/lib/rateLimit';
import { parseBody } from '@/lib/validateRequest';
import { outreachEmailGenerateSchema } from '@/lib/schemas';
import { loadProfile } from '@/lib/outreach/profileCache';
import { loadSegments } from '@/lib/outreach/segmentCache';
import { buildEmailGeneratePrompt } from '@/lib/outreach/promptBuilder';
import { callOpenAI } from '@/lib/llmHelpers';
import type { EmailDraft } from '@/lib/outreach/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await checkRateLimit('outreach-generate');
  if (rl) return rl;

  const parsed = await parseBody(request, outreachEmailGenerateSchema);
  if (!parsed.success) return parsed.error;

  const { segmentId, campaignGoal } = parsed.data;

  const profile = await loadProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Business profile not configured' }, { status: 400 });
  }

  const segments = await loadSegments();
  const segment = segments.find(s => s.id === segmentId);
  if (!segment) {
    return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  const { system, user } = buildEmailGeneratePrompt(profile, segment, campaignGoal);

  try {
    const raw = await callOpenAI(apiKey, system, user, 'gpt-4o', 3000, 0.7);

    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(jsonStr);

    const draft: EmailDraft = {
      segmentId,
      subjectLines: result.subjectLines || ['Subject line'],
      selectedSubject: 0,
      htmlBody: result.htmlBody || '<p>Email body</p>',
      textBody: result.textBody || 'Email body',
      personalizationTokens: result.personalizationTokens || [],
      version: 1,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, draft });
  } catch (err: any) {
    console.error('[Outreach] Email generation failed:', err.message);
    return NextResponse.json(
      { error: `Email generation failed: ${err.message}` },
      { status: 500 },
    );
  }
}
