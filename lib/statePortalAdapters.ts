// lib/statePortalAdapters.ts
// Adapter pattern for querying state open data portals
// Phase 4: 3 pilot states — Maryland (MDE via WQP), Virginia (DEQ via WQP), California (CEDEN/CKAN)

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

// ─── Maryland — MDE water quality via WQP (state provider) ──────────────────
// Maryland iMap is ArcGIS Hub with no data API. Instead query WQP filtering
// to Maryland state providers (STORET/MDE) for state-specific data.
const marylandAdapter: StatePortalAdapter = {
  state: 'MD',
  name: 'Maryland MDE (via WQP)',
  async fetch(query) {
    const results: StatePortalResult[] = [];
    try {
      const eighteenMonthsAgo = new Date();
      eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
      const startDate = eighteenMonthsAgo.toISOString().split('T')[0];

      const url = new URL('https://www.waterqualitydata.us/wqx3/Result/search');
      url.searchParams.set('statecode', 'US:24'); // Maryland FIPS
      url.searchParams.set('providers', 'STORET'); // State/tribal data only (excludes USGS)
      url.searchParams.set('startDateLo', startDate);
      url.searchParams.set('dataProfile', 'narrow');
      url.searchParams.set('mimeType', 'csv');
      url.searchParams.set('sampleMedia', 'Water');

      if (query.lat && query.lng) {
        url.searchParams.set('lat', String(query.lat));
        url.searchParams.set('long', String(query.lng));
        url.searchParams.set('within', '15');
      }

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(20_000),
        redirect: 'follow',
      });

      if (res.ok) {
        const text = await res.text();
        const rows = csvToRows(text);
        for (const row of rows.slice(0, 20)) {
          const param = row.CharacteristicName || row['Characteristic Name'] || '';
          const val = row.ResultMeasureValue || row['ResultMeasure/MeasureValue'] || row['Result Value'] || '';
          if (param && val) {
            results.push({
              parameter: param,
              value: val,
              unit: row['ResultMeasure/MeasureUnitCode'] || row.ResultMeasure_MeasureUnitCode || '',
              station_name: row.MonitoringLocationName || row['Monitoring Location Name'] || 'MDE Station',
              date: row.ActivityStartDate || row['Activity Start Date'] || '',
              source_url: 'https://www.waterqualitydata.us',
            });
          }
        }
      }
    } catch (e: any) {
      return { data: results, adapter: 'maryland-wqp', error: e.message };
    }
    return { data: results, adapter: 'maryland-wqp' };
  },
};

// ─── Virginia — DEQ water quality via WQP (state provider) ──────────────────
// gis.deq.virginia.gov DNS fails. Use WQP filtering to Virginia STORET data.
const virginiaAdapter: StatePortalAdapter = {
  state: 'VA',
  name: 'Virginia DEQ (via WQP)',
  async fetch(query) {
    const results: StatePortalResult[] = [];
    try {
      const eighteenMonthsAgo = new Date();
      eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
      const startDate = eighteenMonthsAgo.toISOString().split('T')[0];

      const url = new URL('https://www.waterqualitydata.us/wqx3/Result/search');
      url.searchParams.set('statecode', 'US:51'); // Virginia FIPS
      url.searchParams.set('providers', 'STORET');
      url.searchParams.set('startDateLo', startDate);
      url.searchParams.set('dataProfile', 'narrow');
      url.searchParams.set('mimeType', 'csv');
      url.searchParams.set('sampleMedia', 'Water');

      if (query.lat && query.lng) {
        url.searchParams.set('lat', String(query.lat));
        url.searchParams.set('long', String(query.lng));
        url.searchParams.set('within', '15');
      }

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(20_000),
        redirect: 'follow',
      });

      if (res.ok) {
        const text = await res.text();
        const rows = csvToRows(text);
        for (const row of rows.slice(0, 20)) {
          const param = row.CharacteristicName || row['Characteristic Name'] || '';
          const val = row.ResultMeasureValue || row['ResultMeasure/MeasureValue'] || row['Result Value'] || '';
          if (param && val) {
            results.push({
              parameter: param,
              value: val,
              unit: row['ResultMeasure/MeasureUnitCode'] || row.ResultMeasure_MeasureUnitCode || '',
              station_name: row.MonitoringLocationName || row['Monitoring Location Name'] || 'VA DEQ Station',
              date: row.ActivityStartDate || row['Activity Start Date'] || '',
              source_url: 'https://www.waterqualitydata.us',
            });
          }
        }
      }
    } catch (e: any) {
      return { data: results, adapter: 'virginia-wqp', error: e.message };
    }
    return { data: results, adapter: 'virginia-wqp' };
  },
};

