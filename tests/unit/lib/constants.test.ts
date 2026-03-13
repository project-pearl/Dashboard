import { describe, it, expect } from 'vitest';
import {
  ALL_STATES,
  PRIORITY_STATES,
  ALL_STATES_WITH_FIPS,
  PRIORITY_STATES_WITH_FIPS,
  NUTRIENT_TRADING_STATES,
  WQT_PROGRAM_INFO,
} from '@/lib/constants';

describe('constants', () => {
  /* ------------------------------------------------------------------ */
  /*  ALL_STATES                                                         */
  /* ------------------------------------------------------------------ */

  describe('ALL_STATES', () => {
    it('has exactly 51 entries (50 states + DC)', () => {
      expect(ALL_STATES).toHaveLength(51);
    });

    it('contains no duplicates', () => {
      const unique = new Set(ALL_STATES);
      expect(unique.size).toBe(ALL_STATES.length);
    });

    it('includes DC', () => {
      expect(ALL_STATES).toContain('DC');
    });

    it('includes all four corners states', () => {
      for (const st of ['AZ', 'NM', 'CO', 'UT']) {
        expect(ALL_STATES).toContain(st);
      }
    });

    it('contains only 2-letter uppercase codes', () => {
      for (const st of ALL_STATES) {
        expect(st).toMatch(/^[A-Z]{2}$/);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  PRIORITY_STATES                                                    */
  /* ------------------------------------------------------------------ */

  describe('PRIORITY_STATES', () => {
    it('has exactly 19 entries', () => {
      expect(PRIORITY_STATES).toHaveLength(19);
    });

    it('is a subset of ALL_STATES', () => {
      const allSet = new Set(ALL_STATES);
      for (const st of PRIORITY_STATES) {
        expect(allSet.has(st)).toBe(true);
      }
    });

    it('contains no duplicates', () => {
      const unique = new Set(PRIORITY_STATES);
      expect(unique.size).toBe(PRIORITY_STATES.length);
    });

    it('includes the Chesapeake Bay states', () => {
      for (const st of ['MD', 'VA', 'DC', 'PA', 'DE', 'WV']) {
        expect(PRIORITY_STATES).toContain(st);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  FIPS alignment                                                     */
  /* ------------------------------------------------------------------ */

  describe('FIPS alignment', () => {
    it('ALL_STATES_WITH_FIPS has same length as ALL_STATES', () => {
      expect(ALL_STATES_WITH_FIPS).toHaveLength(ALL_STATES.length);
    });

    it('PRIORITY_STATES_WITH_FIPS has same length as PRIORITY_STATES', () => {
      expect(PRIORITY_STATES_WITH_FIPS).toHaveLength(PRIORITY_STATES.length);
    });

    it('every PRIORITY_STATES_WITH_FIPS entry has a matching FIPS in ALL_STATES_WITH_FIPS', () => {
      const allFipsMap = new Map(ALL_STATES_WITH_FIPS);
      for (const [state, fips] of PRIORITY_STATES_WITH_FIPS) {
        expect(allFipsMap.has(state)).toBe(true);
        expect(allFipsMap.get(state)).toBe(fips);
      }
    });

    it('FIPS codes are 2-digit zero-padded strings', () => {
      for (const [, fips] of ALL_STATES_WITH_FIPS) {
        expect(fips).toMatch(/^\d{2}$/);
      }
    });

    it('all FIPS codes are unique', () => {
      const fipsCodes = ALL_STATES_WITH_FIPS.map(([, fips]) => fips);
      const unique = new Set(fipsCodes);
      expect(unique.size).toBe(fipsCodes.length);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  NUTRIENT_TRADING_STATES                                            */
  /* ------------------------------------------------------------------ */

  describe('NUTRIENT_TRADING_STATES', () => {
    it('contains MD, VA, and PA', () => {
      expect(NUTRIENT_TRADING_STATES.has('MD')).toBe(true);
      expect(NUTRIENT_TRADING_STATES.has('VA')).toBe(true);
      expect(NUTRIENT_TRADING_STATES.has('PA')).toBe(true);
    });

    it('does not contain non-trading states', () => {
      // States with no known nutrient trading programs
      expect(NUTRIENT_TRADING_STATES.has('AK')).toBe(false);
      expect(NUTRIENT_TRADING_STATES.has('HI')).toBe(false);
      expect(NUTRIENT_TRADING_STATES.has('WY')).toBe(false);
    });

    it('is a subset of ALL_STATES', () => {
      const allSet = new Set<string>(ALL_STATES);
      for (const st of NUTRIENT_TRADING_STATES) {
        expect(allSet.has(st)).toBe(true);
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /*  WQT_PROGRAM_INFO                                                   */
  /* ------------------------------------------------------------------ */

  describe('WQT_PROGRAM_INFO', () => {
    it('has entries for every member of NUTRIENT_TRADING_STATES', () => {
      for (const st of NUTRIENT_TRADING_STATES) {
        expect(WQT_PROGRAM_INFO[st]).toBeDefined();
      }
    });

    it('each entry has required fields', () => {
      for (const st of NUTRIENT_TRADING_STATES) {
        const info = WQT_PROGRAM_INFO[st];
        expect(info.name).toBeTruthy();
        expect(info.agency).toBeTruthy();
        expect(info.agencyAbbr).toBeTruthy();
        expect(info.url).toMatch(/^https?:\/\//);
        expect(info.sectors.length).toBeGreaterThan(0);
        expect(info.nutrients.length).toBeGreaterThan(0);
        expect(['active', 'emerging']).toContain(info.maturity);
      }
    });

    it('does not have entries for non-trading states', () => {
      expect(WQT_PROGRAM_INFO['AK']).toBeUndefined();
      expect(WQT_PROGRAM_INFO['HI']).toBeUndefined();
    });

    it('MD program info has correct agency abbreviation', () => {
      expect(WQT_PROGRAM_INFO['MD'].agencyAbbr).toBe('MDE');
    });
  });
});
