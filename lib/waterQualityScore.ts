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

// ─── Per-Parameter Freshness Classification ──────────────────────────────────
// Parameters sampled within 180 days are "live" (suitable for grading);
// older or missing timestamps are "reference" (display only, excluded from composite).

const LIVE_THRESHOLD_MS = 180 * 24 * 60 * 60 * 1000;

function classifyParamFreshness(lastSampled: string | null | undefined): 'live' | 'reference' {
  if (!lastSampled) return 'reference';
  const ts = new Date(lastSampled).getTime();
  if (isNaN(ts)) return 'reference';
  return (Date.now() - ts) < LIVE_THRESHOLD_MS ? 'live' : 'reference';
}

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
  canBeGraded: boolean;   // true only if ≥2 live key params
  dataAgeMs: number | null;
  dataAgeDays: number | null;
  freshnessLabel: string;
  freshnessConfidence: string;
  liveKeyParamCount: number;
  referenceKeyParamCount: number;
  liveKeyParams: string[];
  referenceKeyParams: string[];
  oldestLiveAgeDays: number | null;
  oldestLiveAgeMs: number | null;
  freshnessSummary: string;  // e.g. "2 of 7 live · 5 reference"
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
  paramTimestamps: Record<string, string | null>,
): MonitoringCoverage {
  const keyPresent = KEY_PARAMS.filter(k => presentParamKeys.includes(k));
  const keyMissing = KEY_PARAMS.filter(k => !presentParamKeys.includes(k));
  const count = keyPresent.length;

  // Classify each key param as live or reference
  const liveKeyParams: string[] = [];
  const referenceKeyParams: string[] = [];
  for (const k of keyPresent) {
    if (classifyParamFreshness(paramTimestamps[k]) === 'live') {
      liveKeyParams.push(k as string);
    } else {
      referenceKeyParams.push(k as string);
    }
  }

  // Oldest live param age (conservative — worst-case among live params)
  let oldestLiveAgeMs: number | null = null;
  for (const k of liveKeyParams) {
    const ts = paramTimestamps[k] ? new Date(paramTimestamps[k]!).getTime() : NaN;
    if (!isNaN(ts)) {
      const age = Date.now() - ts;
      if (oldestLiveAgeMs === null || age > oldestLiveAgeMs) {
        oldestLiveAgeMs = age;
      }
    }
  }
  const oldestLiveAgeDays = oldestLiveAgeMs !== null ? Math.floor(oldestLiveAgeMs / (24 * 60 * 60 * 1000)) : null;

  // Weighted average data age across ALL key params (not just live).
  // Params with no timestamp count as 999 days. This prevents 2 live readings
  // from masking 5 stale reference params.
  const DEFAULT_AGE_MS = 999 * 24 * 60 * 60 * 1000;
  let ageSum = 0;
  for (const k of keyPresent) {
    const raw = paramTimestamps[k as string];
    if (raw) {
      const ts = new Date(raw).getTime();
      ageSum += isNaN(ts) ? DEFAULT_AGE_MS : (Date.now() - ts);
    } else {
      ageSum += DEFAULT_AGE_MS;
    }
  }
  const dataAgeMs = count > 0 ? ageSum / count : null;
  const dataAgeDays = dataAgeMs !== null ? Math.floor(dataAgeMs / (24 * 60 * 60 * 1000)) : null;

  // Determine coverage level — based on total param count
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

  // Can be graded: ≥2 live key params
  // Live classification already enforces the 180-day window
  const canBeGraded = liveKeyParams.length >= 2;

  // Build freshness summary
  const freshnessSummary = liveKeyParams.length === 0
    ? `${count} reference only`
    : `${liveKeyParams.length} of ${count} live · ${referenceKeyParams.length} reference`;

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
    liveKeyParamCount: liveKeyParams.length,
    referenceKeyParamCount: referenceKeyParams.length,
    liveKeyParams,
    referenceKeyParams,
    oldestLiveAgeDays,
    oldestLiveAgeMs,
    freshnessSummary,
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
  avgFreshnessWeight: number;    // Average per-param freshness weight (0–1)
  regulatoryPenalty: number;     // Total regulatory deduction (points subtracted)
  gradedParamCount: number;      // Number of key params used in composite
  gradedParamTotal: number;      // Total key params present
  isPartialGrade: boolean;       // true when some key params excluded as reference
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

// ─── Per-Parameter Freshness Weighting ────────────────────────────────────────
// Each parameter's contribution to the composite gets scaled by how fresh its data is.
// This replaces the old global freshness multiplier with per-param confidence weights.

function paramFreshnessWeight(lastSampled: string | null | undefined): number {
  if (!lastSampled) return 0.25;
  const ts = new Date(lastSampled).getTime();
  if (isNaN(ts)) return 0.25;
  const days = (Date.now() - ts) / (24 * 60 * 60 * 1000);
  if (days < 1)   return 1.0;   // Live
  if (days < 7)   return 0.95;  // Recent
  if (days < 60)  return 0.85;  // Aging
  if (days < 180) return 0.70;  // Stale
  if (days < 365) return 0.50;  // Old
  return 0.30;                   // Very old (>1yr)
}

// ─── Regulatory Context & Penalties ──────────────────────────────────────────
// Point deductions for ATTAINS impairment status and parameter exceedances.
// These are subtracted from the composite score, not multiplied.

export interface RegulatoryContext {
  attainsCategory?: string;       // "5", "4a", "3", etc.
  is303dListed?: boolean;
  hasTmdl?: boolean;              // false = TMDL needed but not established
  impairmentCauseCount?: number;  // number of ATTAINS impairment causes
}

function regulatoryDeduction(
  ctx: RegulatoryContext | undefined,
  parameterScores: ParameterScore[],
): { totalDeduction: number; details: string[] } {
  if (!ctx) return { totalDeduction: 0, details: [] };

  let totalDeduction = 0;
  const details: string[] = [];

  // 1. ATTAINS category penalty
  const cat = ctx.attainsCategory || '';
  if (cat.includes('5') && ctx.hasTmdl === false) {
    totalDeduction += 15;
    details.push('Cat 5 no TMDL (−15)');
  } else if (cat.includes('5')) {
    totalDeduction += 8;
    details.push('Cat 5 (−8)');
  } else if (cat.includes('4a')) {
    totalDeduction += 5;
    details.push('Cat 4a TMDL (−5)');
  } else if (cat.includes('4')) {
    totalDeduction += 3;
    details.push('Cat 4 (−3)');
  } else if (ctx.is303dListed && !cat) {
    // 303(d) listed but no ATTAINS category data
    totalDeduction += 10;
    details.push('303(d) listed (−10)');
  }

  // 2. Exceedance severity amplifier — per failing key param
  for (const ps of parameterScores) {
    if (!(KEY_PARAMS as readonly string[]).includes(ps.param)) continue;
    if (ps.condition === 'severe') {
      totalDeduction += 5;
      details.push(`${ps.label} severe (−5)`);
    } else if (ps.condition === 'poor') {
      totalDeduction += 3;
      details.push(`${ps.label} poor (−3)`);
    }
  }

  return { totalDeduction, details };
}

/**
 * Calculate the PEARL Water Quality Grade for a waterbody.
 *
 * Scoring pipeline:
 *   1. Score each parameter against thresholds (0–100)
 *   2. Weight each key param's score by its freshness confidence
 *   3. Composite = sum(score × weight) / keyParamCount
 *   4. Subtract regulatory deductions (ATTAINS Cat 5, exceedances)
 *   5. Clamp to 0–100
 *
 * @param parameters - Map of param key → { value, lastSampled } from useWaterData
 * @param waterbodyType - freshwater, estuarine, coastal, or lake
 * @param regulatoryContext - Optional ATTAINS/303(d) context for regulatory penalties
 * @returns Full grade breakdown with coverage, freshness, and per-parameter scores
 *
 * Usage:
 *   const grade = calculateGrade(waterData.parameters, 'estuarine', {
 *     attainsCategory: '5', is303dListed: true, hasTmdl: false,
 *   });
 */
export function calculateGrade(
  parameters: Record<string, { value: number; lastSampled?: string | null; unit?: string }> | null | undefined,
  waterbodyType: WaterbodyType = 'freshwater',
  regulatoryContext?: RegulatoryContext,
): WaterQualityGrade {
  // Gather what we have
  const presentKeys = parameters ? Object.keys(parameters) : [];

  // Build per-param timestamp map
  const paramTimestamps: Record<string, string | null> = {};
  if (parameters) {
    for (const [key, p] of Object.entries(parameters)) {
      paramTimestamps[key] = p.lastSampled ?? null;
    }
  }

  // Assess monitoring coverage (per-param freshness aware)
  const coverage = assessCoverage(presentKeys, paramTimestamps);

  // Score each available parameter (all params, for display)
  const parameterScores: ParameterScore[] = [];
  if (parameters) {
    for (const [key, data] of Object.entries(parameters)) {
      if (typeof data.value !== 'number' || isNaN(data.value)) continue;
      const ps = scoreParameter(key, data.value, waterbodyType);
      if (ps) parameterScores.push(ps);
    }
  }

  // Can we grade? Require ≥2 live key params
  if (!coverage.canBeGraded) {
    let reason: string;
    if (coverage.keyParamsPresent === 0) {
      reason = 'No monitoring data available. This waterbody needs sensor deployment to be assessed.';
    } else if (coverage.liveKeyParamCount === 0) {
      reason = 'All parameters are reference data (>180 days old). Live sensor readings required for grading.';
    } else if (coverage.liveKeyParamCount === 1) {
      reason = `Only 1 live parameter (${coverage.liveKeyParams[0]}). At least 2 live parameters required for grading.`;
    } else {
      reason = 'Insufficient live data for reliable water quality assessment.';
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
      avgFreshnessWeight: 0,
      regulatoryPenalty: 0,
      gradedParamCount: 0,
      gradedParamTotal: coverage.keyParamsPresent,
      isPartialGrade: false,
    };
  }

  // ── Per-param freshness-weighted composite ──
  // Each key param's score is scaled by its freshness weight, then divided by
  // the number of key params present. Stale data naturally degrades the composite.
  const keyScores = parameterScores.filter(
    ps => (KEY_PARAMS as readonly string[]).includes(ps.param)
  );
  let weightedSum = 0;
  let totalWeight = 0;
  const gradedParamCount = keyScores.length;

  for (const ps of keyScores) {
    const w = paramFreshnessWeight(paramTimestamps[ps.param]);
    weightedSum += ps.score * w;
    totalWeight += w;
  }

  const rawWqScore = gradedParamCount > 0
    ? weightedSum / gradedParamCount
    : 50;
  const avgWeight = gradedParamCount > 0
    ? totalWeight / gradedParamCount
    : 0;

  // ── Regulatory penalties ──
  const { totalDeduction, details: regDetails } = regulatoryDeduction(regulatoryContext, parameterScores);

  // Final score: freshness-weighted composite minus regulatory deductions, clamped 0–100
  const finalScore = Math.round(Math.max(0, Math.min(100, rawWqScore - totalDeduction)));
  const letter = scoreToLetter(finalScore);

  const gradedParamTotal = coverage.keyParamsPresent;
  const isPartialGrade = coverage.referenceKeyParamCount > 0;

  // Build reason
  const failingParams = keyScores.filter(ps => ps.condition === 'severe' || ps.condition === 'poor');
  let reason: string;
  if (failingParams.length === 0) {
    reason = 'All monitored parameters within acceptable ranges.';
  } else {
    const labels = failingParams.map(c => c.label).slice(0, 3);
    reason = `${labels.join(', ')} ${failingParams.length === 1 ? 'is' : 'are'} outside acceptable ranges.`;
  }
  if (avgWeight < 0.9) {
    reason += ` Data confidence reduced (avg weight ${(avgWeight * 100).toFixed(0)}%).`;
  }
  if (totalDeduction > 0) {
    reason += ` Score reduced ${totalDeduction}pts for ${regDetails.join(', ')}.`;
  }
  if (isPartialGrade) {
    reason += ` Partial — ${coverage.liveKeyParamCount} of ${gradedParamTotal} parameters live.`;
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
    avgFreshnessWeight: avgWeight,
    regulatoryPenalty: totalDeduction,
    gradedParamCount,
    gradedParamTotal,
    isPartialGrade,
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

  // 2. Live/reference data breakdown
  if (coverage.liveKeyParamCount > 0 && coverage.referenceKeyParamCount > 0) {
    obs.push({
      icon: '📡',
      text: `${coverage.liveKeyParamCount} of ${coverage.keyParamsPresent} live · ${coverage.referenceKeyParamCount} reference. Grade based on ${coverage.liveKeyParamCount} live parameter${coverage.liveKeyParamCount !== 1 ? 's' : ''}. ${coverage.referenceKeyParamCount} reference excluded.`,
      severity: 'info',
    });
  } else if (coverage.liveKeyParamCount === 0 && coverage.keyParamsPresent > 0) {
    obs.push({
      icon: '⏰',
      text: `All ${coverage.keyParamsPresent} parameters are reference data (>180 days old). No live readings available for grading.`,
      severity: 'critical',
    });
  } else if (coverage.dataAgeDays !== null && coverage.dataAgeDays > 30) {
    obs.push({
      icon: '⏰',
      text: `Average data age is ${coverage.dataAgeDays} days. ${coverage.freshnessConfidence}`,
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
