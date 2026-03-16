/* ------------------------------------------------------------------ */
/*  PIN Outreach — Segments CRUD                                      */
/*  GET: list all, POST: add one, PUT: update one                     */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { parseBody } from '@/lib/validateRequest';
import { outreachSegmentSchema } from '@/lib/schemas';
import { loadSegments, saveSegments } from '@/lib/outreach/segmentCache';
import type { AudienceSegment } from '@/lib/outreach/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const segments = await loadSegments();
  return NextResponse.json({ segments });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseBody(request, outreachSegmentSchema);
  if (!parsed.success) return parsed.error;

  const d = parsed.data;
  const segment: AudienceSegment = {
    id: `seg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: d.name,
    description: d.description,
    roleMapping: d.roleMapping,
    painPoints: d.painPoints ?? [],
    buyingMotivations: d.buyingMotivations ?? [],
    objections: d.objections ?? [],
    decisionMakers: d.decisionMakers ?? [],
    toneGuidance: d.toneGuidance ?? '',
    priority: d.priority ?? 'medium',
    createdAt: new Date().toISOString(),
  };

  const segments = await loadSegments();
  segments.push(segment);
  await saveSegments(segments);

  return NextResponse.json({ success: true, segment });
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }

  const segments = await loadSegments();
  const filtered = segments.filter(s => s.id !== id);
  if (filtered.length === segments.length) {
    return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
  }

  await saveSegments(filtered);
  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseBody(request, outreachSegmentSchema);
  if (!parsed.success) return parsed.error;

  if (!parsed.data.id) {
    return NextResponse.json({ error: 'id is required for updates' }, { status: 400 });
  }

  const segments = await loadSegments();
  const idx = segments.findIndex(s => s.id === parsed.data.id);
  if (idx < 0) {
    return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
  }

  segments[idx] = { ...segments[idx], ...parsed.data };
  await saveSegments(segments);

  return NextResponse.json({ success: true, segment: segments[idx] });
}
