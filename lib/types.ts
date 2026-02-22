// =============================================================
// PEARL Intelligence Network (PIN) — Type Definitions
// =============================================================

// ----- Water Quality Parameters & Time Series -----

export type ParameterType = 'increasing-bad' | 'decreasing-bad' | 'range-based';

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

export interface WaterQualityParameter {
  name: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  type: ParameterType;
  thresholds: {
    green: { min?: number; max?: number };
    yellow: { min?: number; max?: number };
    orange?: { min?: number; max?: number };
    red: { min?: number; max?: number };
  };
  history?: TimeSeriesPoint[];
}

export interface WaterQualityData {
  location: string;
  timestamp: Date;
  parameters: {
    DO: WaterQualityParameter;
    turbidity: WaterQualityParameter;
    TN: WaterQualityParameter;
    TP: WaterQualityParameter;
    TSS: WaterQualityParameter;
    salinity: WaterQualityParameter;
  };
  timeSeries?: {
    DO: TimeSeriesPoint[];
    turbidity: TimeSeriesPoint[];
    TN: TimeSeriesPoint[];
    TP: TimeSeriesPoint[];
    TSS: TimeSeriesPoint[];
    salinity: TimeSeriesPoint[];
  };
}

export type TimeMode = 'real-time' | 'range';

export type DataMode = 'ambient' | 'influent-effluent' | 'removal-efficiency' | 'storm-event';

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface StormEvent {
  id: string;
  name: string;
  date: Date;
  duration: string;
  rainfall: string;
  influent: WaterQualityData;
  effluent: WaterQualityData;
  removalEfficiencies: {
    DO: number;
    turbidity: number;
    TN: number;
    TP: number;
    TSS: number;
    salinity: number;
  };
}

// ----- Watershed Boundary Alert System -----

/** ATTAINS assessment unit with upstream/downstream relationships */
export interface Waterbody {
  assessmentUnitId: string;       // EPA ATTAINS ID (e.g., "MD-02130101")
  name: string;                   // Display name (e.g., "Patapsco River Lower")
  state: string;                  // Two-letter state code
  huc12: string;                  // 12-digit HUC watershed code
  upstreamIds: string[];          // Assessment unit IDs that flow INTO this waterbody
  downstreamIds: string[];        // Assessment unit IDs this waterbody flows INTO
  currentImpairments: Impairment[];
}

export interface Impairment {
  parameter: string;              // e.g., "Total Nitrogen", "E. coli", "TSS"
  category: ImpairmentCategory;
  value: number | null;
  unit: string;
  threshold: number;
  lastUpdated: string;            // ISO date
}

export type ImpairmentCategory =
  | "nutrients"
  | "bacteria"
  | "sediment"
  | "metals"
  | "temperature"
  | "dissolved_oxygen"
  | "pfas"
  | "other";

/** MS4 permit with linked waterbodies */
export interface MS4Permit {
  permitId: string;               // e.g., "MDR040003"
  permitteeName: string;          // e.g., "Anne Arundel County"
  state: string;
  assignedWaterbodyIds: string[]; // ATTAINS assessment unit IDs under this permit
  contactEmail: string;
  contactName: string;
}

/** Boundary alert — generated when upstream/downstream waterbody crosses a threshold */
export interface BoundaryAlert {
  id: string;
  timestamp: string;              // ISO date of alert generation
  severity: AlertSeverity;
  type: AlertType;

  // The waterbody that triggered the alert
  sourceWaterbodyId: string;
  sourceWaterbodyName: string;

  // The impairment that crossed the threshold
  parameter: string;
  category: ImpairmentCategory;
  currentValue: number;
  threshold: number;
  unit: string;
  direction: "rising" | "falling";
  percentOverThreshold: number;

  // The neighboring MS4 responsible for the source waterbody
  neighborPermitId: string;
  neighborPermitteeName: string;
  neighborContactName: string;

  // The MS4 receiving this alert (the one potentially affected)
  recipientPermitId: string;
  relationship: "upstream" | "downstream";

  // Status tracking
  status: AlertStatus;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  notes: string[];
}

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertType =
  | "threshold_exceeded"          // Value crossed above limit
  | "trend_approaching"           // Value trending toward limit (early warning)
  | "new_impairment_listed"       // Waterbody newly added to 303(d) list
  | "tmdl_change";                // TMDL allocation changed

export type AlertStatus =
  | "new"
  | "acknowledged"
  | "in_contact"                  // MS4 has reached out to neighbor
  | "resolved"
  | "dismissed";

/** Configuration for threshold monitoring */
export interface AlertThresholdConfig {
  parameter: string;
  category: ImpairmentCategory;
  warningPercent: number;         // % of threshold to trigger "warning" (e.g., 80)
  criticalPercent: number;        // % of threshold to trigger "critical" (e.g., 100)
  trendWindowDays: number;        // Days to look back for trend analysis
  minimumDataPoints: number;      // Min observations needed to generate alert
}

/** Default threshold configs for common parameters */
export const DEFAULT_THRESHOLD_CONFIGS: AlertThresholdConfig[] = [
  {
    parameter: "Total Nitrogen",
    category: "nutrients",
    warningPercent: 80,
    criticalPercent: 100,
    trendWindowDays: 90,
    minimumDataPoints: 3,
  },
  {
    parameter: "Total Phosphorus",
    category: "nutrients",
    warningPercent: 80,
    criticalPercent: 100,
    trendWindowDays: 90,
    minimumDataPoints: 3,
  },
  {
    parameter: "E. coli",
    category: "bacteria",
    warningPercent: 75,
    criticalPercent: 100,
    trendWindowDays: 30,
    minimumDataPoints: 2,
  },
  {
    parameter: "Total Suspended Solids",
    category: "sediment",
    warningPercent: 80,
    criticalPercent: 100,
    trendWindowDays: 60,
    minimumDataPoints: 3,
  },
  {
    parameter: "Dissolved Oxygen",
    category: "dissolved_oxygen",
    warningPercent: 120,          // Inverted — alert when DO drops BELOW threshold
    criticalPercent: 100,
    trendWindowDays: 30,
    minimumDataPoints: 3,
  },
  {
    parameter: "PFAS (Total)",
    category: "pfas",
    warningPercent: 70,           // Lower warning threshold — emerging contaminant
    criticalPercent: 100,
    trendWindowDays: 180,
    minimumDataPoints: 2,
  },
];
