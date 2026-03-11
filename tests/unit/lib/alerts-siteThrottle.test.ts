import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/blobPersistence', () => ({
  saveCacheToBlob: vi.fn(async () => {}),
  loadCacheFromBlob: vi.fn(async () => null),
}));

import {
  extractSiteKey,
  loadSiteThrottleState,
  saveSiteThrottleState,
  updateSiteBreaches,
  shouldThrottle,
  markSiteFired,
  purgeStaleSiteEntries,
} from '@/lib/alerts/siteThrottle';
import type { SiteThrottleState } from '@/lib/alerts/siteThrottle';
import type { AlertEvent } from '@/lib/alerts/types';
import { loadCacheFromBlob, saveCacheToBlob } from '@/lib/blobPersistence';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeCandidate(dedupKey: string, severity: 'critical' | 'warning' | 'info' = 'warning'): AlertEvent {
  return {
    id: 'test-id',
    type: 'sentinel',
    severity,
    title: 'Test',
    body: 'Test body',
    entityId: 'HUC123',
    entityLabel: 'Test HUC',
    dedupKey,
    createdAt: new Date().toISOString(),
    channel: 'email',
    recipientEmail: '',
    sent: false,
    sentAt: null,
    error: null,
    ruleId: null,
    metadata: {},
  };
}

