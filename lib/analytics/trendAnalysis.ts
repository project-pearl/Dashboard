/**
 * Trend Analysis — pure math functions for time-series analysis.
 *
 * No cache dependencies, no side effects. Takes TimeSeriesPoint[],
 * returns trends and projections. Used by comprehensiveAssessment,
 * eventPredictor, and any component that needs trend arrows.
 */

import type { TimeSeriesPoint, TrendResult, ProjectionPoint } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert ISO date string to day-index (days since epoch). */
function dayIndex(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 86_400_000);
}

/** Format day-index back to ISO date string. */
function dayToISO(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Mean of an array of numbers. */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// ── Linear Regression ────────────────────────────────────────────────────────

interface RegressionResult {
  slope: number;       // units per day
  intercept: number;
  r2: number;
}

/**
 * Ordinary least squares linear regression.
 * x = day index, y = value.
 */
function linearRegression(points: TimeSeriesPoint[]): RegressionResult {
  const n = points.length;
  const xs = points.map(p => dayIndex(p.date));
  const ys = points.map(p => p.value);

  const xMean = mean(xs);
  const yMean = mean(ys);

  let ssXY = 0;
  let ssXX = 0;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean;
    const dy = ys[i] - yMean;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssTot += dy * dy;
  }

  const slope = ssXX === 0 ? 0 : ssXY / ssXX;
  const intercept = yMean - slope * xMean;

  // R² — proportion of variance explained
  const ssRes = points.reduce((sum, p, i) => {
    const predicted = slope * xs[i] + intercept;
    return sum + (ys[i] - predicted) ** 2;
  }, 0);
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute trend from a time series.
 * Returns null if fewer than 7 data points (not enough for meaningful trend).
 *
 * Direction thresholds: slope > ±0.5% of mean per day = improving/declining.
 * Projections: 30, 90, 180, 365 days out with widening confidence bands.
 */
export function computeTrend(points: TimeSeriesPoint[]): TrendResult | null {
  if (points.length < 7) return null;

  // Sort by date ascending
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const reg = linearRegression(sorted);

  const yMean = mean(sorted.map(p => p.value));
  const threshold = Math.abs(yMean) * 0.005; // 0.5% of mean per day

  let direction: TrendResult['direction'];
  if (reg.slope > threshold) {
    // Positive slope: for metrics like riskScore, violationCount — that means declining conditions
    // But we label direction by the metric movement, not quality judgment
    // Higher risk = "declining", lower risk = "improving"
    // The caller knows the metric semantics; we report the math direction
    direction = 'declining';
  } else if (reg.slope < -threshold) {
    direction = 'improving';
  } else {
    direction = 'stable';
  }

  // Compute residual standard error for confidence bands
  const xs = sorted.map(p => dayIndex(p.date));
  const residuals = sorted.map((p, i) => p.value - (reg.slope * xs[i] + reg.intercept));
  const residStdErr = Math.sqrt(
    residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, sorted.length - 2),
  );

  const lastDay = xs[xs.length - 1];
  const horizons = [30, 90, 180, 365];

  const projections: ProjectionPoint[] = horizons.map(h => {
    const futureDay = lastDay + h;
    const predicted = reg.slope * futureDay + reg.intercept;
    // Confidence band widens with sqrt of forecast horizon
    const width = residStdErr * 1.96 * Math.sqrt(1 + h / sorted.length);
    return {
      date: dayToISO(futureDay),
      value: Math.round(predicted * 100) / 100,
      confidence: {
        low: Math.round((predicted - width) * 100) / 100,
        high: Math.round((predicted + width) * 100) / 100,
      },
    };
  });

  return {
    direction,
    slope: Math.round(reg.slope * 1e6) / 1e6,
    r2: Math.round(reg.r2 * 1000) / 1000,
    projections,
  };
}

/**
 * Moving average — smooths noisy data with a window of N days.
 * Points within the window are averaged. Output has same length as input
 * (early points use a smaller window).
 */
export function movingAverage(
  points: TimeSeriesPoint[],
  windowDays: number,
): TimeSeriesPoint[] {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((p, i) => {
    const cutoffDay = dayIndex(p.date) - windowDays;
    const windowPoints: number[] = [];
    // Look backward from current point
    for (let j = i; j >= 0; j--) {
      if (dayIndex(sorted[j].date) < cutoffDay) break;
      windowPoints.push(sorted[j].value);
    }
    return {
      date: p.date,
      value: Math.round(mean(windowPoints) * 100) / 100,
    };
  });
}

/**
 * Rate of change over a period.
 * Returns the average daily change over the last `periodDays` days.
 * Returns null if insufficient data spans the period.
 */
export function rateOfChange(
  points: TimeSeriesPoint[],
  periodDays: number,
): number | null {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const lastPoint = sorted[sorted.length - 1];
  const cutoffDay = dayIndex(lastPoint.date) - periodDays;

  // Find the earliest point within the window
  const startPoint = sorted.find(p => dayIndex(p.date) >= cutoffDay);
  if (!startPoint || startPoint.date === lastPoint.date) return null;

  const daySpan = dayIndex(lastPoint.date) - dayIndex(startPoint.date);
  if (daySpan === 0) return null;

  return (lastPoint.value - startPoint.value) / daySpan;
}

/**
 * Simple change-point detection.
 * Splits the series at each candidate point and compares the mean of the
 * first half vs second half. The split with the largest mean difference
 * is the candidate change point. Returns null if < 14 data points.
 *
 * @param windowDays - minimum points on each side of the split (default 7)
 */
export function detectChangePoint(
  points: TimeSeriesPoint[],
  windowDays: number = 7,
): {
  detected: boolean;
  changeDate: string | null;
  priorDirection: string;
  newDirection: string;
} | null {
  if (points.length < windowDays * 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));

  let bestSplit = -1;
  let bestDiff = 0;

  for (let i = windowDays; i <= sorted.length - windowDays; i++) {
    const leftMean = mean(sorted.slice(0, i).map(p => p.value));
    const rightMean = mean(sorted.slice(i).map(p => p.value));
    const diff = Math.abs(rightMean - leftMean);
    if (diff > bestDiff) {
      bestDiff = diff;
      bestSplit = i;
    }
  }

  if (bestSplit < 0) {
    return { detected: false, changeDate: null, priorDirection: 'stable', newDirection: 'stable' };
  }

  // Check if the difference is significant (> 10% of overall mean)
  const overallMean = mean(sorted.map(p => p.value));
  const threshold = Math.abs(overallMean) * 0.1;

  if (bestDiff < threshold) {
    return { detected: false, changeDate: null, priorDirection: 'stable', newDirection: 'stable' };
  }

  const leftMean = mean(sorted.slice(0, bestSplit).map(p => p.value));
  const rightMean = mean(sorted.slice(bestSplit).map(p => p.value));

  return {
    detected: true,
    changeDate: sorted[bestSplit].date,
    priorDirection: leftMean < rightMean ? 'rising' : 'falling',
    newDirection: leftMean < rightMean ? 'rising' : 'falling',
  };
}
