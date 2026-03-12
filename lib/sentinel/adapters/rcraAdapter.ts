/* ------------------------------------------------------------------ */
/*  PIN Sentinel — RCRA Hazardous Waste Adapter                       */
/*  Reads existing rcraCache, detects new violations, SNC status      */
/*  changes, corrective action triggers, and facility type upgrades.  */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getRcraFacilitiesAll, type RcraFacility } from '../../rcraCache';
import { findNearestHuc8 } from '../../hucLookup';

const SOURCE = 'RCRA_VIOLATION' as const;

// ── Violation count thresholds ──────────────────────────────────────────────

const VIOLATION_THRESHOLDS = [3, 10, 25];

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

// ── Severity from violation count ───────────────────────────────────────

function severityFromViolations(count: number, isSNC: boolean): SeverityHint {
  if (isSNC || count >= 25) return 'CRITICAL';
  if (count >= 10) return 'HIGH';
  if (count >= 3) return 'MODERATE';
  return 'LOW';
}

// ── Main poll function ──────────────────────────────────────────────────

export function pollRcra(prevState: SentinelSourceState): AdapterResult {
  const facilities = getRcraFacilitiesAll();
  const prevValues = prevState.lastValues || {};
  const hucCache: Record<string, string> = {};
  const previousKeySet = new Set(prevState.knownIds);

  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();
  const currentKeys: string[] = [];

  for (const fac of facilities) {
    const key = `${fac.registryId}|${fac.facilityTypeCode}`;
    currentKeys.push(key);

    if (fac.lat === null || fac.lng === null) continue;

    // 1. NEW_RECORD — new facility appearing with violations
    if (!previousKeySet.has(key) && fac.violationCount > 0) {
      const huc = getHuc8(fac.lat, fac.lng, hucCache);
      events.push({
        eventId: `rcra-new-${fac.registryId.slice(-8)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: null,
        changeType: 'NEW_RECORD',
        geography: { stateAbbr: fac.state, lat: fac.lat, lng: fac.lng, ...huc },
        severityHint: severityFromViolations(fac.violationCount, fac.sncFlag),
        payload: {
          registryId: fac.registryId,
          facilityName: fac.facilityName,
          facilityType: fac.facilityTypeCode,
          violationCount: fac.violationCount,
          sncFlag: fac.sncFlag,
          penaltyAmount: fac.penaltyAmount,
        },
        metadata: { sourceRecordId: key, facilityId: fac.registryId },
      });
      continue;
    }

    // 2. THRESHOLD_CROSSED — violation count crossing thresholds
    const prevViolations = prevValues[`${fac.registryId}_violations`] ?? 0;
    if (fac.violationCount > prevViolations) {
      for (const threshold of VIOLATION_THRESHOLDS) {
        if (fac.violationCount >= threshold && prevViolations < threshold) {
          const huc = getHuc8(fac.lat, fac.lng, hucCache);
          events.push({
            eventId: `rcra-thr-${fac.registryId.slice(-8)}-${threshold}-${Date.now().toString(36)}`,
            source: SOURCE,
            detectedAt: now,
            sourceTimestamp: null,
            changeType: 'THRESHOLD_CROSSED',
            geography: { stateAbbr: fac.state, lat: fac.lat, lng: fac.lng, ...huc },
            severityHint: threshold >= 25 ? 'CRITICAL' : threshold >= 10 ? 'HIGH' : 'MODERATE',
            payload: {
              registryId: fac.registryId,
              facilityName: fac.facilityName,
              currentViolations: fac.violationCount,
              previousViolations: prevViolations,
              threshold,
              facilityType: fac.facilityTypeCode,
            },
            metadata: {
              sourceRecordId: `${fac.registryId}_violations`,
              previousValue: prevViolations,
              currentValue: fac.violationCount,
              threshold,
              facilityId: fac.registryId,
              escalationType: 'QTRS_INCREASE',
            },
          });
          break;
        }
      }
    }

    // 3. VALUE_CHANGE — SNC status entry (non-SNC → SNC)
    const prevSNC = prevValues[`${fac.registryId}_snc`] ?? 0;
    if (fac.sncFlag && prevSNC === 0) {
      const huc = getHuc8(fac.lat, fac.lng, hucCache);
      events.push({
        eventId: `rcra-snc-${fac.registryId.slice(-8)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: null,
        changeType: 'VALUE_CHANGE',
        geography: { stateAbbr: fac.state, lat: fac.lat, lng: fac.lng, ...huc },
        severityHint: 'HIGH',
        payload: {
          registryId: fac.registryId,
          facilityName: fac.facilityName,
          previousStatus: 'Non-SNC',
          currentStatus: 'SNC',
          violationCount: fac.violationCount,
          penaltyAmount: fac.penaltyAmount,
          facilityType: fac.facilityTypeCode,
        },
        metadata: {
          sourceRecordId: `${fac.registryId}_snc`,
          previousValue: 0,
          currentValue: 1,
          facilityId: fac.registryId,
          previousStatus: 'Non-SNC',
          currentStatus: 'SNC',
          escalationType: 'SNC_ENTRY',
        },
      });
    }
  }

  // Build updated values for delta detection next cycle
  const currentValues: Record<string, number> = {};
  for (const fac of facilities) {
    currentValues[`${fac.registryId}_violations`] = fac.violationCount;
    currentValues[`${fac.registryId}_snc`] = fac.sncFlag ? 1 : 0;
    currentValues[`${fac.registryId}_penalty`] = fac.penaltyAmount;
  }

  return {
    events,
    updatedState: {
      knownIds: currentKeys,
      lastValues: currentValues,
    },
  };
}
