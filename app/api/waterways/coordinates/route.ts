// app/api/waterways/coordinates/route.ts
// Maryland waterway coordinate fixes to resolve clustering issues.
// Provides proper coordinates for Bush River, Timber Run, and other MD waterways.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action') || 'fixes';
  const waterway = searchParams.get('waterway');
  const state = searchParams.get('state')?.toUpperCase() || 'MD';

  try {
    // Load waterway fixes from JSON file
    const filePath = path.join(process.cwd(), 'data', 'fixed-coordinates', 'maryland-waterways-fixed.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const waterwayFixes = JSON.parse(fileContent) as {
      fixes: Array<{ name: string; fixedLat: number; fixedLng: number; reason: string; priority: string; id?: string }>;
      summary: unknown;
      timestamp: string;
    };
    switch (action) {
      case 'fixes':
        // Return all coordinate fixes for Maryland waterways
        return NextResponse.json({
          state: 'MD',
          fixes: waterwayFixes.fixes,
          summary: waterwayFixes.summary,
          timestamp: waterwayFixes.timestamp,
        });

      case 'lookup':
        // Lookup specific waterway coordinates
        if (!waterway) {
          return NextResponse.json({ error: 'Waterway name required' }, { status: 400 });
        }

        const fix = waterwayFixes.fixes.find(f =>
          f.name.toLowerCase().includes(waterway.toLowerCase())
        );

        if (!fix) {
          return NextResponse.json({
            error: 'Waterway not found',
            waterway,
            available: waterwayFixes.fixes.map(f => f.name).slice(0, 10),
          }, { status: 404 });
        }

        return NextResponse.json({
          waterway: fix.name,
          coordinates: {
            lat: fix.fixedLat,
            lng: fix.fixedLng,
          },
          reason: fix.reason,
          priority: fix.priority,
        });

      case 'bush-river':
        // Specific Bush River coordinates
        const bushRiverFixes = waterwayFixes.fixes.filter(f =>
          f.name.toLowerCase().includes('bush river')
        );

        return NextResponse.json({
          waterway: 'Bush River',
          variants: bushRiverFixes.map(fix => ({
            name: fix.name,
            lat: fix.fixedLat,
            lng: fix.fixedLng,
            reason: fix.reason,
          })),
          note: 'Bush River and its segments now have distinct coordinates',
        });

      case 'timber-run':
        // Specific Timber Run coordinates
        const timberRunFixes = waterwayFixes.fixes.filter(f =>
          f.name.toLowerCase().includes('timber run')
        );

        return NextResponse.json({
          waterway: 'Timber Run',
          variants: timberRunFixes.map(fix => ({
            name: fix.name,
            lat: fix.fixedLat,
            lng: fix.fixedLng,
            reason: fix.reason,
          })),
          note: 'Timber Run variants now have distinct coordinates',
        });

      case 'geojson':
        // Return as GeoJSON for mapping
        const features = waterwayFixes.fixes
          .filter(fix => fix.fixedLat && fix.fixedLng)
          .map(fix => ({
            type: 'Feature',
            properties: {
              name: fix.name,
              id: fix.id || `md-${fix.name.toLowerCase().replace(/\s+/g, '-')}`,
              priority: fix.priority,
              reason: fix.reason,
            },
            geometry: {
              type: 'Point',
              coordinates: [fix.fixedLng, fix.fixedLat], // GeoJSON: [lng, lat]
            },
          }));

        return NextResponse.json({
          type: 'FeatureCollection',
          features,
          metadata: {
            state: 'MD',
            totalWaterways: features.length,
            fixedTimestamp: waterwayFixes.timestamp,
          },
        });

      case 'validate':
        // Validate that fixes are properly separated
        const coordinates = waterwayFixes.fixes
          .filter(fix => fix.fixedLat && fix.fixedLng)
          .map(fix => ({ name: fix.name, lat: fix.fixedLat, lng: fix.fixedLng }));

        const duplicates = findDuplicateCoordinates(coordinates);
        const minDistance = findMinimumDistance(coordinates);

        return NextResponse.json({
          validation: {
            totalCoordinates: coordinates.length,
            duplicateCoordinates: duplicates.length,
            minimumSeparation: minDistance,
            isValid: duplicates.length === 0 && minDistance > 0.001, // >100m separation
          },
          duplicates,
          note: duplicates.length === 0 ? 'All coordinates properly separated' : 'Some coordinates still clustered',
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Waterway coordinates error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve waterway coordinates' },
      { status: 500 }
    );
  }
}

/**
 * Find coordinates that are duplicated (stacked)
 */
function findDuplicateCoordinates(coordinates: Array<{name: string, lat: number, lng: number}>) {
  const coordMap = new Map<string, string[]>();

  coordinates.forEach(coord => {
    const key = `${coord.lat.toFixed(4)},${coord.lng.toFixed(4)}`;
    if (!coordMap.has(key)) {
      coordMap.set(key, []);
    }
    coordMap.get(key)!.push(coord.name);
  });

  const duplicates: Array<{coordinates: string, waterways: string[]}> = [];
  coordMap.forEach((names, coords) => {
    if (names.length > 1) {
      duplicates.push({ coordinates: coords, waterways: names });
    }
  });

  return duplicates;
}

/**
 * Find minimum distance between any two coordinates
 */
function findMinimumDistance(coordinates: Array<{name: string, lat: number, lng: number}>) {
  let minDistance = Infinity;

  for (let i = 0; i < coordinates.length; i++) {
    for (let j = i + 1; j < coordinates.length; j++) {
      const dist = calculateDistance(
        coordinates[i].lat, coordinates[i].lng,
        coordinates[j].lat, coordinates[j].lng
      );
      minDistance = Math.min(minDistance, dist);
    }
  }

  return minDistance === Infinity ? 0 : minDistance;
}

/**
 * Calculate distance between two points in degrees
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.sqrt((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);
}