// =============================================================
// Example: Maryland MS4 Watershed Boundary Alerts
// PEARL Intelligence Network (PIN)
//
// Demonstrates how boundary alerts work with real
// Chesapeake Bay watershed MS4 relationships.
// =============================================================

import {
  Waterbody,
  MS4Permit,
  BoundaryAlert,
} from "./types";
import {
  buildWaterbodyPermitMap,
  findBoundaryWaterbodies,
  generateBoundaryAlerts,
  formatAlertMessage,
  formatAlertSummary,
} from "./boundary-alerts";

// ----- Example Waterbodies (simplified Patapsco/Back River area) -----

const exampleWaterbodies: Waterbody[] = [
  {
    assessmentUnitId: "MD-02130806",
    name: "Patapsco River Lower North Branch",
    state: "MD",
    huc12: "021301080604",
    upstreamIds: ["MD-02130805"],             // Upper Patapsco
    downstreamIds: ["MD-02130807"],            // Patapsco tidal
    currentImpairments: [
      {
        parameter: "Total Nitrogen",
        category: "nutrients",
        value: 4.2,                            // mg/L — over threshold
        unit: "mg/L",
        threshold: 3.0,
        lastUpdated: "2026-02-15",
      },
      {
        parameter: "Total Suspended Solids",
        category: "sediment",
        value: 28,
        unit: "mg/L",
        threshold: 25,
        lastUpdated: "2026-02-15",
      },
    ],
  },
  {
    assessmentUnitId: "MD-02130805",
    name: "Patapsco River Upper North Branch",
    state: "MD",
    huc12: "021301080503",
    upstreamIds: [],
    downstreamIds: ["MD-02130806"],
    currentImpairments: [
      {
        parameter: "E. coli",
        category: "bacteria",
        value: 285,                            // CFU/100mL — over threshold
        unit: "CFU/100mL",
        threshold: 235,
        lastUpdated: "2026-02-10",
      },
    ],
  },
  {
    assessmentUnitId: "MD-02130807",
    name: "Patapsco River Tidal",
    state: "MD",
    huc12: "021301080701",
    upstreamIds: ["MD-02130806"],
    downstreamIds: [],
    currentImpairments: [
      {
        parameter: "Dissolved Oxygen",
        category: "dissolved_oxygen",
        value: 4.1,                            // mg/L — below threshold (bad)
        unit: "mg/L",
        threshold: 5.0,
        lastUpdated: "2026-02-18",
      },
    ],
  },
  {
    assessmentUnitId: "MD-02130401",
    name: "Back River",
    state: "MD",
    huc12: "021301040102",
    upstreamIds: [],
    downstreamIds: ["MD-02130402"],
    currentImpairments: [
      {
        parameter: "Total Phosphorus",
        category: "nutrients",
        value: 0.15,
        unit: "mg/L",
        threshold: 0.1,
        lastUpdated: "2026-02-12",
      },
    ],
  },
  {
    assessmentUnitId: "MD-02130402",
    name: "Back River Tidal",
    state: "MD",
    huc12: "021301040201",
    upstreamIds: ["MD-02130401"],
    downstreamIds: [],
    currentImpairments: [],
  },
];

// ----- Example MS4 Permits -----

const examplePermits: MS4Permit[] = [
  {
    permitId: "MDR040003",
    permitteeName: "Baltimore County",
    state: "MD",
    assignedWaterbodyIds: ["MD-02130806", "MD-02130401"],
    contactEmail: "stormwater@baltimorecountymd.gov",
    contactName: "J. Martinez, Stormwater Program Manager",
  },
  {
    permitId: "MDR040006",
    permitteeName: "Howard County",
    state: "MD",
    assignedWaterbodyIds: ["MD-02130805"],
    contactEmail: "swm@howardcountymd.gov",
    contactName: "R. Chen, Water Resources Division",
  },
  {
    permitId: "MDR040001",
    permitteeName: "Anne Arundel County",
    state: "MD",
    assignedWaterbodyIds: ["MD-02130807", "MD-02130402"],
    contactEmail: "watershed@aacounty.org",
    contactName: "T. Williams, Watershed Protection",
  },
];

// ----- Run the Example -----

