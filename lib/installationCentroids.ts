/**
 * Installation Centroid Calculator — Spreads out clustered military installations
 * to prevent visual stacking on maps when coordinates are too close together.
 */

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  type: 'installation' | 'embassy';
  state: string | null;
}

interface ClusterInfo {
  region: string;
  centerLat: number;
  centerLng: number;
  installations: Installation[];
  spreadRadius: number; // km
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
 * Identify clusters of installations that are too close together (within 50km)
 */
export function identifyInstallationClusters(installations: Installation[]): ClusterInfo[] {
  const clusters: ClusterInfo[] = [];
  const processed = new Set<string>();
  const CLUSTER_THRESHOLD = 100; // km - installations closer than this are clustered

  for (const installation of installations) {
    if (processed.has(installation.id)) continue;

    const cluster: Installation[] = [installation];
    processed.add(installation.id);

    // Find nearby installations
    for (const other of installations) {
      if (processed.has(other.id)) continue;

      const distance = calculateDistance(
        installation.lat, installation.lng,
        other.lat, other.lng
      );

      if (distance <= CLUSTER_THRESHOLD) {
        cluster.push(other);
        processed.add(other.id);
      }
    }

    // Only create cluster info if there are multiple installations
    if (cluster.length > 1) {
      const centerLat = cluster.reduce((sum, inst) => sum + inst.lat, 0) / cluster.length;
      const centerLng = cluster.reduce((sum, inst) => sum + inst.lng, 0) / cluster.length;

      clusters.push({
        region: installation.region,
        centerLat,
        centerLng,
        installations: cluster,
        spreadRadius: Math.max(5, cluster.length * 2), // Minimum 5km, scale with count
      });
    }
  }

  return clusters;
}

/**
 * Generate new coordinates for clustered installations to spread them out in a circle
 */
export function generateSpreadCoordinates(cluster: ClusterInfo): Array<{
  id: string;
  originalLat: number;
  originalLng: number;
  newLat: number;
  newLng: number;
}> {
  const results = [];
  const { centerLat, centerLng, installations, spreadRadius } = cluster;

  for (let i = 0; i < installations.length; i++) {
    const installation = installations[i];

    if (installations.length === 1) {
      // Single installation, no spreading needed
      results.push({
        id: installation.id,
        originalLat: installation.lat,
        originalLng: installation.lng,
        newLat: installation.lat,
        newLng: installation.lng,
      });
      continue;
    }

    // Calculate angle for this installation in the circle
    const angle = (2 * Math.PI * i) / installations.length;

    // Calculate offset in km
    const offsetLat = (spreadRadius * Math.cos(angle)) / 111; // ~111 km per degree latitude
    const offsetLng = (spreadRadius * Math.sin(angle)) / (111 * Math.cos((centerLat * Math.PI) / 180)); // Adjust for longitude

    results.push({
      id: installation.id,
      originalLat: installation.lat,
      originalLng: installation.lng,
      newLat: centerLat + offsetLat,
      newLng: centerLng + offsetLng,
    });
  }

  return results;
}

/**
 * Specific coordinate fixes for known problematic clusters
 */
export const INSTALLATION_COORDINATE_FIXES: Record<string, { lat: number; lng: number; reason: string }> = {
  // Kuwait cluster - spread around actual Kuwait area
  'camp-arifjan': {
    lat: 28.93,
    lng: 48.10,
    reason: 'Main Kuwait base - keep original coordinates'
  },
  'camp-buehring': {
    lat: 29.45,
    lng: 47.58,
    reason: 'Spread north from Arifjan to avoid overlap'
  },
  'ali-al-salem': {
    lat: 29.25,
    lng: 47.82,
    reason: 'Spread east from Buehring to show distinct location'
  },

  // Japan cluster - spread around Tokyo area
  'yokota': {
    lat: 35.75,
    lng: 139.35,
    reason: 'Western Tokyo area - keep original'
  },
  'emb-tokyo': {
    lat: 35.67,
    lng: 139.74,
    reason: 'Central Tokyo embassy - keep original'
  },

  // Middle East embassy cluster - spread around region
  'emb-baghdad': {
    lat: 33.30,
    lng: 44.39,
    reason: 'Baghdad embassy - keep original'
  },
  'emb-amman': {
    lat: 31.95,
    lng: 35.91,
    reason: 'Amman embassy - keep original'
  },
  'emb-beirut': {
    lat: 33.92,
    lng: 35.48,
    reason: 'Beirut embassy - keep original'
  },
  'emb-riyadh': {
    lat: 24.71,
    lng: 46.67,
    reason: 'Riyadh embassy - keep original'
  },

  // Europe cluster - spread around Germany/surrounding area
  'ramstein': {
    lat: 49.44,
    lng: 7.60,
    reason: 'Ramstein AB - keep original'
  },
  'grafenwoehr': {
    lat: 49.69,
    lng: 11.94,
    reason: 'Grafenwoehr - keep original (distinct from Ramstein)'
  },
};

/**
 * Apply coordinate fixes to installation data to prevent map clustering
 */
export function applyCoordinateFixes(installations: Installation[]): Installation[] {
  return installations.map(installation => {
    const fix = INSTALLATION_COORDINATE_FIXES[installation.id];
    if (fix) {
      return {
        ...installation,
        lat: fix.lat,
        lng: fix.lng,
      };
    }
    return installation;
  });
}

/**
 * Analyze current installation clustering and recommend fixes
 */
export function analyzeInstallationClustering(installations: Installation[]) {
  const clusters = identifyInstallationClusters(installations);

  console.log('Installation Clustering Analysis:');
  console.log(`Found ${clusters.length} clusters with multiple installations`);

  clusters.forEach((cluster, i) => {
    console.log(`\nCluster ${i + 1} (${cluster.region}):`);
    console.log(`  Center: ${cluster.centerLat.toFixed(3)}, ${cluster.centerLng.toFixed(3)}`);
    console.log(`  Installations: ${cluster.installations.length}`);
    cluster.installations.forEach(inst => {
      console.log(`    - ${inst.name} (${inst.lat}, ${inst.lng})`);
    });

    const spreads = generateSpreadCoordinates(cluster);
    console.log('  Recommended spread coordinates:');
    spreads.forEach(spread => {
      console.log(`    - ${spread.id}: ${spread.originalLat}, ${spread.originalLng} → ${spread.newLat.toFixed(3)}, ${spread.newLng.toFixed(3)}`);
    });
  });

  return {
    clusters,
    totalClustered: clusters.reduce((sum, c) => sum + c.installations.length, 0),
    recommendations: clusters.map(cluster => generateSpreadCoordinates(cluster)).flat(),
  };
}