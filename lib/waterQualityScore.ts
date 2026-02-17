// lib/waterQualityScore.ts
// Centralized PEARL Water Quality Scoring Engine
// Single source of truth for grades, monitoring coverage, and thresholds
// Used by: NCC, Dashboard, StateView, Alerts, Reports

// ─── Parameter Thresholds ────────────────────────────────────────────────────
// National defaults — will be overridden by ATTAINS/state-specific criteria later

export type WaterbodyType = 'freshwater' | 'estuarine' | 'coastal' | 'lake';

interface ThresholdRange {
  good: number;       // Value considered healthy
  fair: number;       // Approaching concern
  poor: number;       // Exceeding threshold
  severe: number;     // Severely exceeding (emergency)
  unit: string;
  direction: 'below' | 'above' | 'range'; // 'below' = lower is worse (DO), 'above' = higher is worse (TSS)
  rangeMin?: number;  // For 'range' type (pH)
  rangeMax?: number;
}

// Key parameters for regulatory assessment (the 7 that matter)
export const KEY_PARAMS = ['DO', 'temperature', 'pH', 'turbidity', 'TSS', 'TN', 'TP'] as const;
export type KeyParam = typeof KEY_PARAMS[number];

export const KEY_PARAM_LABELS: Record<string, string> = {
  DO: 'Dissolved Oxygen',
  temperature: 'Temperature',
  pH: 'pH',
  turbidity: 'Turbidity',
  TSS: 'Total Suspended Solids',
  TN: 'Total Nitrogen',
  TP: 'Total Phosphorus',
};

// Supplemental params — nice to have, not required for grading
export const SUPPLEMENTAL_PARAMS = ['bacteria', 'conductivity', 'salinity', 'chlorophyll', 'DO_pct'] as const;

export const SUPPLEMENTAL_PARAM_LABELS: Record<string, string> = {
  bacteria: 'Bacteria',
  conductivity: 'Conductivity',
  salinity: 'Salinity',
  chlorophyll: 'Chlorophyll-a',
  DO_pct: 'DO % Saturation',
};

export const ALL_PARAM_LABELS: Record<string, string> = {
  ...KEY_PARAM_LABELS,
  ...SUPPLEMENTAL_PARAM_LABELS,
};

