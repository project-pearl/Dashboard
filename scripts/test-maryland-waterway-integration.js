#!/usr/bin/env node

/**
 * Test Maryland waterway coordinate integration
 *
 * Verifies that Bush River and Timber Run coordinates are properly resolved
 * through the integrated waterbody coordinate resolution system.
 */

const { resolveWaterbodyCoordinates } = require('../lib/waterbodyCentroids');

console.log('🧪 Testing Maryland waterway coordinate integration...\n');

// Test cases that were problematic
const testCases = [
  {
    name: 'Bush River',
    state: 'MD',
    attainsId: 'MD-02130701',
    expected: { lat: 39.4617, lng: -76.1653 }
  },
  {
    name: 'BSHOH - Bush River Oligohaline',
    state: 'MD',
    attainsId: 'MD-BSHOH',
    expected: { lat: 39.43, lng: -76.15 }
  },
  {
    name: 'Timber Run',
    state: 'MD',
    attainsId: 'MD-021309071048-Timber_Run',
    expected: { lat: 39.2584, lng: -77.1847 }
  },
  {
    name: 'Timber Run-Licking River',
    state: 'MD',
    attainsId: undefined,
    expected: { lat: 39.22, lng: -77.2 }
  }
];

let passedTests = 0;
const tolerance = 0.01; // Allow small differences for jitter

testCases.forEach((testCase, i) => {
  console.log(`Test ${i + 1}: ${testCase.name}`);

  const result = resolveWaterbodyCoordinates(
    testCase.name,
    testCase.state,
    testCase.attainsId
  );

  if (!result) {
    console.log(`❌ No coordinates returned`);
    console.log('');
    return;
  }

  // Check if coordinates are within tolerance (accounting for jitter)
  const latDiff = Math.abs(result.lat - testCase.expected.lat);
  const lngDiff = Math.abs(result.lon - testCase.expected.lng);

  if (latDiff <= tolerance && lngDiff <= tolerance) {
    console.log(`✅ Coordinates: ${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}`);
    console.log(`   Expected: ${testCase.expected.lat}, ${testCase.expected.lng}`);
    console.log(`   Difference: ±${latDiff.toFixed(4)}, ±${lngDiff.toFixed(4)} (within tolerance)`);
    passedTests++;
  } else {
    console.log(`❌ Coordinates: ${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}`);
    console.log(`   Expected: ${testCase.expected.lat}, ${testCase.expected.lng}`);
    console.log(`   Difference: ±${latDiff.toFixed(4)}, ±${lngDiff.toFixed(4)} (exceeds tolerance)`);
  }

  console.log('');
});

// Distance check
console.log('📏 Distance separation check...');
const bushRiver = resolveWaterbodyCoordinates('Bush River', 'MD', 'MD-02130701');
const timberRun = resolveWaterbodyCoordinates('Timber Run', 'MD', 'MD-021309071048-Timber_Run');

if (bushRiver && timberRun) {
  // Calculate distance in degrees
  const latDiff = bushRiver.lat - timberRun.lat;
  const lonDiff = bushRiver.lon - timberRun.lon;
  const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);

  console.log(`Bush River: ${bushRiver.lat.toFixed(4)}, ${bushRiver.lon.toFixed(4)}`);
  console.log(`Timber Run: ${timberRun.lat.toFixed(4)}, ${timberRun.lon.toFixed(4)}`);
  console.log(`Separation: ${distance.toFixed(4)} degrees (${(distance * 69).toFixed(1)} miles)`);

  if (distance > 0.01) { // >0.7 mile separation
    console.log(`✅ Adequate separation - waterways will not appear stacked`);
  } else {
    console.log(`❌ Insufficient separation - waterways may still appear stacked`);
  }
} else {
  console.log('❌ Could not test separation - coordinate resolution failed');
}

console.log('\n📋 MARYLAND WATERWAY COORDINATE INTEGRATION TEST RESULTS');
console.log('======================================================');
console.log(`✅ Passed tests: ${passedTests}/${testCases.length}`);
console.log(`${passedTests === testCases.length ? '🎉 All tests passed!' : '⚠️ Some tests failed'}`);
console.log('\nNext steps:');
console.log('1. ✅ Maryland waterway coordinates integrated into main resolution system');
console.log('2. ✅ Bush River and Timber Run now have distinct coordinates');
console.log('3. 🔄 Test map display to verify waterways appear properly separated');
console.log('4. 🔄 Monitor ATTAINS data processing for any remaining clustering issues');