/**
 * USGS Threshold Alert Engine — evaluates incoming IV readings against
 * water quality thresholds and returns fired alerts.
 *
 * Pure functions: no side effects, no cache writes. The cron route calls
 * evaluateThresholds() and stores results via usgsAlertCache.
 */

import type { UsgsIvReading } from './nwisIvCache';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UsgsAlert {
  id: string;                  // "01646500-DO-critical-{timestamp}"
  siteNumber: string;
  siteName: string;
  state: string;
  lat: number;
  lng: number;
  parameter: string;           // "DO", "pH", "temperature", etc.
  parameterCd: string;         // "00300"
  value: number;
  unit: string;
  threshold: number;
  severity: 'warning' | 'critical';
  type: string;                // "low-do", "high-temp", "low-ph", etc.
  title: string;               // "Critical Low Dissolved Oxygen"
  message: string;             // "DO at 2.8 mg/L at Potomac River — fish kill risk"
  firedAt: string;             // ISO timestamp
  readingTime: string;         // When USGS recorded the reading
}

// ── Threshold Rules ──────────────────────────────────────────────────────────

interface ThresholdRule {
  parameter: string;       // Mapped name: "DO", "pH", etc.
  parameterCd: string;
  unit: string;
  checks: {
    direction: 'below' | 'above';
    warning: number;
    critical: number;
    type: string;          // "low-do", "high-temp"
    titlePrefix: string;   // "Low Dissolved Oxygen"
    riskNote: string;      // appended to critical message
  }[];
}

const THRESHOLD_RULES: ThresholdRule[] = [
  {
    parameter: 'DO', parameterCd: '00300', unit: 'mg/L',
    checks: [{
      direction: 'below', warning: 5.0, critical: 4.0,
      type: 'low-do', titlePrefix: 'Low Dissolved Oxygen',
      riskNote: 'fish kill risk',
    }],
  },
  {
    parameter: 'pH', parameterCd: '00400', unit: 'std units',
    checks: [
      {
        direction: 'below', warning: 6.0, critical: 5.5,
        type: 'low-ph', titlePrefix: 'Low pH',
        riskNote: 'acidic conditions — aquatic life stress',
      },
      {
        direction: 'above', warning: 9.0, critical: 9.5,
        type: 'high-ph', titlePrefix: 'High pH',
        riskNote: 'alkaline conditions — ammonia toxicity risk',
      },
    ],
  },
  {
    parameter: 'temperature', parameterCd: '00010', unit: '°C',
    checks: [{
      direction: 'above', warning: 28, critical: 32,
      type: 'high-temp', titlePrefix: 'High Water Temperature',
      riskNote: 'thermal stress — dissolved oxygen depletion',
    }],
  },
  {
    parameter: 'turbidity', parameterCd: '63680', unit: 'NTU',
    checks: [{
      direction: 'above', warning: 50, critical: 200,
      type: 'high-turbidity', titlePrefix: 'High Turbidity',
      riskNote: 'sediment loading — habitat degradation',
    }],
  },
  {
    parameter: 'conductivity', parameterCd: '00095', unit: 'µS/cm',
    checks: [{
      direction: 'above', warning: 1500, critical: 2500,
      type: 'high-conductivity', titlePrefix: 'High Conductivity',
      riskNote: 'possible contamination or saltwater intrusion',
    }],
  },
];

// ── Evaluation ───────────────────────────────────────────────────────────────

/**
 * Evaluate a set of IV readings against threshold rules.
 * Returns fired alerts (only warning + critical; "info" is not emitted).
 *
 * @param readings - Flat array of IV readings (usually one state's worth)
 * @param siteNames - Map of siteNumber → siteName (for human-readable messages)
 * @param siteStates - Map of siteNumber → state abbreviation
 */
export function evaluateThresholds(
  readings: UsgsIvReading[],
  siteNames: Map<string, string>,
  siteStates: Map<string, string>,
): UsgsAlert[] {
  const alerts: UsgsAlert[] = [];
  const now = new Date().toISOString();

  for (const reading of readings) {
    const rule = THRESHOLD_RULES.find(r => r.parameterCd === reading.parameterCd);
    if (!rule) continue;

    for (const check of rule.checks) {
      let severity: 'warning' | 'critical' | null = null;
      let threshold: number;

      if (check.direction === 'below') {
        if (reading.value < check.critical) {
          severity = 'critical';
          threshold = check.critical;
        } else if (reading.value < check.warning) {
          severity = 'warning';
          threshold = check.warning;
        } else {
          continue;
        }
      } else {
        // above
        if (reading.value > check.critical) {
          severity = 'critical';
          threshold = check.critical;
        } else if (reading.value > check.warning) {
          severity = 'warning';
          threshold = check.warning;
        } else {
          continue;
        }
      }

      const siteName = siteNames.get(reading.siteNumber) || reading.siteNumber;
      const state = siteStates.get(reading.siteNumber) || '';
      const title = `${severity === 'critical' ? 'Critical' : 'Warning'}: ${check.titlePrefix}`;
      const valueStr = `${reading.value} ${rule.unit}`;
      const threshStr = `${check.direction === 'below' ? '<' : '>'} ${threshold!} ${rule.unit}`;
      const message = severity === 'critical'
        ? `${rule.parameter} at ${valueStr} (${threshStr}) at ${siteName} — ${check.riskNote}`
        : `${rule.parameter} at ${valueStr} (${threshStr}) at ${siteName}`;

      alerts.push({
        id: `${reading.siteNumber}-${rule.parameter}-${severity}-${Date.now()}`,
        siteNumber: reading.siteNumber,
        siteName,
        state,
        lat: reading.lat,
        lng: reading.lng,
        parameter: rule.parameter,
        parameterCd: reading.parameterCd,
        value: reading.value,
        unit: rule.unit,
        threshold: threshold!,
        severity,
        type: check.type,
        title,
        message,
        firedAt: now,
        readingTime: reading.dateTime,
      });
    }
  }

  return alerts;
}

/**
 * Deduplicate alerts: keep only the latest alert per siteNumber+parameter+type.
 */
export function deduplicateAlerts(alerts: UsgsAlert[]): UsgsAlert[] {
  const map = new Map<string, UsgsAlert>();
  for (const a of alerts) {
    const key = `${a.siteNumber}|${a.parameter}|${a.type}`;
    const existing = map.get(key);
    if (!existing || a.firedAt > existing.firedAt) {
      map.set(key, a);
    }
  }
  return Array.from(map.values());
}

/**
 * Remove alerts older than 24 hours.
 */
export function expireAlerts(alerts: UsgsAlert[]): UsgsAlert[] {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return alerts.filter(a => new Date(a.firedAt).getTime() > cutoff);
}