// National default thresholds by waterbody type
const THRESHOLDS: Record<WaterbodyType, Record<string, ThresholdRange>> = {
  freshwater: {
    DO:          { good: 7.0, fair: 5.0, poor: 4.0, severe: 2.0, unit: 'mg/L', direction: 'below' },
    temperature: { good: 20, fair: 25, poor: 30, severe: 35, unit: '°C', direction: 'above' },
    pH:          { good: 7.0, fair: 6.5, poor: 6.0, severe: 5.5, unit: 'SU', direction: 'range', rangeMin: 6.5, rangeMax: 8.5 },
    turbidity:   { good: 10, fair: 25, poor: 50, severe: 100, unit: 'NTU', direction: 'above' },
    TSS:         { good: 15, fair: 30, poor: 60, severe: 120, unit: 'mg/L', direction: 'above' },
    TN:          { good: 0.5, fair: 1.0, poor: 2.0, severe: 5.0, unit: 'mg/L', direction: 'above' },
    TP:          { good: 0.03, fair: 0.1, poor: 0.2, severe: 0.5, unit: 'mg/L', direction: 'above' },
    bacteria:    { good: 50, fair: 126, poor: 235, severe: 500, unit: 'MPN/100mL', direction: 'above' },
    chlorophyll: { good: 10, fair: 20, poor: 40, severe: 80, unit: 'µg/L', direction: 'above' },
  },
  estuarine: {
    DO:          { good: 6.0, fair: 5.0, poor: 3.5, severe: 2.0, unit: 'mg/L', direction: 'below' },
    temperature: { good: 22, fair: 28, poor: 32, severe: 36, unit: '°C', direction: 'above' },
    pH:          { good: 7.5, fair: 6.5, poor: 6.0, severe: 5.5, unit: 'SU', direction: 'range', rangeMin: 6.5, rangeMax: 8.5 },
    turbidity:   { good: 10, fair: 25, poor: 50, severe: 100, unit: 'NTU', direction: 'above' },
    TSS:         { good: 12, fair: 25, poor: 50, severe: 100, unit: 'mg/L', direction: 'above' },
    TN:          { good: 0.3, fair: 0.7, poor: 1.5, severe: 3.0, unit: 'mg/L', direction: 'above' },
    TP:          { good: 0.02, fair: 0.05, poor: 0.1, severe: 0.3, unit: 'mg/L', direction: 'above' },
    bacteria:    { good: 10, fair: 35, poor: 104, severe: 300, unit: 'MPN/100mL', direction: 'above' },
    chlorophyll: { good: 5, fair: 15, poor: 30, severe: 60, unit: 'µg/L', direction: 'above' },
  },
  coastal: {
    DO:          { good: 6.0, fair: 5.0, poor: 3.5, severe: 2.0, unit: 'mg/L', direction: 'below' },
    temperature: { good: 24, fair: 28, poor: 32, severe: 36, unit: '°C', direction: 'above' },
    pH:          { good: 8.0, fair: 7.5, poor: 7.0, severe: 6.5, unit: 'SU', direction: 'range', rangeMin: 7.0, rangeMax: 8.5 },
    turbidity:   { good: 5, fair: 15, poor: 30, severe: 60, unit: 'NTU', direction: 'above' },
    TSS:         { good: 10, fair: 20, poor: 40, severe: 80, unit: 'mg/L', direction: 'above' },
    TN:          { good: 0.2, fair: 0.5, poor: 1.0, severe: 2.5, unit: 'mg/L', direction: 'above' },
    TP:          { good: 0.01, fair: 0.03, poor: 0.08, severe: 0.2, unit: 'mg/L', direction: 'above' },
    bacteria:    { good: 10, fair: 35, poor: 104, severe: 300, unit: 'MPN/100mL', direction: 'above' },
    chlorophyll: { good: 3, fair: 10, poor: 20, severe: 50, unit: 'µg/L', direction: 'above' },
  },
  lake: {
    DO:          { good: 7.0, fair: 5.0, poor: 4.0, severe: 2.0, unit: 'mg/L', direction: 'below' },
    temperature: { good: 20, fair: 25, poor: 30, severe: 35, unit: '°C', direction: 'above' },
    pH:          { good: 7.5, fair: 6.5, poor: 6.0, severe: 5.5, unit: 'SU', direction: 'range', rangeMin: 6.5, rangeMax: 9.0 },
    turbidity:   { good: 5, fair: 15, poor: 30, severe: 60, unit: 'NTU', direction: 'above' },
    TSS:         { good: 10, fair: 25, poor: 50, severe: 100, unit: 'mg/L', direction: 'above' },
    TN:          { good: 0.3, fair: 0.7, poor: 1.5, severe: 3.0, unit: 'mg/L', direction: 'above' },
    TP:          { good: 0.02, fair: 0.04, poor: 0.1, severe: 0.3, unit: 'mg/L', direction: 'above' },
    bacteria:    { good: 50, fair: 126, poor: 235, severe: 500, unit: 'MPN/100mL', direction: 'above' },
    chlorophyll: { good: 5, fair: 10, poor: 25, severe: 50, unit: 'µg/L', direction: 'above' },
  },
};

export function getThresholds(type: WaterbodyType = 'freshwater') {
  return THRESHOLDS[type];
}

export function getThreshold(param: string, type: WaterbodyType = 'freshwater'): ThresholdRange | null {
  return THRESHOLDS[type]?.[param] ?? THRESHOLDS.freshwater?.[param] ?? null;
}

// ─── Individual Parameter Scoring ────────────────────────────────────────────
// Scores a single reading against its threshold → 0–100

export type ParameterCondition = 'good' | 'fair' | 'poor' | 'severe';

export interface ParameterScore {
  param: string;
  label: string;
  value: number;
  unit: string;
  score: number;           // 0–100
  condition: ParameterCondition;
  threshold: ThresholdRange;
}

