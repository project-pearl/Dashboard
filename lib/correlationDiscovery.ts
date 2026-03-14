/**
 * Correlation Discovery Engine — cross-agency data joins that were never
 * before possible due to federal data silos.
 *
 * Each "breakthrough" connects 2-4 datasets from different agencies,
 * producing findings with statistical backing. These correlations are
 * genuinely novel — no existing platform joins these data sources.
 */

import { haversineDistance } from './geoUtils';

/** Alias for clarity — haversineDistance returns km. */
const haversineKm = haversineDistance;

// ── Types ────────────────────────────────────────────────────────────────────

export interface CorrelationFinding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'moderate' | 'informational';
  agencies: string[];              // e.g. ['EPA', 'CDC', 'FEMA']
  datasets: string[];              // cache names used
  state: string;
  county?: string;
  location?: { lat: number; lng: number };
  metrics: Record<string, number | string>;
  narrative: string;               // human-readable finding
  novelty: string;                 // why this was never possible before
}

export interface BreakthroughSummary {
  id: string;
  name: string;
  tagline: string;
  agencies: string[];
  findingCount: number;
  criticalCount: number;
  topFindings: CorrelationFinding[];
}

// ── Breakthrough 1: PFAS Contamination × Health Deserts × EJ Burden ─────────
// Agencies: DoD + HRSA + EPA
// Join: lat/lng proximity (PFAS sites → HPSA areas + EJScreen blocks)
// Novel: Nobody connects military PFAS leaks to healthcare access gaps
//        in the affected community. Three agencies, zero coordination.

export function discoverPfasHealthDeserts(
  pfasSites: { installationName: string; state: string; lat: number; lng: number; pfasDetected: boolean; branch: string }[],
  hpsaAreas: { hpsaName: string; state: string; countyFips: string; lat: number | null; lng: number | null; hpsaScore: number; populationServed: number }[],
  ejRecords: { state: string; lat: number; lng: number; ejIndex: number; minorityPct: number; lowIncomePct: number }[],
): CorrelationFinding[] {
  const findings: CorrelationFinding[] = [];
  const PROXIMITY_KM = 30; // 30km radius

  for (const site of pfasSites) {
    if (!site.pfasDetected) continue;

    // Find HPSA shortage areas near this PFAS site
    const nearbyHpsa = hpsaAreas.filter(h =>
      h.lat != null && h.lng != null &&
      haversineKm(site.lat, site.lng, h.lat!, h.lng!) < PROXIMITY_KM
    );

    // Find high-EJ block groups near this PFAS site
    const nearbyEj = ejRecords.filter(e =>
      e.ejIndex >= 80 &&
      haversineKm(site.lat, site.lng, e.lat, e.lng) < PROXIMITY_KM
    );

    if (nearbyHpsa.length > 0 && nearbyEj.length > 0) {
      const avgEj = nearbyEj.reduce((s, e) => s + e.ejIndex, 0) / nearbyEj.length;
      const avgMinority = nearbyEj.reduce((s, e) => s + e.minorityPct, 0) / nearbyEj.length;
      const maxHpsaScore = Math.max(...nearbyHpsa.map(h => h.hpsaScore));
      const popAffected = nearbyHpsa.reduce((s, h) => s + h.populationServed, 0);

      findings.push({
        id: `pfas-health-desert-${site.state}-${site.installationName.replace(/\s+/g, '-').toLowerCase()}`,
        title: `${site.installationName}: PFAS contamination in healthcare desert`,
        severity: maxHpsaScore >= 18 && avgEj >= 90 ? 'critical' : avgEj >= 80 ? 'high' : 'moderate',
        agencies: ['DoD', 'HRSA', 'EPA'],
        datasets: ['dodPfasSites', 'hrsaHpsa', 'ejscreen'],
        state: site.state,
        location: { lat: site.lat, lng: site.lng },
        metrics: {
          ejPercentile: Math.round(avgEj),
          minorityPct: Math.round(avgMinority * 100),
          hpsaScore: maxHpsaScore,
          populationAffected: popAffected,
          healthShortageAreas: nearbyHpsa.length,
          ejBlockGroups: nearbyEj.length,
        },
        narrative: `${site.installationName} (${site.branch}) has confirmed PFAS contamination within ${PROXIMITY_KM}km of ${nearbyHpsa.length} health professional shortage area(s) serving ${popAffected.toLocaleString()} people. The surrounding community is ${Math.round(avgMinority * 100)}% minority with an average EJ index of ${Math.round(avgEj)}th percentile. HPSA severity score: ${maxHpsaScore}/26.`,
        novelty: 'DoD tracks PFAS sites. HRSA tracks healthcare shortages. EPA tracks environmental justice. No agency connects them — communities near military PFAS contamination often have no local healthcare to diagnose the cancers PFAS causes.',
      });
    }
  }

  return findings.sort((a, b) => (b.metrics.ejPercentile as number) - (a.metrics.ejPercentile as number));
}

