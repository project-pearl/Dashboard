/**
 * Shared types for the analytics engine.
 *
 * Consumed by trendAnalysis, scenarioModeler, eventPredictor,
 * comprehensiveAssessment, and stateSnapshotCache.
 */

// ── Time Series ──────────────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  date: string;          // ISO date (YYYY-MM-DD)
  value: number;
}

export interface TrendResult {
  direction: 'improving' | 'declining' | 'stable';
  slope: number;         // units per day
  r2: number;            // goodness of fit (0-1)
  projections: ProjectionPoint[];
}

export interface ProjectionPoint {
  date: string;
  value: number;
  confidence: { low: number; high: number };
}

// ── Scenarios ────────────────────────────────────────────────────────────────

export type ScenarioId =
  | 'drought'
  | 'plant-offline'
  | 'new-regulation'
  | 'funding-increase'
  | 'contamination-event'
  | 'population-growth'
  | 'climate-stress';

export interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  description: string;
  perturbations: Perturbation[];
}

export interface Perturbation {
  target: string;            // which metric to modify
  operation: 'multiply' | 'add' | 'set';
  value: number;
}

export interface ScenarioResult {
  scenarioId: ScenarioId;
  label: string;
  baseline: ScenarioSnapshot;
  projected: ScenarioSnapshot;
  delta: ScenarioDelta;
  timeframe: string;
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
}

export interface ScenarioSnapshot {
  riskScore: number;
  riskLevel: 'green' | 'amber' | 'red';
  categoryScores: Record<string, number>;
}

export interface ScenarioDelta {
  riskScoreChange: number;
  worstCategory: string;
  impactSummary: string;
}

// ── Event Predictions ────────────────────────────────────────────────────────

export type PredictedEventType =
  | 'violation-90d'
  | 'impairment-listing'
  | 'enforcement-action'
  | 'exceedance-event'
  | 'advisory-issuance'
  | 'infrastructure-failure';

export interface EventPrediction {
  eventType: PredictedEventType;
  label: string;
  probability: number;       // 0-100
  timeframe: string;
  confidence: 'HIGH' | 'MODERATE' | 'LOW';
  drivers: string[];
  trendContribution: number; // how much trend data affected the score (-20 to +20)
}

// ── Comprehensive Assessment ─────────────────────────────────────────────────

export interface ComprehensiveAssessment {
  stateCode: string;
  generatedAt: string;

  currentRiskScore: number;
  currentRiskLevel: 'green' | 'amber' | 'red';

  trends: {
    riskScore: TrendResult | null;
    impairmentPct: TrendResult | null;
    violationCount: TrendResult | null;
    signalFrequency: TrendResult | null;
  };

  scenarios: ScenarioResult[];
  predictions: EventPrediction[];

  dataCompleteness: number;   // 0-100
  historicalDays: number;
}

// ── Daily Snapshot (what gets stored) ────────────────────────────────────────

export interface DailyStateSnapshot {
  date: string;              // YYYY-MM-DD
  riskScore: number;
  impairmentPct: number;
  violationCount: number;
  signalCount: number;
  highSeveritySignals: number;
  impairedWaterbodies: number;
  totalAssessed: number;
  enforcementActions: number;
  pfasDetections: number;
  aiReadinessScore: number;
  gwTrendFalling: number;
}
