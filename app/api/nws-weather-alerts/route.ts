/* ------------------------------------------------------------------ */
/*  NWS Weather Alerts API                                            */
/*  GET ?severe=true           → all severe weather alerts w/ geometry */
/*  GET ?installation=ID&radius=25 → alerts near a specific installation */
/* ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  ensureWarmed,
  getSevereWeatherAlerts,
  getAlertsNearPoint,
  getNwsAlertsAll,
  getNwsAlerts,
} from '@/lib/nwsAlertCache';

import installationsJson from '@/data/military-installations.json';

/** Severe weather event keywords for filtering. */
const SEVERE_KEYWORDS = [
  'tornado', 'severe thunderstorm', 'hurricane', 'tropical storm',
  'derecho', 'extreme wind', 'high wind', 'flash flood',
];

function isSevere(a: { event: string }) {
  const lower = a.event.toLowerCase();
  return SEVERE_KEYWORDS.some(k => lower.includes(k));
}

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  burnPitHistory: boolean;
}

const INSTALLATIONS: Installation[] = installationsJson as Installation[];

export async function GET(request: NextRequest) {
  await ensureWarmed();

  const { searchParams } = new URL(request.url);
  const severe = searchParams.get('severe');
  const stateParam = searchParams.get('state');
  const installationId = searchParams.get('installation');
  const radius = parseFloat(searchParams.get('radius') || '25');

  // Mode 1: Severe weather alerts (optionally filtered by state)
  if (severe === 'true') {
    let alerts;
    if (stateParam) {
      const stateAlerts = getNwsAlerts(stateParam) ?? [];
      alerts = stateAlerts.filter(isSevere);
    } else {
      alerts = getSevereWeatherAlerts();
    }
    return NextResponse.json({
      alerts,
      count: alerts.length,
      state: stateParam || null,
      fetchedAt: new Date().toISOString(),
    });
  }

  // Mode 2: Alerts near a specific installation
  if (installationId) {
    const inst = INSTALLATIONS.find(i => i.id === installationId);
    if (!inst) {
      return NextResponse.json(
        { error: `Installation '${installationId}' not found` },
        { status: 404 },
      );
    }
    const alerts = getAlertsNearPoint(inst.lat, inst.lng, radius);
    return NextResponse.json({
      installation: { id: inst.id, name: inst.name, lat: inst.lat, lng: inst.lng },
      alerts,
      count: alerts.length,
      radiusMi: radius,
      fetchedAt: new Date().toISOString(),
    });
  }

  // Mode 3: All alerts for a single state
  if (stateParam) {
    const alerts = getNwsAlerts(stateParam) ?? [];
    return NextResponse.json({
      alerts,
      count: alerts.length,
      state: stateParam,
      fetchedAt: new Date().toISOString(),
    });
  }

  // Default: return all alerts
  const all = getNwsAlertsAll();
  return NextResponse.json({
    alerts: all,
    count: all.length,
    fetchedAt: new Date().toISOString(),
  });
}