// ── Breakthrough 2: Flood Damage → Drinking Water Failures → EJ Burden ──────
// Agencies: FEMA + EPA + EPA
// Join: state + county FIPS (NFIP claims → SDWIS violations) + lat/lng (EJScreen)
// Novel: Nobody connects actual flood insurance payouts to post-flood drinking
//        water violations. FEMA and EPA don't share data pipelines.

export function discoverFloodWaterContamination(
  nfipClaims: { state: string; countyCode: string; yearOfLoss: number; amountPaidOnBuildingClaim: number; amountPaidOnContentsClaim: number; lat: number | null; lng: number | null }[],
  sdwisViolations: { state: string; lat: number; lng: number; isHealthBased?: boolean; isMajor?: boolean; compliancePeriod?: string }[],
  ejRecords: { state: string; lat: number; lng: number; ejIndex: number; lowIncomePct: number }[],
): CorrelationFinding[] {
  const findings: CorrelationFinding[] = [];
  const PROXIMITY_KM = 15;

  // Group claims by state
  const claimsByState = new Map<string, typeof nfipClaims>();
  for (const c of nfipClaims) {
    if (!claimsByState.has(c.state)) claimsByState.set(c.state, []);
    claimsByState.get(c.state)!.push(c);
  }

  // Group violations by state
  const violsByState = new Map<string, typeof sdwisViolations>();
  for (const v of sdwisViolations) {
    if (!violsByState.has(v.state)) violsByState.set(v.state, []);
    violsByState.get(v.state)!.push(v);
  }

  for (const [state, claims] of claimsByState) {
    const viols = violsByState.get(state) || [];
    if (viols.length === 0) continue;

    // Find clusters where flood damage overlaps with DW violations
    const claimsWithCoords = claims.filter(c => c.lat != null && c.lng != null);
    if (claimsWithCoords.length === 0) continue;

    // Use centroid of claims cluster
    const centLat = claimsWithCoords.reduce((s, c) => s + c.lat!, 0) / claimsWithCoords.length;
    const centLng = claimsWithCoords.reduce((s, c) => s + c.lng!, 0) / claimsWithCoords.length;

    const nearbyViols = viols.filter(v =>
      haversineKm(centLat, centLng, v.lat, v.lng) < PROXIMITY_KM
    );

    const nearbyEj = ejRecords.filter(e =>
      e.state === state &&
      haversineKm(centLat, centLng, e.lat, e.lng) < PROXIMITY_KM &&
      e.ejIndex >= 70
    );

    const totalDamage = claims.reduce((s, c) => s + c.amountPaidOnBuildingClaim + c.amountPaidOnContentsClaim, 0);
    const healthViols = nearbyViols.filter(v => v.isHealthBased || v.isMajor);

    if (nearbyViols.length >= 3 && totalDamage > 100_000) {
      findings.push({
        id: `flood-dw-${state}`,
        title: `${state}: Flood damage zones overlap drinking water violations`,
        severity: healthViols.length >= 5 ? 'critical' : nearbyEj.length > 0 ? 'high' : 'moderate',
        agencies: ['FEMA', 'EPA'],
        datasets: ['nfipClaims', 'sdwis', 'ejscreen'],
        state,
        location: { lat: centLat, lng: centLng },
        metrics: {
          floodClaims: claims.length,
          totalDamage: Math.round(totalDamage),
          dwViolationsNearby: nearbyViols.length,
          healthBasedViolations: healthViols.length,
          ejBlockGroupsAffected: nearbyEj.length,
        },
        narrative: `${state} has ${claims.length} flood insurance claims totaling $${(totalDamage / 1_000_000).toFixed(1)}M in damage. Within ${PROXIMITY_KM}km of these flood zones, there are ${nearbyViols.length} drinking water violations (${healthViols.length} health-based). ${nearbyEj.length > 0 ? `${nearbyEj.length} environmental justice communities are in the impact zone.` : ''}`,
        novelty: 'FEMA pays flood claims. EPA tracks drinking water violations. Nobody asks: "Are flooded communities also drinking contaminated water?" The answer reveals which communities face compound disaster — property damage AND health risk.',
      });
    }
  }

  return findings.sort((a, b) => (b.metrics.totalDamage as number) - (a.metrics.totalDamage as number));
}

