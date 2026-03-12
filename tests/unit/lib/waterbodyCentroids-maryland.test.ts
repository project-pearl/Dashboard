// tests/unit/lib/waterbodyCentroids-maryland.test.ts
// Test Maryland waterway coordinate integration

import { describe, it, expect } from 'vitest';
import { resolveWaterbodyCoordinates } from '@/lib/waterbodyCentroids';

describe('Maryland Waterway Coordinate Resolution', () => {
  const tolerance = 0.05; // Allow differences for jitter (~3 miles)

  describe('Bush River coordinates', () => {
    it('should resolve Bush River to distinct coordinates near Aberdeen', () => {
      const result = resolveWaterbodyCoordinates('Bush River', 'MD', 'MD-02130701');

      expect(result).toBeTruthy();
      expect(result!.lat).toBeCloseTo(39.4617, 1); // Within ~10km (appropriate for state-level view)
      expect(result!.lon).toBeCloseTo(-76.1653, 1);
    });

    it('should resolve Bush River Oligohaline to distinct coordinates', () => {
      const result = resolveWaterbodyCoordinates('BSHOH - Bush River Oligohaline', 'MD', 'MD-BSHOH');

      expect(result).toBeTruthy();
      expect(result!.lat).toBeCloseTo(39.43, 1);
      expect(result!.lon).toBeCloseTo(-76.15, 1);
    });
  });

  describe('Timber Run coordinates', () => {
    it('should resolve Timber Run to distinct coordinates in Frederick County', () => {
      const result = resolveWaterbodyCoordinates('Timber Run', 'MD', 'MD-021309071048-Timber_Run');

      expect(result).toBeTruthy();
      expect(result!.lat).toBeCloseTo(39.2584, 1);
      expect(result!.lon).toBeCloseTo(-77.1847, 1);
    });
  });

  describe('Coordinate separation', () => {
    it('should ensure Bush River and Timber Run have adequate separation', () => {
      const bushRiver = resolveWaterbodyCoordinates('Bush River', 'MD', 'MD-02130701');
      const timberRun = resolveWaterbodyCoordinates('Timber Run', 'MD', 'MD-021309071048-Timber_Run');

      expect(bushRiver).toBeTruthy();
      expect(timberRun).toBeTruthy();

      // Calculate distance in degrees
      const latDiff = bushRiver!.lat - timberRun!.lat;
      const lonDiff = bushRiver!.lon - timberRun!.lon;
      const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);

      // Should be more than 0.01 degrees apart (~0.7 miles)
      expect(distance).toBeGreaterThan(0.01);

      console.log(`Bush River: ${bushRiver!.lat.toFixed(4)}, ${bushRiver!.lon.toFixed(4)}`);
      console.log(`Timber Run: ${timberRun!.lat.toFixed(4)}, ${timberRun!.lon.toFixed(4)}`);
      console.log(`Separation: ${distance.toFixed(4)} degrees (${(distance * 69).toFixed(1)} miles)`);
    });
  });

  describe('Maryland waterway fixes integration', () => {
    it('should use Maryland-specific fixes for problematic waterways', () => {
      // Test that Maryland fixes are applied before general keyword matching
      const testCases = [
        { name: 'Bush River', expectedLat: 39.4617, expectedLng: -76.1653 },
        { name: 'Timber Run', expectedLat: 39.2584, expectedLng: -77.1847 },
      ];

      testCases.forEach(testCase => {
        const result = resolveWaterbodyCoordinates(testCase.name, 'MD');

        expect(result).toBeTruthy();
        expect(Math.abs(result!.lat - testCase.expectedLat)).toBeLessThan(tolerance);
        expect(Math.abs(result!.lon - testCase.expectedLng)).toBeLessThan(tolerance);
      });
    });

    it('should fall back to regular resolution for non-Maryland states', () => {
      // Should not use Maryland fixes for other states
      const result = resolveWaterbodyCoordinates('Bush River', 'VA');

      // Should get a coordinate but not the Maryland-specific one
      expect(result).toBeTruthy();
      expect(Math.abs(result!.lat - 39.4617)).toBeGreaterThan(0.5); // Should be far from MD coordinates
    });
  });

  describe('Error handling', () => {
    it('should gracefully handle Maryland coordinate fix failures', () => {
      // Test with invalid names that would trigger fallback
      const result = resolveWaterbodyCoordinates('Invalid Waterway Name', 'MD');

      // Should still return coordinates (state center fallback)
      expect(result).toBeTruthy();
      expect(result!.lat).toBeGreaterThan(38.0); // Generally in MD region
      expect(result!.lat).toBeLessThan(40.0);
      expect(result!.lon).toBeGreaterThan(-78.0); // Generally in MD region
      expect(result!.lon).toBeLessThan(-75.0);
    });
  });
});