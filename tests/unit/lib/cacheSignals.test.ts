import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/nwpsCache', () => ({
  getNwpsAllGauges: () => [{
    lid: 'TESTG', name: 'Test Gauge', state: 'MD', status: 'moderate',
    observed: { primary: 15.5, unit: 'ft', time: '2024-01-01' },
  }],
}));
vi.mock('@/lib/coopsCache', () => ({
  getCoopsAllStations: () => [{
    id: 'CO1', name: 'Test Station', state: 'MD',
    waterTemp: 33, waterLevel: 1.5, waterLevelTime: '2024-01-01',
  }],
}));
vi.mock('@/lib/ndbcCache', () => ({
  getNdbcAllStations: () => [{
    id: 'NDBC1', name: 'Test Buoy',
    ocean: { dissolvedO2Ppm: 3, ph: null, chlorophyll: null, turbidity: null },
    observation: {},
    observedAt: '2024-01-01',
  }],
}));
vi.mock('@/lib/snotelCache', () => ({ getSnotelAllStations: () => [] }));
vi.mock('@/lib/cdcNwssCache', () => ({ getCdcNwssAllStates: () => null }));
vi.mock('@/lib/echoCache', () => ({ getEchoAllData: () => ({ facilities: [] }) }));
vi.mock('@/lib/pfasCache', () => ({ getPfasAllResults: () => [] }));
vi.mock('@/lib/triCache', () => ({ getTriAllFacilities: () => [] }));
vi.mock('@/lib/usaceCache', () => ({ getUsaceAllLocations: () => [] }));
vi.mock('@/lib/bwbCache', () => ({ getBwbAllStations: () => [] }));

import { generateCacheSignals } from '@/lib/cacheSignals';

describe('cacheSignals', () => {
  describe('generateCacheSignals', () => {
    it('returns an array of signals', () => {
      const signals = generateCacheSignals();
      expect(Array.isArray(signals)).toBe(true);
      expect(signals.length).toBeGreaterThan(0);
    });

    it('produces flood signal from NWPS gauge with moderate status', () => {
      const signals = generateCacheSignals();
      const floodSignal = signals.find(s => s.source === 'nwps');

      expect(floodSignal).toBeDefined();
      expect(floodSignal!.category).toBe('flood');
      expect(floodSignal!.title).toContain('Test Gauge');
      expect(floodSignal!.summary).toContain('moderate');
    });

    it('produces hab signal from NDBC buoy with low DO', () => {
      const signals = generateCacheSignals();
      const ndbcSignal = signals.find(s => s.source === 'ndbc');

      expect(ndbcSignal).toBeDefined();
      expect(ndbcSignal!.category).toBe('hab');
      expect(ndbcSignal!.title).toContain('Low dissolved oxygen');
      expect(ndbcSignal!.summary).toContain('3');
    });

    it('produces advisory signal from CO-OPS station with high temp', () => {
      const signals = generateCacheSignals();
      const coopsSignal = signals.find(s => s.source === 'coops');

      expect(coopsSignal).toBeDefined();
      expect(coopsSignal!.category).toBe('advisory');
      expect(coopsSignal!.title).toContain('Elevated water temperature');
      expect(coopsSignal!.summary).toContain('33');
    });

    it('all signals have required fields', () => {
      const signals = generateCacheSignals();

      for (const signal of signals) {
        expect(signal.id).toBeDefined();
        expect(typeof signal.id).toBe('string');
        expect(signal.source).toBeDefined();
        expect(typeof signal.source).toBe('string');
        expect(signal.sourceLabel).toBeDefined();
        expect(typeof signal.sourceLabel).toBe('string');
        expect(signal.category).toBeDefined();
        expect(typeof signal.category).toBe('string');
        expect(signal.title).toBeDefined();
        expect(typeof signal.title).toBe('string');
        expect(signal.summary).toBeDefined();
        expect(typeof signal.summary).toBe('string');
      }
    });

    it('signals are sorted by category priority with flood first', () => {
      const signals = generateCacheSignals();

      // With our mock data: nwps=flood, ndbc=hab, coops=advisory
      // Priority: flood(0) < hab(4) < advisory(5)
      const floodIndex = signals.findIndex(s => s.category === 'flood');
      const habIndex = signals.findIndex(s => s.category === 'hab');
      const advisoryIndex = signals.findIndex(s => s.category === 'advisory');

      if (floodIndex >= 0 && habIndex >= 0) {
        expect(floodIndex).toBeLessThan(habIndex);
      }
      if (habIndex >= 0 && advisoryIndex >= 0) {
        expect(habIndex).toBeLessThan(advisoryIndex);
      }
    });
  });
});
