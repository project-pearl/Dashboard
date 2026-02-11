/*
 * PROJECT PEARL - WATER QUALITY MOCK DATA
 *
 * This file contains mock/simulated water quality data for demonstration and development.
 * In production, this data will be replaced by real-time sensor feeds and API integrations.
 *
 * =============================================================================
 * FUTURE PRODUCTION ARCHITECTURE - DATA FLOW
 * =============================================================================
 *
 * 1. PEARL SENSOR DATA (Real-time, High-frequency)
 *    -----------------------------------------------
 *    Source: Deployed Pearl IoT sensors at monitoring locations
 *    Protocol: WebSocket push to backend API
 *    Frequency: 15-minute intervals (normal), 1-minute intervals (storm events)
 *    Latency: < 30 seconds from sensor to dashboard
 *
 *    Flow:
 *    Pearl Sensor → LoRaWAN/Cellular Gateway → AWS IoT Core →
 *    Lambda Processing → TimescaleDB → WebSocket → Dashboard
 *
 *    Features:
 *    - Immediate alert triggers (DO < 4 mg/L, TSS spike >200%)
 *    - Sub-minute resolution during storm events
 *    - Automatic quality checks (sensor drift, outlier detection)
 *    - Battery and connectivity monitoring
 *    - Offline buffering with sync on reconnect
 *
 * 2. AMBIENT MONITORING DATA (Scheduled pulls from public APIs)
 *    -----------------------------------------------------------
 *    Sources:
 *    - USGS National Water Information System (NWIS)
 *    - Maryland Eyes on the Bay
 *    - EPA Water Quality Portal
 *    - State/local environmental agency APIs
 *
 *    Protocol: REST API scheduled pulls
 *    Frequency: 1-4 hours (to avoid rate limits and API throttling)
 *    Latency: 1-6 hours from measurement to dashboard
 *
 *    Flow:
 *    Public API → Scheduled Lambda (Cron) → Data normalization →
 *    TimescaleDB → Cache → Dashboard
 *
 *    Features:
 *    - Long-term trend analysis (multi-year comparisons)
 *    - Validation against external sources
 *    - Gap-filling when Pearl sensors offline
 *    - Regional baseline comparisons
 *    - Historical context for Pearl measurements
 *
 * 3. DATA STORAGE - TimescaleDB (PostgreSQL extension)
 *    --------------------------------------------------
 *    Tables:
 *    - water_quality_measurements (hypertable, partitioned by time)
 *      Columns: timestamp, location_id, source_type (pearl/ambient),
 *               DO, turbidity, TN, TP, TSS, salinity, qc_flags
 *
 *    - data_sources (metadata table)
 *      Columns: source_id, source_type, provider, update_frequency,
 *               last_update, status, api_endpoint
 *
 *    - alert_history (event log)
 *      Columns: alert_id, timestamp, location_id, alert_type,
 *               severity, parameters, user_dismissed
 *
 *    Retention policy:
 *    - 90 days: Full resolution (15-min Pearl, 1-hr ambient)
 *    - 2 years: Hourly aggregates
 *    - 10 years: Daily averages
 *
 * 4. ALERT SYSTEM
 *    -------------
 *    Pearl data → Real-time alert engine (in-memory stream processing)
 *    Ambient data → Batch alert checks (hourly)
 *
 *    Priority: Pearl alerts always override ambient alerts for same location
 *    Notification channels: Dashboard, email, SMS, webhook
 *
 * 5. FAILOVER & REDUNDANCY
 *    ----------------------
 *    - Pearl sensor offline → Automatic switch to ambient data
 *    - Ambient API rate limit → Cache last-known-good values
 *    - Database maintenance → Read-replica promotion
 *    - Display data age clearly: "Last Pearl update: 8 min ago"
 *
 * =============================================================================
 * CURRENT IMPLEMENTATION (MOCK DATA)
 * =============================================================================
 *
 * This file simulates both Pearl and ambient data sources with realistic:
 * - Parameter ranges for different water bodies (Escambia Bay, Middle Branch)
 * - Storm event detection with TSS/turbidity spikes
 * - BMP influent/effluent with removal efficiency calculations
 * - Time-series data with natural variability
 *
 * Mock data intentionally includes edge cases:
 * - Low DO events (< 5 mg/L) to trigger alerts
 * - High nutrient loading (TN > 1.0, TP > 0.3) to test thresholds
 * - Urban storm spikes (TSS 400-700 mg/L) typical of combined sewer areas
 * - Regional differences (Chesapeake Bay vs Gulf Coast)
 *
 * =============================================================================
 */

import { WaterQualityData, TimeSeriesPoint, WaterQualityParameter, StormEvent } from './types';
import { RegionParameterConfig } from './regionsConfig';

function generateTimeSeries(baseValue: number, variance: number, hours: number = 24): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  const now = new Date();

  for (let i = hours; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    const randomVariance = (Math.random() - 0.5) * variance;
    const trendFactor = Math.sin((i / hours) * Math.PI) * variance * 0.3;
    const value = Math.max(0, baseValue + randomVariance + trendFactor);
    points.push({ timestamp, value });
  }

  return points;
}

function generateTimeSeriesWithStormSpikes(
  baseValue: number,
  variance: number,
  hours: number = 24,
  stormEvents: { hoursBefore: number; spikeMultiplier: number; duration: number }[] = []
): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = [];
  const now = new Date();

  for (let i = hours; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    const randomVariance = (Math.random() - 0.5) * variance;
    const trendFactor = Math.sin((i / hours) * Math.PI) * variance * 0.3;
    let value = baseValue + randomVariance + trendFactor;

    for (const storm of stormEvents) {
      const stormStart = storm.hoursBefore;
      const stormEnd = storm.hoursBefore - storm.duration;

      if (i <= stormStart && i >= stormEnd) {
        const stormProgress = (stormStart - i) / storm.duration;
        const stormPeak = Math.sin(stormProgress * Math.PI);
        value = value + (baseValue * (storm.spikeMultiplier - 1) * stormPeak);
      }
    }

    points.push({ timestamp, value: Math.max(0, value) });
  }

  return points;
}

