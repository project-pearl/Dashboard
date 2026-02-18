// lib/insightsCache.ts
// In-memory cache for pre-generated AI insights
// Populated by cron job every 6 hours, served instantly to users
// Falls back to on-demand generation on cold start

export interface CachedInsight {
  type: 'predictive' | 'anomaly' | 'comparison' | 'recommendation' | 'summary';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  waterbody?: string;
  timeframe?: string;
}

export interface CacheEntry {
  insights: CachedInsight[];
  generatedAt: string;
  signalsHash: string; // hash of signals data — only regenerate if this changes
  provider: string;
}

type CacheKey = string; // format: "STATE:ROLE" e.g. "MD:MS4"

// ─── State ───────────────────────────────────────────────────────────────────

const cache = new Map<CacheKey, CacheEntry>();
let lastFullBuild: string | null = null;
let buildInProgress = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getCacheKey(state: string, role: string): CacheKey {
  return `${state.toUpperCase()}:${role}`;
}

// Simple hash for change detection — if signals haven't changed, skip regeneration
export function hashSignals(signals: any[]): string {
  const str = JSON.stringify(signals.map(s => `${s.type}:${s.severity}:${s.title}`).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getInsights(state: string, role: string): CacheEntry | null {
  const entry = cache.get(getCacheKey(state, role));
  if (!entry) return null;

  // Stale after 7 hours (gives buffer past 6hr cron)
  const age = Date.now() - new Date(entry.generatedAt).getTime();
  if (age > 7 * 60 * 60 * 1000) return null;

  return entry;
}

export function setInsights(state: string, role: string, entry: CacheEntry): void {
  cache.set(getCacheKey(state, role), entry);
}

export function isBuildInProgress(): boolean {
  return buildInProgress;
}

export function setBuildInProgress(v: boolean): void {
  buildInProgress = v;
}

export function setLastFullBuild(timestamp: string): void {
  lastFullBuild = timestamp;
}

export function getCacheStatus(): {
  status: 'idle' | 'building' | 'ready';
  entries: number;
  lastFullBuild: string | null;
  states: string[];
} {
  const states = new Set<string>();
  for (const key of cache.keys()) {
    states.add(key.split(':')[0]);
  }
  return {
    status: buildInProgress ? 'building' : cache.size > 0 ? 'ready' : 'idle',
    entries: cache.size,
    lastFullBuild,
    states: [...states].sort(),
  };
}

// Clear all cached insights (for manual reset)
export function clearInsightsCache(): void {
  cache.clear();
  lastFullBuild = null;
}
