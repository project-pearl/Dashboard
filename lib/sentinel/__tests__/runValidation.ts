/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Validation Runner                                  */
/*  Orchestrates attack scenarios through the full pipeline and       */
/*  produces a ScoreReport with precision/recall/F1.                  */
/* ------------------------------------------------------------------ */

import fs from 'fs';
import pathMod from 'path';
import type { ChangeEvent, ScoredHuc, AttackClassification } from '../types';
import { ALL_SCENARIOS } from './scenarios';
import { generateAttackSequence } from './attackSimulator';
import type { AttackScenario } from './attackSimulator';
import { _resetQueue, _enqueueWithoutDedup, getAllEvents } from '../eventQueue';
import { scoreAllHucs, _resetScoring } from '../scoringEngine';
import { detectCoordination } from '../coordinationEngine';
import { classifyEvent, gatherConfounders } from '../classificationEngine';
import { DISK_PATHS } from '../config';
import { scoreScenario, aggregateScores } from './scorer';
import type { ScenarioResult, ScenarioScore, ScoreReport } from './scorer';

/* ------------------------------------------------------------------ */
/*  Runner                                                            */
/* ------------------------------------------------------------------ */

export async function runValidation(
  scenarioNames?: string[],
): Promise<ScoreReport> {
  // Suppress blob writes during validation — we don't want to clobber prod data
  const origToken = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
  process.env.VERCEL_BLOB_READ_WRITE_TOKEN = '';

  const scenarios = scenarioNames
    ? scenarioNames.map(n => {
        const s = ALL_SCENARIOS[n];
        if (!s) throw new Error(`Unknown scenario: "${n}". Available: ${Object.keys(ALL_SCENARIOS).join(', ')}`);
        return s;
      })
    : Object.values(ALL_SCENARIOS);

  const scores: ScenarioScore[] = [];

  try {
    for (const scenario of scenarios) {
      const score = await runSingleScenario(scenario);
      scores.push(score);
    }
  } finally {
    // Restore token
    if (origToken !== undefined) {
      process.env.VERCEL_BLOB_READ_WRITE_TOKEN = origToken;
    } else {
      delete process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    scenarios: scores,
    aggregate: aggregateScores(scores),
  };
}

/* ------------------------------------------------------------------ */
/*  Disk Isolation                                                    */
/*  _resetQueue() sets _diskLoaded = false, so the next ensureQueue() */
/*  re-reads stale events from disk. We write empty state to disk     */
/*  after each reset to prevent cross-scenario leakage.               */
/* ------------------------------------------------------------------ */

function cleanDiskState(): void {
  const cacheDir = pathMod.resolve(process.cwd(), '.cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const queuePath = pathMod.resolve(process.cwd(), DISK_PATHS.eventQueue);
  fs.writeFileSync(queuePath, JSON.stringify({ events: [], hucIndex: {} }));

  const scoredPath = pathMod.resolve(process.cwd(), DISK_PATHS.scoredHucs);
  fs.writeFileSync(scoredPath, JSON.stringify([]));

  const resolvedPath = pathMod.resolve(process.cwd(), DISK_PATHS.resolvedHucs);
  fs.writeFileSync(resolvedPath, JSON.stringify([]));
}

/* ------------------------------------------------------------------ */
/*  Single Scenario Execution                                         */
/* ------------------------------------------------------------------ */

async function runSingleScenario(scenario: AttackScenario): Promise<ScenarioScore> {
  // 1. Clean slate — reset in-memory AND disk to prevent leakage
  _resetQueue();
  _resetScoring();
  cleanDiskState();

  // 2. Generate attack events
  const attackEvents = generateAttackSequence(scenario);

  // 3. Build the full event list (confounders + NWSS + attack events)
  const allEvents: ChangeEvent[] = [];

  // Inject confounders if defined
  if (scenario.confounders) {
    for (const conf of scenario.confounders) {
      for (const huc8 of conf.huc8s) {
        allEvents.push(makeConfounderEvent(conf.source, huc8, conf.value));
      }
    }
  }

  // Inject NWSS anomaly if defined
  if (scenario.nwssAnomaly) {
    allEvents.push(makeNwssEvent(scenario));
  }

  // Append attack events
  allEvents.push(...attackEvents);

  // 4. Enqueue all events (skip dedup — multi-param scenarios need all events)
  const t0 = performance.now();
  const enqueued = await _enqueueWithoutDedup(allEvents);

  // 5. Score all HUCs
  const scoredHucs = await scoreAllHucs();

  // 6. Coordination detection
  const queueEvents = getAllEvents();
  const coordinated = detectCoordination(queueEvents);

  // 7. Classification — classify each WATCH+ HUC and pick highest threat
  let bestClassification: AttackClassification | null = null;
  const watchPlusHucs = scoredHucs.filter(
    h => h.level === 'WATCH' || h.level === 'CRITICAL',
  );

  for (const huc of watchPlusHucs) {
    const confounders = gatherConfounders(huc.huc8, queueEvents);
    const classification = classifyEvent(huc, confounders);

    if (
      !bestClassification ||
      classification.threatScore > bestClassification.threatScore
    ) {
      bestClassification = classification;
    }
  }

  // If no HUC reached WATCH+, still classify the top-scored HUC (if any)
  if (!bestClassification && scoredHucs.length > 0) {
    const topHuc = scoredHucs[0];
    const confounders = gatherConfounders(topHuc.huc8, queueEvents);
    bestClassification = classifyEvent(topHuc, confounders);
  }

  const t1 = performance.now();

  // 8. Build ScenarioResult
  const result: ScenarioResult = {
    scenarioName: scenario.name,
    description: scenario.description,
    eventsGenerated: allEvents.length,
    eventsEnqueued: enqueued.length,
    scoredHucs,
    coordinatedEvents: coordinated,
    classification: bestClassification,
    detectionLatencyMs: Math.round(t1 - t0),
    expectedClassification: scenario.expectedClassification,
    expectedCoordinationRange: scenario.expectedCoordinationScore,
  };

  // 9. Score it
  const score = scoreScenario(result);

  // 10. Clean up
  _resetQueue();
  _resetScoring();
  cleanDiskState();

  return score;
}

/* ------------------------------------------------------------------ */
/*  Event Factories                                                   */
/* ------------------------------------------------------------------ */

function makeConfounderEvent(
  source: ChangeEvent['source'],
  huc8: string,
  value: number,
): ChangeEvent {
  const now = new Date();
  return {
    eventId: `sim-confounder-${source}-${huc8}-${Date.now().toString(36)}`,
    source,
    detectedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    sourceTimestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    changeType: 'THRESHOLD_CROSSED',
    geography: {
      huc8,
      huc6: huc8.slice(0, 6),
      stateAbbr: 'MD',
    },
    severityHint: value >= 3 ? 'HIGH' : 'MODERATE',
    payload: {
      value,
      unit: source === 'QPE_RAINFALL' ? 'inches' : 'severity',
      simulated: true,
    },
    metadata: {
      sourceRecordId: `sim-confounder-${huc8}`,
      currentValue: value,
      threshold: 2.0,
    },
  };
}

function makeNwssEvent(scenario: AttackScenario): ChangeEvent {
  const nwss = scenario.nwssAnomaly!;
  const now = new Date();
  // NWSS event placed 24h before the attack window
  const eventTime = new Date(now.getTime() - scenario.windowMs - 24 * 60 * 60 * 1000);
  return {
    eventId: `sim-nwss-${nwss.sewershedId}-${Date.now().toString(36)}`,
    source: 'CDC_NWSS',
    detectedAt: eventTime.toISOString(),
    sourceTimestamp: eventTime.toISOString(),
    changeType: 'THRESHOLD_CROSSED',
    geography: {
      huc8: scenario.huc8s[0],
      huc6: scenario.huc8s[0].slice(0, 6),
      stateAbbr: scenario.states[0],
    },
    severityHint: nwss.sigma >= 4 ? 'CRITICAL' : nwss.sigma >= 3 ? 'HIGH' : 'MODERATE',
    payload: {
      sewershedId: nwss.sewershedId,
      pathogen: nwss.pathogen,
      sigma: nwss.sigma,
      concentration: nwss.concentration,
      countyFips: nwss.countyFips,
      simulated: true,
    },
    metadata: {
      sourceRecordId: `sim-nwss-${nwss.sewershedId}`,
      currentValue: nwss.concentration,
      threshold: nwss.concentration / nwss.sigma, // approximate baseline
    },
  };
}
