#!/usr/bin/env npx tsx
/**
 * PEARL Station Discovery v2 — Data-First Approach
 * 
 * Instead of pre-picking waterbodies and hoping for data,
 * this discovers ALL active monitoring stations per state
 * and builds the waterbody list from what actually has data.
 * 
 * Usage:
 *   npx tsx scripts/discover-stations.ts
 *   npx tsx scripts/discover-stations.ts --state US:49    # Utah only
 *   npx tsx scripts/discover-stations.ts --max-per-state 10
 *   npx tsx scripts/discover-stations.ts --dry-run
 * 
 * Output:
 *   lib/station-registry.ts  — REGION_META + USGS_SITE_MAP + WQP_STATION_MAP
 *   station-discovery.json   — raw results for debugging
 */

// ─── Configuration ──────────────────────────────────────────────────────────

const MAX_PER_STATE = 15;          // Max waterbodies per state (top by data richness)
const RATE_LIMIT_MS = 400;         // Delay between API calls
const USGS_LOOKBACK_MONTHS = 24;
const WQP_LOOKBACK_MONTHS = 36;

// WQ parameter codes that indicate real water quality monitoring (not just discharge)
const USGS_WQ_PARAM_CODES = [
  '00300',  // Dissolved oxygen
  '00010',  // Temperature
  '00400',  // pH
  '00665',  // Phosphorus
  '00600',  // Nitrogen
  '00530',  // TSS
  '63680',  // Turbidity
  '00095',  // Specific conductance
];

