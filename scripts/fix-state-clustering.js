#!/usr/bin/env node

/**
 * State Clustering Fix Script
 *
 * Analyzes and fixes coordinate clustering issues in state-level data.
 * Specifically addresses the Maryland "hundreds stacked in one place" issue.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CACHE_DIR = path.join(__dirname, '..', '.cache');
const CLUSTER_THRESHOLD = 0.01; // degrees (~1km)
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'fixed-coordinates');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Calculate distance between two coordinates
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Extract coordinate data from various cache formats
 */
function extractDataPoints(cacheData, filename) {
  const points = [];

  try {
    if (filename.includes('wqp')) {
      // WQP format: grid-based with records
      for (const [gridKey, gridData] of Object.entries(cacheData.grid || {})) {
        const records = gridData.records || [];
        for (const record of records) {
          if (record.lat && record.lng && record.state) {
            points.push({
              id: record.stn || `wqp-${record.lat}-${record.lng}-${Date.now()}`,
              name: record.name || 'Unknown Station',
              lat: parseFloat(record.lat),
              lng: parseFloat(record.lng),
              state: record.state,
              type: 'monitoring_station',
              source: 'wqp',
              originalData: record,
            });
          }
        }
      }
    } else if (filename.includes('icis')) {
      // ICIS format: permits with facilities
      for (const [gridKey, gridData] of Object.entries(cacheData.grid || {})) {
        const permits = gridData.permits || [];
        for (const permit of permits) {
          if (permit.lat && permit.lng && permit.state) {
            points.push({
              id: permit.permit || `icis-${permit.lat}-${permit.lng}-${Date.now()}`,
              name: permit.facility || 'Unknown Facility',
              lat: parseFloat(permit.lat),
              lng: parseFloat(permit.lng),
              state: permit.state,
              type: 'wastewater_facility',
              source: 'icis',
              originalData: permit,
            });
          }
        }
      }
    }
  } catch (error) {
    console.log(`Error extracting points from ${filename}:`, error.message);
  }

  return points;
}

/**
 * Find clusters of points that are too close together
 */
function findClusters(points, threshold = CLUSTER_THRESHOLD) {
  const clusters = [];
  const processed = new Set();

  for (const point of points) {
    if (processed.has(point.id)) continue;

    const cluster = [point];
    processed.add(point.id);

    // Find nearby points
    for (const otherPoint of points) {
      if (processed.has(otherPoint.id)) continue;

      const latDiff = Math.abs(point.lat - otherPoint.lat);
      const lngDiff = Math.abs(point.lng - otherPoint.lng);

      if (latDiff < threshold && lngDiff < threshold) {
        cluster.push(otherPoint);
        processed.add(otherPoint.id);
      }
    }

    if (cluster.length > 1) {
      clusters.push(cluster);
    }
  }

  return clusters;
}

/**
 * Generate spread coordinates for a cluster
 */
function generateSpreadCoordinates(cluster) {
  if (cluster.length <= 1) return cluster;

  const centerLat = cluster.reduce((sum, p) => sum + p.lat, 0) / cluster.length;
  const centerLng = cluster.reduce((sum, p) => sum + p.lng, 0) / cluster.length;

  // Calculate spread radius based on cluster size
  let spreadRadius = Math.max(0.01, Math.sqrt(cluster.length) * 0.008); // degrees

  // For very large clusters, use a grid pattern
  if (cluster.length > 50) {
    const gridSize = Math.ceil(Math.sqrt(cluster.length));

    return cluster.map((point, index) => {
      const row = Math.floor(index / gridSize);
      const col = index % gridSize;

      const offsetLat = ((row - gridSize / 2) * spreadRadius) / gridSize;
      const offsetLng = ((col - gridSize / 2) * spreadRadius) / gridSize;

      return {
        ...point,
        lat: centerLat + offsetLat,
        lng: centerLng + offsetLng,
        originalLat: point.lat,
        originalLng: point.lng,
        clustered: true,
        clusterSize: cluster.length,
      };
    });
  } else {
    // For smaller clusters, use circular pattern
    return cluster.map((point, index) => {
      const angle = (2 * Math.PI * index) / cluster.length;
      const radius = spreadRadius * (0.8 + Math.random() * 0.4); // Add some randomness

      const offsetLat = radius * Math.cos(angle);
      const offsetLng = radius * Math.sin(angle);

      return {
        ...point,
        lat: centerLat + offsetLat,
        lng: centerLng + offsetLng,
        originalLat: point.lat,
        originalLng: point.lng,
        clustered: true,
        clusterSize: cluster.length,
      };
    });
  }
}

/**
 * Main analysis and fix function
 */
