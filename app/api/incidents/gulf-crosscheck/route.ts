import { NextRequest, NextResponse } from 'next/server';

type SignalSeverity = 'high' | 'medium' | 'low' | 'info';

interface GulfSignal {
  type?: string;
  severity?: SignalSeverity;
  title?: string;
  reason?: string;
  source?: string;
  state?: string;
  timestamp?: string;
  location?: string;
}

interface AlertHistoryEvent {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  body: string;
  entityId: string;
  entityLabel: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export const dynamic = 'force-dynamic';

const GULF_STATES = ['TX', 'LA', 'MS', 'AL', 'FL'] as const;
const GULF_KEYWORDS = [
  'gulf',
  'grand isle',
  'loop',
  'oil',
  'petroleum',
  'crude',
  'spill',
  'sheen',
  'hydrocarbon',
];

function lower(value: unknown): string {
  return String(value ?? '').toLowerCase();
}

function hasKeyword(text: string): boolean {
  return GULF_KEYWORDS.some((k) => text.includes(k));
}

function stateNameFromAbbr(abbr: string): string {
  const map: Record<string, string> = {
    TX: 'texas',
    LA: 'louisiana',
    MS: 'mississippi',
    AL: 'alabama',
    FL: 'florida',
  };
  return map[abbr] ?? '';
}

async function fetchSignalsForState(state: string, request: NextRequest): Promise<GulfSignal[]> {
  const url = new URL('/api/water-data', request.url);
  url.searchParams.set('action', 'signals');
  url.searchParams.set('statecode', state);
  url.searchParams.set('limit', '40');

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.signals) ? data.signals : [];
}

export async function GET(request: NextRequest) {
  const sinceHours = Math.max(24, Math.min(168, Number(request.nextUrl.searchParams.get('sinceHours') ?? 48)));
  const now = Date.now();
  const cutoffMs = now - sinceHours * 60 * 60 * 1000;

  try {
    const signalResults = await Promise.all(
      GULF_STATES.map(async (state) => ({ state, signals: await fetchSignalsForState(state, request) })),
    );

    const signalItems = signalResults.flatMap(({ state, signals }) => {
      return signals
        .filter((s) => {
          const ts = Date.parse(String(s.timestamp ?? ''));
          if (Number.isNaN(ts) || ts < cutoffMs) return false;
          const blob = `${lower(s.title)} ${lower(s.reason)} ${lower(s.type)} ${lower(s.location)} ${lower(s.source)} ${lower(state)}`;
          return hasKeyword(blob);
        })
        .map((s) => ({
          id: `${state}:${String(s.title ?? '')}:${String(s.timestamp ?? '')}`,
          state,
          severity: s.severity ?? 'medium',
          title: s.title ?? 'Gulf incident signal',
          source: s.source ?? 'Signals',
          reason: s.reason ?? '',
          timestamp: s.timestamp ?? new Date(now).toISOString(),
          location: s.location ?? '',
        }));
    });

    const dedup = new Map<string, (typeof signalItems)[number]>();
    for (const item of signalItems) {
      const key = `${item.state}:${item.title.toLowerCase()}`;
      const prev = dedup.get(key);
      if (!prev || Date.parse(item.timestamp) > Date.parse(prev.timestamp)) dedup.set(key, item);
    }
    const incidents = [...dedup.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 20);

    const alertsUrl = new URL('/api/alerts/history', request.url);
    alertsUrl.searchParams.set('limit', '500');
    const alertsRes = await fetch(alertsUrl.toString(), { cache: 'no-store' });
    const alertData = alertsRes.ok ? await alertsRes.json() : { events: [] };
    const events: AlertHistoryEvent[] = Array.isArray(alertData?.events) ? alertData.events : [];

    const recentEvents = events.filter((e) => {
      const t = Date.parse(String(e.createdAt ?? ''));
      return !Number.isNaN(t) && t >= cutoffMs;
    });

    const enriched = incidents.map((incident) => {
      const stateName = stateNameFromAbbr(incident.state);
      const incidentBlob = `${incident.title} ${incident.reason} ${incident.location}`.toLowerCase();
      const related = recentEvents.filter((ev) => {
        const evBlob = `${ev.title} ${ev.body} ${ev.entityLabel} ${ev.entityId} ${JSON.stringify(ev.metadata ?? {})}`.toLowerCase();
        if (!(ev.type === 'deployment' || ev.type === 'usgs' || ev.type === 'fusion' || ev.type === 'beacon' || ev.type === 'coordination')) return false;
        const sameState = evBlob.includes(` ${incident.state.toLowerCase()} `) || (stateName && evBlob.includes(stateName));
        const keywordOverlap = hasKeyword(`${incidentBlob} ${evBlob}`);
        return sameState || keywordOverlap;
      });

      return {
        ...incident,
        relatedAlerts: related.length,
        relatedCritical: related.filter((r) => r.severity === 'critical').length,
        status: related.length > 0 ? 'corroborated' : 'unconfirmed',
      };
    });

    return NextResponse.json({
      generatedAt: new Date(now).toISOString(),
      sinceHours,
      summary: {
        incidents: enriched.length,
        corroborated: enriched.filter((i) => i.relatedAlerts > 0).length,
        liveMatches: enriched.reduce((sum, i) => sum + i.relatedAlerts, 0),
      },
      incidents: enriched,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'gulf-crosscheck-failed', generatedAt: new Date(now).toISOString(), incidents: [], summary: { incidents: 0, corroborated: 0, liveMatches: 0 } },
      { status: 500 },
    );
  }
}
