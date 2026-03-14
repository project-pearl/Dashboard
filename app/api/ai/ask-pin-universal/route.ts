import { NextRequest, NextResponse } from 'next/server';
import { UNIVERSAL_QA_TONE, type UniversalQARole } from '@/lib/llmHelpers';
import { askPinUniversalSchema } from '@/lib/schemas';
import { parseBody } from '@/lib/validateRequest';
import { checkRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
  const rateLimited = await checkRateLimit(ip);
  if (rateLimited) return rateLimited;

  const parsed = await parseBody(request, askPinUniversalSchema);
  if (!parsed.success) return parsed.error;
  const { question, role, state, jurisdiction, isMilitary, conversationHistory } = parsed.data;

  // ── Gather role-specific context in parallel ────────────────────────────────
  const sources: string[] = [];
  const contextParts: string[] = [];

  const fetches: Record<string, Promise<any>> = {
    nationalSummary: fetchInternal(request, '/api/national-summary'),
    sourceHealth: fetchInternal(request, '/api/source-health'),
  };

  // Federal/State/MS4/Local get sentinel data
  if (['Federal', 'State', 'MS4', 'Local'].includes(role)) {
    fetches.sentinel = fetchInternal(request, '/api/sentinel-status');
  }

  // Federal gets briefing metrics
  if (role === 'Federal') {
    fetches.briefingMetrics = fetchInternal(request, '/api/federal-briefing-metrics');
  }

  // State-scoped roles get NWS alerts
  if (state) {
    fetches.nwsAlerts = fetchInternal(request, `/api/nws-alerts?state=${state}`);
  }

  const results = await Promise.all(
    Object.entries(fetches).map(async ([key, p]) => [key, await p] as const),
  );
  const data: Record<string, any> = Object.fromEntries(results);

  // ── National summary ──────────────────────────────────────────────────────
  const ns = data.nationalSummary;
  if (ns) {
    sources.push('national-summary');

    contextParts.push([
      `National water quality overview:`,
      `- ${(ns.totalWaterbodies ?? 0).toLocaleString()} total waterbodies assessed`,
      `- ${(ns.totalImpaired ?? 0).toLocaleString()} impaired (${ns.totalWaterbodies ? Math.round((ns.totalImpaired / ns.totalWaterbodies) * 100) : '?'}%)`,
      `- ${(ns.tmdlGap ?? 0).toLocaleString()} pending TMDLs`,
      `- ${(ns.tmdlCompleted ?? 0).toLocaleString()} TMDLs completed`,
      `- National average score: ${ns.averageScore ?? '?'}/100`,
      `- ${ns.highAlertStates ?? '?'} states with high-alert waterbodies`,
    ].join('\n'));

    if (ns.topCauses?.length) {
      const causeList = ns.topCauses.slice(0, 8).map((c: any) => `  ${c.cause}: ${c.count.toLocaleString()} waterbodies`).join('\n');
      contextParts.push(`Top impairment causes nationwide:\n${causeList}`);
    }

    if (ns.worstStates?.length) {
      const worstList = ns.worstStates.slice(0, 10).map((s: any) =>
        `  ${s.abbr}: score ${s.score}/100, ${s.impaired.toLocaleString()} impaired`
      ).join('\n');
      contextParts.push(`States with lowest water quality scores:\n${worstList}`);
    }

    // State-specific breakdown when available
    if (ns.stateBreakdown && state && ns.stateBreakdown[state]) {
      const sb = ns.stateBreakdown[state];
      contextParts.push([
        `${state} state detail:`,
        `- Total waterbodies: ${sb.total?.toLocaleString() ?? '?'}`,
        `- Impaired: ${sb.impaired?.toLocaleString() ?? '?'}`,
        `- Score: ${sb.score ?? '?'}/100, Grade: ${sb.grade ?? '?'}`,
        `- TMDL needed: ${sb.tmdlNeeded?.toLocaleString() ?? '?'}`,
        sb.topCauses?.length ? `- Top causes: ${sb.topCauses.join(', ')}` : '',
      ].filter(Boolean).join('\n'));
    } else if (ns.stateBreakdown && role === 'Federal') {
      const stateEntries = Object.entries(ns.stateBreakdown)
        .map(([abbr, sb]: [string, any]) => ({ abbr, ...sb }))
        .filter((s: any) => s.total > 0)
        .sort((a: any, b: any) => (b.impaired ?? 0) - (a.impaired ?? 0))
        .slice(0, 15);
      if (stateEntries.length) {
        const table = stateEntries.map((s: any) =>
          `  ${s.abbr}: ${s.impaired?.toLocaleString() ?? 0}/${s.total?.toLocaleString() ?? 0} impaired (${s.grade ?? '?'})`
        ).join('\n');
        contextParts.push(`State-by-state breakdown (top 15 by impairment):\n${table}`);
      }
    }

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

  // ── Source health ─────────────────────────────────────────────────────────
  if (data.sourceHealth) {
    sources.push('source-health');
    const sh = data.sourceHealth;
    if (sh.totalMonitoringPoints) {
      contextParts.push(`Total active monitoring points: ${sh.totalMonitoringPoints.toLocaleString()}`);
    }
    if (sh.sources) {
      const degraded = sh.sources.filter((s: any) => s.status === 'degraded' || s.status === 'offline');
      if (degraded.length) {
        const list = degraded.map((s: any) => `  ${s.name}: ${s.status}${s.error ? ` (${s.error})` : ''}`).join('\n');
        contextParts.push(`Data sources with issues:\n${list}`);
      }
    }
  }

  // ── Sentinel alerts ───────────────────────────────────────────────────────
  const sentinel = data.sentinel;
  if (sentinel && sentinel.summary) {
    sources.push('sentinel-status');
    const s = sentinel.summary;
    contextParts.push([
      `Sentinel anomaly detection status:`,
      `- CRITICAL watersheds: ${s.criticalHucs ?? 0}`,
      `- WATCH watersheds: ${s.watchHucs ?? 0}`,
      `- ADVISORY watersheds: ${s.advisoryHucs ?? 0}`,
      `- Healthy sources: ${s.healthySources ?? '?'}, Degraded: ${s.degradedSources ?? 0}, Offline: ${s.offlineSources ?? 0}`,
    ].join('\n'));

    if (sentinel.activeHucs?.length) {
      const critical = sentinel.activeHucs.filter((h: any) => h.level === 'CRITICAL');
      const watch = sentinel.activeHucs.filter((h: any) => h.level === 'WATCH');
      if (critical.length) {
        const list = critical.slice(0, 10).map((h: any) =>
          `  HUC ${h.huc8} (${h.stateAbbr}): score ${h.score}, ${h.eventCount} events, patterns: ${h.patternNames?.join(', ') || 'unknown'}`
        ).join('\n');
        contextParts.push(`CRITICAL Sentinel alerts:\n${list}`);
      }
      if (watch.length) {
        const list = watch.slice(0, 10).map((h: any) =>
          `  HUC ${h.huc8} (${h.stateAbbr}): score ${h.score}, ${h.eventCount} events, patterns: ${h.patternNames?.join(', ') || 'unknown'}`
        ).join('\n');
        contextParts.push(`WATCH Sentinel alerts:\n${list}`);
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

  // ── Jurisdiction context ──────────────────────────────────────────────────
  if (jurisdiction) {
    contextParts.push(`User jurisdiction: ${jurisdiction}`);
  }

  // ── Build system prompt ───────────────────────────────────────────────────
  const toneKey: UniversalQARole = (role === 'Federal' && isMilitary) ? 'Federal+Military' : role;
  const tone = UNIVERSAL_QA_TONE[toneKey] || UNIVERSAL_QA_TONE.Federal;

  const systemPrompt = [
    tone,
    'Answer the user\'s question using the live data context below.',
    'Be direct and substantive — cite specific states, numbers, and trends when available.',
    'If data is insufficient to answer fully, say what you can and note what data would be needed.',
    'Keep answers concise but thorough (3-5 paragraphs max).',
    contextParts.length ? `\n--- LIVE DATA CONTEXT ---\n${contextParts.join('\n\n')}` : '',
  ].filter(Boolean).join(' ');

  // ── Build messages array with conversation history ────────────────────────
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Include up to 5 prior Q&A pairs for context
  if (conversationHistory?.length) {
    for (const msg of conversationHistory.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: 'user', content: question });

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const aiData = await res.json();
    const answer = aiData?.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      answer: answer || 'I wasn\'t able to generate an answer. Please try rephrasing your question.',
      sources,
    });
  } catch (err: any) {
    console.error(`[ask-pin-universal] AI error:`, err?.message || err);
    return NextResponse.json({ error: 'AI service error' }, { status: 502 });
  }
}
