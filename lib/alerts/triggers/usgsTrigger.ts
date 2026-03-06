/* ------------------------------------------------------------------ */
/*  PIN Alerts - USGS IV Trigger                                       */
/*  Progressive staging + persistence gate before external alerts.     */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertSeverity } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';
import { getAllAlerts, ensureWarmed } from '../../usgsAlertCache';
import { gatherConfounders } from '../../sentinel/classificationEngine';
import { getAllEvents, ensureWarmed as warmQueue } from '../../sentinel/eventQueue';
import { getExistingGrid } from '../../nwisIvCache';
import { getWatershedContext } from '../../sentinel/indexLookup';
import { ensureWarmed as warmIndices } from '../../indices/indicesCache';

interface InvestigationState {
  consecutiveRuns: number;
  lastStage: string;
  lastConfidence: number;
  externalIssued: boolean;
  updatedAt: string;
}

interface UsgsAlertSnapshot {
  dispatched: Record<string, string>;
  investigations?: Record<string, InvestigationState>;
  takenAt: string;
}

const COOLDOWN_MS = 60 * 60 * 1000;
const WEATHER_SENSITIVE_PARAMS = new Set(['63680', '00095', '00065']);

function mapSeverity(usgsLevel: 'critical' | 'warning'): AlertSeverity {
  return usgsLevel === 'critical' ? 'critical' : 'warning';
}

function buildSiteHucMap(): Map<string, string> {
  const map = new Map<string, string>();
  const grid = getExistingGrid();
  if (!grid) return map;
  for (const cell of Object.values(grid)) {
    for (const site of cell.sites) {
      if (site.huc) map.set(site.siteNumber, site.huc);
    }
  }
  return map;
}

export async function evaluateUsgsAlerts(): Promise<AlertEvent[]> {
  await Promise.all([ensureWarmed(), warmQueue(), warmIndices()]);

  const allAlerts = getAllAlerts();
  if (allAlerts.length === 0) return [];

  const previousSnapshot = await loadCacheFromBlob<UsgsAlertSnapshot>(BLOB_PATHS.usgsSnapshot);
  const prevDispatched = previousSnapshot?.dispatched ?? {};
  const prevInvestigations = previousSnapshot?.investigations ?? {};
  const now = new Date();
  const nowIso = now.toISOString();
  const events: AlertEvent[] = [];
  const newDispatched: Record<string, string> = { ...prevDispatched };
  const newInvestigations: Record<string, InvestigationState> = { ...prevInvestigations };

  const siteHucMap = buildSiteHucMap();
  const sentinelEvents = getAllEvents();
  const confounderCache = new Map<string, ReturnType<typeof gatherConfounders>>();

  for (const alert of allAlerts) {
    const dedupKey = `usgs-iv-${alert.siteNumber}-${alert.parameterCd}-${alert.severity}`;
    const lastDispatched = prevDispatched[dedupKey];
    if (lastDispatched && (now.getTime() - new Date(lastDispatched).getTime()) < COOLDOWN_MS) continue;

    const huc8 = siteHucMap.get(alert.siteNumber);
    let rainfallActive = false;
    let floodActive = false;

    // Watershed context for this site's HUC
    const ctx = huc8 ? getWatershedContext(huc8) : null;

    if (WEATHER_SENSITIVE_PARAMS.has(alert.parameterCd) && huc8) {
      if (!confounderCache.has(huc8)) confounderCache.set(huc8, gatherConfounders(huc8, sentinelEvents));
      const confounders = confounderCache.get(huc8)!;
      rainfallActive = confounders.some((c) => c.rule === 'RAINFALL_CONFOUNDER' && c.matched);
      floodActive = confounders.some((c) => c.rule === 'FLOOD_CONFOUNDER' && c.matched);
    }

    // Skip weather suppression for severely degraded watersheds (severity > 0.7)
    const skipWeatherSuppression = ctx && ctx.available && ctx.severity > 0.7;

    const invKey = `${alert.siteNumber}:${alert.parameterCd}`;
    const prevInv = prevInvestigations[invKey] ?? null;
    const nextRuns = (prevInv?.consecutiveRuns ?? 0) + 1;
    const severe = alert.severity === 'critical';
    const confidence = severe ? 0.85 : 0.65;
    const likelyNatural = skipWeatherSuppression ? false : (rainfallActive || floodActive);
    const persistent = nextRuns >= 2;
    const corroborated = severe || nextRuns >= 3;

    let stage = 'possible_anomaly';
    if (likelyNatural) stage = 'likely_natural_or_operational';
    else if (persistent) stage = 'unexplained_investigate';

    const externalEligible =
      (!likelyNatural && severe) ||
      (!likelyNatural && persistent && corroborated && !prevInv?.externalIssued);

    if (externalEligible) stage = 'external_alert';

    newInvestigations[invKey] = {
      consecutiveRuns: nextRuns,
      lastStage: stage,
      lastConfidence: confidence,
      externalIssued: externalEligible ? true : Boolean(prevInv?.externalIssued),
      updatedAt: nowIso,
    };

    if (!externalEligible) continue;

    const severity = mapSeverity(alert.severity);
    const rationale = [];
    if (persistent) rationale.push(`Persistent signal for ${nextRuns} runs.`);
    if (rainfallActive) rationale.push('Rainfall confounder present.');
    if (floodActive) rationale.push('Flood confounder present.');
    if (severe) rationale.push('Critical threshold exceeded.');

    events.push({
      id: crypto.randomUUID(),
      type: 'usgs',
      severity,
      title: `${alert.title} (${stage})`,
      body: `${alert.message} This is a persistent unexplained signal under investigation unless otherwise confirmed.`,
      entityId: alert.siteNumber,
      entityLabel: `${alert.siteName} (${alert.state})`,
      dedupKey: `${dedupKey}:${stage}`,
      createdAt: nowIso,
      channel: 'email',
      recipientEmail: '',
      sent: false,
      sentAt: null,
      error: null,
      ruleId: null,
      metadata: {
        siteNumber: alert.siteNumber,
        parameter: alert.parameter,
        parameterCd: alert.parameterCd,
        value: alert.value,
        unit: alert.unit,
        threshold: alert.threshold,
        alertType: alert.type,
        readingTime: alert.readingTime,
        lat: alert.lat,
        lng: alert.lng,
        stage,
        confidence,
        persistentRuns: nextRuns,
        rainfallConfounder: rainfallActive,
        floodConfounder: floodActive,
        rationale,
        watershedSeverity: ctx?.severity ?? null,
        weatherSuppressionSkipped: skipWeatherSuppression ?? false,
      },
    });

    newDispatched[dedupKey] = nowIso;
  }

  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(newDispatched)) {
    if (new Date(ts).getTime() < cutoff) delete newDispatched[key];
  }

  await saveCacheToBlob(BLOB_PATHS.usgsSnapshot, {
    dispatched: newDispatched,
    investigations: newInvestigations,
    takenAt: nowIso,
  });

  return events;
}