function analyzeAndFixClustering() {
  console.log('🔍 Analyzing state data clustering...\n');

  const cacheFiles = fs.readdirSync(CACHE_DIR)
    .filter(file => file.endsWith('.json'))
    .filter(file => ['wqp', 'icis', 'attains', 'echo', 'nwis'].some(type => file.includes(type)));

  let totalAnalyzed = 0;
  let totalClusters = 0;
  let totalClusteredPoints = 0;
  let marylandClusters = 0;
  let marylandClusteredPoints = 0;

  const results = [];

  for (const filename of cacheFiles) {
    try {
      const filePath = path.join(CACHE_DIR, filename);
      const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      console.log(`📊 Analyzing ${filename}...`);

      const points = extractDataPoints(cacheData, filename);
      if (points.length === 0) {
        console.log(`   ⚠️  No coordinate data found\n`);
        continue;
      }

      totalAnalyzed += points.length;

      // Find clusters
      const clusters = findClusters(points);
      totalClusters += clusters.length;

      // Count clustered points
      const clusteredPoints = clusters.reduce((sum, cluster) => sum + cluster.length, 0);
      totalClusteredPoints += clusteredPoints;

      // Maryland-specific analysis
      const marylandPoints = points.filter(p => p.state === 'MD');
      const marylandClustersInFile = findClusters(marylandPoints);
      const marylandClusteredInFile = marylandClustersInFile.reduce((sum, cluster) => sum + cluster.length, 0);

      marylandClusters += marylandClustersInFile.length;
      marylandClusteredPoints += marylandClusteredInFile;

      console.log(`   📈 Total points: ${points.length}`);
      console.log(`   🎯 Clusters found: ${clusters.length}`);
      console.log(`   📍 Points in clusters: ${clusteredPoints}`);
      console.log(`   🏛️  Maryland points: ${marylandPoints.length}`);
      console.log(`   🔴 Maryland clusters: ${marylandClustersInFile.length}`);
      console.log(`   📊 Maryland clustered points: ${marylandClusteredInFile}\n`);

      // Generate fixes for large clusters (especially Maryland)
      if (marylandClustersInFile.length > 0) {
        console.log(`   🔧 Generating fixes for Maryland clusters...`);

        let allFixedPoints = [...points];

        for (const cluster of marylandClustersInFile) {
          if (cluster.length > 5) { // Only fix significant clusters
            const spreadCoords = generateSpreadCoordinates(cluster);

            // Replace clustered points with spread coordinates
            for (const spreadPoint of spreadCoords) {
              const index = allFixedPoints.findIndex(p => p.id === spreadPoint.id);
              if (index !== -1) {
                allFixedPoints[index] = spreadPoint;
              }
            }
          }
        }

        // Save fixed coordinates
        const fixedFilename = filename.replace('.json', '-fixed-coords.json');
        const fixedData = {
          ...cacheData,
          coordinatesFix: {
            applied: true,
            originalClusters: marylandClustersInFile.length,
            pointsSpread: marylandClusteredInFile,
            timestamp: new Date().toISOString(),
          },
          fixedPoints: allFixedPoints.filter(p => p.state === 'MD' && p.clustered),
        };

        fs.writeFileSync(
          path.join(OUTPUT_DIR, fixedFilename),
          JSON.stringify(fixedData, null, 2)
        );

        console.log(`   ✅ Fixed coordinates saved to: ${fixedFilename}\n`);
      }

      results.push({
        file: filename,
        totalPoints: points.length,
        clusters: clusters.length,
        clusteredPoints,
        marylandPoints: marylandPoints.length,
        marylandClusters: marylandClustersInFile.length,
        marylandClusteredPoints: marylandClusteredInFile,
      });

    } catch (error) {
      console.log(`❌ Error processing ${filename}:`, error.message);
      continue;
    }
  }

  // Summary report
  console.log('📋 CLUSTERING ANALYSIS SUMMARY');
  console.log('================================');
  console.log(`Total files analyzed: ${cacheFiles.length}`);
  console.log(`Total data points: ${totalAnalyzed.toLocaleString()}`);
  console.log(`Total clusters found: ${totalClusters}`);
  console.log(`Total clustered points: ${totalClusteredPoints.toLocaleString()}`);
  console.log(`\n🏛️  MARYLAND SPECIFIC:`);
  console.log(`Maryland clusters: ${marylandClusters}`);
  console.log(`Maryland clustered points: ${marylandClusteredPoints.toLocaleString()}`);

  if (marylandClusteredPoints > 0) {
    console.log(`\n✅ FIXES GENERATED:`);
    console.log(`Fixed coordinate files created in: ${OUTPUT_DIR}`);
    console.log(`Use these files to replace clustered coordinates in your maps.`);
  }

  // Save detailed report
  const reportPath = path.join(OUTPUT_DIR, 'clustering-analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: cacheFiles.length,
      totalPoints: totalAnalyzed,
      totalClusters,
      totalClusteredPoints,
      marylandClusters,
      marylandClusteredPoints,
    },
    results,
  }, null, 2));

  console.log(`\n📊 Detailed report saved: ${reportPath}`);
}

// Run the analysis
if (require.main === module) {
  analyzeAndFixClustering();
}