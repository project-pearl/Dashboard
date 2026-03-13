/**
 * Maryland Waterway Coordinate Resolution
 *
 * Fixes the clustering issue where Bush River, Timber Run, and other MD waterways
 * appear stacked because they have null coordinates in ATTAINS data.
 */

import waterwayFixes from '@/data/fixed-coordinates/maryland-waterways-fixed.json';

export interface WaterwayCoordinate {
  name: string;
  id?: string;
  lat: number;
  lng: number;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'CLUSTER_FIX';
}

export interface WaterbodyCoordinateRequest {
  id?: string;
  name: string;
  state?: string;
  originalLat?: number | null;
  originalLng?: number | null;
}

/**
 * Resolve coordinates for Maryland waterways with null coordinates
 */
export function resolveMarylandWaterwayCoordinates(
  waterway: WaterbodyCoordinateRequest
): { lat: number; lng: number } | null {

  // Only process Maryland waterways with null/undefined coordinates
  if (waterway.state !== 'MD' && waterway.state !== 'Maryland') {
    return null;
  }

  if (waterway.originalLat !== null && waterway.originalLat !== undefined &&
      waterway.originalLng !== null && waterway.originalLng !== undefined) {
    return null; // Already has coordinates
  }

  // Find coordinate fix by name
  const fix = waterwayFixes.fixes.find(f => {
    const fixRecord = f as typeof f & { id?: string };
    if (waterway.id && fixRecord.id && fixRecord.id === waterway.id) {
      return true; // Exact ID match
    }

    if (f.name.toLowerCase() === waterway.name.toLowerCase()) {
      return true; // Exact name match
    }

    // Fuzzy name matching for variations
    const normalizedWaterway = normalizeWaterwayName(waterway.name);
    const normalizedFix = normalizeWaterwayName(f.name);

    return normalizedWaterway === normalizedFix;
  });

  if (!fix || !fix.fixedLat || !fix.fixedLng) {
    return null;
  }

  return {
    lat: fix.fixedLat,
    lng: fix.fixedLng,
  };
}

/**
 * Get all Maryland waterway coordinate fixes
 */
export function getAllMarylandWaterwayFixes(): WaterwayCoordinate[] {
  return waterwayFixes.fixes.map(fix => {
    const fixRecord = fix as typeof fix & { id?: string };
    return {
      name: fix.name,
      id: fixRecord.id,
      lat: fix.fixedLat,
      lng: fix.fixedLng,
      reason: fix.reason,
      priority: fix.priority as WaterwayCoordinate['priority'],
    };
  });
}

/**
 * Get coordinates specifically for Bush River and its variants
 */
export function getBushRiverCoordinates() {
  const bushRiverFixes = waterwayFixes.fixes.filter(fix =>
    fix.name.toLowerCase().includes('bush river')
  );

  return {
    waterway: 'Bush River',
    variants: bushRiverFixes.map(fix => ({
      name: fix.name,
      id: (fix as typeof fix & { id?: string }).id,
      lat: fix.fixedLat,
      lng: fix.fixedLng,
      reason: fix.reason,
    })),
    primaryLocation: {
      lat: 39.4617,
      lng: -76.1653,
      description: 'Bush River near Aberdeen, Harford County, MD',
    },
  };
}

/**
 * Get coordinates specifically for Timber Run and its variants
 */
export function getTimberRunCoordinates() {
  const timberRunFixes = waterwayFixes.fixes.filter(fix =>
    fix.name.toLowerCase().includes('timber run')
  );

  return {
    waterway: 'Timber Run',
    variants: timberRunFixes.map(fix => ({
      name: fix.name,
      id: (fix as typeof fix & { id?: string }).id,
      lat: fix.fixedLat,
      lng: fix.fixedLng,
      reason: fix.reason,
    })),
    primaryLocation: {
      lat: 39.2584,
      lng: -77.1847,
      description: 'Timber Run in Frederick/Carroll County area, MD',
    },
  };
}

/**
 * Check if waterways are properly separated (not stacked)
 */
export function validateWaterwayCoordinateSeparation() {
  const coordinates = waterwayFixes.fixes
    .filter(fix => fix.fixedLat && fix.fixedLng)
    .map(fix => ({
      name: fix.name,
      lat: fix.fixedLat,
      lng: fix.fixedLng,
    }));

  // Check for duplicates
  const coordMap = new Map<string, string[]>();
  coordinates.forEach(coord => {
    const key = `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)}`;
    if (!coordMap.has(key)) {
      coordMap.set(key, []);
    }
    coordMap.get(key)!.push(coord.name);
  });

  const duplicates = Array.from(coordMap.entries())
    .filter(([key, names]) => names.length > 1)
    .map(([coords, names]) => ({ coordinates: coords, waterways: names }));

  // Calculate minimum distance
  let minDistance = Infinity;
  for (let i = 0; i < coordinates.length; i++) {
    for (let j = i + 1; j < coordinates.length; j++) {
      const dist = Math.sqrt(
        (coordinates[j].lat - coordinates[i].lat) ** 2 +
        (coordinates[j].lng - coordinates[i].lng) ** 2
      );
      minDistance = Math.min(minDistance, dist);
    }
  }

  return {
    isValid: duplicates.length === 0 && minDistance > 0.001,
    duplicateCount: duplicates.length,
    minimumSeparation: minDistance === Infinity ? 0 : minDistance,
    duplicates,
    coordinates,
  };
}

/**
 * Normalize waterway names for fuzzy matching
 */
function normalizeWaterwayName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Integration point for existing waterbody coordinate resolution
 */
export function enhanceWaterbodyWithMarylandCoordinates<T extends WaterbodyCoordinateRequest>(
  waterbody: T
): T & { resolvedCoordinates?: { lat: number; lng: number; source: string } } {
  const resolved = resolveMarylandWaterwayCoordinates(waterbody);

  if (resolved) {
    return {
      ...waterbody,
      resolvedCoordinates: {
        ...resolved,
        source: 'maryland-waterway-fixes',
      },
    };
  }

  return waterbody;
}

/**
 * Get summary of Maryland waterway coordinate fixes
 */
export function getMarylandWaterwaySummary() {
  const summary = waterwayFixes.summary;
  const validation = validateWaterwayCoordinateSeparation();

  return {
    timestamp: waterwayFixes.timestamp,
    totalWaterways: summary.totalWaterways,
    highPriorityFixes: summary.highPriorityFixes,
    analysis: {
      totalWaterBodies: summary.analysis.totalWaterBodies,
      nullCoordinates: summary.analysis.nullCoordinates,
      percentageWithNullCoords: (summary.analysis.nullCoordinates / summary.analysis.totalWaterBodies * 100).toFixed(1),
    },
    validation,
    keyWaterways: {
      bushRiver: getBushRiverCoordinates(),
      timberRun: getTimberRunCoordinates(),
    },
    status: validation.isValid ? 'All waterways properly separated' : `${validation.duplicateCount} coordinate conflicts remain`,
  };
}