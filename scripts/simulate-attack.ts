#!/usr/bin/env npx tsx
/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Attack Simulation Runner                           */
/*                                                                    */
/*  Usage:                                                            */
/*    npx tsx scripts/simulate-attack.ts --scenario <name> [--dry-run]*/
/*                                                                    */
/*  Scenarios:                                                        */
/*    single-point-contamination                                      */
/*    coordinated-multi-site                                          */
/*    slow-roll-poisoning                                             */
/*    bio-threat-with-nwss                                            */
/* ------------------------------------------------------------------ */

import { generateAttackSequence } from '../lib/sentinel/__tests__/attackSimulator';
import { ALL_SCENARIOS } from '../lib/sentinel/__tests__/scenarios';
import { enqueueEvents, _resetQueue } from '../lib/sentinel/eventQueue';
import { scoreAllHucs } from '../lib/sentinel/scoringEngine';
import { detectCoordination } from '../lib/sentinel/coordinationEngine';
import { classifyEvent, gatherConfounders } from '../lib/sentinel/classificationEngine';
import { getAllEvents } from '../lib/sentinel/eventQueue';

/* ------------------------------------------------------------------ */
/*  Parse CLI Args                                                    */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const scenarioIdx = args.indexOf('--scenario');
const scenarioName = scenarioIdx !== -1 ? args[scenarioIdx + 1] : null;
const isDryRun = args.includes('--dry-run');

if (!scenarioName || !ALL_SCENARIOS[scenarioName]) {
  console.error('\nUsage: npx tsx scripts/simulate-attack.ts --scenario <name> [--dry-run]\n');
  console.error('Available scenarios:');
  for (const [name, s] of Object.entries(ALL_SCENARIOS)) {
    console.error(`  ${name.padEnd(30)} — ${s.description}`);
  }
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/*  Run                                                               */
/* ------------------------------------------------------------------ */

async function run() {
  const scenario = ALL_SCENARIOS[scenarioName!];
  console.log(`\n========================================`);
  console.log(`  Scenario: ${scenario.name}`);
  console.log(`  ${scenario.description}`);
  console.log(`========================================\n`);

  // Generate events
  const events = generateAttackSequence(scenario);
  console.log(`Generated ${events.length} simulated events:\n`);

  for (const e of events) {
    const time = new Date(e.detectedAt).toISOString().slice(11, 19);
    const paramCd = (e.payload as Record<string, unknown>).parameterCd;
    const value = (e.payload as Record<string, unknown>).value;
    console.log(`  [${time}] ${e.geography.huc8} | ${paramCd} = ${typeof value === 'number' ? value.toFixed(2) : value} | ${e.severityHint}`);
  }

  if (isDryRun) {
    console.log(`\n--- DRY RUN — Events NOT injected ---\n`);
    console.log(`Expected classification: ${scenario.expectedClassification}`);
    console.log(`Expected coordination score: ${scenario.expectedCoordinationScore[0].toFixed(2)} – ${scenario.expectedCoordinationScore[1].toFixed(2)}`);
    process.exit(0);
  }

  // Inject into event queue
  console.log(`\nInjecting events into event queue...`);
  _resetQueue(); // Start with clean queue for isolated test
  const added = await enqueueEvents(events);
  console.log(`  ${added.length} events enqueued (${events.length - added.length} deduplicated)`);

  // Run scoring
  console.log(`\nRunning scoring engine...`);
  const scored = await scoreAllHucs();
  console.log(`  Scored ${scored.length} HUC(s):`);
  for (const h of scored) {
    console.log(`    ${h.huc8} (${h.stateAbbr}): score=${h.score}, level=${h.level}, events=${h.events.length}, patterns=${h.activePatterns.map(p => p.patternId).join(',') || 'none'}`);
  }

  // Run coordination detection
  console.log(`\nRunning coordination detection...`);
  const allEvents = getAllEvents();
  const coordinated = detectCoordination(allEvents);
  console.log(`  Found ${coordinated.length} coordinated cluster(s):`);
  for (const c of coordinated) {
    console.log(`    HUC-6 ${c.huc6}: score=${c.coordinationScore}, hucs=${c.memberHucs.join(',')}, params=${c.parameterBreadth}, spread=${Math.round(c.temporalSpread / 60000)}min`);
  }

  // Run classification
  console.log(`\nRunning classification engine...`);
  for (const huc of scored.filter(h => h.level !== 'NOMINAL')) {
    const confounders = gatherConfounders(huc.huc8, allEvents);
    const classification = classifyEvent(huc, confounders);
    console.log(`  ${huc.huc8}: ${classification.classification} (threat=${classification.threatScore})`);
    for (const r of classification.reasoning) {
      console.log(`    ${r.effect === 'boost' ? '+' : '-'}${r.magnitude.toFixed(2)} ${r.rule}: ${r.detail}`);
    }
  }

  // Compare with expected
  console.log(`\n--- Results vs. Expected ---`);
  console.log(`Expected classification: ${scenario.expectedClassification}`);
  console.log(`Expected coordination:   ${scenario.expectedCoordinationScore[0].toFixed(2)} – ${scenario.expectedCoordinationScore[1].toFixed(2)}`);
  if (coordinated.length > 0) {
    const actual = coordinated[0].coordinationScore;
    const inRange = actual >= scenario.expectedCoordinationScore[0] && actual <= scenario.expectedCoordinationScore[1];
    console.log(`Actual coordination:     ${actual.toFixed(3)} ${inRange ? '✓' : '✗ OUT OF RANGE'}`);
  } else {
    console.log(`Actual coordination:     none detected`);
  }

  console.log('');
}

run().catch(err => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
