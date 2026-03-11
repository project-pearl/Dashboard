import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks — top-level only                                            */
/* ------------------------------------------------------------------ */

vi.mock('@/lib/blobPersistence', () => ({
  saveCacheToBlob: vi.fn(async () => {}),
  loadCacheFromBlob: vi.fn(async () => null),
}));

vi.mock('@/lib/cacheUtils', () => ({
  loadCacheFromDisk: vi.fn(() => null),
  saveCacheToDisk: vi.fn(),
}));

vi.mock('@/lib/alerts/recipients', () => ({
  loadRecipients: vi.fn(async () => []),
  getRecipientsForAlert: vi.fn(() => []),
}));

vi.mock('@/lib/alerts/suppressions', () => ({
  loadSuppressions: vi.fn(async () => []),
  isSuppressed: vi.fn(() => false),
}));

vi.mock('@/lib/alerts/siteThrottle', () => ({
  loadSiteThrottleState: vi.fn(async () => ({ entries: {} })),
  saveSiteThrottleState: vi.fn(async () => {}),
  updateSiteBreaches: vi.fn(),
  extractSiteKey: vi.fn((key: string) => key),
  shouldThrottle: vi.fn(() => false),
  markSiteFired: vi.fn(),
  purgeStaleSiteEntries: vi.fn(),
}));

vi.mock('@/lib/alerts/channels/email', () => ({
  sendAlertEmail: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/alerts/enrichment', () => ({
  enrichAlertPayload: vi.fn(() => null),
}));

import { getRecipientsForAlert } from '@/lib/alerts/recipients';
import { isSuppressed } from '@/lib/alerts/suppressions';
import { shouldThrottle, markSiteFired } from '@/lib/alerts/siteThrottle';
import { sendAlertEmail } from '@/lib/alerts/channels/email';
import type { AlertEvent, AlertRecipient } from '@/lib/alerts/types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let _testSeq = 0;

/** Creates a candidate with a unique dedupKey to avoid cross-test cooldown collisions */
function makeCandidate(overrides: Partial<AlertEvent> = {}): AlertEvent {
  _testSeq++;
  return {
    id: overrides.id ?? `cand-${_testSeq}`,
    type: overrides.type ?? 'sentinel',
    severity: overrides.severity ?? 'warning',
    title: 'Test alert',
    body: 'Alert body',
    entityId: 'HUC123',
    entityLabel: 'Test HUC',
    dedupKey: overrides.dedupKey ?? `sentinel:HUC${_testSeq}:watch:${overrides.severity ?? 'warning'}`,
    createdAt: new Date().toISOString(),
    channel: 'email',
    recipientEmail: '',
    sent: false,
    sentAt: null,
    error: null,
    ruleId: null,
    metadata: {},
    ...overrides,
  };
}

