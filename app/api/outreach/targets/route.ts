/* ------------------------------------------------------------------ */
/*  PIN Outreach — Targets CRUD                                       */
/*  GET: list all, POST: add new target                               */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { parseBody } from '@/lib/validateRequest';
import { outreachTargetSchema } from '@/lib/schemas';
import { loadTargets, saveTargets } from '@/lib/outreach/targetCache';
import type { OutreachTarget } from '@/lib/outreach/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const targets = await loadTargets();
  return NextResponse.json({ targets });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseBody(request, outreachTargetSchema);
  if (!parsed.success) return parsed.error;

  const targets = await loadTargets();

  // Check for duplicate org name (case-insensitive)
  if (targets.some(t => t.orgName.toLowerCase() === parsed.data.orgName.toLowerCase())) {
    return NextResponse.json({ error: 'Target with this organization name already exists' }, { status: 409 });
  }

  const target: OutreachTarget = {
    ...parsed.data,
    id: `tgt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  targets.push(target);
  await saveTargets(targets);

  return NextResponse.json({ success: true, target });
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

  const targets = await loadTargets();
  const filtered = targets.filter(t => t.id !== id);
  if (filtered.length === targets.length) {
    return NextResponse.json({ error: 'Target not found' }, { status: 404 });
  }

  await saveTargets(filtered);
  return NextResponse.json({ success: true });
}
