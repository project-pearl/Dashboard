'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

export interface TopStateRow { state: string; count: number }
export interface DetailRow { label: string; value: string | number }

export interface DataSummaries {
  usgsOgc: { loaded: boolean; totalStations: number; siteTypes: number; agencies: number; states: number };
  ngwmn: { loaded: boolean; totalSites: number; providers: number; qualityResults: number; states: number };
  floodImpact: { loaded: boolean; zones: number; highRisk: number; infraAtRisk: number; states: number };
  epaPfas: { loaded: boolean; facilities: number; exceedances: number; nearMilitary: number; states: number };
  nwsForecast: { loaded: boolean; locations: number; highRisk: number; states: number };
  waterAvail: { loaded: boolean; huc8Indicators: number; droughtHucs: number; declining: number; states: number };
  cyberRisk: { loaded: boolean; assessed: number; highCritical: number; nearMilitary: number; states: number };
  gemstat: { loaded: boolean; countries: number; stations: number; latestYear: number | null };
  wqxModern: { loaded: boolean; records: number; states: number };
  stnFlood: { loaded: boolean; events: number; states: number };
  dmrViolations: { loaded: boolean; violations: number; facilities: number; states: number };
  habForecast: { loaded: boolean; forecasts: number; highRisk: number; waterbodies: number };
  cdcPlaces: { loaded: boolean; tracts: number; states: number };
  swdi: { loaded: boolean; events: number; severe: number; states: number };
  nexradQpe: { loaded: boolean; cells: number; maxPrecipMm: number; flashFloodHigh: number };
  congress: { loaded: boolean; bills: number; active: number; enacted: number };
}

export interface DataDetails {
  wqxModern?: TopStateRow[];
  stnFlood?: TopStateRow[];
  dmrViolations?: TopStateRow[];
  habForecast?: TopStateRow[];
  cdcPlaces?: TopStateRow[];
  swdi?: TopStateRow[];
  nexradQpe?: TopStateRow[];
  congress?: DetailRow[];
}

const EMPTY: DataSummaries = {
  usgsOgc: { loaded: false, totalStations: 0, siteTypes: 0, agencies: 0, states: 0 },
  ngwmn: { loaded: false, totalSites: 0, providers: 0, qualityResults: 0, states: 0 },
  floodImpact: { loaded: false, zones: 0, highRisk: 0, infraAtRisk: 0, states: 0 },
  epaPfas: { loaded: false, facilities: 0, exceedances: 0, nearMilitary: 0, states: 0 },
  nwsForecast: { loaded: false, locations: 0, highRisk: 0, states: 0 },
  waterAvail: { loaded: false, huc8Indicators: 0, droughtHucs: 0, declining: 0, states: 0 },
  cyberRisk: { loaded: false, assessed: 0, highCritical: 0, nearMilitary: 0, states: 0 },
  gemstat: { loaded: false, countries: 0, stations: 0, latestYear: null },
  wqxModern: { loaded: false, records: 0, states: 0 },
  stnFlood: { loaded: false, events: 0, states: 0 },
  dmrViolations: { loaded: false, violations: 0, facilities: 0, states: 0 },
  habForecast: { loaded: false, forecasts: 0, highRisk: 0, waterbodies: 0 },
  cdcPlaces: { loaded: false, tracts: 0, states: 0 },
  swdi: { loaded: false, events: 0, severe: 0, states: 0 },
  nexradQpe: { loaded: false, cells: 0, maxPrecipMm: 0, flashFloodHigh: 0 },
  congress: { loaded: false, bills: 0, active: 0, enacted: 0 },
};

export function useDataSummaries() {
  const [data, setData] = useState<DataSummaries>(EMPTY);
  const [details, setDetails] = useState<DataDetails>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detailsFetched = useRef(false);

  const fetchSummaries = useCallback(async () => {
    try {
      const res = await fetch('/api/data-summaries');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDetails = useCallback(async () => {
    if (detailsFetched.current) return;
    detailsFetched.current = true;
    try {
      const res = await fetch('/api/data-summaries?details=true');
      if (!res.ok) return;
      const json = await res.json();
      setDetails({
        wqxModern: json.wqxModern?.topStates,
        stnFlood: json.stnFlood?.topStates,
        dmrViolations: json.dmrViolations?.topStates,
        habForecast: json.habForecast?.topStates,
        cdcPlaces: json.cdcPlaces?.topStates,
        swdi: json.swdi?.topStates,
        nexradQpe: json.nexradQpe?.topStates,
        congress: json.congress?.detailRows,
      });
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  return useMemo(
    () => ({ data, details, isLoading, error, fetchDetails }),
    [data, details, isLoading, error, fetchDetails],
  );
}
