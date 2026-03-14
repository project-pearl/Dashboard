/* ------------------------------------------------------------------ */
/*  PIN Alerts — Triage Queue API                                     */
/*  Supabase-backed CRUD for persistent alert triage workflow.        */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthorized } from '@/lib/apiAuth';
import { z } from 'zod';
import { parseBody } from '@/lib/validateRequest';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

/* ------------------------------------------------------------------ */
/*  GET — List triage items with optional filters                     */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.getAll('status');
  const state = searchParams.get('state');
  const assignedTo = searchParams.get('assigned_to');
  const alertType = searchParams.get('alert_type');
  const includeNotes = searchParams.get('include_notes') === 'true';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  let query = supabase
    .from('triage_items')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status.length > 0) query = query.in('status', status);
  if (state) query = query.eq('state', state);
  if (assignedTo) query = query.eq('assigned_to_uid', assignedTo);
  if (alertType) query = query.eq('alert_type', alertType);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = data || [];

  // Optionally embed notes for each item
  if (includeNotes && items.length > 0) {
    const ids = items.map(i => i.id);
    const { data: notes } = await supabase
      .from('triage_notes')
      .select('*')
      .in('triage_item_id', ids)
      .order('created_at', { ascending: false });

    const notesByItem = new Map<string, typeof notes>();
    for (const note of notes || []) {
      const arr = notesByItem.get(note.triage_item_id) || [];
      arr.push(note);
      notesByItem.set(note.triage_item_id, arr);
    }

    for (const item of items) {
      (item as Record<string, unknown>).notes = notesByItem.get(item.id) || [];
    }
  }

  return NextResponse.json({ items });
}

/* ------------------------------------------------------------------ */
/*  POST — Triage actions (acknowledge, assign, investigate, etc.)    */
/* ------------------------------------------------------------------ */

const triageActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('acknowledge'),
    item_id: z.string().uuid(),
    user_uid: z.string(),
    user_name: z.string(),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal('assign'),
    item_id: z.string().uuid(),
    assigned_to_uid: z.string(),
    assigned_to_name: z.string(),
    user_uid: z.string(),
    user_name: z.string(),
  }),
  z.object({
    action: z.literal('investigate'),
    item_id: z.string().uuid(),
    user_uid: z.string(),
    user_name: z.string(),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal('resolve'),
    item_id: z.string().uuid(),
    user_uid: z.string(),
    user_name: z.string(),
    resolution_note: z.string().min(1, 'Resolution note is required'),
  }),
  z.object({
    action: z.literal('add_note'),
    item_id: z.string().uuid(),
    user_uid: z.string(),
    user_name: z.string(),
    note: z.string().min(1),
  }),
  z.object({
    action: z.literal('reopen'),
    item_id: z.string().uuid(),
    user_uid: z.string(),
    user_name: z.string(),
    note: z.string().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const parsed = await parseBody(request, triageActionSchema);
  if (!parsed.success) return parsed.error;
  const body = parsed.data;

  const { action, item_id, user_uid, user_name } = body;

  // ── Acknowledge ──
  if (action === 'acknowledge') {
    const { error } = await supabase
      .from('triage_items')
      .update({ status: 'acknowledged', updated_at: new Date().toISOString() })
      .eq('id', item_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('triage_notes').insert({
      triage_item_id: item_id,
      user_uid, user_name,
      action: 'acknowledged',
      note: body.note || null,
    });

    return NextResponse.json({ ok: true, status: 'acknowledged' });
  }

  // ── Assign ──
  if (action === 'assign') {
    const { assigned_to_uid, assigned_to_name } = body;
    const { error } = await supabase
      .from('triage_items')
      .update({
        status: 'acknowledged',
        assigned_to_uid,
        assigned_to_name,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('triage_notes').insert({
      triage_item_id: item_id,
      user_uid, user_name,
      action: 'assigned',
      note: `Assigned to ${assigned_to_name}`,
    });

    return NextResponse.json({ ok: true, status: 'acknowledged' });
  }

  // ── Investigate ──
  if (action === 'investigate') {
    const { error } = await supabase
      .from('triage_items')
      .update({ status: 'investigating', updated_at: new Date().toISOString() })
      .eq('id', item_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('triage_notes').insert({
      triage_item_id: item_id,
      user_uid, user_name,
      action: 'investigating',
      note: body.note || null,
    });

    return NextResponse.json({ ok: true, status: 'investigating' });
  }

  // ── Resolve ──
  if (action === 'resolve') {
    const { resolution_note } = body;
    const { error } = await supabase
      .from('triage_items')
      .update({
        status: 'resolved',
        resolved_by_uid: user_uid,
        resolved_by_name: user_name,
        resolution_note,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('triage_notes').insert({
      triage_item_id: item_id,
      user_uid, user_name,
      action: 'resolved',
      note: resolution_note,
    });

    return NextResponse.json({ ok: true, status: 'resolved' });
  }

  // ── Add Note ──
  if (action === 'add_note') {
    await supabase.from('triage_notes').insert({
      triage_item_id: item_id,
      user_uid, user_name,
      action: 'note',
      note: body.note,
    });

    return NextResponse.json({ ok: true });
  }

  // ── Reopen ──
  if (action === 'reopen') {
    const { error } = await supabase
      .from('triage_items')
      .update({
        status: 'pending',
        resolved_by_uid: null,
        resolved_by_name: null,
        resolution_note: null,
        resolved_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('triage_notes').insert({
      triage_item_id: item_id,
      user_uid, user_name,
      action: 'reopened',
      note: body.note || null,
    });

    return NextResponse.json({ ok: true, status: 'pending' });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
