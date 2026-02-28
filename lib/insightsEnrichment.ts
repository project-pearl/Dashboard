/**
 * Insights Enrichment — gathers real-time data (signals, USGS alerts, NWS alerts)
 * and formats it for the AI insights pipeline.
 *
 * Called once per cron run to fetch a snapshot, then filtered per-state synchronously.
 */

import { fetchAllSignals, type Signal, type SignalResponse } from './signals';
import { getAlertsForState, type UsgsAlert } from './usgsAlertCache';
import { getNwsAlerts, type NwsAlert } from './nwsAlertCache';
import { ALL_STATES_WITH_FIPS } from './constants';

// ── Types ────────────────────────────────────────────────────────────────────

/** Lightweight signal from water-data route sources (NRTWQ, WQP, MD Open Data) */
export interface WaterDataSignal {
  type: 'exceedance_probability' | 'lab_exceedance' | 'state_advisory';
  severity: 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
  source: string;
  parameter?: string;
  value?: number;
  timestamp: string;
}

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
  waterDataSignals: WaterDataSignal[];
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
  labAndModelAlerts?: string;
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

// ── EPA MCL thresholds for WQP lab result comparison ────────────────────────

const EPA_THRESHOLDS: Record<string, { limit: number; unit: string; label: string; direction: 'above' | 'below' }> = {
  'Nitrate':          { limit: 10,    unit: 'mg/L',      label: 'Nitrate (NO3)',     direction: 'above' },
  'Escherichia coli': { limit: 126,   unit: 'CFU/100mL', label: 'E. coli',           direction: 'above' },
  'Dissolved oxygen': { limit: 5,     unit: 'mg/L',      label: 'Dissolved Oxygen',  direction: 'below' },
  'Lead':             { limit: 0.015, unit: 'mg/L',      label: 'Lead',              direction: 'above' },
  'Arsenic':          { limit: 0.01,  unit: 'mg/L',      label: 'Arsenic',           direction: 'above' },
  'Phosphorus':       { limit: 0.1,   unit: 'mg/L',      label: 'Total Phosphorus',  direction: 'above' },
};

// ── Fetch NRTWQ + WQP signals for a state (called per-state in cron) ────────

async function fetchWaterDataSignalsForState(stateAbbr: string): Promise<WaterDataSignal[]> {
  const signals: WaterDataSignal[] = [];

  // 1. NRTWQ exceedance probabilities
  try {
    const nrtwqUrl = `https://nrtwq.usgs.gov/explore/datatable?pcode=00300&period=31d_all&state=${stateAbbr}`;
    const nrtwqRes = await fetch(nrtwqUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 1800 },
    });
    if (nrtwqRes.ok) {
      const nrtwqData = await nrtwqRes.json();
      const rows = Array.isArray(nrtwqData) ? nrtwqData : nrtwqData?.data || nrtwqData?.rows || [];
      for (const row of rows) {
        const prob = parseFloat(row?.exceedance_probability ?? row?.exceed_prob ?? row?.probability ?? '');
        if (isNaN(prob) || prob <= 0.5) continue;
        const siteName = row?.station_nm || row?.site_name || row?.site_no || 'Unknown';
        signals.push({
          type: 'exceedance_probability',
          severity: prob > 0.8 ? 'high' : 'medium',
          title: `${(prob * 100).toFixed(0)}% probability DO exceedance at ${siteName}`,
          detail: `Modeled exceedance probability of ${(prob * 100).toFixed(0)}% for dissolved oxygen. Based on continuous sensor regression model.`,
          source: 'USGS NRTWQ',
          parameter: 'Dissolved Oxygen',
          value: prob,
          timestamp: row?.date || row?.datetime || new Date().toISOString(),
        });
      }
    }
  } catch (e: any) {
    console.warn(`[Enrichment] NRTWQ fetch failed for ${stateAbbr}:`, e.message);
  }

  // 2. WQP lab exceedances
  try {
    const fipsPair = ALL_STATES_WITH_FIPS.find(([st]) => st === stateAbbr);
    if (fipsPair) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const pad2 = (n: number) => n.toString().padStart(2, '0');
      const startDateLo = `${pad2(thirtyDaysAgo.getMonth() + 1)}-${pad2(thirtyDaysAgo.getDate())}-${thirtyDaysAgo.getFullYear()}`;

      const wqpParams = new URLSearchParams({
        statecode: `US:${fipsPair[1]}`,
        mimeType: 'application/json',
        startDateLo,
        sorted: 'yes',
        zip: 'no',
      });
      for (const c of ['Nitrate', 'Escherichia coli', 'Dissolved oxygen', 'Lead', 'Arsenic', 'Phosphorus']) {
        wqpParams.append('characteristicName', c);
      }

      const wqpUrl = `https://www.waterqualitydata.us/data/Result/search?${wqpParams.toString()}`;
      const wqpRes = await fetch(wqpUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20_000),
        next: { revalidate: 3600 },
      });
      if (wqpRes.ok) {
        const wqpData = await wqpRes.json();
        const results = Array.isArray(wqpData) ? wqpData : wqpData?.results || wqpData?.Result || [];
        const labSignals: (WaterDataSignal & { _ratio: number })[] = [];

        for (const r of results) {
          const charName = r?.CharacteristicName || r?.characteristicName || '';
          const threshold = EPA_THRESHOLDS[charName];
          if (!threshold) continue;

          const val = parseFloat(r?.ResultMeasureValue || r?.resultMeasureValue || '');
          if (isNaN(val)) continue;

          let exceeded = false;
          let ratio = 0;
          if (threshold.direction === 'below') {
            exceeded = val < threshold.limit;
            ratio = exceeded ? threshold.limit / Math.max(val, 0.001) : 0;
          } else {
            exceeded = val > threshold.limit;
            ratio = exceeded ? val / threshold.limit : 0;
          }
          if (!exceeded) continue;

          const locName = r?.MonitoringLocationName || r?.monitoringLocationName || 'Unknown Location';
          labSignals.push({
            type: 'lab_exceedance',
            severity: ratio >= 2 ? 'high' : 'medium',
            title: `${threshold.label} ${val} ${threshold.unit} at ${locName} (limit: ${threshold.limit})`,
            detail: `Lab sample: ${charName} measured at ${val} ${threshold.unit}, ${threshold.direction === 'below' ? 'below' : 'exceeding'} the ${threshold.limit} ${threshold.unit} threshold by ${ratio.toFixed(1)}x.`,
            source: 'Water Quality Portal',
            parameter: threshold.label,
            value: val,
            timestamp: r?.ActivityStartDate || r?.activityStartDate || new Date().toISOString(),
            _ratio: ratio,
          });
        }

        // Keep top 10 most severe
        labSignals.sort((a, b) => b._ratio - a._ratio);
        for (const { _ratio, ...clean } of labSignals.slice(0, 10)) {
          signals.push(clean);
        }
      }
    }
  } catch (e: any) {
    console.warn(`[Enrichment] WQP lab fetch failed for ${stateAbbr}:`, e.message);
  }

  return signals;
}

