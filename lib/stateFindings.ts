// =============================================================
// State Report Card — Deterministic Findings Generator
// PEARL Intelligence Network (PIN)
//
// Replaces AI-generated "10 key findings" with computed facts
// from cached ATTAINS/WQP/ECHO data. Zero API calls. Instant.
// =============================================================

// ── Data Types (mirrors your lib/ .ts structures) ──

export interface StateAssessmentData {
  stateCode: string;
  stateName: string;
  reportingCycle: string; // e.g. "2022"
  lastUpdated: string;    // ISO date

  // Assessment unit counts
  totalAssessmentUnits: number;
  assessedUnits: number;
  unassessedUnits: number;

  // Impairment categories
  category1: number;  // Attaining — all uses met
  category2: number;  // Attaining — some uses assessed, all met
  category3: number;  // Insufficient data
  category4a: number; // Impaired — TMDL completed
  category4b: number; // Impaired — other controls in place
  category4c: number; // Impaired — not caused by a pollutant
  category5: number;  // Impaired — TMDL needed

  // Uses
  totalUseAssessments: number;
  usesFullySupporting: number;
  usesNotSupporting: number;
  usesInsufficientInfo: number;

  // Pollutants / causes (sorted by frequency)
  topCauses: { cause: string; count: number; percentage: number }[];

  // Sources of impairment
  topSources: { source: string; count: number }[];

  // TMDLs
  tmdlsCompleted: number;
  tmdlsNeeded: number;  // should roughly equal category5

  // Water domains coverage
  surfaceWaterUnits: number;
  drinkingWaterSystems: number;
  drinkingWaterViolations: number;
  npdesPermits: number;
  npdesViolatingFacilities: number;
  ms4Permits: number;
  groundwaterSites: number;

  // Monitoring
  monitoringStations: number;
  stationsWithRecentData: number; // data within last 2 years
  stationsStale: number;          // no data in 2+ years

  // Environmental justice
  avgEjIndex: number;
  highEjUnits: number; // units with EJ index > 80
  populationInHighEj: number;

  // Trends (computed from historical cycles)
  impairmentTrend: "improving" | "stable" | "worsening" | "insufficient_data";
  impairmentRateCurrentCycle: number;  // percentage
  impairmentRatePriorCycle: number;    // percentage
  priorCycleYear: string;

  // Grant funding
  estimatedGrantEligibility: number; // $ amount
  activeGrantPrograms: number;

  // PFAS (emerging)
  pfasDetections: number;
  pfasMonitoredSites: number;
}

// ── Grade Calculator ──

type Grade = "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D+" | "D" | "D-" | "F";

function calculateGrade(data: StateAssessmentData): { grade: Grade; score: number } {
  // Weighted score from multiple factors (0-100)
  const impairmentRate = data.assessedUnits > 0
    ? ((data.category5 + data.category4a + data.category4b + data.category4c) / data.assessedUnits) * 100
    : 0;
  const assessmentCoverage = data.totalAssessmentUnits > 0
    ? (data.assessedUnits / data.totalAssessmentUnits) * 100
    : 0;
  const tmdlCoverage = data.tmdlsNeeded > 0
    ? (data.tmdlsCompleted / (data.tmdlsCompleted + data.tmdlsNeeded)) * 100
    : 100;
  const monitoringFreshness = data.monitoringStations > 0
    ? (data.stationsWithRecentData / data.monitoringStations) * 100
    : 0;
  const complianceRate = data.npdesPermits > 0
    ? ((data.npdesPermits - data.npdesViolatingFacilities) / data.npdesPermits) * 100
    : 100;

  // Weighted composite (lower impairment = better)
  const score = Math.round(
    (100 - impairmentRate) * 0.35 +    // 35% weight: less impairment = better
    assessmentCoverage * 0.15 +          // 15%: more coverage = better
    tmdlCoverage * 0.20 +               // 20%: more TMDLs done = better
    monitoringFreshness * 0.15 +         // 15%: fresher data = better
    complianceRate * 0.15                // 15%: better compliance = better
  );

  const grade: Grade =
    score >= 97 ? "A" : score >= 93 ? "A-" :
    score >= 90 ? "B+" : score >= 87 ? "B" : score >= 83 ? "B-" :
    score >= 80 ? "C+" : score >= 77 ? "C" : score >= 73 ? "C-" :
    score >= 70 ? "D+" : score >= 67 ? "D" : score >= 63 ? "D-" : "F";

  return { grade, score };
}

