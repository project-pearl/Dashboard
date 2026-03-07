/* ------------------------------------------------------------------ */
/*  PIN Alerts — Deployment Alerts API                                */
/*  Supabase-backed CRUD for deployment sensor alerts,                */
/*  acknowledgments, and timeline data.                               */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAuthorized } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

/* ------------------------------------------------------------------ */
/*  GET — Fetch deployment alerts + acknowledgments + timeline        */
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
  const deploymentId = searchParams.get('deploymentId');
  const alertId = searchParams.get('alertId');
  const status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  // Single alert detail with acknowledgments + timeline
  if (alertId) {
    const [alertRes, ackRes, timelineRes] = await Promise.all([
      supabase.from('deployment_alerts').select('*').eq('id', alertId).single(),
      supabase.from('alert_acknowledgments').select('*').eq('alert_id', alertId).order('acknowledged_at', { ascending: false }),
      supabase.from('alert_timeline').select('*').eq('alert_id', alertId).order('recorded_at', { ascending: true }).limit(200),
    ]);

    if (alertRes.error) {
      return NextResponse.json({ error: alertRes.error.message }, { status: 404 });
    }

    return NextResponse.json({
      alert: alertRes.data,
      acknowledgments: ackRes.data || [],
      timeline: timelineRes.data || [],
    });
  }

  // List alerts (optionally filtered by deployment or status)
  let query = supabase
    .from('deployment_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (deploymentId) query = query.eq('deployment_id', deploymentId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: data || [] });
}

/* ------------------------------------------------------------------ */
/*  POST — Create alert, acknowledge, or record timeline              */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const body = await request.json();
  const { action } = body;

  // ── Create deployment alert ──
  if (action === 'create_alert') {
    const { deployment_id, parameter, value, baseline, delta, unit, severity, title, diagnosis, recommendation, pipeline_event_id } = body;
    const { data, error } = await supabase
      .from('deployment_alerts')
      .insert({
        deployment_id,
        parameter,
        value,
        baseline,
        delta,
        unit,
        severity,
        status: 'open',
        title,
        diagnosis,
        recommendation,
        pipeline_event_id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ alert: data });
  }

  // ── Acknowledge alert ──
  if (action === 'acknowledge') {
    const { alert_id, user_id, user_name, note, action_taken } = body;
    if (!alert_id) return NextResponse.json({ error: 'alert_id required' }, { status: 400 });

    // Insert acknowledgment
    const { error: ackError } = await supabase
      .from('alert_acknowledgments')
      .insert({ alert_id, user_id, user_name, note, action_taken });
    if (ackError) return NextResponse.json({ error: ackError.message }, { status: 500 });

    // Update alert status
    const newStatus = action_taken === 'resolved' ? 'resolved' : 'acknowledged';
    const { error: updateError } = await supabase
      .from('deployment_alerts')
      .update({ status: newStatus })
      .eq('id', alert_id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ ok: true, status: newStatus });
  }

  // ── Record timeline entry ──
  if (action === 'record_timeline') {
    const { alert_id, deployment_id, parameter, value, baseline, severity } = body;
    const { error } = await supabase
      .from('alert_timeline')
      .insert({ alert_id, deployment_id, parameter, value, baseline, severity });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // ── Batch record timeline (from cron or client) ──
  if (action === 'batch_timeline') {
    const { entries } = body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'entries array required' }, { status: 400 });
    }
    const { error } = await supabase.from('alert_timeline').insert(entries);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, inserted: entries.length });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

/* ------------------------------------------------------------------ */
/*  PUT — Update alert status                                         */
/* ------------------------------------------------------------------ */

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const body = await request.json();
  const { alert_id, status } = body;

  if (!alert_id || !status) {
    return NextResponse.json({ error: 'alert_id and status required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('deployment_alerts')
    .update({ status })
    .eq('id', alert_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
