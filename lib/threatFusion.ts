/* ------------------------------------------------------------------ */
/*  Cross-Domain Threat Fusion — Composite scoring across 6 domains    */
/* ------------------------------------------------------------------ */

import installationsData from '@/data/military-installations.json';
import { findNearestHuc8 } from '@/lib/hucLookup';
import { haversineDistance } from '@/lib/geoUtils';
import { assessInstallationThreats } from '@/lib/installationThreatMonitoring';
import { getCyberRisk } from '@/lib/cyberRiskCache';
import { getScoredHucs } from '@/lib/sentinel/scoringEngine';
import { getFirmsNearPoint } from '@/lib/firmsCache';
import { getAirQualityForState } from '@/lib/airQualityCache';
import { getNwpsCache } from '@/lib/nwpsCache';
import type { InstallationThreatAssessment } from '@/lib/installationThreatMonitoring';

/* ── Types ── */

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

export interface DomainScore {
  domain: string;
  score: number;
  weight: number;
  weightedScore: number;
  detail: string;
}

export type FusionLevel = 'low' | 'moderate' | 'elevated' | 'high' | 'critical';

export interface ThreatFusionResponse {
  installationId: string;
  installationName: string;
  state: string;
  compositeScore: number;
  level: FusionLevel;
  domains: DomainScore[];
  fpcon: string;
  narrative: string;
  protectiveActions: {
    currentFPCON: string;
    recommendedFPCON: string;
    shelterInPlace: boolean;
    evacuationZones: string[];
    respiratoryProtection: string;
  } | null;
  alerts: { domain: string; message: string }[];
  generatedAt: string;
}

/* ── Domain Scoring ── */

const CBRN_LEVEL_SCORE: Record<string, number> = {
  minimal: 10, low: 25, moderate: 50, high: 75, extreme: 95,
};

function aqiToScore(aqi: number | null): number {
  if (aqi == null) return 0;
  if (aqi <= 50) return 10;
  if (aqi <= 100) return 30;
  if (aqi <= 150) return 55;
  if (aqi <= 200) return 75;
  return 95;
}

function floodStatusToScore(status: string): number {
  switch (status) {
    case 'major': return 90;
    case 'moderate': return 60;
    case 'minor': return 30;
    default: return 5;
  }
}

function scoreToLevel(score: number): FusionLevel {
  if (score >= 81) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 41) return 'elevated';
  if (score >= 21) return 'moderate';
  return 'low';
}

/* ── Main ── */

const allInstallations = installationsData as Installation[];

