/* ------------------------------------------------------------------ */
/*  PIN Sentinel — USGS IV Adapter                                    */
/*  Reads existing nwisIvCache, detects value changes & thresholds    */
/* ------------------------------------------------------------------ */

import type {
  AdapterResult,
  BedSiteState,
  ChangeEvent,
  SeverityHint,
  SentinelSourceState,
} from '../types';
import { getExistingGrid, type UsgsIvSite, type UsgsIvReading } from '../../nwisIvCache';
import { getBaseline, getDeviation, updateBaseline } from '../parameterBaselines';

const SOURCE = 'USGS_IV' as const;

/** Significant change = >10% delta from previous reading */
const SIGNIFICANT_CHANGE_PCT = 0.10;
const BASELINE_SIGMA_THRESHOLD = 2.2;
const BASELINE_OUTLIER_SKIP_SIGMA = 6;
const BED_MIN_PARAMS = 2;
const BED_MIN_ANOMALOUS = 2;
const BED_STEP_PROB_GATE = 0.45;
const BED_EVENT_PROB_THRESHOLD = 0.65;
const BED_RESET_PROBABILITY = 0.35;
const BED_ASSUMED_NOISE_PROB = 0.08;

const BED_PARAM_ALLOWLIST = new Set<string>([
  '00300', // Dissolved oxygen
  '00095', // Specific conductance
  '63680', // Turbidity
  '00400', // pH
  '00010', // Temperature
]);

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
  const prevBedState = prevState.bedState ?? {};
  const currentValues: Record<string, number> = {};
  const nextBedState: Record<string, BedSiteState> = {};

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
    const huc8 = site?.huc;
    const bedAnomalies: Array<{
      paramCd: string;
      parameterName: string;
      value: number;
      zScore: number;
      baselineMean: number;
      baselineStdDev: number;
    }> = [];
    let bedTrackedParams = 0;

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

      if (huc8 && Number.isFinite(reading.value)) {
        const z = getDeviation(huc8, paramCd, reading.value);
        const baseline = getBaseline(huc8, paramCd);

        if (BED_PARAM_ALLOWLIST.has(paramCd) && z != null && baseline) {
          bedTrackedParams += 1;
          if (Math.abs(z) >= BASELINE_SIGMA_THRESHOLD) {
            bedAnomalies.push({
              paramCd,
              parameterName: reading.parameterName,
              value: reading.value,
              zScore: z,
              baselineMean: baseline.mean,
              baselineStdDev: baseline.stdDev,
            });
          }
        }

        // Keep adaptive baseline current, but skip extreme outliers to avoid poisoning.
        if (z == null || Math.abs(z) < BASELINE_OUTLIER_SKIP_SIGMA) {
          updateBaseline(huc8, paramCd, reading.value);
        }
      }
    }

    const prevSiteState = prevBedState[siteNum];
    const prevProb = prevSiteState?.lastProbability ?? 0;
    const prevSeverity = prevSiteState?.lastSeverity;
    let nextStreak = prevSiteState?.streak ?? 0;
    let eventProbability = 0;

    if (bedTrackedParams >= BED_MIN_PARAMS) {
      const anomalousCount = bedAnomalies.length;
      const stepProbability = binomialTailProbability(
        bedTrackedParams,
        anomalousCount,
        BED_ASSUMED_NOISE_PROB,
      );

      if (anomalousCount >= BED_MIN_ANOMALOUS && stepProbability >= BED_STEP_PROB_GATE) {
        nextStreak = Math.max(1, nextStreak + 1);
      } else if (stepProbability < BED_RESET_PROBABILITY) {
        nextStreak = 0;
      }

      eventProbability = 1 - Math.pow(1 - Math.min(0.999, stepProbability), Math.max(1, nextStreak));

      const bedSeverity = severityFromBed(eventProbability);
      const shouldEmitBedEvent =
        bedSeverity != null &&
        anomalousCount >= BED_MIN_ANOMALOUS &&
        nextStreak >= 2 &&
        eventProbability >= BED_EVENT_PROB_THRESHOLD &&
        (prevProb < BED_EVENT_PROB_THRESHOLD || severityRank(bedSeverity) > severityRank(prevSeverity ?? 'LOW'));

      if (shouldEmitBedEvent) {
        const latestReadingTs = [...paramMap.values()]
          .map((r) => new Date(r.dateTime).getTime())
          .reduce((max, t) => Math.max(max, t), 0);

        events.push({
          eventId: `usgs-bed-${siteNum}-${Date.now().toString(36)}`,
          source: SOURCE,
          detectedAt: now,
          sourceTimestamp: latestReadingTs > 0 ? new Date(latestReadingTs).toISOString() : null,
          changeType: 'THRESHOLD_CROSSED',
          geography: {
            huc8: site?.huc,
            huc6: site?.huc?.slice(0, 6),
            stateAbbr: site?.state,
            lat: site?.lat,
            lng: site?.lng,
          },
          severityHint: bedSeverity,
          payload: {
            siteNumber: siteNum,
            siteName: site?.siteName,
            detection: 'BED',
            trackedParams: bedTrackedParams,
            anomalousParams: bedAnomalies.map((a) => ({
              parameterCd: a.paramCd,
              parameterName: a.parameterName,
              zScore: Math.round(a.zScore * 100) / 100,
              value: a.value,
              expected: Math.round(a.baselineMean * 100) / 100,
            })),
            signature: bedAnomalies.map((a) => a.paramCd).sort().join('|'),
          },
          metadata: {
            sourceRecordId: `${siteNum}-BED`,
            previousValue: prevProb,
            currentValue: Math.round(eventProbability * 1000) / 1000,
            threshold: BED_EVENT_PROB_THRESHOLD,
          },
        });
      }
    } else {
      nextStreak = 0;
    }

    nextBedState[siteNum] = {
      streak: nextStreak,
      lastProbability: Math.round(eventProbability * 1000) / 1000,
      lastSeverity: severityFromBed(eventProbability) ?? prevSeverity,
      updatedAt: now,
    };
  }

  return {
    events,
    updatedState: {
      lastValues: currentValues,
      bedState: nextBedState,
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

function severityFromBed(probability: number): SeverityHint | null {
  if (probability >= 0.92) return 'CRITICAL';
  if (probability >= 0.82) return 'HIGH';
  if (probability >= 0.72) return 'MODERATE';
  if (probability >= BED_EVENT_PROB_THRESHOLD) return 'LOW';
  return null;
}

function binomialTailProbability(n: number, anomalousCount: number, p: number): number {
  if (n <= 0 || anomalousCount <= 0) return 0;
  const k = Math.min(anomalousCount, n);
  let cdf = 0;
  for (let i = 0; i <= k - 1; i++) {
    cdf += combination(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
  }
  return Math.max(0, Math.min(1, 1 - cdf));
}

function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const r = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= r; i++) {
    result = (result * (n - r + i)) / i;
  }
  return result;
}
