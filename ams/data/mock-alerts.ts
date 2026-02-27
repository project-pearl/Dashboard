// =============================================================================
// Mock Data for AMS Components
// Use this to test rendering before wiring to live Sentinel system.
// Delete once real data hooks are in place.
// =============================================================================

import type {
  AlertSummary,
  WatershedScore,
  ScoredSignal,
  SentinelHealth,
} from "../types/sentinel";

const now = new Date().toISOString();
const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60 * 1000).toISOString();
const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

// ---------------------------------------------------------------------------
// Potomac-style alert event
// ---------------------------------------------------------------------------

const potomacSignals: ScoredSignal[] = [
  {
    changeEvent: {
      eventId: "evt-001",
      source: "STATE_SSO_CSO",
      detectedAt: minutesAgo(45),
      sourceTimestamp: minutesAgo(60),
      changeType: "NEW_RECORD",
      geography: {
        huc8: "02070010",
        watershedName: "Middle Potomac-Anacostia-Occoquan",
        stateFips: "24",
      },
      severityHint: "CRITICAL",
      payload: {
        eventType: "SSO",
        estimatedVolumeGallons: 2400000,
        facility: "Blue Plains Advanced WWTP",
      },
      metadata: {
        pollCycleId: "pc-1234",
        detectionMethod: "NEW_ID",
        responseTimeMs: 340,
        httpStatus: 200,
      },
    },
    signalType: "SSO_CSO_EVENT",
    baseScore: 50,
    freshnessMultiplier: 0.98,
    effectiveScore: 49,
  },
  {
    changeEvent: {
      eventId: "evt-002",
      source: "NWS_ALERTS",
      detectedAt: minutesAgo(30),
      sourceTimestamp: minutesAgo(35),
      changeType: "NEW_RECORD",
      geography: {
        huc8: "02070010",
        watershedName: "Middle Potomac-Anacostia-Occoquan",
        stateFips: "24",
      },
      severityHint: "HIGH",
      payload: {
        alertType: "Flood Warning",
        headline:
          "Flood Warning issued for Potomac River at Little Falls",
        severity: "Severe",
        urgency: "Immediate",
      },
      metadata: {
        pollCycleId: "pc-1235",
        detectionMethod: "NEW_ID",
        responseTimeMs: 180,
        httpStatus: 200,
      },
    },
    signalType: "NWS_FLOOD_WARNING",
    baseScore: 40,
    freshnessMultiplier: 0.99,
    effectiveScore: 39.6,
  },
  {
    changeEvent: {
      eventId: "evt-003",
      source: "USGS_NWIS",
      detectedAt: minutesAgo(20),
      sourceTimestamp: minutesAgo(20),
      changeType: "THRESHOLD_CROSSED",
      geography: {
        huc8: "02070010",
        watershedName: "Middle Potomac-Anacostia-Occoquan",
        stateFips: "24",
      },
      severityHint: "HIGH",
      payload: {
        siteId: "01646500",
        siteName: "Potomac River at Little Falls",
        parameter: "Gage height",
        value: 12.4,
        floodStage: 10.0,
        unit: "ft",
      },
      metadata: {
        pollCycleId: "pc-1236",
        detectionMethod: "THRESHOLD",
        responseTimeMs: 220,
        httpStatus: 200,
      },
    },
    signalType: "USGS_FLOOD_STAGE",
    baseScore: 45,
    freshnessMultiplier: 0.99,
    effectiveScore: 44.6,
  },
  {
    changeEvent: {
      eventId: "evt-004",
      source: "NWS_QPE_RAINFALL",
      detectedAt: minutesAgo(15),
      sourceTimestamp: minutesAgo(15),
      changeType: "THRESHOLD_CROSSED",
      geography: {
        huc8: "02070010",
        watershedName: "Middle Potomac-Anacostia-Occoquan",
        stateFips: "24",
      },
      severityHint: "MEDIUM",
      payload: {
        accumulationInches: 3.2,
        durationHours: 6,
        thresholdInches: 2.0,
      },
      metadata: {
        pollCycleId: "pc-1237",
        detectionMethod: "THRESHOLD",
        responseTimeMs: 150,
        httpStatus: 200,
      },
    },
    signalType: "RAINFALL_THRESHOLD",
    baseScore: 30,
    freshnessMultiplier: 1.0,
    effectiveScore: 30,
  },
];

