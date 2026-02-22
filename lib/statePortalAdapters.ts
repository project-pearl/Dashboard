// lib/statePortalAdapters.ts
// State-specific data adapters. Only California has a unique adapter (CEDEN/CKAN).
// All other states use WQP directly via the wqp-results action — no redundant re-query needed.

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

// ─── CSV Parser (minimal, used by CA CKAN fallback) ─────────────────────────
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

// ─── California — CEDEN/DWR water quality via data.ca.gov (CKAN) ────────────
// Special adapter: tries CEDEN CKAN first, falls back to WQP
const californiaAdapter: StatePortalAdapter = {
  state: 'CA',
  name: 'California DWR (CKAN)',
  async fetch(query) {
    const results: StatePortalResult[] = [];
    try {
      // Try CA CKAN first with the known working resource
      if (query.lat && query.lng) {
        const delta = 0.25;
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
      wqpUrl.searchParams.set('statecode', 'US:06');
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

// ─── Adapter Registry ───────────────────────────────────────────────────────
// Only CA has a unique adapter. All other states use WQP directly.

/** Get the state adapter if one exists (only CA has a unique adapter) */
export function getStateAdapter(state: string): StatePortalAdapter | null {
  const s = state.toUpperCase();
  if (s === 'CA') return californiaAdapter;
  // Non-CA states use WQP directly via the wqp-results action
  return null;
}

export function getAvailableStates(): string[] {
  return ['CA'];
}

export async function fetchStatePortalData(
  state: string,
  query: StatePortalQuery
): Promise<StatePortalResponse> {
  const adapter = getStateAdapter(state);
  if (!adapter) {
    // Non-CA states: return empty with a note to use WQP directly
    return {
      data: [],
      adapter: 'wqp-fallthrough',
      error: undefined,
    };
  }
  return adapter.fetch(query);
}
