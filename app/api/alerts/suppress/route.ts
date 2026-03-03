/* ------------------------------------------------------------------ */
/*  PIN Alerts — Suppressions Endpoint                                */
/*  POST/DELETE: Add or remove alert suppressions                     */
/* ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { loadSuppressions, saveSuppressions } from '@/lib/alerts/suppressions';
import type { AlertSuppression } from '@/lib/alerts/types';

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const hasCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const hasSessionCookie = request.cookies.has('pin_session');
  return !!(hasCronAuth || hasSessionCookie);
}

// GET — list all suppressions
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const suppressions = await loadSuppressions();
  return NextResponse.json({ suppressions });
}

// POST — add a new suppression
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { dedupKey?: string; reason?: string; expiresAt?: string | null; createdBy?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.dedupKey || !body.reason) {
    return NextResponse.json({ error: 'dedupKey and reason required' }, { status: 400 });
  }

  const suppressions = await loadSuppressions();

  const newSuppression: AlertSuppression = {
    id: crypto.randomUUID(),
    dedupKey: body.dedupKey,
    reason: body.reason,
    expiresAt: body.expiresAt || null,
    createdBy: body.createdBy || 'admin',
    createdAt: new Date().toISOString(),
  };

  suppressions.push(newSuppression);
  await saveSuppressions(suppressions);

  return NextResponse.json({ status: 'ok', suppression: newSuppression }, { status: 201 });
}

// DELETE — remove a suppression by id
export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const suppressions = await loadSuppressions();
  const filtered = suppressions.filter(s => s.id !== body.id);

  if (filtered.length === suppressions.length) {
    return NextResponse.json({ error: 'Suppression not found' }, { status: 404 });
  }

  await saveSuppressions(filtered);

  return NextResponse.json({ status: 'ok', message: `Removed suppression ${body.id}` });
}