export function scoreParameter(
  param: string,
  value: number,
  type: WaterbodyType = 'freshwater'
): ParameterScore | null {
  const threshold = getThreshold(param, type);
  if (!threshold) return null;

  let score: number;
  let condition: ParameterCondition;

  if (threshold.direction === 'range') {
    // pH-style: in-range is good, out-of-range is bad
    const min = threshold.rangeMin ?? threshold.fair;
    const max = threshold.rangeMax ?? threshold.good;
    if (value >= min && value <= max) {
      score = 95;
      condition = 'good';
    } else {
      // How far out of range?
      const distOut = value < min ? min - value : value - max;
      if (distOut < 0.5) { score = 75; condition = 'fair'; }
      else if (distOut < 1.5) { score = 45; condition = 'poor'; }
      else { score = 15; condition = 'severe'; }
    }
  } else if (threshold.direction === 'below') {
    // DO-style: lower is worse
    if (value >= threshold.good) { score = 95; condition = 'good'; }
    else if (value >= threshold.fair) {
      score = 70 + 25 * ((value - threshold.fair) / (threshold.good - threshold.fair));
      condition = 'fair';
    } else if (value >= threshold.poor) {
      score = 40 + 30 * ((value - threshold.poor) / (threshold.fair - threshold.poor));
      condition = 'poor';
    } else if (value >= threshold.severe) {
      score = 10 + 30 * ((value - threshold.severe) / (threshold.poor - threshold.severe));
      condition = 'severe';
    } else {
      score = 5;
      condition = 'severe';
    }
  } else {
    // TSS/TN/TP-style: higher is worse
    if (value <= threshold.good) { score = 95; condition = 'good'; }
    else if (value <= threshold.fair) {
      score = 70 + 25 * ((threshold.fair - value) / (threshold.fair - threshold.good));
      condition = 'fair';
    } else if (value <= threshold.poor) {
      score = 40 + 30 * ((threshold.poor - value) / (threshold.poor - threshold.fair));
      condition = 'poor';
    } else if (value <= threshold.severe) {
      score = 10 + 30 * ((threshold.severe - value) / (threshold.severe - threshold.poor));
      condition = 'severe';
    } else {
      score = 5;
      condition = 'severe';
    }
  }

  return {
    param,
    label: ALL_PARAM_LABELS[param] || param,
    value,
    unit: threshold.unit,
    score: Math.round(Math.max(0, Math.min(100, score))),
    condition,
    threshold,
  };
}

// ─── Monitoring Coverage ─────────────────────────────────────────────────────

export type CoverageLevel = 'comprehensive' | 'adequate' | 'limited' | 'minimal' | 'unmonitored';

export interface MonitoringCoverage {
  level: CoverageLevel;
  label: string;
  icon: string;           // Unicode symbol
  color: string;          // Tailwind text color
  bgColor: string;        // Tailwind bg color
  borderColor: string;    // Tailwind border color
  keyParamsPresent: number;
  keyParamsTotal: number;
  presentParams: string[];
  missingParams: string[];
  missingLabels: string[];
  canBeGraded: boolean;   // true only if ≥3 key params AND <60 days old
  dataAgeMs: number | null;
  dataAgeDays: number | null;
  freshnessLabel: string;
  freshnessConfidence: string;
}

const COVERAGE_STYLES: Record<CoverageLevel, Omit<MonitoringCoverage, 'keyParamsPresent' | 'keyParamsTotal' | 'presentParams' | 'missingParams' | 'missingLabels' | 'canBeGraded' | 'dataAgeMs' | 'dataAgeDays' | 'freshnessLabel' | 'freshnessConfidence'>> = {
  comprehensive: { level: 'comprehensive', label: 'Comprehensive', icon: '●',  color: 'text-green-700',  bgColor: 'bg-green-50',   borderColor: 'border-green-200' },
  adequate:      { level: 'adequate',      label: 'Adequate',      icon: '◐',  color: 'text-blue-700',   bgColor: 'bg-blue-50',    borderColor: 'border-blue-200' },
  limited:       { level: 'limited',       label: 'Limited',       icon: '◔',  color: 'text-yellow-700', bgColor: 'bg-yellow-50',  borderColor: 'border-yellow-200' },
  minimal:       { level: 'minimal',       label: 'Minimal',       icon: '○',  color: 'text-orange-700', bgColor: 'bg-orange-50',  borderColor: 'border-orange-200' },
  unmonitored:   { level: 'unmonitored',   label: 'Unmonitored',   icon: '—',  color: 'text-slate-500',  bgColor: 'bg-slate-50',   borderColor: 'border-slate-200' },
};

function getFreshnessLabel(ageMs: number | null): string {
  if (ageMs === null) return 'Unknown';
  const days = ageMs / (24 * 60 * 60 * 1000);
  if (days < 1) return 'Live';
  if (days < 7) return `${Math.floor(days)}d ago`;
  if (days < 30) return `${Math.floor(days)}d ago`;
  if (days < 90) return `${Math.floor(days)} days old`;
  if (days < 180) return `${Math.floor(days)} days old`;
  return `${Math.floor(days)}+ days old`;
}

