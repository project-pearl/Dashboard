/* ------------------------------------------------------------------ */
/*  PIN Outreach — AI Audience Discovery                              */
/*  POST: discover audience segments from business profile            */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { checkRateLimit } from '@/lib/rateLimit';
import { loadProfile } from '@/lib/outreach/profileCache';
import { saveSegments, loadSegments } from '@/lib/outreach/segmentCache';
import { buildAudienceDiscoveryPrompt } from '@/lib/outreach/promptBuilder';
import { callOpenAI } from '@/lib/llmHelpers';
import type { AudienceSegment } from '@/lib/outreach/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await checkRateLimit('outreach-discover');
  if (rl) return rl;

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

  const { system, user } = buildAudienceDiscoveryPrompt(profile);

  try {
    const raw = await callOpenAI(apiKey, system, user, 'gpt-4o', 4000, 0.7);

    // Parse JSON from response (handle markdown fences)
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (!parsed.segments || !Array.isArray(parsed.segments)) {
      return NextResponse.json({ error: 'AI returned invalid segment format' }, { status: 500 });
    }

    const now = new Date().toISOString();
    const segments: AudienceSegment[] = parsed.segments.map((s: any, i: number) => ({
      id: `seg_${Date.now()}_${i}`,
      name: s.name || `Segment ${i + 1}`,
      description: s.description || '',
      roleMapping: s.roleMapping || 'Federal',
      painPoints: s.painPoints || [],
      buyingMotivations: s.buyingMotivations || [],
      objections: s.objections || [],
      decisionMakers: s.decisionMakers || [],
      toneGuidance: s.toneGuidance || '',
      priority: s.priority || 'medium',
      createdAt: now,
    }));

    // Merge with existing segments (replace if same name, add new)
    const existing = await loadSegments();
    const existingNames = new Set(existing.map(s => s.name));
    const merged = [
      ...existing.filter(s => !segments.some(ns => ns.name === s.name)),
      ...segments,
    ];

    await saveSegments(merged);

    return NextResponse.json({
      success: true,
      newSegments: segments.length,
      totalSegments: merged.length,
      segments,
    });
  } catch (err: any) {
    console.error('[Outreach] Audience discovery failed:', err.message);
    return NextResponse.json(
      { error: `AI discovery failed: ${err.message}` },
      { status: 500 },
    );
  }
}
