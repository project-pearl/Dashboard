/* ------------------------------------------------------------------ */
/*  PIN Sentinel — SEMS/Superfund Adapter                             */
/*  Reads existing semsCache, detects NPL listing changes, remedial   */
/*  action milestones, and five-year review status changes.           */
/* ------------------------------------------------------------------ */

import type { AdapterResult, ChangeEvent, SeverityHint, SentinelSourceState } from '../types';
import { getSemsSitesAll, type SemsSite } from '../../semsCache';
import { findNearestHuc8 } from '../../hucLookup';

const SOURCE = 'SEMS_SUPERFUND' as const;

// ── NPL status severity mapping ────────────────────────────────────────────

function severityFromNplStatus(status: string): SeverityHint {
  if (/final\s*npl/i.test(status)) return 'HIGH';
  if (/proposed/i.test(status)) return 'MODERATE';
  if (/deleted/i.test(status)) return 'LOW';
  return 'MODERATE';
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

// ── Encode site status as a numeric fingerprint for delta detection ──────

function statusFingerprint(site: SemsSite): number {
  let val = 0;
  if (/final\s*npl/i.test(site.nplStatus)) val += 100;
  else if (/proposed/i.test(site.nplStatus)) val += 50;
  else if (/deleted/i.test(site.nplStatus)) val += 10;
  if (site.removalAction) val += 1;
  if (site.remedialAction) val += 2;
  if (site.constructionComplete) val += 4;
  if (site.fiveYearReview) val += 8;
  return val;
}

// ── Main poll function ──────────────────────────────────────────────────

export function pollSems(prevState: SentinelSourceState): AdapterResult {
  const sites = getSemsSitesAll();
  const prevValues = prevState.lastValues || {};
  const hucCache: Record<string, string> = {};
  const previousKeySet = new Set(prevState.knownIds);

  const events: ChangeEvent[] = [];
  const now = new Date().toISOString();
  const currentKeys: string[] = [];

  for (const site of sites) {
    const key = `${site.siteId}|${site.nplStatus}`;
    currentKeys.push(site.siteId);

    if (site.lat === null || site.lng === null) continue;

    const currentFp = statusFingerprint(site);

    // 1. NEW_RECORD — new site appearing on the list
    if (!previousKeySet.has(site.siteId)) {
      const huc = getHuc8(site.lat, site.lng, hucCache);
      events.push({
        eventId: `sems-new-${site.siteId.slice(-8)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: null,
        changeType: 'NEW_RECORD',
        geography: { stateAbbr: site.state, lat: site.lat, lng: site.lng, ...huc },
        severityHint: severityFromNplStatus(site.nplStatus),
        payload: {
          siteId: site.siteId,
          siteName: site.siteName,
          nplStatus: site.nplStatus,
          siteType: site.siteType,
          removalAction: site.removalAction,
          remedialAction: site.remedialAction,
        },
        metadata: { sourceRecordId: site.siteId, facilityId: site.siteId },
      });
      continue;
    }

    // 2. VALUE_CHANGE — NPL status or remedial milestone change
    const prevFp = prevValues[`${site.siteId}_fp`] ?? 0;
    if (currentFp !== prevFp && prevFp > 0) {
      const huc = getHuc8(site.lat, site.lng, hucCache);

      // Determine what changed
      const changes: string[] = [];
      if (Math.floor(currentFp / 10) !== Math.floor(prevFp / 10)) changes.push('NPL status');
      if ((currentFp & 1) !== (prevFp & 1)) changes.push('removal action');
      if ((currentFp & 2) !== (prevFp & 2)) changes.push('remedial action');
      if ((currentFp & 4) !== (prevFp & 4)) changes.push('construction complete');
      if ((currentFp & 8) !== (prevFp & 8)) changes.push('five-year review');

      // NPL listing is high severity; milestone changes are moderate
      const isNplChange = Math.floor(currentFp / 10) !== Math.floor(prevFp / 10);

      events.push({
        eventId: `sems-chg-${site.siteId.slice(-8)}-${Date.now().toString(36)}`,
        source: SOURCE,
        detectedAt: now,
        sourceTimestamp: null,
        changeType: 'VALUE_CHANGE',
        geography: { stateAbbr: site.state, lat: site.lat, lng: site.lng, ...huc },
        severityHint: isNplChange ? severityFromNplStatus(site.nplStatus) : 'MODERATE',
        payload: {
          siteId: site.siteId,
          siteName: site.siteName,
          nplStatus: site.nplStatus,
          changes,
          removalAction: site.removalAction,
          remedialAction: site.remedialAction,
          constructionComplete: site.constructionComplete,
          fiveYearReview: site.fiveYearReview,
        },
        metadata: {
          sourceRecordId: `${site.siteId}_fp`,
          previousValue: prevFp,
          currentValue: currentFp,
          facilityId: site.siteId,
          escalationType: 'STATUS_CHANGE',
        },
      });
    }
  }

  // Build updated values for delta detection next cycle
  const currentValues: Record<string, number> = {};
  for (const site of sites) {
    currentValues[`${site.siteId}_fp`] = statusFingerprint(site);
  }

  return {
    events,
    updatedState: {
      knownIds: currentKeys.map(k => k), // just siteId
      lastValues: currentValues,
    },
  };
}
