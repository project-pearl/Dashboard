import type { CachedInsight, CacheEntry } from '@/lib/insightsCache';

export function makeCachedInsight(overrides: Partial<CachedInsight> = {}): CachedInsight {
  return {
    type: 'anomaly',
    severity: 'warning',
    title: 'Elevated Turbidity Detected',
    body: 'Turbidity readings at 3 monitoring sites in the Patapsco watershed exceeded seasonal norms by 40%.',
    waterbody: 'Patapsco River',
    timeframe: 'last 24 hours',
    ...overrides,
  };
}

export function makeCacheEntry(overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    insights: [makeCachedInsight()],
    generatedAt: new Date().toISOString(),
    signalsHash: 'abc123',
    provider: 'openai',
    ...overrides,
  };
}