function getFreshnessConfidence(ageMs: number | null): string {
  if (ageMs === null) return 'Unknown freshness — data confidence cannot be verified.';
  const days = ageMs / (24 * 60 * 60 * 1000);
  if (days < 1) return 'Live data — high confidence.';
  if (days < 7) return 'Recent data — high confidence.';
  if (days < 30) return 'Data within 30 days — good confidence.';
  if (days < 90) return 'Moderate confidence; recommend re-sampling.';
  if (days < 180) return 'Low confidence — stale data; re-sampling strongly recommended.';
  return 'Very low confidence — data likely outdated; fresh sampling required.';
}

export function assessCoverage(
  presentParamKeys: string[],
  mostRecentTimestamp: string | number | null,
): MonitoringCoverage {
  const keyPresent = KEY_PARAMS.filter(k => presentParamKeys.includes(k));
  const keyMissing = KEY_PARAMS.filter(k => !presentParamKeys.includes(k));
  const count = keyPresent.length;

  // Data age
  let dataAgeMs: number | null = null;
  let dataAgeDays: number | null = null;
  if (mostRecentTimestamp) {
    const ts = typeof mostRecentTimestamp === 'string' ? new Date(mostRecentTimestamp).getTime() : mostRecentTimestamp;
    if (!isNaN(ts)) {
      dataAgeMs = Date.now() - ts;
      dataAgeDays = Math.floor(dataAgeMs / (24 * 60 * 60 * 1000));
    }
  }

  const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;
  const ONE_EIGHTY_DAYS = 180 * 24 * 60 * 60 * 1000;
  const isRecent = dataAgeMs !== null && dataAgeMs < SIXTY_DAYS;
  const isExtendedRecent = dataAgeMs !== null && dataAgeMs < ONE_EIGHTY_DAYS;

  // Determine coverage level — based on param count only
  // Freshness is handled separately in the Freshness tile
  let level: CoverageLevel;
  if (count === 0) {
    level = 'unmonitored';
  } else if (count >= 6) {
    level = 'comprehensive';
  } else if (count >= 4) {
    level = 'adequate';
  } else if (count >= 2) {
    level = 'limited';
  } else {
    level = 'minimal';
  }

  // Can be graded:
  // Tier 1: ≥3 key params AND <60 days old (standard — high confidence)
  // Tier 2: ≥5 key params AND <180 days old (comprehensive monitoring — penalized but gradeable)
  // Rationale: 7/7 params at 95 days should get a penalized grade, not N/A.
  // The freshness penalty already applies heavy deductions for stale data.
  const canBeGraded = (count >= 3 && isRecent) || (count >= 5 && isExtendedRecent);

  const style = COVERAGE_STYLES[level];

  return {
    ...style,
    keyParamsPresent: count,
    keyParamsTotal: KEY_PARAMS.length,
    presentParams: keyPresent as string[],
    missingParams: keyMissing as string[],
    missingLabels: keyMissing.map(k => KEY_PARAM_LABELS[k] || k),
    canBeGraded,
    dataAgeMs,
    dataAgeDays,
    freshnessLabel: getFreshnessLabel(dataAgeMs),
    freshnessConfidence: getFreshnessConfidence(dataAgeMs),
  };
}

// ─── Water Quality Grade ─────────────────────────────────────────────────────

export type GradeLetter = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'F';

export interface WaterQualityGrade {
  canBeGraded: boolean;
  score: number | null;          // 0–100 composite, null if ungraded
  letter: GradeLetter | null;    // null if ungraded
  label: string;                 // 'B+' or 'Ungraded'
  reason: string;                // Why this grade, or why ungraded
  color: string;                 // Tailwind text color
  bgColor: string;               // Tailwind bg color
  borderColor: string;           // Tailwind border color
  parameterScores: ParameterScore[];  // Individual param breakdowns
  coverage: MonitoringCoverage;
  freshnessPenalty: number;      // 0.0–1.0 multiplier applied
}

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

