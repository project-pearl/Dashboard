/* ------------------------------------------------------------------ */
/*  PIN Alerts — Rules CRUD Endpoint                                  */
/*  GET/POST/DELETE: Manage custom alert rules                        */
/* ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { loadRules, saveRules } from '@/lib/alerts/rules';
import type { AlertRule } from '@/lib/alerts/types';

import { isAuthorized } from '@/lib/apiAuth';

function checkAuth(request: NextRequest): boolean {
  return isAuthorized(request);
}

// GET — list all rules
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rules = await loadRules();
  return NextResponse.json({ rules });
}

// POST — add a new rule
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Partial<AlertRule>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.name || !body.condition) {
    return NextResponse.json({ error: 'name and condition required' }, { status: 400 });
  }

  const rules = await loadRules();

  const newRule: AlertRule = {
    id: crypto.randomUUID(),
    name: body.name,
    triggerType: body.triggerType || 'custom',
    condition: body.condition,
    severity: body.severity || 'warning',
    enabled: body.enabled !== false,
    createdBy: body.createdBy || 'admin',
    createdAt: new Date().toISOString(),
  };

  rules.push(newRule);
  await saveRules(rules);

  return NextResponse.json({ status: 'ok', rule: newRule }, { status: 201 });
}

// DELETE — remove a rule by id
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

  const rules = await loadRules();
  const filtered = rules.filter(r => r.id !== body.id);

  if (filtered.length === rules.length) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  await saveRules(filtered);

  return NextResponse.json({ status: 'ok', message: `Removed rule ${body.id}` });
}
