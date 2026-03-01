// ─── Scenario Planner Core Types ─────────────────────────────────────────────

export type ScenarioCategory = 'infrastructure' | 'natural-event' | 'contamination' | 'regulatory';

export type ScenarioEventType =
  // Infrastructure
  | 'water-main-break'
  | 'sso-overflow'
  // Natural Events
  | 'hurricane-storm-surge'
  | 'drought'
  // Contamination
  | 'pfas-detection'
  | 'chemical-spill'
  // Regulatory
  | 'new-tmdl'
  | 'permit-limit-tightening';

export type CostTier = 'direct' | 'regulatory' | 'economic' | 'timeline';

export type ScenarioPlannerRole =
  | 'ms4-manager'
  | 'utility-director'
  | 'city-manager'
  | 'state-regulator'
  | 'insurer'
  | 'consultant';

export interface CostLineItem {
  label: string;
  lowEstimate: number;
  highEstimate: number;
  unit: string;
  notes?: string;
}

export interface CostTierOutput {
  tier: CostTier;
  label: string;
  items: CostLineItem[];
  totalLow: number;
  totalHigh: number;
}

export interface TimelinePhase {
  phase: string;
  duration: string;
  description: string;
}

export type ScenarioParameterType = 'select' | 'range';

export interface ScenarioParameter {
  id: string;
  label: string;
  type: ScenarioParameterType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  default: string | number;
}

export interface ScenarioDefinition {
  id: ScenarioEventType;
  label: string;
  category: ScenarioCategory;
  icon: string;
  description: string;
  parameters: ScenarioParameter[];
  applicableRoles: ScenarioPlannerRole[];
}

export interface ScenarioResult {
  scenario: ScenarioDefinition;
  role: ScenarioPlannerRole;
  state: string;
  costTiers: CostTierOutput[];
  totalCostLow: number;
  totalCostHigh: number;
  expectedLoss: {
    probability: number;
    totalCost: number;
    expectedValue: number;
  } | null;
  scoreImpact: {
    before: number;
    after: number;
    delta: number;
  } | null;
  timeline: TimelinePhase[];
  summary: string;
  disclaimer: string;
}
