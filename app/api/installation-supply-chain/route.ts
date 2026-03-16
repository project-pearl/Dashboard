/* ------------------------------------------------------------------ */
/*  Installation Water Supply Chain — Trace supply graph                */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import installationsData from '@/data/military-installations.json';
import { snapToReach, traceUpstream } from '@/lib/watersGeoService';
import { ensureWarmed as warmSdwis, getSdwisForState } from '@/lib/sdwisCache';
import { ensureWarmed as warmIcis, getIcisAllData } from '@/lib/icisCache';
import { getAttainsCache } from '@/lib/attainsCache';
import { ensureWarmed as warmScoring, getScoredHucs } from '@/lib/sentinel/scoringEngine';
import { haversineDistance } from '@/lib/geoUtils';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  type: string;
  state: string | null;
}

const installations = installationsData as Installation[];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const installationId = request.nextUrl.searchParams.get('id');
  if (!installationId) {
    return NextResponse.json({ error: 'Missing ?id parameter' }, { status: 400 });
  }

  const installation = installations.find(i => i.id === installationId);
  if (!installation) {
    return NextResponse.json({ error: `Installation "${installationId}" not found` }, { status: 404 });
  }

  // Overseas installations are unsupported (no US water data)
  if (!installation.state) {
    return NextResponse.json({
      unavailable: true,
      reason: 'overseas',
      installation: { id: installation.id, name: installation.name, region: installation.region },
    });
  }

  try {
    // Warm caches in parallel
    await Promise.all([warmSdwis(), warmIcis(), warmScoring()]);

    // 1. NHD flow navigation
    let upstreamNavigation: any = null;
    let upstreamHuc8s: string[] = [];
    try {
      const snap = await snapToReach(installation.lat, installation.lng);
      if (snap) {
        const trace = await traceUpstream(snap.reachCode, 50);
        upstreamNavigation = {
          reachCode: snap.reachCode,
          distanceKm: snap.distanceKm ?? null,
          traceResult: trace,
        };
        // Extract unique HUC-8s from upstream navigation
        if (trace?.flowlines) {
          const hucSet = new Set<string>();
          for (const fl of trace.flowlines) {
            if (fl.huc12) hucSet.add(fl.huc12.slice(0, 8));
          }
          upstreamHuc8s = [...hucSet];
        }
      }
    } catch { /* NHD navigation may fail — non-fatal */ }

    // Include the installation's own approximate HUC-8 if navigation yielded nothing
    // (use the SDWIS/ICIS distance filtering below regardless)

    // 2. SDWIS — water systems within 20km
    const sdwisData = getSdwisForState(installation.state);
    const waterSystems: any[] = [];
    if (sdwisData) {
      const candidateSystems = sdwisData.systems
        .filter(s => s.lat && s.lng)
        .map(s => ({
          ...s,
          distance: haversineDistance(
            { lat: installation.lat, lng: installation.lng },
            { lat: s.lat, lng: s.lng },
          ),
        }))
        .filter(s => s.distance <= 20)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);

      for (const sys of candidateSystems) {
        const violations = sdwisData.violations.filter(v => v.pwsid === sys.pwsid);
        const enforcement = sdwisData.enforcement.filter(e => e.pwsid === sys.pwsid);
        waterSystems.push({
          pwsid: sys.pwsid,
          name: sys.name,
          type: sys.type,
          sourceWater: sys.sourceWater,
          population: sys.population,
          distanceKm: Math.round(sys.distance * 10) / 10,
          violationCount: violations.length,
          healthBasedViolations: violations.filter((v: any) => v.isHealthBased).length,
          enforcementCount: enforcement.length,
        });
      }
    }

    // 3. ICIS — NPDES permits within 50km
    const icis = getIcisAllData();
    const upstreamThreats: any[] = [];
    if (icis?.permits) {
      const nearbyPermits = icis.permits
        .filter(p => p.state === installation.state && p.lat && p.lng && p.lat > 0)
        .map(p => ({
          ...p,
          distance: haversineDistance(
            { lat: installation.lat, lng: installation.lng },
            { lat: p.lat, lng: p.lng },
          ),
        }))
        .filter(p => p.distance <= 50)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20);

      for (const p of nearbyPermits) {
        const violations = icis.violations?.filter((v: any) => v.npdesId === p.npdesId) ?? [];
        upstreamThreats.push({
          type: 'npdes_discharger',
          npdesId: p.npdesId,
          facilityName: p.facilityName,
          distanceKm: Math.round(p.distance * 10) / 10,
          violationCount: violations.length,
          sncStatus: p.sncStatus ?? null,
        });
      }
    }

    // 4. ATTAINS — impaired waters in upstream HUC-8s
    const attains = getAttainsCache();
    if (attains?.states && upstreamHuc8s.length > 0) {
      const upstreamSet = new Set(upstreamHuc8s);
      for (const [, stateData] of Object.entries(attains.states)) {
        const wbs = (stateData as any)?.waterbodies ?? [];
        for (const wb of wbs) {
          const wbHuc8 = wb.huc12?.slice(0, 8);
          if (wbHuc8 && upstreamSet.has(wbHuc8) && wb.overallStatus === 'Not Supporting') {
            upstreamThreats.push({
              type: 'impaired_water',
              waterbodyId: wb.assessmentUnitId,
              waterbodyName: wb.assessmentUnitName,
              huc8: wbHuc8,
              causes: wb.causes ?? [],
              category: wb.irCategory ?? null,
            });
          }
        }
      }
    }

    // 5. Sentinel anomalies in upstream HUC-8s
    const scoredHucs = getScoredHucs();
    const sentinelAnomalies: any[] = [];
    const upstreamSet = new Set(upstreamHuc8s);
    for (const h of scoredHucs) {
      if (h.level !== 'NOMINAL' && upstreamSet.has(h.huc8)) {
        sentinelAnomalies.push({
          huc8: h.huc8,
          score: h.score,
          level: h.level,
          patterns: h.activePatterns.map(p => p.patternId),
          eventCount: h.events.length,
        });
      }
    }

    return NextResponse.json({
      installation: {
        id: installation.id,
        name: installation.name,
        lat: installation.lat,
        lng: installation.lng,
        state: installation.state,
        branch: installation.branch,
        region: installation.region,
      },
      waterSystems,
      upstreamNavigation,
      upstreamThreats,
      sentinelAnomalies,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[installation-supply-chain] Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
