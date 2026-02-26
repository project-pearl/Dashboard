/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Tier 2 Scoring Engine                              */
/*  Time decay, compound patterns, geographic correlation             */
/* ------------------------------------------------------------------ */

import type {
  ChangeEvent,
  ScoredHuc,
  ScoredEventRef,
  ActivePattern,
  CompoundPattern,
  ScoreLevel,
} from './types';
import {
  BASE_SCORES,
  COMPOUND_PATTERNS,
  TIME_DECAY_WINDOW_HOURS,
  TIME_DECAY_FLOOR,
  ADJACENT_HUC_BONUS,
  scoreToLevel,
  BLOB_PATHS,
  DISK_PATHS,
} from './config';
import { getAllEvents, getActiveHucs, getEventsForHuc } from './eventQueue';
import { getAdjacentHucs, getStateForHuc, shareHuc6Parent } from './hucAdjacency';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';

import fs from 'fs';
import path from 'path';

/* ------------------------------------------------------------------ */
/*  Scored HUC Persistence                                            */
/* ------------------------------------------------------------------ */

let _scoredHucs: ScoredHuc[] = [];
let _diskLoaded = false;
let _blobChecked = false;

function diskPath(): string {
  return path.resolve(process.cwd(), DISK_PATHS.scoredHucs);
}

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  try {
    const raw = fs.readFileSync(diskPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) _scoredHucs = parsed;
  } catch { /* no disk */ }
}

function saveToDisk(): void {
  try {
    const dir = path.dirname(diskPath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(diskPath(), JSON.stringify(_scoredHucs));
  } catch { /* non-fatal */ }
}

export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_scoredHucs.length > 0) return;
  if (_blobChecked) return;
  _blobChecked = true;

  const data = await loadCacheFromBlob<ScoredHuc[]>(BLOB_PATHS.scoredHucs);
  if (data && Array.isArray(data) && data.length > 0) {
    _scoredHucs = data;
    saveToDisk();
  }
}

async function persist(): Promise<void> {
  saveToDisk();
  await saveCacheToBlob(BLOB_PATHS.scoredHucs, _scoredHucs);
}

/* ------------------------------------------------------------------ */
/*  Time Decay                                                        */
/* ------------------------------------------------------------------ */

function computeTimeDecay(detectedAt: string): number {
  const hoursSince = (Date.now() - new Date(detectedAt).getTime()) / (60 * 60 * 1000);
  if (hoursSince >= TIME_DECAY_WINDOW_HOURS) return TIME_DECAY_FLOOR;
  return Math.max(TIME_DECAY_FLOOR, 1.0 - (hoursSince / TIME_DECAY_WINDOW_HOURS));
}

/* ------------------------------------------------------------------ */
/*  Compound Pattern Matching                                         */
/* ------------------------------------------------------------------ */

function matchPattern(
  pattern: CompoundPattern,
  events: ChangeEvent[],
  huc8: string,
  adjacentHucs: string[]
): ActivePattern | null {
  const now = Date.now();
  const windowMs = pattern.timeWindowHours * 60 * 60 * 1000;

  // Filter events by time window
  const windowEvents = events.filter(e =>
    (now - new Date(e.detectedAt).getTime()) <= windowMs
  );

  if (windowEvents.length === 0) return null;

  // Filter by geographic constraint
  const geoFiltered = pattern.requireSameHuc
    ? windowEvents.filter(e => e.geography.huc8 === huc8)
    : windowEvents; // non-same-huc patterns allow adjacent HUCs

  // Check each required source group
  for (const sourceGroup of pattern.requiredSources) {
    const hasMatch = geoFiltered.some(e => sourceGroup.includes(e.source));
    if (!hasMatch) return null;
  }

  // Check minimum distinct sources
  if (pattern.minDistinctSources) {
    const distinctSources = new Set(geoFiltered.map(e => e.source));
    if (distinctSources.size < pattern.minDistinctSources) return null;
  }

  // Check minimum distinct HUCs (for spreading patterns)
  if (pattern.minDistinctHucs) {
    const distinctHucs = new Set(geoFiltered.map(e => e.geography.huc8).filter(Boolean));
    if (distinctHucs.size < pattern.minDistinctHucs) return null;
  }

  return {
    patternId: pattern.id,
    multiplier: pattern.multiplier,
    matchedEventIds: geoFiltered.map(e => e.eventId),
  };
}

