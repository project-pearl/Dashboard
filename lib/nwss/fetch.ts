/* ------------------------------------------------------------------ */
/*  CDC NWSS — Socrata API Fetcher                                    */
/*                                                                    */
/*  Unified fetcher for all NWSS pathogen datasets. The Socrata API   */
/*  is identical across all four — only the dataset ID changes.       */
/*                                                                    */
/*  Rate limits: 1,000 req/hr (no token), 10,000 req/hr (with token) */
/*  Max rows per request: 50,000 (use $offset for pagination)         */
/* ------------------------------------------------------------------ */

import { DATASET_IDS, type PathogenType, type NWSSRecord } from './types';

const SOCRATA_BASE = 'https://data.cdc.gov/resource';
const PAGE_SIZE = 10_000;
const MAX_PAGES = 50;              // 500K rows safety cap
const FETCH_TIMEOUT_MS = 30_000;
const RATE_LIMIT_BACKOFF_MS = 60_000;
const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/* ------------------------------------------------------------------ */
/*  Field Mapping: Socrata → NWSSRecord                               */
/* ------------------------------------------------------------------ */

function mapSocrataRow(row: Record<string, any>, pathogen: PathogenType): NWSSRecord | null {
  const concentration = row.pcr_target_avg_conc != null
    ? parseFloat(row.pcr_target_avg_conc)
    : null;
  const lod = row.lod_sewage != null ? parseFloat(row.lod_sewage) : null;

  // Skip records with no concentration data or below LOD
  if (concentration === null || isNaN(concentration)) return null;
  if (lod !== null && !isNaN(lod) && concentration < lod) return null;

  const jurisdiction = (row.wwtp_jurisdiction || '').toUpperCase();
  if (!jurisdiction) return null;

  return {
    recordId: row.record_id || `${row.sewershed_id}_${row.sample_collect_date}_${pathogen}`,
    sewershedId: row.sewershed_id || '',
    jurisdiction,
    countyFips: row.county_fips || '',
    countiesServed: row.counties_served || '',
    populationServed: parseFloat(row.population_served) || 0,
    sampleCollectDate: row.sample_collect_date
      ? row.sample_collect_date.split('T')[0]
      : '',
    pathogen,
    geneTarget: row.pcr_gene_target_agg || '',
    concentration,
    concentrationUnit: row.pcr_target_units || 'copies/l wastewater',
    limitOfDetection: lod,
    flowPopNormalized: row.pcr_target_flowpop_lin != null
      ? parseFloat(row.pcr_target_flowpop_lin)
      : null,
    flowRate: row.flow_rate != null ? parseFloat(row.flow_rate) : null,
    sampleType: row.sample_type || '',
    dateUpdated: row.date_updated || '',
  };
}

/* ------------------------------------------------------------------ */
/*  Core Fetcher                                                      */
/* ------------------------------------------------------------------ */

export async function fetchNWSSData(
  pathogen: PathogenType,
  options?: {
    jurisdiction?: string;           // state filter (e.g., 'md')
    sinceDate?: string;              // only records after this ISO date
    limit?: number;                  // override max records
  },
): Promise<NWSSRecord[]> {
  const datasetId = DATASET_IDS[pathogen];
  const records: NWSSRecord[] = [];
  const maxRecords = options?.limit ?? PAGE_SIZE * MAX_PAGES;

  let offset = 0;
  let retries = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (records.length >= maxRecords) break;

    // Build SoQL query
    const whereClauses: string[] = [];
    if (options?.jurisdiction) {
      whereClauses.push(`wwtp_jurisdiction='${options.jurisdiction.toLowerCase()}'`);
    }
    if (options?.sinceDate) {
      whereClauses.push(`sample_collect_date > '${options.sinceDate}'`);
    }

    const params = new URLSearchParams({
      '$select': [
        'record_id', 'sewershed_id', 'wwtp_jurisdiction', 'county_fips',
        'counties_served', 'population_served', 'sample_collect_date',
        'pcr_target', 'pcr_gene_target_agg', 'pcr_target_avg_conc',
        'pcr_target_units', 'lod_sewage', 'pcr_target_flowpop_lin',
        'flow_rate', 'sample_type', 'date_updated',
      ].join(','),
      '$order': 'sample_collect_date DESC',
      '$limit': String(Math.min(PAGE_SIZE, maxRecords - records.length)),
      '$offset': String(offset),
    });
    if (whereClauses.length > 0) {
      params.set('$where', whereClauses.join(' AND '));
    }

    // App token for higher rate limits
    const appToken = process.env.CDC_SOCRATA_APP_TOKEN;
    if (appToken) params.set('$$app_token', appToken);

    const url = `${SOCRATA_BASE}/${datasetId}.json?${params.toString()}`;

    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      // Rate limit handling
      if (res.status === 429) {
        retries++;
        if (retries > MAX_RETRIES) {
          console.warn(`[NWSS Fetch] ${pathogen}: rate limited, giving up after ${MAX_RETRIES} retries`);
          break;
        }
        console.warn(`[NWSS Fetch] ${pathogen}: rate limited, backing off ${RATE_LIMIT_BACKOFF_MS}ms (retry ${retries}/${MAX_RETRIES})`);
        await delay(RATE_LIMIT_BACKOFF_MS);
        continue; // retry same page
      }

      if (!res.ok) {
        console.warn(`[NWSS Fetch] ${pathogen} page ${page}: HTTP ${res.status}`);
        break;
      }

      const rows: any[] = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) break;

      retries = 0; // reset retries on success

      for (const row of rows) {
        const mapped = mapSocrataRow(row, pathogen);
        if (mapped) records.push(mapped);
      }

      if (rows.length < PAGE_SIZE) break; // last page
      offset += PAGE_SIZE;
      await delay(500); // be polite to government servers
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      // Server errors: log and stop
      if (msg.includes('5') || msg.includes('timeout')) {
        console.warn(`[NWSS Fetch] ${pathogen} page ${page}: ${msg}`);
        break;
      }

      console.warn(`[NWSS Fetch] ${pathogen} page ${page}: ${msg}`);
      break;
    }
  }

  console.log(`[NWSS Fetch] ${pathogen}: fetched ${records.length} valid records`);
  return records;
}

/* ------------------------------------------------------------------ */
/*  Batch Fetcher — All Pathogens for a Jurisdiction                  */
/* ------------------------------------------------------------------ */

export async function fetchAllPathogens(
  pathogens: PathogenType[],
  options?: {
    jurisdiction?: string;
    sinceDate?: string;
    limit?: number;
  },
): Promise<Record<PathogenType, NWSSRecord[]>> {
  const result = {} as Record<PathogenType, NWSSRecord[]>;

  // Fetch sequentially to respect rate limits
  for (const pathogen of pathogens) {
    try {
      result[pathogen] = await fetchNWSSData(pathogen, options);
    } catch (e) {
      console.error(`[NWSS Fetch] ${pathogen} failed:`, e);
      result[pathogen] = [];
    }
    await delay(1000); // gap between pathogen datasets
  }

  return result;
}
