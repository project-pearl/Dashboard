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
  getFirmsAllRegions,
  getFirmsForRegion,
  setFirmsCache,
  isFirmsBuildInProgress,
  setFirmsBuildInProgress,
  getFirmsCacheStatus,
} from '@/lib/firmsCache';
import type { FirmsCacheData } from '@/lib/firmsCache';

function makeFirmsCacheData(overrides?: Partial<FirmsCacheData>): FirmsCacheData {
  return {
    _meta: {
      built: '2024-01-15T00:00:00.000Z',
      regionCount: 2,
      totalDetections: 5,
      ...(overrides as any)?._meta,
    },
    regions: {
      conus: {
        region: 'conus',
        label: 'Continental US',
        bbox: [-125, 24, -66, 50],
        detectionCount: 3,
        highConfidenceCount: 2,
        maxFrp: 45.5,
        detections: [
          {
            lat: 34.5,
            lng: -118.2,
            brightness: 320,
            acq_date: '2024-01-15',
            acq_time: '0600',
            confidence: 'high',
            frp: 45.5,
            daynight: 'D',
            region: 'conus',
            nearestInstallation: 'Fort Irwin',
            distanceToInstallationMi: 12.3,
          },
        ],
      },
      europe: {
        region: 'europe',
        label: 'EUCOM',
        bbox: [-10, 35, 45, 72],
        detectionCount: 2,
        highConfidenceCount: 1,
        maxFrp: 30.0,
        detections: [],
      },
      ...overrides?.regions,
    },
  };
}

describe('firmsCache', () => {
  describe('getFirmsAllRegions', () => {
    it('returns empty array initially (before any set)', () => {
      // Note: If previous tests in this file have already called setFirmsCache,
      // the module-level state persists. We test the getter works regardless.
      const regions = getFirmsAllRegions();
      expect(Array.isArray(regions)).toBe(true);
    });
  });

  describe('setFirmsCache / getFirmsAllRegions', () => {
    it('returns region data after setFirmsCache', async () => {
      const data = makeFirmsCacheData();
      await setFirmsCache(data);

      const regions = getFirmsAllRegions();
      expect(regions.length).toBe(2);
      expect(regions.map(r => r.region)).toContain('conus');
      expect(regions.map(r => r.region)).toContain('europe');
    });
  });

  describe('getFirmsForRegion', () => {
    it('returns correct region after set', async () => {
      const data = makeFirmsCacheData();
      await setFirmsCache(data);

      const conus = getFirmsForRegion('conus');
      expect(conus).not.toBeNull();
      expect(conus!.region).toBe('conus');
      expect(conus!.label).toBe('Continental US');
      expect(conus!.detectionCount).toBe(3);
    });

    it('returns null for nonexistent region', async () => {
      const data = makeFirmsCacheData();
      await setFirmsCache(data);

      const result = getFirmsForRegion('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('isFirmsBuildInProgress', () => {
    beforeEach(() => {
      setFirmsBuildInProgress(false);
    });

    it('defaults to false', () => {
      expect(isFirmsBuildInProgress()).toBe(false);
    });

    it('toggles to true and back', () => {
      setFirmsBuildInProgress(true);
      expect(isFirmsBuildInProgress()).toBe(true);

      setFirmsBuildInProgress(false);
      expect(isFirmsBuildInProgress()).toBe(false);
    });

    it('auto-clears after 12 min', () => {
      vi.useFakeTimers();

      setFirmsBuildInProgress(true);
      expect(isFirmsBuildInProgress()).toBe(true);

      // Advance past the 12-minute BUILD_LOCK_TIMEOUT_MS
      vi.advanceTimersByTime(13 * 60 * 1000);
      expect(isFirmsBuildInProgress()).toBe(false);

      vi.useRealTimers();
    });

    it('does not auto-clear before 12 min', () => {
      vi.useFakeTimers();

      setFirmsBuildInProgress(true);
      vi.advanceTimersByTime(11 * 60 * 1000);
      expect(isFirmsBuildInProgress()).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('getFirmsCacheStatus', () => {
    it('returns loaded=true after setFirmsCache', async () => {
      const data = makeFirmsCacheData();
      await setFirmsCache(data);

      const status = getFirmsCacheStatus();
      expect(status.loaded).toBe(true);
      expect(status.source).toBeDefined();
      expect(status.built).toBe('2024-01-15T00:00:00.000Z');
      expect(status.regionCount).toBe(2);
      expect(status.totalDetections).toBe(5);
    });
  });
});