/* ------------------------------------------------------------------ */
/*  Main Scoring                                                      */
/* ------------------------------------------------------------------ */

export async function scoreAllHucs(): Promise<ScoredHuc[]> {
  const allEvents = getAllEvents();
  if (allEvents.length === 0) {
    _scoredHucs = [];
    await persist();
    return [];
  }

  const activeHucs = getActiveHucs();
  const now = new Date().toISOString();
  const scored: ScoredHuc[] = [];

  // Pre-compute a map of events by HUC for adjacency lookups
  const eventsByHuc = new Map<string, ChangeEvent[]>();
  for (const e of allEvents) {
    const huc = e.geography.huc8;
    if (!huc) continue;
    if (!eventsByHuc.has(huc)) eventsByHuc.set(huc, []);
    eventsByHuc.get(huc)!.push(e);
  }

  for (const huc8 of activeHucs) {
    const hucEvents = getEventsForHuc(huc8);
    if (hucEvents.length === 0) continue;

    const adjacentHucs = getAdjacentHucs(huc8);
    const stateAbbr = getStateForHuc(huc8) ?? hucEvents[0]?.geography.stateAbbr ?? '';

    // 1. Score each event with time decay
    const eventScores: ScoredEventRef[] = [];
    let rawTotal = 0;

    for (const evt of hucEvents) {
      const baseScore = BASE_SCORES[evt.source]?.[evt.severityHint] ?? 10;
      const decay = computeTimeDecay(evt.detectedAt);
      const decayedScore = baseScore * decay;

      eventScores.push({
        eventId: evt.eventId,
        source: evt.source,
        baseScore,
        decayedScore,
      });

      rawTotal += decayedScore;
    }

    // 2. Check compound patterns
    // Gather all events in this HUC and adjacent HUCs for pattern matching
    const allNearbyEvents = [...hucEvents];
    for (const adj of adjacentHucs) {
      const adjEvents = eventsByHuc.get(adj);
      if (adjEvents) allNearbyEvents.push(...adjEvents);
    }

    const activePatterns: ActivePattern[] = [];
    let patternMultiplier = 1.0;

    for (const pattern of COMPOUND_PATTERNS) {
      const match = matchPattern(pattern, allNearbyEvents, huc8, adjacentHucs);
      if (match) {
        activePatterns.push(match);
        // Use the highest pattern multiplier (don't stack)
        patternMultiplier = Math.max(patternMultiplier, match.multiplier);
      }
    }

    let totalScore = rawTotal * patternMultiplier;

    // 3. Geographic correlation bonus
    let hasAdjacentActivity = false;
    for (const adj of adjacentHucs) {
      if (eventsByHuc.has(adj) && shareHuc6Parent(huc8, adj)) {
        hasAdjacentActivity = true;
        break;
      }
    }

    if (hasAdjacentActivity) {
      totalScore *= ADJACENT_HUC_BONUS;
    }

    const level = scoreToLevel(totalScore);

    scored.push({
      huc8,
      stateAbbr,
      score: Math.round(totalScore * 10) / 10,
      level,
      events: eventScores,
      activePatterns,
      lastScored: now,
    });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  _scoredHucs = scored;
  await persist();
  return scored;
}

/* ------------------------------------------------------------------ */
/*  Public Accessors                                                  */
/* ------------------------------------------------------------------ */

export function getScoredHucs(): ScoredHuc[] {
  ensureDiskLoaded();
  return _scoredHucs;
}

export function getHucsAtLevel(level: ScoreLevel): ScoredHuc[] {
  ensureDiskLoaded();
  return _scoredHucs.filter(h => h.level === level);
}

export function getHucsAboveWatch(): ScoredHuc[] {
  ensureDiskLoaded();
  return _scoredHucs.filter(h => h.level !== 'NORMAL');
}

export function getScoredHucsSummary(): {
  watch: number;
  advisory: number;
  alert: number;
  topHucs: { huc8: string; score: number; level: ScoreLevel }[];
} {
  ensureDiskLoaded();
  return {
    watch: _scoredHucs.filter(h => h.level === 'WATCH').length,
    advisory: _scoredHucs.filter(h => h.level === 'ADVISORY').length,
    alert: _scoredHucs.filter(h => h.level === 'ALERT').length,
    topHucs: _scoredHucs.slice(0, 10).map(h => ({
      huc8: h.huc8,
      score: h.score,
      level: h.level,
    })),
  };
}
