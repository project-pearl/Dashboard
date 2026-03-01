/* ------------------------------------------------------------------ */
/*  PIN Sentinel — ECHO Enforcement Adapter (Enhanced)                */
/*  Reads existing echoCache, builds per-facility compliance          */
/*  snapshots, detects escalations: SNC entry, qtrsInNc increases,    */
/*  new violations. Uses lastValues for delta detection.              */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getEchoAllData, type EchoFacility, type EchoViolation } from '../../echoCache';
import { findNearestHuc8 } from '../../hucLookup';

const SOURCE = 'ECHO_ENFORCEMENT' as const;

// ── Compliance snapshot per facility ──────────────────────────────────────

interface FacilitySnapshot {
  registryId: string;
  permitId: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  complianceStatus: string;
  qtrsInViolation: number;
  qtrsInNc: number;
  isSNC: boolean;
  violationTypes: string[];
}

function buildSnapshots(
  facilities: EchoFacility[],
  violations: EchoViolation[],
): Map<string, FacilitySnapshot> {
  const snapshots = new Map<string, FacilitySnapshot>();

  // Seed from facilities
  for (const f of facilities) {
    const isSNC = /^S/.test(f.complianceStatus) || /SNC|significant/i.test(f.complianceStatus);
    snapshots.set(f.registryId, {
      registryId: f.registryId,
      permitId: f.permitId,
      name: f.name,
      state: f.state,
      lat: f.lat,
      lng: f.lng,
      complianceStatus: f.complianceStatus,
      qtrsInViolation: f.qtrsInViolation,
      qtrsInNc: 0,
      isSNC,
      violationTypes: [],
    });
  }

  // Enrich from violations
  for (const v of violations) {
    const snap = snapshots.get(v.registryId);
    if (snap) {
      snap.qtrsInNc = Math.max(snap.qtrsInNc, v.qtrsInNc);
      if (v.violationType) snap.violationTypes.push(v.violationType);
    } else {
      const isSNC = v.qtrsInNc >= 4;
      snapshots.set(v.registryId, {
        registryId: v.registryId,
        permitId: v.registryId,
        name: v.name,
        state: v.state,
        lat: v.lat,
        lng: v.lng,
        complianceStatus: isSNC ? 'SNC' : 'Violation',
        qtrsInViolation: v.qtrsInNc,
        qtrsInNc: v.qtrsInNc,
        isSNC,
        violationTypes: v.violationType ? [v.violationType] : [],
      });
    }
  }

  return snapshots;
}

// ── Flatten snapshots to lastValues format ────────────────────────────────

function flattenToValues(snapshots: Map<string, FacilitySnapshot>): Record<string, number> {
  const values: Record<string, number> = {};
  for (const [id, snap] of snapshots) {
    values[`${id}_qtrsInNc`] = snap.qtrsInNc;
    values[`${id}_qtrsInVio`] = snap.qtrsInViolation;
    values[`${id}_isSNC`] = snap.isSNC ? 1 : 0;
  }
  return values;
}

// ── Severity from qtrsInNc ────────────────────────────────────────────────

function severityFromQtrs(qtrs: number): SeverityHint {
  if (qtrs >= 8) return 'CRITICAL';
  if (qtrs >= 4) return 'HIGH';
  if (qtrs >= 2) return 'MODERATE';
  return 'LOW';
}

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

// ── Main poll function ───────────────────────────────────────────────────

