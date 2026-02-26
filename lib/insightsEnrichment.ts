/**
 * Insights Enrichment — gathers real-time data (signals, USGS alerts, NWS alerts)
 * and formats it for the AI insights pipeline.
 *
 * Called once per cron run to fetch a snapshot, then filtered per-state synchronously.
 */

import { fetchAllSignals, type Signal, type SignalResponse } from './signals';
import { getAlertsForState, type UsgsAlert } from './usgsAlertCache';
import { getNwsAlerts, type NwsAlert } from './nwsAlertCache';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EnrichmentSnapshot {
  signals: Signal[];
  sources: SignalResponse['sources'];
  fetchedAt: string;
}

export interface StateEnrichment {
  usgsAlerts: UsgsAlert[];
  criticalUsgsAlerts: UsgsAlert[];
  signals: Signal[];
  nwsAlerts: NwsAlert[];
  hasCriticalCondition: boolean;
}

export interface FormattedEnrichment {
  activeAlerts?: string;
  recentSignals?: string;
  weatherAlerts?: string;
  floodConditions?: string;
  complianceFlags?: string;
  contaminationAlerts?: string;
  wastewaterSurveillance?: string;
}

// ── Snapshot (call once per cron run) ────────────────────────────────────────

export async function fetchEnrichmentSnapshot(): Promise<EnrichmentSnapshot> {
  const resp = await fetchAllSignals({ limit: 100 });
  return {
    signals: resp.signals,
    sources: resp.sources,
    fetchedAt: resp.fetchedAt,
  };
}

// ── Per-state filtering (synchronous — uses pre-fetched snapshot) ────────────

export function getStateEnrichment(
  stateAbbr: string,
  snapshot: EnrichmentSnapshot,
): StateEnrichment {
  const upper = stateAbbr.toUpperCase();

  // Filter signals to this state
  const stateSignals = snapshot.signals.filter(s => s.state === upper);

  // Get USGS threshold alerts from cache
  const usgsAlerts = getAlertsForState(upper);
  const criticalUsgsAlerts = usgsAlerts.filter(a => a.severity === 'critical');

  // Get NWS weather alerts from cache
  const nwsAlerts = getNwsAlerts(upper) || [];

  // Critical condition: any critical USGS alert, high-severity signal, or severe NWS alert
  const hasCriticalCondition =
    criticalUsgsAlerts.length > 0 ||
    stateSignals.some(s =>
      s.category === 'spill' || s.category === 'bacteria' ||
      s.category === 'hab' || s.category === 'flood' || s.category === 'contamination'
    ) ||
    nwsAlerts.some(a => a.severity === 'Extreme' || a.severity === 'Severe');

  return {
    usgsAlerts,
    criticalUsgsAlerts,
    signals: stateSignals,
    nwsAlerts,
    hasCriticalCondition,
  };
}

// ── Format for LLM (caps items, prioritizes critical) ────────────────────────

const PRIORITY_CATEGORIES: Signal['category'][] = ['spill', 'flood', 'contamination', 'bacteria', 'hab', 'enforcement'];