const potomacEvent: WatershedScore = {
  huc8: "02070010",
  watershedName: "Middle Potomac-Anacostia-Occoquan",
  compositeScore: 285,
  alertLevel: "ALERT",
  signals: potomacSignals,
  compoundMatches: [
    {
      pattern: "POTOMAC_PATTERN",
      label: "Sewage + Weather + Downstream Impact",
      matchedSignals: potomacSignals.slice(0, 3),
      multiplier: 2.5,
      compoundScore: 285,
    },
  ],
  firstSignalAt: minutesAgo(45),
  lastSignalAt: minutesAgo(15),
  signalCount: 4,
  affectedEntities: {
    shellfishBeds: ["Potomac River Oyster Sanctuary Zone A"],
    recreationalWaters: [
      "Great Falls Park",
      "Fletcher's Cove",
      "Georgetown Waterfront",
    ],
    drinkingWaterIntakes: ["Washington Aqueduct - Dalecarlia"],
    npdesPermits: ["MD0021199", "DC0000221"],
  },
};

// ---------------------------------------------------------------------------
// Advisory-level event
// ---------------------------------------------------------------------------

const advisorySignals: ScoredSignal[] = [
  {
    changeEvent: {
      eventId: "evt-010",
      source: "NPDES_DMR",
      detectedAt: hoursAgo(2),
      sourceTimestamp: hoursAgo(3),
      changeType: "NEW_RECORD",
      geography: {
        huc8: "02060006",
        watershedName: "Patuxent",
        stateFips: "24",
      },
      severityHint: "HIGH",
      payload: {
        facilityName: "Western Branch WWTP",
        permitId: "MD0022764",
        parameter: "E. coli",
        reportedValue: 850,
        permitLimit: 126,
        unit: "MPN/100mL",
      },
      metadata: {
        pollCycleId: "pc-1240",
        detectionMethod: "NEW_ID",
        responseTimeMs: 420,
        httpStatus: 200,
      },
    },
    signalType: "NPDES_EXCEEDANCE",
    baseScore: 35,
    freshnessMultiplier: 0.96,
    effectiveScore: 33.6,
  },
  {
    changeEvent: {
      eventId: "evt-011",
      source: "NWS_QPE_RAINFALL",
      detectedAt: hoursAgo(1),
      sourceTimestamp: hoursAgo(1),
      changeType: "THRESHOLD_CROSSED",
      geography: {
        huc8: "02060006",
        watershedName: "Patuxent",
        stateFips: "24",
      },
      severityHint: "MEDIUM",
      payload: {
        accumulationInches: 2.1,
        durationHours: 4,
        thresholdInches: 2.0,
      },
      metadata: {
        pollCycleId: "pc-1241",
        detectionMethod: "THRESHOLD",
        responseTimeMs: 130,
        httpStatus: 200,
      },
    },
    signalType: "RAINFALL_THRESHOLD",
    baseScore: 30,
    freshnessMultiplier: 0.98,
    effectiveScore: 29.4,
  },
];

const patuxentEvent: WatershedScore = {
  huc8: "02060006",
  watershedName: "Patuxent",
  compositeScore: 126,
  alertLevel: "ADVISORY",
  signals: advisorySignals,
  compoundMatches: [
    {
      pattern: "INFRASTRUCTURE_STRESS",
      label: "Permit Violation + Heavy Rain",
      matchedSignals: advisorySignals,
      multiplier: 2.0,
      compoundScore: 126,
    },
  ],
  firstSignalAt: hoursAgo(2),
  lastSignalAt: hoursAgo(1),
  signalCount: 2,
  affectedEntities: {
    shellfishBeds: [],
    recreationalWaters: ["Jug Bay Wetlands Sanctuary"],
    drinkingWaterIntakes: [],
    npdesPermits: ["MD0022764"],
  },
};

// ---------------------------------------------------------------------------
// Watch-level event
// ---------------------------------------------------------------------------

