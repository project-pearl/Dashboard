/**
 * Risk Forecast Computation Engine
 *
 * Transforms HUC-8 indices + site intelligence report data into 8
 * forward-looking FICO-style risk predictions (0-100 probability).
 */

import type { HucIndices, IndexScore } from './indices/types';
import type {
  SiteIntelligenceReport,
  RiskForecastResult,
  RiskPrediction,
  RiskLevel,
  ConfidenceTier,
  ContributingFactor,
} from './siteIntelTypes';

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function probabilityToRiskLevel(p: number): RiskLevel {
  if (p >= 60) return 'red';
  if (p >= 30) return 'amber';
  return 'green';
}

function confidenceTier(avgConfidence: number): ConfidenceTier {
  if (avgConfidence >= 60) return 'HIGH';
  if (avgConfidence >= 35) return 'MODERATE';
  return 'LOW';
}

/** Get index value or default 50 (neutral) when missing. */
function idxVal(idx: IndexScore | undefined): number {
  return idx?.value ?? 50;
}

/** Get index confidence or 0 when missing. */
function idxConf(idx: IndexScore | undefined): number {
  return idx?.confidence ?? 0;
}

function trendMultiplier(trend: string | undefined): number {
  if (trend === 'declining') return 1.15;
  if (trend === 'improving') return 0.85;
  return 1.0;
}

function factor(name: string, value: number, weight: number, direction: 'positive' | 'neutral' | 'negative'): ContributingFactor {
  return { name, value: Math.round(value), weight, direction };
}

// ─── Scoring functions ──────────────────────────────────────────────────────

function scoreInfrastructureFailure(report: SiteIntelligenceReport, huc: HucIndices | null): RiskPrediction {
  const infraIdx = idxVal(huc?.infrastructureFailure);
  const pcIdx = idxVal(huc?.perCapitaLoad);
  // SDWIS health proxy: % of violations that are health-based
  const sdwisViol = report.regulatory.sdwisViolations;
  const healthViolRatio = sdwisViol.length > 0
    ? sdwisViol.filter((v: any) => v.isHealthBased || v.category === 'Health-Based').length / sdwisViol.length
    : 0.5;
  const sdwisProxy = healthViolRatio * 100;

  let base = infraIdx * 0.50 + pcIdx * 0.30 + sdwisProxy * 0.20;

  // Secondary signals
  const factors: ContributingFactor[] = [
    factor('Infrastructure Failure Index', infraIdx, 0.50, infraIdx >= 60 ? 'negative' : 'positive'),
    factor('Per Capita Load Index', pcIdx, 0.30, pcIdx >= 60 ? 'negative' : 'positive'),
    factor('SDWIS Health Proxy', sdwisProxy, 0.20, sdwisProxy >= 60 ? 'negative' : 'positive'),
  ];

  // Major violations
  const majorViols = report.regulatory.sdwisViolations.filter((v: any) => v.isHealthBased || v.severity === 'Major').length;
  if (majorViols > 0) {
    base += majorViols * 3;
    factors.push(factor(`Major violations (${majorViols})`, majorViols * 3, 0, 'negative'));
  }

  // Enforcement actions
  const enfCount = report.regulatory.sdwisEnforcement.length;
  if (enfCount > 0) {
    base += enfCount * 2;
    factors.push(factor(`SDWIS enforcement (${enfCount})`, enfCount * 2, 0, 'negative'));
  }

  // FEMA disasters
  const femaCount = report.femaDeclarations.length;
  if (femaCount > 0) {
    base += femaCount * 2;
    factors.push(factor(`FEMA declarations (${femaCount})`, femaCount * 2, 0, 'negative'));
  }

  // Apply trend
  base *= trendMultiplier(huc?.infrastructureFailure?.trend);

  const probability = clamp(Math.round(base));
  const avgConf = (idxConf(huc?.infrastructureFailure) + idxConf(huc?.perCapitaLoad)) / 2;

  return {
    category: 'infrastructure-failure',
    label: 'Infrastructure Failure',
    probability,
    riskLevel: probabilityToRiskLevel(probability),
    timeframe: '6 months',
    confidence: confidenceTier(avgConf),
    summary: probability >= 60
      ? 'Elevated risk of infrastructure failure based on aging systems and regulatory burden.'
      : probability >= 30
        ? 'Moderate infrastructure stress detected; preventive maintenance recommended.'
        : 'Infrastructure indicators within acceptable ranges.',
    factors,
    icon: 'Wrench',
  };
}

