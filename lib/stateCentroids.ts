/**
 * State-Level Coordinate Clustering Fix — Spreads out clustered monitoring stations,
 * facilities, and other state-level data points to prevent visual stacking on maps.
 */

interface StateDataPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  state: string;
  type?: string;
  [key: string]: any;
}

interface StateCluster {
  state: string;
  centerLat: number;
  centerLng: number;
  points: StateDataPoint[];
  spreadRadius: number; // km
  clusterType: 'tight' | 'medium' | 'wide';
}

/**
 * Calculate distance between two points using haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Identify clusters of state data points that are too close together
 */
export function identifyStateDataClusters(
  dataPoints: StateDataPoint[],
  clusterThreshold = 2.0 // km - points closer than this are clustered
): StateCluster[] {
  const clusters: StateCluster[] = [];
  const processed = new Set<string>();

  // Group by state first
  const byState = dataPoints.reduce((acc, point) => {
    if (!acc[point.state]) acc[point.state] = [];
    acc[point.state].push(point);
    return acc;
  }, {} as Record<string, StateDataPoint[]>);

  // Process each state separately
  for (const [state, statePoints] of Object.entries(byState)) {
    for (const point of statePoints) {
      if (processed.has(point.id)) continue;

      const cluster: StateDataPoint[] = [point];
      processed.add(point.id);

      // Find nearby points within the same state
      for (const otherPoint of statePoints) {
        if (processed.has(otherPoint.id)) continue;

        const distance = calculateDistance(
          point.lat, point.lng,
          otherPoint.lat, otherPoint.lng
        );

        if (distance <= clusterThreshold) {
          cluster.push(otherPoint);
          processed.add(otherPoint.id);
        }
      }

      // Only create cluster if there are multiple points
      if (cluster.length > 1) {
        const centerLat = cluster.reduce((sum, p) => sum + p.lat, 0) / cluster.length;
        const centerLng = cluster.reduce((sum, p) => sum + p.lng, 0) / cluster.length;

        // Determine spread radius based on cluster size
        let spreadRadius = Math.max(2, Math.sqrt(cluster.length) * 1.5);
        let clusterType: StateCluster['clusterType'] = 'medium';

        if (cluster.length > 100) {
          spreadRadius = Math.sqrt(cluster.length) * 3;
          clusterType = 'wide';
        } else if (cluster.length > 20) {
          spreadRadius = Math.sqrt(cluster.length) * 2;
          clusterType = 'medium';
        } else {
          spreadRadius = Math.max(1, cluster.length * 0.8);
          clusterType = 'tight';
        }

        clusters.push({
          state,
          centerLat,
          centerLng,
          points: cluster,
          spreadRadius,
          clusterType,
        });
      }
    }
  }

  return clusters;
}

/**
 * Generate spread coordinates for clustered points
 */
export function generateStateSpreadCoordinates(cluster: StateCluster): Array<{
  id: string;
  originalLat: number;
  originalLng: number;
  newLat: number;
  newLng: number;
}> {
  const results = [];
  const { centerLat, centerLng, points, spreadRadius, clusterType } = cluster;

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    if (points.length === 1) {
      // Single point, no spreading needed
      results.push({
        id: point.id,
        originalLat: point.lat,
        originalLng: point.lng,
        newLat: point.lat,
        newLng: point.lng,
      });
      continue;
    }

    let newLat: number;
    let newLng: number;

    if (clusterType === 'wide' && points.length > 50) {
      // For large clusters, use a grid pattern
      const gridSize = Math.ceil(Math.sqrt(points.length));
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;

      const offsetLat = ((row - gridSize / 2) * spreadRadius) / (111 * gridSize);
      const offsetLng = ((col - gridSize / 2) * spreadRadius) / (111 * Math.cos((centerLat * Math.PI) / 180) * gridSize);

      newLat = centerLat + offsetLat;
      newLng = centerLng + offsetLng;
    } else {
      // For smaller clusters, use circular pattern
      const angle = (2 * Math.PI * i) / points.length;
      const radius = spreadRadius * (1 + Math.random() * 0.3); // Add some randomness

      const offsetLat = (radius * Math.cos(angle)) / 111;
      const offsetLng = (radius * Math.sin(angle)) / (111 * Math.cos((centerLat * Math.PI) / 180));

      newLat = centerLat + offsetLat;
      newLng = centerLng + offsetLng;
    }

    results.push({
      id: point.id,
      originalLat: point.lat,
      originalLng: point.lng,
      newLat: Math.round(newLat * 100000) / 100000, // Round to 5 decimal places
      newLng: Math.round(newLng * 100000) / 100000,
    });
  }

  return results;
}

/**
 * Maryland-specific coordinate fixes for known problematic clusters
 */