function gradeStyle(letter: GradeLetter | null): { color: string; bgColor: string; borderColor: string } {
  if (!letter) return { color: 'text-slate-500', bgColor: 'bg-slate-100', borderColor: 'border-slate-300' };
  const l = letter.charAt(0);
  switch (l) {
    case 'A': return { color: 'text-green-700',   bgColor: 'bg-green-100',   borderColor: 'border-green-300' };
    case 'B': return { color: 'text-emerald-700',  bgColor: 'bg-emerald-100',  borderColor: 'border-emerald-300' };
    case 'C': return { color: 'text-yellow-700',   bgColor: 'bg-yellow-100',   borderColor: 'border-yellow-300' };
    case 'D': return { color: 'text-orange-700',   bgColor: 'bg-orange-100',   borderColor: 'border-orange-300' };
    case 'F': return { color: 'text-red-700',      bgColor: 'bg-red-100',      borderColor: 'border-red-300' };
    default:  return { color: 'text-slate-500',    bgColor: 'bg-slate-100',    borderColor: 'border-slate-300' };
  }
}

// Freshness penalty: degrades grade for stale data
function freshnessPenalty(dataAgeMs: number | null): number {
  if (dataAgeMs === null) return 0.30;
  const days = dataAgeMs / (24 * 60 * 60 * 1000);
  if (days < 1)   return 1.0;    // Live
  if (days < 7)   return 0.97;   // Very recent
  if (days < 14)  return 0.93;   // Recent
  if (days < 30)  return 0.88;   // Acceptable
  if (days < 45)  return 0.80;   // Getting stale
  if (days < 60)  return 0.72;   // Stale — still standard-gradeable
  if (days < 90)  return 0.60;   // Extended grading — significant penalty
  if (days < 120) return 0.50;   // Extended grading — heavy penalty
  if (days < 150) return 0.42;   // Extended grading — severe penalty
  if (days < 180) return 0.35;   // Extended grading — near-minimum
  return 0.30;                    // Beyond extended range
}

/**
 * Calculate the PEARL Water Quality Grade for a waterbody.
 *
 * @param parameters - Map of param key → { value, lastSampled } from useWaterData
 * @param waterbodyType - freshwater, estuarine, coastal, or lake
 * @returns Full grade breakdown with coverage, freshness, and per-parameter scores
 *
 * Usage:
 *   const grade = calculateGrade(waterData.parameters, 'estuarine');
 *   if (grade.canBeGraded) { show grade.letter }
 *   else { show 'Ungraded' + grade.reason }
 */
export function calculateGrade(
  parameters: Record<string, { value: number; lastSampled?: string | null; unit?: string }> | null | undefined,
  waterbodyType: WaterbodyType = 'freshwater',
): WaterQualityGrade {
  // Gather what we have
  const presentKeys = parameters ? Object.keys(parameters) : [];

  // Find most recent timestamp across all parameters
  let mostRecentTs: number | null = null;
  if (parameters) {
    for (const p of Object.values(parameters)) {
      if (p.lastSampled) {
        const ts = new Date(p.lastSampled).getTime();
        if (!isNaN(ts) && (mostRecentTs === null || ts > mostRecentTs)) {
          mostRecentTs = ts;
        }
      }
    }
  }

  // Assess monitoring coverage
  const coverage = assessCoverage(presentKeys, mostRecentTs);

  // Score each available parameter
  const parameterScores: ParameterScore[] = [];
  if (parameters) {
    for (const [key, data] of Object.entries(parameters)) {
      if (typeof data.value !== 'number' || isNaN(data.value)) continue;
      const ps = scoreParameter(key, data.value, waterbodyType);
      if (ps) parameterScores.push(ps);
    }
  }

  // Can we grade?
  if (!coverage.canBeGraded) {
    let reason: string;
    if (coverage.keyParamsPresent === 0) {
      reason = 'No monitoring data available. This waterbody needs sensor deployment to be assessed.';
    } else if (coverage.keyParamsPresent < 3) {
      reason = `Only ${coverage.keyParamsPresent} of 7 key parameters reporting. At least 3 required for grading.`;
    } else if (coverage.dataAgeDays !== null && coverage.keyParamsPresent >= 5 && coverage.dataAgeDays >= 180) {
      reason = `Data is ${coverage.dataAgeDays} days old. Comprehensive monitoring (5+ params) requires data within 180 days for grading.`;
    } else if (coverage.dataAgeDays !== null && coverage.keyParamsPresent < 5 && coverage.dataAgeDays >= 60) {
      reason = `Data is ${coverage.dataAgeDays} days old. With ${coverage.keyParamsPresent} parameters, readings must be within 60 days. Add more sensors (5+) to extend grading window to 180 days.`;
    } else {
      reason = 'Insufficient data for reliable water quality assessment.';
    }

    return {
      canBeGraded: false,
      score: null,
      letter: null,
      label: 'Ungraded',
      reason,
      ...gradeStyle(null),
      parameterScores,
      coverage,
      freshnessPenalty: 0,
    };
  }

  // Calculate composite WQ score from key params only
  const keyScores = parameterScores.filter(ps => (KEY_PARAMS as readonly string[]).includes(ps.param));
  const rawWqScore = keyScores.length > 0
    ? keyScores.reduce((sum, ps) => sum + ps.score, 0) / keyScores.length
    : 50;

  // Apply freshness penalty
  const fp = freshnessPenalty(coverage.dataAgeMs);
  const finalScore = Math.round(rawWqScore * fp);
  const letter = scoreToLetter(finalScore);

  // Build reason
  const conditions = parameterScores.filter(ps => ps.condition === 'severe' || ps.condition === 'poor');
  let reason: string;
  if (conditions.length === 0) {
    reason = 'All monitored parameters within acceptable ranges.';
  } else {
    const labels = conditions.map(c => c.label).slice(0, 3);
    reason = `${labels.join(', ')} ${conditions.length === 1 ? 'is' : 'are'} outside acceptable ranges.`;
  }
  if (fp < 0.9) {
    reason += ` Score reduced ${Math.round((1 - fp) * 100)}% due to data staleness (${coverage.dataAgeDays}d old).`;
  }

  return {
    canBeGraded: true,
    score: finalScore,
    letter,
    label: letter,
    reason,
    ...gradeStyle(letter),
    parameterScores,
    coverage,
    freshnessPenalty: fp,
  };
}

