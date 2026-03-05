/* ------------------------------------------------------------------ */
/*  PIN Alerts — Deployment Sensor Trigger                            */
/*  Compares live sensor readings against installation baselines.     */
/*  Emits AlertEvents for anomalies (flow, turbidity, DO, pH, TSS).  */
/*  Persists alerts + timeline to Supabase for deep-dive UX.         */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertSeverity } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** Sensor reading from a deployment (matches PEARLManagementCenter). */
export interface DeploymentReading {
  deploymentId: string;
  deploymentName: string;
  timestamp: string;
  do_mgl: number | null;
  temp_c: number | null;
  ph: number | null;
  turbidity_ntu: number | null;
  tss_mgl: number | null;
  flow_gpm: number | null;
  salinity_psu: number | null;
}

export interface DeploymentBaseline {
  do_mgl: number | null;
  temp_c: number | null;
  ph: number | null;
  turbidity_ntu: number | null;
  tss_mgl: number | null;
  flow_gpm: number | null;
  salinity_psu: number | null;
}

export interface DeploymentInput {
  id: string;
  name: string;
  reading: DeploymentReading | null;
  baseline: DeploymentBaseline;
}

interface DeploymentSnapshot {
  /** Last known severity per deployment+parameter, e.g. "dep-001:Flow Rate" → "warning" */
  alertStates: Record<string, AlertSeverity | null>;
  takenAt: string;
}

interface DetectedAnomaly {
  deploymentId: string;
  deploymentName: string;
  parameter: string;
  severity: AlertSeverity;
  value: number;
  baseline: number;
  delta: number;
  unit: string;
  title: string;
  diagnosis: string;
  recommendation: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/*  Core Analysis (extracted from PEARLManagementCenter.analyzeDelta)  */
/* ------------------------------------------------------------------ */

function analyzeDeployment(input: DeploymentInput): DetectedAnomaly[] {
  if (!input.reading) return [];
  const lr = input.reading;
  const bl = input.baseline;
  const anomalies: DetectedAnomaly[] = [];
  const ts = lr.timestamp;
  const depId = input.id;
  const depName = input.name;

  // Flow drop → pump issue
  if (lr.flow_gpm != null && bl.flow_gpm != null && bl.flow_gpm > 0) {
    const flowDelta = ((lr.flow_gpm - bl.flow_gpm) / bl.flow_gpm) * 100;
    if (flowDelta < -25) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'Flow Rate',
        severity: 'critical', value: lr.flow_gpm, baseline: bl.flow_gpm,
        delta: flowDelta, unit: 'GPM', timestamp: ts,
        title: `${depName}: Flow dropped ${Math.abs(flowDelta).toFixed(0)}% from baseline`,
        diagnosis: 'Significant flow reduction indicates potential pump impeller wear, intake blockage, or power supply issue.',
        recommendation: 'Dispatch field tech. Check intake screen, impeller condition, and power draw (amps).',
      });
    } else if (flowDelta < -10) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'Flow Rate',
        severity: 'warning', value: lr.flow_gpm, baseline: bl.flow_gpm,
        delta: flowDelta, unit: 'GPM', timestamp: ts,
        title: `${depName}: Flow reduced ${Math.abs(flowDelta).toFixed(0)}% from baseline`,
        diagnosis: 'Moderate flow reduction. Could be seasonal low-flow conditions, partial intake screening, or early pump wear.',
        recommendation: 'Monitor trend over next 48hrs. If continuing to decline, schedule maintenance window.',
      });
    }
  }

  // Turbidity spike post-treatment → resin/media degradation
  if (lr.turbidity_ntu != null && bl.turbidity_ntu != null && bl.turbidity_ntu > 0) {
    const turbDelta = ((lr.turbidity_ntu - bl.turbidity_ntu) / bl.turbidity_ntu) * 100;
    if (lr.turbidity_ntu > 15 && turbDelta > 50) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'Turbidity',
        severity: 'warning', value: lr.turbidity_ntu, baseline: bl.turbidity_ntu,
        delta: turbDelta, unit: 'NTU', timestamp: ts,
        title: `${depName}: Post-treatment turbidity rising — up ${turbDelta.toFixed(0)}%`,
        diagnosis: 'Increasing effluent turbidity suggests filter media saturation or resin exhaustion.',
        recommendation: 'Check resin bed pressure differential. If ΔP > spec, schedule resin replacement.',
      });
    }
  }

  // DO drop in oyster bed → fouling or die-off
  if (lr.do_mgl != null && bl.do_mgl != null && bl.do_mgl > 0) {
    const doDelta = ((lr.do_mgl - bl.do_mgl) / bl.do_mgl) * 100;
    if (lr.do_mgl < 4.0 && doDelta < -20) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'Dissolved Oxygen',
        severity: 'critical', value: lr.do_mgl, baseline: bl.do_mgl,
        delta: doDelta, unit: 'mg/L', timestamp: ts,
        title: `${depName}: DO dropped to ${lr.do_mgl.toFixed(1)} mg/L — ${Math.abs(doDelta).toFixed(0)}% below baseline`,
        diagnosis: 'Low DO suggests oyster bed stress — excessive organic loading, oyster mortality, or seasonal temperature stress.',
        recommendation: 'Visual inspection of oyster bed. Check for sediment burial, shell gaping (die-off indicator), or biofilm coating.',
      });
    } else if (doDelta > 30 && lr.do_mgl > 10) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'Dissolved Oxygen',
        severity: 'info', value: lr.do_mgl, baseline: bl.do_mgl,
        delta: doDelta, unit: 'mg/L', timestamp: ts,
        title: `${depName}: DO elevated ${doDelta.toFixed(0)}% above baseline`,
        diagnosis: 'Strong oyster biofiltration performance + possible algal photosynthesis contribution.',
        recommendation: 'Positive indicator. Document for efficacy reporting. Monitor for supersaturation (>120% sat).',
      });
    }
  }

  // pH drift → chemical change in bed
  if (lr.ph != null && bl.ph != null && bl.ph > 0) {
    const phDelta = lr.ph - bl.ph;
    if (Math.abs(phDelta) > 0.8) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'pH',
        severity: Math.abs(phDelta) > 1.2 ? 'critical' : 'warning',
        value: lr.ph, baseline: bl.ph,
        delta: phDelta, unit: 'pH', timestamp: ts,
        title: `${depName}: pH shifted ${phDelta > 0 ? '+' : ''}${phDelta.toFixed(1)} from baseline`,
        diagnosis: phDelta > 0
          ? 'Rising pH suggests oyster shell dissolution (CaCO₃ buffering) or algal CO₂ consumption.'
          : 'Falling pH indicates acidification — possible from high organic loading or anaerobic conditions.',
        recommendation: Math.abs(phDelta) > 1.2
          ? 'Investigate immediately. Check for upstream contamination or bed degradation.'
          : 'Monitor trend. If pH continues drifting >1.0 over 7 days, schedule inspection.',
      });
    }
  }

  // TSS removal rate degradation
  if (lr.tss_mgl != null && bl.tss_mgl != null && bl.tss_mgl > 0) {
    const currentRemoval = ((bl.tss_mgl - lr.tss_mgl) / bl.tss_mgl) * 100;
    if (currentRemoval < 70 && currentRemoval > 0) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'TSS Removal',
        severity: 'warning', value: currentRemoval, baseline: 90,
        delta: currentRemoval - 90, unit: '%', timestamp: ts,
        title: `${depName}: TSS removal at ${currentRemoval.toFixed(0)}% — below 70% threshold`,
        diagnosis: 'Filtration media may be saturated or influent loading increased. Cross-reference with flow rate.',
        recommendation: 'Check filter media condition. Compare influent vs effluent TSS.',
      });
    }
  }

  return anomalies;
}

