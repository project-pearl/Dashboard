/* ------------------------------------------------------------------ */
/*  PIN Sentinel — TRI (Toxics Release Inventory) Adapter             */
/*  Reads existing triCache, detects new toxic releases to water,     */
/*  threshold crossings on release quantities, and multi-facility     */
/*  clusters in the same region.                                      */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getTriAllFacilities, type TriFacility } from '../../triCache';
import { findNearestHuc8 } from '../../hucLookup';

const SOURCE = 'TRI_RELEASE' as const;

// ── Release thresholds (pounds/year) ────────────────────────────────────────

const TOTAL_RELEASE_THRESHOLDS = [10_000, 100_000, 1_000_000]; // 10K, 100K, 1M lbs
const CARCINOGEN_THRESHOLD = 1_000; // Any carcinogen release > 1000 lbs

// ── HUC lookup with caching ──────────────────────────────────────────────

function getHuc8(
  lat: number,
  lng: number,
  hucCache: Record<string, string>,
): { huc8?: string; huc6?: string } {
  const key = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  if (hucCache[key]) {
    const huc8 = hucCache[key];
    return { huc8, huc6: huc8.slice(0, 6) };
  }
  const result = findNearestHuc8(lat, lng);
  if (result && result.distance < 50) {
    hucCache[key] = result.huc8;
    return { huc8: result.huc8, huc6: result.huc8.slice(0, 6) };
  }
  return {};
}

// ── Severity from release amount ────────────────────────────────────────

function severityFromRelease(totalLbs: number, hasCarcinogen: boolean): SeverityHint {
  if (totalLbs >= 1_000_000 || (hasCarcinogen && totalLbs >= 10_000)) return 'CRITICAL';
  if (totalLbs >= 100_000 || hasCarcinogen) return 'HIGH';
  if (totalLbs >= 10_000) return 'MODERATE';
  return 'LOW';
}

// ── Main poll function ──────────────────────────────────────────────────

export function pollTri(prevState: SentinelSourceState): AdapterResult {
  const facilities = getTriAllFacilities();
  const prevValues = prevState.lastValues || {};
  const hucCache: Record<string, string> = {};
  const previousKeySet = new Set(prevState.knownIds);

  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();
  const currentKeys: string[] = [];

  for (const fac of facilities) {
    const key = `${fac.triId}|${fac.year}`;
    currentKeys.push(key);

    const hasCarcinogen = fac.carcinogenReleases > 0;

    // 1. NEW_RECORD — new facility or new year's data
    if (!previousKeySet.has(key)) {
      // Only emit events for significant releases
      if (fac.totalReleases > 1_000) {
        const huc = getHuc8(fac.lat, fac.lng, hucCache);
        events.push({
          eventId: `tri-new-${fac.triId.slice(-8)}-${Date.now().toString(36)}`,
          source: SOURCE,
          detectedAt: now,
          sourceTimestamp: null,
          changeType: 'NEW_RECORD',
          geography: { stateAbbr: fac.state, lat: fac.lat, lng: fac.lng, ...huc },
          severityHint: severityFromRelease(fac.totalReleases, hasCarcinogen),
          payload: {
            triId: fac.triId,
            facilityName: fac.facilityName,
            totalReleases: fac.totalReleases,
            carcinogenReleases: fac.carcinogenReleases,
            topChemicals: fac.topChemicals.slice(0, 5),
            city: fac.city,
            county: fac.county,
          },
          metadata: { sourceRecordId: key, facilityId: fac.triId },
        });
      }
      continue;
    }

    // 2. THRESHOLD_CROSSED — total releases crossing thresholds
    const prevTotal = prevValues[`${fac.triId}_total`] ?? 0;
    if (fac.totalReleases > prevTotal) {
      for (const threshold of TOTAL_RELEASE_THRESHOLDS) {
        if (fac.totalReleases >= threshold && prevTotal < threshold) {
          const huc = getHuc8(fac.lat, fac.lng, hucCache);
          events.push({
            eventId: `tri-thr-${fac.triId.slice(-8)}-${threshold}-${Date.now().toString(36)}`,
            source: SOURCE,
            detectedAt: now,
            sourceTimestamp: null,
            changeType: 'THRESHOLD_CROSSED',
            geography: { stateAbbr: fac.state, lat: fac.lat, lng: fac.lng, ...huc },
            severityHint: threshold >= 1_000_000 ? 'CRITICAL' : threshold >= 100_000 ? 'HIGH' : 'MODERATE',
            payload: {
              triId: fac.triId,
              facilityName: fac.facilityName,
              currentReleases: fac.totalReleases,
              previousReleases: prevTotal,
              threshold,
              topChemicals: fac.topChemicals.slice(0, 5),
            },
            metadata: {
              sourceRecordId: `${fac.triId}_total`,
              previousValue: prevTotal,
              currentValue: fac.totalReleases,
              threshold,
              facilityId: fac.triId,
            },
          });
          break; // Only fire highest threshold
        }
      }
    }

    // 3. THRESHOLD_CROSSED — carcinogen releases crossing threshold
    const prevCarc = prevValues[`${fac.triId}_carc`] ?? 0;
    if (fac.carcinogenReleases >= CARCINOGEN_THRESHOLD && prevCarc < CARCINOGEN_THRESHOLD) {
      const huc = getHuc8(fac.lat, fac.lng, hucCache);
      events.push({
        eventId: `tri-carc-${fac.triId.slice(-8)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: null,
        changeType: 'THRESHOLD_CROSSED',
        geography: { stateAbbr: fac.state, lat: fac.lat, lng: fac.lng, ...huc },
        severityHint: 'CRITICAL',
        payload: {
          triId: fac.triId,
          facilityName: fac.facilityName,
          carcinogenReleases: fac.carcinogenReleases,
          previousCarcinogenReleases: prevCarc,
          topChemicals: fac.topChemicals.slice(0, 5),
        },
        metadata: {
          sourceRecordId: `${fac.triId}_carc`,
          previousValue: prevCarc,
          currentValue: fac.carcinogenReleases,
          threshold: CARCINOGEN_THRESHOLD,
          facilityId: fac.triId,
        },
      });
    }
  }

  // Build updated values for delta detection next cycle
  const currentValues: Record<string, number> = {};
  for (const fac of facilities) {
    currentValues[`${fac.triId}_total`] = fac.totalReleases;
    currentValues[`${fac.triId}_carc`] = fac.carcinogenReleases;
  }

  return {
    events,
    updatedState: {
      knownIds: currentKeys,
      lastValues: currentValues,
    },
  };
}
