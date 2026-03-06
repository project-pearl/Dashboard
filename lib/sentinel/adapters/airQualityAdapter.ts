/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Air Quality Adapter                                */
/*  Reads airQualityCache and emits AQI / PM2.5 threshold events.     */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SentinelSourceState, SeverityHint } from '../types';
import { getAirQualityAllStates } from '@/lib/airQualityCache';

const SOURCE = 'AIR_QUALITY' as const;

function slug(v: string): string {
  return v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function buildJurisdictionHints(state: string, counties: Array<{ name: string; fips: string | null }>, primaryCounty: string | null): string[] {
  const hints = new Set<string>();
  hints.add(`state_${state.toLowerCase()}`);
  const countyNames = [
    ...(primaryCounty ? [primaryCounty] : []),
    ...counties.map((c) => c.name),
  ];
  for (const name of countyNames) {
    const cleaned = name.replace(/\bcounty\b/ig, '').replace(/\bparish\b/ig, '').trim();
    if (!cleaned) continue;
    hints.add(`${slug(cleaned)}_county_${state.toLowerCase()}`);
  }
  return Array.from(hints);
}

function severityFromAqi(aqi: number): SeverityHint {
  if (aqi >= 200) return 'CRITICAL';
  if (aqi >= 151) return 'HIGH';
  if (aqi >= 101) return 'MODERATE';
  return 'LOW';
}

function severityFromPm25(pm25: number): SeverityHint {
  if (pm25 >= 150.5) return 'CRITICAL';
  if (pm25 >= 55.5) return 'HIGH';
  if (pm25 >= 35.5) return 'MODERATE';
  return 'LOW';
}

export function pollAirQuality(prevState: SentinelSourceState): AdapterResult {
  const readings = getAirQualityAllStates();
  const previousIds = new Set(prevState.knownIds);
  const currentIds = new Set<string>();
  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  for (const r of readings) {
    if (!r.state) continue;

    const hasLowConfidence = r.confidence === 'low';
    const aqiThreshold = hasLowConfidence ? 151 : 101;
    const pm25Threshold = hasLowConfidence ? 55.5 : 35.5;

    if (r.usAqi != null && r.usAqi >= aqiThreshold) {
      const severity = severityFromAqi(r.usAqi);
      const band = severity === 'CRITICAL' ? 'critical' : severity === 'HIGH' ? 'high' : 'moderate';
      const dedupId = `${r.state}|aqi|${band}`;
      currentIds.add(dedupId);

      if (!previousIds.has(dedupId)) {
        events.push({
          eventId: `aqi-${r.state}-${band}-${Date.now().toString(36)}`,
          source: SOURCE,
          detectedAt: now,
          sourceTimestamp: r.timestamp,
          changeType: 'THRESHOLD_CROSSED',
          geography: {
            stateAbbr: r.state,
            lat: r.lat,
            lng: r.lng,
          },
          severityHint: severity,
          payload: {
            metric: 'us_aqi',
            value: r.usAqi,
            threshold: aqiThreshold,
            pm25: r.pm25,
            ozone: r.ozone,
            no2: r.no2,
            provider: r.provider,
            monitorCount: r.monitorCount,
            nearestMonitorDistanceMi: r.nearestMonitorDistanceMi,
            confidence: r.confidence,
            impactedCounty: r.impactedCounty,
            impactedCountyFips: r.impactedCountyFips,
            impactedCounties: r.impactedCounties.slice(0, 5),
            impactedZips: r.impactedZips.slice(0, 10),
            impactedZipCount: r.impactedZipCount,
            jurisdictionHints: buildJurisdictionHints(r.state, r.impactedCounties, r.impactedCounty),
            publicProtectionActions:
              severity === 'CRITICAL'
                ? [
                    'Issue immediate outdoor exposure advisory for sensitive groups.',
                    'Recommend schools suspend strenuous outdoor activity.',
                    'Coordinate with local health and emergency channels for same-day messaging.',
                  ]
                : severity === 'HIGH'
                  ? [
                      'Issue precautionary air quality notice for sensitive groups.',
                      'Advise reduced outdoor exertion during peak hours.',
                      'Increase communications cadence for public-facing channels.',
                    ]
                  : [
                      'Publish watch-level notice for sensitive populations.',
                      'Encourage voluntary exposure reduction where feasible.',
                    ],
          },
          metadata: {
            sourceRecordId: `${r.state}-us_aqi`,
            currentValue: r.usAqi,
            threshold: aqiThreshold,
          },
        });
      }
    }

    if (r.pm25 != null && r.pm25 >= pm25Threshold) {
      const severity = severityFromPm25(r.pm25);
      const band = severity === 'CRITICAL' ? 'critical' : severity === 'HIGH' ? 'high' : 'moderate';
      const dedupId = `${r.state}|pm25|${band}`;
      currentIds.add(dedupId);

      if (!previousIds.has(dedupId)) {
        events.push({
          eventId: `pm25-${r.state}-${band}-${Date.now().toString(36)}`,
          source: SOURCE,
          detectedAt: now,
          sourceTimestamp: r.timestamp,
          changeType: 'THRESHOLD_CROSSED',
          geography: {
            stateAbbr: r.state,
            lat: r.lat,
            lng: r.lng,
          },
          severityHint: severity,
          payload: {
            metric: 'pm2_5',
            value: r.pm25,
            threshold: pm25Threshold,
            usAqi: r.usAqi,
            ozone: r.ozone,
            no2: r.no2,
            provider: r.provider,
            monitorCount: r.monitorCount,
            nearestMonitorDistanceMi: r.nearestMonitorDistanceMi,
            confidence: r.confidence,
            impactedCounty: r.impactedCounty,
            impactedCountyFips: r.impactedCountyFips,
            impactedCounties: r.impactedCounties.slice(0, 5),
            impactedZips: r.impactedZips.slice(0, 10),
            impactedZipCount: r.impactedZipCount,
            jurisdictionHints: buildJurisdictionHints(r.state, r.impactedCounties, r.impactedCounty),
            publicProtectionActions:
              severity === 'CRITICAL'
                ? [
                    'Issue immediate PM2.5 respiratory exposure advisory.',
                    'Activate vulnerable-population outreach (elderly, asthma, COPD).',
                    'Coordinate with local agencies for temporary indoor clean-air guidance.',
                  ]
                : severity === 'HIGH'
                  ? [
                      'Issue PM2.5 warning for sensitive groups.',
                      'Recommend reduced outdoor activity during affected periods.',
                      'Increase monitoring cadence and public updates.',
                    ]
                  : [
                      'Publish PM2.5 advisory watch for sensitive populations.',
                      'Encourage voluntary exposure reduction.',
                    ],
          },
          metadata: {
            sourceRecordId: `${r.state}-pm25`,
            currentValue: r.pm25,
            threshold: pm25Threshold,
          },
        });
      }
    }
  }

  return {
    events,
    updatedState: {
      knownIds: Array.from(currentIds),
    },
  };
}