export function pollEcho(prevState: SentinelSourceState): AdapterResult {
  const { violations, facilities } = getEchoAllData();

  const snapshots = buildSnapshots(facilities, violations);
  const currentValues = flattenToValues(snapshots);
  const prevValues = prevState.lastValues || {};
  const prevTimestamps = prevState.lastTimestamps || {};
  const hucCache: Record<string, string> = { ...prevTimestamps };

  // Also track known violation keys for NEW_RECORD detection
  const currentKeys: string[] = [];
  for (const v of violations) {
    currentKeys.push(`${v.registryId}|${v.violationType}|${v.pollutant}`);
  }
  const previousKeySet = new Set(prevState.knownIds);

  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  // 1. NEW_RECORD — new violation keys (keep existing behavior)
  for (let i = 0; i < violations.length; i++) {
    const v = violations[i];
    const key = currentKeys[i];

    if (!previousKeySet.has(key)) {
      const snap = snapshots.get(v.registryId);
      const huc = getHuc8(v.lat, v.lng, hucCache);

      events.push({
        eventId: `echo-new-${v.registryId.slice(-8)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: null,
        changeType: 'NEW_RECORD',
        geography: {
          stateAbbr: v.state,
          lat: v.lat,
          lng: v.lng,
          ...huc,
        },
        severityHint: severityFromQtrs(v.qtrsInNc),
        payload: {
          registryId: v.registryId,
          facilityName: v.name,
          violationType: v.violationType,
          pollutant: v.pollutant,
          qtrsInNc: v.qtrsInNc,
          permitId: snap?.permitId,
        },
        metadata: {
          sourceRecordId: key,
          facilityId: snap?.permitId ?? v.registryId,
        },
      });
    }
  }

  // 2. THRESHOLD_CROSSED — qtrsInNc crosses 2/4/8 thresholds
  const THRESHOLDS = [2, 4, 8];
  for (const [id, snap] of snapshots) {
    const prevQtrs = prevValues[`${id}_qtrsInNc`] ?? 0;
    const curQtrs = snap.qtrsInNc;

    if (curQtrs > prevQtrs) {
      for (const threshold of THRESHOLDS) {
        if (curQtrs >= threshold && prevQtrs < threshold) {
          const huc = getHuc8(snap.lat, snap.lng, hucCache);
          const severity: SeverityHint = threshold >= 8 ? 'CRITICAL' : threshold >= 4 ? 'HIGH' : 'MODERATE';

          events.push({
            eventId: `echo-thr-${id.slice(-8)}-${threshold}-${Date.now().toString(36)}`,
            source: SOURCE,
            detectedAt: now,
            sourceTimestamp: null,
            changeType: 'THRESHOLD_CROSSED',
            geography: {
              stateAbbr: snap.state,
              lat: snap.lat,
              lng: snap.lng,
              ...huc,
            },
            severityHint: severity,
            payload: {
              registryId: id,
              facilityName: snap.name,
              qtrsInNc: curQtrs,
              previousQtrsInNc: prevQtrs,
              threshold,
              permitId: snap.permitId,
            },
            metadata: {
              sourceRecordId: `${id}_qtrsInNc`,
              previousValue: prevQtrs,
              currentValue: curQtrs,
              threshold,
              facilityId: snap.permitId || id,
              escalationType: 'QTRS_INCREASE',
            },
          });
          break; // Only fire highest threshold crossed
        }
      }
    }
  }

  // 3. VALUE_CHANGE — SNC status entry (non-SNC → SNC)
  for (const [id, snap] of snapshots) {
    const prevSNC = prevValues[`${id}_isSNC`] ?? 0;
    const curSNC = snap.isSNC ? 1 : 0;

    if (curSNC === 1 && prevSNC === 0) {
      const huc = getHuc8(snap.lat, snap.lng, hucCache);

      events.push({
        eventId: `echo-snc-${id.slice(-8)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: null,
        changeType: 'VALUE_CHANGE',
        geography: {
          stateAbbr: snap.state,
          lat: snap.lat,
          lng: snap.lng,
          ...huc,
        },
        severityHint: 'HIGH',
        payload: {
          registryId: id,
          facilityName: snap.name,
          previousStatus: 'Non-SNC',
          currentStatus: snap.complianceStatus,
          qtrsInNc: snap.qtrsInNc,
          permitId: snap.permitId,
        },
        metadata: {
          sourceRecordId: `${id}_isSNC`,
          previousValue: 0,
          currentValue: 1,
          facilityId: snap.permitId || id,
          previousStatus: 'Non-SNC',
          currentStatus: snap.complianceStatus,
          escalationType: 'SNC_ENTRY',
        },
      });
    }
  }

  return {
    events,
    updatedState: {
      knownIds: currentKeys,
      lastValues: currentValues,
      lastTimestamps: hucCache,
    },
  };
}