export function runExample() {
  // Build the waterbody lookup
  const waterbodyMap = new Map(
    exampleWaterbodies.map((wb) => [wb.assessmentUnitId, wb])
  );

  // Build the permit-to-waterbody map
  const permitMap = buildWaterbodyPermitMap(examplePermits);

  console.log("=== PEARL Intelligence Network — Boundary Alert Demo ===\n");

  // Generate alerts for each MS4
  for (const permit of examplePermits) {
    console.log(`\n--- Alerts for: ${permit.permitteeName} (${permit.permitId}) ---\n`);

    // Show boundary waterbodies
    const boundaries = findBoundaryWaterbodies(permit, waterbodyMap);
    console.log(
      `  Upstream boundaries: ${boundaries.upstream.map((w) => w.name).join(", ") || "None"}`
    );
    console.log(
      `  Downstream boundaries: ${boundaries.downstream.map((w) => w.name).join(", ") || "None"}`
    );

    // Generate alerts
    const alerts = generateBoundaryAlerts(
      permit,
      waterbodyMap,
      permitMap
    );

    if (alerts.length === 0) {
      console.log("\n  ✅ No boundary alerts — all neighboring waterbodies within thresholds.\n");
      continue;
    }

    console.log(`\n  ${alerts.length} alert(s) generated:\n`);

    for (const alert of alerts) {
      console.log("  " + formatAlertSummary(alert));
      console.log("");
      console.log(
        formatAlertMessage(alert)
          .split("\n")
          .map((line) => "    " + line)
          .join("\n")
      );
      console.log("\n  ---\n");
    }
  }
}

// ----- Example Alert Data (for UI component testing) -----

export const EXAMPLE_ALERTS: BoundaryAlert[] = [
  {
    id: "BA-001",
    timestamp: "2026-02-18T14:30:00Z",
    severity: "critical",
    type: "threshold_exceeded",
    sourceWaterbodyId: "MD-02130805",
    sourceWaterbodyName: "Patapsco River Upper North Branch",
    parameter: "E. coli",
    category: "bacteria",
    currentValue: 285,
    threshold: 235,
    unit: "CFU/100mL",
    direction: "rising",
    percentOverThreshold: 21.3,
    neighborPermitId: "MDR040006",
    neighborPermitteeName: "Howard County",
    neighborContactName: "R. Chen, Water Resources Division",
    recipientPermitId: "MDR040003",
    relationship: "upstream",
    status: "new",
    acknowledgedAt: null,
    resolvedAt: null,
    notes: [],
  },
  {
    id: "BA-002",
    timestamp: "2026-02-18T14:30:00Z",
    severity: "warning",
    type: "threshold_exceeded",
    sourceWaterbodyId: "MD-02130807",
    sourceWaterbodyName: "Patapsco River Tidal",
    parameter: "Dissolved Oxygen",
    category: "dissolved_oxygen",
    currentValue: 4.1,
    threshold: 5.0,
    unit: "mg/L",
    direction: "falling",
    percentOverThreshold: 18.0,
    neighborPermitId: "MDR040001",
    neighborPermitteeName: "Anne Arundel County",
    neighborContactName: "T. Williams, Watershed Protection",
    recipientPermitId: "MDR040003",
    relationship: "downstream",
    status: "acknowledged",
    acknowledgedAt: "2026-02-18T16:00:00Z",
    resolvedAt: null,
    notes: ["Reached out to T. Williams via email 2/18"],
  },
  {
    id: "BA-003",
    timestamp: "2026-02-15T09:00:00Z",
    severity: "warning",
    type: "threshold_exceeded",
    sourceWaterbodyId: "MD-02130806",
    sourceWaterbodyName: "Patapsco River Lower North Branch",
    parameter: "Total Nitrogen",
    category: "nutrients",
    currentValue: 4.2,
    threshold: 3.0,
    unit: "mg/L",
    direction: "rising",
    percentOverThreshold: 40.0,
    neighborPermitId: "MDR040003",
    neighborPermitteeName: "Baltimore County",
    neighborContactName: "J. Martinez, Stormwater Program Manager",
    recipientPermitId: "MDR040001",
    relationship: "upstream",
    status: "in_contact",
    acknowledgedAt: "2026-02-15T10:30:00Z",
    resolvedAt: null,
    notes: [
      "Called J. Martinez — aware of issue, related to construction runoff",
      "Baltimore Co installing additional ESC measures by 2/28",
    ],
  },
];
