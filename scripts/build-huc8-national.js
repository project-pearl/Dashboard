#!/usr/bin/env node
/**
 * build-huc8-national.js
 *
 * Fetches ALL HUC-8 watershed boundaries from the USGS WBD REST service,
 * computes polygon centroids, builds adjacency from HUC-6 prefix grouping
 * + cross-group centroid proximity, and writes:
 *
 *   data/huc8-centroids.json   — { [huc8]: { lat, lng } }
 *   data/huc8-adjacency.json   — { _meta, [huc8]: { huc6, adjacent, state } }
 *
 * Usage:  node scripts/build-huc8-national.js
 */

const fs = require('fs');
const path = require('path');

// USGS WBD MapServer Layer 4 = HUC-8
const BASE_URL =
  'https://hydro.nationalmap.gov/arcgis/rest/services/wbd/MapServer/4/query';

const BATCH_SIZE = 1000;
const CROSS_GROUP_KM = 80; // adjacency threshold for different HUC-6 groups within same HUC-4
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 5000;

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function haversineKm(lat1, lng1, lat2, lng2) {
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

/** Compute centroid from polygon ring(s) — simple arithmetic mean of vertices. */
function centroidFromRings(rings) {
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      sumLng += lng;
      sumLat += lat;
      count++;
    }
  }
  if (count === 0) return null;
  return {
    lat: Math.round((sumLat / count) * 100) / 100,
    lng: Math.round((sumLng / count) * 100) / 100,
  };
}

/** Derive primary state from the state names field (picks first 2-letter code). */
function primaryState(stateNames) {
  if (!stateNames) return undefined;
  // USGS returns state FIPS or abbreviations; sometimes comma-separated
  const match = stateNames.match(/\b([A-Z]{2})\b/);
  return match ? match[1] : undefined;
}

async function fetchWithRetry(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    if (json.error) {
      throw new Error(`ArcGIS error ${json.error.code}: ${json.error.message}`);
    }
    return json;
  } catch (err) {
    if (attempt >= RETRY_LIMIT) throw err;
    console.warn(`  Retry ${attempt}/${RETRY_LIMIT} after error: ${err.message}`);
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    return fetchWithRetry(url, attempt + 1);
  }
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

async function main() {
  console.log('=== Building national HUC-8 data ===\n');

  // Step 1: Discover total count
  const countUrl = `${BASE_URL}?where=1%3D1&returnCountOnly=true&f=json`;
  const countData = await fetchWithRetry(countUrl);
  const totalCount = countData.count;
  console.log(`Total HUC-8 features on server: ${totalCount}\n`);

  // Step 2: Page through all features
  const centroids = {};  // huc8 → { lat, lng }
  const stateMap = {};   // huc8 → state abbr
  let offset = 0;
  let fetched = 0;

  while (offset < totalCount) {
    const url =
      `${BASE_URL}?where=1%3D1` +
      `&outFields=huc8,name,states` +
      `&returnGeometry=true` +
      `&maxAllowableOffset=0.1` +
      `&geometryPrecision=2` +
      `&outSR=4326` +
      `&resultOffset=${offset}` +
      `&resultRecordCount=${BATCH_SIZE}` +
      `&f=json`;

    console.log(`  Fetching offset ${offset}...`);
    const data = await fetchWithRetry(url);
    const features = data.features ?? [];

    if (features.length === 0) {
      console.log('  No more features returned, done paging.');
      break;
    }

    for (const feat of features) {
      const huc8 = feat.attributes?.huc8;
      if (!huc8) continue;

      const geom = feat.geometry;
      if (geom?.rings) {
        const c = centroidFromRings(geom.rings);
        if (c) centroids[huc8] = c;
      }

      const st = primaryState(feat.attributes?.states);
      if (st) stateMap[huc8] = st;
    }

    fetched += features.length;
    offset += features.length;
    console.log(`  Got ${features.length} features (total ${fetched})`);
  }

  const huc8List = Object.keys(centroids).sort();
  console.log(`\nCentroids computed: ${huc8List.length}`);

  // Step 3: Build adjacency
  console.log('\nBuilding adjacency...');
  const adjacency = {}; // huc8 → Set of adjacent huc8s

  // 3a: Same HUC-6 prefix → always adjacent
  const huc6Groups = {};
  for (const huc8 of huc8List) {
    const h6 = huc8.slice(0, 6);
    if (!huc6Groups[h6]) huc6Groups[h6] = [];
    huc6Groups[h6].push(huc8);
  }

  for (const members of Object.values(huc6Groups)) {
    for (let i = 0; i < members.length; i++) {
      if (!adjacency[members[i]]) adjacency[members[i]] = new Set();
      for (let j = i + 1; j < members.length; j++) {
        if (!adjacency[members[j]]) adjacency[members[j]] = new Set();
        adjacency[members[i]].add(members[j]);
        adjacency[members[j]].add(members[i]);
      }
    }
  }

  // 3b: Cross-HUC-6 adjacency within same HUC-4 (centroid proximity < 80km)
  const huc4Groups = {};
  for (const huc8 of huc8List) {
    const h4 = huc8.slice(0, 4);
    if (!huc4Groups[h4]) huc4Groups[h4] = [];
    huc4Groups[h4].push(huc8);
  }

  let crossLinks = 0;
  for (const members of Object.values(huc4Groups)) {
    // Only check pairs in different HUC-6 groups
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i];
        const b = members[j];
        if (a.slice(0, 6) === b.slice(0, 6)) continue; // already linked

        const d = haversineKm(
          centroids[a].lat, centroids[a].lng,
          centroids[b].lat, centroids[b].lng
        );
        if (d < CROSS_GROUP_KM) {
          if (!adjacency[a]) adjacency[a] = new Set();
          if (!adjacency[b]) adjacency[b] = new Set();
          adjacency[a].add(b);
          adjacency[b].add(a);
          crossLinks++;
        }
      }
    }
  }

  console.log(`  Same-HUC-6 groups: ${Object.keys(huc6Groups).length}`);
  console.log(`  Cross-group links added: ${crossLinks}`);

  // Step 4: Write output files
  const outDir = path.join(__dirname, '..', 'data');

  // 4a: centroids
  const centroidsPath = path.join(outDir, 'huc8-centroids.json');
  const sortedCentroids = {};
  for (const k of huc8List) sortedCentroids[k] = centroids[k];
  fs.writeFileSync(centroidsPath, JSON.stringify(sortedCentroids, null, 2) + '\n');
  console.log(`\nWrote ${centroidsPath} (${huc8List.length} entries)`);

  // 4b: adjacency
  const adjPath = path.join(outDir, 'huc8-adjacency.json');
  const adjObj = {
    _meta: {
      description: 'HUC-8 adjacency lookup for water quality dashboard',
      source: 'USGS Watershed Boundary Dataset (WBD)',
      generated: new Date().toISOString().slice(0, 10),
      count: huc8List.length,
    },
  };

  for (const huc8 of huc8List) {
    adjObj[huc8] = {
      huc6: huc8.slice(0, 6),
      adjacent: adjacency[huc8] ? [...adjacency[huc8]].sort() : [],
      state: stateMap[huc8] || undefined,
    };
  }

  fs.writeFileSync(adjPath, JSON.stringify(adjObj, null, 2) + '\n');
  console.log(`Wrote ${adjPath} (${huc8List.length} entries)`);

  console.log('\n=== Done ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
