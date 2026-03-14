/* ------------------------------------------------------------------ */
/*  MS4 Compliance Calendar API                                       */
/*  GET  — merged auto + user events                                  */
/*  POST — CRUD for user-created events                               */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthorized } from '@/lib/apiAuth';
import { z } from 'zod';
import { parseBody } from '@/lib/validateRequest';
import { ensureWarmed as warmMs4 } from '@/lib/ms4PermitCache';
import { ensureWarmed as warmIcis } from '@/lib/icisCache';
import { ensureWarmed as warmSdwis } from '@/lib/sdwisCache';
import { getAutoPopulatedEvents, type CalendarEvent } from '@/lib/complianceCalendarEvents';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

/* ------------------------------------------------------------------ */
/*  GET — Merged event list                                           */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  if (!state) {
    return NextResponse.json({ error: 'state parameter required' }, { status: 400 });
  }

  const orgId = searchParams.get('org_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const statusFilter = searchParams.get('status');

  // Warm caches in parallel
  await Promise.all([warmMs4(), warmIcis(), warmSdwis()]);

  // Auto-populated events from caches
  let events: CalendarEvent[] = getAutoPopulatedEvents(state);

  // User-created events from Supabase
  const supabase = getSupabase();
  if (supabase) {
    let query = supabase
      .from('compliance_events')
      .select('*')
      .eq('state', state.toUpperCase())
      .order('event_date', { ascending: true });

    if (orgId) query = query.eq('org_id', orgId);
    if (from) query = query.gte('event_date', from);
    if (to) query = query.lte('event_date', to);
    if (statusFilter) query = query.eq('status', statusFilter);

    const { data: userRows } = await query;

    if (userRows) {
      for (const row of userRows) {
        const dateStr = typeof row.event_date === 'string' ? row.event_date.split('T')[0] : row.event_date;
        const days = Math.round(
          (new Date(dateStr + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000,
        );
        events.push({
          id: row.id,
          title: row.title,
          description: row.description || undefined,
          date: dateStr,
          type: row.event_type,
          category: row.category,
          priority: row.priority as CalendarEvent['priority'],
          status: row.status as CalendarEvent['status'],
          source: 'user',
          permitId: row.permit_id || undefined,
          facilityName: row.facility_name || undefined,
          daysUntil: days,
        });
      }
    }
  }

  // Apply date range filters to auto events too
  if (from) events = events.filter(e => e.date >= from);
  if (to) events = events.filter(e => e.date <= to);
  if (statusFilter) events = events.filter(e => e.status === statusFilter);

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ events });
}

/* ------------------------------------------------------------------ */
/*  POST — User event CRUD                                            */
/* ------------------------------------------------------------------ */

const calendarActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    title: z.string().min(1),
    description: z.string().optional(),
    event_date: z.string(),
    event_type: z.string(),
    category: z.string().default('compliance'),
    priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
    recurrence: z.string().nullable().optional(),
    recurrence_end: z.string().nullable().optional(),
    permit_id: z.string().nullable().optional(),
    facility_name: z.string().nullable().optional(),
    state: z.string(),
    org_id: z.string(),
    user_uid: z.string(),
    user_name: z.string(),
  }),
  z.object({
    action: z.literal('complete'),
    event_id: z.string().uuid(),
    completion_note: z.string().min(1, 'Completion note is required'),
    user_uid: z.string(),
    user_name: z.string(),
  }),
  z.object({
    action: z.literal('update'),
    event_id: z.string().uuid(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    event_date: z.string().optional(),
    event_type: z.string().optional(),
    category: z.string().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    recurrence: z.string().nullable().optional(),
    recurrence_end: z.string().nullable().optional(),
    permit_id: z.string().nullable().optional(),
    facility_name: z.string().nullable().optional(),
    user_uid: z.string(),
    user_name: z.string(),
  }),
  z.object({
    action: z.literal('skip'),
    event_id: z.string().uuid(),
    user_uid: z.string(),
    user_name: z.string(),
    note: z.string().optional(),
  }),
  z.object({
    action: z.literal('delete'),
    event_id: z.string().uuid(),
    user_uid: z.string(),
    user_name: z.string(),
  }),
  z.object({
    action: z.literal('add_note'),
    event_id: z.string().uuid(),
    user_uid: z.string(),
    user_name: z.string(),
    note: z.string().min(1),
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

  const parsed = await parseBody(request, calendarActionSchema);
  if (!parsed.success) return parsed.error;
  const body = parsed.data;

  // ── Create ──
  if (body.action === 'create') {
    const { action: _, user_uid, user_name, ...fields } = body;
    const { data, error } = await supabase
      .from('compliance_events')
      .insert({
        ...fields,
        created_by_uid: user_uid,
        created_by_name: user_name,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('compliance_event_notes').insert({
      event_id: data.id,
      user_uid,
      user_name,
      action: 'created',
      note: `Created event: ${fields.title}`,
    });

    return NextResponse.json({ ok: true, event: data });
  }

  // ── Complete ──
  if (body.action === 'complete') {
    const { event_id, completion_note, user_uid, user_name } = body;
    const { error } = await supabase
      .from('compliance_events')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by_uid: user_uid,
        completed_by_name: user_name,
        completion_note,
      })
      .eq('id', event_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('compliance_event_notes').insert({
      event_id,
      user_uid,
      user_name,
      action: 'completed',
      note: completion_note,
    });

    return NextResponse.json({ ok: true, status: 'completed' });
  }

  // ── Update ──
  if (body.action === 'update') {
    const { action: _, event_id, user_uid, user_name, ...updates } = body;
    const cleanUpdates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) cleanUpdates[k] = v;
    }

    const { error } = await supabase
      .from('compliance_events')
      .update(cleanUpdates)
      .eq('id', event_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('compliance_event_notes').insert({
      event_id,
      user_uid,
      user_name,
      action: 'updated',
      note: `Updated: ${Object.keys(cleanUpdates).join(', ')}`,
    });

    return NextResponse.json({ ok: true });
  }

  // ── Skip ──
  if (body.action === 'skip') {
    const { event_id, user_uid, user_name, note } = body;
    const { error } = await supabase
      .from('compliance_events')
      .update({ status: 'skipped' })
      .eq('id', event_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('compliance_event_notes').insert({
      event_id,
      user_uid,
      user_name,
      action: 'skipped',
      note: note || 'Skipped this occurrence',
    });

    return NextResponse.json({ ok: true, status: 'skipped' });
  }

  // ── Delete ──
  if (body.action === 'delete') {
    const { event_id } = body;
    const { error } = await supabase
      .from('compliance_events')
      .delete()
      .eq('id', event_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Add Note ──
  if (body.action === 'add_note') {
    const { event_id, user_uid, user_name, note } = body;
    await supabase.from('compliance_event_notes').insert({
      event_id,
      user_uid,
      user_name,
      action: 'note',
      note,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
