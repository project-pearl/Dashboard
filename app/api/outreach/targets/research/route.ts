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
    console.log('[Outreach] OpenAI API key available:', !!apiKey);
    console.log('[Outreach] System prompt length:', system.length);
    console.log('[Outreach] User prompt length:', user.length);

    const startTime = Date.now();
    const raw = await callOpenAI(apiKey, system, user, 'gpt-4o', 4000, 0.7);
    const endTime = Date.now();

    console.log('[Outreach] AI response received in', endTime - startTime, 'ms, length:', raw.length);
    console.log('[Outreach] Raw response preview:', raw.substring(0, 300) + '...');

    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('[Outreach] Cleaned JSON:', jsonStr.substring(0, 200) + '...');

    if (!jsonStr || jsonStr.length < 10) {
      throw new Error('Empty or invalid AI response');
    }

    let research;
    try {
      research = JSON.parse(jsonStr);
      console.log('[Outreach] Parsed JSON successfully');
    } catch (parseErr: any) {
      console.error('[Outreach] JSON parse failed:', parseErr.message);
      console.error('[Outreach] Raw JSON string:', jsonStr);
      throw new Error(`Invalid JSON response: ${parseErr.message}`);
    }

    // Validate research structure
    if (!research || typeof research !== 'object') {
      console.error('[Outreach] Research is not an object:', typeof research);
      throw new Error('AI returned non-object response');
    }

    // Validate and log each field
    console.log('[Outreach] Research fields:', {
      summary: !!research.summary,
      relevance: !!research.relevance,
      keyRoles: Array.isArray(research.keyRoles) ? research.keyRoles.length : 'not array',
      painPoints: Array.isArray(research.painPoints) ? research.painPoints.length : 'not array',
      talkingPoints: Array.isArray(research.talkingPoints) ? research.talkingPoints.length : 'not array',
      budgetCycle: !!research.budgetCycle,
      recentNews: Array.isArray(research.recentNews) ? research.recentNews.length : 'not array',
      approachStrategy: !!research.approachStrategy,
    });

    const aiResearch: TargetResearch = {
      summary: research.summary || 'No summary available',
      relevance: research.relevance || 'Relevance not determined',
      keyRoles: Array.isArray(research.keyRoles) ? research.keyRoles : [],
      painPoints: Array.isArray(research.painPoints) ? research.painPoints : [],
      talkingPoints: Array.isArray(research.talkingPoints) ? research.talkingPoints : [],
      budgetCycle: research.budgetCycle || 'Budget cycle unknown',
      recentNews: Array.isArray(research.recentNews) ? research.recentNews : [],
      approachStrategy: research.approachStrategy || 'Approach strategy not available',
      generatedAt: new Date().toISOString(),
    };

    console.log('[Outreach] Generated aiResearch object:', {
      summaryLength: aiResearch.summary.length,
      keyRolesCount: aiResearch.keyRoles.length,
      painPointsCount: aiResearch.painPoints.length,
    });

    // Best-effort: update the target in cache if found
    const targets = await loadTargets();
    console.log('[Outreach] Loaded', targets.length, 'targets from cache');
    const target = targets.find(t => t.id === parsed.data.targetId);
    console.log('[Outreach] Target found:', !!target, 'for ID:', parsed.data.targetId);
    if (target) {
      target.aiResearch = aiResearch;
      target.status = 'researched';
      console.log('[Outreach] Updated target status to researched');
      await saveTargets(targets);
      console.log('[Outreach] Saved targets to cache');
    } else {
      console.warn('[Outreach] Target not found in cache, returning synthetic target');
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
