/* ------------------------------------------------------------------ */
/*  PIN Alerts - Deployment Sensor Trigger                             */
/*  Compares live sensor readings against installation baselines.      */
/*  Uses progressive classification to avoid false panic alerts.       */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertSeverity } from '../types';
import { BLOB_PATHS } from '../config';
import { saveCacheToBlob, loadCacheFromBlob } from '../../blobPersistence';

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

interface InvestigationState {
  consecutiveRuns: number;
  lastHypothesis: string;
  lastStage: string;
  lastConfidence: number;
  externalIssued: boolean;
  updatedAt: string;
}

interface DeploymentSnapshot {
  alertStates: Record<string, AlertSeverity | null>;
  investigations?: Record<string, InvestigationState>;
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

type ClassificationStage =
  | 'possible_anomaly'
  | 'likely_natural_or_operational'
  | 'unexplained_investigate'
  | 'external_alert';

type ClassificationHypothesis =
  | 'likely_algal_bloom'
  | 'likely_storm_runoff'
  | 'likely_sewage_discharge'
  | 'likely_sensor_glitch'
  | 'unexplained';

interface DeploymentClassification {
  stage: ClassificationStage;
  hypothesis: ClassificationHypothesis;
  confidence: number;
  corroborationCount: number;
  hasHardCriticalSignal: boolean;
  externalEligible: boolean;
  rationale: string[];
}

function analyzeDeployment(input: DeploymentInput): DetectedAnomaly[] {
  if (!input.reading) return [];
  const lr = input.reading;
  const bl = input.baseline;
  const anomalies: DetectedAnomaly[] = [];
  const ts = lr.timestamp;
  const depId = input.id;
  const depName = input.name;

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

  if (lr.turbidity_ntu != null && bl.turbidity_ntu != null && bl.turbidity_ntu > 0) {
    const turbDelta = ((lr.turbidity_ntu - bl.turbidity_ntu) / bl.turbidity_ntu) * 100;
    if (lr.turbidity_ntu > 15 && turbDelta > 50) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'Turbidity',
        severity: 'warning', value: lr.turbidity_ntu, baseline: bl.turbidity_ntu,
        delta: turbDelta, unit: 'NTU', timestamp: ts,
        title: `${depName}: Post-treatment turbidity rising - up ${turbDelta.toFixed(0)}%`,
        diagnosis: 'Increasing effluent turbidity suggests filter media saturation or resin exhaustion.',
        recommendation: 'Check resin bed pressure differential. If pressure delta is above spec, schedule resin replacement.',
      });
    }
  }

  if (lr.do_mgl != null && bl.do_mgl != null && bl.do_mgl > 0) {
    const doDelta = ((lr.do_mgl - bl.do_mgl) / bl.do_mgl) * 100;
    if (lr.do_mgl < 4.0 && doDelta < -20) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'Dissolved Oxygen',
        severity: 'critical', value: lr.do_mgl, baseline: bl.do_mgl,
        delta: doDelta, unit: 'mg/L', timestamp: ts,
        title: `${depName}: DO dropped to ${lr.do_mgl.toFixed(1)} mg/L - ${Math.abs(doDelta).toFixed(0)}% below baseline`,
        diagnosis: 'Low DO suggests oyster bed stress from loading, mortality, or seasonal temperature pressure.',
        recommendation: 'Inspect oyster bed and upstream loading conditions; collect confirmatory field sample.',
      });
    } else if (doDelta > 30 && lr.do_mgl > 10) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'Dissolved Oxygen',
        severity: 'info', value: lr.do_mgl, baseline: bl.do_mgl,
        delta: doDelta, unit: 'mg/L', timestamp: ts,
        title: `${depName}: DO elevated ${doDelta.toFixed(0)}% above baseline`,
        diagnosis: 'Strong biofiltration performance with possible photosynthetic contribution.',
        recommendation: 'Document for efficacy reporting and continue trend checks.',
      });
    }
  }

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
          ? 'Rising pH suggests carbonate buffering or photosynthetic drawdown of dissolved CO2.'
          : 'Falling pH indicates acidification pressure from loading or anaerobic conditions.',
        recommendation: Math.abs(phDelta) > 1.2
          ? 'Investigate immediately with field check and grab sample.'
          : 'Monitor trend and inspect if drift persists.',
      });
    }
  }

  if (lr.tss_mgl != null && bl.tss_mgl != null && bl.tss_mgl > 0) {
    const currentRemoval = ((bl.tss_mgl - lr.tss_mgl) / bl.tss_mgl) * 100;
    if (currentRemoval < 70 && currentRemoval > 0) {
      anomalies.push({
        deploymentId: depId, deploymentName: depName, parameter: 'TSS Removal',
        severity: 'warning', value: currentRemoval, baseline: 90,
        delta: currentRemoval - 90, unit: '%', timestamp: ts,
        title: `${depName}: TSS removal at ${currentRemoval.toFixed(0)}% - below 70% threshold`,
        diagnosis: 'Filtration media may be saturated or influent loading increased.',
        recommendation: 'Check media condition and compare influent vs effluent TSS.',
      });
    }
  }

  return anomalies;
}

