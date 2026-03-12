/* ------------------------------------------------------------------ */
/*  PIN Alerts — Groundwater Anomaly Alert Trigger                   */
/*                                                                    */
/*  Fires when groundwater levels show significant declining trends.  */
/*                                                                    */
/*  Reads from nwisGwCache (USGS groundwater trends) and             */
/*  ngwmnCache (NGWMN water level decline detection).                */
/*  Uses snapshot-based cooldown to avoid re-alerting on the same    */
/*  site number.                                                     */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertSeverity } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import {
  getNwisGwAllTrends,
  ensureWarmed as warmNwisGw,
} from '../../nwisGwCache';
import type { NwisGwTrend } from '../../nwisGwCache';
import {
  getNgwmnAllSites,
  ensureWarmed as warmNgwmn,
} from '../../ngwmnCache';
import type { NgwmnSite } from '../../ngwmnCache';

/* ------------------------------------------------------------------ */
/*  Snapshot — tracks which groundwater anomaly alerts we sent        */
/* ------------------------------------------------------------------ */

interface GroundwaterAnomalySnapshot {
  dispatched: Record<string, string>; // dedupKey -> ISO timestamp
  takenAt: string;
}

const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_DECLINE_FT_MONTH = 2; // minimum rate threshold for alerting
const CRITICAL_DECLINE_FT_MONTH = 5; // critical if rate >5 ft/month
const MIN_WATER_LEVELS = 2; // need at least 2 readings to detect decline

/* ------------------------------------------------------------------ */
/*  Severity Mapping                                                  */
/* ------------------------------------------------------------------ */

function mapSeverityFromTrend(
  rateFtMonth: number,
  hasQualityIssue: boolean,
): AlertSeverity {
  if (rateFtMonth > CRITICAL_DECLINE_FT_MONTH) return 'critical';
  if (rateFtMonth > MIN_DECLINE_FT_MONTH && hasQualityIssue) return 'warning';
  if (rateFtMonth > MIN_DECLINE_FT_MONTH) return 'warning';
  return 'info';
}

/* ------------------------------------------------------------------ */
/*  NGWMN Decline Detection                                           */
/*                                                                    */
/*  Since ngwmnCache stores raw water levels (not pre-computed        */
/*  trends), we compute a simple decline rate from the most recent    */
/*  water level readings.                                             */
/* ------------------------------------------------------------------ */

interface NgwmnDecline {
  site: NgwmnSite;
  rateFtMonth: number; // ft/month decline rate (positive = falling)
  latestLevel: number;
  earliestLevel: number;
  spanDays: number;
  hasQualityIssue: boolean;
}

function detectNgwmnDeclines(sites: NgwmnSite[]): NgwmnDecline[] {
  const declines: NgwmnDecline[] = [];

  for (const site of sites) {
    if (!site.waterLevels || site.waterLevels.length < MIN_WATER_LEVELS) continue;

    // Sort levels chronologically (oldest first)
    const sorted = [...site.waterLevels].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    const spanMs = new Date(latest.date).getTime() - new Date(earliest.date).getTime();
    const spanDays = spanMs / (1000 * 60 * 60 * 24);

    // Need at least 7 days of data to estimate a meaningful rate
    if (spanDays < 7) continue;

    // Water level decline: for below-ground levels, a HIGHER value means
    // the water has dropped further below surface. So rising numeric value
    // = declining water table.
    const levelChange = latest.value - earliest.value;
    const spanMonths = spanDays / 30.44;
    const rateFtMonth = levelChange / spanMonths;

    // Only alert on declining levels (positive rate = falling water table)
    if (rateFtMonth < MIN_DECLINE_FT_MONTH) continue;

    // Check for water quality issues (any quality results present)
    const hasQualityIssue =
      site.waterQuality != null && site.waterQuality.length > 0;

    declines.push({
      site,
      rateFtMonth,
      latestLevel: latest.value,
      earliestLevel: earliest.value,
      spanDays,
      hasQualityIssue,
    });
  }

  return declines;
}

/* ------------------------------------------------------------------ */
/*  Evaluate                                                          */
/* ------------------------------------------------------------------ */

