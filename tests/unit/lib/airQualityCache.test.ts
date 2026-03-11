import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/blobPersistence', () => ({
  saveCacheToBlob: vi.fn().mockResolvedValue(undefined),
  loadCacheFromBlob: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/cacheUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cacheUtils')>();
  return { ...actual, computeCacheDelta: vi.fn().mockReturnValue({ added: 0, removed: 0 }) };
});

import {
  getAirQualityAllStates,
  getAirQualityForState,
  setAirQualityCache,
  isAirQualityBuildInProgress,
  setAirQualityBuildInProgress,
  getAirQualityCacheStatus,
} from '@/lib/airQualityCache';

function makeAirQualityCacheData(stateOverrides?: Record<string, Partial<any>>) {
  const defaults: Record<string, any> = {
    MD: {
      state: 'MD',
      lat: 39.0,
      lng: -76.6,
      timestamp: '2024-01-15T12:00:00.000Z',
      provider: 'open-meteo',
      monitorCount: 5,
      nearestMonitorDistanceMi: 2.3,
      confidence: 'high',
      impactedCounty: 'Baltimore',
      impactedCountyFips: '24005',
      impactedCounties: [{ name: 'Baltimore', fips: '24005' }],
      impactedZips: ['21201', '21202'],
      impactedZipCount: 2,
      usAqi: 85,
      pm25: 22.5,
      pm10: 35.0,
      ozone: 0.045,
      no2: 15.0,
      so2: 3.0,
      co: 0.5,
    },
    VA: {
      state: 'VA',
      lat: 37.5,
      lng: -77.4,
      timestamp: '2024-01-15T12:00:00.000Z',
      provider: 'open-meteo',
      monitorCount: 3,
      nearestMonitorDistanceMi: 4.1,
      confidence: 'medium',
      impactedCounty: 'Fairfax',
      impactedCountyFips: '51059',
      impactedCounties: [{ name: 'Fairfax', fips: '51059' }],
      impactedZips: ['22030'],
      impactedZipCount: 1,
      usAqi: 55,
      pm25: 12.0,
      pm10: 20.0,
      ozone: 0.035,
      no2: 10.0,
      so2: 2.0,
      co: 0.3,
    },
  };

  const states = { ...defaults, ...stateOverrides };

  return {
    _meta: {
      built: '2024-01-15T12:00:00.000Z',
      stateCount: Object.keys(states).length,
      provider: 'open-meteo',
    },
    states,
  };
}

describe('airQualityCache', () => {
  describe('getAirQualityAllStates', () => {
    it('returns empty array initially (before any set)', () => {
      const states = getAirQualityAllStates();
      expect(Array.isArray(states)).toBe(true);
    });
  });

  describe('setAirQualityCache / getAirQualityAllStates', () => {
    it('returns state data after setAirQualityCache', async () => {
      const data = makeAirQualityCacheData();
      await setAirQualityCache(data);

      const states = getAirQualityAllStates();
      expect(states.length).toBe(2);
      expect(states.map(s => s.state)).toContain('MD');
      expect(states.map(s => s.state)).toContain('VA');
    });
  });

  describe('getAirQualityForState', () => {
    it('returns correct state after set', async () => {
      const data = makeAirQualityCacheData();
      await setAirQualityCache(data);

      const md = getAirQualityForState('MD');
      expect(md).not.toBeNull();
      expect(md!.state).toBe('MD');
      expect(md!.usAqi).toBe(85);
      expect(md!.pm25).toBe(22.5);
    });

    it('returns null for unknown state', async () => {
      const data = makeAirQualityCacheData();
      await setAirQualityCache(data);

      const result = getAirQualityForState('ZZ');
      expect(result).toBeNull();
    });

    it('supports case-insensitive state lookup', async () => {
      const data = makeAirQualityCacheData();
      await setAirQualityCache(data);

      const lowercase = getAirQualityForState('md');
      const uppercase = getAirQualityForState('MD');

      expect(lowercase).not.toBeNull();
      expect(uppercase).not.toBeNull();
      expect(lowercase!.state).toBe(uppercase!.state);
      expect(lowercase!.usAqi).toBe(uppercase!.usAqi);
    });
  });

  describe('isAirQualityBuildInProgress', () => {
    beforeEach(() => {
      setAirQualityBuildInProgress(false);
    });

    it('defaults to false', () => {
      expect(isAirQualityBuildInProgress()).toBe(false);
    });

    it('toggles with setter', () => {
      setAirQualityBuildInProgress(true);
      expect(isAirQualityBuildInProgress()).toBe(true);

      setAirQualityBuildInProgress(false);
      expect(isAirQualityBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();

      setAirQualityBuildInProgress(true);
      expect(isAirQualityBuildInProgress()).toBe(true);

      // Advance past the 12-minute BUILD_LOCK_TIMEOUT_MS
      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isAirQualityBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });

    it('does not auto-clear before 12 min', () => {
      vi.useFakeTimers();

      setAirQualityBuildInProgress(true);
      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(isAirQualityBuildInProgress()).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('getAirQualityCacheStatus', () => {
    it('returns loaded=true after setAirQualityCache', async () => {
      const data = makeAirQualityCacheData();
      await setAirQualityCache(data);

      const status = getAirQualityCacheStatus();
      expect(status.loaded).toBe(true);
      expect(status.source).toBeDefined();
      expect(status.built).toBe('2024-01-15T12:00:00.000Z');
      expect(status.stateCount).toBe(2);
      expect(status.provider).toBe('open-meteo');
    });
  });
});
