/* ------------------------------------------------------------------ */
/*  PIN Sentinel — USGS IV Adapter                                    */
/*  Reads existing nwisIvCache, detects value changes & thresholds    */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getExistingGrid, type UsgsIvSite, type UsgsIvReading } from '../../nwisIvCache';

const SOURCE = 'USGS_IV' as const;

/** Significant change = >10% delta from previous reading */
const SIGNIFICANT_CHANGE_PCT = 0.10;

/** Basic gage-height thresholds (feet) — simplified from USGS flood categories */
const GAGE_THRESHOLDS = {
  action:   8,
  minor:   12,
  moderate: 18,
  major:   25,
};

function severityFromGage(value: number): SeverityHint | null {
  if (value >= GAGE_THRESHOLDS.major)    return 'CRITICAL';
  if (value >= GAGE_THRESHOLDS.moderate) return 'HIGH';
  if (value >= GAGE_THRESHOLDS.minor)    return 'MODERATE';
  if (value >= GAGE_THRESHOLDS.action)   return 'LOW';
  return null;
}

function getAllSitesAndReadings(): { sites: Map<string, UsgsIvSite>; readings: UsgsIvReading[] } {
  const grid = getExistingGrid();
  if (!grid) return { sites: new Map(), readings: [] };

  const sites = new Map<string, UsgsIvSite>();
  const readings: UsgsIvReading[] = [];

  for (const cell of Object.values(grid)) {
    for (const s of cell.sites) sites.set(s.siteNumber, s);
    readings.push(...cell.readings);
  }

  return { sites, readings };
}

export function pollUsgs(prevState: SentinelSourceState): AdapterResult {
  const { sites, readings } = getAllSitesAndReadings();
  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();
  const prevValues = prevState.lastValues ?? {};
  const currentValues: Record<string, number> = {};

  // Group readings by site for latest value per parameter
  const latestBySite = new Map<string, Map<string, UsgsIvReading>>();
  for (const r of readings) {
    if (!latestBySite.has(r.siteNumber)) latestBySite.set(r.siteNumber, new Map());
    const siteMap = latestBySite.get(r.siteNumber)!;
    const existing = siteMap.get(r.parameterCd);
    if (!existing || new Date(r.dateTime) > new Date(existing.dateTime)) {
      siteMap.set(r.parameterCd, r);
    }
  }

  for (const [siteNum, paramMap] of latestBySite) {
    const site = sites.get(siteNum);

    for (const [paramCd, reading] of paramMap) {
      const key = `${siteNum}_${paramCd}`;
      currentValues[key] = reading.value;

      const prevVal = prevValues[key];

      // Check gage height thresholds (param 00065)
      if (paramCd === '00065' && reading.value != null) {
        const severity = severityFromGage(reading.value);
        if (severity) {
          const prevSev = prevVal != null ? severityFromGage(prevVal) : null;
          // Only emit on initial crossing or escalation
          if (!prevSev || severityRank(severity) > severityRank(prevSev)) {
            events.push({
              eventId: `usgs-thr-${siteNum}-${paramCd}-${Date.now().toString(36)}`,
              source: SOURCE,
              detectedAt: now,
              sourceTimestamp: reading.dateTime,
              changeType: 'THRESHOLD_CROSSED',
              geography: {
                huc8: site?.huc,
                huc6: site?.huc?.slice(0, 6),
                stateAbbr: site?.state,
                lat: reading.lat,
                lng: reading.lng,
              },
              severityHint: severity,
              payload: {
                siteNumber: siteNum,
                siteName: site?.siteName,
                parameter: reading.parameterName,
                parameterCd: paramCd,
              },
              metadata: {
                sourceRecordId: `${siteNum}-${paramCd}`,
                previousValue: prevVal ?? undefined,
                currentValue: reading.value,
                threshold: thresholdForSeverity(severity),
              },
            });
          }
        }
      }

      // Significant value change detection (>10% delta)
      if (prevVal != null && reading.value != null && prevVal !== 0) {
        const pctChange = Math.abs((reading.value - prevVal) / prevVal);
        if (pctChange >= SIGNIFICANT_CHANGE_PCT) {
          const severity: SeverityHint = pctChange >= 0.5 ? 'HIGH' : pctChange >= 0.25 ? 'MODERATE' : 'LOW';
          events.push({
            eventId: `usgs-chg-${siteNum}-${paramCd}-${Date.now().toString(36)}`,
            source: SOURCE,
            detectedAt: now,
            sourceTimestamp: reading.dateTime,
            changeType: 'VALUE_CHANGE',
            geography: {
              huc8: site?.huc,
              huc6: site?.huc?.slice(0, 6),
              stateAbbr: site?.state,
              lat: reading.lat,
              lng: reading.lng,
            },
            severityHint: severity,
            payload: {
              siteNumber: siteNum,
              siteName: site?.siteName,
              parameter: reading.parameterName,
              parameterCd: paramCd,
              pctChange: Math.round(pctChange * 100),
            },
            metadata: {
              sourceRecordId: `${siteNum}-${paramCd}`,
              previousValue: prevVal,
              currentValue: reading.value,
            },
          });
        }
      }
    }
  }

  return {
    events,
    updatedState: {
      lastValues: currentValues,
    },
  };
}

/* ── Helpers ─────────────────────────────────────────────────────── */

const SEV_RANK: Record<string, number> = { LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };
function severityRank(s: SeverityHint): number { return SEV_RANK[s] ?? 0; }

function thresholdForSeverity(s: SeverityHint): number {
  switch (s) {
    case 'CRITICAL': return GAGE_THRESHOLDS.major;
    case 'HIGH':     return GAGE_THRESHOLDS.moderate;
    case 'MODERATE': return GAGE_THRESHOLDS.minor;
    default:         return GAGE_THRESHOLDS.action;
  }
}