// ─── California — CEDEN/DWR water quality via data.ca.gov (CKAN) ────────────
// Original resource_id was invalid. Using DWR groundwater quality dataset
// (805e6762-1b82-48d9-b68f-5d79cca06ace) which is confirmed active with 297k+ records.
// For surface water, fall through to WQP.
const californiaAdapter: StatePortalAdapter = {
  state: 'CA',
  name: 'California DWR (CKAN)',
  async fetch(query) {
    const results: StatePortalResult[] = [];
    try {
      // Try CA CKAN first with the known working resource
      const url = new URL('https://data.ca.gov/api/3/action/datastore_search');
      url.searchParams.set('resource_id', '805e6762-1b82-48d9-b68f-5d79cca06ace');
      url.searchParams.set('limit', '20');

      // CKAN datastore_search supports SQL-like filtering
      if (query.lat && query.lng) {
        const delta = 0.25;
        // Use q for text search or filters for exact match — CKAN doesn't support range in filters
        // Instead use raw SQL via datastore_search_sql
        const sqlUrl = new URL('https://data.ca.gov/api/3/action/datastore_search_sql');
        const sql = `SELECT * FROM "805e6762-1b82-48d9-b68f-5d79cca06ace" WHERE "gm_latitude" BETWEEN ${query.lat - delta} AND ${query.lat + delta} AND "gm_longitude" BETWEEN ${query.lng - delta} AND ${query.lng + delta} LIMIT 20`;
        sqlUrl.searchParams.set('sql', sql);

        const res = await fetch(sqlUrl.toString(), {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15_000),
        });

        if (res.ok) {
          const data = await res.json();
          const records = data?.result?.records || [];
          for (const row of records) {
            const param = row.gm_chemical_name || row.gm_result_parameter || '';
            const val = row.gm_result || row.gm_result_modifier || '';
            if (param && val) {
              results.push({
                parameter: param,
                value: String(val),
                unit: row.gm_result_units || '',
                station_name: row.gm_well_id || row.gm_dataset_name || 'CA DWR Well',
                date: row.gm_samp_collection_date || '',
                source_url: 'https://data.ca.gov',
              });
            }
          }
          if (results.length > 0) {
            return { data: results, adapter: 'california-ckan' };
          }
        }
      }

      // Fallback: WQP for California surface water
      const eighteenMonthsAgo = new Date();
      eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
      const wqpUrl = new URL('https://www.waterqualitydata.us/wqx3/Result/search');
      wqpUrl.searchParams.set('statecode', 'US:06'); // California FIPS
      wqpUrl.searchParams.set('providers', 'STORET');
      wqpUrl.searchParams.set('startDateLo', eighteenMonthsAgo.toISOString().split('T')[0]);
      wqpUrl.searchParams.set('dataProfile', 'narrow');
      wqpUrl.searchParams.set('mimeType', 'csv');
      wqpUrl.searchParams.set('sampleMedia', 'Water');
      if (query.lat && query.lng) {
        wqpUrl.searchParams.set('lat', String(query.lat));
        wqpUrl.searchParams.set('long', String(query.lng));
        wqpUrl.searchParams.set('within', '15');
      }

      const wqpRes = await fetch(wqpUrl.toString(), {
        signal: AbortSignal.timeout(20_000),
        redirect: 'follow',
      });
      if (wqpRes.ok) {
        const text = await wqpRes.text();
        const rows = csvToRows(text);
        for (const row of rows.slice(0, 20)) {
          const param = row.CharacteristicName || row['Characteristic Name'] || '';
          const val = row.ResultMeasureValue || row['ResultMeasure/MeasureValue'] || row['Result Value'] || '';
          if (param && val) {
            results.push({
              parameter: param,
              value: val,
              unit: row['ResultMeasure/MeasureUnitCode'] || '',
              station_name: row.MonitoringLocationName || row['Monitoring Location Name'] || 'CA Station',
              date: row.ActivityStartDate || row['Activity Start Date'] || '',
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

// ─── CSV Parser (minimal) ───────────────────────────────────────────────────
function csvToRows(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length && i < 50; i++) {
    const values = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] || '';
    }
    rows.push(obj);
  }
  return rows;
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

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
