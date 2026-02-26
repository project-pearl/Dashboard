/* ------------------------------------------------------------------ */
/*  PIN Sentinel — QPE Rainfall Adapter                               */
/*  Composite: SNOTEL precip (west) + NWS precipitation observations  */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';

const SOURCE = 'QPE_RAINFALL' as const;
const FETCH_TIMEOUT = 15_000;

/** 24h precip thresholds (inches) */
const PRECIP_THRESHOLDS = {
  MODERATE: 2.0,
  HIGH: 4.0,
  CRITICAL: 6.0,
};

function severityFromPrecip(inches: number): SeverityHint | null {
  if (inches >= PRECIP_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (inches >= PRECIP_THRESHOLDS.HIGH)     return 'HIGH';
  if (inches >= PRECIP_THRESHOLDS.MODERATE) return 'MODERATE';
  return null;
}

/**
 * Fetch SNOTEL precipitation data from NRCS AWDB.
 * Western US stations with 24h precipitation.
 */
async function fetchSnotelPrecip(): Promise<{ stationId: string; precip24h: number; state: string; lat: number; lng: number }[]> {
  try {
    // NRCS AWDB web service for SNOTEL daily precip
    const url = 'https://wcc.sc.egov.usda.gov/reportGenerator/view_csv/customSingleStationReport/daily/end_of_period/network=%22SNTL%22%7Cname/-1,0/PREC::value?fitToScreen=false';

    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (!res.ok) return [];

    const text = await res.text();
    const lines = text.split('\n').filter(l => l && !l.startsWith('#'));
    const results: { stationId: string; precip24h: number; state: string; lat: number; lng: number }[] = [];

    // CSV header + data rows; format varies — parse conservatively
    for (const line of lines.slice(1)) {
      const parts = line.split(',');
      if (parts.length < 3) continue;
      const stationId = parts[0]?.trim();
      const precipStr = parts[parts.length - 1]?.trim();
      const precip = parseFloat(precipStr);
      if (!stationId || isNaN(precip)) continue;

      // Station IDs encode state: e.g., "302:CO:SNTL"
      const stateMatch = stationId.match(/:([A-Z]{2}):/);
      results.push({
        stationId,
        precip24h: precip,
        state: stateMatch?.[1] ?? '',
        lat: 0,
        lng: 0,
      });
    }

    return results;
  } catch (err: any) {
    console.warn(`[sentinel/qpe] SNOTEL fetch failed: ${err.message}`);
    return [];
  }
}

export async function pollQpe(prevState: SentinelSourceState): Promise<AdapterResult> {
  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  try {
    const snotelData = await fetchSnotelPrecip();

    for (const station of snotelData) {
      const severity = severityFromPrecip(station.precip24h);
      if (!severity) continue;

      const key = `${station.stationId}-${now.slice(0, 10)}`; // daily dedup key

      events.push({
        eventId: `qpe-${station.stationId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: now,
        changeType: 'THRESHOLD_CROSSED',
        geography: {
          stateAbbr: station.state || undefined,
          lat: station.lat || undefined,
          lng: station.lng || undefined,
        },
        severityHint: severity,
        payload: {
          stationId: station.stationId,
          precip24h: station.precip24h,
          thresholdExceeded: severity === 'CRITICAL' ? 6.0 : severity === 'HIGH' ? 4.0 : 2.0,
        },
        metadata: {
          sourceRecordId: key,
          currentValue: station.precip24h,
          threshold: severity === 'CRITICAL' ? 6.0 : severity === 'HIGH' ? 4.0 : 2.0,
        },
      });
    }

    return {
      events,
      updatedState: {},
    };
  } catch (err: any) {
    console.warn(`[sentinel/qpe] Poll failed: ${err.message}`);
    throw err;
  }
}