const watchEvent: WatershedScore = {
  huc8: "02060003",
  watershedName: "Gunpowder-Patapsco",
  compositeScore: 65,
  alertLevel: "WATCH",
  signals: [
    {
      changeEvent: {
        eventId: "evt-020",
        source: "NWS_ALERTS",
        detectedAt: hoursAgo(4),
        sourceTimestamp: hoursAgo(4),
        changeType: "NEW_RECORD",
        geography: {
          huc8: "02060003",
          watershedName: "Gunpowder-Patapsco",
          stateFips: "24",
        },
        severityHint: "MEDIUM",
        payload: {
          alertType: "Flood Watch",
          headline: "Flood Watch for Baltimore County",
        },
        metadata: {
          pollCycleId: "pc-1250",
          detectionMethod: "NEW_ID",
          responseTimeMs: 200,
          httpStatus: 200,
        },
      },
      signalType: "NWS_FLOOD_WATCH",
      baseScore: 25,
      freshnessMultiplier: 0.92,
      effectiveScore: 23,
    },
    {
      changeEvent: {
        eventId: "evt-021",
        source: "USGS_NWIS",
        detectedAt: hoursAgo(3),
        sourceTimestamp: hoursAgo(3),
        changeType: "THRESHOLD_CROSSED",
        geography: {
          huc8: "02060003",
          watershedName: "Gunpowder-Patapsco",
          stateFips: "24",
        },
        severityHint: "MEDIUM",
        payload: {
          siteId: "01585200",
          siteName: "Gunpowder Falls at Glencoe",
          parameter: "Gage height",
          value: 6.8,
          actionStage: 6.5,
          floodStage: 9.0,
          unit: "ft",
        },
        metadata: {
          pollCycleId: "pc-1251",
          detectionMethod: "THRESHOLD",
          responseTimeMs: 190,
          httpStatus: 200,
        },
      },
      signalType: "USGS_ACTION_STAGE",
      baseScore: 20,
      freshnessMultiplier: 0.94,
      effectiveScore: 18.8,
    },
  ],
  compoundMatches: [],
  firstSignalAt: hoursAgo(4),
  lastSignalAt: hoursAgo(3),
  signalCount: 2,
  affectedEntities: {
    shellfishBeds: [],
    recreationalWaters: ["Loch Raven Reservoir"],
    drinkingWaterIntakes: ["Loch Raven Intake"],
    npdesPermits: [],
  },
};

// ---------------------------------------------------------------------------
// Export assembled mock data
// ---------------------------------------------------------------------------

export const MOCK_ALERT_SUMMARY: AlertSummary = {
  total: 3,
  byLevel: {
    ALERT: 1,
    ADVISORY: 1,
    WATCH: 1,
    NORMAL: 0,
  },
  highestScoringEvent: potomacEvent,
  recentEvents: [potomacEvent, patuxentEvent, watchEvent],
};

export const MOCK_SENTINEL_HEALTH: SentinelHealth[] = [
  {
    source: "NWS_ALERTS",
    status: "HEALTHY",
    lastPollAt: minutesAgo(2),
    consecutiveFailures: 0,
    avgResponseTimeMs: 185,
  },
  {
    source: "USGS_NWIS",
    status: "HEALTHY",
    lastPollAt: minutesAgo(8),
    consecutiveFailures: 0,
    avgResponseTimeMs: 210,
  },
  {
    source: "STATE_SSO_CSO",
    status: "HEALTHY",
    lastPollAt: minutesAgo(12),
    consecutiveFailures: 0,
    avgResponseTimeMs: 380,
  },
  {
    source: "NPDES_DMR",
    status: "HEALTHY",
    lastPollAt: minutesAgo(18),
    consecutiveFailures: 0,
    avgResponseTimeMs: 420,
  },
  {
    source: "NWS_QPE_RAINFALL",
    status: "HEALTHY",
    lastPollAt: minutesAgo(5),
    consecutiveFailures: 0,
    avgResponseTimeMs: 150,
  },
  {
    source: "ATTAINS",
    status: "HEALTHY",
    lastPollAt: hoursAgo(6),
    consecutiveFailures: 0,
    avgResponseTimeMs: 1200,
  },
  {
    source: "STATE_DISCHARGE",
    status: "DEGRADED",
    lastPollAt: minutesAgo(45),
    consecutiveFailures: 4,
    avgResponseTimeMs: 680,
  },
  {
    source: "FEMA_DISASTER",
    status: "HEALTHY",
    lastPollAt: minutesAgo(35),
    consecutiveFailures: 0,
    avgResponseTimeMs: 290,
  },
  {
    source: "EPA_ECHO",
    status: "OFFLINE",
    lastPollAt: hoursAgo(3),
    consecutiveFailures: 12,
    avgResponseTimeMs: 0,
  },
];