export async function evaluateGroundwaterAnomalies(): Promise<AlertEvent[]> {
  await Promise.all([warmNwisGw(), warmNgwmn()]);

  const snapshot = await loadCacheFromBlob<GroundwaterAnomalySnapshot>(
    BLOB_PATHS.groundwaterAnomalySnapshot,
  );
  const prevDispatched = snapshot?.dispatched ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const events: AlertEvent[] = [];
  const newDispatched: Record<string, string> = { ...prevDispatched };

  /* ── NWIS GW Trends (pre-computed) ─────────────────────────────── */

  const nwisTrends = getNwisGwAllTrends();
  for (const trend of nwisTrends) {
    if (trend.trend !== 'falling') continue;
    if (trend.trendMagnitude < MIN_DECLINE_FT_MONTH) continue;

    const dedupKey = `gw-anomaly-${trend.siteNumber}`;

    // Cooldown check
    const lastDispatched = prevDispatched[dedupKey];
    if (
      lastDispatched &&
      now.getTime() - new Date(lastDispatched).getTime() < COOLDOWN_MS
    ) {
      continue;
    }

    const severity = mapSeverityFromTrend(trend.trendMagnitude, false);
    const rateLabel = trend.trendMagnitude.toFixed(1);
    const avg30 =
      trend.avgLevel30d != null ? ` (30d avg: ${trend.avgLevel30d.toFixed(1)} ft)` : '';

    events.push({
      id: crypto.randomUUID(),
      type: 'groundwater_anomaly',
      severity,
      title: `Groundwater Decline: ${trend.siteName} — ${rateLabel} ft/month`,
      body: `USGS site ${trend.siteNumber} (${trend.siteName}) water level is falling at ${rateLabel} ft/month. Latest level: ${trend.latestLevel.toFixed(1)} ft${avg30}.`,
      entityId: trend.siteNumber,
      entityLabel: trend.siteName,
      dedupKey,
      createdAt: nowIso,
      channel: 'email',
      recipientEmail: '',
      sent: false,
      sentAt: null,
      error: null,
      ruleId: null,
      metadata: {
        source: 'nwis_gw',
        siteNumber: trend.siteNumber,
        siteName: trend.siteName,
        latestLevel: trend.latestLevel,
        latestDate: trend.latestDate,
        avgLevel30d: trend.avgLevel30d,
        avgLevel90d: trend.avgLevel90d,
        trend: trend.trend,
        trendMagnitude: trend.trendMagnitude,
        lat: trend.lat,
        lng: trend.lng,
      },
    });

    newDispatched[dedupKey] = nowIso;
  }

  /* ── NGWMN Sites (decline detection from raw levels) ───────────── */

  const ngwmnStatesMap = getNgwmnAllSites();
  if (ngwmnStatesMap) {
    const allNgwmnSites = Object.values(ngwmnStatesMap).flat();
    const declines = detectNgwmnDeclines(allNgwmnSites);

    for (const d of declines) {
      const dedupKey = `gw-anomaly-${d.site.siteNo}`;

      // Cooldown check
      const lastDispatched = prevDispatched[dedupKey];
      if (
        lastDispatched &&
        now.getTime() - new Date(lastDispatched).getTime() < COOLDOWN_MS
      ) {
        continue;
      }

      const severity = mapSeverityFromTrend(d.rateFtMonth, d.hasQualityIssue);
      const rateLabel = d.rateFtMonth.toFixed(1);
      const qualityNote = d.hasQualityIssue ? ' (water quality issues detected)' : '';

      events.push({
        id: crypto.randomUUID(),
        type: 'groundwater_anomaly',
        severity,
        title: `Groundwater Decline: ${d.site.siteName} — ${rateLabel} ft/month`,
        body: `NGWMN site ${d.site.siteNo} (${d.site.siteName}, ${d.site.state}) water level is declining at ${rateLabel} ft/month over ${Math.round(d.spanDays)} days. Level changed from ${d.earliestLevel.toFixed(1)} to ${d.latestLevel.toFixed(1)} ft${qualityNote}.`,
        entityId: d.site.siteNo,
        entityLabel: `${d.site.siteName} (${d.site.state})`,
        dedupKey,
        createdAt: nowIso,
        channel: 'email',
        recipientEmail: '',
        sent: false,
        sentAt: null,
        error: null,
        ruleId: null,
        metadata: {
          source: 'ngwmn',
          siteNo: d.site.siteNo,
          siteName: d.site.siteName,
          state: d.site.state,
          county: d.site.county,
          aquiferName: d.site.aquiferName,
          wellDepth: d.site.wellDepth,
          rateFtMonth: d.rateFtMonth,
          latestLevel: d.latestLevel,
          earliestLevel: d.earliestLevel,
          spanDays: d.spanDays,
          hasQualityIssue: d.hasQualityIssue,
          lat: d.site.lat,
          lng: d.site.lng,
        },
      });

      newDispatched[dedupKey] = nowIso;
    }
  }

  // Expire old entries (>48h)
  const expiryCutoff = now.getTime() - 48 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(newDispatched)) {
    if (new Date(ts).getTime() < expiryCutoff) {
      delete newDispatched[key];
    }
  }

  await saveCacheToBlob(BLOB_PATHS.groundwaterAnomalySnapshot, {
    dispatched: newDispatched,
    takenAt: nowIso,
  });

  return events;
}