function scoreImpairmentBreach(report: SiteIntelligenceReport, huc: HucIndices | null): RiskPrediction {
  const plv = idxVal(huc?.pearlLoadVelocity);
  const recovery = 100 - idxVal(huc?.watershedRecovery);
  const ecology = 100 - idxVal(huc?.ecologicalHealth);

  let base = plv * 0.45 + recovery * 0.35 + ecology * 0.20;

  const factors: ContributingFactor[] = [
    factor('PEARL Load Velocity', plv, 0.45, plv >= 60 ? 'negative' : 'positive'),
    factor('Watershed Recovery (inv)', recovery, 0.35, recovery >= 60 ? 'negative' : 'positive'),
    factor('Ecological Health (inv)', ecology, 0.20, ecology >= 60 ? 'negative' : 'positive'),
  ];

  // ATTAINS impairment ratio
  const attains = report.environmentalProfile.attains;
  if (attains && attains.total > 0) {
    const ratio = attains.impaired / attains.total;
    if (ratio > 0.5) {
      base += 10;
      factors.push(factor('ATTAINS impairment >50%', 10, 0, 'negative'));
    }
    if (attains.topCauses.length > 3) {
      base += 5;
      factors.push(factor(`Impairment causes (${attains.topCauses.length})`, 5, 0, 'negative'));
    }
  }

  base *= trendMultiplier(huc?.pearlLoadVelocity?.trend);

  const probability = clamp(Math.round(base));
  const avgConf = (idxConf(huc?.pearlLoadVelocity) + idxConf(huc?.watershedRecovery) + idxConf(huc?.ecologicalHealth)) / 3;

  return {
    category: 'impairment-breach',
    label: 'Impairment Breach',
    probability,
    riskLevel: probabilityToRiskLevel(probability),
    timeframe: '12 months',
    confidence: confidenceTier(avgConf),
    summary: probability >= 60
      ? 'High likelihood of new impairment listing based on pollutant loading trends.'
      : probability >= 30
        ? 'Watershed showing signs of stress; impairment risk is moderate.'
        : 'Watershed conditions are stable with low impairment risk.',
    factors,
    icon: 'Waves',
  };
}

