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

// ----- Water Quality Portal (WQP) Observations -----

/** WQP monitoring station — written by Python pipeline to lib/wqp/ */
export interface WQPStation {
  id: string;                     // MonitoringLocationIdentifier (e.g., "USGS-01589440")
  name: string;                   // MonitoringLocationName
  type: string;                   // MonitoringLocationTypeName (e.g., "River/Stream", "Lake")
  lat: number;
  lon: number;
  huc8: string;                   // HUCEightDigitCode
  state: string;                  // Two-letter state code
  county: string;
  orgId: string;                  // OrganizationIdentifier (e.g., "USGS-MD")
  orgName: string;                // OrganizationFormalName
  resultCount: number;            // Total observations at this station
  lastSampleDate: string | null;  // ISO date of most recent sample
}

/** Single WQP observation — normalized from WQP Result records */
export interface WQPObservation {
  stationId: string;              // MonitoringLocationIdentifier
  date: string;                   // ActivityStartDate (ISO)
  parameter: string;              // CharacteristicName (e.g., "Dissolved oxygen (DO)")
  value: number | null;
  unit: string | null;            // ResultMeasure/MeasureUnitCode
  status: string;                 // ResultStatusIdentifier (e.g., "Final", "Preliminary")
  detection: string | null;       // DetectionQuantitationLimitTypeName (for non-detects)
  detectionLimit: number | null;  // Detection limit value
}

/** WQP parameter mapping — maps WQP CharacteristicName to PIN parameter keys */
export interface WQPParameterMap {
  wqpName: string;                // WQP CharacteristicName (exact match)
  pinKey: keyof WaterQualityData["parameters"] | string;
  category: ImpairmentCategory;
  preferredUnit: string;
}

/** Standard WQP → PIN parameter mappings */
export const WQP_PARAMETER_MAP: WQPParameterMap[] = [
  { wqpName: "Dissolved oxygen (DO)", pinKey: "DO", category: "dissolved_oxygen", preferredUnit: "mg/l" },
  { wqpName: "Turbidity", pinKey: "turbidity", category: "sediment", preferredUnit: "NTU" },
  { wqpName: "Total Nitrogen, mixed forms", pinKey: "TN", category: "nutrients", preferredUnit: "mg/l" },
  { wqpName: "Phosphorus", pinKey: "TP", category: "nutrients", preferredUnit: "mg/l" },
  { wqpName: "Total suspended solids", pinKey: "TSS", category: "sediment", preferredUnit: "mg/l" },
  { wqpName: "Salinity", pinKey: "salinity", category: "other", preferredUnit: "ppt" },
  { wqpName: "pH", pinKey: "pH", category: "other", preferredUnit: "std units" },
  { wqpName: "Temperature, water", pinKey: "temp", category: "temperature", preferredUnit: "deg C" },
  { wqpName: "Specific conductance", pinKey: "conductivity", category: "other", preferredUnit: "uS/cm" },
  { wqpName: "Escherichia coli", pinKey: "ecoli", category: "bacteria", preferredUnit: "MPN/100ml" },
  { wqpName: "Enterococcus", pinKey: "enterococcus", category: "bacteria", preferredUnit: "MPN/100ml" },
  { wqpName: "Chlorophyll a", pinKey: "chlA", category: "nutrients", preferredUnit: "ug/l" },
];

/** State-level WQP summary — pre-computed by Python pipeline for state cards */
export interface WQPStateSummary {
  stateCode: string;              // Two-letter
  stateName: string;
  stationCount: number;
  observationCount: number;
  organizations: string[];        // Contributing org IDs
  parameterCoverage: Record<string, number>;  // parameter → observation count
  dateRange: {
    earliest: string;             // ISO date
    latest: string;
  };
  topStations: WQPStation[];      // Top 10 by result count
  generatedAt: string;            // ISO — when Python pipeline wrote this
}

/** Waterbody-level WQP summary — keyed by ATTAINS assessment unit ID */
export interface WQPWaterbodySummary {
  assessmentUnitId: string;       // Links to Waterbody.assessmentUnitId
  huc8: string;
  stations: WQPStation[];
  observationCount: number;
  parameterCoverage: Record<string, number>;
  recentObservations: WQPObservation[];  // Last 100, sorted by date desc
  exceedances: WQPExceedance[];
  dateRange: {
    earliest: string;
    latest: string;
  };
  generatedAt: string;
}

/** Exceedance record — when an observation exceeds a threshold */
export interface WQPExceedance {
  stationId: string;
  date: string;
  parameter: string;
  category: ImpairmentCategory;
  value: number;
  unit: string;
  threshold: number;
  percentOver: number;            // How far above threshold (e.g., 1.23 = 23% over)
}

// ----- Data Pipeline / Source Registry -----

/** Status of a data source in the health registry */
export type SourceStatus = "live" | "registered" | "building" | "stale" | "error" | "unknown";

/** Data source registration (mirrors registry.json structure) */
export interface DataSource {
  id: string;
  name: string;
  agency: string;
  segment: "federal" | "noaa" | "state_priority" | "state" | "local";
  priority: number;               // 1 = highest
  status: SourceStatus;
  baseUrl: string;
  format: "json" | "csv" | "xml" | "text";
  stateScope: string;             // "national" or state code(s)
  estRecords: number | null;
  recordsCount: number | null;
  lastFetch: string | null;       // ISO date
  lastHealthCheck: string | null;
  stalenessDays: number | null;
  errorCount: number;
}

/** Pipeline fetch result — returned by Python fetch scripts */
export interface PipelineFetchResult {
  sourceId: string;
  fetchedAt: string;              // ISO date
  recordsFetched: number;
  recordsNew: number;             // New since last fetch
  recordsUpdated: number;
  errors: string[];
  durationMs: number;
  nextFetchAt: string | null;     // Scheduled next run
}

// ----- EPA Region Scoping (Federal Management Center) -----

export interface EPARegion {
  id: number;                     // 1–10
  name: string;                   // "Region 3"
  hq: string;                     // "Philadelphia"
  states: string[];               // ["DE", "DC", "MD", "PA", "VA", "WV"]
}

export const EPA_REGIONS: EPARegion[] = [
  { id: 1,  name: "Region 1",  hq: "Boston",        states: ["CT", "ME", "MA", "NH", "RI", "VT"] },
  { id: 2,  name: "Region 2",  hq: "New York",      states: ["NJ", "NY", "PR", "VI"] },
  { id: 3,  name: "Region 3",  hq: "Philadelphia",  states: ["DE", "DC", "MD", "PA", "VA", "WV"] },
  { id: 4,  name: "Region 4",  hq: "Atlanta",       states: ["AL", "FL", "GA", "KY", "MS", "NC", "SC", "TN"] },
  { id: 5,  name: "Region 5",  hq: "Chicago",       states: ["IL", "IN", "MI", "MN", "OH", "WI"] },
  { id: 6,  name: "Region 6",  hq: "Dallas",        states: ["AR", "LA", "NM", "OK", "TX"] },
  { id: 7,  name: "Region 7",  hq: "Kansas City",   states: ["IA", "KS", "MO", "NE"] },
  { id: 8,  name: "Region 8",  hq: "Denver",        states: ["CO", "MT", "ND", "SD", "UT", "WY"] },
  { id: 9,  name: "Region 9",  hq: "San Francisco", states: ["AZ", "CA", "HI", "NV", "AS", "GU", "MP"] },
  { id: 10, name: "Region 10", hq: "Seattle",        states: ["AK", "ID", "OR", "WA"] },
];