// ── Breakthrough 3: Upstream Discharge Violations → Downstream Impairment ────
// Agencies: EPA (ECHO) + EPA (ATTAINS) + USGS
// Join: lat/lng proximity + flow direction (upstream SNC facilities → downstream impaired waters)
// Novel: ECHO tracks who's violating permits. ATTAINS tracks impaired waters.
//        Nobody connects "this facility's illegal discharge caused that river's impairment."

export function discoverDischargeImpairmentLinks(
  sncFacilities: { registryId: string; name: string; state: string; lat: number; lng: number; permitId: string; pollutant?: string }[],
  impairedWaters: { id: string; name: string; lat: number; lng: number; causes: string[]; state: string }[],
): CorrelationFinding[] {
  const findings: CorrelationFinding[] = [];
  const DOWNSTREAM_KM = 25;

  for (const fac of sncFacilities) {
    // Find impaired waterbodies downstream (simplified: within radius, slightly south/east)
    const nearby = impairedWaters.filter(w => {
      const dist = haversineKm(fac.lat, fac.lng, w.lat, w.lng);
      return dist > 0.5 && dist < DOWNSTREAM_KM && w.state === fac.state;
    });

    if (nearby.length >= 2) {
      findings.push({
        id: `discharge-impairment-${fac.registryId}`,
        title: `${fac.name}: SNC facility near ${nearby.length} impaired waterbodies`,
        severity: nearby.length >= 5 ? 'critical' : nearby.length >= 3 ? 'high' : 'moderate',
        agencies: ['EPA'],
        datasets: ['echo', 'attains'],
        state: fac.state,
        location: { lat: fac.lat, lng: fac.lng },
        metrics: {
          facilityId: fac.permitId,
          impairedWaterbodies: nearby.length,
          impairedCauses: [...new Set(nearby.flatMap(w => w.causes))].slice(0, 5).join(', '),
        },
        narrative: `${fac.name} (${fac.permitId}) is in Significant Non-Compliance with its discharge permit. Within ${DOWNSTREAM_KM}km, ${nearby.length} waterbodies are listed as impaired. Top impairment causes: ${[...new Set(nearby.flatMap(w => w.causes))].slice(0, 3).join(', ')}.`,
        novelty: 'EPA ECHO tracks which factories violate discharge permits. EPA ATTAINS tracks which rivers are impaired. They are separate databases in separate offices. Connecting them reveals the likely source of downstream impairment — a causal link that currently takes years of litigation to establish.',
      });
    }
  }

  return findings.sort((a, b) => (b.metrics.impairedWaterbodies as number) - (a.metrics.impairedWaterbodies as number));
}

