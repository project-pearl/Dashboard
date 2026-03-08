/* ------------------------------------------------------------------ */
/*  PIN Alerts — Suppressions Endpoint                                */
/*  POST/DELETE: Add or remove alert suppressions                     */
/* ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { loadSuppressions, saveSuppressions } from '@/lib/alerts/suppressions';
import type { AlertSuppression } from '@/lib/alerts/types';
import { alertSuppressCreateSchema, alertSuppressDeleteSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';

import { isAuthorized } from '@/lib/apiAuth';

function checkAuth(request: NextRequest): boolean {
  return isAuthorized(request);
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

  const parsed = await parseBody(request, alertSuppressCreateSchema);
  if (!parsed.success) return parsed.error;
  const body = parsed.data;

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

  const parsed = await parseBody(request, alertSuppressDeleteSchema);
  if (!parsed.success) return parsed.error;
  const body = parsed.data;

  const suppressions = await loadSuppressions();
  const filtered = suppressions.filter(s => s.id !== body.id);

  if (filtered.length === suppressions.length) {
    return NextResponse.json({ error: 'Suppression not found' }, { status: 404 });
  }

  await saveSuppressions(filtered);

  return NextResponse.json({ status: 'ok', message: `Removed suppression ${body.id}` });
}
