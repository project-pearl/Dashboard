/* ------------------------------------------------------------------ */
/*  PIN Outreach — AI Target Research                                 */
/*  POST: AI researches a specific target org                         */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { checkRateLimit } from '@/lib/rateLimit';
import { parseBody } from '@/lib/validateRequest';
import { outreachTargetResearchSchema } from '@/lib/schemas';
import { loadProfile } from '@/lib/outreach/profileCache';
import { loadTargets, saveTargets } from '@/lib/outreach/targetCache';
import { buildTargetResearchPrompt } from '@/lib/outreach/promptBuilder';
import { callOpenAI } from '@/lib/llmHelpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await checkRateLimit('outreach-target-research');
  if (rl) return rl;

  const parsed = await parseBody(request, outreachTargetResearchSchema);
  if (!parsed.success) return parsed.error;

  const profile = await loadProfile();
  if (!profile) {
    return NextResponse.json(
      { error: 'Business profile not configured. Set up your profile first.' },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
  }

  const targets = await loadTargets();
  const target = targets.find(t => t.id === parsed.data.targetId);
  if (!target) {
    return NextResponse.json({ error: 'Target not found' }, { status: 404 });
  }

  const { system, user } = buildTargetResearchPrompt(profile, target);

  try {
    const raw = await callOpenAI(apiKey, system, user, 'gpt-4o', 4000, 0.7);

    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const research = JSON.parse(jsonStr);

    target.aiResearch = {
      summary: research.summary || '',
      relevance: research.relevance || '',
      keyRoles: research.keyRoles || [],
      painPoints: research.painPoints || [],
      talkingPoints: research.talkingPoints || [],
      budgetCycle: research.budgetCycle,
      recentNews: research.recentNews,
      approachStrategy: research.approachStrategy || '',
      generatedAt: new Date().toISOString(),
    };
    target.status = 'researched';

    await saveTargets(targets);

    return NextResponse.json({ success: true, target });
  } catch (err: any) {
    console.error('[Outreach] Target research failed:', err.message);
    return NextResponse.json(
      { error: `AI research failed: ${err.message}` },
      { status: 500 },
    );
  }
}