const stormEventTiming = [
  { hoursBefore: 4, spikeMultiplier: 10, duration: 4 },
  { hoursBefore: 16, spikeMultiplier: 6, duration: 3 }
];

export const escambiaBayMockData: WaterQualityData = {
  location: 'Escambia Bay',
  timestamp: new Date(),
  parameters: {
    DO: {
      name: 'Dissolved Oxygen',
      value: 6.82,
      unit: 'mg/L',
      min: 0,
      max: 14,
      type: 'range-based',
      thresholds: {
        green: { min: 6, max: 9 },
        yellow: { min: 4, max: 11 },
        red: { min: 0, max: 14 }
      }
    },
    turbidity: {
      name: 'Turbidity',
      value: 8.34,
      unit: 'NTU',
      min: 0,
      max: 500,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 5 },
        yellow: { min: 5, max: 25 },
        orange: { min: 25, max: 100 },
        red: { min: 100, max: 500 }
      }
    },
    TN: {
      name: 'Total Nitrogen',
      value: 0.45,
      unit: 'mg/L',
      min: 0,
      max: 25,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 1.5 },
        yellow: { min: 1.5, max: 6 },
        orange: { min: 6, max: 10 },
        red: { min: 10, max: 25 }
      }
    },
    TP: {
      name: 'Total Phosphorus',
      value: 0.20,
      unit: 'mg/L',
      min: 0,
      max: 2.0,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 0.05 },
        yellow: { min: 0.05, max: 0.15 },
        orange: { min: 0.15, max: 0.3 },
        red: { min: 0.3, max: 2.0 }
      }
    },
    TSS: {
      name: 'Total Suspended Solids',
      value: 42.98,
      unit: 'mg/L',
      min: 0,
      max: 500,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 10 },
        yellow: { min: 10, max: 30 },
        orange: { min: 30, max: 100 },
        red: { min: 100, max: 500 }
      }
    },
    salinity: {
      name: 'Salinity',
      value: 20.81,
      unit: 'ppt',
      min: 0,
      max: 40,
      type: 'range-based',
      thresholds: {
        green: { min: 5, max: 20 },
        yellow: { min: 0, max: 30 },
        red: { min: 30, max: 40 }
      }
    }
  },
  timeSeries: {
    DO: generateTimeSeries(6.82, 1.2),
    turbidity: generateTimeSeries(8.34, 3.5),
    TN: generateTimeSeries(0.45, 0.15),
    TP: generateTimeSeries(0.20, 0.08),
    TSS: generateTimeSeries(42.98, 12),
    salinity: generateTimeSeries(20.81, 3)
  }
};

export const middleBranchMockData: WaterQualityData = {
  location: 'Middle Branch, Patapsco River',
  timestamp: new Date(),
  parameters: {
    DO: {
      name: 'Dissolved Oxygen',
      value: 6.1,
      unit: 'mg/L',
      min: 0,
      max: 14,
      type: 'range-based',
      thresholds: {
        green: { min: 6, max: 9 },
        yellow: { min: 4, max: 11 },
        red: { min: 0, max: 14 }
      }
    },
    turbidity: {
      name: 'Turbidity',
      value: 28.4,
      unit: 'NTU',
      min: 0,
      max: 100,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 15 },
        yellow: { min: 15, max: 30 },
        red: { min: 30 }
      }
    },
    TN: {
      name: 'Total Nitrogen',
      value: 1.12,
      unit: 'mg/L',
      min: 0,
      max: 20,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 0.8 },
        yellow: { min: 0.8, max: 1.3 },
        red: { min: 1.3 }
      }
    },
    TP: {
      name: 'Total Phosphorus',
      value: 0.31,
      unit: 'mg/L',
      min: 0,
      max: 20,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 0.15 },
        yellow: { min: 0.15, max: 0.25 },
        red: { min: 0.25 }
      }
    },
    TSS: {
      name: 'Total Suspended Solids',
      value: 78,
      unit: 'mg/L',
      min: 0,
      max: 500,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 40 },
        yellow: { min: 40, max: 70 },
        red: { min: 70 }
      }
    },
    salinity: {
      name: 'Salinity',
      value: 12.8,
      unit: 'ppt',
      min: 0,
      max: 40,
      type: 'range-based',
      thresholds: {
        green: { min: 8, max: 18 },
        yellow: { min: 5, max: 22 },
        red: { min: 0, max: 5 }
      }
    }
  },
  timeSeries: {
    DO: generateTimeSeries(6.1, 1.4),
    turbidity: generateTimeSeries(28.4, 8.5),
    TN: generateTimeSeries(1.12, 0.25),
    TP: generateTimeSeries(0.31, 0.09),
    TSS: generateTimeSeries(78, 22),
    salinity: generateTimeSeries(12.8, 2.8)
  }
};