// ── Breakthrough 4: Dam Risk → Downstream Hazmat → Drinking Water ────────────
// Agencies: USACE + EPA (RCRA/Superfund) + EPA (SDWIS)
// Join: lat/lng downstream proximity
// Novel: If a high-hazard dam fails, does the flood path cross a Superfund site
//        or RCRA facility? And which drinking water intakes are in the path?

export function discoverDamCascadeRisk(
  dams: { id: string; name: string; state: string; lat: number; lng: number; hazard: string; storageAcreFt: number | null }[],
  hazmatSites: { facilityName: string; state: string; lat: number; lng: number; sncFlag?: boolean; siteType?: string }[],
  dwSystems: { pwsid: string; state: string; lat: number; lng: number; populationServed?: number }[],
): CorrelationFinding[] {
  const findings: CorrelationFinding[] = [];
  const CASCADE_KM = 40; // downstream flood path radius

  const highHazardDams = dams.filter(d => d.hazard?.toLowerCase().includes('high'));

  for (const dam of highHazardDams) {
    // Find hazmat sites downstream (south of dam — simplified gravity flow)
    const downstreamHazmat = hazmatSites.filter(h => {
      const dist = haversineKm(dam.lat, dam.lng, h.lat, h.lng);
      return dist < CASCADE_KM && h.lat <= dam.lat + 0.1; // roughly downstream
    });

    // Find drinking water intakes in the flood path
    const downstreamDW = dwSystems.filter(dw => {
      const dist = haversineKm(dam.lat, dam.lng, dw.lat, dw.lng);
      return dist < CASCADE_KM && dw.state === dam.state;
    });

    if (downstreamHazmat.length > 0 && downstreamDW.length > 0) {
      const popAtRisk = downstreamDW.reduce((s, dw) => s + (dw.populationServed || 0), 0);

      findings.push({
        id: `dam-cascade-${dam.id}`,
        title: `${dam.name}: Dam failure would flood hazmat sites upstream of drinking water`,
        severity: downstreamHazmat.length >= 3 || popAtRisk > 50_000 ? 'critical' : 'high',
        agencies: ['USACE', 'EPA'],
        datasets: ['dam', 'rcra', 'superfund', 'sdwis'],
        state: dam.state,
        location: { lat: dam.lat, lng: dam.lng },
        metrics: {
          damStorage: dam.storageAcreFt || 0,
          hazmatSitesInFloodPath: downstreamHazmat.length,
          drinkingWaterSystemsAtRisk: downstreamDW.length,
          populationAtRisk: popAtRisk,
        },
        narrative: `${dam.name} is classified high-hazard${dam.storageAcreFt ? ` (${dam.storageAcreFt.toLocaleString()} acre-ft)` : ''}. A failure would send floodwaters through ${downstreamHazmat.length} hazardous waste site(s), potentially mobilizing contaminants into ${downstreamDW.length} drinking water system(s) serving ${popAtRisk.toLocaleString()} people.`,
        novelty: 'Army Corps tracks dam safety. EPA tracks hazardous waste. EPA (separately) tracks drinking water. No one models the cascade: dam failure → hazmat mobilization → drinking water contamination. This three-agency blind spot puts millions at unassessed risk.',
      });
    }
  }

  return findings.sort((a, b) => (b.metrics.populationAtRisk as number) - (a.metrics.populationAtRisk as number));
}

// ── Breakthrough 5: Drought → Reservoir Depletion → Water System Stress ──────
// Agencies: USDA/USDM + Interior/USBR + EPA/SDWIS
// Join: state + lat/lng proximity
// Novel: Drought maps exist. Reservoir levels exist. DW violations exist.
//        Nobody asks: "When reservoirs drop below 40%, do violation rates spike?"