function scoreEnforcementProbability(report: SiteIntelligenceReport, huc: HucIndices | null): RiskPrediction {
  const permit = idxVal(huc?.permitRiskExposure);
  const govResp = 100 - idxVal(huc?.governanceResponse);
  const infra = idxVal(huc?.infrastructureFailure);

  let base = permit * 0.45 + govResp * 0.35 + infra * 0.20;

  const factors: ContributingFactor[] = [
    factor('Permit Risk Exposure', permit, 0.45, permit >= 60 ? 'negative' : 'positive'),
    factor('Governance Response (inv)', govResp, 0.35, govResp >= 60 ? 'negative' : 'positive'),
    factor('Infrastructure Failure', infra, 0.20, infra >= 60 ? 'negative' : 'positive'),
  ];

  // ICIS violations
  const icisViolCount = report.regulatory.icisViolations.length;
  if (icisViolCount > 0) {
    base += icisViolCount * 3;
    factors.push(factor(`ICIS violations (${icisViolCount})`, icisViolCount * 3, 0, 'negative'));
  }

  // RNC (reportable non-compliance) from enforcement
  const rncCount = report.regulatory.icisEnforcement.filter((e: any) => e.type === 'RNC' || e.enforcementType?.includes('RNC')).length;
  if (rncCount > 0) {
    base += rncCount * 5;
    factors.push(factor(`RNC actions (${rncCount})`, rncCount * 5, 0, 'negative'));
  }

  // DMR exceedances
  const dmrExceedCount = report.regulatory.icisDmr.filter((d: any) => d.exceedance || d.violationCode).length;
  if (dmrExceedCount > 0) {
    base += dmrExceedCount * 2;
    factors.push(factor(`DMR exceedances (${dmrExceedCount})`, dmrExceedCount * 2, 0, 'negative'));
  }

  base *= trendMultiplier(huc?.permitRiskExposure?.trend);

  const probability = clamp(Math.round(base));
  const avgConf = (idxConf(huc?.permitRiskExposure) + idxConf(huc?.governanceResponse)) / 2;

  return {
    category: 'enforcement-probability',
    label: 'Enforcement Probability',
    probability,
    riskLevel: probabilityToRiskLevel(probability),
    timeframe: 'Next permit cycle',
    confidence: confidenceTier(avgConf),
    summary: probability >= 60
      ? 'Significant enforcement risk due to permit violations and compliance gaps.'
      : probability >= 30
        ? 'Some compliance concerns noted; proactive engagement with regulators advised.'
        : 'Compliance posture is strong with low enforcement risk.',
    factors,
    icon: 'Scale',
  };
}

function scoreCapacityExceedance(report: SiteIntelligenceReport, huc: HucIndices | null): RiskPrediction {
  const plv = idxVal(huc?.pearlLoadVelocity);
  const infra = idxVal(huc?.infrastructureFailure);
  const pcLoad = idxVal(huc?.perCapitaLoad);

  let base = plv * 0.40 + infra * 0.35 + pcLoad * 0.25;

  const factors: ContributingFactor[] = [
    factor('PEARL Load Velocity', plv, 0.40, plv >= 60 ? 'negative' : 'positive'),
    factor('Infrastructure Failure', infra, 0.35, infra >= 60 ? 'negative' : 'positive'),
    factor('Per Capita Load', pcLoad, 0.25, pcLoad >= 60 ? 'negative' : 'positive'),
  ];

  // DMR exceedances
  const dmrExceedCount = report.regulatory.icisDmr.filter((d: any) => d.exceedance || d.violationCode).length;
  if (dmrExceedCount > 0) {
    base += dmrExceedCount * 2;
    factors.push(factor(`DMR exceedances (${dmrExceedCount})`, dmrExceedCount * 2, 0, 'negative'));
  }

  // Population-based adjustments (using SDWIS system population as proxy)
  const maxPop = Math.max(...report.regulatory.sdwisSystems.map((s: any) => s.population || 0), 0);
  if (maxPop > 250000) {
    base += 10;
    factors.push(factor('Pop >250K', 10, 0, 'negative'));
  } else if (maxPop > 50000) {
    base += 5;
    factors.push(factor('Pop >50K', 5, 0, 'negative'));
  }

  base *= trendMultiplier(huc?.pearlLoadVelocity?.trend);

  const probability = clamp(Math.round(base));
  const avgConf = (idxConf(huc?.pearlLoadVelocity) + idxConf(huc?.infrastructureFailure) + idxConf(huc?.perCapitaLoad)) / 3;

  return {
    category: 'capacity-exceedance',
    label: 'Capacity Exceedance',
    probability,
    riskLevel: probabilityToRiskLevel(probability),
    timeframe: '12 months',
    confidence: confidenceTier(avgConf),
    summary: probability >= 60
      ? 'Treatment capacity at risk of being exceeded due to load trends.'
      : probability >= 30
        ? 'Capacity utilization trending upward; expansion planning warranted.'
        : 'Current capacity appears adequate for projected demand.',
    factors,
    icon: 'Gauge',
  };
}