function makeRecipient(overrides: Partial<AlertRecipient> = {}): AlertRecipient {
  return {
    email: overrides.email ?? 'test@example.com',
    name: 'Test User',
    role: 'admin',
    state: null,
    triggers: ['sentinel'],
    severities: ['warning', 'critical'],
    active: true,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('alerts/engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default return values after clearAllMocks
    vi.mocked(isSuppressed).mockReturnValue(false);
    vi.mocked(shouldThrottle).mockReturnValue(false);
    vi.mocked(getRecipientsForAlert).mockReturnValue([]);
    vi.mocked(sendAlertEmail).mockResolvedValue({ success: true });
  });

  // loadAlertLog must be tested FIRST before dispatchAlerts mutates _log
  describe('loadAlertLog', () => {
    it('returns a log with expected structure', async () => {
      // Dynamic import so we get it fresh before any dispatch calls
      const { loadAlertLog } = await import('@/lib/alerts/engine');
      const log = await loadAlertLog();
      expect(log).toHaveProperty('events');
      expect(log).toHaveProperty('totalSent');
      expect(log).toHaveProperty('totalSuppressed');
      expect(log).toHaveProperty('totalThrottled');
      expect(log).toHaveProperty('totalErrors');
      expect(log).toHaveProperty('totalLogged');
      expect(log).toHaveProperty('lastDispatchAt');
    });
  });

  describe('dispatchAlerts', () => {
    it('returns zero counts when given an empty candidate list', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      const result = await dispatchAlerts([]);
      expect(result.sent).toBe(0);
      expect(result.suppressed).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.rateLimited).toBe(0);
      expect(result.throttled).toBe(0);
      expect(result.logged).toBe(0);
    });

    it('dispatches successfully to a matching recipient', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      const recipient = makeRecipient();
      vi.mocked(getRecipientsForAlert).mockReturnValue([recipient]);
      vi.mocked(sendAlertEmail).mockResolvedValue({ success: true });

      const result = await dispatchAlerts([makeCandidate()]);

      expect(result.sent).toBe(1);
      expect(sendAlertEmail).toHaveBeenCalledTimes(1);
      expect(markSiteFired).toHaveBeenCalled();
    });

    it('skips candidates when suppressed', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      vi.mocked(isSuppressed).mockReturnValue(true);

      const result = await dispatchAlerts([makeCandidate()]);

      expect(result.suppressed).toBe(1);
      expect(result.sent).toBe(0);
      expect(sendAlertEmail).not.toHaveBeenCalled();
    });

    it('skips candidates when site-level throttle fires', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      vi.mocked(shouldThrottle).mockReturnValue(true);

      const result = await dispatchAlerts([makeCandidate()]);

      expect(result.throttled).toBe(1);
      expect(result.sent).toBe(0);
      expect(sendAlertEmail).not.toHaveBeenCalled();
    });

    it('skips candidates with no matching recipients', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      vi.mocked(getRecipientsForAlert).mockReturnValue([]);

      const result = await dispatchAlerts([makeCandidate()]);

      expect(result.sent).toBe(0);
      expect(sendAlertEmail).not.toHaveBeenCalled();
    });

    it('counts errors when email send fails', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      const recipient = makeRecipient();
      vi.mocked(getRecipientsForAlert).mockReturnValue([recipient]);
      vi.mocked(sendAlertEmail).mockResolvedValue({ success: false, error: 'SMTP down' });

      const result = await dispatchAlerts([makeCandidate()]);

      expect(result.errors).toBe(1);
      expect(result.sent).toBe(0);
      expect(markSiteFired).not.toHaveBeenCalled();
    });

    it('logs alerts in LOG_ONLY mode (logOnly: true)', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      const recipient = makeRecipient();
      vi.mocked(getRecipientsForAlert).mockReturnValue([recipient]);
      vi.mocked(sendAlertEmail).mockResolvedValue({ success: false, logOnly: true });

      const result = await dispatchAlerts([makeCandidate()]);

      expect(result.logged).toBe(1);
      expect(result.sent).toBe(0);
      // markSiteFired IS called because candidateDispatched = true for logOnly
      expect(markSiteFired).toHaveBeenCalled();
    });

    it('dispatches to multiple recipients for the same candidate', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      const r1 = makeRecipient({ email: 'a@test.com' });
      const r2 = makeRecipient({ email: 'b@test.com' });
      vi.mocked(getRecipientsForAlert).mockReturnValue([r1, r2]);
      vi.mocked(sendAlertEmail).mockResolvedValue({ success: true });

      const result = await dispatchAlerts([makeCandidate()]);

      expect(result.sent).toBe(2);
      expect(sendAlertEmail).toHaveBeenCalledTimes(2);
    });

    it('processes multiple candidates independently', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      const recipient = makeRecipient();
      vi.mocked(getRecipientsForAlert).mockReturnValue([recipient]);
      vi.mocked(sendAlertEmail).mockResolvedValue({ success: true });

      const candidates = [
        makeCandidate(),
        makeCandidate(),
        makeCandidate(),
      ];

      const result = await dispatchAlerts(candidates);

      expect(result.sent).toBe(3);
      expect(sendAlertEmail).toHaveBeenCalledTimes(3);
    });

    it('handles enrichment errors gracefully (best-effort)', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      const { enrichAlertPayload } = await import('@/lib/alerts/enrichment');
      const recipient = makeRecipient();
      vi.mocked(getRecipientsForAlert).mockReturnValue([recipient]);
      vi.mocked(sendAlertEmail).mockResolvedValue({ success: true });
      vi.mocked(enrichAlertPayload).mockImplementation(() => { throw new Error('enrichment failed'); });

      // sentinel type triggers enrichment — should not block dispatch
      const result = await dispatchAlerts([makeCandidate({ type: 'sentinel' })]);

      expect(result.sent).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('calls updateSiteBreaches at the start of dispatch', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      const { updateSiteBreaches } = await import('@/lib/alerts/siteThrottle');

      await dispatchAlerts([makeCandidate()]);

      expect(updateSiteBreaches).toHaveBeenCalledTimes(1);
    });

    it('calls purgeStaleSiteEntries after dispatch completes', async () => {
      const { dispatchAlerts } = await import('@/lib/alerts/engine');
      const { purgeStaleSiteEntries } = await import('@/lib/alerts/siteThrottle');

      await dispatchAlerts([makeCandidate()]);

      expect(purgeStaleSiteEntries).toHaveBeenCalledTimes(1);
    });
  });
});
