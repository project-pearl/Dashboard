// app/api/installations/coordinates/route.ts
// Serves corrected military installation coordinates to prevent map clustering.
// Fixes overlapping installations that appear stacked in visualizations.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import installationsOriginal from '@/data/military-installations.json';
import installationsFixed from '@/data/military-installations-fixed.json';
import { analyzeInstallationClustering, applyCoordinateFixes } from '@/lib/installationCentroids';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action') || 'fixed';
  const format = searchParams.get('format') || 'full';

  try {
    switch (action) {
      case 'original':
        // Return original coordinates (may have clustering issues)
        const original = format === 'coordinates'
          ? installationsOriginal.map(inst => ({
              id: inst.id,
              name: inst.name,
              lat: inst.lat,
              lng: inst.lng,
              type: inst.type,
            }))
          : installationsOriginal;

        return NextResponse.json({
          installations: original,
          version: 'original',
          note: 'Original coordinates may have clustering issues',
          timestamp: new Date(),
        });

      case 'fixed':
        // Return fixed coordinates (spread out clusters)
        const fixed = format === 'coordinates'
          ? installationsFixed.map(inst => ({
              id: inst.id,
              name: inst.name,
              lat: inst.lat,
              lng: inst.lng,
              type: inst.type,
            }))
          : installationsFixed;

        return NextResponse.json({
          installations: fixed,
          version: 'fixed',
          note: 'Coordinates adjusted to prevent map clustering',
          timestamp: new Date(),
        });

      case 'analysis':
        // Analyze clustering in original data
        const analysis = analyzeInstallationClustering(installationsOriginal as any[]);

        return NextResponse.json({
          analysis,
          clustersFound: analysis.clusters.length,
          installationsAffected: analysis.totalClustered,
          recommendations: analysis.recommendations,
          timestamp: new Date(),
        });

      case 'comparison':
        // Compare original vs fixed coordinates
        const changes = installationsOriginal.map(orig => {
          const fixed = installationsFixed.find(f => f.id === orig.id);
          if (!fixed) return null;

          const latChanged = Math.abs(orig.lat - fixed.lat) > 0.001;
          const lngChanged = Math.abs(orig.lng - fixed.lng) > 0.001;

          return {
            id: orig.id,
            name: orig.name,
            changed: latChanged || lngChanged,
            original: { lat: orig.lat, lng: orig.lng },
            fixed: { lat: fixed.lat, lng: fixed.lng },
            distance: latChanged || lngChanged
              ? calculateDistance(orig.lat, orig.lng, fixed.lat, fixed.lng)
              : 0,
          };
        }).filter(Boolean);

        const changedInstallations = changes.filter(c => c?.changed);

        return NextResponse.json({
          totalInstallations: changes.length,
          changedInstallations: changedInstallations.length,
          changes: changedInstallations,
          timestamp: new Date(),
        });

      case 'geojson':
        // Return as GeoJSON for mapping libraries
        const geoJson = {
          type: 'FeatureCollection',
          features: installationsFixed.map(inst => ({
            type: 'Feature',
            properties: {
              id: inst.id,
              name: inst.name,
              branch: inst.branch,
              region: inst.region,
              type: inst.type,
              burnPitHistory: inst.burnPitHistory,
              state: inst.state,
            },
            geometry: {
              type: 'Point',
              coordinates: [inst.lng, inst.lat], // GeoJSON uses [lng, lat]
            },
          })),
        };

        return NextResponse.json(geoJson);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Installation coordinates error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve installation coordinates' },
      { status: 500 }
    );
  }
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}