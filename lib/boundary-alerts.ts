// =============================================================
// Watershed Boundary Alert Engine
// PEARL Intelligence Network (PIN)
//
// Monitors waterbodies at MS4 permit boundaries.
// When a threshold is crossed on a waterbody, alerts are
// generated for neighboring MS4s that share or are
// downstream of that waterbody.
//
// Key principle: No data is shared between MS4s.
// Alerts only say WHAT changed and WHO to contact —
// never expose the neighbor's compliance data.
// =============================================================

import {
  Waterbody,
  MS4Permit,
  BoundaryAlert,
  AlertThresholdConfig,
  AlertSeverity,
  AlertType,
  Impairment,
  DEFAULT_THRESHOLD_CONFIGS,
} from "./types";

// ----- Waterbody Relationship Mapping -----

/**
 * Build a lookup of which MS4 permits are responsible for each waterbody.
 * A waterbody can be shared by multiple MS4s (many-to-many).
 */
export function buildWaterbodyPermitMap(
  permits: MS4Permit[]
): Map<string, MS4Permit[]> {
  const map = new Map<string, MS4Permit[]>();

  for (const permit of permits) {
    for (const wbId of permit.assignedWaterbodyIds) {
      const existing = map.get(wbId) || [];
      existing.push(permit);
      map.set(wbId, existing);
    }
  }

  return map;
}

/**
 * For a given MS4 permit, find all waterbodies that are directly
 * upstream or downstream of their assigned waterbodies.
 * These are the "boundary" waterbodies we need to monitor.
 */
export function findBoundaryWaterbodies(
  permit: MS4Permit,
  allWaterbodies: Map<string, Waterbody>
): { upstream: Waterbody[]; downstream: Waterbody[] } {
  const assignedSet = new Set(permit.assignedWaterbodyIds);
  const upstream: Waterbody[] = [];
  const downstream: Waterbody[] = [];

  for (const wbId of permit.assignedWaterbodyIds) {
    const wb = allWaterbodies.get(wbId);
    if (!wb) continue;

    // Check upstream neighbors — waterbodies flowing INTO ours
    for (const upId of wb.upstreamIds) {
      if (!assignedSet.has(upId)) {
        const upWb = allWaterbodies.get(upId);
        if (upWb) upstream.push(upWb);
      }
    }

    // Check downstream neighbors — waterbodies ours flows INTO
    for (const downId of wb.downstreamIds) {
      if (!assignedSet.has(downId)) {
        const downWb = allWaterbodies.get(downId);
        if (downWb) downstream.push(downWb);
      }
    }
  }

  // Deduplicate
  const dedup = (arr: Waterbody[]) =>
    Array.from(new Map(arr.map((w) => [w.assessmentUnitId, w])).values());

  return {
    upstream: dedup(upstream),
    downstream: dedup(downstream),
  };
}

// ----- Threshold Evaluation -----

/**
 * Check if an impairment has crossed a threshold boundary.
 * Returns severity level or null if within normal range.
 */
export function evaluateThreshold(
  impairment: Impairment,
  config: AlertThresholdConfig
): { severity: AlertSeverity; percentOver: number } | null {
  if (impairment.value === null) return null;

  const { value, threshold } = impairment;
  const ratio = value / threshold;
  const percent = ratio * 100;

  // Special handling for dissolved oxygen (lower is worse)
  if (config.category === "dissolved_oxygen") {
    // For DO, crossing means value DROPPED below threshold
    if (value >= threshold) return null;
    const doPercent = ((threshold - value) / threshold) * 100;
    return {
      severity: doPercent >= 20 ? "critical" : "warning",
      percentOver: doPercent,
    };
  }

  // Standard parameters — higher is worse
  if (percent >= config.criticalPercent) {
    return {
      severity: "critical",
      percentOver: percent - 100,
    };
  }

  if (percent >= config.warningPercent) {
    return {
      severity: "warning",
      percentOver: Math.max(0, percent - 100),
    };
  }

  return null;
}

/**
 * Determine trend direction from recent data points.
 */
export function detectTrend(
  recentValues: { value: number; date: string }[]
): "rising" | "falling" {
  if (recentValues.length < 2) return "rising";

  const sorted = [...recentValues].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const firstHalf = sorted.slice(0, Math.floor(sorted.length / 2));
  const secondHalf = sorted.slice(Math.floor(sorted.length / 2));

  const avg = (arr: { value: number }[]) =>
    arr.reduce((sum, v) => sum + v.value, 0) / arr.length;

  return avg(secondHalf) >= avg(firstHalf) ? "rising" : "falling";
}

// ----- Alert Generation -----

/**
 * Generate a unique alert ID from its components.
 */
function generateAlertId(
  sourceWbId: string,
  recipientPermitId: string,
  parameter: string,
  timestamp: string
): string {
  const hash = `${sourceWbId}-${recipientPermitId}-${parameter}-${timestamp}`
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 32);
  return `BA-${hash}`;
}

/**
 * Core alert generation: scan all boundary waterbodies for an MS4
 * and generate alerts when thresholds are crossed.
 *
 * This runs per-MS4: "What's happening at my borders that I should know about?"
 */