export function getParameterStatus(value: number, param: any): 'green' | 'yellow' | 'orange' | 'red' {
  if (param.type === 'increasing-bad') {
    if (param.thresholds.green.max !== undefined && value <= param.thresholds.green.max) {
      return 'green';
    }
    if (param.thresholds.yellow.max !== undefined && value <= param.thresholds.yellow.max) {
      return 'yellow';
    }
    if (param.thresholds.orange && param.thresholds.orange.max !== undefined && value <= param.thresholds.orange.max) {
      return 'orange';
    }
    return 'red';
  }

  if (param.type === 'decreasing-bad') {
    if (param.thresholds.green.min !== undefined && param.thresholds.green.max !== undefined &&
        value >= param.thresholds.green.min && value <= param.thresholds.green.max) {
      return 'green';
    }
    if (param.thresholds.yellow.min !== undefined && value >= param.thresholds.yellow.min) {
      return 'yellow';
    }
    return 'red';
  }

  if (param.type === 'range-based') {
    if (
      param.thresholds.green.min !== undefined &&
      param.thresholds.green.max !== undefined &&
      value >= param.thresholds.green.min &&
      value <= param.thresholds.green.max
    ) {
      return 'green';
    }

    if (
      param.thresholds.yellow.min !== undefined &&
      param.thresholds.yellow.max !== undefined &&
      value >= param.thresholds.yellow.min &&
      value <= param.thresholds.yellow.max
    ) {
      return 'yellow';
    }

    return 'red';
  }

  return 'yellow';
}

export function calculateParameterScore(
  value: number,
  param: any
): number {
  const status = getParameterStatus(value, param);

  if (status === 'green') return 100;
  if (status === 'yellow') return 60;
  return 30;
}

export function getRegionMockData(regionId: string): {
  ambient: WaterQualityData;
  influent: WaterQualityData;
  effluent: WaterQualityData;
  storms: StormEvent[];
} {
  switch (regionId) {
    case 'maryland_middle_branch':
      return {
        ambient: middleBranchMockData,
        influent: middleBranchInfluentMockData,
        effluent: middleBranchEffluentMockData,
        storms: stormEvents.filter(s => s.id.startsWith('mb-'))
      };
    case 'florida_escambia':
    default:
      return {
        ambient: escambiaBayMockData,
        influent: influentMockData,
        effluent: effluentMockData,
        storms: stormEvents.filter(s => !s.id.startsWith('mb-'))
      };
  }
}

export function calculateOverallScore(data: WaterQualityData): number {
  const doScore = calculateParameterScore(data.parameters.DO.value, data.parameters.DO);
  const otherScores = [
    calculateParameterScore(data.parameters.turbidity.value, data.parameters.turbidity),
    calculateParameterScore(data.parameters.TN.value, data.parameters.TN),
    calculateParameterScore(data.parameters.TP.value, data.parameters.TP),
    calculateParameterScore(data.parameters.TSS.value, data.parameters.TSS),
    calculateParameterScore(data.parameters.salinity.value, data.parameters.salinity),
  ];

  const totalWeight = 7;
  const weightedScore = (doScore * 2 + otherScores.reduce((a, b) => a + b, 0)) / totalWeight;

  return Math.round(weightedScore);
}

export function applyRegionThresholds(
  baseData: WaterQualityData,
  regionThresholds: RegionParameterConfig
): WaterQualityData {
  return {
    ...baseData,
    parameters: {
      DO: {
        ...baseData.parameters.DO,
        thresholds: regionThresholds.DO
      },
      turbidity: {
        ...baseData.parameters.turbidity,
        thresholds: regionThresholds.turbidity
      },
      TN: {
        ...baseData.parameters.TN,
        thresholds: regionThresholds.TN
      },
      TP: {
        ...baseData.parameters.TP,
        thresholds: regionThresholds.TP
      },
      TSS: {
        ...baseData.parameters.TSS,
        thresholds: regionThresholds.TSS
      },
      salinity: {
        ...baseData.parameters.salinity,
        thresholds: regionThresholds.salinity
      }
    }
  };
}

export const influentMockData: WaterQualityData = {
  location: 'Raw Influent',
  timestamp: new Date(),
  parameters: {
    DO: {
      name: 'Dissolved Oxygen',
      value: 1.2,
      unit: 'mg/L',
      min: 0,
      max: 10,
      type: 'decreasing-bad',
      thresholds: {
        green: { min: 2 },
        yellow: { min: 0.5, max: 2 },
        red: { max: 0.5 }
      },
      history: generateTimeSeriesWithStormSpikes(6.5, 1.5, 24, [
        { hoursBefore: 4, spikeMultiplier: 0.4, duration: 4 },
        { hoursBefore: 16, spikeMultiplier: 0.5, duration: 3 }
      ])
    },
    turbidity: {
      name: 'Turbidity',
      value: 120,
      unit: 'NTU',
      min: 0,
      max: 200,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 80 },
        yellow: { min: 80, max: 150 },
        red: { min: 150 }
      },
      history: generateTimeSeriesWithStormSpikes(35, 15, 24, [
        { hoursBefore: 4, spikeMultiplier: 7, duration: 4 },
        { hoursBefore: 16, spikeMultiplier: 4, duration: 3 }
      ])
    },
    TN: {
      name: 'Total Nitrogen',
      value: 45,
      unit: 'mg/L',
      min: 0,
      max: 80,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 30 },
        yellow: { min: 30, max: 50 },
        red: { min: 50 }
      },
      history: generateTimeSeriesWithStormSpikes(5, 2, 24, [
        { hoursBefore: 4, spikeMultiplier: 8, duration: 4 },
        { hoursBefore: 16, spikeMultiplier: 5, duration: 3 }
      ])
    },
    TP: {
      name: 'Total Phosphorus',
      value: 8.5,
      unit: 'mg/L',
      min: 0,
      max: 15,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 5 },
        yellow: { min: 5, max: 10 },
        red: { min: 10 }
      },
      history: generateTimeSeriesWithStormSpikes(1.2, 0.5, 24, [
        { hoursBefore: 4, spikeMultiplier: 7, duration: 4 },
        { hoursBefore: 16, spikeMultiplier: 4.5, duration: 3 }
      ])
    },
    TSS: {
      name: 'Total Suspended Solids',
      value: 280,
      unit: 'mg/L',
      min: 0,
      max: 500,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 150 },
        yellow: { min: 150, max: 300 },
        red: { min: 300 }
      },
      history: generateTimeSeriesWithStormSpikes(40, 15, 24, [
        { hoursBefore: 4, spikeMultiplier: 10, duration: 4 },
        { hoursBefore: 16, spikeMultiplier: 6, duration: 3 }
      ])
    },
    salinity: {
      name: 'Salinity',
      value: 12,
      unit: 'ppt',
      min: 0,
      max: 40,
      type: 'range-based',
      thresholds: {
        green: { min: 10, max: 20 },
        yellow: { min: 5, max: 25 },
        red: { min: 0, max: 5 }
      },
      history: generateTimeSeriesWithStormSpikes(14, 3, 24, [
        { hoursBefore: 4, spikeMultiplier: 0.6, duration: 4 },
        { hoursBefore: 16, spikeMultiplier: 0.7, duration: 3 }
      ])
    }
  },
  timeSeries: {
    DO: generateTimeSeries(1.2, 0.3),
    turbidity: generateTimeSeries(120, 15),
    TN: generateTimeSeries(45, 5),
    TP: generateTimeSeries(8.5, 1.2),
    TSS: generateTimeSeries(280, 30),
    salinity: generateTimeSeries(12, 2)
  }
};