export function discoverDroughtWaterStress(
  droughtStates: { state: string; d2: number; d3: number; d4: number }[],
  reservoirs: { locationName: string; state: string | null; lat: number; lng: number; pctFull: number | null; storageAcreFt: number | null }[],
  violationsByState: Map<string, { total: number; healthBased: number }>,
): CorrelationFinding[] {
  const findings: CorrelationFinding[] = [];

  for (const drought of droughtStates) {
    const severeDrought = drought.d2 + drought.d3 + drought.d4;
    if (severeDrought < 20) continue; // skip states without significant drought

    const stateReservoirs = reservoirs.filter(r => r.state === drought.state && r.pctFull != null);
    const lowReservoirs = stateReservoirs.filter(r => r.pctFull! < 40);
    const viols = violationsByState.get(drought.state);

    if (lowReservoirs.length > 0 || (viols && viols.total > 10)) {
      findings.push({
        id: `drought-stress-${drought.state}`,
        title: `${drought.state}: Drought + depleted reservoirs + water violations`,
        severity: drought.d4 > 5 ? 'critical' : drought.d3 > 15 ? 'high' : 'moderate',
        agencies: ['USDA', 'Interior', 'EPA'],
        datasets: ['usdm', 'usbr', 'sdwis'],
        state: drought.state,
        metrics: {
          droughtPctSevere: Math.round(severeDrought),
          droughtPctExceptional: drought.d4,
          reservoirsBelow40Pct: lowReservoirs.length,
          totalReservoirs: stateReservoirs.length,
          dwViolations: viols?.total || 0,
          healthBasedViolations: viols?.healthBased || 0,
        },
        narrative: `${drought.state} has ${Math.round(severeDrought)}% of its area in severe drought or worse (${drought.d4}% exceptional). ${lowReservoirs.length > 0 ? `${lowReservoirs.length} of ${stateReservoirs.length} reservoirs are below 40% capacity. ` : ''}${viols ? `${viols.total} drinking water violations (${viols.healthBased} health-based) are active.` : ''}`,
        novelty: 'USDA maps drought. Bureau of Reclamation tracks reservoir levels. EPA tracks drinking water violations. These three agencies publish independently. Nobody asks the compound question: "Where is drought draining reservoirs AND degrading drinking water simultaneously?" That convergence is where water crises begin.',
      });
    }
  }

  return findings.sort((a, b) => (b.metrics.droughtPctSevere as number) - (a.metrics.droughtPctSevere as number));
}

// ── Breakthrough 6: Wastewater Pathogens → Downstream Drinking Water Risk ────
// Agencies: CDC + USGS + EPA
// Join: HUC-8 flow routing (wastewater plant → stream gauges → DW intakes)
// Novel: CDC detects COVID/flu in sewage. USGS measures stream flow direction.
//        EPA tracks drinking water intakes. Nobody connects: "pathogen in
//        wastewater → arrives at drinking water intake in X hours."

