// lib/useWaterReporter.ts
// Optimized React hook for fetching real water quality data from Blue Water Baltimore
// Uses direct station mapping — 1 API call per region instead of 17+
'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Direct BWB Station Mapping ──────────────────────────────────────────────
// Maps PEARL region IDs to known Blue Water Baltimore station + dataset IDs
// This avoids the "nearest station" lookup and goes straight to parameters
interface BWBStation {
  datasetId: number;
  stationId: number;
  stationName: string;
  lastSampled: string;
}

const BWB_STATION_MAP: Record<string, BWBStation> = {
  // Baltimore Harbor & Patapsco
  maryland_middle_branch:   { datasetId: 860, stationId: 8756, stationName: 'Middle Branch A', lastSampled: '2025-11-13' },
  maryland_inner_harbor:    { datasetId: 860, stationId: 8789, stationName: 'Dragon Boats', lastSampled: '2025-11-13' },
  maryland_jones_falls:     { datasetId: 860, stationId: 8751, stationName: 'Jones Falls Outlet', lastSampled: '2025-11-13' },
  maryland_gwynns_falls:    { datasetId: 860, stationId: 8787, stationName: 'Lower Gwynns Falls G', lastSampled: '2026-01-14' },
  maryland_bear_creek:      { datasetId: 860, stationId: 8744, stationName: 'Bear Creek', lastSampled: '2025-10-07' },
  maryland_curtis_bay:      { datasetId: 860, stationId: 8745, stationName: 'Curtis Bay', lastSampled: '2025-10-07' },
  maryland_patapsco_river:  { datasetId: 860, stationId: 8747, stationName: 'Mainstem B', lastSampled: '2025-10-07' },
  maryland_stony_creek:     { datasetId: 860, stationId: 8741, stationName: 'Stoney Creek', lastSampled: '2025-10-07' },
  maryland_back_river:      { datasetId: 860, stationId: 32693, stationName: 'Back River Mainstem A', lastSampled: '2023-08-31' },
  // Additional Baltimore stations
  maryland_canton:          { datasetId: 860, stationId: 8754, stationName: 'Canton Park', lastSampled: '2025-11-13' },
  maryland_ferry_bar:       { datasetId: 860, stationId: 8758, stationName: 'Ferry Bar Park', lastSampled: '2025-11-13' },
  maryland_masonville:      { datasetId: 860, stationId: 8759, stationName: 'Masonville Channel', lastSampled: '2025-09-03' },
  maryland_ft_mchenry:      { datasetId: 860, stationId: 8755, stationName: 'Ft. McHenry Channel', lastSampled: '2025-09-03' },
  maryland_curtis_creek:    { datasetId: 860, stationId: 8760, stationName: 'Curtis Creek', lastSampled: '2025-10-07' },
  maryland_bodkin_creek:    { datasetId: 860, stationId: 8761, stationName: 'Bodkin Creek', lastSampled: '2025-08-27' },
  maryland_rock_creek:      { datasetId: 860, stationId: 8740, stationName: 'Rock Creek', lastSampled: '2025-10-07' },
};

// ─── WR normalized_name → PEARL dashboard parameter key ────────────────────
const WR_TO_PEARL_PARAM: Record<string, string> = {
  'dissolved_oxygen_mg_l':            'DO',
  'total_nitrogen_mg_l':              'TN',
  'total_phosphorus_mg_l':            'TP',
  'turbidity_ntu':                    'turbidity',
  'salinity_ppt':                     'salinity',
  'enterococcus_bacteria_mpn_100ml':  'bacteria',
  'temperature_c':                    'temperature',
  'ph_su':                            'pH',
  'secchi_depth_m':                   'secchiDepth',
  'lab_chlorophyll_ug_l':             'chlorophyll',
  'specific_conductance_us_cm':       'conductivity',
  'dissolved_oxygen_percent_saturation': 'DOsat',
  'total_water_depth_ft':             'waterDepth',
  'nitrate_nitrite_mg_l':             'nitrateNitrite',
  'total_kjeldahl_nitrogen_mg_l':     'TKN',
  'phycoerythrin_cells_ml':           'phycoerythrin',
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface WRParameterData {
  name: string;
  normalizedName: string;
  pearlKey: string | null;
  value: number | null;
  unit: string;
  min: number | null;
  max: number | null;
  mean: number | null;
  lastSampled: string | null;
  passThreshold?: { label: string; lower?: number; upper?: number } | null;
}

export interface WaterReporterData {
  stationName: string;
  stationId: number;
  datasetId: number;
  lastSampled: string;
  parameters: WRParameterData[];
  // Direct access by PEARL param key (DO, TN, TP, turbidity, salinity, TSS)
  byPearlKey: Record<string, WRParameterData>;
}

export interface UseWaterReporterResult {
  wrData: WaterReporterData | null;
  isLoading: boolean;
  error: string | null;
  hasStation: boolean;
  lastFetched: Date | null;
  refetch: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useWaterReporter(regionId: string | null): UseWaterReporterResult {
  const [wrData, setWrData] = useState<WaterReporterData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const station = regionId ? BWB_STATION_MAP[regionId] : null;
  const hasStation = !!station;

  const refetch = useCallback(() => setFetchTrigger(t => t + 1), []);

  useEffect(() => {
    if (!regionId || !station) {
      setWrData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Single API call: get all parameters with newest_value
    fetch(`/api/water-data?action=parameters&dataset_id=${station.datasetId}&station_id=${station.stationId}`)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        const features = data.features || [];
        
        const parameters: WRParameterData[] = features.map((p: any) => {
          const pearlKey = WR_TO_PEARL_PARAM[p.normalized_name] || null;
          const passRange = p.chart_schema?.ranges?.find((r: any) => r.label === 'Pass');
          return {
            name: p.name,
            normalizedName: p.normalized_name,
            pearlKey,
            value: p.newest_value ?? null,
            unit: p.unit || '',
            min: p.min ?? null,
            max: p.max ?? null,
            mean: p.mean ?? null,
            lastSampled: p.last_sampled ?? null,
            passThreshold: passRange ? {
              label: passRange.label,
              lower: passRange.lower_bound,
              upper: passRange.upper_bound,
            } : null,
          };
        });

        const byPearlKey: Record<string, WRParameterData> = {};
        for (const param of parameters) {
          if (param.pearlKey && param.value !== null) {
            byPearlKey[param.pearlKey] = param;
          }
        }

        setWrData({
          stationName: station.stationName,
          stationId: station.stationId,
          datasetId: station.datasetId,
          lastSampled: station.lastSampled,
          parameters,
          byPearlKey,
        });
        setLastFetched(new Date());
      })
      .catch(err => {
        if (cancelled) return;
        setError(err.message || 'Failed to fetch water quality data');
        setWrData(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [regionId, station, fetchTrigger]);

  return { wrData, isLoading, error, hasStation, lastFetched, refetch };
}

// ─── Helper: Check if a region has BWB data available ────────────────────────
export function hasBWBData(regionId: string): boolean {
  return regionId in BWB_STATION_MAP;
}

// ─── Helper: Get all mapped region IDs ───────────────────────────────────────
export function getBWBRegionIds(): string[] {
  return Object.keys(BWB_STATION_MAP);
}
