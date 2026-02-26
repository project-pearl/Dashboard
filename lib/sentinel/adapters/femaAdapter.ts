/* ------------------------------------------------------------------ */
/*  PIN Sentinel — FEMA Disaster Declarations Adapter                 */
/*  Calls FEMA Open API for recent water-relevant declarations        */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';

const SOURCE = 'FEMA_DISASTER' as const;
const FEMA_API = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
const FETCH_TIMEOUT = 20_000;

/** Incident types relevant to water quality */
const WATER_INCIDENT_TYPES = new Set([
  'Flood', 'Hurricane', 'Severe Storm(s)', 'Typhoon',
  'Coastal Storm', 'Dam/Levee Break', 'Tornado',
  'Tropical Storm', 'Severe Ice Storm',
]);

function mapSeverity(incidentType: string, programDeclared: number): SeverityHint {
  if (incidentType === 'Hurricane' || incidentType === 'Typhoon') return 'CRITICAL';
  if (incidentType === 'Dam/Levee Break') return 'CRITICAL';
  if (incidentType === 'Flood' && programDeclared >= 3) return 'HIGH';
  if (incidentType === 'Flood') return 'MODERATE';
  return 'MODERATE';
}

export async function pollFema(prevState: SentinelSourceState): Promise<AdapterResult> {
  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  try {
    // Query last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const params = new URLSearchParams({
      '$filter': `declarationDate ge '${thirtyDaysAgo}'`,
      '$select': 'disasterNumber,state,declarationDate,incidentType,declarationTitle,designatedArea,fipsStateCode,fipsCountyCode',
      '$orderby': 'declarationDate desc',
      '$top': '100',
    });

    const res = await fetch(`${FEMA_API}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`FEMA API returned ${res.status}`);
    }

    const data = await res.json();
    const declarations = (data?.DisasterDeclarationsSummaries ?? []) as any[];
    const previousIds = new Set(prevState.knownIds);
    const currentIds: string[] = [];

    for (const d of declarations) {
      const incidentType = d.incidentType ?? '';
      if (!WATER_INCIDENT_TYPES.has(incidentType)) continue;

      const declId = `${d.disasterNumber}-${d.state}-${d.designatedArea ?? ''}`;
      currentIds.push(declId);

      if (!previousIds.has(declId)) {
        events.push({
          eventId: `fema-${d.disasterNumber}-${Date.now().toString(36)}`,
          source: SOURCE,
          detectedAt: now,
          sourceTimestamp: d.declarationDate ?? null,
          changeType: 'NEW_RECORD',
          geography: {
            stateAbbr: d.state,
          },
          severityHint: mapSeverity(incidentType, declarations.filter((x: any) => x.disasterNumber === d.disasterNumber).length),
          payload: {
            disasterNumber: d.disasterNumber,
            incidentType,
            title: d.declarationTitle,
            designatedArea: d.designatedArea,
            fipsCounty: d.fipsCountyCode,
          },
          metadata: {
            sourceRecordId: declId,
          },
        });
      }
    }

    return {
      events,
      updatedState: { knownIds: currentIds },
    };
  } catch (err: any) {
    console.warn(`[sentinel/fema] Poll failed: ${err.message}`);
    throw err;
  }
}
