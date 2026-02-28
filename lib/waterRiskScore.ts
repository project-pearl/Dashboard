/**
 * Water Risk Score — Composite 0-100 scoring algorithm
 *
 * Five category sub-scores (higher = safer):
 *   Water Quality (30%), Infrastructure (20%), Compliance (20%),
 *   Contamination (15%), Environmental Justice (15%)
 */

import type { GradeLetter, WaterQualityGrade, Observation } from './waterQualityScore';
import type { HucIndices } from './indices/types';
import { applyConfidenceRegression } from './indices/confidence';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryScore {
  score: number;
  label: string;
  confidence: number;
  factors: { name: string; value: string; impact: 'positive' | 'neutral' | 'negative' }[];
}

export type CategoryKey =
  | 'waterQuality'
  | 'infrastructure'
  | 'compliance'
  | 'contamination'
  | 'environmentalJustice';

export interface WaterRiskScoreResult {
  composite: {
    score: number;
    letter: GradeLetter;
    confidence: number;
    color: string;
    bgColor: string;
  };
  categories: Record<CategoryKey, CategoryScore>;
  details: {
    violations: number;
    pfasDetections: number;
    triFacilities: number;
    impairments: number;
    observations: Observation[];
    implications: Observation[];
  };
  dataSources: string[];
}

// ─── Input data shape (assembled by API route) ───────────────────────────────

export interface RiskScoreInput {
  wqpGrade: WaterQualityGrade | null;
  hucIndices: HucIndices | null;
  sdwis: { systems: unknown[]; violations: unknown[]; enforcement: unknown[] } | null;
  icis: { permits: unknown[]; violations: unknown[]; enforcement?: unknown[] } | null;
  echo: { facilities: unknown[]; violations: unknown[] } | null;
  pfas: { results: unknown[] } | null;
  tri: unknown[] | null;
  attains: { impaired: number; total: number; topCauses: string[] } | null;
  ejscreen: Record<string, unknown> | null;
}

// ─── Score-to-letter (replicated from waterQualityScore.ts, not exported) ────

function scoreToLetter(score: number): GradeLetter {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A-';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B-';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C-';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D-';
  return 'F';
}