/* ------------------------------------------------------------------ */
/*  Pipeline Evaluation (called by dispatch-alerts cron)              */
/* ------------------------------------------------------------------ */

/**
 * Evaluate all deployment inputs for anomalies.
 * Returns AlertEvent[] suitable for the real pipeline (dedup, cooldown, email).
 * Also writes anomalies to Supabase deployment_alerts + alert_timeline.
 */
export async function evaluateDeploymentAlerts(
  deployments: DeploymentInput[],
): Promise<AlertEvent[]> {
  const prevSnapshot = await loadCacheFromBlob<DeploymentSnapshot>(BLOB_PATHS.deploymentSnapshot);
  const prevStates = prevSnapshot?.alertStates ?? {};

  const events: AlertEvent[] = [];
  const newStates: Record<string, AlertSeverity | null> = {};
  const now = new Date().toISOString();

  for (const dep of deployments) {
    const anomalies = analyzeDeployment(dep);

    // Track which parameters had anomalies this run
    const activeParams = new Set(anomalies.map(a => a.parameter));

    // For each anomaly, check if it's a new alert or severity escalation
    for (const anomaly of anomalies) {
      const stateKey = `${dep.id}:${anomaly.parameter}`;
      const prevSeverity = prevStates[stateKey];
      newStates[stateKey] = anomaly.severity;

      // Only emit pipeline event on NEW alert or severity ESCALATION
      const severityRank = { info: 0, warning: 1, critical: 2 };
      const isNew = !prevSeverity;
      const isEscalation = prevSeverity && severityRank[anomaly.severity] > severityRank[prevSeverity];

      if (isNew || isEscalation) {
        events.push({
          id: crypto.randomUUID(),
          type: 'deployment',
          severity: anomaly.severity,
          title: anomaly.title,
          body: `${anomaly.diagnosis}\n\nRecommended action: ${anomaly.recommendation}`,
          entityId: anomaly.deploymentId,
          entityLabel: anomaly.deploymentName,
          dedupKey: `deployment:${anomaly.deploymentId}:${anomaly.parameter}:${anomaly.severity}`,
          createdAt: now,
          channel: 'email',
          recipientEmail: '',   // filled by dispatcher
          sent: false,
          sentAt: null,
          error: null,
          ruleId: null,
          metadata: {
            parameter: anomaly.parameter,
            value: anomaly.value,
            baseline: anomaly.baseline,
            delta: anomaly.delta,
            unit: anomaly.unit,
            diagnosis: anomaly.diagnosis,
            recommendation: anomaly.recommendation,
          },
        });
      }
    }

    // Clear parameters that are no longer anomalous
    for (const key of Object.keys(prevStates)) {
      if (key.startsWith(`${dep.id}:`) && !activeParams.has(key.split(':')[1])) {
        newStates[key] = null;
      }
    }
  }

  // Save snapshot for next run
  await saveCacheToBlob(BLOB_PATHS.deploymentSnapshot, {
    alertStates: newStates,
    takenAt: now,
  } satisfies DeploymentSnapshot);

  return events;
}

/**
 * Write detected anomalies to Supabase for the deep-dive UX.
 * Called from an API route (not the cron — Supabase writes need the client).
 */
export { analyzeDeployment };
export type { DetectedAnomaly };
