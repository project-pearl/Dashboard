import { describe, it, expect } from 'vitest';
import {
  recordCronRun,
  getCronHealthSummary,
  getCronHistory,
} from '@/lib/cronHealth';

describe('cronHealth', () => {
  describe('recordCronRun', () => {
    it('records a successful run', () => {
      recordCronRun('test-cron', 'success', 5000);
      const history = getCronHistory();
      expect(history['test-cron']).toBeDefined();
      expect(history['test-cron'].length).toBeGreaterThanOrEqual(1);
    });

    it('records an error run', () => {
      recordCronRun('error-cron', 'error', 1000, 'Timeout');
      const history = getCronHistory();
      const runs = history['error-cron'];
      expect(runs).toBeDefined();
      const last = runs[runs.length - 1];
      expect(last.status).toBe('error');
      expect(last.error).toBe('Timeout');
    });

    it('truncates error messages to 500 chars', () => {
      const longError = 'x'.repeat(1000);
      recordCronRun('long-error-cron', 'error', 500, longError);
      const history = getCronHistory();
      const runs = history['long-error-cron'];
      const last = runs[runs.length - 1];
      expect(last.error!.length).toBeLessThanOrEqual(500);
    });

    it('includes timestamp on recorded runs', () => {
      recordCronRun('ts-cron', 'success', 100);
      const history = getCronHistory();
      const last = history['ts-cron'][history['ts-cron'].length - 1];
      expect(last.timestamp).toBeDefined();
      expect(new Date(last.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('getCronHealthSummary', () => {
    it('returns summary object', () => {
      recordCronRun('summary-cron', 'success', 2000);
      const summary = getCronHealthSummary();
      expect(summary['summary-cron']).toBeDefined();
    });

    it('computes success rate', () => {
      recordCronRun('rate-cron', 'success', 1000);
      recordCronRun('rate-cron', 'success', 1000);
      recordCronRun('rate-cron', 'error', 1000);
      const summary = getCronHealthSummary();
      const s = summary['rate-cron'];
      expect(s.successRate24h).toBeGreaterThan(0);
      expect(s.totalRuns24h).toBeGreaterThanOrEqual(3);
    });

    it('tracks last run info', () => {
      recordCronRun('last-cron', 'success', 3000);
      const summary = getCronHealthSummary();
      expect(summary['last-cron'].lastRun).not.toBeNull();
      expect(summary['last-cron'].lastStatus).toBe('success');
    });

    it('computes average duration', () => {
      recordCronRun('avg-cron', 'success', 2000);
      recordCronRun('avg-cron', 'success', 4000);
      const summary = getCronHealthSummary();
      expect(summary['avg-cron'].avgDurationMs).toBeGreaterThanOrEqual(2000);
    });
  });

  describe('getCronHistory', () => {
    it('returns plain object (not Map)', () => {
      recordCronRun('obj-cron', 'success', 500);
      const history = getCronHistory();
      expect(typeof history).toBe('object');
      expect(history).not.toBeNull();
      expect(Array.isArray(history['obj-cron'])).toBe(true);
    });

    it('maintains ring buffer (max 50 entries per cron)', () => {
      const name = 'ring-cron';
      for (let i = 0; i < 55; i++) {
        recordCronRun(name, 'success', 100);
      }
      const history = getCronHistory();
      expect(history[name].length).toBeLessThanOrEqual(50);
    });
  });
});