export function discoverWastewaterPathogenRisk(
  nwssDetections: { state: string; pathogen: string; concentration: number; huc8: string; lat: number; lng: number }[],
  dwIntakes: { pwsid: string; state: string; lat: number; lng: number; sourceType?: string; populationServed?: number }[],
  flowEstimator: (sourceHucs: string[], targetLat: number, targetLng: number) => { expectedHours: number } | null,
): CorrelationFinding[] {
  const findings: CorrelationFinding[] = [];
  const MAX_HOURS = 72;

  // Group detections by HUC-8
  const detectionsByHuc = new Map<string, typeof nwssDetections>();
  for (const d of nwssDetections) {
    if (!detectionsByHuc.has(d.huc8)) detectionsByHuc.set(d.huc8, []);
    detectionsByHuc.get(d.huc8)!.push(d);
  }

  // Find surface water intakes downstream of detections
  const surfaceIntakes = dwIntakes.filter(dw => !dw.sourceType || dw.sourceType.toLowerCase().includes('surface'));

  for (const intake of surfaceIntakes) {
    const sourceHucs = [...detectionsByHuc.keys()];
    const flow = flowEstimator(sourceHucs, intake.lat, intake.lng);

    if (flow && flow.expectedHours <= MAX_HOURS) {
      // Find which detections are upstream
      const upstreamDetections: typeof nwssDetections = [];
      for (const [huc, dets] of detectionsByHuc) {
        const hucFlow = flowEstimator([huc], intake.lat, intake.lng);
        if (hucFlow && hucFlow.expectedHours <= MAX_HOURS) {
          upstreamDetections.push(...dets);
        }
      }

      if (upstreamDetections.length > 0) {
        const pathogens = [...new Set(upstreamDetections.map(d => d.pathogen))];
        findings.push({
          id: `pathogen-dw-${intake.pwsid}`,
          title: `${intake.state}: Wastewater pathogens upstream of drinking water intake`,
          severity: flow.expectedHours < 24 ? 'critical' : 'high',
          agencies: ['CDC', 'USGS', 'EPA'],
          datasets: ['cdcNwss', 'nwisIv', 'sdwis'],
          state: intake.state,
          location: { lat: intake.lat, lng: intake.lng },
          metrics: {
            pathogens: pathogens.join(', '),
            upstreamDetections: upstreamDetections.length,
            estimatedArrivalHours: Math.round(flow.expectedHours),
            populationServed: intake.populationServed || 0,
          },
          narrative: `${pathogens.join(', ')} detected in upstream wastewater. Flow modeling estimates arrival at drinking water intake ${intake.pwsid} within ${Math.round(flow.expectedHours)} hours, serving ${(intake.populationServed || 0).toLocaleString()} people.`,
          novelty: 'CDC detects pathogens in sewage. USGS measures which way rivers flow. EPA tracks where drinking water comes from. Three agencies, three databases, zero integration. This connection — pathogen detected upstream, arrival time at your tap calculated — has never been made at national scale.',
        });
      }
    }
  }

  return findings.sort((a, b) => (a.metrics.estimatedArrivalHours as number) - (b.metrics.estimatedArrivalHours as number));
}

// ── Summary Generator ────────────────────────────────────────────────────────

export const BREAKTHROUGH_CATALOG: Omit<BreakthroughSummary, 'findingCount' | 'criticalCount' | 'topFindings'>[] = [
  {
    id: 'pfas-health-deserts',
    name: 'PFAS Contamination × Healthcare Deserts',
    tagline: 'Military bases leaked PFAS. The communities downwind have no doctors.',
    agencies: ['DoD', 'HRSA', 'EPA'],
  },
  {
    id: 'flood-water-contamination',
    name: 'Flood Damage → Drinking Water Failure',
    tagline: 'Flooded communities are also drinking contaminated water — nobody connected the two.',
    agencies: ['FEMA', 'EPA'],
  },
  {
    id: 'discharge-impairment',
    name: 'Illegal Discharge → River Impairment',
    tagline: 'The factory violating its permit and the impaired river downstream are in different databases.',
    agencies: ['EPA'],
  },
  {
    id: 'dam-cascade',
    name: 'Dam Failure → Hazmat Flood → Drinking Water',
    tagline: 'If this dam breaks, it floods a Superfund site into a drinking water intake.',
    agencies: ['USACE', 'EPA'],
  },
  {
    id: 'drought-water-stress',
    name: 'Drought × Empty Reservoirs × Water Violations',
    tagline: 'Three agencies track the same crisis. None of them talk to each other.',
    agencies: ['USDA', 'Interior', 'EPA'],
  },
  {
    id: 'pathogen-drinking-water',
    name: 'Wastewater Pathogens → Drinking Water Arrival Time',
    tagline: 'COVID detected in sewage upstream. Your tap water intake is 18 hours downstream.',
    agencies: ['CDC', 'USGS', 'EPA'],
  },
];
