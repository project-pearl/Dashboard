/* ------------------------------------------------------------------ */
/*  PIN Outreach — Contacts CRUD                                      */
/*  GET: list all, POST: add new contact                              */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { parseBody } from '@/lib/validateRequest';
import { outreachContactSchema } from '@/lib/schemas';
import { loadContacts, saveContacts } from '@/lib/outreach/contactCache';
import type { OutreachContact } from '@/lib/outreach/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const contacts = await loadContacts();
  return NextResponse.json({ contacts });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = await parseBody(request, outreachContactSchema);
  if (!parsed.success) return parsed.error;

  const contacts = await loadContacts();

  // Check for duplicate email
  if (contacts.some(c => c.email.toLowerCase() === parsed.data.email.toLowerCase())) {
    return NextResponse.json({ error: 'Contact with this email already exists' }, { status: 409 });
  }

  const contact: OutreachContact = {
    ...parsed.data,
    id: `con_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  contacts.push(contact);
  await saveContacts(contacts);

  return NextResponse.json({ success: true, contact });
}