function scoreCascadingImpact(report: SiteIntelligenceReport, huc: HucIndices | null): RiskPrediction {
  const ecology = 100 - idxVal(huc?.ecologicalHealth);
  const ejVuln = idxVal(huc?.ejVulnerability);
  const plv = idxVal(huc?.pearlLoadVelocity);

  let base = ecology * 0.40 + ejVuln * 0.35 + plv * 0.25;

  const factors: ContributingFactor[] = [
    factor('Ecological Health (inv)', ecology, 0.40, ecology >= 60 ? 'negative' : 'positive'),
    factor('EJ Vulnerability', ejVuln, 0.35, ejVuln >= 60 ? 'negative' : 'positive'),
    factor('PEARL Load Velocity', plv, 0.25, plv >= 60 ? 'negative' : 'positive'),
  ];

  // Superfund sites
  const sfCount = report.contamination.superfund.length;
  if (sfCount > 0) {
    base += sfCount * 4;
    factors.push(factor(`Superfund sites (${sfCount})`, sfCount * 4, 0, 'negative'));
  }

  // ECHO violations
  const echoViolCount = report.contamination.echoViolations.length;
  if (echoViolCount > 0) {
    base += echoViolCount * 3;
    factors.push(factor(`ECHO violations (${echoViolCount})`, echoViolCount * 3, 0, 'negative'));
  }

  // ATTAINS impaired
  const attains = report.environmentalProfile.attains;
  if (attains && attains.impaired > 0) {
    base += 5;
    factors.push(factor('ATTAINS impaired waterbodies', 5, 0, 'negative'));
  }

  base *= trendMultiplier(huc?.ecologicalHealth?.trend);

  const probability = clamp(Math.round(base));
  const avgConf = (idxConf(huc?.ecologicalHealth) + idxConf(huc?.ejVulnerability) + idxConf(huc?.pearlLoadVelocity)) / 3;

  return {
    category: 'cascading-impact',
    label: 'Cascading Impact',
    probability,
    riskLevel: probabilityToRiskLevel(probability),
    timeframe: '12 months',
    confidence: confidenceTier(avgConf),
    summary: probability >= 60
      ? 'Multiple stressors create compounding risks across environmental and social systems.'
      : probability >= 30
        ? 'Some interconnected risk factors detected; monitoring cross-system impacts recommended.'
        : 'Low risk of cascading environmental or social impacts.',
    factors,
    icon: 'GitBranch',
  };
}

function scoreRecoveryTimeline(report: SiteIntelligenceReport, huc: HucIndices | null): RiskPrediction {
  const recovery = idxVal(huc?.watershedRecovery);
  const plv = idxVal(huc?.pearlLoadVelocity);
  const govResp = 100 - idxVal(huc?.governanceResponse);

  // Higher recovery index = better → invert for "risk" framing
  let base = (100 - recovery) * 0.50 + plv * 0.30 + govResp * 0.20;

  const factors: ContributingFactor[] = [
    factor('Watershed Recovery (inv)', 100 - recovery, 0.50, recovery <= 40 ? 'negative' : 'positive'),
    factor('PEARL Load Velocity', plv, 0.30, plv >= 60 ? 'negative' : 'positive'),
    factor('Governance Response (inv)', govResp, 0.20, govResp >= 60 ? 'negative' : 'positive'),
  ];

  const attains = report.environmentalProfile.attains;
  if (attains && attains.total > 0) {
    const ratio = attains.impaired / attains.total;
    if (ratio > 0.5) {
      base += 10;
      factors.push(factor('ATTAINS impairment >50%', 10, 0, 'negative'));
    }
    if (attains.topCauses.length > 5) {
      base += 5;
      factors.push(factor(`Causes >5 (${attains.topCauses.length})`, 5, 0, 'negative'));
    }
  }

  base *= trendMultiplier(huc?.watershedRecovery?.trend);

  const probability = clamp(Math.round(base));
  const avgConf = (idxConf(huc?.watershedRecovery) + idxConf(huc?.pearlLoadVelocity)) / 2;

  return {
    category: 'recovery-timeline',
    label: 'Recovery Timeline',
    probability,
    riskLevel: probabilityToRiskLevel(probability),
    timeframe: '3-5 years',
    confidence: confidenceTier(avgConf),
    summary: probability >= 60
      ? 'Extended recovery timeline expected; significant restoration investment needed.'
      : probability >= 30
        ? 'Recovery is progressing but slower than optimal benchmarks.'
        : 'Watershed recovery trajectory is on track.',
    factors,
    icon: 'Clock',
  };
}

