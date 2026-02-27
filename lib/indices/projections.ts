import type { HucProjection } from './types';

export interface ScoreHistoryEntry {
  date: string;
  composite: number;
}

/**
 * Generate 7-day and 30-day composite projections using linear extrapolation.
 *
 * Requires >= 3 historical data points. Returns null if insufficient history.
 *
 * 7-day: extrapolates from most recent 7 entries (or all if < 7)
 * 30-day: extrapolates from all entries, with confidence * 0.7
 */
export function computeProjections(
  history: ScoreHistoryEntry[],
  currentComposite: number,
  currentConfidence: number,
): { projection7d: HucProjection | null; projection30d: HucProjection | null } {
  if (history.length < 3) {
    return { projection7d: null, projection30d: null };
  }

  // Sort by date ascending
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const nowMs = Date.now();

  function extrapolate(entries: ScoreHistoryEntry[], daysOut: number, confMultiplier: number): HucProjection | null {
    if (entries.length < 2) return null;

    // Linear regression: dayOffset → composite
    const points = entries.map(e => ({
      dayOffset: (new Date(e.date).getTime() - nowMs) / 86_400_000,
      value: e.composite,
    }));

    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (const p of points) {
      sumX += p.dayOffset;
      sumY += p.value;
      sumXY += p.dayOffset * p.value;
      sumX2 += p.dayOffset * p.dayOffset;
    }
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return null;

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    const projected = intercept + slope * daysOut;
    const clamped = Math.max(0, Math.min(100, Math.round(projected)));
    const delta = Math.round(clamped - currentComposite);

    let direction: HucProjection['direction'] = 'stable';
    if (delta >= 3) direction = 'declining';   // higher composite = worse
    if (delta <= -3) direction = 'improving';

    return {
      composite: clamped,
      delta,
      direction,
      confidence: Math.round(currentConfidence * confMultiplier),
    };
  }

  // 7-day: use most recent 7 entries
  const recent7 = sorted.slice(-7);
  const projection7d = extrapolate(recent7, 7, 0.85);

  // 30-day: use all entries, wider confidence interval
  const projection30d = extrapolate(sorted, 30, 0.7);

  return { projection7d, projection30d };
}
