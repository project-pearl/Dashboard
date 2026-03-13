/* ------------------------------------------------------------------ */
/*  Shared Geospatial Utilities                                       */
/* ------------------------------------------------------------------ */

/**
 * Haversine distance between two lat/lng points, returned in miles.
 * Used by multiple triggers (FIRMS, NWS Weather, etc.).
 */
export function haversineMi(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8; // Earth radius in miles
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
 * Haversine distance between two points, returned in kilometers.
 * Accepts either 4 numbers or two {lat, lng} objects.
 */
export function haversineDistance(
  a: { lat: number; lng: number } | number,
  b: { lat: number; lng: number } | number,
  lat2?: number,
  lng2?: number,
): number {
  let la1: number, lo1: number, la2: number, lo2: number;
  if (typeof a === 'object' && typeof b === 'object') {
    la1 = a.lat; lo1 = a.lng; la2 = b.lat; lo2 = b.lng;
  } else {
    la1 = a as number; lo1 = b as number; la2 = lat2!; lo2 = lng2!;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((la2 - la1) * Math.PI) / 180;
  const dLng = ((lo2 - lo1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((la1 * Math.PI) / 180) *
      Math.cos((la2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Compute centroid of a GeoJSON polygon's outer ring.
 */
export function polygonCentroid(
  coordinates: number[][],
): { lat: number; lng: number } {
  let sumLat = 0;
  let sumLng = 0;
  for (const [lng, lat] of coordinates) {
    sumLat += lat;
    sumLng += lng;
  }
  return {
    lat: sumLat / coordinates.length,
    lng: sumLng / coordinates.length,
  };
}
