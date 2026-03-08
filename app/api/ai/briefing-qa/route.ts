import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI, BRIEFING_QA_TONE, type BriefingQARole } from '@/lib/llmHelpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// ── Simple in-memory rate limiter (10 req / 60s per IP) ─────────────────────
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000;
  const max = 10;
  const times = (hits.get(ip) || []).filter(t => now - t < window);
  if (times.length >= max) return true;
  times.push(now);
  hits.set(ip, times);
  return false;
}

// ── Internal fetch helper ───────────────────────────────────────────────────
async function fetchInternal(request: NextRequest, path: string): Promise<any> {
  const origin = request.nextUrl.origin;
  try {
    const res = await fetch(`${origin}${path}`, {
      headers: { 'Cookie': request.headers.get('cookie') || '' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  // Rate limit
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.question !== 'string' || !body.question.trim()) {
    return NextResponse.json({ error: 'Missing question' }, { status: 400 });
  }

  const { question, role, state, jurisdiction, isMilitary } = body as {
    question: string;
    role: 'Federal' | 'State' | 'MS4' | 'Local';
    state?: string;
    jurisdiction?: string;
    isMilitary?: boolean;
  };

  // ── Gather role-specific context in parallel ────────────────────────────────
  const sources: string[] = [];
  const contextParts: string[] = [];

  // Kick off parallel fetches based on role
  const fetches: Record<string, Promise<any>> = {
    nationalSummary: fetchInternal(request, '/api/national-summary'),
    sourceHealth: fetchInternal(request, '/api/source-health'),
  };

  if (role === 'Federal') {
    fetches.briefingMetrics = fetchInternal(request, '/api/federal-briefing-metrics');
  }

  if (state) {
    fetches.nwsAlerts = fetchInternal(request, `/api/nws-alerts?state=${state}`);
  }

  const results = await Promise.all(
    Object.entries(fetches).map(async ([key, p]) => [key, await p] as const),
  );
  const data: Record<string, any> = Object.fromEntries(results);

  // ── National summary (ATTAINS state breakdowns, TMDLs, worst states) ──────
  const ns = data.nationalSummary;
  if (ns) {
    sources.push('national-summary');

    contextParts.push([
      `National water quality overview:`,
      `- ${(ns.totalWaterbodies ?? 0).toLocaleString()} total waterbodies assessed`,
      `- ${(ns.totalImpaired ?? 0).toLocaleString()} impaired (${ns.totalWaterbodies ? Math.round((ns.totalImpaired / ns.totalWaterbodies) * 100) : '?'}%)`,
      `- ${(ns.tmdlGap ?? 0).toLocaleString()} pending TMDLs (needed but not completed)`,
      `- ${(ns.tmdlCompleted ?? 0).toLocaleString()} TMDLs completed`,
      `- National average score: ${ns.averageScore ?? '?'}/100`,
      `- ${ns.highAlertStates ?? '?'} states with high-alert waterbodies`,
    ].join('\n'));

    // Top causes
    if (ns.topCauses?.length) {
      const causeList = ns.topCauses.slice(0, 8).map((c: any) => `  ${c.cause}: ${c.count.toLocaleString()} waterbodies`).join('\n');
      contextParts.push(`Top impairment causes nationwide:\n${causeList}`);
    }

    // Worst states
    if (ns.worstStates?.length) {
      const worstList = ns.worstStates.slice(0, 10).map((s: any) =>
        `  ${s.abbr}: score ${s.score}/100, ${s.impaired.toLocaleString()} impaired`
      ).join('\n');
      contextParts.push(`States with lowest water quality scores:\n${worstList}`);
    }

    // State breakdown (if user asks about a specific state or Federal wants full picture)
    if (ns.stateBreakdown) {
      if (state && ns.stateBreakdown[state]) {
        const sb = ns.stateBreakdown[state];
        contextParts.push([
          `${state} state detail:`,
          `- Total waterbodies: ${sb.total?.toLocaleString() ?? '?'}`,
          `- Impaired: ${sb.impaired?.toLocaleString() ?? '?'}`,
          `- Score: ${sb.score ?? '?'}/100, Grade: ${sb.grade ?? '?'}`,
          `- TMDL needed: ${sb.tmdlNeeded?.toLocaleString() ?? '?'}`,
          sb.topCauses?.length ? `- Top causes: ${sb.topCauses.join(', ')}` : '',
        ].filter(Boolean).join('\n'));
      } else if (role === 'Federal') {
        // Give Federal users a compact state-by-state summary (top 15 by impairment)
        const stateEntries = Object.entries(ns.stateBreakdown)
          .map(([abbr, sb]: [string, any]) => ({ abbr, ...sb }))
          .filter((s: any) => s.total > 0)
          .sort((a: any, b: any) => (b.impaired ?? 0) - (a.impaired ?? 0))
          .slice(0, 15);
        if (stateEntries.length) {
          const table = stateEntries.map((s: any) =>
            `  ${s.abbr}: ${s.impaired?.toLocaleString() ?? 0}/${s.total?.toLocaleString() ?? 0} impaired (${s.grade ?? '?'}), ${s.tmdlNeeded?.toLocaleString() ?? 0} pending TMDLs`
          ).join('\n');
          contextParts.push(`State-by-state breakdown (top 15 by impairment count):\n${table}`);
        }
      }
    }

    // Data sources counts
    if (ns.dataSources) {
      const dsLines = Object.entries(ns.dataSources)
        .filter(([, v]) => v && (v as number) > 0)
        .map(([k, v]) => `  ${k}: ${(v as number).toLocaleString()}`)
        .join('\n');
      if (dsLines) contextParts.push(`Active data sources:\n${dsLines}`);
    }
  }

  // ── Federal briefing metrics ──────────────────────────────────────────────
  if (data.briefingMetrics) {
    sources.push('federal-briefing-metrics');
    const m = data.briefingMetrics;
    contextParts.push([
      `Federal briefing metrics:`,
      m.activePermits != null ? `- Active NPDES permits: ${m.activePermits.toLocaleString()}` : '',
      m.openInspections != null ? `- Open inspections: ${m.openInspections.toLocaleString()}` : '',
      m.pendingTmdls != null ? `- Pending TMDLs: ${m.pendingTmdls.toLocaleString()}` : '',
      m.srfUtilization != null ? `- SRF utilization: ${m.srfUtilization}` : '',
    ].filter(Boolean).join('\n'));
  }

  // ── Source health (monitoring infrastructure) ─────────────────────────────
  if (data.sourceHealth) {
    sources.push('source-health');
    const sh = data.sourceHealth;
    if (sh.totalMonitoringPoints) {
      contextParts.push(`Total active monitoring points: ${sh.totalMonitoringPoints.toLocaleString()}`);
    }
    // Degraded/offline sources
    if (sh.sources) {
      const degraded = sh.sources.filter((s: any) => s.status === 'degraded' || s.status === 'offline');
      if (degraded.length) {
        const list = degraded.map((s: any) => `  ${s.name}: ${s.status}${s.error ? ` (${s.error})` : ''}`).join('\n');
        contextParts.push(`Data sources with issues:\n${list}`);
      }
    }
  }

  // ── NWS alerts ────────────────────────────────────────────────────────────
  if (data.nwsAlerts) {
    sources.push('nws-alerts');
    const alertSummary = Array.isArray(data.nwsAlerts)
      ? data.nwsAlerts.slice(0, 5).map((a: any) => `${a.event || a.headline || 'Alert'}: ${a.description?.slice(0, 120) || ''}`).join('\n')
      : JSON.stringify(data.nwsAlerts).slice(0, 600);
    contextParts.push(`Active NWS alerts for ${state}:\n${alertSummary}`);
  }

  // ── Military CISA context ─────────────────────────────────────────────────
  if (isMilitary) {
    contextParts.push('CISA advisory posture: Monitor water/wastewater SCADA systems for active cyber threats. Current CISA alert level applies to all critical infrastructure sectors including water treatment and distribution.');
  }

  // ── Build system prompt ───────────────────────────────────────────────────
  const toneKey: BriefingQARole = (role === 'Federal' && isMilitary) ? 'Federal+Military' : role;
  const tone = BRIEFING_QA_TONE[toneKey] || BRIEFING_QA_TONE.Federal;

  const systemPrompt = [
    tone,
    'Answer the user\'s situational awareness question using the live data context below.',
    'Be direct and substantive — cite specific states, numbers, and trends.',
    'When the user asks about national posture, lead with the most critical findings (worst states, TMDL gaps, top impairment causes) before giving general context.',
    'If data is insufficient to answer fully, say what you can and note what data would be needed.',
    contextParts.length ? `\n--- LIVE DATA CONTEXT ---\n${contextParts.join('\n\n')}` : '',
  ].filter(Boolean).join(' ');

  try {
    const answer = await callOpenAI(apiKey, systemPrompt, question, 'gpt-4o', 1500);
    return NextResponse.json({
      answer: answer || 'I wasn\'t able to generate an answer. Please try rephrasing your question.',
      sources,
    });
  } catch (err: any) {
    console.error(`[briefing-qa] AI error:`, err?.message || err);
    return NextResponse.json({ error: 'AI service error' }, { status: 502 });
  }
}
