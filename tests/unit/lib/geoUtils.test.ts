import { describe, it, expect } from 'vitest';
import { haversineMi, polygonCentroid } from '@/lib/geoUtils';

describe('geoUtils', () => {
  describe('haversineMi', () => {
    it('calculates NYC to LA distance within 10 miles of 2451', () => {
      const dist = haversineMi(40.7128, -74.006, 34.0522, -118.2437);
      expect(dist).toBeGreaterThan(2441);
      expect(dist).toBeLessThan(2461);
    });

    it('returns 0 for the same point', () => {
      expect(haversineMi(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
    });

    it('returns approximately max distance for antipodal points', () => {
      // Antipodal: (0, 0) and (0, 180) — half circumference
      const dist = haversineMi(0, 0, 0, 180);
      // Earth circumference in miles ~24,901, half = ~12,450
      expect(dist).toBeGreaterThan(12_400);
      expect(dist).toBeLessThan(12_500);
    });

    it('handles negative latitudes (southern hemisphere)', () => {
      // Sydney (-33.8688, 151.2093) to Auckland (-36.8485, 174.7633) ≈ 1,341 mi
      const dist = haversineMi(-33.8688, 151.2093, -36.8485, 174.7633);
      expect(dist).toBeGreaterThan(1300);
      expect(dist).toBeLessThan(1400);
    });

    it('is symmetric: dist(A,B) === dist(B,A)', () => {
      const ab = haversineMi(40.7128, -74.006, 34.0522, -118.2437);
      const ba = haversineMi(34.0522, -118.2437, 40.7128, -74.006);
      expect(ab).toBeCloseTo(ba, 10);
    });
  });

  describe('polygonCentroid', () => {
    it('computes the centroid of a triangle', () => {
      // Triangle: (0,0), (6,0), (3,6) in [lng, lat] format
      const coords = [
        [0, 0],
        [6, 0],
        [3, 6],
      ];
      const c = polygonCentroid(coords);
      expect(c.lat).toBeCloseTo(2, 5);
      expect(c.lng).toBeCloseTo(3, 5);
    });

    it('computes the centroid of a rectangle', () => {
      // Rectangle corners in [lng, lat]: (0,0), (10,0), (10,4), (0,4)
      const coords = [
        [0, 0],
        [10, 0],
        [10, 4],
        [0, 4],
      ];
      const c = polygonCentroid(coords);
      expect(c.lat).toBeCloseTo(2, 5);
      expect(c.lng).toBeCloseTo(5, 5);
    });

    it('returns the single point for a degenerate single-point polygon', () => {
      const coords = [[-77.0369, 38.9072]];
      const c = polygonCentroid(coords);
      expect(c.lat).toBeCloseTo(38.9072, 5);
      expect(c.lng).toBeCloseTo(-77.0369, 5);
    });

    it('handles negative coordinates correctly', () => {
      // Square in the southern/western hemisphere
      const coords = [
        [-80, -10],
        [-70, -10],
        [-70, -20],
        [-80, -20],
      ];
      const c = polygonCentroid(coords);
      expect(c.lat).toBeCloseTo(-15, 5);
      expect(c.lng).toBeCloseTo(-75, 5);
    });
  });
});
