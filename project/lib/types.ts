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