// ── Severity Assessment ──

type Severity = "Critical" | "Serious" | "Moderate" | "Fair" | "Good";

function assessSeverity(data: StateAssessmentData): Severity {
  const impairmentRate = data.assessedUnits > 0
    ? ((data.category5) / data.assessedUnits) * 100
    : 0;
  if (impairmentRate > 40) return "Critical";
  if (impairmentRate > 25) return "Serious";
  if (impairmentRate > 15) return "Moderate";
  if (impairmentRate > 5) return "Fair";
  return "Good";
}

// ── Core: Deterministic Findings Generator ──

export interface Finding {
  id: string;
  category: "impairment" | "monitoring" | "compliance" | "trend" | "ej" | "domain" | "emerging" | "tmdl" | "funding" | "infrastructure";
  severity: "critical" | "warning" | "info" | "positive";
  title: string;
  detail: string;
  metric?: string;        // e.g. "34.2%"
  metricLabel?: string;   // e.g. "Impairment Rate"
  dataSource: string;
}

export function generateFindings(data: StateAssessmentData): Finding[] {
  const findings: { finding: Finding; priority: number }[] = [];
  const pct = (n: number, d: number) => d > 0 ? ((n / d) * 100).toFixed(1) : "0";
  const { grade, score } = calculateGrade(data);
  const severity = assessSeverity(data);

  // ── 1. Overall Impairment Rate ──
  const totalImpaired = data.category5 + data.category4a + data.category4b + data.category4c;
  const impairmentRate = parseFloat(pct(totalImpaired, data.assessedUnits));
  const cat5Rate = parseFloat(pct(data.category5, data.assessedUnits));

  findings.push({
    priority: 100,
    finding: {
      id: "impairment-rate",
      category: "impairment",
      severity: impairmentRate > 30 ? "critical" : impairmentRate > 15 ? "warning" : "info",
      title: `${impairmentRate}% of assessed waterbodies are impaired`,
      detail: `Of ${data.assessedUnits.toLocaleString()} assessed waterbodies, ${totalImpaired.toLocaleString()} carry some level of impairment (Categories 4a, 4b, 4c, or 5). ${data.stateName} receives an overall grade of ${grade} (${score}/100).`,
      metric: `${impairmentRate}%`,
      metricLabel: "Impairment Rate",
      dataSource: "EPA ATTAINS Integrated Report",
    },
  });

  // ── 2. Category 5 — TMDL Backlog ──
  if (data.category5 > 0) {
    const backlogSeverity = cat5Rate > 20 ? "critical" : cat5Rate > 10 ? "warning" : "info";
    findings.push({
      priority: 95,
      finding: {
        id: "cat5-backlog",
        category: "tmdl",
        severity: backlogSeverity,
        title: `${data.category5.toLocaleString()} waterbodies on 303(d) list awaiting TMDLs`,
        detail: `${cat5Rate}% of assessed units are Category 5 — impaired with no TMDL plan in place. ${data.tmdlsCompleted.toLocaleString()} TMDLs have been completed, leaving a backlog of ${data.tmdlsNeeded.toLocaleString()} still needed.`,
        metric: data.category5.toLocaleString(),
        metricLabel: "Cat 5 Waterbodies",
        dataSource: "EPA ATTAINS 303(d) List",
      },
    });
  }

  // ── 3. Top Cause of Impairment ──
  if (data.topCauses.length > 0) {
    const top = data.topCauses[0];
    findings.push({
      priority: 90,
      finding: {
        id: "top-cause",
        category: "impairment",
        severity: "warning",
        title: `Leading cause of impairment: ${top.cause}`,
        detail: `${top.cause} affects ${top.count.toLocaleString()} waterbodies (${top.percentage.toFixed(1)}% of impaired units).${data.topCauses.length > 1 ? ` Followed by ${data.topCauses[1].cause} (${data.topCauses[1].count.toLocaleString()}) and ${data.topCauses.length > 2 ? data.topCauses[2].cause + ` (${data.topCauses[2].count.toLocaleString()})` : "others"}.` : ""}`,
        metric: `${top.percentage.toFixed(0)}%`,
        metricLabel: "of Impairments",
        dataSource: "EPA ATTAINS Cause/Source",
      },
    });
  }

  // ── 4. TMDL Coverage ──
  const tmdlTotal = data.tmdlsCompleted + data.tmdlsNeeded;
  if (tmdlTotal > 0) {
    const tmdlRate = parseFloat(pct(data.tmdlsCompleted, tmdlTotal));
    findings.push({
      priority: 85,
      finding: {
        id: "tmdl-coverage",
        category: "tmdl",
        severity: tmdlRate < 30 ? "critical" : tmdlRate < 60 ? "warning" : "positive",
        title: `${tmdlRate}% TMDL completion rate`,
        detail: `${data.tmdlsCompleted.toLocaleString()} of ${tmdlTotal.toLocaleString()} required TMDLs have been completed. ${tmdlRate < 50 ? "Significant backlog remains — federal backstop authority may apply under CWA §303(d)." : "Progress is being made toward addressing impairment sources."}`,
        metric: `${tmdlRate}%`,
        metricLabel: "TMDLs Complete",
        dataSource: "EPA ATTAINS TMDL Tracking",
      },
    });
  }

  // ── 5. Assessment Coverage Gap ──
  if (data.unassessedUnits > 0) {
    const unassessedRate = parseFloat(pct(data.unassessedUnits, data.totalAssessmentUnits));
    findings.push({
      priority: unassessedRate > 30 ? 88 : 70,
      finding: {
        id: "assessment-gap",
        category: "monitoring",
        severity: unassessedRate > 40 ? "critical" : unassessedRate > 20 ? "warning" : "info",
        title: `${data.unassessedUnits.toLocaleString()} waterbodies (${unassessedRate}%) remain unassessed`,
        detail: `Of ${data.totalAssessmentUnits.toLocaleString()} total assessment units, ${data.unassessedUnits.toLocaleString()} have not been assessed in the current reporting cycle. These represent potential unknown impairments.`,
        metric: `${unassessedRate}%`,
        metricLabel: "Unassessed",
        dataSource: "EPA ATTAINS Assessment Coverage",
      },
    });
  }

  // ── 6. Monitoring Freshness ──
  if (data.stationsStale > 0) {
    const staleRate = parseFloat(pct(data.stationsStale, data.monitoringStations));
    findings.push({
      priority: staleRate > 40 ? 82 : 60,
      finding: {
        id: "stale-monitoring",
        category: "monitoring",
        severity: staleRate > 50 ? "critical" : staleRate > 25 ? "warning" : "info",
        title: `${staleRate}% of monitoring stations have stale data (2+ years)`,
        detail: `${data.stationsStale.toLocaleString()} of ${data.monitoringStations.toLocaleString()} stations have not reported data in over 2 years. ${data.stationsWithRecentData.toLocaleString()} stations are actively reporting. Data gaps reduce confidence in impairment assessments.`,
        metric: `${data.stationsStale.toLocaleString()}`,
        metricLabel: "Stale Stations",
        dataSource: "EPA WQP / USGS NWIS",
      },
    });
  }

  // ── 7. NPDES Compliance ──
  if (data.npdesViolatingFacilities > 0) {
    const violationRate = parseFloat(pct(data.npdesViolatingFacilities, data.npdesPermits));
    findings.push({
      priority: violationRate > 15 ? 87 : 65,
      finding: {
        id: "npdes-compliance",
        category: "compliance",
        severity: violationRate > 20 ? "critical" : violationRate > 10 ? "warning" : "info",
        title: `${data.npdesViolatingFacilities.toLocaleString()} NPDES facilities in violation (${violationRate}%)`,
        detail: `Of ${data.npdesPermits.toLocaleString()} permitted facilities, ${data.npdesViolatingFacilities.toLocaleString()} are currently in violation of discharge limits. These point-source discharges may be contributing to downstream impairments.`,
        metric: `${data.npdesViolatingFacilities.toLocaleString()}`,
        metricLabel: "Facilities Violating",
        dataSource: "EPA ECHO/ICIS-NPDES",
      },
    });
  }

  // ── 8. Drinking Water ──
  if (data.drinkingWaterViolations > 0) {
    findings.push({
      priority: data.drinkingWaterViolations > 50 ? 92 : 75,
      finding: {
        id: "drinking-water",
        category: "domain",
        severity: data.drinkingWaterViolations > 100 ? "critical" : data.drinkingWaterViolations > 20 ? "warning" : "info",
        title: `${data.drinkingWaterViolations.toLocaleString()} drinking water violations across ${data.drinkingWaterSystems.toLocaleString()} systems`,
        detail: `Active SDWIS violations affect public water systems in ${data.stateName}. Source water quality in impaired surface and groundwater units may compound treatment challenges.`,
        metric: `${data.drinkingWaterViolations.toLocaleString()}`,
        metricLabel: "DW Violations",
        dataSource: "EPA SDWIS",
      },
    });
  }

  // ── 9. Environmental Justice ──
  if (data.highEjUnits > 0) {
    findings.push({
      priority: data.populationInHighEj > 100000 ? 86 : 68,
      finding: {
        id: "ej-exposure",
        category: "ej",
        severity: data.populationInHighEj > 500000 ? "critical" : data.populationInHighEj > 100000 ? "warning" : "info",
        title: `${data.highEjUnits.toLocaleString()} impaired waterbodies in high EJ-burden areas`,
        detail: `${data.populationInHighEj.toLocaleString()} people live near impaired waterbodies with EJ index above 80/100. Average statewide EJ index: ${data.avgEjIndex}/100. These communities face disproportionate water quality risk.`,
        metric: `${data.populationInHighEj.toLocaleString()}`,
        metricLabel: "People at Risk",
        dataSource: "EPA EJScreen / ATTAINS",
      },
    });
  }

  // ── 10. Trend ──
  if (data.impairmentTrend !== "insufficient_data") {
    const delta = data.impairmentRateCurrentCycle - data.impairmentRatePriorCycle;
    const direction = delta > 0 ? "increased" : delta < 0 ? "decreased" : "remained stable";
    findings.push({
      priority: Math.abs(delta) > 5 ? 80 : 55,
      finding: {
        id: "impairment-trend",
        category: "trend",
        severity: delta > 5 ? "critical" : delta > 0 ? "warning" : delta < -2 ? "positive" : "info",
        title: `Impairment rate ${direction} by ${Math.abs(delta).toFixed(1)} percentage points since ${data.priorCycleYear}`,
        detail: `Impairment rate moved from ${data.impairmentRatePriorCycle.toFixed(1)}% (${data.priorCycleYear} cycle) to ${data.impairmentRateCurrentCycle.toFixed(1)}% (${data.reportingCycle} cycle). ${delta > 2 ? "Worsening trend warrants escalated attention." : delta < -2 ? "Improving trend suggests current interventions may be working." : "Relatively stable — existing efforts are holding but not gaining ground."}`,
        metric: `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`,
        metricLabel: "Trend",
        dataSource: "EPA ATTAINS Historical Comparison",
      },
    });
  }

  // ── 11. PFAS (if monitored) ──
  if (data.pfasMonitoredSites > 0) {
    const detectionRate = parseFloat(pct(data.pfasDetections, data.pfasMonitoredSites));
    findings.push({
      priority: data.pfasDetections > 0 ? 78 : 50,
      finding: {
        id: "pfas",
        category: "emerging",
        severity: detectionRate > 50 ? "critical" : detectionRate > 20 ? "warning" : data.pfasDetections > 0 ? "info" : "positive",
        title: data.pfasDetections > 0
          ? `PFAS detected at ${data.pfasDetections.toLocaleString()} of ${data.pfasMonitoredSites.toLocaleString()} monitored sites (${detectionRate}%)`
          : `No PFAS detections at ${data.pfasMonitoredSites.toLocaleString()} monitored sites`,
        detail: data.pfasDetections > 0
          ? `PFAS compounds have been detected at ${detectionRate}% of monitored locations. Emerging contaminant monitoring remains limited; unmonitored sites may also be affected.`
          : `All ${data.pfasMonitoredSites.toLocaleString()} sites tested below detection limits. However, monitoring coverage may be incomplete.`,
        metric: `${data.pfasDetections.toLocaleString()}`,
        metricLabel: "PFAS Detections",
        dataSource: "EPA UCMR / State Programs",
      },
    });
  }

  // ── 12. MS4 Stormwater ──
  if (data.ms4Permits > 0) {
    findings.push({
      priority: 52,
      finding: {
        id: "ms4-coverage",
        category: "domain",
        severity: "info",
        title: `${data.ms4Permits.toLocaleString()} MS4 stormwater permits active`,
        detail: `${data.stateName} has ${data.ms4Permits.toLocaleString()} active MS4 stormwater permits. Stormwater runoff from permitted and unpermitted areas contributes to impairments in receiving waters.`,
        metric: `${data.ms4Permits.toLocaleString()}`,
        metricLabel: "MS4 Permits",
        dataSource: "EPA NPDES / State MS4 Programs",
      },
    });
  }

  // ── 13. Grant Eligibility ──
  if (data.estimatedGrantEligibility > 0) {
    findings.push({
      priority: 48,
      finding: {
        id: "grant-eligibility",
        category: "funding",
        severity: "positive",
        title: `Estimated $${(data.estimatedGrantEligibility / 1000000).toFixed(0)}M+ in grant eligibility identified`,
        detail: `${data.activeGrantPrograms} federal and state grant programs may apply to impairments in ${data.stateName}, including CWSRF, DWSRF, EPA 319(h), WIFIA, and state-specific programs.`,
        metric: `$${(data.estimatedGrantEligibility / 1000000).toFixed(0)}M+`,
        metricLabel: "Grant Eligibility",
        dataSource: "PIN Grant Matching Engine",
      },
    });
  }

  // ── 14. Insufficient Data ──
  if (data.category3 > 0) {
    const cat3Rate = parseFloat(pct(data.category3, data.assessedUnits));
    findings.push({
      priority: cat3Rate > 30 ? 72 : 45,
      finding: {
        id: "insufficient-data",
        category: "monitoring",
        severity: cat3Rate > 30 ? "warning" : "info",
        title: `${data.category3.toLocaleString()} waterbodies lack sufficient data for assessment`,
        detail: `Category 3 units (${cat3Rate}% of assessed) cannot be classified as impaired or attaining due to insufficient monitoring data. Expanding monitoring in these areas would improve assessment confidence.`,
        metric: `${cat3Rate}%`,
        metricLabel: "Insufficient Data",
        dataSource: "EPA ATTAINS Category 3",
      },
    });
  }

  // Sort by priority, take top 10
  return findings
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10)
    .map(f => f.finding);
}

