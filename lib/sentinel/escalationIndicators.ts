/* ------------------------------------------------------------------ */
/*  Escalation Indicators — Trajectory, velocity, acceleration         */
/*  Pure computation over ScoredHuc + ChangeEvent data                 */
/* ------------------------------------------------------------------ */

import type {
  ScoredHuc,
  ChangeEvent,
  ScoreSnapshot,
  EscalationIndicators,
  ScoreLevel,
} from './types';
import {
  BASE_SCORES,
  SCORE_THRESHOLDS,
  TIME_DECAY_WINDOW_HOURS,
  TIME_DECAY_FLOOR,
  scoreToLevel,
} from './config';
import { getDeviation } from './parameterBaselines';

/* ── Trajectory Replay ── */

const TRAJECTORY_HOURS = [24, 12, 6, 1, 0] as const;

function replayScoreAtTime(
  events: ChangeEvent[],
  hypotheticalNow: number,
  patternMultiplier: number,
): { score: number; level: ScoreLevel } {
  let total = 0;
  for (const event of events) {
    const detectedMs = new Date(event.detectedAt).getTime();
    if (detectedMs > hypotheticalNow) continue;

    const hoursSince = (hypotheticalNow - detectedMs) / (3_600_000);
    if (hoursSince >= TIME_DECAY_WINDOW_HOURS) {
      total += (BASE_SCORES[event.source]?.[event.severityHint] ?? 0) * TIME_DECAY_FLOOR;
      continue;
    }
    const decay = Math.max(TIME_DECAY_FLOOR, 1.0 - hoursSince / TIME_DECAY_WINDOW_HOURS);
    total += (BASE_SCORES[event.source]?.[event.severityHint] ?? 0) * decay;
  }
  const score = total * patternMultiplier;
  return { score, level: scoreToLevel(score) };
}

/* ── Escalation Class ── */

function classifyEscalation(velocity: number, acceleration: number): EscalationIndicators['escalationClass'] {
  if (velocity < -2) return 'deescalating';
  if (velocity < 1 && Math.abs(acceleration) < 0.5) return 'plateaued';
  if (velocity >= 5 || acceleration >= 2) return 'rapid';
  return 'steady';
}

/* ── Main Function ── */

export function computeEscalationIndicators(
  scoredHuc: ScoredHuc,
  events: ChangeEvent[],
): EscalationIndicators {
  const now = Date.now();
  const patternMultiplier = scoredHuc.activePatterns.length > 0
    ? Math.max(...scoredHuc.activePatterns.map(p => p.multiplier))
    : 1.0;

  // Trajectory replay
  const trajectory: ScoreSnapshot[] = TRAJECTORY_HOURS.map(hoursAgo => {
    const hypotheticalNow = now - hoursAgo * 3_600_000;
    const { score, level } = replayScoreAtTime(events, hypotheticalNow, patternMultiplier);
    return { hoursAgo, score, level };
  });

  // Velocity: score change per hour over last 6h
  const t6h = trajectory.find(t => t.hoursAgo === 6)?.score ?? 0;
  const tNow = trajectory.find(t => t.hoursAgo === 0)?.score ?? scoredHuc.score;
  const velocity = (tNow - t6h) / 6;

  // Acceleration: change in velocity (compare 12h->6h slope vs 6h->now slope)
  const t12h = trajectory.find(t => t.hoursAgo === 12)?.score ?? 0;
  const velPrev = (t6h - t12h) / 6;
  const acceleration = (velocity - velPrev) / 6;

  // Next threshold
  const currentScore = scoredHuc.score;
  const nextThreshold = SCORE_THRESHOLDS
    .filter(t => t.min > currentScore)
    .sort((a, b) => a.min - b.min)[0] ?? null;
  const estimatedHoursToNext = nextThreshold && velocity > 0
    ? (nextThreshold.min - currentScore) / velocity
    : null;

  // Pattern emergence
  const sixHoursAgo = now - 6 * 3_600_000;
  const twelveHoursAgo = now - 12 * 3_600_000;
  const patternEventTimes = new Map<string, { earliest: number; latest: number }>();
  for (const pattern of scoredHuc.activePatterns) {
    for (const eid of pattern.matchedEventIds) {
      const ev = events.find(e => e.eventId === eid);
      if (!ev) continue;
      const t = new Date(ev.detectedAt).getTime();
      const existing = patternEventTimes.get(pattern.patternId);
      if (!existing) {
        patternEventTimes.set(pattern.patternId, { earliest: t, latest: t });
      } else {
        if (t < existing.earliest) existing.earliest = t;
        if (t > existing.latest) existing.latest = t;
      }
    }
  }
  const newPatterns: string[] = [];
  const stablePatterns: string[] = [];
  for (const [pid, times] of patternEventTimes) {
    if (times.earliest >= sixHoursAgo) {
      newPatterns.push(pid);
    } else if (times.earliest <= twelveHoursAgo) {
      stablePatterns.push(pid);
    }
  }

  // Z-score trend from parameter deviations
  const zScores: number[] = [];
  for (const ev of events) {
    const val = ev.metadata?.currentValue;
    const paramCd = (ev.payload as any)?.parameterCd ?? (ev.payload as any)?.paramCd;
    if (val != null && paramCd && ev.geography.huc8 === scoredHuc.huc8) {
      const z = getDeviation(scoredHuc.huc8, paramCd, val as number);
      if (z != null) zScores.push(Math.abs(z));
    }
  }
  const currentAvg = zScores.length > 0 ? zScores.reduce((a, b) => a + b, 0) / zScores.length : 0;

  return {
    huc8: scoredHuc.huc8,
    stateAbbr: scoredHuc.stateAbbr,
    score: scoredHuc.score,
    level: scoredHuc.level,
    trajectory,
    velocity,
    acceleration,
    nextThreshold: nextThreshold ? { level: nextThreshold.level, min: nextThreshold.min } : null,
    estimatedHoursToNext,
    patternEmergence: {
      newPatterns,
      stablePatterns,
      totalActive: scoredHuc.activePatterns.length,
    },
    zScoreTrend: {
      currentAvg,
      trend: velocity > 2 ? 'rising' : velocity < -2 ? 'falling' : 'stable',
      paramCount: zScores.length,
    },
    escalationClass: classifyEscalation(velocity, acceleration),
  };
}
