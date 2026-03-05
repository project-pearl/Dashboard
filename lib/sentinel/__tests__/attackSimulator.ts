/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Simulated Attack Data Generator                    */
/*  Generates ChangeEvents for testing the detection pipeline.        */
/* ------------------------------------------------------------------ */

import type { ChangeEvent, ChangeSource, SeverityHint } from '../types';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface SimulatedEvent extends ChangeEvent {
  _simulated: true;
}

export interface AttackScenario {
  name: string;
  description: string;
  /** HUC-8 basins to place events in */
  huc8s: string[];
  /** State abbreviations for the HUCs */
  states: string[];
  /** Parameters to spike (USGS parameter codes) */
  paramCds: string[];
  /** Time window for the attack (ms) */
  windowMs: number;
  /** Jitter range for event timing (ms) */
  jitterMs: number;
  /** How many standard deviations above baseline */
  deviationMultiplier: number;
  /** Source type for events */
  source: ChangeSource;
  /** Expected classification result */
  expectedClassification: string;
  /** Expected coordination score range */
  expectedCoordinationScore: [number, number];
  /** Optional: NWSS anomaly data for bio-threat scenarios */
  nwssAnomaly?: {
    sewershedId: string;
    pathogen: string;
    sigma: number;
    concentration: number;
    countyFips: string;
  };
  /** Optional: confounders to inject (weather, rainfall, etc.) */
  confounders?: { source: ChangeSource; huc8s: string[]; value: number }[];
}

/* ------------------------------------------------------------------ */
/*  Generator                                                         */
/* ------------------------------------------------------------------ */

export function generateAttackSequence(scenario: AttackScenario): SimulatedEvent[] {
  const events: SimulatedEvent[] = [];
  const now = Date.now();
  const baseTime = now - scenario.windowMs;

  for (let i = 0; i < scenario.huc8s.length; i++) {
    const huc8 = scenario.huc8s[i];
    const state = scenario.states[i] || scenario.states[0];

    for (const paramCd of scenario.paramCds) {
      // Stagger events across the window with jitter
      const staggerOffset = (scenario.windowMs / scenario.huc8s.length) * i;
      const jitter = (Math.random() - 0.5) * 2 * scenario.jitterMs;
      const eventTime = baseTime + staggerOffset + jitter;

      // Generate a plausible deviation value
      const baseValue = getBaselineValue(paramCd);
      const deviatedValue = baseValue * (1 + scenario.deviationMultiplier);

      const severity: SeverityHint = scenario.deviationMultiplier >= 3
        ? 'CRITICAL'
        : scenario.deviationMultiplier >= 2
          ? 'HIGH'
          : scenario.deviationMultiplier >= 1
            ? 'MODERATE'
            : 'LOW';

      events.push({
        _simulated: true,
        eventId: `sim-${scenario.name}-${huc8}-${paramCd}-${Date.now().toString(36)}-${i}`,
        source: scenario.source,
        detectedAt: new Date(eventTime).toISOString(),
        sourceTimestamp: new Date(eventTime).toISOString(),
        changeType: 'THRESHOLD_CROSSED',
        geography: {
          huc8,
          huc6: huc8.slice(0, 6),
          stateAbbr: state,
        },
        severityHint: severity,
        payload: {
          parameterCd: paramCd,
          parameterName: getParamName(paramCd),
          value: deviatedValue,
          baselineValue: baseValue,
          deviationMultiplier: scenario.deviationMultiplier,
          simulated: true,
        },
        metadata: {
          sourceRecordId: `sim-${huc8}-${paramCd}`,
          previousValue: baseValue,
          currentValue: deviatedValue,
          threshold: baseValue * 1.5,
        },
      });
    }
  }

  // Sort by time
  events.sort((a, b) =>
    new Date(a.detectedAt).getTime() - new Date(b.detectedAt).getTime()
  );

  return events;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getBaselineValue(paramCd: string): number {
  const baselines: Record<string, number> = {
    '00300': 8.0,    // DO (mg/L)
    '00400': 7.5,    // pH
    '00010': 20,     // temperature (°C)
    '63680': 10,     // turbidity (NTU)
    '00095': 500,    // conductivity (µS/cm)
    '00065': 3,      // gage height (ft)
  };
  return baselines[paramCd] ?? 10;
}

function getParamName(paramCd: string): string {
  const names: Record<string, string> = {
    '00300': 'Dissolved Oxygen',
    '00400': 'pH',
    '00010': 'Water Temperature',
    '63680': 'Turbidity',
    '00095': 'Specific Conductance',
    '00065': 'Gage Height',
  };
  return names[paramCd] ?? `Parameter ${paramCd}`;
}