export const MARYLAND_COORDINATE_FIXES: Record<string, { lat: number; lng: number; reason: string }> = {
  // Baltimore area clusters
  'baltimore-wwtp-back-river': {
    lat: 39.24,
    lng: -76.53,
    reason: 'Back River WWTP - main facility'
  },
  'baltimore-wwtp-patapsco': {
    lat: 39.28,
    lng: -76.58,
    reason: 'Patapsco WWTP - spread north from Back River'
  },
  'baltimore-harbor-stations': {
    lat: 39.27,
    lng: -76.61,
    reason: 'Harbor monitoring stations - spread west'
  },

  // Chesapeake Bay monitoring stations
  'chesapeake-bay-center': {
    lat: 39.0,
    lng: -76.3,
    reason: 'Central Chesapeake Bay monitoring'
  },
  'chesapeake-bay-north': {
    lat: 39.3,
    lng: -76.2,
    reason: 'Northern Bay stations'
  },
  'chesapeake-bay-south': {
    lat: 38.7,
    lng: -76.4,
    reason: 'Southern Bay stations'
  },

  // Potomac River monitoring
  'potomac-river-dc': {
    lat: 38.93,
    lng: -77.12,
    reason: 'Potomac at Chain Bridge'
  },
  'potomac-river-upper': {
    lat: 39.1,
    lng: -77.8,
    reason: 'Upper Potomac monitoring'
  },
  'potomac-river-lower': {
    lat: 38.8,
    lng: -76.9,
    reason: 'Lower Potomac monitoring'
  },
};

/**
 * Apply coordinate fixes to Maryland state data to prevent clustering
 */
export function applyMarylandCoordinateFixes<T extends StateDataPoint>(dataPoints: T[]): T[] {
  return dataPoints.map(point => {
    const fix = MARYLAND_COORDINATE_FIXES[point.id];
    if (fix) {
      return {
        ...point,
        lat: fix.lat,
        lng: fix.lng,
      };
    }
    return point;
  });
}

/**
 * Comprehensive clustering analysis for state data
 */
export function analyzeStateDataClustering(dataPoints: StateDataPoint[]) {
  const clusters = identifyStateDataClusters(dataPoints);

  // Filter for Maryland clusters specifically
  const marylandClusters = clusters.filter(c => c.state === 'MD');
  const marylandPointsInClusters = marylandClusters.reduce((sum, c) => sum + c.points.length, 0);

  console.log('State Data Clustering Analysis:');
  console.log(`Total clusters found: ${clusters.length}`);
  console.log(`Maryland clusters: ${marylandClusters.length}`);
  console.log(`Maryland points in clusters: ${marylandPointsInClusters}`);

  marylandClusters.forEach((cluster, i) => {
    console.log(`\nMaryland Cluster ${i + 1}:`);
    console.log(`  Center: ${cluster.centerLat.toFixed(4)}, ${cluster.centerLng.toFixed(4)}`);
    console.log(`  Points: ${cluster.points.length}`);
    console.log(`  Type: ${cluster.clusterType}`);
    console.log(`  Spread radius: ${cluster.spreadRadius.toFixed(1)} km`);

    if (cluster.points.length > 20) {
      console.log(`  Sample points: ${cluster.points.slice(0, 5).map(p => p.name || p.id).join(', ')}...`);
    } else {
      cluster.points.forEach(point => {
        console.log(`    - ${point.name || point.id} (${point.lat}, ${point.lng})`);
      });
    }
  });

  return {
    totalClusters: clusters.length,
    marylandClusters,
    marylandPointsInClusters,
    allClusters: clusters,
    recommendations: marylandClusters.map(cluster => ({
      cluster: cluster.state,
      points: cluster.points.length,
      spreadCoords: generateStateSpreadCoordinates(cluster)
    }))
  };
}

/**
 * Get state centroid coordinates for spreading clustered points
 */
export const STATE_CENTROIDS: Record<string, { lat: number; lng: number; name: string }> = {
  'MD': { lat: 39.0458, lng: -76.6413, name: 'Maryland' },
  'VA': { lat: 37.4316, lng: -78.6569, name: 'Virginia' },
  'DC': { lat: 38.9072, lng: -77.0369, name: 'Washington DC' },
  'PA': { lat: 41.2033, lng: -77.1945, name: 'Pennsylvania' },
  'DE': { lat: 39.3185, lng: -75.5071, name: 'Delaware' },
  'WV': { lat: 38.4912, lng: -80.9540, name: 'West Virginia' },
  'NJ': { lat: 40.2989, lng: -74.5210, name: 'New Jersey' },
  'NC': { lat: 35.6301, lng: -79.8064, name: 'North Carolina' },
  'FL': { lat: 27.7663, lng: -81.6868, name: 'Florida' },
  'CA': { lat: 36.1162, lng: -119.6816, name: 'California' },
  'TX': { lat: 31.0545, lng: -97.5635, name: 'Texas' },
  'NY': { lat: 42.1657, lng: -74.9481, name: 'New York' },
  // Add more states as needed
};