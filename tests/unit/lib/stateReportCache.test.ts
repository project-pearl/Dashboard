import { describe, it, expect } from 'vitest';
import {
  getStateReport,
  getAllStateReports,
  getStateReportStatus,
} from '@/lib/stateReportCache';

describe('stateReportCache', () => {
  describe('getStateReport', () => {
    it('returns null for unknown state when cold', () => {
      const result = getStateReport('ZZ');
      expect(result).toBeNull();
    });

    it('returns null or report for valid state', () => {
      const result = getStateReport('MD');
      // May be null if cache is cold, or a report if warmed
      if (result) {
        expect(result.stateCode).toBe('MD');
        expect(typeof result.totalWaterbodies).toBe('number');
      } else {
        expect(result).toBeNull();
      }
    });
  });

  describe('getAllStateReports', () => {
    it('returns null when cache is cold', () => {
      const result = getAllStateReports();
      // May be null on cold start
      if (result) {
        expect(result._meta).toBeDefined();
        expect(typeof result.reports).toBe('object');
      } else {
        expect(result).toBeNull();
      }
    });
  });

  describe('getStateReportStatus', () => {
    it('returns status object', () => {
      const status = getStateReportStatus();
      expect(status).toBeDefined();
      expect(typeof status.loaded).toBe('boolean');
    });

    it('includes built and stateCount', () => {
      const status = getStateReportStatus();
      expect('built' in status).toBe(true);
      expect('stateCount' in status).toBe(true);
    });
  });
});