function emptyState(): SiteThrottleState {
  return { entries: {} };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('alerts/siteThrottle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- extractSiteKey ---- */

  describe('extractSiteKey', () => {
    it('strips severity from deployment per-param key', () => {
      expect(extractSiteKey('deployment:ID123:Dissolved Oxygen:critical')).toBe(
        'deployment:ID123:Dissolved Oxygen',
      );
    });

    it('normalises deployment classification key', () => {
      expect(extractSiteKey('deployment:ID123:classification:hypothesis:stage')).toBe(
        'deployment:ID123:classification',
      );
    });

    it('returns short deployment key as-is', () => {
      expect(extractSiteKey('deployment:ID123')).toBe('deployment:ID123');
    });

    it('strips severity and stage from usgs-iv key', () => {
      expect(extractSiteKey('usgs-iv-12345-00060-critical:escalation')).toBe(
        'usgs-iv-12345-00060',
      );
    });

    it('returns usgs-iv key with no severity as-is', () => {
      expect(extractSiteKey('usgs-iv-12345-00060')).toBe('usgs-iv-12345-00060');
    });

    it('strips stage from sentinel key', () => {
      expect(extractSiteKey('sentinel:HUC123:watch:critical')).toBe('sentinel:HUC123');
    });

    it('strips severity from nwss key', () => {
      expect(extractSiteKey('nwss:SEW1:SARS:warning')).toBe('nwss:SEW1:SARS');
    });

    it('strips severity from fusion key', () => {
      expect(extractSiteKey('fusion|PATTERN1|CA|critical')).toBe('fusion|PATTERN1|CA');
    });

    it('strips severity from beacon key', () => {
      expect(extractSiteKey('beacon:BEACH1:ECOLI:warning')).toBe('beacon:BEACH1:ECOLI');
    });

    it('strips severity from hab key', () => {
      expect(extractSiteKey('hab:FL:Karenia:critical')).toBe('hab:FL:Karenia');
    });

    it('strips severity from delta key', () => {
      expect(extractSiteKey('delta:USGS:Turbidity:warning')).toBe('delta:USGS:Turbidity');
    });

    it('strips severity from custom key', () => {
      expect(extractSiteKey('custom:RULE42:info')).toBe('custom:RULE42');
    });

    it('strips severity from attains key', () => {
      expect(extractSiteKey('attains:CA:Cat5:critical')).toBe('attains:CA:Cat5');
    });

    it('strips time-bin from coordination key', () => {
      expect(extractSiteKey('coordination-HUC6AB-202501')).toBe('coordination-HUC6AB');
    });

    it('returns flood-forecast key as-is', () => {
      expect(extractSiteKey('flood-forecast-LID123-moderate')).toBe(
        'flood-forecast-LID123-moderate',
      );
    });

    it('returns unrecognised key as-is', () => {
      expect(extractSiteKey('totally-unknown-key')).toBe('totally-unknown-key');
    });
  });

  /* ---- updateSiteBreaches ---- */

  describe('updateSiteBreaches', () => {
    it('creates a new entry for unseen siteKey', () => {
      const state = emptyState();
      const candidates = [makeCandidate('sentinel:HUC1:watch:critical')];
      updateSiteBreaches(candidates, state);

      const entry = state.entries['sentinel:HUC1'];
      expect(entry).toBeDefined();
      expect(entry.consecutiveBreaches).toBe(1);
      expect(entry.lastFiredAt).toBeNull();
    });

    it('increments consecutiveBreaches for existing siteKey', () => {
      const state: SiteThrottleState = {
        entries: {
          'sentinel:HUC1': {
            lastFiredAt: null,
            consecutiveBreaches: 3,
            lastSeenAt: new Date().toISOString(),
          },
        },
      };
      const candidates = [makeCandidate('sentinel:HUC1:watch:warning')];
      updateSiteBreaches(candidates, state);

      expect(state.entries['sentinel:HUC1'].consecutiveBreaches).toBe(4);
    });

    it('resets absent entries past the recovery gap', () => {
      const oldDate = new Date(Date.now() - 15 * 60_000).toISOString(); // 15 min ago (> 10 min RECOVERY_GAP_MS)
      const state: SiteThrottleState = {
        entries: {
          'sentinel:HUC_OLD': {
            lastFiredAt: '2025-01-01T00:00:00Z',
            consecutiveBreaches: 5,
            lastSeenAt: oldDate,
          },
        },
      };
      // Pass an unrelated candidate so HUC_OLD is absent
      updateSiteBreaches([makeCandidate('sentinel:HUC_NEW:watch:info')], state);

      expect(state.entries['sentinel:HUC_OLD'].consecutiveBreaches).toBe(0);
      expect(state.entries['sentinel:HUC_OLD'].lastFiredAt).toBeNull();
    });

    it('does NOT reset absent entries within recovery gap', () => {
      const recentDate = new Date(Date.now() - 5 * 60_000).toISOString(); // 5 min ago (< 10 min)
      const state: SiteThrottleState = {
        entries: {
          'sentinel:HUC_RECENT': {
            lastFiredAt: '2025-01-01T00:00:00Z',
            consecutiveBreaches: 3,
            lastSeenAt: recentDate,
          },
        },
      };
      updateSiteBreaches([makeCandidate('sentinel:HUC_OTHER:watch:info')], state);

      expect(state.entries['sentinel:HUC_RECENT'].consecutiveBreaches).toBe(3);
      expect(state.entries['sentinel:HUC_RECENT'].lastFiredAt).toBe('2025-01-01T00:00:00Z');
    });

    it('deduplicates multiple candidates for the same siteKey (only increments once)', () => {
      const state = emptyState();
      const candidates = [
        makeCandidate('sentinel:HUC1:watch:critical'),
        makeCandidate('sentinel:HUC1:advisory:warning'),
      ];
      updateSiteBreaches(candidates, state);

      // Both map to sentinel:HUC1 — should only be counted once via Set
      expect(state.entries['sentinel:HUC1'].consecutiveBreaches).toBe(1);
    });
  });

  /* ---- shouldThrottle ---- */

  describe('shouldThrottle', () => {
    it('returns false when siteKey has no entry', () => {
      expect(shouldThrottle('unknown:key', 'warning', emptyState())).toBe(false);
    });

    it('throttles critical severity below persistence threshold', () => {
      const state: SiteThrottleState = {
        entries: {
          'sentinel:HUC1': {
            lastFiredAt: null,
            consecutiveBreaches: 1, // < CRITICAL_PERSISTENCE_THRESHOLD (2)
            lastSeenAt: new Date().toISOString(),
          },
        },
      };
      expect(shouldThrottle('sentinel:HUC1', 'critical', state)).toBe(true);
    });

    it('does NOT throttle critical at or above persistence threshold', () => {
      const state: SiteThrottleState = {
        entries: {
          'sentinel:HUC1': {
            lastFiredAt: null,
            consecutiveBreaches: 2, // == CRITICAL_PERSISTENCE_THRESHOLD
            lastSeenAt: new Date().toISOString(),
          },
        },
      };
      expect(shouldThrottle('sentinel:HUC1', 'critical', state)).toBe(false);
    });

    it('throttles when site was fired within cooldown window', () => {
      const state: SiteThrottleState = {
        entries: {
          'sentinel:HUC1': {
            lastFiredAt: new Date(Date.now() - 60_000).toISOString(), // 1 min ago (< 4h SITE_COOLDOWN_MS)
            consecutiveBreaches: 5,
            lastSeenAt: new Date().toISOString(),
          },
        },
      };
      expect(shouldThrottle('sentinel:HUC1', 'warning', state)).toBe(true);
    });

    it('does NOT throttle when site cooldown has expired', () => {
      const state: SiteThrottleState = {
        entries: {
          'sentinel:HUC1': {
            lastFiredAt: new Date(Date.now() - 5 * 60 * 60_000).toISOString(), // 5h ago (> 4h)
            consecutiveBreaches: 5,
            lastSeenAt: new Date().toISOString(),
          },
        },
      };
      expect(shouldThrottle('sentinel:HUC1', 'warning', state)).toBe(false);
    });

    it('does NOT throttle warning/info severity with low consecutive breaches (no persistence gate)', () => {
      const state: SiteThrottleState = {
        entries: {
          'sentinel:HUC1': {
            lastFiredAt: null,
            consecutiveBreaches: 1,
            lastSeenAt: new Date().toISOString(),
          },
        },
      };
      expect(shouldThrottle('sentinel:HUC1', 'warning', state)).toBe(false);
      expect(shouldThrottle('sentinel:HUC1', 'info', state)).toBe(false);
    });
  });

  /* ---- markSiteFired ---- */

  describe('markSiteFired', () => {
    it('sets lastFiredAt on existing entry', () => {
      const state: SiteThrottleState = {
        entries: {
          'sentinel:HUC1': {
            lastFiredAt: null,
            consecutiveBreaches: 2,
            lastSeenAt: new Date().toISOString(),
          },
        },
      };
      markSiteFired('sentinel:HUC1', state);
      expect(state.entries['sentinel:HUC1'].lastFiredAt).not.toBeNull();
    });

    it('does nothing for non-existent siteKey (no crash)', () => {
      const state = emptyState();
      expect(() => markSiteFired('missing:key', state)).not.toThrow();
    });
  });

  /* ---- purgeStaleSiteEntries ---- */

  describe('purgeStaleSiteEntries', () => {
    it('removes entries older than 24 hours', () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60_000).toISOString(); // 25h ago
      const state: SiteThrottleState = {
        entries: {
          'stale:site': {
            lastFiredAt: null,
            consecutiveBreaches: 1,
            lastSeenAt: oldDate,
          },
          'fresh:site': {
            lastFiredAt: null,
            consecutiveBreaches: 1,
            lastSeenAt: new Date().toISOString(),
          },
        },
      };
      purgeStaleSiteEntries(state);
      expect(state.entries['stale:site']).toBeUndefined();
      expect(state.entries['fresh:site']).toBeDefined();
    });

    it('keeps all entries when none are stale', () => {
      const state: SiteThrottleState = {
        entries: {
          'a:site': { lastFiredAt: null, consecutiveBreaches: 1, lastSeenAt: new Date().toISOString() },
          'b:site': { lastFiredAt: null, consecutiveBreaches: 1, lastSeenAt: new Date().toISOString() },
        },
      };
      purgeStaleSiteEntries(state);
      expect(Object.keys(state.entries)).toHaveLength(2);
    });

    it('handles empty state without error', () => {
      const state = emptyState();
      expect(() => purgeStaleSiteEntries(state)).not.toThrow();
    });
  });

  /* ---- Blob persistence wrappers ---- */

  describe('loadSiteThrottleState', () => {
    it('returns empty state when blob returns null', async () => {
      vi.mocked(loadCacheFromBlob).mockResolvedValueOnce(null);
      const state = await loadSiteThrottleState();
      expect(state.entries).toEqual({});
    });

    it('returns blob data when valid', async () => {
      const blobData: SiteThrottleState = {
        entries: { 'sentinel:HUC1': { lastFiredAt: null, consecutiveBreaches: 3, lastSeenAt: '2025-01-01T00:00:00Z' } },
      };
      vi.mocked(loadCacheFromBlob).mockResolvedValueOnce(blobData);
      const state = await loadSiteThrottleState();
      expect(state.entries['sentinel:HUC1'].consecutiveBreaches).toBe(3);
    });
  });

  describe('saveSiteThrottleState', () => {
    it('delegates to saveCacheToBlob', async () => {
      const state: SiteThrottleState = { entries: {} };
      await saveSiteThrottleState(state);
      expect(saveCacheToBlob).toHaveBeenCalledWith('alerts/site-throttle.json', state);
    });
  });
});
