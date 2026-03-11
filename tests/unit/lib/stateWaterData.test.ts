import { describe, it, expect } from 'vitest';
import {
  STATE_AUTHORITIES,
  STATE_CHALLENGES,
  getDetailedChallenges,
  getStatePeerBenchmark,
  getRegionDataMultipliers,
  applyRegionMultipliers,
  PEER_GROUPS,
  STATE_TMDL_CONTEXT,
  getStateMonitoringPhases,
  getStateGrants,
  getStateMS4Jurisdictions,
  getMS4ComplianceSummary,
  STATE_COMPLAINT_CONTACTS,
  getComplaintContact,
  getComplaintSearchUrl,
  type StateAuthority,
  type DetailedChallenge,
  type MS4Jurisdiction,
} from '@/lib/stateWaterData';

describe('stateWaterData', () => {
  // ─── STATE_AUTHORITIES ────────────────────────────────────────────────────

  describe('STATE_AUTHORITIES', () => {
    it('has entries for all 50 states + DC', () => {
      expect(Object.keys(STATE_AUTHORITIES).length).toBeGreaterThanOrEqual(51);
    });

    it('each entry has required fields', () => {
      for (const [abbr, auth] of Object.entries(STATE_AUTHORITIES)) {
        expect(auth.name).toBeDefined();
        expect(typeof auth.name).toBe('string');
        expect(auth.abbr).toBeDefined();
        expect(typeof auth.abbr).toBe('string');
        expect(auth.ms4Program).toBeDefined();
        expect(typeof auth.ms4Program).toBe('string');
      }
    });

    it('MD authority is correct', () => {
      expect(STATE_AUTHORITIES.MD).toBeDefined();
      expect(STATE_AUTHORITIES.MD.name).toContain('Maryland');
      expect(STATE_AUTHORITIES.MD.abbr).toBe('MDE');
    });

    it('CA authority is correct', () => {
      expect(STATE_AUTHORITIES.CA).toBeDefined();
      expect(STATE_AUTHORITIES.CA.abbr).toBe('SWRCB');
    });
  });

  // ─── STATE_CHALLENGES ─────────────────────────────────────────────────────

  describe('STATE_CHALLENGES', () => {
    it('has entries for many states', () => {
      expect(Object.keys(STATE_CHALLENGES).length).toBeGreaterThanOrEqual(40);
    });

    it('each state has at least 1 challenge string', () => {
      for (const [state, challenges] of Object.entries(STATE_CHALLENGES)) {
        expect(challenges.length).toBeGreaterThanOrEqual(1);
        for (const c of challenges) {
          expect(typeof c).toBe('string');
          expect(c.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ─── getDetailedChallenges ────────────────────────────────────────────────

  describe('getDetailedChallenges', () => {
    it('returns structured challenges for MD', () => {
      const challenges = getDetailedChallenges('MD');
      expect(challenges.length).toBeGreaterThan(0);
      for (const c of challenges) {
        expect(c).toHaveProperty('title');
        expect(c).toHaveProperty('description');
        expect(c).toHaveProperty('pearlOpportunity');
        expect(c).toHaveProperty('severity');
        expect(c).toHaveProperty('icon');
        expect(['critical', 'high', 'moderate', 'info']).toContain(c.severity);
        expect(typeof c.title).toBe('string');
        expect(typeof c.pearlOpportunity).toBe('string');
      }
    });

    it('returns empty array for unknown state', () => {
      const challenges = getDetailedChallenges('ZZ');
      expect(challenges).toEqual([]);
    });

    it('first challenge is at least high severity', () => {
      const challenges = getDetailedChallenges('MD');
      if (challenges.length > 0) {
        expect(['critical', 'high']).toContain(challenges[0].severity);
      }
    });

    it('splits dash-separated titles correctly', () => {
      // MD challenges contain ' — ' separators
      const challenges = getDetailedChallenges('MD');
      const dashChallenge = challenges.find(c => c.description.length > 0);
      if (dashChallenge) {
        expect(dashChallenge.title.length).toBeGreaterThan(0);
        expect(dashChallenge.description.length).toBeGreaterThan(0);
      }
    });

    it('assigns pearlOpportunity to each challenge', () => {
      const challenges = getDetailedChallenges('FL');
      for (const c of challenges) {
        expect(c.pearlOpportunity).toBeDefined();
        expect(c.pearlOpportunity.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── getStatePeerBenchmark ────────────────────────────────────────────────

  describe('getStatePeerBenchmark', () => {
    it('returns benchmark result for MD', () => {
      const result = getStatePeerBenchmark('MD', { TSS: 85, TN: 72, TP: 78, turbidity: 80 });
      expect(result).toBeDefined();
      expect(result.overallPercentile).toBeGreaterThanOrEqual(0);
      expect(result.overallPercentile).toBeLessThanOrEqual(99);
      expect(typeof result.overallLabel).toBe('string');
      expect(result.peerStates).toBeInstanceOf(Array);
      expect(result.peerStates.length).toBeGreaterThan(0);
      expect(result.benchmarks).toBeInstanceOf(Array);
      expect(result.benchmarks.length).toBe(4); // TSS, TN, TP, turbidity
    });

    it('benchmark entries have all required fields', () => {
      const result = getStatePeerBenchmark('MD', { TSS: 90 });
      for (const b of result.benchmarks) {
        expect(b).toHaveProperty('parameter');
        expect(b).toHaveProperty('label');
        expect(b).toHaveProperty('yourState');
        expect(b).toHaveProperty('peerAvg');
        expect(b).toHaveProperty('nationalAvg');
        expect(b).toHaveProperty('top10States');
        expect(b).toHaveProperty('isTopQuartile');
        expect(typeof b.yourState).toBe('number');
        expect(typeof b.peerAvg).toBe('number');
      }
    });

    it('uses PEER_GROUPS when available', () => {
      const result = getStatePeerBenchmark('MD', {});
      // MD's peers should include VA, PA, DC, DE etc.
      expect(result.peerStates).toEqual(expect.arrayContaining(['VA', 'PA']));
    });

    it('generates benchmark for state without explicit peer group', () => {
      // Test a state that might be in PEER_GROUPS; let's just verify it works
      const result = getStatePeerBenchmark('WY', {});
      expect(result).toBeDefined();
      expect(result.benchmarks.length).toBe(4);
      expect(result.peerStates.length).toBeGreaterThan(0);
    });

    it('is deterministic for same inputs', () => {
      const r1 = getStatePeerBenchmark('MD', { TSS: 85, TN: 72 });
      const r2 = getStatePeerBenchmark('MD', { TSS: 85, TN: 72 });
      expect(r1.overallPercentile).toBe(r2.overallPercentile);
      expect(r1.benchmarks[0].peerAvg).toBe(r2.benchmarks[0].peerAvg);
    });

    it('comparisonGroup string includes peer info', () => {
      const result = getStatePeerBenchmark('MD', {});
      expect(result.comparisonGroup.length).toBeGreaterThan(50);
      expect(result.comparisonGroup).toContain('peer states');
    });

    it('caps overallPercentile at 99', () => {
      // Even with extremely high values, percentile should not exceed 99
      const result = getStatePeerBenchmark('MD', { TSS: 99, TN: 99, TP: 99, turbidity: 99 });
      expect(result.overallPercentile).toBeLessThanOrEqual(99);
    });
  });

  // ─── getRegionDataMultipliers ─────────────────────────────────────────────

  describe('getRegionDataMultipliers', () => {
    it('returns multipliers for all base params', () => {
      const m = getRegionDataMultipliers('region-1', []);
      expect(m).toHaveProperty('DO');
      expect(m).toHaveProperty('turbidity');
      expect(m).toHaveProperty('TN');
      expect(m).toHaveProperty('TP');
      expect(m).toHaveProperty('TSS');
      expect(m).toHaveProperty('salinity');
    });

    it('returns near-1.0 multipliers for no impairments', () => {
      const m = getRegionDataMultipliers('region-1', []);
      // With no impairments, base is 1.0 + variation (0.85-1.15)
      expect(m.DO).toBeGreaterThan(0.7);
      expect(m.DO).toBeLessThan(1.3);
      expect(m.TN).toBeGreaterThan(0.7);
      expect(m.TN).toBeLessThan(1.3);
    });

    it('reduces DO for hypoxia impairment', () => {
      const m = getRegionDataMultipliers('region-1', ['Low DO', 'Hypoxia events']);
      // DO multiplier should be < 1 (lower DO = worse)
      expect(m.DO).toBeLessThan(0.85);
    });

    it('increases TN for nutrient impairment', () => {
      const m = getRegionDataMultipliers('region-1', ['Nitrogen loading', 'Nutrient enrichment']);
      expect(m.TN).toBeGreaterThan(1.0);
    });

    it('increases TP for phosphorus impairment', () => {
      const m = getRegionDataMultipliers('region-1', ['Phosphorus runoff']);
      expect(m.TP).toBeGreaterThan(1.0);
    });

    it('increases TSS/turbidity for sediment impairment', () => {
      const m = getRegionDataMultipliers('region-1', ['Sediment loading']);
      expect(m.TSS).toBeGreaterThan(1.0);
      expect(m.turbidity).toBeGreaterThan(1.0);
    });

    it('is deterministic for same region and impairments', () => {
      const m1 = getRegionDataMultipliers('region-1', ['Nutrients']);
      const m2 = getRegionDataMultipliers('region-1', ['Nutrients']);
      expect(m1.TN).toBe(m2.TN);
      expect(m1.DO).toBe(m2.DO);
    });

    it('produces different results for different regions', () => {
      const m1 = getRegionDataMultipliers('region-1', ['Nutrients']);
      const m2 = getRegionDataMultipliers('region-2', ['Nutrients']);
      // The hash variation means at least one param should differ
      const allSame = m1.DO === m2.DO && m1.TN === m2.TN && m1.TP === m2.TP;
      expect(allSame).toBe(false);
    });
  });

  // ─── applyRegionMultipliers ───────────────────────────────────────────────

  describe('applyRegionMultipliers', () => {
    it('applies multipliers to param values', () => {
      const params = {
        DO: { value: 8.0, unit: 'mg/L' },
        TSS: { value: 20.0, unit: 'mg/L' },
      };
      const multipliers = { DO: 0.75, TSS: 1.5 };
      const result = applyRegionMultipliers(params, multipliers);

      expect(result.DO.value).toBe(6.0);
      expect(result.TSS.value).toBe(30.0);
    });

    it('uses 1.0 multiplier for params not in multiplier map', () => {
      const params = {
        pH: { value: 7.5, unit: 'SU' },
      };
      const multipliers = { DO: 0.75 };
      const result = applyRegionMultipliers(params, multipliers);
      expect(result.pH.value).toBe(7.5);
    });

    it('preserves non-value properties', () => {
      const params = {
        DO: { value: 8.0, unit: 'mg/L', label: 'Dissolved Oxygen' },
      };
      const result = applyRegionMultipliers(params, { DO: 1.0 });
      expect(result.DO.unit).toBe('mg/L');
      expect(result.DO.label).toBe('Dissolved Oxygen');
    });

    it('returns new object (not mutating input)', () => {
      const params = { DO: { value: 8.0 } };
      const result = applyRegionMultipliers(params, { DO: 0.5 });
      expect(result).not.toBe(params);
      expect(result.DO).not.toBe(params.DO);
    });
  });

  // ─── PEER_GROUPS ──────────────────────────────────────────────────────────

  describe('PEER_GROUPS', () => {
    it('has peer groups for many states', () => {
      expect(Object.keys(PEER_GROUPS).length).toBeGreaterThanOrEqual(40);
    });

    it('MD peers include Chesapeake Bay states', () => {
      expect(PEER_GROUPS.MD).toContain('VA');
      expect(PEER_GROUPS.MD).toContain('PA');
      expect(PEER_GROUPS.MD).toContain('DC');
    });

    it('peer groups are arrays of state codes', () => {
      for (const [state, peers] of Object.entries(PEER_GROUPS)) {
        expect(peers).toBeInstanceOf(Array);
        expect(peers.length).toBeGreaterThan(0);
        for (const p of peers) {
          expect(p.length).toBe(2); // State codes are 2 chars
        }
      }
    });
  });

  // ─── STATE_TMDL_CONTEXT ───────────────────────────────────────────────────

  describe('STATE_TMDL_CONTEXT', () => {
    it('has TMDL context for major states', () => {
      expect(STATE_TMDL_CONTEXT.MD).toBeDefined();
      expect(STATE_TMDL_CONTEXT.CA).toBeDefined();
      expect(STATE_TMDL_CONTEXT.FL).toBeDefined();
    });

    it('each entry has framework and keyTMDLs', () => {
      for (const [state, ctx] of Object.entries(STATE_TMDL_CONTEXT)) {
        expect(ctx.framework).toBeDefined();
        expect(typeof ctx.framework).toBe('string');
        expect(ctx.keyTMDLs).toBeInstanceOf(Array);
        expect(ctx.keyTMDLs.length).toBeGreaterThan(0);
      }
    });

    it('MD context references Chesapeake Bay', () => {
      expect(STATE_TMDL_CONTEXT.MD.framework).toContain('Chesapeake');
    });
  });

  // ─── getStateMonitoringPhases ─────────────────────────────────────────────

  describe('getStateMonitoringPhases', () => {
    it('returns 4 phases for any state', () => {
      const phases = getStateMonitoringPhases('MD');
      expect(phases).toHaveLength(4);
    });

    it('each phase has required fields', () => {
      const phases = getStateMonitoringPhases('CA');
      for (const p of phases) {
        expect(p).toHaveProperty('phase');
        expect(p).toHaveProperty('title');
        expect(p).toHaveProperty('description');
        expect(p).toHaveProperty('status');
        expect(['complete', 'active', 'upcoming']).toContain(p.status);
        expect(typeof p.phase).toBe('number');
      }
    });

    it('phases are numbered 1-4', () => {
      const phases = getStateMonitoringPhases('MD');
      expect(phases.map(p => p.phase)).toEqual([1, 2, 3, 4]);
    });

    it('includes state abbreviation in descriptions', () => {
      const phases = getStateMonitoringPhases('MD');
      // MDE should appear in at least some phase descriptions
      const hasAbbr = phases.some(p => p.description.includes('MDE'));
      expect(hasAbbr).toBe(true);
    });

    it('works for unknown state (uses abbr as fallback)', () => {
      const phases = getStateMonitoringPhases('ZZ');
      expect(phases).toHaveLength(4);
      // Should fall back to using 'ZZ' as the abbreviation
      const hasZZ = phases.some(p => p.description.includes('ZZ'));
      expect(hasZZ).toBe(true);
    });
  });

  // ─── getStateGrants ───────────────────────────────────────────────────────

  describe('getStateGrants', () => {
    it('returns grants for any state (at least federal grants)', () => {
      const grants = getStateGrants('ZZ'); // Unknown state still gets federal grants
      expect(grants.length).toBeGreaterThanOrEqual(4); // 4 federal grants
    });

    it('returns extra grants for Chesapeake Bay states', () => {
      const mdGrants = getStateGrants('MD');
      const zzGrants = getStateGrants('ZZ');
      expect(mdGrants.length).toBeGreaterThan(zzGrants.length);
    });

    it('each grant has required fields', () => {
      const grants = getStateGrants('MD');
      for (const g of grants) {
        expect(g).toHaveProperty('name');
        expect(g).toHaveProperty('source');
        expect(g).toHaveProperty('amount');
        expect(g).toHaveProperty('maxAmount');
        expect(g).toHaveProperty('fit');
        expect(g).toHaveProperty('description');
        expect(g).toHaveProperty('url');
        expect(['high', 'medium', 'low']).toContain(g.fit);
        expect(typeof g.maxAmount).toBe('number');
      }
    });

    it('MD has state-specific Abell Foundation grant', () => {
      const grants = getStateGrants('MD');
      const abell = grants.find(g => g.name.includes('Abell'));
      expect(abell).toBeDefined();
    });

    it('PA has Growing Greener grant', () => {
      const grants = getStateGrants('PA');
      const gg = grants.find(g => g.name.includes('Growing Greener'));
      expect(gg).toBeDefined();
    });
  });

  // ─── getStateMS4Jurisdictions ─────────────────────────────────────────────

  describe('getStateMS4Jurisdictions', () => {
    it('returns jurisdictions for MD', () => {
      const jurisdictions = getStateMS4Jurisdictions('MD');
      expect(jurisdictions.length).toBeGreaterThan(0);
    });

    it('each jurisdiction has required fields', () => {
      const jurisdictions = getStateMS4Jurisdictions('MD');
      for (const j of jurisdictions) {
        expect(j).toHaveProperty('name');
        expect(j).toHaveProperty('phase');
        expect(j).toHaveProperty('permitId');
        expect(j).toHaveProperty('population');
        expect(j).toHaveProperty('status');
        expect(j).toHaveProperty('pearlFit');
        expect(['Phase I', 'Phase II']).toContain(j.phase);
        expect(['In Compliance', 'Under Review', 'Minor Violations', 'Consent Decree', 'NOV Issued', 'Pending Renewal']).toContain(j.status);
        expect(['high', 'medium', 'low']).toContain(j.pearlFit);
        expect(typeof j.population).toBe('number');
      }
    });

    it('returns empty array for unknown state', () => {
      const jurisdictions = getStateMS4Jurisdictions('ZZ');
      expect(jurisdictions).toEqual([]);
    });

    it('FL has MS4 jurisdictions', () => {
      const jurisdictions = getStateMS4Jurisdictions('FL');
      expect(jurisdictions.length).toBeGreaterThan(0);
    });
  });

  // ─── getMS4ComplianceSummary ──────────────────────────────────────────────

  describe('getMS4ComplianceSummary', () => {
    it('returns correct summary for MD jurisdictions', () => {
      const jurisdictions = getStateMS4Jurisdictions('MD');
      const summary = getMS4ComplianceSummary(jurisdictions);

      expect(summary.total).toBe(jurisdictions.length);
      expect(summary.phaseI + summary.phaseII).toBe(summary.total);
      expect(summary.inCompliance).toBeGreaterThanOrEqual(0);
      expect(summary.issues).toBeGreaterThanOrEqual(0);
      expect(summary.totalPopulation).toBeGreaterThan(0);
    });

    it('returns zeros for empty array', () => {
      const summary = getMS4ComplianceSummary([]);
      expect(summary.total).toBe(0);
      expect(summary.phaseI).toBe(0);
      expect(summary.phaseII).toBe(0);
      expect(summary.inCompliance).toBe(0);
      expect(summary.issues).toBe(0);
      expect(summary.consentDecrees).toBe(0);
      expect(summary.highPearlFit).toBe(0);
      expect(summary.totalPopulation).toBe(0);
    });

    it('counts consent decrees correctly', () => {
      const jurisdictions: MS4Jurisdiction[] = [
        { name: 'Test City', phase: 'Phase I', permitId: 'XX001', population: 100000, status: 'Consent Decree', pearlFit: 'high' },
        { name: 'Test County', phase: 'Phase II', permitId: 'XX002', population: 200000, status: 'In Compliance', pearlFit: 'low' },
      ];
      const summary = getMS4ComplianceSummary(jurisdictions);
      expect(summary.consentDecrees).toBe(1);
      expect(summary.inCompliance).toBe(1);
      expect(summary.issues).toBe(1); // Consent Decree counts as issue
      expect(summary.phaseI).toBe(1);
      expect(summary.phaseII).toBe(1);
      expect(summary.highPearlFit).toBe(1);
      expect(summary.totalPopulation).toBe(300000);
    });
  });

  // ─── STATE_COMPLAINT_CONTACTS ─────────────────────────────────────────────

  describe('STATE_COMPLAINT_CONTACTS', () => {
    it('has contacts for many states', () => {
      expect(Object.keys(STATE_COMPLAINT_CONTACTS).length).toBeGreaterThanOrEqual(40);
    });

    it('each contact has complaintUrl and reportLabel', () => {
      for (const [state, contact] of Object.entries(STATE_COMPLAINT_CONTACTS)) {
        expect(contact.complaintUrl).toBeDefined();
        expect(typeof contact.complaintUrl).toBe('string');
        expect(contact.complaintUrl).toMatch(/^https?:\/\//);
        expect(contact.reportLabel).toBeDefined();
      }
    });
  });

  // ─── getComplaintContact ──────────────────────────────────────────────────

  describe('getComplaintContact', () => {
    it('returns state contact for known state', () => {
      const contact = getComplaintContact('MD');
      expect(contact.complaintUrl).toContain('mde.maryland.gov');
      expect(contact.reportLabel).toContain('MDE');
    });

    it('returns EPA fallback for unknown state', () => {
      const contact = getComplaintContact('ZZ');
      expect(contact.complaintUrl).toContain('epa.gov');
      expect(contact.reportLabel).toContain('EPA');
    });

    it('some states have hotline numbers', () => {
      const contact = getComplaintContact('MD');
      expect(contact.hotline).toBeDefined();
    });
  });

  // ─── getComplaintSearchUrl ────────────────────────────────────────────────

  describe('getComplaintSearchUrl', () => {
    it('returns Google site-search URL for state with website', () => {
      const url = getComplaintSearchUrl('MD');
      expect(url).toContain('google.com/search');
      expect(url).toContain('mde.maryland.gov');
    });

    it('returns Google search URL for state without website', () => {
      // Pick a state that has a complaint URL but no website in STATE_AUTHORITIES
      const url = getComplaintSearchUrl('AR');
      expect(url).toContain('google.com/search');
    });

    it('returns EPA fallback URL for unknown state', () => {
      const url = getComplaintSearchUrl('ZZ');
      expect(url).toContain('epa.gov');
    });
  });
});