function gradeStyle(letter: GradeLetter | null): { color: string; bgColor: string } {
  if (!letter) return { color: 'text-slate-500', bgColor: 'bg-slate-100' };
  const l = letter.charAt(0);
  switch (l) {
    case 'A': return { color: 'text-green-700', bgColor: 'bg-green-100' };
    case 'B': return { color: 'text-emerald-700', bgColor: 'bg-emerald-100' };
    case 'C': return { color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
    case 'D': return { color: 'text-orange-700', bgColor: 'bg-orange-100' };
    case 'F': return { color: 'text-red-700', bgColor: 'bg-red-100' };
    default: return { color: 'text-slate-500', bgColor: 'bg-slate-100' };
  }
}

// ─── Category weights ─────────────────────────────────────────────────────────

const CATEGORY_WEIGHTS: Record<CategoryKey, number> = {
  waterQuality: 0.30,
  infrastructure: 0.20,
  compliance: 0.20,
  contamination: 0.15,
  environmentalJustice: 0.15,
};

// ─── Category scorers ─────────────────────────────────────────────────────────

function scoreWaterQuality(input: RiskScoreInput): CategoryScore {
  const factors: CategoryScore['factors'] = [];
  let score = 50; // neutral fallback
  let confidence = 20;

  if (input.wqpGrade?.canBeGraded && input.wqpGrade.score !== null) {
    score = input.wqpGrade.score;
    confidence = Math.min(100, input.wqpGrade.gradedParamCount * 15);
    factors.push({
      name: 'Water Quality Grade',
      value: `${input.wqpGrade.letter} (${input.wqpGrade.score})`,
      impact: score >= 70 ? 'positive' : score >= 50 ? 'neutral' : 'negative',
    });
    factors.push({
      name: 'Parameters Monitored',
      value: `${input.wqpGrade.gradedParamCount} of ${input.wqpGrade.gradedParamTotal}`,
      impact: input.wqpGrade.gradedParamCount >= 4 ? 'positive' : 'neutral',
    });
  } else if (input.attains) {
    // ATTAINS fallback
    const ratio = input.attains.total > 0
      ? 1 - input.attains.impaired / input.attains.total
      : 0.5;
    score = Math.round(ratio * 100);
    confidence = 30;
    factors.push({
      name: 'ATTAINS Assessment',
      value: `${input.attains.impaired} of ${input.attains.total} impaired`,
      impact: ratio >= 0.7 ? 'positive' : ratio >= 0.4 ? 'neutral' : 'negative',
    });
    if (input.attains.topCauses.length > 0) {
      factors.push({
        name: 'Top Impairment Causes',
        value: input.attains.topCauses.slice(0, 3).join(', '),
        impact: 'negative',
      });
    }
  } else {
    factors.push({ name: 'Data Availability', value: 'No monitoring data', impact: 'neutral' });
  }

  return { score: clamp(score), label: 'Water Quality', confidence, factors };
}

function scoreInfrastructure(input: RiskScoreInput): CategoryScore {
  const factors: CategoryScore['factors'] = [];
  let score = 50;
  let confidence = 20;

  // HUC-8 index (inverted: high value = high risk → low safety)
  if (input.hucIndices?.infrastructureFailure) {
    const idx = input.hucIndices.infrastructureFailure;
    score = clamp(100 - idx.value);
    confidence = idx.confidence;
    factors.push({
      name: 'Infrastructure Failure Index',
      value: `${idx.value}/100 (${idx.trend})`,
      impact: idx.value <= 30 ? 'positive' : idx.value <= 60 ? 'neutral' : 'negative',
    });
  }

  // Augment with SDWIS violation counts
  if (input.sdwis) {
    const sysCount = input.sdwis.systems.length;
    const violCount = input.sdwis.violations.length;
    factors.push({
      name: 'Drinking Water Systems',
      value: `${sysCount} system${sysCount !== 1 ? 's' : ''}`,
      impact: sysCount > 0 ? 'positive' : 'neutral',
    });
    if (violCount > 0) {
      const penalty = Math.min(20, violCount * 3);
      score = clamp(score - penalty);
      factors.push({
        name: 'SDWIS Violations',
        value: `${violCount} violation${violCount !== 1 ? 's' : ''}`,
        impact: 'negative',
      });
    } else if (sysCount > 0) {
      factors.push({ name: 'SDWIS Violations', value: 'None', impact: 'positive' });
    }
    if (confidence < 40 && sysCount > 0) confidence = 40;
  }

  return { score: clamp(score), label: 'Infrastructure', confidence, factors };
}

function scoreCompliance(input: RiskScoreInput): CategoryScore {
  const factors: CategoryScore['factors'] = [];
  let score = 50;
  let confidence = 20;

  // HUC-8 permit risk index (inverted)
  if (input.hucIndices?.permitRiskExposure) {
    const idx = input.hucIndices.permitRiskExposure;
    score = clamp(100 - idx.value);
    confidence = idx.confidence;
    factors.push({
      name: 'Permit Risk Index',
      value: `${idx.value}/100 (${idx.trend})`,
      impact: idx.value <= 30 ? 'positive' : idx.value <= 60 ? 'neutral' : 'negative',
    });
  }

  // ICIS violations
  if (input.icis) {
    const permitCount = input.icis.permits.length;
    const violCount = input.icis.violations.length;
    if (permitCount > 0) {
      factors.push({
        name: 'NPDES Permits',
        value: `${permitCount} permit${permitCount !== 1 ? 's' : ''}`,
        impact: 'neutral',
      });
    }
    if (violCount > 0) {
      const penalty = Math.min(25, violCount * 4);
      score = clamp(score - penalty);
      factors.push({
        name: 'NPDES Violations',
        value: `${violCount} violation${violCount !== 1 ? 's' : ''}`,
        impact: 'negative',
      });
    } else if (permitCount > 0) {
      score = clamp(score + 5);
      factors.push({ name: 'NPDES Violations', value: 'None', impact: 'positive' });
    }
    if (input.icis.enforcement && (input.icis.enforcement as unknown[]).length > 0) {
      const enfCount = (input.icis.enforcement as unknown[]).length;
      factors.push({
        name: 'Enforcement Actions',
        value: `${enfCount} action${enfCount !== 1 ? 's' : ''}`,
        impact: 'negative',
      });
      score = clamp(score - Math.min(10, enfCount * 3));
    }
    if (confidence < 40 && permitCount > 0) confidence = 40;
  }

  return { score: clamp(score), label: 'Compliance', confidence, factors };
}

function scoreContamination(input: RiskScoreInput): CategoryScore {
  const factors: CategoryScore['factors'] = [];
  const subScores: number[] = [];
  let confidence = 20;

  // PFAS
  if (input.pfas) {
    const pfasCount = input.pfas.results.length;
    if (pfasCount === 0) {
      subScores.push(90);
      factors.push({ name: 'PFAS Detections', value: 'None detected', impact: 'positive' });
    } else {
      const pfasScore = clamp(90 - pfasCount * 8);
      subScores.push(pfasScore);
      factors.push({
        name: 'PFAS Detections',
        value: `${pfasCount} detection${pfasCount !== 1 ? 's' : ''}`,
        impact: pfasCount >= 5 ? 'negative' : 'neutral',
      });
    }
    confidence = Math.max(confidence, 40);
  }

  // TRI
  if (input.tri) {
    const triCount = Array.isArray(input.tri) ? input.tri.length : 0;
    if (triCount === 0) {
      subScores.push(90);
      factors.push({ name: 'TRI Facilities', value: 'None nearby', impact: 'positive' });
    } else {
      const triScore = clamp(85 - triCount * 5);
      subScores.push(triScore);
      factors.push({
        name: 'TRI Facilities',
        value: `${triCount} facilit${triCount !== 1 ? 'ies' : 'y'}`,
        impact: triCount >= 5 ? 'negative' : 'neutral',
      });
    }
    confidence = Math.max(confidence, 40);
  }

  // ECHO
  if (input.echo) {
    const echoViols = input.echo.violations.length;
    if (echoViols === 0) {
      subScores.push(90);
      factors.push({ name: 'ECHO Violations', value: 'None', impact: 'positive' });
    } else {
      const echoScore = clamp(85 - echoViols * 5);
      subScores.push(echoScore);
      factors.push({
        name: 'ECHO Violations',
        value: `${echoViols} violation${echoViols !== 1 ? 's' : ''}`,
        impact: 'negative',
      });
    }
    confidence = Math.max(confidence, 40);
  }

  const score = subScores.length > 0
    ? Math.round(subScores.reduce((a, b) => a + b, 0) / subScores.length)
    : 50;

  return { score: clamp(score), label: 'Contamination', confidence, factors };
}

function scoreEnvironmentalJustice(input: RiskScoreInput): CategoryScore {
  const factors: CategoryScore['factors'] = [];
  let score = 50;
  let confidence = 20;

  // HUC-8 EJ index (inverted: high vulnerability = low safety)
  if (input.hucIndices?.ejVulnerability) {
    const idx = input.hucIndices.ejVulnerability;
    score = clamp(100 - idx.value);
    confidence = idx.confidence;
    factors.push({
      name: 'EJ Vulnerability Index',
      value: `${idx.value}/100 (${idx.trend})`,
      impact: idx.value <= 30 ? 'positive' : idx.value <= 60 ? 'neutral' : 'negative',
    });
  }

  // EJScreen API augmentation
  if (input.ejscreen) {
    const raw = input.ejscreen as Record<string, unknown>;
    // EJScreen returns data in a RAW_DATA property or directly
    const data = (raw.RAW_DATA as Record<string, unknown>) || raw;

    const ejIndex = parseEjValue(data['EJINDEX'] || data['P_LDPNT_D2']);
    const lowIncome = parseEjValue(data['LOWINCPCT'] || data['P_LWINCPCT']);
    const minority = parseEjValue(data['MINORPCT'] || data['P_MINORITY']);
    const wastewater = parseEjValue(data['P_DWATER'] || data['D_DWATER_2']);

    if (ejIndex !== null) {
      factors.push({
        name: 'EJ Index Percentile',
        value: `${Math.round(ejIndex)}%`,
        impact: ejIndex <= 50 ? 'positive' : ejIndex <= 75 ? 'neutral' : 'negative',
      });
      // High EJ percentile = more vulnerable = lower safety score
      const ejPenalty = Math.round((ejIndex / 100) * 20);
      score = clamp(score - ejPenalty + 10);
      confidence = Math.max(confidence, 50);
    }
    if (lowIncome !== null) {
      factors.push({
        name: 'Low Income %',
        value: `${Math.round(lowIncome * 100)}%`,
        impact: lowIncome <= 0.2 ? 'positive' : lowIncome <= 0.4 ? 'neutral' : 'negative',
      });
    }
    if (minority !== null) {
      factors.push({
        name: 'Minority %',
        value: `${Math.round(minority * 100)}%`,
        impact: 'neutral',
      });
    }
    if (wastewater !== null) {
      factors.push({
        name: 'Wastewater Discharge',
        value: `${Math.round(wastewater)}th pctile`,
        impact: wastewater <= 50 ? 'positive' : wastewater <= 75 ? 'neutral' : 'negative',
      });
    }
  }

  return { score: clamp(score), label: 'Environmental Justice', confidence, factors };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function parseEjValue(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return isNaN(n) ? null : n;
}

function conditionLabel(score: number): string {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

// ─── Main computation ─────────────────────────────────────────────────────────

export function computeWaterRiskScore(input: RiskScoreInput): WaterRiskScoreResult {
  const categories: Record<CategoryKey, CategoryScore> = {
    waterQuality: scoreWaterQuality(input),
    infrastructure: scoreInfrastructure(input),
    compliance: scoreCompliance(input),
    contamination: scoreContamination(input),
    environmentalJustice: scoreEnvironmentalJustice(input),
  };

  // Weighted composite
  let rawComposite = 0;
  let totalConfidence = 0;
  for (const key of Object.keys(CATEGORY_WEIGHTS) as CategoryKey[]) {
    rawComposite += categories[key].score * CATEGORY_WEIGHTS[key];
    totalConfidence += categories[key].confidence * CATEGORY_WEIGHTS[key];
  }
  const overallConfidence = Math.round(totalConfidence);

  // Apply confidence regression if sparse data
  const composite = overallConfidence < 40
    ? applyConfidenceRegression(Math.round(rawComposite), overallConfidence)
    : clamp(Math.round(rawComposite));

  const letter = scoreToLetter(composite);
  const style = gradeStyle(letter);

  // Aggregate details
  const violations =
    (input.sdwis?.violations.length || 0) +
    (input.icis?.violations.length || 0) +
    (input.echo?.violations.length || 0);
  const pfasDetections = input.pfas?.results.length || 0;
  const triFacilities = Array.isArray(input.tri) ? input.tri.length : 0;
  const impairments = input.attains?.impaired || 0;

  // Build observations
  const observations: Observation[] = [];
  const implications: Observation[] = [];

  // Composite-level observations
  if (composite >= 80) {
    observations.push({ icon: '✅', text: `Overall water risk score is ${composite}/100 (${letter}). This area demonstrates strong water quality and infrastructure performance.`, severity: 'info' });
  } else if (composite >= 60) {
    observations.push({ icon: '🟡', text: `Overall water risk score is ${composite}/100 (${letter}). Some areas of concern identified — review category details below.`, severity: 'warning' });
  } else {
    observations.push({ icon: '🔴', text: `Overall water risk score is ${composite}/100 (${letter}). Significant water risk factors identified. Immediate attention recommended.`, severity: 'critical' });
  }

  // Category-specific observations
  for (const key of Object.keys(categories) as CategoryKey[]) {
    const cat = categories[key];
    if (cat.score < 40) {
      observations.push({
        icon: '⚠️',
        text: `${cat.label}: ${conditionLabel(cat.score)} condition (${cat.score}/100). ${cat.factors.filter(f => f.impact === 'negative').map(f => f.name + ': ' + f.value).join('; ') || 'Multiple risk factors present.'}`,
        severity: 'critical',
      });
    } else if (cat.score < 60) {
      observations.push({
        icon: '⚠️',
        text: `${cat.label}: ${conditionLabel(cat.score)} condition (${cat.score}/100).`,
        severity: 'warning',
      });
    }
  }

  // Confidence observation
  if (overallConfidence < 40) {
    observations.push({
      icon: '📊',
      text: `Limited data available (confidence: ${overallConfidence}%). Score has been regressed toward neutral to avoid false precision.`,
      severity: 'warning',
    });
  }

  // Implications
  if (composite < 60) {
    implications.push({ icon: '⚡', text: 'Low scores may indicate persistent environmental contamination, aging infrastructure, or regulatory non-compliance requiring immediate intervention.', severity: 'critical' });
  } else if (composite < 70) {
    implications.push({ icon: '📋', text: 'Moderate risk areas may benefit from enhanced monitoring, infrastructure upgrades, or source water protection measures.', severity: 'warning' });
  }
  if (violations > 5) {
    implications.push({ icon: '⚖️', text: `${violations} total violations across all programs may trigger enhanced regulatory oversight or enforcement action.`, severity: 'warning' });
  }
  if (pfasDetections > 0) {
    implications.push({ icon: '🔬', text: `PFAS detected in the area. EPA\'s proposed PFAS limits (4 ppt for PFOA/PFOS) may require treatment upgrades.`, severity: 'warning' });
  }

  // Data sources
  const dataSources: string[] = [];
  if (input.wqpGrade?.canBeGraded) dataSources.push('EPA Water Quality Portal');
  if (input.sdwis) dataSources.push('EPA SDWIS (Safe Drinking Water)');
  if (input.icis) dataSources.push('EPA ICIS-NPDES (Permits)');
  if (input.echo) dataSources.push('EPA ECHO (Enforcement)');
  if (input.pfas) dataSources.push('EPA PFAS Analytic Tools');
  if (input.tri) dataSources.push('EPA Toxics Release Inventory');
  if (input.attains) dataSources.push('EPA ATTAINS (Impaired Waters)');
  if (input.ejscreen) dataSources.push('EPA EJScreen');
  if (input.hucIndices) dataSources.push('PEARL HUC-8 Indices');

  return {
    composite: {
      score: composite,
      letter,
      confidence: overallConfidence,
      ...style,
    },
    categories,
    details: { violations, pfasDetections, triFacilities, impairments, observations, implications },
    dataSources,
  };
}
