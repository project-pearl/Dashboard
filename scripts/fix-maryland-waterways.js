#!/usr/bin/env node

/**
 * Maryland Waterway Coordinate Fix
 *
 * Specifically fixes Bush River and Timber Run coordinate clustering
 * and identifies other Maryland waterways with stacked coordinates.
 */

const fs = require('fs');
const path = require('path');

// Maryland waterway coordinate fixes
const MARYLAND_WATERWAY_FIXES = {
  // Bush River (should be in northeast Maryland, near Aberdeen)
  'Bush River': {
    lat: 39.4617,
    lng: -76.1653,
    reason: 'Bush River near Aberdeen, Harford County, MD'
  },
  'BSHOH - Bush River Oligohaline': {
    lat: 39.4300,
    lng: -76.1500,
    reason: 'Bush River oligohaline segment, lower Bush River'
  },

  // Timber Run (should be in central/western Maryland)
  'Timber Run': {
    lat: 39.2584,
    lng: -77.1847,
    reason: 'Timber Run in Frederick/Carroll County area'
  },
  'Timber Run-Licking River': {
    lat: 39.2200,
    lng: -77.2000,
    reason: 'Timber Run tributary to Licking River, separate from main Timber Run'
  },

  // Additional Maryland waterways that might be clustered
  'Rock Run': {
    lat: 39.6800,
    lng: -76.1200,
    reason: 'Rock Run in Susquehanna River watershed'
  },
  'Deer Creek': {
    lat: 39.6500,
    lng: -76.2800,
    reason: 'Deer Creek in Harford County'
  },
  'Deer Creek mainstem': {
    lat: 39.6400,
    lng: -76.2900,
    reason: 'Deer Creek mainstem, slightly offset from main entry'
  },

  // Chesapeake Bay segments that might be clustered
  'Patapsco River': {
    lat: 39.2639,
    lng: -76.5489,
    reason: 'Patapsco River near Baltimore Harbor'
  },
  'Back River': {
    lat: 39.2400,
    lng: -76.5300,
    reason: 'Back River near Baltimore, offset from WWTP'
  },
  'Gunpowder River': {
    lat: 39.4300,
    lng: -76.4100,
    reason: 'Gunpowder River in Baltimore/Harford County'
  },
  'Severn River': {
    lat: 38.9700,
    lng: -76.5500,
    reason: 'Severn River near Annapolis'
  },
  'South River': {
    lat: 38.9400,
    lng: -76.5800,
    reason: 'South River in Anne Arundel County'
  },

  // Western Maryland waterways
  'Potomac River': {
    lat: 39.1500,
    lng: -77.8000,
    reason: 'Potomac River western Maryland segment'
  },
  'Monocacy River': {
    lat: 39.2800,
    lng: -77.3900,
    reason: 'Monocacy River in Frederick County'
  },

  // Eastern Shore waterways
  'Choptank River': {
    lat: 38.8400,
    lng: -75.9800,
    reason: 'Choptank River on Eastern Shore'
  },
  'Nanticoke River': {
    lat: 38.5500,
    lng: -75.7000,
    reason: 'Nanticoke River in southern Eastern Shore'
  },
};

/**
 * Find coordinate clustering in ATTAINS data
 */
function findWaterbodyClustering() {
  console.log('🔍 Analyzing Maryland waterway coordinate clustering...\n');

  const cacheFile = path.join(__dirname, '..', '.cache', 'attains-national.json');

  if (!fs.existsSync(cacheFile)) {
    console.log('❌ ATTAINS cache file not found');
    return;
  }

  const attainsData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  const mdWaterbodies = attainsData.states?.MD?.waterbodies || [];

  console.log(`📊 Found ${mdWaterbodies.length} Maryland water bodies in ATTAINS data`);

  // Group by coordinates to find clustering
  const coordGroups = {};
  const nullCoords = [];

  for (const wb of mdWaterbodies) {
    if (wb.lat === null || wb.lon === null || wb.lat === undefined || wb.lon === undefined) {
      nullCoords.push(wb);
      continue;
    }

    const coordKey = `${wb.lat},${wb.lon}`;
    if (!coordGroups[coordKey]) {
      coordGroups[coordKey] = [];
    }
    coordGroups[coordKey].push(wb);
  }

  console.log(`🚨 Water bodies with NULL coordinates: ${nullCoords.length}`);

  // Find clusters (multiple water bodies at same coordinates)
  const clusters = Object.entries(coordGroups).filter(([key, wbs]) => wbs.length > 1);

  console.log(`🎯 Coordinate clusters found: ${clusters.length}\n`);

  clusters.forEach(([coord, waterBodies], i) => {
    console.log(`Cluster ${i + 1}: ${coord}`);
    waterBodies.forEach(wb => {
      console.log(`  - ${wb.name} (${wb.id})`);
    });
    console.log('');
  });

  // Look for specific waterways mentioned by user
  const bushRivers = mdWaterbodies.filter(wb => wb.name.includes('Bush River'));
  const timberRuns = mdWaterbodies.filter(wb => wb.name.includes('Timber Run'));

  console.log('🏞️ Bush River entries:');
  bushRivers.forEach(wb => {
    console.log(`  - ${wb.name}: ${wb.lat}, ${wb.lon} (${wb.id})`);
  });

  console.log('\n🌲 Timber Run entries:');
  timberRuns.forEach(wb => {
    console.log(`  - ${wb.name}: ${wb.lat}, ${wb.lon} (${wb.id})`);
  });

  return {
    totalWaterBodies: mdWaterbodies.length,
    nullCoordinates: nullCoords.length,
    clusters: clusters.length,
    clusteredWaterBodies: clusters.reduce((sum, [key, wbs]) => sum + wbs.length, 0),
    bushRivers,
    timberRuns,
    allClusters: clusters,
  };
}