export async function computeThreatFusion(installationId: string): Promise<ThreatFusionResponse | null> {
  const installation = allInstallations.find(i => i.id === installationId);
  if (!installation || !installation.state) return null;

  const domains: DomainScore[] = [];
  const alerts: { domain: string; message: string }[] = [];
  let protectiveActions: ThreatFusionResponse['protectiveActions'] = null;
  let fpcon = 'NORMAL';

  // Gather all domains in parallel
  const [
    threatAssessment,
    , // cyberRisk is sync after warm
    , // sentinel is sync after warm
    , // firms is sync after warm
    , // aq is sync after warm
    , // nwps is sync after warm
  ] = await Promise.all([
    assessInstallationThreats(installationId).catch(() => null),
    Promise.resolve(), // cyber
    Promise.resolve(), // sentinel
    Promise.resolve(), // firms
    Promise.resolve(), // aq
    Promise.resolve(), // nwps
  ]);

  // 1. CBRN
  const cbrnScore = threatAssessment
    ? CBRN_LEVEL_SCORE[threatAssessment.currentRiskLevel] ?? 10
    : 0;
  domains.push({
    domain: 'CBRN',
    score: cbrnScore,
    weight: 0.25,
    weightedScore: cbrnScore * 0.25,
    detail: threatAssessment
      ? `Risk level: ${threatAssessment.currentRiskLevel}, ${threatAssessment.threats.length} threat scenarios`
      : 'Assessment unavailable',
  });
  if (threatAssessment) {
    protectiveActions = threatAssessment.protectiveActions;
    fpcon = (threatAssessment.protectiveActions.currentFPCON ?? 'normal').toUpperCase();
    if (cbrnScore >= 50) {
      alerts.push({ domain: 'CBRN', message: `${threatAssessment.currentRiskLevel.toUpperCase()} atmospheric threat level` });
    }
  }

  // 2. Cyber
  const cyberAssessments = getCyberRisk(installation.state);
  const avgCyberScore = cyberAssessments.length > 0
    ? cyberAssessments.reduce((s, a) => s + a.cyberRiskScore, 0) / cyberAssessments.length
    : 0;
  domains.push({
    domain: 'Cyber',
    score: Math.round(avgCyberScore),
    weight: 0.15,
    weightedScore: avgCyberScore * 0.15,
    detail: `${cyberAssessments.length} systems assessed, avg score ${avgCyberScore.toFixed(0)}`,
  });
  if (avgCyberScore >= 60) {
    alerts.push({ domain: 'Cyber', message: `High cyber risk in ${installation.state} water systems` });
  }

  // 3. Sentinel
  const hucMatch = findNearestHuc8(installation.lat, installation.lng);
  let sentinelScore = 0;
  if (hucMatch && hucMatch.distance <= 100) {
    const scoredHucs = getScoredHucs();
    const huc = scoredHucs.find(h => h.huc8 === hucMatch.huc8);
    if (huc) {
      sentinelScore = Math.min(100, (huc.score * 100) / 300);
      if (huc.level !== 'NOMINAL') {
        alerts.push({ domain: 'Sentinel', message: `Watershed ${hucMatch.huc8} at ${huc.level} (score ${huc.score.toFixed(0)})` });
      }
    }
  }
  domains.push({
    domain: 'Sentinel',
    score: Math.round(sentinelScore),
    weight: 0.20,
    weightedScore: sentinelScore * 0.20,
    detail: hucMatch ? `HUC ${hucMatch.huc8} (${hucMatch.distance.toFixed(0)}km)` : 'No HUC match',
  });

  // 4. Fire
  const fires = getFirmsNearPoint(installation.lat, installation.lng, 30);
  const maxFrp = fires.length > 0 ? Math.max(...fires.map(f => f.frp)) : 0;
  const fireScore = Math.min(100, fires.length * 15 + (maxFrp > 50 ? 20 : 0));
  domains.push({
    domain: 'Fire',
    score: fireScore,
    weight: 0.15,
    weightedScore: fireScore * 0.15,
    detail: `${fires.length} detections within 30mi${maxFrp > 0 ? `, max FRP ${maxFrp.toFixed(0)}MW` : ''}`,
  });
  if (fireScore >= 40) {
    alerts.push({ domain: 'Fire', message: `${fires.length} active fires near installation` });
  }

  // 5. Air Quality
  const aq = getAirQualityForState(installation.state);
  const aqScore = aqiToScore(aq?.usAqi ?? null);
  domains.push({
    domain: 'Air Quality',
    score: aqScore,
    weight: 0.10,
    weightedScore: aqScore * 0.10,
    detail: aq ? `AQI ${aq.usAqi ?? 'N/A'}${aq.pm25 ? `, PM2.5 ${aq.pm25}` : ''}` : 'Data unavailable',
  });
  if (aqScore >= 55) {
    alerts.push({ domain: 'Air Quality', message: `AQI ${aq?.usAqi} — unhealthy for sensitive groups` });
  }

  // 6. Flood
  const gauges = getNwpsCache(installation.lat, installation.lng);
  let floodScore = 5;
  let worstStatus = 'no_flooding';
  if (gauges && gauges.length > 0) {
    for (const g of gauges) {
      const s = floodStatusToScore(g.status);
      if (s > floodScore) {
        floodScore = s;
        worstStatus = g.status;
      }
    }
  }
  domains.push({
    domain: 'Flood',
    score: floodScore,
    weight: 0.15,
    weightedScore: floodScore * 0.15,
    detail: gauges ? `${gauges.length} gauges, worst: ${worstStatus}` : 'No gauges nearby',
  });
  if (floodScore >= 30) {
    alerts.push({ domain: 'Flood', message: `${worstStatus} flooding detected at nearby gauges` });
  }

  // Composite
  const compositeScore = Math.round(domains.reduce((s, d) => s + d.weightedScore, 0));
  const level = scoreToLevel(compositeScore);

  // Top 2 domains for narrative
  const sortedDomains = [...domains].sort((a, b) => b.weightedScore - a.weightedScore);
  const top2 = sortedDomains.slice(0, 2).map(d => d.domain).join(' and ');

  const narrative = `${installation.name} composite threat level is ${level.toUpperCase()} (${compositeScore}/100). Primary concerns: ${top2}. ${alerts.length} active alert(s) require attention.`;

  return {
    installationId: installation.id,
    installationName: installation.name,
    state: installation.state,
    compositeScore,
    level,
    domains,
    fpcon,
    narrative,
    protectiveActions,
    alerts,
    generatedAt: new Date().toISOString(),
  };
}
