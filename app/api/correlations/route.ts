// app/api/correlations/route.ts
// Server-side endpoint that runs the correlation discovery engine across
// 10+ federal data caches and returns cross-agency findings.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  discoverPfasHealthDeserts,
  discoverFloodWaterContamination,
  discoverDischargeImpairmentLinks,
  discoverDamCascadeRisk,
  discoverDroughtWaterStress,
  BREAKTHROUGH_CATALOG,
  type CorrelationFinding,
  type BreakthroughSummary,
} from '@/lib/correlationDiscovery';

// ── Cache imports ───────────────────────────────────────────────────────────

import { ensureWarmed as warmDodPfas } from '@/lib/dodPfasSitesCache';
import { getDodPfasAllSites } from '@/lib/dodPfasSitesCache';

import { ensureWarmed as warmHrsa } from '@/lib/hrsaHpsaCache';
import { getHpsaByState } from '@/lib/hrsaHpsaCache';

import { ensureWarmed as warmEjscreen } from '@/lib/ejscreenCache';
import { getEJScreenCache } from '@/lib/ejscreenCache';

import { ensureWarmed as warmNfip } from '@/lib/nfipClaimsCache';
import { getNfipClaimsAll } from '@/lib/nfipClaimsCache';

import { ensureWarmed as warmSdwis } from '@/lib/sdwisCache';
import { getSdwisAllData, getSdwisForState } from '@/lib/sdwisCache';

import { ensureWarmed as warmEcho } from '@/lib/echoCache';
import { getEchoAllData } from '@/lib/echoCache';

import { ensureWarmed as warmDam } from '@/lib/damCache';
import { getDamAll } from '@/lib/damCache';

import { ensureWarmed as warmUsdm } from '@/lib/usdmCache';
import { getUsdmAll } from '@/lib/usdmCache';

import { ensureWarmed as warmUsbr } from '@/lib/usbrCache';
import { getUsbrAll } from '@/lib/usbrCache';

import { PRIORITY_STATES } from '@/lib/constants';

// ── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stateFilter = searchParams.get('state')?.toUpperCase() || null;

  const startTime = Date.now();

  // Warm all caches in parallel
  await Promise.allSettled([
    warmDodPfas(), warmHrsa(), warmEjscreen(),
    warmNfip(), warmSdwis(), warmEcho(),
    warmDam(), warmUsdm(), warmUsbr(),
  ]);

  const allFindings: CorrelationFinding[] = [];
  const errors: string[] = [];

  // ── Breakthrough 1: PFAS × Healthcare Deserts ────────────────────────────

  try {
    const allPfasSites = getDodPfasAllSites();
    const pfasSitesFlat = Object.values(allPfasSites).flat();

    // Collect HPSA data for relevant states
    const pfasStates = [...new Set(pfasSitesFlat.map(s => s.state))];
    const hpsaFlat = pfasStates.flatMap(st => getHpsaByState(st));

    // Collect EJScreen records near PFAS sites (spatial lookup per site, dedup)
    const ejSeen = new Set<string>();
    const ejFlat: { state: string; lat: number; lng: number; ejIndex: number; minorityPct: number; lowIncomePct: number }[] = [];
    for (const site of pfasSitesFlat) {
      const nearby = getEJScreenCache(site.lat, site.lng);
      if (nearby) {
        for (const r of nearby) {
          if (!ejSeen.has(r.blockGroupId)) {
            ejSeen.add(r.blockGroupId);
            ejFlat.push({ state: r.state, lat: r.lat, lng: r.lng, ejIndex: r.ejIndex, minorityPct: r.minorityPct, lowIncomePct: r.lowIncomePct });
          }
        }
      }
    }

    const findings = discoverPfasHealthDeserts(pfasSitesFlat, hpsaFlat, ejFlat);
    allFindings.push(...(stateFilter ? findings.filter(f => f.state === stateFilter) : findings));
  } catch (e: any) {
    errors.push(`pfas-health-deserts: ${e.message}`);
  }

  // ── Breakthrough 2: Flood Damage → Drinking Water Failures ───────────────

  try {
    const nfipAll = getNfipClaimsAll();
    const sdwisAll = getSdwisAllData();

    // Build EJ records near NFIP claim clusters (use states with claims)
    const nfipStates = [...new Set(nfipAll.map(c => c.state))];
    const ejSeen2 = new Set<string>();
    const ejFlat2: { state: string; lat: number; lng: number; ejIndex: number; lowIncomePct: number }[] = [];
    for (const claim of nfipAll.slice(0, 500)) { // sample to avoid N² blowup
      if (claim.lat != null && claim.lng != null) {
        const nearby = getEJScreenCache(claim.lat, claim.lng);
        if (nearby) {
          for (const r of nearby) {
            if (!ejSeen2.has(r.blockGroupId)) {
              ejSeen2.add(r.blockGroupId);
              ejFlat2.push({ state: r.state, lat: r.lat, lng: r.lng, ejIndex: r.ejIndex, lowIncomePct: r.lowIncomePct });
            }
          }
        }
      }
    }

    // Map violations to include state (derived from PWSID prefix or system lookup)
    const systemStateMap = new Map(sdwisAll.systems.map(s => [s.pwsid, s.state]));
    const violsWithState = sdwisAll.violations.map(v => ({
      ...v,
      state: systemStateMap.get(v.pwsid) || v.pwsid.slice(0, 2),
    }));

    const findings = discoverFloodWaterContamination(nfipAll, violsWithState, ejFlat2);
    allFindings.push(...(stateFilter ? findings.filter(f => f.state === stateFilter) : findings));
  } catch (e: any) {
    errors.push(`flood-water-contamination: ${e.message}`);
  }

  // ── Breakthrough 3: Discharge → Impairment ──────────────────────────────

  try {
    const echoAll = getEchoAllData();
    const sncFacilities = echoAll.facilities
      .filter(f => f.snc)
      .map(f => ({
        registryId: f.registryId,
        name: f.name,
        state: f.state,
        lat: f.lat,
        lng: f.lng,
        permitId: f.permitId,
        pollutant: undefined,
      }));

    // We don't have individual impaired waterbody coordinates from ATTAINS,
    // so we use ECHO violations as a proxy for impaired locations
    const impairedProxy = echoAll.violations.map(v => ({
      id: v.registryId,
      name: v.name,
      lat: v.lat,
      lng: v.lng,
      causes: [v.pollutant].filter(Boolean),
      state: v.state,
    }));

    const findings = discoverDischargeImpairmentLinks(sncFacilities, impairedProxy);
    allFindings.push(...(stateFilter ? findings.filter(f => f.state === stateFilter) : findings));
  } catch (e: any) {
    errors.push(`discharge-impairment: ${e.message}`);
  }

  // ── Breakthrough 4: Dam Cascade Risk ────────────────────────────────────

  try {
    const dams = getDamAll();
    const echoAll = getEchoAllData();

    // Use SNC facilities as hazmat proxy
    const hazmatSites = echoAll.facilities
      .filter(f => f.snc || f.qtrsInViolation >= 4)
      .map(f => ({
        facilityName: f.name,
        state: f.state,
        lat: f.lat,
        lng: f.lng,
        sncFlag: f.snc,
      }));

    // Use SDWIS systems as DW intake proxy
    const sdwisAll = getSdwisAllData();
    const dwSystems = sdwisAll.systems.map(s => ({
      pwsid: s.pwsid,
      state: s.state,
      lat: s.lat,
      lng: s.lng,
      populationServed: s.population,
    }));

    const findings = discoverDamCascadeRisk(dams, hazmatSites, dwSystems);
    allFindings.push(...(stateFilter ? findings.filter(f => f.state === stateFilter) : findings));
  } catch (e: any) {
    errors.push(`dam-cascade: ${e.message}`);
  }

  // ── Breakthrough 5: Drought × Reservoir Depletion × Water Violations ────

  try {
    const usdmAll = getUsdmAll();
    const reservoirs = getUsbrAll();

    // Build violations-by-state map from SDWIS
    const violsByState = new Map<string, { total: number; healthBased: number }>();
    const states = stateFilter ? [stateFilter] : PRIORITY_STATES;
    for (const st of states) {
      const stateData = getSdwisForState(st);
      if (stateData) {
        violsByState.set(st, {
          total: stateData.violations.length,
          healthBased: stateData.violations.filter(v => v.isHealthBased).length,
        });
      }
    }

    const droughtStates = Object.values(usdmAll);
    const findings = discoverDroughtWaterStress(droughtStates, reservoirs, violsByState);
    allFindings.push(...(stateFilter ? findings.filter(f => f.state === stateFilter) : findings));
  } catch (e: any) {
    errors.push(`drought-water-stress: ${e.message}`);
  }

  // ── Build summaries ─────────────────────────────────────────────────────

  const summaries: BreakthroughSummary[] = BREAKTHROUGH_CATALOG.map(cat => {
    const findings = allFindings.filter(f => {
      const mapping: Record<string, string[]> = {
        'pfas-health-deserts': ['dodPfasSites', 'hrsaHpsa', 'ejscreen'],
        'flood-water-contamination': ['nfipClaims', 'sdwis', 'ejscreen'],
        'discharge-impairment': ['echo', 'attains'],
        'dam-cascade': ['dam', 'rcra', 'superfund', 'sdwis'],
        'drought-water-stress': ['usdm', 'usbr', 'sdwis'],
        'pathogen-drinking-water': ['cdcNwss', 'nwisIv', 'sdwis'],
      };
      const datasets = mapping[cat.id] || [];
      return f.datasets.some(d => datasets.includes(d));
    });

    return {
      ...cat,
      findingCount: findings.length,
      criticalCount: findings.filter(f => f.severity === 'critical').length,
      topFindings: findings.slice(0, 5),
    };
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return NextResponse.json({
    status: 'ok',
    duration: `${elapsed}s`,
    stateFilter,
    totalFindings: allFindings.length,
    criticalFindings: allFindings.filter(f => f.severity === 'critical').length,
    highFindings: allFindings.filter(f => f.severity === 'high').length,
    breakthroughs: summaries,
    findings: allFindings,
    errors: errors.length > 0 ? errors : undefined,
  });
}