// ─── Alert Level (for NCC map coloring) ──────────────────────────────────────
// Derives alert level from grade — used by NCC generateRegionData

export type AlertLevel = 'none' | 'low' | 'medium' | 'high';

export function gradeToAlertLevel(grade: WaterQualityGrade): AlertLevel {
  if (!grade.canBeGraded) return 'none';  // Ungraded = no alert, not "healthy"
  if (grade.score === null) return 'none';
  if (grade.score >= 80) return 'none';    // A/B range = healthy
  if (grade.score >= 70) return 'low';     // C range = watch
  if (grade.score >= 60) return 'medium';  // D range = impaired
  return 'high';                           // F = severe
}

// ─── Observation/Implication Generators ──────────────────────────────────────
// Standardized observations used across NCC, Dashboard, Reports

export interface Observation {
  icon: string;
  text: string;
  severity: 'info' | 'warning' | 'critical';
}

export function generateObservations(grade: WaterQualityGrade): Observation[] {
  const obs: Observation[] = [];
  const { coverage, parameterScores, canBeGraded, score } = grade;

  // 1. Alert summary — with specific values and targets
  if (canBeGraded && score !== null) {
    const severeParams = parameterScores.filter(p => p.condition === 'severe');
    const poorParams = parameterScores.filter(p => p.condition === 'poor');
    const goodParams = parameterScores.filter(p => p.condition === 'good' || p.condition === 'fair');
    const alertCount = severeParams.length + poorParams.length;

    if (alertCount === 0) {
      obs.push({ icon: '✅', text: 'All monitored parameters within acceptable ranges.', severity: 'info' });
    } else if (severeParams.length > 0) {
      // Build specific exceedance descriptions
      const exceedances = severeParams.map(p => {
        const dir = p.threshold.direction;
        const target = dir === 'below' ? `≥${p.threshold.fair}` :
                       dir === 'range' ? `${p.threshold.rangeMin}–${p.threshold.rangeMax}` :
                       `<${p.threshold.fair}`;
        const risk = p.param === 'bacteria' ? 'recreation/contact risk' :
                     p.param === 'DO' ? 'aquatic life risk' :
                     p.param === 'TN' || p.param === 'TP' ? 'eutrophication risk' :
                     p.param === 'TSS' ? 'sediment/habitat risk' :
                     'threshold exceeded';
        return `${p.label} exceedance detected (${p.value} ${p.unit} vs ${target} ${p.unit} target) — ${risk}`;
      });
      obs.push({ icon: '🔴', text: `${alertCount} active alert${alertCount !== 1 ? 's' : ''} — ${exceedances.join('; ')}.`, severity: 'critical' });
    } else {
      const nearThreshold = poorParams.map(p => p.label).slice(0, 3);
      obs.push({ icon: '🟡', text: `${alertCount} minor alert${alertCount !== 1 ? 's' : ''} — ${nearThreshold.join(', ')} approaching advisory thresholds.`, severity: 'warning' });
    }

    // Positive observation: note params that ARE meeting targets
    if (alertCount > 0 && goodParams.length > 0) {
      const goodLabels = goodParams.map(p => p.label).slice(0, 4);
      obs.push({ icon: '✅', text: `${goodLabels.join(', ')} currently meet${goodParams.length === 1 ? 's' : ''} targets — potential for improvement with targeted source control.`, severity: 'info' });
    }
  }

  // 2. Data freshness with confidence language
  if (coverage.dataAgeDays !== null && coverage.dataAgeDays > 30) {
    obs.push({
      icon: '⏰',
      text: `Data is ${coverage.dataAgeDays} days old. ${coverage.freshnessConfidence}`,
      severity: coverage.dataAgeDays > 90 ? 'critical' : 'warning',
    });
  }

  // 3. Missing parameters
  if (coverage.keyParamsPresent === 0) {
    obs.push({ icon: '🚫', text: 'No live sensor data available. Assessment relies on reference data and state reports only.', severity: 'critical' });
  } else if (coverage.missingParams.length > 0 && coverage.missingParams.length <= 4) {
    obs.push({
      icon: '⚠️',
      text: `Missing ${coverage.missingParams.length} key parameter${coverage.missingParams.length !== 1 ? 's' : ''}: ${coverage.missingLabels.join(', ')}. Incomplete data limits full water quality assessment.`,
      severity: 'warning',
    });
  } else if (coverage.missingParams.length > 4) {
    obs.push({
      icon: '🚫',
      text: `Only ${coverage.keyParamsPresent} of ${coverage.keyParamsTotal} key parameters monitored. Missing: ${coverage.missingLabels.join(', ')}.`,
      severity: 'critical',
    });
  }

  return obs;
}