export function generateBoundaryAlerts(
  recipientPermit: MS4Permit,
  allWaterbodies: Map<string, Waterbody>,
  waterbodyPermitMap: Map<string, MS4Permit[]>,
  thresholdConfigs: AlertThresholdConfig[] = DEFAULT_THRESHOLD_CONFIGS,
  existingAlertIds: Set<string> = new Set()
): BoundaryAlert[] {
  const alerts: BoundaryAlert[] = [];
  const now = new Date().toISOString();

  const { upstream, downstream } = findBoundaryWaterbodies(
    recipientPermit,
    allWaterbodies
  );

  // Process both upstream and downstream boundary waterbodies
  const boundaryChecks: { waterbody: Waterbody; relationship: "upstream" | "downstream" }[] = [
    ...upstream.map((wb) => ({ waterbody: wb, relationship: "upstream" as const })),
    ...downstream.map((wb) => ({ waterbody: wb, relationship: "downstream" as const })),
  ];

  for (const { waterbody, relationship } of boundaryChecks) {
    // Find which MS4(s) are responsible for this boundary waterbody
    const responsiblePermits = waterbodyPermitMap.get(waterbody.assessmentUnitId) || [];

    // Filter out the recipient — don't alert yourself
    const neighborPermits = responsiblePermits.filter(
      (p) => p.permitId !== recipientPermit.permitId
    );

    if (neighborPermits.length === 0) continue;

    // Check each impairment on this waterbody against thresholds
    for (const impairment of waterbody.currentImpairments) {
      const config = thresholdConfigs.find(
        (c) => c.parameter === impairment.parameter
      );
      if (!config) continue;

      const result = evaluateThreshold(impairment, config);
      if (!result) continue;

      // Generate an alert for each neighboring MS4 responsible
      for (const neighborPermit of neighborPermits) {
        const alertId = generateAlertId(
          waterbody.assessmentUnitId,
          recipientPermit.permitId,
          impairment.parameter,
          now
        );

        // Skip if we already generated this alert
        if (existingAlertIds.has(alertId)) continue;

        const alert: BoundaryAlert = {
          id: alertId,
          timestamp: now,
          severity: result.severity,
          type: "threshold_exceeded",

          sourceWaterbodyId: waterbody.assessmentUnitId,
          sourceWaterbodyName: waterbody.name,

          parameter: impairment.parameter,
          category: impairment.category,
          currentValue: impairment.value!,
          threshold: impairment.threshold,
          unit: impairment.unit,
          direction: "rising", // Would use detectTrend() with historical data
          percentOverThreshold: result.percentOver,

          // WHO to contact — not WHAT their data looks like
          neighborPermitId: neighborPermit.permitId,
          neighborPermitteeName: neighborPermit.permitteeName,
          neighborContactName: neighborPermit.contactName,

          recipientPermitId: recipientPermit.permitId,
          relationship,

          status: "new",
          acknowledgedAt: null,
          resolvedAt: null,
          notes: [],
        };

        alerts.push(alert);
      }
    }
  }

  // Sort: critical first, then warning, then info
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return alerts.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
}

// ----- Alert Message Formatting -----

/**
 * Generate human-readable alert message.
 * KEY: Never exposes the neighbor's actual data or compliance status.
 * Only states what parameter changed on what waterbody and who to contact.
 */
export function formatAlertMessage(alert: BoundaryAlert): string {
  const severityLabel = {
    critical: "⚠️ CRITICAL",
    warning: "⚡ WARNING",
    info: "ℹ️ INFO",
  }[alert.severity];

  const relationshipText =
    alert.relationship === "upstream"
      ? "An upstream waterbody"
      : "A downstream waterbody";

  const directionText =
    alert.direction === "rising" ? "exceeded" : "dropped below";

  return [
    `${severityLabel}: ${alert.parameter} Threshold ${alert.direction === "rising" ? "Exceeded" : "Alert"}`,
    ``,
    `${relationshipText} that may affect your permitted waters has registered a change:`,
    ``,
    `  Waterbody: ${alert.sourceWaterbodyName} (${alert.sourceWaterbodyId})`,
    `  Parameter: ${alert.parameter} has ${directionText} the established threshold`,
    `  Severity: ${alert.percentOverThreshold.toFixed(1)}% ${alert.direction === "rising" ? "over" : "under"} limit`,
    ``,
    `Neighboring jurisdiction: ${alert.neighborPermitteeName}`,
    `Contact: ${alert.neighborContactName}`,
    ``,
    `This alert is provided for watershed coordination purposes.`,
    `No compliance data from the neighboring jurisdiction is included.`,
  ].join("\n");
}

/**
 * Generate a short one-line summary for dashboard cards.
 */
export function formatAlertSummary(alert: BoundaryAlert): string {
  const icon = {
    critical: "🔴",
    warning: "🟡",
    info: "🔵",
  }[alert.severity];

  return `${icon} ${alert.parameter} ${alert.relationship === "upstream" ? "↓" : "↑"} ${alert.sourceWaterbodyName} — Contact ${alert.neighborPermitteeName}`;
}
