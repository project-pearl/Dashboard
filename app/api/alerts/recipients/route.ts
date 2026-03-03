/* ------------------------------------------------------------------ */
/*  PIN Alerts — Recipients CRUD Endpoint                             */
/*  GET/POST/PUT/DELETE: Manage alert recipients                      */
/* ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { loadRecipients, saveRecipients } from '@/lib/alerts/recipients';
import type { AlertRecipient } from '@/lib/alerts/types';

import { isAuthorized } from '@/lib/apiAuth';

function checkAuth(request: NextRequest): boolean {
  return isAuthorized(request);
}

// GET — list all recipients
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const recipients = await loadRecipients();
  return NextResponse.json({ recipients });
}

// POST — add a new recipient
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Partial<AlertRecipient>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.email || !body.name) {
    return NextResponse.json({ error: 'email and name required' }, { status: 400 });
  }

  const recipients = await loadRecipients();

  // Check for duplicate email
  if (recipients.some(r => r.email === body.email)) {
    return NextResponse.json({ error: 'Recipient with this email already exists' }, { status: 409 });
  }

  const newRecipient: AlertRecipient = {
    email: body.email,
    name: body.name,
    role: body.role || 'admin',
    state: body.state || null,
    triggers: body.triggers || ['sentinel', 'delta', 'attains'],
    severities: body.severities || ['critical', 'warning'],
    active: body.active !== false,
  };

  recipients.push(newRecipient);
  await saveRecipients(recipients);

  return NextResponse.json({ status: 'ok', recipient: newRecipient }, { status: 201 });
}

// PUT — update a recipient by email
export async function PUT(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Partial<AlertRecipient> & { email: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  const recipients = await loadRecipients();
  const idx = recipients.findIndex(r => r.email === body.email);

  if (idx === -1) {
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
  }

  const updated = { ...recipients[idx], ...body };
  recipients[idx] = updated;
  await saveRecipients(recipients);

  return NextResponse.json({ status: 'ok', recipient: updated });
}

// DELETE — remove a recipient by email
export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  const recipients = await loadRecipients();
  const filtered = recipients.filter(r => r.email !== body.email);

  if (filtered.length === recipients.length) {
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
  }

  await saveRecipients(filtered);

  return NextResponse.json({ status: 'ok', message: `Removed ${body.email}` });
}