export function generateImplications(grade: WaterQualityGrade): Observation[] {
  const imp: Observation[] = [];
  const { coverage, parameterScores, canBeGraded, score } = grade;

  // Grade-based implications
  if (canBeGraded && score !== null) {
    if (score < 60) {
      imp.push({ icon: '⚡', text: 'Severe ratings typically indicate persistent pollutant loading, nutrient exceedances, or dissolved oxygen depletion. Federal oversight or TMDL development may be warranted.', severity: 'critical' });
    } else if (score < 70) {
      imp.push({ icon: '📋', text: 'Impaired conditions may trigger 303(d) listing and require development of a Total Maximum Daily Load (TMDL).', severity: 'warning' });
    } else if (score < 80) {
      imp.push({ icon: '📋', text: 'Watch-level conditions may reflect seasonal variations, localized stormwater impacts, or emerging trends requiring monitoring.', severity: 'info' });
    }
  }

  // Freshness implications
  if (coverage.dataAgeDays !== null && coverage.dataAgeDays > 30) {
    imp.push({
      icon: '📡',
      text: `Stale data limits regulatory confidence. Recommend requesting updated sampling or deploying continuous monitoring.`,
      severity: coverage.dataAgeDays > 60 ? 'critical' : 'warning',
    });
  }

  // Coverage implications
  if (coverage.keyParamsPresent === 0) {
    imp.push({ icon: '📡', text: 'Without real-time monitoring, exceedance events and trends go undetected. This waterbody is a candidate for PEARL continuous monitoring deployment.', severity: 'critical' });
  } else if (!canBeGraded && coverage.keyParamsPresent > 0) {
    imp.push({ icon: '📡', text: 'Significant monitoring gaps. This waterbody cannot be fully assessed for CWA compliance without additional parameter coverage.', severity: 'warning' });
  }

  // Nutrient-specific implications
  const missingNutrients = coverage.missingParams.filter(k => k === 'TN' || k === 'TP');
  if (missingNutrients.length > 0) {
    imp.push({ icon: '🔬', text: 'Nutrient data gap is critical for impairment determination. Without it, 303(d) listing decisions rely on incomplete evidence.', severity: 'warning' });
  }

  return imp;
}