export const effluentMockData: WaterQualityData = {
  location: 'Treated Effluent',
  timestamp: new Date(),
  parameters: {
    DO: {
      name: 'Dissolved Oxygen',
      value: 6.8,
      unit: 'mg/L',
      min: 0,
      max: 10,
      type: 'decreasing-bad',
      thresholds: {
        green: { min: 6 },
        yellow: { min: 5, max: 6 },
        red: { max: 5 }
      }
    },
    turbidity: {
      name: 'Turbidity',
      value: 8,
      unit: 'NTU',
      min: 0,
      max: 100,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 10 },
        yellow: { min: 10, max: 15 },
        red: { min: 15 }
      }
    },
    TN: {
      name: 'Total Nitrogen',
      value: 6.2,
      unit: 'mg/L',
      min: 0,
      max: 20,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 3 },
        yellow: { min: 3, max: 10 },
        red: { min: 10 }
      }
    },
    TP: {
      name: 'Total Phosphorus',
      value: 0.9,
      unit: 'mg/L',
      min: 0,
      max: 5,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 1 },
        yellow: { min: 1, max: 2 },
        red: { min: 2 }
      }
    },
    TSS: {
      name: 'Total Suspended Solids',
      value: 18,
      unit: 'mg/L',
      min: 0,
      max: 100,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 20 },
        yellow: { min: 20, max: 30 },
        red: { min: 30 }
      }
    },
    salinity: {
      name: 'Salinity',
      value: 18,
      unit: 'ppt',
      min: 0,
      max: 40,
      type: 'range-based',
      thresholds: {
        green: { min: 15, max: 25 },
        yellow: { min: 10, max: 30 },
        red: { min: 0, max: 10 }
      }
    }
  },
  timeSeries: {
    DO: generateTimeSeries(6.8, 0.5),
    turbidity: generateTimeSeries(8, 1.5),
    TN: generateTimeSeries(6.2, 0.8),
    TP: generateTimeSeries(0.9, 0.15),
    TSS: generateTimeSeries(18, 3),
    salinity: generateTimeSeries(18, 2)
  }
};

