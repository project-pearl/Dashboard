// lib/statePortalAdapters.ts
// Adapter pattern for querying state open data portals
// Phase 4: 3 pilot states — Maryland (Socrata), Virginia (ArcGIS REST), California (CKAN)

interface StatePortalQuery {
  lat?: number;
  lng?: number;
  parameter?: string;
  startDate?: string;
}

interface StatePortalResult {
  parameter: string;
  value: string;
  unit: string;
  station_name: string;
  date: string;
  source_url?: string;
}

interface StatePortalResponse {
  data: StatePortalResult[];
  adapter: string;
  error?: string;
}

interface StatePortalAdapter {
  state: string;
  name: string;
  fetch(query: StatePortalQuery): Promise<StatePortalResponse>;
}

// ─── Maryland iMap (Socrata) ─────────────────────────────────────────────────
// https://data.imap.maryland.gov — Socrata Open Data API (SODA)
const marylandAdapter: StatePortalAdapter = {
  state: 'MD',
  name: 'Maryland iMap (Socrata)',
  async fetch(query) {
    const results: StatePortalResult[] = [];
    try {
      // Maryland water quality monitoring via Socrata
      // Dataset: Water Quality Data (MDE)
      let url = 'https://data.imap.maryland.gov/resource/7kyn-mdrw.json?$limit=20&$order=date_time DESC';

      if (query.lat && query.lng) {
        // Socrata geo query — within ~15km
        url += `&$where=within_circle(location, ${query.lat}, ${query.lng}, 15000)`;
      }

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });

      if (res.ok) {
        const data = await res.json();
        for (const row of (Array.isArray(data) ? data : [])) {
          const param = row.parameter || row.analyte || '';
          const val = row.value || row.result || row.measurement || '';
          if (param && val) {
            results.push({
              parameter: param,
              value: val,
              unit: row.units || row.unit || '',
              station_name: row.station || row.site_name || row.monitoring_station || 'MD Station',
              date: row.date_time || row.sample_date || '',
              source_url: 'https://data.imap.maryland.gov',
            });
          }
        }
      }
    } catch (e: any) {
      return { data: results, adapter: 'maryland-socrata', error: e.message };
    }
    return { data: results, adapter: 'maryland-socrata' };
  },
};

// ─── Virginia DEQ (ArcGIS REST) ──────────────────────────────────────────────
// https://gis.deq.virginia.gov/arcgis/rest/services/
const virginiaAdapter: StatePortalAdapter = {
  state: 'VA',
  name: 'Virginia DEQ (ArcGIS REST)',
  async fetch(query) {
    const results: StatePortalResult[] = [];
    try {
      // VA DEQ monitoring stations via ArcGIS REST
      let url = 'https://gis.deq.virginia.gov/arcgis/rest/services/public/DEQ_WATER_MONITORING/MapServer/0/query';
      const params = new URLSearchParams({
        f: 'json',
        outFields: '*',
        returnGeometry: 'false',
        resultRecordCount: '20',
        orderByFields: 'SAMPLE_DATE DESC',
      });

      if (query.lat && query.lng) {
        params.set('geometry', JSON.stringify({
          x: query.lng,
          y: query.lat,
          spatialReference: { wkid: 4326 },
        }));
        params.set('geometryType', 'esriGeometryPoint');
        params.set('spatialRel', 'esriSpatialRelIntersects');
        params.set('distance', '15000');
        params.set('units', 'esriSRUnit_Meter');
      } else {
        params.set('where', '1=1');
      }

      const res = await fetch(`${url}?${params.toString()}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });

      if (res.ok) {
        const data = await res.json();
        const features = data?.features || [];
        for (const feat of features) {
          const attr = feat.attributes || {};
          const param = attr.PARAMETER || attr.ANALYTE || '';
          const val = attr.VALUE || attr.RESULT || '';
          if (param && val) {
            results.push({
              parameter: param,
              value: String(val),
              unit: attr.UNITS || attr.UNIT || '',
              station_name: attr.STATION_NAME || attr.SITE_NAME || 'VA Station',
              date: attr.SAMPLE_DATE ? new Date(attr.SAMPLE_DATE).toISOString() : '',
              source_url: 'https://gis.deq.virginia.gov',
            });
          }
        }
      }
    } catch (e: any) {
      return { data: results, adapter: 'virginia-arcgis', error: e.message };
    }
    return { data: results, adapter: 'virginia-arcgis' };
  },
};

// ─── California Open Data (CKAN) ────────────────────────────────────────────
// https://data.ca.gov/api/3/ — CKAN API
const californiaAdapter: StatePortalAdapter = {
  state: 'CA',
  name: 'California Open Data (CKAN)',
  async fetch(query) {
    const results: StatePortalResult[] = [];
    try {
      // CA CEWQO portal — Surface Water Quality Results
      // Dataset resource_id for CA water quality data
      const url = new URL('https://data.ca.gov/api/3/action/datastore_search');
      url.searchParams.set('resource_id', '8d5331c8-e209-4c0b-874e-3e9c2c2b9f5d');
      url.searchParams.set('limit', '20');
      url.searchParams.set('sort', 'SampleDate desc');

      if (query.lat && query.lng) {
        // CKAN doesn't have native geo queries — filter by nearby coordinates
        const delta = 0.15;
        url.searchParams.set('filters', JSON.stringify({
          Latitude: { gte: query.lat - delta, lte: query.lat + delta },
          Longitude: { gte: query.lng - delta, lte: query.lng + delta },
        }));
      }

      const res = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });

      if (res.ok) {
        const data = await res.json();
        const records = data?.result?.records || [];
        for (const row of records) {
          const param = row.Analyte || row.Parameter || row.ConstituentName || '';
          const val = row.Result || row.Value || '';
          if (param && val) {
            results.push({
              parameter: param,
              value: String(val),
              unit: row.Unit || row.Units || '',
              station_name: row.StationName || row.SiteName || 'CA Station',
              date: row.SampleDate || '',
              source_url: 'https://data.ca.gov',
            });
          }
        }
      }
    } catch (e: any) {
      return { data: results, adapter: 'california-ckan', error: e.message };
    }
    return { data: results, adapter: 'california-ckan' };
  },
};

// ─── Adapter Registry ───────────────────────────────────────────────────────

const ADAPTERS: Record<string, StatePortalAdapter> = {
  MD: marylandAdapter,
  VA: virginiaAdapter,
  CA: californiaAdapter,
};

export function getAvailableStates(): string[] {
  return Object.keys(ADAPTERS);
}

export async function fetchStatePortalData(
  state: string,
  query: StatePortalQuery
): Promise<StatePortalResponse> {
  const adapter = ADAPTERS[state.toUpperCase()];
  if (!adapter) {
    return {
      data: [],
      adapter: 'none',
      error: `No adapter configured for state: ${state}. Available: ${Object.keys(ADAPTERS).join(', ')}`,
    };
  }
  return adapter.fetch(query);
}
