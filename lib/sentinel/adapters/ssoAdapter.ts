/* ------------------------------------------------------------------ */
/*  PIN Sentinel — SSO/CSO Adapter                                    */
/*  EPA ECHO SSO endpoint for national coverage                       */
/*  Future: add DC Water / state feeds as real-time prototype         */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';

const SOURCE = 'SSO_CSO' as const;
const FETCH_TIMEOUT = 20_000;

// EPA ECHO SDWA/CWA detailed facility report includes SSO info
const ECHO_SSO_URL = 'https://echodata.epa.gov/echo/cwa_sso_detail_report.get_table';

function mapSeverity(duration_hours: number, volume_gallons: number): SeverityHint {
  if (volume_gallons >= 1_000_000 || duration_hours >= 48) return 'CRITICAL';
  if (volume_gallons >= 100_000 || duration_hours >= 24)   return 'HIGH';
  if (volume_gallons >= 10_000 || duration_hours >= 4)     return 'MODERATE';
  return 'LOW';
}

/**
 * Fetch SSO events from EPA ECHO.
 * Note: This is a best-effort fetch; the ECHO SSO endpoint may not always be available
 * or may change format. Adapter fails gracefully.
 */
async function fetchEchoSso(): Promise<any[]> {
  try {
    // Query recent SSO events (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateStr = `${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}/${String(thirtyDaysAgo.getDate()).padStart(2, '0')}/${thirtyDaysAgo.getFullYear()}`;

    const params = new URLSearchParams({
      p_event_date_from: dateStr,
      p_respond: 'Y',
      tablelist: 'Y',
      output: 'JSON',
    });

    const res = await fetch(`${ECHO_SSO_URL}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data?.Results?.SSOEvents ?? data?.Results ?? [];
  } catch (err: any) {
    console.warn(`[sentinel/sso] ECHO SSO fetch failed: ${err.message}`);
    return [];
  }
}

export async function pollSso(prevState: SentinelSourceState): Promise<AdapterResult> {
  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();

  try {
    const ssoEvents = await fetchEchoSso();
    const previousIds = new Set(prevState.knownIds);
    const currentIds: string[] = [];

    for (const sso of ssoEvents) {
      const permitId = sso.CWPPermitNmbr ?? sso.npdes_id ?? '';
      const startDate = sso.SSOEventDate ?? sso.event_date ?? '';
      const key = `${permitId}|${startDate}`;
      currentIds.push(key);

      if (!previousIds.has(key)) {
        const durationHours = parseFloat(sso.SSODuration ?? sso.duration ?? '0') || 0;
        const volumeGallons = parseFloat(sso.SSOVolume ?? sso.volume ?? '0') || 0;

        events.push({
          eventId: `sso-${permitId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}-${Date.now().toString(36)}`,
          source: SOURCE,
          detectedAt: now,
          sourceTimestamp: startDate || null,
          changeType: 'NEW_RECORD',
          geography: {
            stateAbbr: sso.FacState ?? sso.state ?? undefined,
            lat: parseFloat(sso.FacLat ?? '0') || undefined,
            lng: parseFloat(sso.FacLong ?? '0') || undefined,
          },
          severityHint: mapSeverity(durationHours, volumeGallons),
          payload: {
            permitId,
            facilityName: sso.CWPName ?? sso.facility_name,
            durationHours,
            volumeGallons,
            cause: sso.SSOCause ?? sso.cause,
          },
          metadata: {
            sourceRecordId: key,
            facilityId: permitId,
          },
        });
      }
    }

    return {
      events,
      updatedState: { knownIds: currentIds },
    };
  } catch (err: any) {
    console.warn(`[sentinel/sso] Poll failed: ${err.message}`);
    throw err;
  }
}