export const middleBranchInfluentMockData: WaterQualityData = {
  location: 'Middle Branch Raw Influent',
  timestamp: new Date(),
  parameters: {
    DO: {
      name: 'Dissolved Oxygen',
      value: 0.9,
      unit: 'mg/L',
      min: 0,
      max: 10,
      type: 'decreasing-bad',
      thresholds: {
        green: { min: 2 },
        yellow: { min: 0.5, max: 2 },
        red: { max: 0.5 }
      },
      history: generateTimeSeriesWithStormSpikes(5.8, 1.8, 24, [
        { hoursBefore: 3, spikeMultiplier: 0.3, duration: 5 },
        { hoursBefore: 14, spikeMultiplier: 0.45, duration: 4 }
      ])
    },
    turbidity: {
      name: 'Turbidity',
      value: 185,
      unit: 'NTU',
      min: 0,
      max: 500,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 80 },
        yellow: { min: 80, max: 150 },
        red: { min: 150 }
      },
      history: generateTimeSeriesWithStormSpikes(52, 22, 24, [
        { hoursBefore: 3, spikeMultiplier: 9, duration: 5 },
        { hoursBefore: 14, spikeMultiplier: 5.5, duration: 4 }
      ])
    },
    TN: {
      name: 'Total Nitrogen',
      value: 58,
      unit: 'mg/L',
      min: 0,
      max: 80,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 30 },
        yellow: { min: 30, max: 50 },
        red: { min: 50 }
      },
      history: generateTimeSeriesWithStormSpikes(7.2, 2.8, 24, [
        { hoursBefore: 3, spikeMultiplier: 10, duration: 5 },
        { hoursBefore: 14, spikeMultiplier: 6, duration: 4 }
      ])
    },
    TP: {
      name: 'Total Phosphorus',
      value: 11.2,
      unit: 'mg/L',
      min: 0,
      max: 15,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 5 },
        yellow: { min: 5, max: 10 },
        red: { min: 10 }
      },
      history: generateTimeSeriesWithStormSpikes(1.8, 0.7, 24, [
        { hoursBefore: 3, spikeMultiplier: 8.5, duration: 5 },
        { hoursBefore: 14, spikeMultiplier: 5, duration: 4 }
      ])
    },
    TSS: {
      name: 'Total Suspended Solids',
      value: 485,
      unit: 'mg/L',
      min: 0,
      max: 800,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 150 },
        yellow: { min: 150, max: 300 },
        red: { min: 300 }
      },
      history: generateTimeSeriesWithStormSpikes(68, 28, 24, [
        { hoursBefore: 3, spikeMultiplier: 12, duration: 5 },
        { hoursBefore: 14, spikeMultiplier: 7, duration: 4 }
      ])
    },
    salinity: {
      name: 'Salinity',
      value: 10.5,
      unit: 'ppt',
      min: 0,
      max: 40,
      type: 'range-based',
      thresholds: {
        green: { min: 8, max: 16 },
        yellow: { min: 5, max: 20 },
        red: { min: 0, max: 5 }
      },
      history: generateTimeSeriesWithStormSpikes(12, 2, 24, [
        { hoursBefore: 3, spikeMultiplier: 0.7, duration: 5 },
        { hoursBefore: 14, spikeMultiplier: 0.85, duration: 4 }
      ])
    }
  },
  timeSeries: {
    DO: generateTimeSeriesWithStormSpikes(5.8, 1.8, 24, [
      { hoursBefore: 3, spikeMultiplier: 0.3, duration: 5 },
      { hoursBefore: 14, spikeMultiplier: 0.45, duration: 4 }
    ]),
    turbidity: generateTimeSeriesWithStormSpikes(52, 22, 24, [
      { hoursBefore: 3, spikeMultiplier: 9, duration: 5 },
      { hoursBefore: 14, spikeMultiplier: 5.5, duration: 4 }
    ]),
    TN: generateTimeSeriesWithStormSpikes(7.2, 2.8, 24, [
      { hoursBefore: 3, spikeMultiplier: 10, duration: 5 },
      { hoursBefore: 14, spikeMultiplier: 6, duration: 4 }
    ]),
    TP: generateTimeSeriesWithStormSpikes(1.8, 0.7, 24, [
      { hoursBefore: 3, spikeMultiplier: 8.5, duration: 5 },
      { hoursBefore: 14, spikeMultiplier: 5, duration: 4 }
    ]),
    TSS: generateTimeSeriesWithStormSpikes(68, 28, 24, [
      { hoursBefore: 3, spikeMultiplier: 12, duration: 5 },
      { hoursBefore: 14, spikeMultiplier: 7, duration: 4 }
    ]),
    salinity: generateTimeSeriesWithStormSpikes(12, 2, 24, [
      { hoursBefore: 3, spikeMultiplier: 0.7, duration: 5 },
      { hoursBefore: 14, spikeMultiplier: 0.85, duration: 4 }
    ])
  }
};

export const middleBranchEffluentMockData: WaterQualityData = {
  location: 'Middle Branch BMP Outlet',
  timestamp: new Date(),
  parameters: {
    DO: {
      name: 'Dissolved Oxygen',
      value: 6.5,
      unit: 'mg/L',
      min: 0,
      max: 10,
      type: 'decreasing-bad',
      thresholds: {
        green: { min: 5 },
        yellow: { min: 4, max: 5 },
        red: { max: 4 }
      }
    },
    turbidity: {
      name: 'Turbidity',
      value: 19.2,
      unit: 'NTU',
      min: 0,
      max: 100,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 15 },
        yellow: { min: 15, max: 30 },
        red: { min: 30 }
      }
    },
    TN: {
      name: 'Total Nitrogen',
      value: 10.8,
      unit: 'mg/L',
      min: 0,
      max: 20,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 5 },
        yellow: { min: 5, max: 10 },
        red: { min: 10 }
      }
    },
    TP: {
      name: 'Total Phosphorus',
      value: 1.7,
      unit: 'mg/L',
      min: 0,
      max: 5,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 0.5 },
        yellow: { min: 0.5, max: 1.5 },
        red: { min: 1.5 }
      }
    },
    TSS: {
      name: 'Total Suspended Solids',
      value: 42,
      unit: 'mg/L',
      min: 0,
      max: 150,
      type: 'increasing-bad',
      thresholds: {
        green: { max: 30 },
        yellow: { min: 30, max: 60 },
        red: { min: 60 }
      }
    },
    salinity: {
      name: 'Salinity',
      value: 12.2,
      unit: 'ppt',
      min: 0,
      max: 40,
      type: 'range-based',
      thresholds: {
        green: { min: 8, max: 16 },
        yellow: { min: 6, max: 18 },
        red: { min: 0, max: 6 }
      }
    }
  },
  timeSeries: {
    DO: generateTimeSeries(6.5, 0.6),
    turbidity: generateTimeSeries(19.2, 3.8),
    TN: generateTimeSeries(10.8, 1.5),
    TP: generateTimeSeries(1.7, 0.25),
    TSS: generateTimeSeries(42, 8),
    salinity: generateTimeSeries(12.2, 1.8)
  }
};

export function calculateRemovalEfficiency(
  influentValue: number,
  effluentValue: number,
  parameterName: string
): number {
  if (parameterName === 'DO') {
    return ((effluentValue - influentValue) / influentValue) * 100;
  }

  if (influentValue === 0) return 0;
  return ((influentValue - effluentValue) / influentValue) * 100;
}

export function getRemovalStatus(efficiency: number): 'green' | 'yellow' | 'red' {
  if (efficiency >= 85) return 'green';
  if (efficiency >= 70) return 'yellow';
  return 'red';
}

export function getStormRemovalStatus(efficiency: number): 'green' | 'yellow' | 'red' {
  if (efficiency >= 80) return 'green';
  if (efficiency >= 60) return 'yellow';
  return 'red';
}

