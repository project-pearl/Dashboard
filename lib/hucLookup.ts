/**
 * Nearest HUC-8 finder — loads huc8-centroids.json into a singleton
 * and finds the closest HUC-8 watershed by Haversine distance.
 */

let _centroids: Record<string, { lat: number; lng: number }> | null = null;

function getCentroids(): Record<string, { lat: number; lng: number }> {
  if (!_centroids) {
    _centroids = require('@/data/huc8-centroids.json') as Record<string, { lat: number; lng: number }>;
  }
  return _centroids;
}

/** Haversine distance in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Find the nearest HUC-8 watershed centroid to a given lat/lng.
 * Returns null if no centroids are loaded.
 */
export function findNearestHuc8(
  lat: number,
  lng: number,
): { huc8: string; distance: number } | null {
  const centroids = getCentroids();
  const entries = Object.entries(centroids);
  if (entries.length === 0) return null;

  let bestHuc = '';
  let bestDist = Infinity;

  for (const [huc8, centroid] of entries) {
    const d = haversineKm(lat, lng, centroid.lat, centroid.lng);
    if (d < bestDist) {
      bestDist = d;
      bestHuc = huc8;
    }
  }

  return bestHuc ? { huc8: bestHuc, distance: Math.round(bestDist * 10) / 10 } : null;
}