export function formatEnrichmentForLLM(enrichment: StateEnrichment): FormattedEnrichment {
  const result: FormattedEnrichment = {};

  // USGS alerts: critical first, cap at 5
  if (enrichment.usgsAlerts.length > 0) {
    const sorted = [...enrichment.usgsAlerts].sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return new Date(b.firedAt).getTime() - new Date(a.firedAt).getTime();
    });
    const capped = sorted.slice(0, 5);
    result.activeAlerts = capped
      .map(a => `[${a.severity.toUpperCase()}] ${a.title}: ${a.message} (site ${a.siteNumber}, ${a.readingTime})`)
      .join('\n');
  }

  // Signals: priority categories first, cap at 5
  if (enrichment.signals.length > 0) {
    const sorted = [...enrichment.signals].sort((a, b) => {
      const aPri = PRIORITY_CATEGORIES.indexOf(a.category);
      const bPri = PRIORITY_CATEGORIES.indexOf(b.category);
      const aRank = aPri >= 0 ? aPri : 99;
      const bRank = bPri >= 0 ? bPri : 99;
      if (aRank !== bRank) return aRank - bRank;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    const capped = sorted.slice(0, 5);
    result.recentSignals = capped
      .map(s => `[${s.sourceLabel}] ${s.title} — ${s.summary}`)
      .join('\n');
  }

  // NWS alerts: cap at 3
  if (enrichment.nwsAlerts.length > 0) {
    const sorted = [...enrichment.nwsAlerts].sort((a, b) => {
      const sevOrder: Record<string, number> = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3 };
      return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
    });
    const capped = sorted.slice(0, 3);
    result.weatherAlerts = capped
      .map(a => `[${a.severity}] ${a.event}: ${a.headline}`)
      .join('\n');
  }

  // Flood conditions: NWPS + SNOTEL flood signals (cap 3)
  const floodSignals = enrichment.signals.filter(
    s => s.category === 'flood' || (s.source === 'snotel' && s.category === 'advisory')
  );
  if (floodSignals.length > 0) {
    result.floodConditions = floodSignals.slice(0, 3)
      .map(s => `[${s.sourceLabel}] ${s.title}: ${s.summary}`)
      .join('\n');
  }

  // Compliance flags: ECHO chronic violator signals (cap 3)
  const complianceSignals = enrichment.signals.filter(s => s.source === 'echo');
  if (complianceSignals.length > 0) {
    result.complianceFlags = complianceSignals.slice(0, 3)
      .map(s => `[${s.sourceLabel}] ${s.title}: ${s.summary}`)
      .join('\n');
  }

  // Contamination alerts: PFAS + TRI signals (cap 3)
  const contaminationSignals = enrichment.signals.filter(
    s => s.source === 'pfas' || s.source === 'tri'
  );
  if (contaminationSignals.length > 0) {
    result.contaminationAlerts = contaminationSignals.slice(0, 3)
      .map(s => `[${s.sourceLabel}] ${s.title}: ${s.summary}`)
      .join('\n');
  }

  // Wastewater surveillance: CDC NWSS pathogen signals (cap 3)
  const wastewaterSignals = enrichment.signals.filter(s => s.source === 'cdc-nwss');
  if (wastewaterSignals.length > 0) {
    result.wastewaterSurveillance = wastewaterSignals.slice(0, 3)
      .map(s => `[${s.sourceLabel}] ${s.title}: ${s.summary}`)
      .join('\n');
  }

  return result;
}

// ── Build enriched signals array for delta hash ──────────────────────────────

export function buildEnrichedSignals(
  attainsData: { total: number; high: number; medium: number; low: number; topCauses?: string[] },
  enrichment: StateEnrichment,
): { type: string; severity: string; title: string }[] {
  // Base ATTAINS signals (same as before)
  const signals: { type: string; severity: string; title: string }[] = [
    { type: 'summary', severity: 'info', title: `${attainsData.total} waterbodies` },
    { type: 'summary', severity: attainsData.high > 0 ? 'critical' : 'info', title: `${attainsData.high} high alert` },
    ...(attainsData.topCauses || []).map((c: string) => ({ type: 'cause', severity: 'info', title: c })),
  ];

  // Add USGS alert IDs so new/resolved alerts bust the hash
  for (const a of enrichment.usgsAlerts) {
    signals.push({ type: 'usgs-alert', severity: a.severity, title: a.id });
  }

  // Add signal IDs so new incidents bust the hash
  for (const s of enrichment.signals) {
    signals.push({ type: 'signal', severity: s.category, title: s.id });
  }

  return signals;
}

// ── Enrichment summary string (for CacheEntry metadata) ─────────────────────

export function summarizeEnrichment(enrichment: StateEnrichment): string {
  const parts: string[] = [];
  if (enrichment.criticalUsgsAlerts.length > 0) {
    parts.push(`${enrichment.criticalUsgsAlerts.length} critical USGS alert${enrichment.criticalUsgsAlerts.length > 1 ? 's' : ''}`);
  }
  if (enrichment.usgsAlerts.length > enrichment.criticalUsgsAlerts.length) {
    const warnings = enrichment.usgsAlerts.length - enrichment.criticalUsgsAlerts.length;
    parts.push(`${warnings} USGS warning${warnings > 1 ? 's' : ''}`);
  }
  if (enrichment.signals.length > 0) {
    const cats = [...new Set(enrichment.signals.map(s => s.category))];
    parts.push(`${enrichment.signals.length} signal${enrichment.signals.length > 1 ? 's' : ''} (${cats.join(', ')})`);
  }
  if (enrichment.nwsAlerts.length > 0) {
    parts.push(`${enrichment.nwsAlerts.length} NWS alert${enrichment.nwsAlerts.length > 1 ? 's' : ''}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'no real-time alerts';
}