export const stormEvents: StormEvent[] = [
  {
    id: 'storm-1',
    name: 'Heavy Rainfall Event',
    date: new Date('2026-02-08T14:30:00'),
    duration: '3.5 hours',
    rainfall: '2.8 inches',
    influent: {
      location: 'BMP Inlet - Storm Runoff',
      timestamp: new Date('2026-02-08T14:30:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 2.8,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 3 },
            yellow: { min: 2, max: 3 },
            red: { max: 2 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 285,
          unit: 'NTU',
          min: 0,
          max: 500,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 100 },
            yellow: { min: 100, max: 250 },
            red: { min: 250 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 12.5,
          unit: 'mg/L',
          min: 0,
          max: 20,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 5 },
            yellow: { min: 5, max: 10 },
            red: { min: 10 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 3.2,
          unit: 'mg/L',
          min: 0,
          max: 8,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 2 },
            red: { min: 2 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 680,
          unit: 'mg/L',
          min: 0,
          max: 1000,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 200 },
            yellow: { min: 200, max: 500 },
            red: { min: 500 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 8.5,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 5, max: 15 },
            yellow: { min: 2, max: 20 },
            red: { min: 0, max: 2 }
          }
        }
      }
    },
    effluent: {
      location: 'BMP Outlet - Treated Discharge',
      timestamp: new Date('2026-02-08T18:00:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 6.2,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 5 },
            yellow: { min: 4, max: 5 },
            red: { max: 4 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 18,
          unit: 'NTU',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 20 },
            yellow: { min: 20, max: 30 },
            red: { min: 30 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 0.85,
          unit: 'mg/L',
          min: 0,
          max: 5,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 1.5 },
            red: { min: 1.5 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 0.16,
          unit: 'mg/L',
          min: 0,
          max: 1,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 0.2 },
            yellow: { min: 0.2, max: 0.3 },
            red: { min: 0.3 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 24,
          unit: 'mg/L',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 30 },
            yellow: { min: 30, max: 50 },
            red: { min: 50 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 14.2,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 10, max: 20 },
            yellow: { min: 5, max: 25 },
            red: { min: 0, max: 5 }
          }
        }
      }
    },
    removalEfficiencies: {
      DO: 121.4,
      turbidity: 93.7,
      TN: 93.2,
      TP: 95.0,
      TSS: 96.5,
      salinity: 67.1
    }
  },
  {
    id: 'storm-2',
    name: 'Moderate Storm Event',
    date: new Date('2026-02-05T09:15:00'),
    duration: '2.0 hours',
    rainfall: '1.2 inches',
    influent: {
      location: 'BMP Inlet - Storm Runoff',
      timestamp: new Date('2026-02-05T09:15:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 3.5,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 3 },
            yellow: { min: 2, max: 3 },
            red: { max: 2 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 165,
          unit: 'NTU',
          min: 0,
          max: 500,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 100 },
            yellow: { min: 100, max: 250 },
            red: { min: 250 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 8.2,
          unit: 'mg/L',
          min: 0,
          max: 20,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 5 },
            yellow: { min: 5, max: 10 },
            red: { min: 10 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 1.8,
          unit: 'mg/L',
          min: 0,
          max: 8,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 2 },
            red: { min: 2 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 420,
          unit: 'mg/L',
          min: 0,
          max: 1000,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 200 },
            yellow: { min: 200, max: 500 },
            red: { min: 500 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 6.8,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 5, max: 15 },
            yellow: { min: 2, max: 20 },
            red: { min: 0, max: 2 }
          }
        }
      }
    },
    effluent: {
      location: 'BMP Outlet - Treated Discharge',
      timestamp: new Date('2026-02-05T11:15:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 6.5,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 5 },
            yellow: { min: 4, max: 5 },
            red: { max: 4 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 12,
          unit: 'NTU',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 20 },
            yellow: { min: 20, max: 30 },
            red: { min: 30 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 0.72,
          unit: 'mg/L',
          min: 0,
          max: 5,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 1.5 },
            red: { min: 1.5 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 0.18,
          unit: 'mg/L',
          min: 0,
          max: 1,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 0.2 },
            yellow: { min: 0.2, max: 0.3 },
            red: { min: 0.3 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 22,
          unit: 'mg/L',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 30 },
            yellow: { min: 30, max: 50 },
            red: { min: 50 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 12.5,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 10, max: 20 },
            yellow: { min: 5, max: 25 },
            red: { min: 0, max: 5 }
          }
        }
      }
    },
    removalEfficiencies: {
      DO: 85.7,
      turbidity: 92.7,
      TN: 91.2,
      TP: 90.0,
      TSS: 94.8,
      salinity: 83.8
    }
  },
  {
    id: 'storm-3',
    name: 'Intense Flash Storm',
    date: new Date('2026-02-01T16:45:00'),
    duration: '1.5 hours',
    rainfall: '3.5 inches',
    influent: {
      location: 'BMP Inlet - Storm Runoff',
      timestamp: new Date('2026-02-01T16:45:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 2.1,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 3 },
            yellow: { min: 2, max: 3 },
            red: { max: 2 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 385,
          unit: 'NTU',
          min: 0,
          max: 500,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 100 },
            yellow: { min: 100, max: 250 },
            red: { min: 250 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 15.8,
          unit: 'mg/L',
          min: 0,
          max: 20,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 5 },
            yellow: { min: 5, max: 10 },
            red: { min: 10 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 4.5,
          unit: 'mg/L',
          min: 0,
          max: 8,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 2 },
            red: { min: 2 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 825,
          unit: 'mg/L',
          min: 0,
          max: 1000,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 200 },
            yellow: { min: 200, max: 500 },
            red: { min: 500 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 5.2,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 5, max: 15 },
            yellow: { min: 2, max: 20 },
            red: { min: 0, max: 2 }
          }
        }
      }
    },
    effluent: {
      location: 'BMP Outlet - Treated Discharge',
      timestamp: new Date('2026-02-01T18:15:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 5.8,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 5 },
            yellow: { min: 4, max: 5 },
            red: { max: 4 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 28,
          unit: 'NTU',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 20 },
            yellow: { min: 20, max: 30 },
            red: { min: 30 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 1.15,
          unit: 'mg/L',
          min: 0,
          max: 5,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 1.5 },
            red: { min: 1.5 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 0.28,
          unit: 'mg/L',
          min: 0,
          max: 1,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 0.2 },
            yellow: { min: 0.2, max: 0.3 },
            red: { min: 0.3 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 52,
          unit: 'mg/L',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 30 },
            yellow: { min: 30, max: 50 },
            red: { min: 50 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 11.8,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 10, max: 20 },
            yellow: { min: 5, max: 25 },
            red: { min: 0, max: 5 }
          }
        }
      }
    },
    removalEfficiencies: {
      DO: 176.2,
      turbidity: 92.7,
      TN: 92.7,
      TP: 93.8,
      TSS: 93.7,
      salinity: 126.9
    }
  },
  {
    id: 'storm-4',
    name: 'Light Rain Shower',
    date: new Date('2026-01-28T11:00:00'),
    duration: '1.0 hour',
    rainfall: '0.6 inches',
    influent: {
      location: 'BMP Inlet - Storm Runoff',
      timestamp: new Date('2026-01-28T11:00:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 4.2,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 3 },
            yellow: { min: 2, max: 3 },
            red: { max: 2 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 95,
          unit: 'NTU',
          min: 0,
          max: 500,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 100 },
            yellow: { min: 100, max: 250 },
            red: { min: 250 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 5.5,
          unit: 'mg/L',
          min: 0,
          max: 20,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 5 },
            yellow: { min: 5, max: 10 },
            red: { min: 10 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 1.1,
          unit: 'mg/L',
          min: 0,
          max: 8,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 2 },
            red: { min: 2 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 310,
          unit: 'mg/L',
          min: 0,
          max: 1000,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 200 },
            yellow: { min: 200, max: 500 },
            red: { min: 500 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 9.5,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 5, max: 15 },
            yellow: { min: 2, max: 20 },
            red: { min: 0, max: 2 }
          }
        }
      }
    },
    effluent: {
      location: 'BMP Outlet - Treated Discharge',
      timestamp: new Date('2026-01-28T12:00:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 6.8,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 5 },
            yellow: { min: 4, max: 5 },
            red: { max: 4 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 8,
          unit: 'NTU',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 20 },
            yellow: { min: 20, max: 30 },
            red: { min: 30 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 0.58,
          unit: 'mg/L',
          min: 0,
          max: 5,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 1.5 },
            red: { min: 1.5 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 0.12,
          unit: 'mg/L',
          min: 0,
          max: 1,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 0.2 },
            yellow: { min: 0.2, max: 0.3 },
            red: { min: 0.3 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 18,
          unit: 'mg/L',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 30 },
            yellow: { min: 30, max: 50 },
            red: { min: 50 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 15.2,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 10, max: 20 },
            yellow: { min: 5, max: 25 },
            red: { min: 0, max: 5 }
          }
        }
      }
    },
    removalEfficiencies: {
      DO: 61.9,
      turbidity: 91.6,
      TN: 89.5,
      TP: 89.1,
      TSS: 94.2,
      salinity: 60.0
    }
  },
  {
    id: 'storm-5',
    name: 'Prolonged Steady Rain',
    date: new Date('2026-01-24T07:30:00'),
    duration: '6.0 hours',
    rainfall: '1.9 inches',
    influent: {
      location: 'BMP Inlet - Storm Runoff',
      timestamp: new Date('2026-01-24T07:30:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 3.2,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 3 },
            yellow: { min: 2, max: 3 },
            red: { max: 2 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 215,
          unit: 'NTU',
          min: 0,
          max: 500,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 100 },
            yellow: { min: 100, max: 250 },
            red: { min: 250 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 9.8,
          unit: 'mg/L',
          min: 0,
          max: 20,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 5 },
            yellow: { min: 5, max: 10 },
            red: { min: 10 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 2.4,
          unit: 'mg/L',
          min: 0,
          max: 8,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 2 },
            red: { min: 2 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 550,
          unit: 'mg/L',
          min: 0,
          max: 1000,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 200 },
            yellow: { min: 200, max: 500 },
            red: { min: 500 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 7.2,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 5, max: 15 },
            yellow: { min: 2, max: 20 },
            red: { min: 0, max: 2 }
          }
        }
      }
    },
    effluent: {
      location: 'BMP Outlet - Treated Discharge',
      timestamp: new Date('2026-01-24T13:30:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 6.1,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 5 },
            yellow: { min: 4, max: 5 },
            red: { max: 4 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 14,
          unit: 'NTU',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 20 },
            yellow: { min: 20, max: 30 },
            red: { min: 30 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 0.92,
          unit: 'mg/L',
          min: 0,
          max: 5,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 1.5 },
            red: { min: 1.5 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 0.19,
          unit: 'mg/L',
          min: 0,
          max: 1,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 0.2 },
            yellow: { min: 0.2, max: 0.3 },
            red: { min: 0.3 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 26,
          unit: 'mg/L',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 30 },
            yellow: { min: 30, max: 50 },
            red: { min: 50 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 13.5,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 10, max: 20 },
            yellow: { min: 5, max: 25 },
            red: { min: 0, max: 5 }
          }
        }
      }
    },
    removalEfficiencies: {
      DO: 90.6,
      turbidity: 93.5,
      TN: 90.6,
      TP: 92.1,
      TSS: 95.3,
      salinity: 87.5
    }
  },
  {
    id: 'mb-storm-1',
    name: 'Baltimore Urban Storm - Feb 5',
    date: new Date('2026-02-05T16:15:00'),
    duration: '4.2 hours',
    rainfall: '3.1 inches',
    influent: {
      location: 'Middle Branch BMP Inlet - Storm Runoff',
      timestamp: new Date('2026-02-05T16:15:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 2.2,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 3 },
            yellow: { min: 2, max: 3 },
            red: { max: 2 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 420,
          unit: 'NTU',
          min: 0,
          max: 600,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 100 },
            yellow: { min: 100, max: 250 },
            red: { min: 250 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 18.7,
          unit: 'mg/L',
          min: 0,
          max: 30,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 5 },
            yellow: { min: 5, max: 10 },
            red: { min: 10 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 4.9,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 2 },
            red: { min: 2 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 680,
          unit: 'mg/L',
          min: 0,
          max: 1000,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 150 },
            yellow: { min: 150, max: 400 },
            red: { min: 400 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 8.2,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 8, max: 16 },
            yellow: { min: 5, max: 20 },
            red: { min: 0, max: 5 }
          }
        }
      }
    },
    effluent: {
      location: 'Middle Branch BMP Outlet - Post-Treatment',
      timestamp: new Date('2026-02-05T16:15:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 5.8,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 5 },
            yellow: { min: 4, max: 5 },
            red: { max: 4 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 32.5,
          unit: 'NTU',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 15 },
            yellow: { min: 15, max: 30 },
            red: { min: 30 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 3.2,
          unit: 'mg/L',
          min: 0,
          max: 20,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 0.8 },
            yellow: { min: 0.8, max: 1.3 },
            red: { min: 1.3 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 0.68,
          unit: 'mg/L',
          min: 0,
          max: 5,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 0.15 },
            yellow: { min: 0.15, max: 0.25 },
            red: { min: 0.25 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 48,
          unit: 'mg/L',
          min: 0,
          max: 150,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 40 },
            yellow: { min: 40, max: 70 },
            red: { min: 70 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 9.8,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 8, max: 16 },
            yellow: { min: 6, max: 18 },
            red: { min: 0, max: 6 }
          }
        }
      }
    },
    removalEfficiencies: {
      DO: 163.6,
      turbidity: 92.3,
      TN: 82.9,
      TP: 86.1,
      TSS: 92.9,
      salinity: 91.2
    }
  },
  {
    id: 'mb-storm-2',
    name: 'Moderate Storm - Feb 7',
    date: new Date('2026-02-07T09:45:00'),
    duration: '2.8 hours',
    rainfall: '1.9 inches',
    influent: {
      location: 'Middle Branch BMP Inlet - Storm Runoff',
      timestamp: new Date('2026-02-07T09:45:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 3.5,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 3 },
            yellow: { min: 2, max: 3 },
            red: { max: 2 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 290,
          unit: 'NTU',
          min: 0,
          max: 500,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 100 },
            yellow: { min: 100, max: 250 },
            red: { min: 250 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 14.2,
          unit: 'mg/L',
          min: 0,
          max: 20,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 5 },
            yellow: { min: 5, max: 10 },
            red: { min: 10 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 3.6,
          unit: 'mg/L',
          min: 0,
          max: 8,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 1 },
            yellow: { min: 1, max: 2 },
            red: { min: 2 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 520,
          unit: 'mg/L',
          min: 0,
          max: 800,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 150 },
            yellow: { min: 150, max: 400 },
            red: { min: 400 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 10.8,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 8, max: 16 },
            yellow: { min: 5, max: 20 },
            red: { min: 0, max: 5 }
          }
        }
      }
    },
    effluent: {
      location: 'Middle Branch BMP Outlet - Post-Treatment',
      timestamp: new Date('2026-02-07T09:45:00'),
      parameters: {
        DO: {
          name: 'Dissolved Oxygen',
          value: 6.2,
          unit: 'mg/L',
          min: 0,
          max: 10,
          type: 'decreasing-bad',
          thresholds: {
            green: { min: 5 },
            yellow: { min: 4, max: 5 },
            red: { max: 4 }
          }
        },
        turbidity: {
          name: 'Turbidity',
          value: 22.1,
          unit: 'NTU',
          min: 0,
          max: 100,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 15 },
            yellow: { min: 15, max: 30 },
            red: { min: 30 }
          }
        },
        TN: {
          name: 'Total Nitrogen',
          value: 2.1,
          unit: 'mg/L',
          min: 0,
          max: 20,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 0.8 },
            yellow: { min: 0.8, max: 1.3 },
            red: { min: 1.3 }
          }
        },
        TP: {
          name: 'Total Phosphorus',
          value: 0.48,
          unit: 'mg/L',
          min: 0,
          max: 5,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 0.15 },
            yellow: { min: 0.15, max: 0.25 },
            red: { min: 0.25 }
          }
        },
        TSS: {
          name: 'Total Suspended Solids',
          value: 34,
          unit: 'mg/L',
          min: 0,
          max: 150,
          type: 'increasing-bad',
          thresholds: {
            green: { max: 40 },
            yellow: { min: 40, max: 70 },
            red: { min: 70 }
          }
        },
        salinity: {
          name: 'Salinity',
          value: 11.5,
          unit: 'ppt',
          min: 0,
          max: 40,
          type: 'range-based',
          thresholds: {
            green: { min: 8, max: 16 },
            yellow: { min: 6, max: 18 },
            red: { min: 0, max: 6 }
          }
        }
      }
    },
    removalEfficiencies: {
      DO: 77.1,
      turbidity: 92.4,
      TN: 85.2,
      TP: 86.7,
      TSS: 93.5,
      salinity: 89.4
    }
  }
];
