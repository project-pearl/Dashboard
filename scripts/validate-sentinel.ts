#!/usr/bin/env npx tsx
/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Validation CLI                                     */
/*  Usage: npx tsx scripts/validate-sentinel.ts [options]              */
/*    --scenario <name>   Run a single scenario                       */
/*    --json              Output raw ScoreReport JSON                  */
/*    --output <path>     Write METRICS.md to custom path              */
/* ------------------------------------------------------------------ */

import { runValidation } from '../lib/sentinel/__tests__/runValidation';
import type { ScoreReport, ScenarioScore } from '../lib/sentinel/__tests__/scorer';
import fs from 'fs';
import path from 'path';

/* ------------------------------------------------------------------ */
/*  Arg Parsing                                                       */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const scenarioName = getArg('--scenario');
const jsonMode = args.includes('--json');
const outputPath = getArg('--output') ?? 'docs/METRICS.md';

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('\n  PIN Sentinel — Validation Suite\n');

  const scenarioNames = scenarioName ? [scenarioName] : undefined;
  const report = await runValidation(scenarioNames);

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Print ASCII table
  printTable(report);

  // Write METRICS.md
  const md = generateMetricsMd(report);
  const absPath = path.resolve(process.cwd(), outputPath);
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(absPath, md, 'utf-8');
  console.log(`\n  METRICS.md written to ${absPath}\n`);
}

/* ------------------------------------------------------------------ */
/*  ASCII Table                                                       */
/* ------------------------------------------------------------------ */

function printTable(report: ScoreReport) {
  const divider = '  ' + '-'.repeat(110);
  console.log(divider);
  console.log(
    '  ' +
    pad('Scenario', 36) +
    pad('Expected', 16) +
    pad('Actual', 16) +
    pad('Coord', 10) +
    pad('Latency', 10) +
    pad('Result', 8),
  );
  console.log(divider);

  for (const s of report.scenarios) {
    const result = s.passed ? 'PASS' : 'FAIL';
    console.log(
      '  ' +
      pad(s.scenarioName, 36) +
      pad(s.expectedClassification, 16) +
      pad(s.actualClassification, 16) +
      pad(s.actualCoordination.toFixed(3), 10) +
      pad(`${s.detectionLatencyMs}ms`, 10) +
      pad(result, 8),
    );
  }

  console.log(divider);
  const a = report.aggregate;
  console.log(`\n  Aggregate Metrics:`);
  console.log(`    Precision:  ${a.precision}`);
  console.log(`    Recall:     ${a.recall}`);
  console.log(`    F1 Score:   ${a.f1}`);
  console.log(`    Accuracy:   ${a.accuracy}`);
  console.log(`    Mean Latency: ${a.meanLatencyMs}ms`);
  console.log(`    Passed: ${a.passed}/${a.totalScenarios}  Failed: ${a.failed}/${a.totalScenarios}`);
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length);
}

/* ------------------------------------------------------------------ */
/*  METRICS.md Generation                                             */
/* ------------------------------------------------------------------ */

function generateMetricsMd(report: ScoreReport): string {
  const date = new Date(report.generatedAt).toISOString().split('T')[0];
  const a = report.aggregate;

  let md = `# PIN Sentinel — Validation Metrics

> Auto-generated on ${date} by \`scripts/validate-sentinel.ts\`

## System Description

PIN Sentinel is a real-time water-quality threat detection pipeline that ingests change events from 12 federal data sources, scores HUC-8 basins using time-decayed compound patterns, detects spatial coordination across HUC-6 clusters, and classifies anomalies as attack vs. benign using rule-based confounder analysis.

## Aggregate Metrics

| Metric | Value |
|--------|-------|
| Precision | ${a.precision} |
| Recall | ${a.recall} |
| F1 Score | ${a.f1} |
| Accuracy | ${a.accuracy} |
| Mean Detection Latency | ${a.meanLatencyMs}ms |
| Scenarios Passed | ${a.passed}/${a.totalScenarios} |

## Scenario Results

| # | Scenario | Expected | Actual | Coord | Latency | Result |
|---|----------|----------|--------|-------|---------|--------|
`;

  report.scenarios.forEach((s, i) => {
    const result = s.passed ? 'PASS' : 'FAIL';
    md += `| ${i + 1} | ${s.scenarioName} | ${s.expectedClassification} | ${s.actualClassification} | ${s.actualCoordination.toFixed(3)} | ${s.detectionLatencyMs}ms | **${result}** |\n`;
  });

  md += `\n## Per-Scenario Detail\n`;

  for (const s of report.scenarios) {
    md += `\n### ${s.scenarioName}\n\n`;
    md += `**Description:** ${s.description}\n\n`;
    md += `- Events generated: ${s.eventsGenerated}\n`;
    md += `- HUCs scored: ${s.hucsScored}\n`;
    md += `- Threat score: ${s.threatScore}\n`;
    md += `- Classification: ${s.actualClassification} (expected: ${s.expectedClassification})\n`;
    md += `- Coordination: ${s.actualCoordination.toFixed(3)} (expected range: [${s.expectedCoordinationRange[0]}, ${s.expectedCoordinationRange[1]}])\n`;
    md += `- Detection latency: ${s.detectionLatencyMs}ms\n`;

    if (s.reasoning.length > 0) {
      md += `\n**Reasoning chain:**\n\n`;
      for (const r of s.reasoning) {
        md += `- ${r}\n`;
      }
    }

    md += `\n**Result:** ${s.passed ? 'PASS' : 'FAIL'}\n`;
  }

  md += `
## Methodology

1. Each scenario defines a set of simulated \`ChangeEvent\` objects with known deviations, geographies, and timing.
2. Events are injected into a clean event queue, scored by the Tier-2 scoring engine, analyzed for spatial coordination, and classified by the rule-based classification engine.
3. Results are compared against expected classifications and coordination score ranges.
4. Precision/recall/F1 are computed using standard binary classification where "positive" = \`likely_attack\` or \`possible_attack\`.

## Limitations

- **Synthetic data only.** Scenarios use simulated events with idealized timing and parameter values. Real-world data would exhibit noise, missing values, and partial coverage.
- **No historical replay.** Validation does not replay historical contamination events — it uses pre-defined attack patterns.
- **Deterministic confounders.** Weather confounders are injected directly rather than fetched from live APIs.
- **In-process execution.** Validation runs in-process without network I/O, so latency numbers reflect compute time only.
`;

  return md;
}

/* ------------------------------------------------------------------ */
/*  Run                                                               */
/* ------------------------------------------------------------------ */

main().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