function formatClassificationLabel(h: ClassificationHypothesis): string {
  if (h === 'likely_algal_bloom') return 'Likely Algal Bloom';
  if (h === 'likely_storm_runoff') return 'Likely Storm Runoff';
  if (h === 'likely_sewage_discharge') return 'Likely Sewage Discharge';
  if (h === 'likely_sensor_glitch') return 'Likely Sensor/Operational Glitch';
  return 'Unexplained';
}

function formatStageLabel(s: ClassificationStage): string {
  if (s === 'likely_natural_or_operational') return 'Likely Natural/Operational';
  if (s === 'unexplained_investigate') return 'Unexplained - Investigate';
  if (s === 'external_alert') return 'External Alert';
  return 'Possible Anomaly';
}

function classifyDeploymentAnomaly(
  input: DeploymentInput,
  anomalies: DetectedAnomaly[],
  prev: InvestigationState | null,
): DeploymentClassification {
  const reading = input.reading;
  const baseline = input.baseline;
  const active = anomalies.filter((a) => a.severity !== 'info');
  const corroborationCount = new Set(active.map((a) => a.parameter)).size;
  const hasHardCriticalSignal = active.some((a) => a.severity === 'critical' && Math.abs(a.delta) >= 30);

  if (!reading || active.length === 0) {
    return {
      stage: 'possible_anomaly',
      hypothesis: 'unexplained',
      confidence: 0,
      corroborationCount: 0,
      hasHardCriticalSignal: false,
      externalEligible: false,
      rationale: ['No actionable anomaly signals in current run.'],
    };
  }

  const rationale: string[] = [];
  const hasLowDo = reading.do_mgl != null && reading.do_mgl < 4;
  const hasHighTurb = reading.turbidity_ntu != null && reading.turbidity_ntu > 15;
  const hasDoDrop = active.some((a) => a.parameter === 'Dissolved Oxygen' && a.delta < -20);
  const hasPhDrop = active.some((a) => a.parameter === 'pH' && a.delta < -0.8);
  const hasPhRise = active.some((a) => a.parameter === 'pH' && a.delta > 0.8);
  const hasDoRise = anomalies.some((a) => a.parameter === 'Dissolved Oxygen' && a.delta > 30);
  const hasFlowDrop = active.some((a) => a.parameter === 'Flow Rate');
  const hasTssRemovalDrop = active.some((a) => a.parameter === 'TSS Removal');
  const flowIncrease =
    reading.flow_gpm != null &&
    baseline.flow_gpm != null &&
    baseline.flow_gpm > 0 &&
    ((reading.flow_gpm - baseline.flow_gpm) / baseline.flow_gpm) * 100 > 20;

  let hypothesis: ClassificationHypothesis = 'unexplained';
  let confidence = 0.35;

  if (hasDoDrop && hasHighTurb && (hasPhDrop || hasTssRemovalDrop)) {
    hypothesis = 'likely_sewage_discharge';
    confidence = 0.82;
    rationale.push('DO decline + turbidity elevation with chemistry shift matches sewage-like signature.');
  } else if (hasHighTurb && flowIncrease) {
    hypothesis = 'likely_storm_runoff';
    confidence = 0.72;
    rationale.push('Turbidity spike with elevated flow indicates runoff influence.');
  } else if (hasDoRise && hasPhRise && !hasLowDo) {
    hypothesis = 'likely_algal_bloom';
    confidence = 0.66;
    rationale.push('DO oversaturation and pH rise are consistent with bloom/photosynthetic activity.');
  } else if (corroborationCount <= 1 && hasFlowDrop) {
    hypothesis = 'likely_sensor_glitch';
    confidence = 0.62;
    rationale.push('Single-parameter operational deviation suggests sensor/pump issue before contamination.');
  } else {
    rationale.push('Signal pattern remains unresolved after first-pass attribution.');
  }

  const consecutiveRuns = (prev?.consecutiveRuns ?? 0) + 1;
  const persistent = consecutiveRuns >= 3;
  const corroborated = corroborationCount >= 2;
  const failedGlitchGate = hypothesis !== 'likely_sensor_glitch';

  let stage: ClassificationStage = 'possible_anomaly';
  if (hypothesis !== 'unexplained') stage = 'likely_natural_or_operational';
  if (persistent && corroborated && failedGlitchGate) stage = 'unexplained_investigate';

  const externalEligible =
    hasHardCriticalSignal ||
    (stage === 'unexplained_investigate' && consecutiveRuns >= 4 && !prev?.externalIssued);
  if (externalEligible) stage = 'external_alert';

  if (persistent) rationale.push(`Signal persistence observed over ${consecutiveRuns} consecutive runs.`);
  if (corroborated) rationale.push(`Corroboration from ${corroborationCount} independent parameters.`);
  if (!failedGlitchGate) rationale.push('Glitch gate active: suppressing external alert pending more evidence.');

  return {
    stage,
    hypothesis,
    confidence: Math.max(0, Math.min(0.98, confidence)),
    corroborationCount,
    hasHardCriticalSignal,
    externalEligible,
    rationale,
  };
}