function scorePublicHealthExposure(report: SiteIntelligenceReport, huc: HucIndices | null): RiskPrediction {
  const ejVuln = idxVal(huc?.ejVulnerability);
  const infra = idxVal(huc?.infrastructureFailure);
  // Contaminant proxy: PFAS + superfund proximity
  const pfasCount = report.contamination.pfasDetections;
  const sfCount = report.contamination.superfund.length;
  const contaminantProxy = clamp((pfasCount * 10) + (sfCount * 15), 0, 100);

  let base = ejVuln * 0.40 + infra * 0.30 + contaminantProxy * 0.30;

  const factors: ContributingFactor[] = [
    factor('EJ Vulnerability', ejVuln, 0.40, ejVuln >= 60 ? 'negative' : 'positive'),
    factor('Infrastructure Failure', infra, 0.30, infra >= 60 ? 'negative' : 'positive'),
    factor('Contaminant Proxy', contaminantProxy, 0.30, contaminantProxy >= 60 ? 'negative' : 'positive'),
  ];

  // Population
  const maxPop = Math.max(...report.regulatory.sdwisSystems.map((s: any) => s.population || 0), 0);
  if (maxPop > 100000) {
    base += 5;
    factors.push(factor('Pop >100K', 5, 0, 'negative'));
  }

  // PFAS
  if (pfasCount > 3) {
    base += 5;
    factors.push(factor(`PFAS detections (${pfasCount})`, 5, 0, 'negative'));
  }

  // SDWIS enforcement
  const enfCount = report.regulatory.sdwisEnforcement.length;
  if (enfCount > 0) {
    base += enfCount * 3;
    factors.push(factor(`SDWIS enforcement (${enfCount})`, enfCount * 3, 0, 'negative'));
  }

  base *= trendMultiplier(huc?.ejVulnerability?.trend);

  const probability = clamp(Math.round(base));
  const avgConf = (idxConf(huc?.ejVulnerability) + idxConf(huc?.infrastructureFailure)) / 2;

  return {
    category: 'public-health-exposure',
    label: 'Public Health Exposure',
    probability,
    riskLevel: probabilityToRiskLevel(probability),
    timeframe: '6 months',
    confidence: confidenceTier(avgConf),
    summary: probability >= 60
      ? 'Significant public health exposure risk from contaminants and vulnerable populations.'
      : probability >= 30
        ? 'Some health exposure pathways identified; monitoring is advisable.'
        : 'Public health exposure risk is low based on available data.',
    factors,
    icon: 'HeartPulse',
  };
}