// ── Report Card Summary ──

export interface ReportCard {
  stateName: string;
  stateCode: string;
  grade: Grade;
  score: number;
  severity: Severity;
  reportingCycle: string;
  lastUpdated: string;
  findings: Finding[];
  stats: {
    label: string;
    value: string;
    subtext?: string;
  }[];
}

export function generateReportCard(data: StateAssessmentData): ReportCard {
  const { grade, score } = calculateGrade(data);
  const sev = assessSeverity(data);
  const findings = generateFindings(data);
  const totalImpaired = data.category5 + data.category4a + data.category4b + data.category4c;
  const impairmentRate = data.assessedUnits > 0
    ? ((totalImpaired / data.assessedUnits) * 100).toFixed(1)
    : "0";

  return {
    stateName: data.stateName,
    stateCode: data.stateCode,
    grade,
    score,
    severity: sev,
    reportingCycle: data.reportingCycle,
    lastUpdated: data.lastUpdated,
    findings,
    stats: [
      { label: "Assessment Units", value: data.totalAssessmentUnits.toLocaleString(), subtext: `${data.assessedUnits.toLocaleString()} assessed` },
      { label: "Impairment Rate", value: `${impairmentRate}%`, subtext: `${totalImpaired.toLocaleString()} impaired` },
      { label: "Category 5", value: data.category5.toLocaleString(), subtext: "TMDL needed" },
      { label: "TMDL Coverage", value: data.tmdlsCompleted > 0 ? `${((data.tmdlsCompleted / (data.tmdlsCompleted + data.tmdlsNeeded)) * 100).toFixed(0)}%` : "0%", subtext: `${data.tmdlsCompleted.toLocaleString()} completed` },
      { label: "NPDES Violations", value: data.npdesViolatingFacilities.toLocaleString(), subtext: `of ${data.npdesPermits.toLocaleString()} permits` },
      { label: "DW Systems", value: data.drinkingWaterSystems.toLocaleString(), subtext: `${data.drinkingWaterViolations} violations` },
      { label: "Monitoring Stations", value: data.monitoringStations.toLocaleString(), subtext: `${data.stationsStale} stale` },
      { label: "EJ Burden", value: `${data.avgEjIndex}/100`, subtext: `${data.highEjUnits.toLocaleString()} high-risk units` },
    ],
  };
}