export async function evaluateDeploymentAlerts(
  deployments: DeploymentInput[],
): Promise<AlertEvent[]> {
  const prevSnapshot = await loadCacheFromBlob<DeploymentSnapshot>(BLOB_PATHS.deploymentSnapshot);
  const prevStates = prevSnapshot?.alertStates ?? {};
  const prevInvestigations = prevSnapshot?.investigations ?? {};

  const events: AlertEvent[] = [];
  const newStates: Record<string, AlertSeverity | null> = {};
  const newInvestigations: Record<string, InvestigationState> = {};
  const now = new Date().toISOString();

  for (const dep of deployments) {
    const anomalies = analyzeDeployment(dep);
    const activeSignals = anomalies.filter((a) => a.severity !== 'info');
    const activeParams = new Set(anomalies.map((a) => a.parameter));
    const prevInvestigation = prevInvestigations[dep.id] ?? null;
    const classification = classifyDeploymentAnomaly(dep, anomalies, prevInvestigation);

    const nextConsecutive = activeSignals.length > 0 ? (prevInvestigation?.consecutiveRuns ?? 0) + 1 : 0;
    newInvestigations[dep.id] = {
      consecutiveRuns: nextConsecutive,
      lastHypothesis: classification.hypothesis,
      lastStage: classification.stage,
      lastConfidence: classification.confidence,
      externalIssued: classification.externalEligible ? true : Boolean(prevInvestigation?.externalIssued && nextConsecutive > 0),
      updatedAt: now,
    };

    for (const anomaly of anomalies) {
      const stateKey = `${dep.id}:${anomaly.parameter}`;
      const prevSeverity = prevStates[stateKey];
      newStates[stateKey] = anomaly.severity;

      const severityRank = { info: 0, warning: 1, critical: 2 };
      const isNew = !prevSeverity;
      const isEscalation = prevSeverity && severityRank[anomaly.severity] > severityRank[prevSeverity];
      const shouldEmit = classification.externalEligible || (anomaly.severity === 'critical' && classification.hasHardCriticalSignal);

      if ((isNew || isEscalation) && shouldEmit) {
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
          recipientEmail: '',
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
            classificationStage: classification.stage,
            classificationHypothesis: classification.hypothesis,
            classificationLabel: formatClassificationLabel(classification.hypothesis),
            stageLabel: formatStageLabel(classification.stage),
            confidence: classification.confidence,
            corroborationCount: classification.corroborationCount,
            rationale: classification.rationale,
          },
        });
      }
    }

    if (classification.externalEligible) {
      const hypothesisLabel = formatClassificationLabel(classification.hypothesis);
      events.push({
        id: crypto.randomUUID(),
        type: 'deployment',
        severity: classification.hasHardCriticalSignal ? 'critical' : 'warning',
        title: `${dep.name}: ${hypothesisLabel} (${formatStageLabel(classification.stage)})`,
        body: [
          `Progressive classification update: ${hypothesisLabel}.`,
          `Confidence: ${(classification.confidence * 100).toFixed(0)}%. Corroboration: ${classification.corroborationCount} parameters.`,
          'Persistent unexplained signal under investigation; no confirmed contamination event yet.',
        ].join(' '),
        entityId: dep.id,
        entityLabel: dep.name,
        dedupKey: `deployment:${dep.id}:classification:${classification.hypothesis}:${classification.stage}`,
        createdAt: now,
        channel: 'email',
        recipientEmail: '',
        sent: false,
        sentAt: null,
        error: null,
        ruleId: null,
        metadata: {
          classificationStage: classification.stage,
          classificationHypothesis: classification.hypothesis,
          classificationLabel: hypothesisLabel,
          stageLabel: formatStageLabel(classification.stage),
          confidence: classification.confidence,
          corroborationCount: classification.corroborationCount,
          rationale: classification.rationale,
          anomalies: activeSignals.map((a) => ({
            parameter: a.parameter,
            severity: a.severity,
            value: a.value,
            baseline: a.baseline,
            delta: a.delta,
            unit: a.unit,
          })),
        },
      });
    }

    for (const key of Object.keys(prevStates)) {
      if (key.startsWith(`${dep.id}:`) && !activeParams.has(key.split(':')[1])) {
        newStates[key] = null;
      }
    }
  }

  await saveCacheToBlob(BLOB_PATHS.deploymentSnapshot, {
    alertStates: newStates,
    investigations: newInvestigations,
    takenAt: now,
  } satisfies DeploymentSnapshot);

  return events;
}

export { analyzeDeployment };
export type { DetectedAnomaly };