function scoreInterventionROI(report: SiteIntelligenceReport, huc: HucIndices | null): RiskPrediction {
  const ws = report.waterScore;
  const factors: ContributingFactor[] = [];

  if (!ws) {
    return {
      category: 'intervention-roi',
      label: 'Intervention ROI',
      probability: 50,
      riskLevel: 'amber',
      timeframe: '12 months',
      confidence: 'LOW',
      summary: 'Insufficient water score data to model intervention return on investment.',
      factors: [],
      icon: 'TrendingUp',
    };
  }

  // Find the worst category and simulate +20pt improvement
  const cats = ws.categories;
  let worstKey = '';
  let worstScore = 100;
  for (const [key, cat] of Object.entries(cats)) {
    if (cat.score < worstScore) {
      worstScore = cat.score;
      worstKey = key;
    }
  }

  // Category weights from waterRiskScore
  const weights: Record<string, number> = {
    waterQuality: 0.30,
    infrastructure: 0.20,
    compliance: 0.20,
    contamination: 0.15,
    environmentalJustice: 0.15,
  };

  const currentComposite = ws.composite.score;
  const improvedCatScore = Math.min(100, worstScore + 20);
  const delta = (improvedCatScore - worstScore) * (weights[worstKey] || 0.20);
  const newComposite = Math.min(100, currentComposite + delta);
  const improvement = Math.round(newComposite - currentComposite);

  // The "probability" here represents ROI potential (higher = more benefit)
  const probability = clamp(Math.round(improvement * 5 + 20)); // scale to 0-100

  factors.push(factor(`Worst category: ${worstKey}`, worstScore, 0, 'negative'));
  factors.push(factor('Simulated +20pt improvement', improvement, 0, 'positive'));
  factors.push(factor('Projected composite delta', delta, 0, improvement > 3 ? 'positive' : 'neutral'));

  return {
    category: 'intervention-roi',
    label: 'Intervention ROI',
    probability,
    riskLevel: probability >= 60 ? 'green' : probability >= 30 ? 'amber' : 'red', // inverted: high = good
    timeframe: '12 months',
    confidence: confidenceTier(ws.composite.confidence * 100),
    summary: improvement >= 5
      ? `Targeting ${worstKey} could improve composite score by ~${improvement} points.`
      : improvement >= 2
        ? `Modest gains available by addressing ${worstKey} (est. +${improvement} pts).`
        : 'Limited improvement available from single-category intervention.',
    factors,
    icon: 'TrendingUp',
  };
}

// ─── Main export ────────────────────────────────────────────────────────────

export function computeRiskForecast(
  report: SiteIntelligenceReport,
  hucIndices: HucIndices | null,
): RiskForecastResult {
  const predictions: RiskPrediction[] = [
    scoreInfrastructureFailure(report, hucIndices),
    scoreImpairmentBreach(report, hucIndices),
    scoreEnforcementProbability(report, hucIndices),
    scoreCapacityExceedance(report, hucIndices),
    scoreCascadingImpact(report, hucIndices),
    scoreRecoveryTimeline(report, hucIndices),
    scorePublicHealthExposure(report, hucIndices),
    scoreInterventionROI(report, hucIndices),
  ];

  // Blend water risk score into all non-ROI predictions at 10% weight
  const waterScoreRisk = report.waterScore
    ? (100 - report.waterScore.composite.score) / 100 // invert: higher = more risk
    : 0.5;
  for (const pred of predictions) {
    if (pred.category === 'intervention-roi') continue;
    const blended = pred.probability * 0.9 + waterScoreRisk * 100 * 0.1;
    pred.probability = clamp(Math.round(blended));
    pred.riskLevel = probabilityToRiskLevel(pred.probability);
  }

  // Data completeness: how many of the 9 indices are present
  const indexFields: (keyof HucIndices)[] = [
    'pearlLoadVelocity', 'infrastructureFailure', 'watershedRecovery',
    'permitRiskExposure', 'perCapitaLoad', 'waterfrontExposure',
    'ecologicalHealth', 'ejVulnerability', 'governanceResponse',
  ];
  const presentCount = hucIndices
    ? indexFields.filter(k => hucIndices[k] != null).length
    : 0;
  const dataCompleteness = Math.round((presentCount / indexFields.length) * 100);

  // Overall risk: highest non-ROI prediction
  const nonRoi = predictions.filter(p => p.category !== 'intervention-roi');
  const maxProb = Math.max(...nonRoi.map(p => p.probability));
  const overallRiskLevel = probabilityToRiskLevel(maxProb);

  return {
    predictions,
    overallRiskLevel,
    generatedAt: new Date().toISOString(),
    dataCompleteness,
  };
}