// ── Per-state filtering (async — fetches water-data signals + uses snapshot) ─

export async function getStateEnrichment(
  stateAbbr: string,
  snapshot: EnrichmentSnapshot,
): Promise<StateEnrichment> {
  const upper = stateAbbr.toUpperCase();

  // Filter signals to this state
  const stateSignals = snapshot.signals.filter(s => s.state === upper);

  // Get USGS threshold alerts from cache
  const usgsAlerts = getAlertsForState(upper);
  const criticalUsgsAlerts = usgsAlerts.filter(a => a.severity === 'critical');

  // Get NWS weather alerts from cache
  const nwsAlerts = getNwsAlerts(upper) || [];

  // Fetch NRTWQ + WQP signals for this state
  let waterDataSignals: WaterDataSignal[] = [];
  try {
    waterDataSignals = await fetchWaterDataSignalsForState(upper);
  } catch {
    // Non-fatal — proceed without water-data signals
  }

  // Critical condition: any critical USGS alert, high-severity signal,
  // severe NWS alert, or high-severity lab/model signal
  const hasCriticalCondition =
    criticalUsgsAlerts.length > 0 ||
    stateSignals.some(s =>
      s.category === 'spill' || s.category === 'bacteria' ||
      s.category === 'hab' || s.category === 'flood' || s.category === 'contamination'
    ) ||
    nwsAlerts.some(a => a.severity === 'Extreme' || a.severity === 'Severe') ||
    waterDataSignals.some(s => s.severity === 'high');

  return {
    usgsAlerts,
    criticalUsgsAlerts,
    signals: stateSignals,
    nwsAlerts,
    waterDataSignals,
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

  // Lab & model alerts: NRTWQ exceedance probabilities + WQP lab exceedances (cap 5)
  if (enrichment.waterDataSignals.length > 0) {
    const sorted = [...enrichment.waterDataSignals].sort((a, b) => {
      const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 };
      return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
    });
    result.labAndModelAlerts = sorted.slice(0, 5)
      .map(s => `[${s.source}] ${s.title} — ${s.detail}`)
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

  // Add water-data signals (NRTWQ + WQP) so new lab/model results bust the hash
  for (const s of enrichment.waterDataSignals) {
    signals.push({ type: s.type, severity: s.severity, title: s.title });
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
  if (enrichment.waterDataSignals.length > 0) {
    const labCount = enrichment.waterDataSignals.filter(s => s.type === 'lab_exceedance').length;
    const modelCount = enrichment.waterDataSignals.filter(s => s.type === 'exceedance_probability').length;
    const subParts: string[] = [];
    if (labCount > 0) subParts.push(`${labCount} lab exceedance${labCount > 1 ? 's' : ''}`);
    if (modelCount > 0) subParts.push(`${modelCount} modeled exceedance${modelCount > 1 ? 's' : ''}`);
    if (subParts.length > 0) parts.push(subParts.join(', '));
  }
  return parts.length > 0 ? parts.join(', ') : 'no real-time alerts';
}