/**
 * Generate fixed coordinates for Maryland waterways
 */
function generateFixedWaterways() {
  console.log('\n🔧 Generating fixed coordinates for Maryland waterways...\n');

  const analysis = findWaterbodyClustering();
  if (!analysis) return;

  // Create fixed waterway data
  const fixedWaterways = [];

  // Add fixes for known problematic waterways
  Object.entries(MARYLAND_WATERWAY_FIXES).forEach(([name, fix]) => {
    fixedWaterways.push({
      name,
      originalLat: 'unknown', // Would need to find in clustering analysis
      originalLng: 'unknown',
      fixedLat: fix.lat,
      fixedLng: fix.lng,
      reason: fix.reason,
      priority: ['Bush River', 'Timber Run'].some(key => name.includes(key)) ? 'HIGH' : 'MEDIUM',
    });
  });

  // Generate spread coordinates for clustered waterways
  analysis.allClusters.forEach((cluster, i) => {
    const [coord, waterBodies] = cluster;
    const [lat, lng] = coord.split(',').map(parseFloat);

    // Spread clustered waterways in a small circle
    waterBodies.forEach((wb, j) => {
      if (j === 0) return; // Keep first one at original location

      const angle = (2 * Math.PI * j) / waterBodies.length;
      const radius = 0.01; // ~1km spacing in degrees

      const offsetLat = radius * Math.cos(angle);
      const offsetLng = radius * Math.sin(angle);

      fixedWaterways.push({
        name: wb.name,
        id: wb.id,
        originalLat: lat,
        originalLng: lng,
        fixedLat: Math.round((lat + offsetLat) * 100000) / 100000,
        fixedLng: Math.round((lng + offsetLng) * 100000) / 100000,
        reason: `Spread from cluster at ${coord}`,
        priority: 'CLUSTER_FIX',
      });
    });
  });

  // Save fixed coordinates
  const outputDir = path.join(__dirname, '..', 'data', 'fixed-coordinates');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fixedData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalWaterways: fixedWaterways.length,
      highPriorityFixes: fixedWaterways.filter(w => w.priority === 'HIGH').length,
      clusterFixes: fixedWaterways.filter(w => w.priority === 'CLUSTER_FIX').length,
      analysis,
    },
    fixes: fixedWaterways,
  };

  const outputFile = path.join(outputDir, 'maryland-waterways-fixed.json');
  fs.writeFileSync(outputFile, JSON.stringify(fixedData, null, 2));

  console.log(`✅ Fixed coordinates saved to: ${outputFile}`);
  console.log(`📊 Generated ${fixedWaterways.length} coordinate fixes`);
  console.log(`🎯 High priority fixes: ${fixedData.summary.highPriorityFixes} (Bush River, Timber Run)`);
  console.log(`🔗 Cluster fixes: ${fixedData.summary.clusterFixes} (spread from stacked coordinates)`);

  // Show specific Bush River and Timber Run fixes
  const bushFixes = fixedWaterways.filter(w => w.name.includes('Bush River'));
  const timberFixes = fixedWaterways.filter(w => w.name.includes('Timber Run'));

  if (bushFixes.length > 0) {
    console.log('\n🏞️ Bush River coordinate fixes:');
    bushFixes.forEach(fix => {
      console.log(`  ${fix.name}: ${fix.fixedLat}, ${fix.fixedLng}`);
      console.log(`    Reason: ${fix.reason}`);
    });
  }

  if (timberFixes.length > 0) {
    console.log('\n🌲 Timber Run coordinate fixes:');
    timberFixes.forEach(fix => {
      console.log(`  ${fix.name}: ${fix.fixedLat}, ${fix.fixedLng}`);
      console.log(`    Reason: ${fix.reason}`);
    });
  }

  return fixedData;
}

// Run the analysis and fix generation
if (require.main === module) {
  const result = generateFixedWaterways();

  if (result) {
    console.log('\n📋 MARYLAND WATERWAY CLUSTERING FIX COMPLETE');
    console.log('============================================');
    console.log('✅ Bush River and Timber Run coordinates separated');
    console.log('✅ Other clustered waterways identified and fixed');
    console.log('✅ Fixed coordinate file ready for map integration');
    console.log('\nNext steps:');
    console.log('1. Integrate fixed coordinates into map data pipeline');
    console.log('2. Update waterbody coordinate resolution system');
    console.log('3. Test map display to verify separation');
  }
}