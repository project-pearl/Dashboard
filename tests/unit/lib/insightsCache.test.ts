import { describe, it, expect, vi } from 'vitest';
import {
  getInsights,
  setInsights,
  isBuildInProgress,
  setBuildInProgress,
  getCacheStatus,
  getCacheKey,
  hashSignals,
  clearInsightsCache,
  setLastFullBuild,
} from '@/lib/insightsCache';
import { makeCacheEntry, makeCachedInsight } from '../../mocks/fixtures/insights-sample-data';

vi.mock('@/lib/blobPersistence', () => ({
  saveCacheToBlob: vi.fn().mockResolvedValue(undefined),
  loadCacheFromBlob: vi.fn().mockResolvedValue(null),
}));

describe('insightsCache', () => {
  describe('getInsights', () => {
    it('returns null when cache is cold', () => {
      clearInsightsCache();
      const result = getInsights('ZZ', 'Federal');
      expect(result).toBeNull();
    });

    it('returns entry after setInsights', () => {
      clearInsightsCache();
      const entry = makeCacheEntry();
      setInsights('MD', 'Federal', entry);

      const result = getInsights('MD', 'Federal');
      expect(result).not.toBeNull();
      expect(result!.insights).toHaveLength(1);
      expect(result!.provider).toBe('openai');
    });

    it('returns null for unknown state+role combo', () => {
      clearInsightsCache();
      setInsights('MD', 'Federal', makeCacheEntry());
      const result = getInsights('ZZ', 'Federal');
      expect(result).toBeNull();
    });

    it('returns null for stale entries (>7 hours)', () => {
      clearInsightsCache();
      const staleTime = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
      setInsights('MD', 'MS4', makeCacheEntry({ generatedAt: staleTime }));

      const result = getInsights('MD', 'MS4');
      expect(result).toBeNull();
    });

    it('preserves insight fields', () => {
      clearInsightsCache();
      const entry = makeCacheEntry({
        insights: [
          makeCachedInsight({
            type: 'recommendation',
            severity: 'critical',
            title: 'Immediate Action Required',
          }),
        ],
        urgentRefresh: true,
        enrichmentSummary: '2 critical USGS alerts',
      });
      setInsights('VA', 'State', entry);

      const result = getInsights('VA', 'State');
      expect(result).not.toBeNull();
      expect(result!.insights[0].type).toBe('recommendation');
      expect(result!.insights[0].severity).toBe('critical');
      expect(result!.urgentRefresh).toBe(true);
      expect(result!.enrichmentSummary).toBe('2 critical USGS alerts');
    });
  });

  describe('isBuildInProgress', () => {
    it('defaults to false', () => {
      setBuildInProgress(false);
      expect(isBuildInProgress()).toBe(false);
    });

    it('can be toggled', () => {
      setBuildInProgress(true);
      expect(isBuildInProgress()).toBe(true);
      setBuildInProgress(false);
      expect(isBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();
      setBuildInProgress(true);
      expect(isBuildInProgress()).toBe(true);

      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getCacheKey', () => {
    it('formats state:role uppercase key', () => {
      expect(getCacheKey('md', 'Federal')).toBe('MD:Federal');
    });
  });

  describe('hashSignals', () => {
    it('returns deterministic hash for same input', () => {
      const signals = [
        { type: 'anomaly', severity: 'warning', title: 'Test' },
      ];
      const h1 = hashSignals(signals);
      const h2 = hashSignals(signals);
      expect(h1).toBe(h2);
    });

    it('returns different hash for different input', () => {
      const h1 = hashSignals([{ type: 'anomaly', severity: 'warning', title: 'A' }]);
      const h2 = hashSignals([{ type: 'anomaly', severity: 'critical', title: 'B' }]);
      expect(h1).not.toBe(h2);
    });
  });

  describe('getCacheStatus', () => {
    it('returns idle when cache is empty', () => {
      clearInsightsCache();
      setBuildInProgress(false);
      const status = getCacheStatus();
      expect(status.status).toBe('idle');
      expect(status.entries).toBe(0);
    });

    it('returns ready when cache has entries', () => {
      clearInsightsCache();
      setBuildInProgress(false);
      setInsights('MD', 'Federal', makeCacheEntry());
      const status = getCacheStatus();
      expect(status.status).toBe('ready');
      expect(status.entries).toBeGreaterThanOrEqual(1);
      expect(status.states).toContain('MD');
    });

    it('returns building when build is in progress', () => {
      clearInsightsCache();
      setBuildInProgress(true);
      const status = getCacheStatus();
      expect(status.status).toBe('building');
      setBuildInProgress(false);
    });
  });
});
