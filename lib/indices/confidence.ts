import type { IndexId } from './types';
import {
  CONFIDENCE_WEIGHTS,
  EXPECTED_DATA_POINTS,
  EXPECTED_SOURCES,
  LOW_CONFIDENCE_REGRESSION,
  NEUTRAL_SCORE,
  CONFIDENCE,
} from './config';

/**
 * Freshness weight — mirrors the pattern from lib/waterQualityScore.ts
 * Returns 0-1 multiplier based on data age.
 */
export function freshnessWeight(dateStr: string | null | undefined): number {
  if (!dateStr) return 0.15;
  const age = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(age)) return 0.15;
  const days = age / 86_400_000;
  if (days < 1) return 1.0;
  if (days < 7) return 0.97;
  if (days < 30) return 0.95;
  if (days < 90) return 0.90;
  if (days < 730) return 0.80;   // 2 years
  if (days < 1825) return 0.55;  // 5 years
  if (days < 3650) return 0.25;  // 10 years
  return 0;
}

/**
 * Compute confidence score for an index (0-100).
 *
 * Three components:
 *   Data Density (40%):    dataPoints / expected
 *   Recency (35%):         average freshness weight of date strings
 *   Source Diversity (25%): unique sources / expected sources
 */
export function computeConfidence(
  indexId: IndexId,
  dataPoints: number,
  dates: (string | null | undefined)[],
  uniqueSources: number,
): number {
  const expected = EXPECTED_DATA_POINTS[indexId];
  const expectedSrc = EXPECTED_SOURCES[indexId];

  const density = Math.min(100, (dataPoints / Math.max(1, expected)) * 100);

  const recencyScores = dates.length > 0
    ? dates.map(d => freshnessWeight(d) * 100)
    : [0];
  const recency = recencyScores.reduce((a, b) => a + b, 0) / recencyScores.length;

  const diversity = Math.min(100, (uniqueSources / Math.max(1, expectedSrc)) * 100);

  const raw =
    density * CONFIDENCE_WEIGHTS.dataDensity +
    recency * CONFIDENCE_WEIGHTS.recency +
    diversity * CONFIDENCE_WEIGHTS.sourceDiversity;

  return Math.round(Math.max(0, Math.min(100, raw)));
}

/**
 * At LOW confidence, regress a score toward neutral (50) to avoid false precision.
 */
export function applyConfidenceRegression(score: number, confidence: number): number {
  if (confidence >= CONFIDENCE.MODERATE) return score;
  // Regress 50% toward neutral
  return Math.round(score + (NEUTRAL_SCORE - score) * LOW_CONFIDENCE_REGRESSION);
}
