/* ------------------------------------------------------------------ */
/*  PIN Sentinel — CAMPD Emissions Adapter                            */
/*  Reads existing campdCache, detects new compliance violations,     */
/*  emission spikes crossing thresholds, and facility status changes. */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getCampdAllFacilities, type CampdFacility } from '../../campdCache';
import { findNearestHuc8 } from '../../hucLookup';

const SOURCE = 'CAMPD_EMISSIONS' as const;

// ── Threshold config ────────────────────────────────────────────────────────

// SO2 thresholds (tons/year) — based on EPA ARP limits
const SO2_THRESHOLDS = [100, 500, 2000];
// NOx thresholds (tons/year)
const NOX_THRESHOLDS = [100, 500, 2000];

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

// ── Severity from emissions ─────────────────────────────────────────────

function severityFromSo2(tons: number): SeverityHint {
  if (tons >= 2000) return 'CRITICAL';
  if (tons >= 500) return 'HIGH';
  if (tons >= 100) return 'MODERATE';
  return 'LOW';
}

// ── Main poll function ──────────────────────────────────────────────────

export function pollCampd(prevState: SentinelSourceState): AdapterResult {
  const facilities = getCampdAllFacilities();
  const prevValues = prevState.lastValues || {};
  const hucCache: Record<string, string> = {};
  const previousKeySet = new Set(prevState.knownIds);

  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();
  const currentKeys: string[] = [];

  for (const fac of facilities) {
    const key = `${fac.facilityId}|${fac.year}`;
    currentKeys.push(key);

    // 1. NEW_RECORD — newly appearing facility
    if (!previousKeySet.has(key)) {
      if (fac.so2Tons > 100 || fac.noxTons > 100) {
        const huc = getHuc8(fac.lat, fac.lng, hucCache);
        events.push({
          eventId: `campd-new-${fac.facilityId}-${Date.now().toString(36)}`,
          source: SOURCE,
          detectedAt: now,
          sourceTimestamp: null,
          changeType: 'NEW_RECORD',
          geography: { stateAbbr: fac.state, lat: fac.lat, lng: fac.lng, ...huc },
          severityHint: severityFromSo2(fac.so2Tons),
          payload: {
            facilityId: fac.facilityId,
            facilityName: fac.facilityName,
            so2Tons: fac.so2Tons,
            noxTons: fac.noxTons,
            complianceStatus: fac.complianceStatus,
          },
          metadata: { sourceRecordId: key, facilityId: fac.facilityId },
        });
      }
      continue;
    }

    // 2. THRESHOLD_CROSSED — SO2 emissions crossing thresholds
    const prevSo2 = prevValues[`${fac.facilityId}_so2`] ?? 0;
    if (fac.so2Tons > prevSo2) {
      for (const threshold of SO2_THRESHOLDS) {
        if (fac.so2Tons >= threshold && prevSo2 < threshold) {
          const huc = getHuc8(fac.lat, fac.lng, hucCache);
          events.push({
            eventId: `campd-so2-${fac.facilityId}-${threshold}-${Date.now().toString(36)}`,
            source: SOURCE,
            detectedAt: now,
            sourceTimestamp: null,
            changeType: 'THRESHOLD_CROSSED',
            geography: { stateAbbr: fac.state, lat: fac.lat, lng: fac.lng, ...huc },
            severityHint: threshold >= 2000 ? 'CRITICAL' : threshold >= 500 ? 'HIGH' : 'MODERATE',
            payload: {
              facilityId: fac.facilityId,
              facilityName: fac.facilityName,
              pollutant: 'SO2',
              currentTons: fac.so2Tons,
              previousTons: prevSo2,
              threshold,
            },
            metadata: {
              sourceRecordId: `${fac.facilityId}_so2`,
              previousValue: prevSo2,
              currentValue: fac.so2Tons,
              threshold,
              facilityId: fac.facilityId,
            },
          });
          break; // Only fire highest threshold
        }
      }
    }

    // 3. VALUE_CHANGE — compliance status change (non-compliant)
    const prevCompliance = prevValues[`${fac.facilityId}_compliance`] ?? 0;
    const isExcessEmissions = /excess/i.test(fac.complianceStatus);
    if (isExcessEmissions && prevCompliance === 0) {
      const huc = getHuc8(fac.lat, fac.lng, hucCache);
      events.push({
        eventId: `campd-comply-${fac.facilityId}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: null,
        changeType: 'VALUE_CHANGE',
        geography: { stateAbbr: fac.state, lat: fac.lat, lng: fac.lng, ...huc },
        severityHint: 'HIGH',
        payload: {
          facilityId: fac.facilityId,
          facilityName: fac.facilityName,
          previousStatus: 'In Compliance',
          currentStatus: fac.complianceStatus,
          so2Tons: fac.so2Tons,
        },
        metadata: {
          sourceRecordId: `${fac.facilityId}_compliance`,
          previousValue: 0,
          currentValue: 1,
          facilityId: fac.facilityId,
          previousStatus: 'In Compliance',
          currentStatus: fac.complianceStatus,
          escalationType: 'STATUS_CHANGE',
        },
      });
    }
  }

  // Build updated values for delta detection next cycle
  const currentValues: Record<string, number> = {};
  for (const fac of facilities) {
    currentValues[`${fac.facilityId}_so2`] = fac.so2Tons;
    currentValues[`${fac.facilityId}_nox`] = fac.noxTons;
    currentValues[`${fac.facilityId}_compliance`] = /excess/i.test(fac.complianceStatus) ? 1 : 0;
  }

  return {
    events,
    updatedState: {
      knownIds: currentKeys,
      lastValues: currentValues,
    },
  };
}
