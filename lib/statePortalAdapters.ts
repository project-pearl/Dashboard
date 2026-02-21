// lib/statePortalAdapters.ts
// Adapter pattern for querying state open data portals
// All 51 US states + DC via WQP STORET, California gets special CEDEN adapter

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

// ─── WQP Factory — generates adapter for any state via WQP STORET ──────────
function makeWqpAdapter(stateAbbr: string, fips: string, displayName: string): StatePortalAdapter {
  return {
    state: stateAbbr,
    name: `${displayName} (via WQP)`,
    async fetch(query) {
      const results: StatePortalResult[] = [];
      try {
        const eighteenMonthsAgo = new Date();
        eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
        const startDate = eighteenMonthsAgo.toISOString().split('T')[0];

        const url = new URL('https://www.waterqualitydata.us/wqx3/Result/search');
        url.searchParams.set('statecode', `US:${fips}`);
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
                station_name: row.MonitoringLocationName || row['Monitoring Location Name'] || `${stateAbbr} Station`,
                date: row.ActivityStartDate || row['Activity Start Date'] || '',
                source_url: 'https://www.waterqualitydata.us',
              });
            }
          }
        }
      } catch (e: any) {
        return { data: results, adapter: `${stateAbbr.toLowerCase()}-wqp`, error: e.message };
      }
      return { data: results, adapter: `${stateAbbr.toLowerCase()}-wqp` };
    },
  };
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

// ─── All 51 US States + DC ──────────────────────────────────────────────────
// [abbreviation, FIPS code, display name]
const STATE_LIST: [string, string, string][] = [
  ['AL','01','Alabama'],['AK','02','Alaska'],['AZ','04','Arizona'],['AR','05','Arkansas'],
  ['CO','08','Colorado'],['CT','09','Connecticut'],['DE','10','Delaware'],['DC','11','District of Columbia'],
  ['FL','12','Florida'],['GA','13','Georgia'],['HI','15','Hawaii'],['ID','16','Idaho'],
  ['IL','17','Illinois'],['IN','18','Indiana'],['IA','19','Iowa'],['KS','20','Kansas'],
  ['KY','21','Kentucky'],['LA','22','Louisiana'],['ME','23','Maine'],['MD','24','Maryland'],
  ['MA','25','Massachusetts'],['MI','26','Michigan'],['MN','27','Minnesota'],['MS','28','Mississippi'],
  ['MO','29','Missouri'],['MT','30','Montana'],['NE','31','Nebraska'],['NV','32','Nevada'],
  ['NH','33','New Hampshire'],['NJ','34','New Jersey'],['NM','35','New Mexico'],['NY','36','New York'],
  ['NC','37','North Carolina'],['ND','38','North Dakota'],['OH','39','Ohio'],['OK','40','Oklahoma'],
  ['OR','41','Oregon'],['PA','42','Pennsylvania'],['RI','44','Rhode Island'],['SC','45','South Carolina'],
  ['SD','46','South Dakota'],['TN','47','Tennessee'],['TX','48','Texas'],['UT','49','Utah'],
  ['VT','50','Vermont'],['VA','51','Virginia'],['WA','53','Washington'],['WV','54','West Virginia'],
  ['WI','55','Wisconsin'],['WY','56','Wyoming'],
];

// ─── Adapter Registry ───────────────────────────────────────────────────────

const ADAPTERS: Record<string, StatePortalAdapter> = {};

// California gets the special CEDEN adapter
ADAPTERS['CA'] = californiaAdapter;

// All other states get the WQP factory adapter
for (const [abbr, fips, name] of STATE_LIST) {
  if (abbr === 'CA') continue; // Already set above
  ADAPTERS[abbr] = makeWqpAdapter(abbr, fips, name);
}

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