// All 50 states + DC with FIPS codes
const ALL_STATES: Record<string, { fips: string; usgsCode: string; name: string }> = {
  'US:01': { fips: '01', usgsCode: 'al', name: 'Alabama' },
  'US:02': { fips: '02', usgsCode: 'ak', name: 'Alaska' },
  'US:04': { fips: '04', usgsCode: 'az', name: 'Arizona' },
  'US:05': { fips: '05', usgsCode: 'ar', name: 'Arkansas' },
  'US:06': { fips: '06', usgsCode: 'ca', name: 'California' },
  'US:08': { fips: '08', usgsCode: 'co', name: 'Colorado' },
  'US:09': { fips: '09', usgsCode: 'ct', name: 'Connecticut' },
  'US:10': { fips: '10', usgsCode: 'de', name: 'Delaware' },
  'US:11': { fips: '11', usgsCode: 'dc', name: 'District of Columbia' },
  'US:12': { fips: '12', usgsCode: 'fl', name: 'Florida' },
  'US:13': { fips: '13', usgsCode: 'ga', name: 'Georgia' },
  'US:15': { fips: '15', usgsCode: 'hi', name: 'Hawaii' },
  'US:16': { fips: '16', usgsCode: 'id', name: 'Idaho' },
  'US:17': { fips: '17', usgsCode: 'il', name: 'Illinois' },
  'US:18': { fips: '18', usgsCode: 'in', name: 'Indiana' },
  'US:19': { fips: '19', usgsCode: 'ia', name: 'Iowa' },
  'US:20': { fips: '20', usgsCode: 'ks', name: 'Kansas' },
  'US:21': { fips: '21', usgsCode: 'ky', name: 'Kentucky' },
  'US:22': { fips: '22', usgsCode: 'la', name: 'Louisiana' },
  'US:23': { fips: '23', usgsCode: 'me', name: 'Maine' },
  'US:24': { fips: '24', usgsCode: 'md', name: 'Maryland' },
  'US:25': { fips: '25', usgsCode: 'ma', name: 'Massachusetts' },
  'US:26': { fips: '26', usgsCode: 'mi', name: 'Michigan' },
  'US:27': { fips: '27', usgsCode: 'mn', name: 'Minnesota' },
  'US:28': { fips: '28', usgsCode: 'ms', name: 'Mississippi' },
  'US:29': { fips: '29', usgsCode: 'mo', name: 'Missouri' },
  'US:30': { fips: '30', usgsCode: 'mt', name: 'Montana' },
  'US:31': { fips: '31', usgsCode: 'ne', name: 'Nebraska' },
  'US:32': { fips: '32', usgsCode: 'nv', name: 'Nevada' },
  'US:33': { fips: '33', usgsCode: 'nh', name: 'New Hampshire' },
  'US:34': { fips: '34', usgsCode: 'nj', name: 'New Jersey' },
  'US:35': { fips: '35', usgsCode: 'nm', name: 'New Mexico' },
  'US:36': { fips: '36', usgsCode: 'ny', name: 'New York' },
  'US:37': { fips: '37', usgsCode: 'nc', name: 'North Carolina' },
  'US:38': { fips: '38', usgsCode: 'nd', name: 'North Dakota' },
  'US:39': { fips: '39', usgsCode: 'oh', name: 'Ohio' },
  'US:40': { fips: '40', usgsCode: 'ok', name: 'Oklahoma' },
  'US:41': { fips: '41', usgsCode: 'or', name: 'Oregon' },
  'US:42': { fips: '42', usgsCode: 'pa', name: 'Pennsylvania' },
  'US:44': { fips: '44', usgsCode: 'ri', name: 'Rhode Island' },
  'US:45': { fips: '45', usgsCode: 'sc', name: 'South Carolina' },
  'US:46': { fips: '46', usgsCode: 'sd', name: 'South Dakota' },
  'US:47': { fips: '47', usgsCode: 'tn', name: 'Tennessee' },
  'US:48': { fips: '48', usgsCode: 'tx', name: 'Texas' },
  'US:49': { fips: '49', usgsCode: 'ut', name: 'Utah' },
  'US:50': { fips: '50', usgsCode: 'vt', name: 'Vermont' },
  'US:51': { fips: '51', usgsCode: 'va', name: 'Virginia' },
  'US:53': { fips: '53', usgsCode: 'wa', name: 'Washington' },
  'US:54': { fips: '54', usgsCode: 'wv', name: 'West Virginia' },
  'US:55': { fips: '55', usgsCode: 'wi', name: 'Wisconsin' },
  'US:56': { fips: '56', usgsCode: 'wy', name: 'Wyoming' },
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface DiscoveredStation {
  siteId: string;
  name: string;
  waterbodyName: string;    // Cleaned waterbody name for display
  lat: number;
  lng: number;
  source: 'USGS' | 'WQP';
  provider?: string;
  siteType: string;         // ST=Stream, LK=Lake, ES=Estuary
  huc8: string;
  wqParamCount: number;     // How many WQ params available (richness score)
  wqParams: string[];
  lastActivity?: string;
  regionId: string;         // Generated: statename_waterbodyname
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rdbToRows(rdb: string): Record<string, string>[] {
  const lines = rdb.trim().split('\n').filter(l => !l.startsWith('#'));
  if (lines.length < 3) return [];
  const headers = lines[0].split('\t').map(h => h.trim());
  return lines.slice(2).map(line => {
    const values = line.split('\t').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

function csvToRows(csv: string): Record<string, string>[] {
  const lines = csv.trim().split('\n').filter(l => !l.startsWith('#'));
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    // Handle quoted fields with commas
    const values: string[] = [];
    let current = '';
    let inQuote = false;
    for (const char of line) {
      if (char === '"') { inQuote = !inQuote; continue; }
      if (char === ',' && !inQuote) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

async function fetchWithRetry(url: string, retries = 2, timeoutMs = 25000): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        console.error(`  HTTP ${res.status} for ${url.slice(0, 100)}...`);
        return null;
      }
      return await res.text();
    } catch (e: any) {
      if (attempt < retries) await sleep(1000 * (attempt + 1));
      else if (e.name !== 'AbortError') console.error(`  Fetch error: ${e.message?.slice(0, 80)}`);
    }
  }
  return null;
}

/**
 * Clean up USGS station names into readable waterbody names
 * "JONES FALLS AT STN MERRYMAN LA, BALTIMORE" → "Jones Falls"
 */
function cleanWaterbodyName(rawName: string): string {
  let name = rawName
    .replace(/\bNR\b\.?/gi, 'near')
    .replace(/\bAT\b/gi, 'at')
    .replace(/\bABV?\b/gi, 'above')
    .replace(/\bBLW?\b/gi, 'below')
    .replace(/\bCR\b\.?/gi, 'Creek')
    .replace(/\bRIV\b\.?/gi, 'River')
    .replace(/\bR\b\.?/g, 'River')
    .replace(/\bST\b\.?/gi, 'St.')
    .replace(/\bFT\b\.?/gi, 'Fort')
    .replace(/\bMT\b\.?/gi, 'Mount');

  // Take waterbody name (everything before "at", "near", "above", "below")
  const splitWords = [' at ', ' near ', ' above ', ' below ', ' @'];
  for (const word of splitWords) {
    const idx = name.toLowerCase().indexOf(word);
    if (idx > 3) {
      name = name.slice(0, idx);
      break;
    }
  }

  // Title case
  name = name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).trim();

  // Remove trailing state abbreviations
  name = name.replace(/,?\s+[A-Z]{2}\s*$/i, '').trim();

  return name;
}

/**
 * Generate a region ID from state name and waterbody name
 * "Utah", "Jordan River" → "utah_jordan_river"
 */
function makeRegionId(stateName: string, waterbodyName: string): string {
  const state = stateName.toLowerCase().replace(/\s+/g, '');
  const wb = waterbodyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `${state}_${wb}`;
}

// ─── API Queries ────────────────────────────────────────────────────────────

/**
 * Find ALL active USGS gauges with WQ parameters in a state
 */
async function findAllUsgsWqSites(stateFips: string): Promise<DiscoveredStation[]> {
  const url = `https://waterservices.usgs.gov/nwis/site?format=rdb` +
    `&stateCd=${stateFips}` +
    `&siteType=ST,LK,ES` +
    `&siteStatus=active` +
    `&hasDataTypeCd=iv` +
    `&parameterCd=${USGS_WQ_PARAM_CODES.join(',')}`;

  const text = await fetchWithRetry(url, 2, 30000);
  if (!text) return [];

  const rows = rdbToRows(text);
  const stations: DiscoveredStation[] = [];

  for (const row of rows) {
    const lat = parseFloat(row.dec_lat_va);
    const lng = parseFloat(row.dec_long_va);
    const siteId = row.site_no || '';
    const rawName = row.station_nm || '';
    const huc = row.huc_cd || '';
    const siteType = row.site_tp_cd || 'ST';

    if (!siteId || isNaN(lat) || isNaN(lng)) continue;
    if (!rawName) continue;

    const waterbodyName = cleanWaterbodyName(rawName);
    if (waterbodyName.length < 3) continue;

    stations.push({
      siteId,
      name: rawName,
      waterbodyName,
      lat, lng,
      source: 'USGS',
      siteType,
      huc8: huc.slice(0, 8),
      wqParamCount: 0,  // Will be scored below
      wqParams: [],
      regionId: '',      // Will be generated
    });
  }

  return stations;
}

/**
 * Get WQ parameter count for a USGS site (determines data richness)
 */
async function getUsgsParamCount(siteId: string): Promise<{ count: number; params: string[] }> {
  const url = `https://waterservices.usgs.gov/nwis/site?format=rdb` +
    `&sites=${siteId}` +
    `&seriesCatalogOutput=true` +
    `&outputDataTypeCd=iv`;

  const text = await fetchWithRetry(url, 1, 10000);
  if (!text) return { count: 0, params: [] };

  const rows = rdbToRows(text);
  const wqParams = new Set<string>();
  for (const row of rows) {
    const paramCd = row.parm_cd || '';
    if (USGS_WQ_PARAM_CODES.includes(paramCd)) {
      wqParams.add(paramCd);
    }
  }
  return { count: wqParams.size, params: Array.from(wqParams) };
}

/**
 * Find WQP stations (state/tribal/local) with recent data in a state
 */
async function findAllWqpSites(stateCode: string): Promise<DiscoveredStation[]> {
  const lookbackDate = new Date();
  lookbackDate.setMonth(lookbackDate.getMonth() - WQP_LOOKBACK_MONTHS);
  const startDate = lookbackDate.toISOString().split('T')[0];

  const url = `https://www.waterqualitydata.us/data/Station/search` +
    `?statecode=${encodeURIComponent(stateCode)}` +
    `&startDateLo=${startDate}` +
    `&siteType=Stream&siteType=Lake,+Reservoir,+Impoundment&siteType=Estuary` +
    `&sampleMedia=Water` +
    `&providers=STORET&providers=STEWARDS` +
    `&mimeType=csv&zip=no&sorted=yes`;

  const text = await fetchWithRetry(url, 2, 45000); // WQP state queries can be very slow
  if (!text) return [];

  const rows = csvToRows(text);
  const stations: DiscoveredStation[] = [];

  for (const row of rows) {
    const lat = parseFloat(row.LatitudeMeasure || '');
    const lng = parseFloat(row.LongitudeMeasure || '');
    const locId = row.MonitoringLocationIdentifier || '';
    const locName = row.MonitoringLocationName || '';
    const orgId = row.OrganizationIdentifier || '';
    const siteType = row.MonitoringLocationTypeName || '';
    const huc = row.HUCEightDigitCode || '';
    const resultCount = parseInt(row.ResultCount || '0');

    if (!locId || isNaN(lat) || isNaN(lng)) continue;
    // Skip USGS — we get those from USGS API
    if (locId.startsWith('USGS-') || locId.startsWith('NWIS-')) continue;
    // Skip low-data stations
    if (resultCount < 5) continue;

    const waterbodyName = locName ? cleanWaterbodyName(locName) : locId;

    stations.push({
      siteId: locId,
      name: locName || locId,
      waterbodyName,
      lat, lng,
      source: 'WQP',
      provider: orgId,
      siteType: siteType.includes('Stream') ? 'ST' : siteType.includes('Lake') ? 'LK' : 'ES',
      huc8: huc.slice(0, 8),
      wqParamCount: Math.min(resultCount, 100),  // Use result count as richness proxy
      wqParams: [],
      regionId: '',
    });
  }

  return stations;
}

// ─── Ranking & Dedup ────────────────────────────────────────────────────────

/**
 * Pick the best stations per state:
 * 1. Merge USGS + WQP
 * 2. Deduplicate by proximity (stations within 0.5mi = same waterbody)
 * 3. Rank by WQ param richness
 * 4. Take top N per state
 */
function rankAndDedup(
  usgsSites: DiscoveredStation[],
  wqpSites: DiscoveredStation[],
  stateName: string,
  maxPerState: number
): DiscoveredStation[] {

  const all = [...usgsSites, ...wqpSites];

  // Deduplicate: group stations within ~1 mile of each other
  const groups: DiscoveredStation[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < all.length; i++) {
    if (used.has(i)) continue;
    const group = [all[i]];
    used.add(i);

    for (let j = i + 1; j < all.length; j++) {
      if (used.has(j)) continue;
      const dLat = Math.abs(all[i].lat - all[j].lat);
      const dLng = Math.abs(all[i].lng - all[j].lng);
      // ~0.015 degrees ≈ 1 mile
      if (dLat < 0.015 && dLng < 0.015) {
        group.push(all[j]);
        used.add(j);
      }
    }
    groups.push(group);
  }

  // Pick best station from each group (prefer USGS, then highest param count)
  const best: DiscoveredStation[] = groups.map(group => {
    group.sort((a, b) => {
      // USGS first
      if (a.source !== b.source) return a.source === 'USGS' ? -1 : 1;
      // Then by WQ param count
      return b.wqParamCount - a.wqParamCount;
    });

    const winner = group[0];
    // If group has both USGS and WQP, note WQP provider on the USGS station
    const wqpEntry = group.find(s => s.source === 'WQP');
    if (wqpEntry && winner.source === 'USGS') {
      winner.provider = wqpEntry.provider;
    }
    return winner;
  });

  // Sort by param count descending (richest data first)
  best.sort((a, b) => b.wqParamCount - a.wqParamCount);

  // Generate region IDs
  const usedIds = new Set<string>();
  const result: DiscoveredStation[] = [];

  for (const station of best.slice(0, maxPerState)) {
    let regionId = makeRegionId(stateName, station.waterbodyName);

    // Handle duplicates (e.g., two "Clear Creek" in same state)
    if (usedIds.has(regionId)) {
      // Append site type
      const suffix = station.siteType === 'LK' ? '_lake' : station.siteType === 'ES' ? '_estuary' : '_lower';
      regionId += suffix;
    }
    if (usedIds.has(regionId)) {
      regionId += `_${station.siteId.slice(-4)}`;
    }

    usedIds.add(regionId);
    station.regionId = regionId;
    result.push(station);
  }

  return result;
}

// ─── Output Generation ──────────────────────────────────────────────────────

function generateRegistryTs(allStations: Map<string, DiscoveredStation[]>): string {
  const regionMetaLines: string[] = [];
  const usgsSiteMapLines: string[] = [];
  const wqpStationMapLines: string[] = [];
  const coverageLines: string[] = [];

  for (const [stateCode, stations] of Array.from(allStations.entries()).sort()) {
    const stateName = ALL_STATES[stateCode]?.name || stateCode;
    regionMetaLines.push(`  // ${stateName}`);
    let stateUsgsCount = 0;
    let stateWqpCount = 0;

    for (const s of stations) {
      const escapedName = s.waterbodyName.replace(/'/g, "\\'");

      // REGION_META entry
      regionMetaLines.push(
        `  '${s.regionId}': { lat: ${s.lat.toFixed(3)}, lng: ${s.lng.toFixed(3)}, huc8: '${s.huc8}', stateCode: '${stateCode}', name: '${escapedName}' },`
      );

      // USGS_SITE_MAP entry
      if (s.source === 'USGS') {
        usgsSiteMapLines.push(`  '${s.regionId}': '${s.siteId}',  // ${escapedName}`);
        stateUsgsCount++;
      }

      // WQP_STATION_MAP entry
      if (s.source === 'WQP' || s.provider) {
        const wqpSiteId = s.source === 'WQP' ? s.siteId : '';
        const provider = s.provider || '';
        if (s.source === 'WQP') {
          wqpStationMapLines.push(
            `  '${s.regionId}': { siteId: '${wqpSiteId}', provider: '${provider}', name: '${escapedName}' },`
          );
          stateWqpCount++;
        }
      }

      // Coverage
      const sources: string[] = [];
      if (s.source === 'USGS') sources.push("'USGS_IV'", "'USGS_QW'");
      if (s.source === 'WQP' || s.provider) sources.push("'WQP'");
      coverageLines.push(`  '${s.regionId}': { hasData: true, sources: [${sources.join(', ')}] },`);
    }

    regionMetaLines.push('');
  }

  return `// lib/station-registry.ts
// AUTO-GENERATED by scripts/discover-stations.ts on ${new Date().toISOString().split('T')[0]}
// Re-run to update: npx tsx scripts/discover-stations.ts
//
// Data-first approach: every waterbody listed here has CONFIRMED monitoring data.
// Generated by querying USGS + WQP for all active stations per state.

// ─── Region Metadata ────────────────────────────────────────────────────────
// Every entry here has at least one confirmed data source.

export interface RegionMeta {
  lat: number;
  lng: number;
  huc8: string;
  stateCode: string;
  name: string;
}

export const REGION_META: Record<string, RegionMeta> = {
${regionMetaLines.join('\n')}
};

// ─── USGS Site IDs ──────────────────────────────────────────────────────────
// Maps region ID → USGS gauge site number for real-time + discrete sample data

export const USGS_SITE_MAP: Record<string, string> = {
${usgsSiteMapLines.join('\n')}
};

// ─── WQP Station IDs ────────────────────────────────────────────────────────
// Maps region ID → non-USGS monitoring station (state, tribal, local providers)

export interface WqpStationInfo {
  siteId: string;
  provider: string;
  name: string;
}

export const WQP_STATION_MAP: Record<string, WqpStationInfo> = {
${wqpStationMapLines.join('\n')}
};

// ─── Coverage Map ───────────────────────────────────────────────────────────

export interface CoverageInfo {
  hasData: boolean;
  sources: string[];
}

export const COVERAGE_MAP: Record<string, CoverageInfo> = {
${coverageLines.join('\n')}
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function hasConfirmedData(regionId: string): boolean {
  return COVERAGE_MAP[regionId]?.hasData ?? false;
}

export function getWaterbodiesWithData(): string[] {
  return Object.keys(COVERAGE_MAP);
}

export function getWaterbodiesByState(stateCode: string): { id: string; name: string }[] {
  return Object.entries(REGION_META)
    .filter(([_, meta]) => meta.stateCode === stateCode)
    .map(([id, meta]) => ({ id, name: meta.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getAllStates(): { code: string; name: string; count: number }[] {
  const states = new Map<string, { name: string; count: number }>();
  for (const [_, meta] of Object.entries(REGION_META)) {
    if (!states.has(meta.stateCode)) {
      states.set(meta.stateCode, { name: '', count: 0 });
    }
    states.get(meta.stateCode)!.count++;
  }
  return Array.from(states.entries())
    .map(([code, info]) => ({ code, name: info.name, count: info.count }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const stateFilter = args.find(a => a.startsWith('--state='))?.split('=')[1];
  const maxPerState = parseInt(args.find(a => a.startsWith('--max-per-state='))?.split('=')[1] || '') || MAX_PER_STATE;
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose');

  console.log('🔍 PEARL Station Discovery v2 — Data-First');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`📊 Max ${maxPerState} waterbodies per state`);

  let statesToQuery = Object.entries(ALL_STATES);
  if (stateFilter) {
    statesToQuery = statesToQuery.filter(([code]) => code === stateFilter);
    console.log(`🔎 Filtering to: ${stateFilter}`);
  }
  console.log(`🏛️  ${statesToQuery.length} states to query\n`);

  if (dryRun) {
    for (const [code, info] of statesToQuery) {
      console.log(`  ${code} ${info.name} (FIPS: ${info.fips})`);
    }
    return;
  }

  const allStations = new Map<string, DiscoveredStation[]>();
  let totalWaterbodies = 0;
  let totalUsgs = 0;
  let totalWqp = 0;

  for (const [stateCode, stateInfo] of statesToQuery) {
    console.log(`\n── ${stateInfo.name} (${stateCode}) ──`);

    // 1. Query USGS for all active WQ gauges
    process.stdout.write('  USGS IV gauges... ');
    const usgsSites = await findAllUsgsWqSites(stateInfo.fips);
    console.log(`${usgsSites.length} found`);
    await sleep(RATE_LIMIT_MS);

    // 2. Score top USGS sites by WQ param richness (only top 30 to avoid rate limits)
    if (usgsSites.length > 0) {
      const topCandidates = usgsSites.slice(0, 30);
      process.stdout.write(`  Scoring ${topCandidates.length} USGS sites... `);
      let scored = 0;
      for (const site of topCandidates) {
        const { count, params } = await getUsgsParamCount(site.siteId);
        site.wqParamCount = count;
        site.wqParams = params;
        scored++;
        if (scored % 10 === 0) process.stdout.write(`${scored}..`);
        await sleep(200); // Lighter rate limit for param queries
      }
      console.log(` done (${scored} scored)`);
    }

    // 3. Query WQP for state/tribal/local stations
    process.stdout.write('  WQP stations... ');
    const wqpSites = await findAllWqpSites(stateCode);
    console.log(`${wqpSites.length} found`);
    await sleep(RATE_LIMIT_MS);

    // 4. Rank, dedup, and pick best per state
    const ranked = rankAndDedup(
      usgsSites.filter(s => s.wqParamCount >= 1), // Only sites with at least 1 WQ param
      wqpSites,
      stateInfo.name,
      maxPerState
    );

    allStations.set(stateCode, ranked);
    totalWaterbodies += ranked.length;
    totalUsgs += ranked.filter(s => s.source === 'USGS').length;
    totalWqp += ranked.filter(s => s.source === 'WQP').length;

    // Print results
    for (const s of ranked) {
      const srcLabel = s.source === 'USGS' ? `USGS:${s.siteId}` : `WQP:${s.provider}`;
      const paramLabel = s.wqParamCount > 0 ? ` (${s.wqParamCount} params)` : '';
      console.log(`  ✅ ${s.waterbodyName} → ${srcLabel}${paramLabel}`);
    }
    if (ranked.length === 0) {
      console.log('  ❌ No stations with WQ data found');
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`✅ ${totalWaterbodies} waterbodies with confirmed data`);
  console.log(`   ${totalUsgs} from USGS | ${totalWqp} from WQP (state/tribal/local)`);
  console.log(`   across ${statesToQuery.length} states (max ${maxPerState} per state)`);

  // ─── Write outputs ────────────────────────────────────────────────────
  const fs = await import('fs');
  const path = await import('path');

  // 1. JSON for debugging
  const jsonData: Record<string, any> = {};
  for (const [state, stations] of Array.from(allStations)) {
    jsonData[state] = stations;
  }
  const jsonPath = path.join(process.cwd(), 'station-discovery.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
  console.log(`\n📄 Raw results: ${jsonPath}`);

  // 2. TypeScript registry
  const registryContent = generateRegistryTs(allStations);
  const registryPath = path.join(process.cwd(), 'lib', 'station-registry.ts');
  try { fs.mkdirSync(path.dirname(registryPath), { recursive: true }); } catch {}
  fs.writeFileSync(registryPath, registryContent);
  console.log(`📄 Station registry: ${registryPath}`);

  // 3. Per-state summary
  console.log('\n── Per-State Coverage ──');
  for (const [code, stateInfo] of statesToQuery.sort()) {
    const stations = allStations.get(code) || [];
    const bar = '█'.repeat(Math.min(stations.length, 20)) + '░'.repeat(Math.max(0, 10 - stations.length));
    console.log(`  ${code} ${stateInfo.name.padEnd(20)} ${bar} ${stations.length} waterbodies`);
  }

  console.log('\n✨ Done!');
  console.log('   Registry written to lib/station-registry.ts');
  console.log('   Import into useWaterData.ts:');
  console.log("   import { REGION_META, USGS_SITE_MAP, WQP_STATION_MAP } from './station-registry';");
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
