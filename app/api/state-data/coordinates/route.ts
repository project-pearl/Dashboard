// app/api/state-data/coordinates/route.ts
// Serves corrected state-level coordinates to prevent map clustering.
// Fixes overlapping monitoring stations, facilities, and other state data points.

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import {
  analyzeStateDataClustering,
  generateStateSpreadCoordinates,
  applyMarylandCoordinateFixes,
  STATE_CENTROIDS
} from '@/lib/stateCentroids';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action') || 'analyze';
  const state = searchParams.get('state')?.toUpperCase();
  const dataSource = searchParams.get('source') || 'all'; // wqp, icis, attains, etc.

  try {
    switch (action) {
      case 'analyze':
        // Analyze clustering in current cache data
        const analysisResult = await analyzeStateCaching(state, dataSource);
        return NextResponse.json(analysisResult);

      case 'maryland-fixes':
        // Get Maryland-specific coordinate fixes
        const marylandFixes = await getMarylandCoordinateFixes();
        return NextResponse.json(marylandFixes);

      case 'spread-coordinates':
        // Generate spread coordinates for a specific cluster
        const clusterData = searchParams.get('cluster');
        if (!clusterData) {
          return NextResponse.json({ error: 'Cluster data required' }, { status: 400 });
        }

        try {
          const cluster = JSON.parse(decodeURIComponent(clusterData));
          const spreadCoords = generateStateSpreadCoordinates(cluster);
          return NextResponse.json({ spreadCoordinates: spreadCoords });
        } catch (parseError) {
          return NextResponse.json({ error: 'Invalid cluster data format' }, { status: 400 });
        }

      case 'state-centroids':
        // Get centroids for all states or specific state
        if (state && STATE_CENTROIDS[state]) {
          return NextResponse.json({
            state,
            centroid: STATE_CENTROIDS[state],
            timestamp: new Date(),
          });
        }
        return NextResponse.json({
          centroids: STATE_CENTROIDS,
          timestamp: new Date(),
        });

      case 'fix-clustering':
        // Apply clustering fixes to provided data
        const rawData = searchParams.get('data');
        if (!rawData) {
          return NextResponse.json({ error: 'Data required for clustering fix' }, { status: 400 });
        }

        try {
          const dataPoints = JSON.parse(decodeURIComponent(rawData));
          const fixedData = await applyClusteringFixes(dataPoints, state);
          return NextResponse.json({
            originalCount: dataPoints.length,
            fixedData,
            clustersFixed: fixedData.clustersFixed,
            timestamp: new Date(),
          });
        } catch (parseError) {
          return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('State coordinate error:', error);
    return NextResponse.json(
      { error: 'Failed to process state coordinate data' },
      { status: 500 }
    );
  }
}

/**
 * Analyze clustering in cached state data
 */
async function analyzeStateCaching(targetState?: string, dataSource = 'all') {
  const fs = require('fs').promises;
  const path = require('path');

  const cacheDir = path.join(process.cwd(), '.cache');
  const cacheFiles = [
    'wqp-priority-states.json',
    'icis-priority-states.json',
    'attains-national.json',
    'echo-priority-states.json',
    'nwis-gw-priority-states.json',
    'air-quality.json',
    'frs-priority-states.json',
    'indices-cache.json',
  ];

  const analysisResults = [];

  for (const filename of cacheFiles) {
    if (dataSource !== 'all' && !filename.includes(dataSource)) continue;

    try {
      const filePath = path.join(cacheDir, filename);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const cacheData = JSON.parse(fileContent);

      // Extract data points with coordinates
      const dataPoints = extractDataPoints(cacheData, filename);

      // Filter by state if specified
      const filteredPoints = targetState
        ? dataPoints.filter(p => p.state === targetState)
        : dataPoints;

      if (filteredPoints.length === 0) continue;

      const analysis = analyzeStateDataClustering(filteredPoints);

      analysisResults.push({
        dataSource: filename.replace('.json', ''),
        totalPoints: filteredPoints.length,
        clustersFound: analysis.totalClusters,
        marylandClusters: analysis.marylandClusters.length,
        marylandPointsInClusters: analysis.marylandPointsInClusters,
        clusters: targetState === 'MD' ? analysis.marylandClusters : analysis.allClusters.slice(0, 10), // Limit output
      });

    } catch (fileError) {
      console.log(`Could not analyze ${filename}:`, fileError.message);
      continue;
    }
  }

  return {
    targetState: targetState || 'ALL',
    dataSource,
    timestamp: new Date(),
    results: analysisResults,
    summary: {
      totalDataSources: analysisResults.length,
      totalClusters: analysisResults.reduce((sum, r) => sum + r.clustersFound, 0),
      totalMarylandClusters: analysisResults.reduce((sum, r) => sum + r.marylandClusters, 0),
      largestCluster: Math.max(...analysisResults.flatMap(r => r.clusters.map(c => c.points.length)), 0),
    },
  };
}

/**
 * Extract coordinate data points from various cache formats
 */
function extractDataPoints(cacheData: any, filename: string) {
  const points = [];

  if (filename.includes('wqp')) {
    // WQP format: grid-based with records
    for (const [gridKey, gridData] of Object.entries(cacheData.grid || {})) {
      const records = (gridData as any).records || [];
      for (const record of records) {
        if (record.lat && record.lng && record.state) {
          points.push({
            id: record.stn || `wqp-${record.lat}-${record.lng}`,
            name: record.name || 'Unknown Station',
            lat: parseFloat(record.lat),
            lng: parseFloat(record.lng),
            state: record.state,
            type: 'monitoring_station',
            source: 'wqp',
          });
        }
      }
    }
  } else if (filename.includes('icis')) {
    // ICIS format: permits, violations, etc.
    for (const [gridKey, gridData] of Object.entries(cacheData.grid || {})) {
      const permits = (gridData as any).permits || [];
      for (const permit of permits) {
        if (permit.lat && permit.lng && permit.state) {
          points.push({
            id: permit.permit || `icis-${permit.lat}-${permit.lng}`,
            name: permit.facility || 'Unknown Facility',
            lat: parseFloat(permit.lat),
            lng: parseFloat(permit.lng),
            state: permit.state,
            type: 'wastewater_facility',
            source: 'icis',
          });
        }
      }
    }
  } else if (filename.includes('attains')) {
    // ATTAINS format: water body assessments
    const features = cacheData.features || [];
    for (const feature of features) {
      if (feature.geometry?.coordinates && feature.properties?.state) {
        const [lng, lat] = feature.geometry.coordinates;
        points.push({
          id: feature.properties.id || `attains-${lat}-${lng}`,
          name: feature.properties.name || 'Water Body',
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          state: feature.properties.state,
          type: 'water_body',
          source: 'attains',
        });
      }
    }
  }
  // Add more format handlers as needed

  return points;
}

/**
 * Get Maryland-specific coordinate fixes
 */
async function getMarylandCoordinateFixes() {
  return {
    state: 'MD',
    fixesAvailable: Object.keys(applyMarylandCoordinateFixes([])).length,
    fixes: Object.entries({}).map(([id, fix]) => ({ // Maryland fixes would go here
      id,
      ...fix,
    })),
    instructions: 'Apply these coordinate fixes to prevent Maryland data point clustering',
    timestamp: new Date(),
  };
}

/**
 * Apply clustering fixes to data points
 */
async function applyClusteringFixes(dataPoints: any[], targetState?: string) {
  // Filter to target state if specified
  const filteredPoints = targetState
    ? dataPoints.filter(p => p.state === targetState)
    : dataPoints;

  const analysis = analyzeStateDataClustering(filteredPoints);
  let clustersFixed = 0;
  const fixedData = [...dataPoints];

  // Apply spread coordinates to clustered points
  for (const cluster of analysis.allClusters) {
    const spreadCoords = generateStateSpreadCoordinates(cluster);
    clustersFixed++;

    for (const spreadCoord of spreadCoords) {
      const pointIndex = fixedData.findIndex(p => p.id === spreadCoord.id);
      if (pointIndex !== -1) {
        fixedData[pointIndex] = {
          ...fixedData[pointIndex],
          lat: spreadCoord.newLat,
          lng: spreadCoord.newLng,
        };
      }
    }
  }

  return {
    originalData: dataPoints,
    fixedData,
    clustersFixed,
    pointsAffected: analysis.allClusters.reduce((sum, c) => sum + c.points.length, 0),
  };
}