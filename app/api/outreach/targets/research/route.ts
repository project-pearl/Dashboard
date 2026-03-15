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
import type { TargetResearch } from '@/lib/outreach/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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

  // Use target data from the request body directly (avoids cross-function
  // cache miss on Vercel where each route is a separate serverless function).
  const { system, user } = buildTargetResearchPrompt(profile, {
    orgName: parsed.data.orgName,
    orgType: parsed.data.orgType,
    whyTarget: parsed.data.whyTarget,
  });

  try {
    console.log('[Outreach] Starting research for:', parsed.data.orgName);
    const raw = await callOpenAI(apiKey, system, user, 'gpt-4o', 4000, 0.7);
    console.log('[Outreach] AI response received, length:', raw.length);

    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('[Outreach] Cleaned JSON:', jsonStr.substring(0, 200) + '...');
    const research = JSON.parse(jsonStr);

    const aiResearch: TargetResearch = {
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

    // Best-effort: update the target in cache if found
    const targets = await loadTargets();
    const target = targets.find(t => t.id === parsed.data.targetId);
    if (target) {
      target.aiResearch = aiResearch;
      target.status = 'researched';
      await saveTargets(targets);
    }

    return NextResponse.json({
      success: true,
      target: target || {
        id: parsed.data.targetId,
        orgName: parsed.data.orgName,
        orgType: parsed.data.orgType,
        whyTarget: parsed.data.whyTarget,
        aiResearch,
        status: 'researched',
      },
    });
  } catch (err: any) {
    console.error('[Outreach] Target research failed:', err.message);
    return NextResponse.json(
      { error: `AI research failed: ${err.message}` },
      { status: 500 },
    );
  }
}
