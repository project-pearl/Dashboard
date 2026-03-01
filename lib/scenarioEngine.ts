// ─── What-If Scenario Engine — Pure in-memory data transforms ────────────────
// No cache reads, no blob writes, no API calls. Pure functions only.

import type { ScenarioEvent, BaselineStateRow } from './scenarioCatalog';
import { scoreToGrade } from './scoringUtils';

export interface SimulatedState {
  abbr: string;
  name: string;
  score: number;
  grade: { letter: string; color: string; bg: string };
  high: number;
  medium: number;
  low: number;
  none: number;
  cat5: number;
  cat4a: number;
  cat4b: number;
  cat4c: number;
  totalImpaired: number;
  waterbodies: number;
  assessed: number;
  monitored: number;
  unmonitored: number;
  topCauses: { cause: string; count: number }[];
  scenarioApplied: boolean;
}

export interface NationalSummary {
  totalImpaired: number;
  averageScore: number;
  highAlertStates: number;
  totalWaterbodies: number;
  totalCat5: number;
  worstStates: { abbr: string; score: number; impaired: number }[];
  topCauses: { cause: string; count: number }[];
}

function applyModification(
  currentValue: number,
  mod: { operation: 'multiply' | 'add' | 'set'; value: number }
): number {
  switch (mod.operation) {
    case 'multiply': return currentValue * mod.value;
    case 'add':      return currentValue + mod.value;
    case 'set':      return mod.value;
  }
}

/** Deep-clone baseline, apply scenario modifications, re-grade affected states. */
export function applyScenarios(
  baseline: BaselineStateRow[],
  selectedScenarios: ScenarioEvent[]
): SimulatedState[] {
  // Deep clone
  const cloned: SimulatedState[] = baseline.map(s => ({
    ...s,
    topCauses: s.topCauses.map(c => ({ ...c })),
    grade: scoreToGrade(s.score),
    scenarioApplied: false,
  }));

  for (const scenario of selectedScenarios) {
    const isNationwide = scenario.affectedStates.length === 0;

    for (const state of cloned) {
      if (!isNationwide && !scenario.affectedStates.includes(state.abbr)) continue;

      state.scenarioApplied = true;

      for (const mod of scenario.modifications) {
        const field = mod.target;
        if (field in state && typeof (state as any)[field] === 'number') {
          (state as any)[field] = applyModification((state as any)[field], mod);
        }
      }
    }
  }

  // Clamp and re-grade
  for (const state of cloned) {
    state.score = Math.max(0, Math.min(100, Math.round(state.score)));
    state.high = Math.max(0, Math.round(state.high));
    state.medium = Math.max(0, Math.round(state.medium));
    state.cat5 = Math.max(0, Math.round(state.cat5));
    state.totalImpaired = Math.max(0, Math.round(state.totalImpaired));
    state.monitored = Math.max(0, Math.round(state.monitored));
    state.grade = scoreToGrade(state.score);
  }

  return cloned;
}

/** Aggregate simulated state data into national summary. */
export function buildSimulatedNational(states: SimulatedState[]): NationalSummary {
  const totalImpaired = states.reduce((s, st) => s + st.totalImpaired, 0);
  const totalWaterbodies = states.reduce((s, st) => s + st.waterbodies, 0);
  const totalCat5 = states.reduce((s, st) => s + st.cat5, 0);
  const averageScore = Math.round(states.reduce((s, st) => s + st.score, 0) / states.length);
  const highAlertStates = states.filter(st => st.score < 40).length;

  // Aggregate top causes
  const causeMap = new Map<string, number>();
  for (const st of states) {
    for (const c of st.topCauses) {
      causeMap.set(c.cause, (causeMap.get(c.cause) || 0) + c.count);
    }
  }
  const topCauses = Array.from(causeMap.entries())
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const worstStates = [...states]
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .map(st => ({ abbr: st.abbr, score: st.score, impaired: st.totalImpaired }));

  return { totalImpaired, averageScore, highAlertStates, totalWaterbodies, totalCat5, worstStates, topCauses };
}
