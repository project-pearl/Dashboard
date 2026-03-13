/* ------------------------------------------------------------------ */
/*  PIN Alerts — PFAS Proximity Alert Trigger                        */
/*                                                                    */
/*  Fires when an EPA PFAS facility has analyte exceedances near a   */
/*  military installation (DoD PFAS site within 10 miles).           */
/*                                                                    */
/*  Reads from epaPfasAnalyticsCache + dodPfasSitesCache.            */
/*  Uses snapshot-based cooldown to avoid re-alerting on the same    */
/*  facility + analyte combination.                                  */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertSeverity } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import {
  getEpaPfasAllStates,
  ensureWarmed as warmPfas,
} from '../../epaPfasAnalyticsCache';
import type { EpaPfasFacility, EpaPfasAnalyte } from '../../epaPfasAnalyticsCache';
import {
  getDodPfasAllSites,
  ensureWarmed as warmDodPfas,
} from '../../dodPfasSitesCache';

/* ------------------------------------------------------------------ */
/*  Snapshot — tracks which PFAS proximity alerts we already sent     */
/* ------------------------------------------------------------------ */

interface PfasProximitySnapshot {
  dispatched: Record<string, string>; // dedupKey -> ISO timestamp
  takenAt: string;
}

const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_DISTANCE_MI = 10; // only alert within 10 miles of military site

/* ------------------------------------------------------------------ */
/*  Severity Mapping                                                  */
/* ------------------------------------------------------------------ */

function mapSeverity(concentrationPpt: number): AlertSeverity {
  if (concentrationPpt > 70) return 'critical';
  if (concentrationPpt > 10) return 'warning';
  return 'info';
}

/* ------------------------------------------------------------------ */
/*  Haversine distance (miles)                                        */
/* ------------------------------------------------------------------ */

function haversineMi(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluatePfasProximity(): Promise<AlertEvent[]> {
  await Promise.all([warmPfas(), warmDodPfas()]);

  const pfasStates = getEpaPfasAllStates();
  const dodSitesMap = getDodPfasAllSites();

  if (!pfasStates || !dodSitesMap) return [];

  // Build a flat list of DoD PFAS sites for proximity checks
  const dodSites = Object.values(dodSitesMap).flat();
  if (dodSites.length === 0) return [];

  // Load previous snapshot for cooldown
  const snapshot = await loadCacheFromBlob<PfasProximitySnapshot>(
    BLOB_PATHS.pfasProximitySnapshot,
  );
  const prevDispatched = snapshot?.dispatched ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const events: AlertEvent[] = [];
  const newDispatched: Record<string, string> = { ...prevDispatched };

  for (const [state, stateData] of Object.entries(pfasStates)) {
    for (const facility of stateData.facilities) {
      // Only consider facilities near military sites
      if (!facility.nearMilitary) continue;
      if (
        facility.militaryDistanceMi != null &&
        facility.militaryDistanceMi > MAX_DISTANCE_MI
      ) {
        continue;
      }

      // Find the nearest DoD site for metadata
      let nearestDodSite: { name: string; distance: number } | null = null;
      for (const dod of dodSites) {
        const dist = haversineMi(facility.lat, facility.lng, dod.lat, dod.lng);
        if (dist <= MAX_DISTANCE_MI) {
          if (!nearestDodSite || dist < nearestDodSite.distance) {
            nearestDodSite = { name: dod.installationName, distance: dist };
          }
        }
      }

      // Check each analyte for exceedance
      for (const analyte of facility.pfasAnalytes) {
        if (!analyte.exceedsAdvisory) continue;

        const dedupKey = `pfas-prox-${facility.registryId}-${analyte.name}`;

        // Cooldown check
        const lastDispatched = prevDispatched[dedupKey];
        if (
          lastDispatched &&
          now.getTime() - new Date(lastDispatched).getTime() < COOLDOWN_MS
        ) {
          continue;
        }

        const severity = mapSeverity(analyte.concentrationPpt);
        const distLabel =
          facility.militaryDistanceMi != null
            ? `${facility.militaryDistanceMi.toFixed(1)} mi`
            : nearestDodSite
              ? `${nearestDodSite.distance.toFixed(1)} mi`
              : '<10 mi';
        const dodLabel = nearestDodSite?.name ?? 'nearby military installation';

        events.push({
          id: crypto.randomUUID(),
          type: 'pfas_proximity',
          severity,
          title: `PFAS Exceedance: ${analyte.name} at ${facility.facilityName} (${distLabel} from ${dodLabel})`,
          body: `${analyte.name} detected at ${analyte.concentrationPpt} ppt (advisory limit exceeded) at ${facility.facilityName}, ${facility.city}, ${state}. Facility is ${distLabel} from ${dodLabel}.`,
          entityId: facility.registryId,
          entityLabel: `${facility.facilityName} (${state})`,
          dedupKey,
          createdAt: nowIso,
          channel: 'email',
          recipientEmail: '',
          sent: false,
          sentAt: null,
          error: null,
          ruleId: null,
          metadata: {
            registryId: facility.registryId,
            facilityName: facility.facilityName,
            city: facility.city,
            state,
            lat: facility.lat,
            lng: facility.lng,
            analyteName: analyte.name,
            concentrationPpt: analyte.concentrationPpt,
            detectionLimit: analyte.detectionLimit,
            sampleDate: analyte.sampleDate,
            nearMilitary: facility.nearMilitary,
            militaryDistanceMi: facility.militaryDistanceMi,
            nearestDodSite: nearestDodSite?.name ?? null,
            nearestDodDistance: nearestDodSite?.distance ?? null,
          },
        });

        newDispatched[dedupKey] = nowIso;
      }
    }
  }

  // Expire old entries (>48h)
  const expiryCutoff = now.getTime() - 48 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(newDispatched)) {
    if (new Date(ts).getTime() < expiryCutoff) {
      delete newDispatched[key];
    }
  }

  await saveCacheToBlob(BLOB_PATHS.pfasProximitySnapshot, {
    dispatched: newDispatched,
    takenAt: nowIso,
  });

  return events;
}
