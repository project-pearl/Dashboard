// app/api/water-data/route.ts
// Unified server-side proxy for multiple water quality data sources
// Sources: Water Reporter (BWB), Chesapeake Bay Program DataHub, USGS (IV, Samples, Daily), MARACOOS ERDDAP (MD DNR)
import { NextRequest, NextResponse } from 'next/server';
import { getAttainsCache, getAttainsCacheSummary, getCacheStatus, triggerAttainsBuild } from '@/lib/attainsCache';

const WR_BASE = 'https://api.waterreporter.org';
const CBP_BASE = 'http://datahub.chesapeakebay.net';
const USGS_IV_BASE = 'https://waterservices.usgs.gov/nwis/iv';
const USGS_SITE_BASE = 'https://waterservices.usgs.gov/nwis/site';
const USGS_OGC_BASE = 'https://api.waterdata.usgs.gov/ogcapi/v0';
const ATTAINS_BASE = 'https://attains.epa.gov/attains-public/api';
const ECHO_BASE = 'https://echo.epa.gov/api/rest_services';
const EJSCREEN_BASE = 'https://ejscreen.epa.gov/mapper/ejscreenRESTbroker1.aspx';

const getToken = () => process.env.WATER_REPORTER_API_KEY || '';

// ─── Water Reporter Helper ──────────────────────────────────────────────────
async function wrFetch(path: string, params: Record<string, string> = {}) {
  const token = getToken();
  if (!token || token === 'your_token_here') {
    return { error: 'WATER_REPORTER_API_KEY not configured in .env.local' };
  }

  const url = new URL(`${WR_BASE}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return { error: `Water Reporter API error: ${res.status} ${res.statusText}` };
  }
  return res.json();
}

// ─── CBP DataHub Helper ─────────────────────────────────────────────────────
async function cbpFetch(path: string) {
  const url = `${CBP_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 600 }, // Cache 10 minutes (data updates monthly)
  });
  if (!res.ok) {
    return { error: `CBP DataHub error: ${res.status} ${res.statusText}` };
  }
  return res.json();
}

// ─── WQP Station Search Helper (still works for station discovery) ───────────
async function wqpStationFetch(params: Record<string, string> = {}) {
  const url = new URL('https://www.waterqualitydata.us/data/Station/search');
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim() !== '') url.searchParams.set(k, v);
  }
  url.searchParams.set('mimeType', 'csv');
  url.searchParams.set('zip', 'no');

  const res = await fetch(url.toString(), {
    redirect: 'follow',
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    return { error: `WQP Station error: ${res.status} ${res.statusText}` };
  }
  const text = await res.text();
  return csvToJson(text);
}

// ─── WQP Results Fetch — true national multi-provider water quality data ─────
// Uses WQX 3.0 endpoint — legacy /data/Result/search misses USGS data after March 2024
// https://www.waterqualitydata.us/wqx3/Result/search
async function wqpResultsFetch(params: Record<string, any> = {}) {
  const url = new URL('https://www.waterqualitydata.us/wqx3/Result/search');

  // Pass through all params — support arrays for repeated params (e.g., providers)
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      v.forEach((item: string) => url.searchParams.append(k, String(item)));
    } else {
      url.searchParams.set(k, String(v));
    }
  }

  // Force narrow profile — faster + predictable columns
  url.searchParams.set('dataProfile', 'narrow');
  url.searchParams.set('mimeType', 'csv');

  console.log('[WQP-Results] Fetching:', url.toString());

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(30_000), // 30s — WQP geo queries can be slow
    redirect: 'follow',
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[WQP-Results] Error ${res.status}: ${body.slice(0, 300)}`);
    return { error: `WQP Results error: ${res.status}`, detail: body.slice(0, 200) };
  }
  const text = await res.text();
  console.log(`[WQP-Results] Received ${text.length} bytes, ~${text.split('\n').length} rows`);
  return csvToJson(text);
}

// ─── USGS Samples Data API — discrete WQ with national coverage ─────────────
// https://api.waterdata.usgs.gov/samples-data/results/narrow?mimeType=text/csv
const USGS_SAMPLES_BASE = 'https://api.waterdata.usgs.gov/samples-data';

async function usgsSamplesFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${USGS_SAMPLES_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim() !== '') url.searchParams.set(k, v);
  }
  // Always CSV — JSON not supported for most profiles
  url.searchParams.set('mimeType', 'text/csv');

  console.log('[USGS-Samples]', url.toString());

  const res = await fetch(url.toString(), {
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[USGS-Samples] Error ${res.status}: ${body.slice(0, 300)}`);
    return { error: `USGS Samples API error: ${res.status}`, detail: body.slice(0, 200) };
  }
  const text = await res.text();
  return csvToJson(text);
}

// ─── MARACOOS ERDDAP — MD DNR continuous tidal WQ monitoring ────────────────
// 15-min interval: DO, temperature, salinity, DO% sat from Eyes on the Bay
const ERDDAP_BASE = 'https://erddap.maracoos.org/erddap/tabledap';

// Map PEARL regions → nearest MDDNR ERDDAP dataset IDs + coordinates
const ERDDAP_STATION_MAP: Record<string, { datasetId: string; name: string; lat: number; lng: number }> = {
  'patuxent':         { datasetId: 'mddnr_Jug_Bay',                 name: 'Jug Bay',                 lat: 38.7813, lng: -76.7137 },
  'chester':          { datasetId: 'mddnr_Harris_Creek_Upstream',   name: 'Harris Creek Upstream',   lat: 38.7732, lng: -76.2823 },
  'choptank':         { datasetId: 'mddnr_Harris_Creek_Downstream', name: 'Harris Creek Downstream', lat: 38.7125, lng: -76.3168 },
  'upper_bay':        { datasetId: 'mddnr_Havre_de_Grace',          name: 'Havre de Grace',          lat: 39.5478, lng: -76.0848 },
  'gunpowder':        { datasetId: 'mddnr_Pleasure_Island',         name: 'Pleasure Island',         lat: 39.2282, lng: -76.4006 },
  'coastal_bays':     { datasetId: 'mddnr_Public_Landing',          name: 'Public Landing',          lat: 38.1483, lng: -75.2862 },
  'lower_eastern':    { datasetId: 'mddnr_Little_Monie_Creek',      name: 'Little Monie Creek',      lat: 38.2086, lng: -75.8046 },
  'budds_landing':    { datasetId: 'mddnr_Budds_Landing',           name: 'Budds Landing',           lat: 39.3723, lng: -75.8399 },
};

// ERDDAP column → PEARL key mapping
const ERDDAP_COLUMNS = [
  'time',
  'mass_concentration_of_oxygen_in_sea_water',  // DO mg/L
  'sea_water_temperature',                       // °C
  'sea_water_salinity',                          // PSU
  'fractional_saturation_of_oxygen_in_sea_water' // DO %
];

async function erddapFetch(datasetId: string, constraints: string = '') {
  // Request last row (most recent) by ordering descending and limiting to 1
  const columns = ERDDAP_COLUMNS.join(',');
  const defaultConstraints = constraints || '&orderByLimit("1,time/desc")';
  const url = `${ERDDAP_BASE}/${datasetId}.csv?${columns}${defaultConstraints}`;

  console.log('[ERDDAP]', url);

  const res = await fetch(url, {
    next: { revalidate: 300 }, // Cache 5 min (data updates every 15 min)
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[ERDDAP] Error ${res.status}: ${body.slice(0, 300)}`);
    return { error: `ERDDAP error: ${res.status}`, detail: body.slice(0, 200) };
  }
  const text = await res.text();
  // ERDDAP CSV has a units row (row 2) — skip it
  const lines = text.trim().split('\n');
  if (lines.length < 3) return []; // header + units + at least 1 data row
  const csvWithoutUnits = [lines[0], ...lines.slice(2)].join('\n');
  return csvToJson(csvWithoutUnits);
}

// ─── NOAA CO-OPS — Tides, water temp, conductivity for coastal/tidal stations ─
// https://api.tidesandcurrents.noaa.gov/api/prod/
const COOPS_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';

// Map PEARL regions → nearest CO-OPS station IDs
const COOPS_STATION_MAP: Record<string, { stationId: string; name: string; lat: number; lng: number }> = {
  // Baltimore Harbor & tributaries
  'maryland_middle_branch':  { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_inner_harbor':   { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_back_river':     { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_bear_creek':     { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_curtis_bay':     { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_patapsco_river': { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_stony_creek':    { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_canton':         { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_ferry_bar':      { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_ft_mchenry':     { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_curtis_creek':   { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_bodkin_creek':   { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_rock_creek':     { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_jones_falls':    { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'maryland_gwynns_falls':   { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  'baltimore':               { stationId: '8574680', name: 'Baltimore (Fort McHenry)',  lat: 39.267, lng: -76.579 },
  // Western Shore
  'maryland_severn_river':   { stationId: '8575512', name: 'Annapolis',                lat: 38.983, lng: -76.482 },
  'maryland_south_river':    { stationId: '8575512', name: 'Annapolis',                lat: 38.983, lng: -76.482 },
  'maryland_magothy_river':  { stationId: '8575512', name: 'Annapolis',                lat: 38.983, lng: -76.482 },
  'annapolis':               { stationId: '8575512', name: 'Annapolis',                lat: 38.983, lng: -76.482 },
  'maryland_patuxent_river': { stationId: '8577330', name: 'Solomons Island',          lat: 38.317, lng: -76.451 },
  'patuxent':                { stationId: '8577330', name: 'Solomons Island',          lat: 38.317, lng: -76.451 },
  // Upper Bay
  'maryland_sassafras_river':{ stationId: '8573927', name: 'Chesapeake City',          lat: 39.527, lng: -75.810 },
  'upper_bay':               { stationId: '8573927', name: 'Chesapeake City',          lat: 39.527, lng: -75.810 },
  // Mid-Bay Eastern Shore
  'maryland_chester_river':  { stationId: '8573364', name: 'Tolchester Beach',         lat: 39.214, lng: -76.245 },
  'lower_bay':               { stationId: '8573364', name: 'Tolchester Beach',         lat: 39.214, lng: -76.245 },
  'maryland_choptank_river': { stationId: '8571892', name: 'Cambridge',                lat: 38.573, lng: -76.068 },
  'cambridge':               { stationId: '8571892', name: 'Cambridge',                lat: 38.573, lng: -76.068 },
  // Lower Eastern Shore
  'maryland_nanticoke_river':{ stationId: '8571892', name: 'Cambridge',                lat: 38.573, lng: -76.068 },
  'maryland_wicomico_river': { stationId: '8571892', name: 'Cambridge',                lat: 38.573, lng: -76.068 },
  'maryland_pocomoke_river': { stationId: '8570283', name: 'Ocean City Inlet',         lat: 38.328, lng: -75.091 },
  'coastal_bays':            { stationId: '8570283', name: 'Ocean City Inlet',         lat: 38.328, lng: -75.091 },
  // Delaware
  'delaware_christina_river':{ stationId: '8551762', name: 'Delaware City',            lat: 39.582, lng: -75.588 },
  'delaware_brandywine':     { stationId: '8551762', name: 'Delaware City',            lat: 39.582, lng: -75.588 },
  'delaware_appoquinimink':  { stationId: '8551762', name: 'Delaware City',            lat: 39.582, lng: -75.588 },
  'delaware_st_jones':       { stationId: '8551910', name: 'Reedy Point',             lat: 39.558, lng: -75.573 },
  'delaware_broadkill':      { stationId: '8557380', name: 'Lewes',                   lat: 38.783, lng: -75.119 },
  'delaware_indian_river':   { stationId: '8557380', name: 'Lewes',                   lat: 38.783, lng: -75.119 },
  'delaware_rehoboth_bay':   { stationId: '8557380', name: 'Lewes',                   lat: 38.783, lng: -75.119 },
  'delaware_nanticoke_de':   { stationId: '8571892', name: 'Cambridge',                lat: 38.573, lng: -76.068 },
  // DC
  'dc_potomac':              { stationId: '8594900', name: 'Washington, DC',           lat: 38.873, lng: -77.021 },
  'dc_anacostia':            { stationId: '8594900', name: 'Washington, DC',           lat: 38.873, lng: -77.021 },
  'dc_rock_creek':           { stationId: '8594900', name: 'Washington, DC',           lat: 38.873, lng: -77.021 },
  'dc_oxon_run':             { stationId: '8594900', name: 'Washington, DC',           lat: 38.873, lng: -77.021 },
  'dc_watts_branch':         { stationId: '8594900', name: 'Washington, DC',           lat: 38.873, lng: -77.021 },
  'dc_hickey_run':           { stationId: '8594900', name: 'Washington, DC',           lat: 38.873, lng: -77.021 },
  // Virginia
  'virginia_elizabeth':      { stationId: '8638610', name: 'Sewells Point',            lat: 36.947, lng: -76.330 },
  'virginia_elizabeth_river':{ stationId: '8638610', name: 'Sewells Point',            lat: 36.947, lng: -76.330 },
  'virginia_lynnhaven':      { stationId: '8638863', name: 'CBBT',                    lat: 36.967, lng: -76.114 },
  'virginia_back_bay':       { stationId: '8638863', name: 'CBBT',                    lat: 36.967, lng: -76.114 },
  'virginia_james_lower':    { stationId: '8638610', name: 'Sewells Point',            lat: 36.947, lng: -76.330 },
  'virginia_james_river':    { stationId: '8638610', name: 'Sewells Point',            lat: 36.947, lng: -76.330 },
  'virginia_york_river':     { stationId: '8637689', name: 'Yorktown',                lat: 37.227, lng: -76.479 },
  'virginia_rappahannock':   { stationId: '8635750', name: 'Lewisetta',               lat: 37.996, lng: -76.464 },
  'virginia_rappahannock_tidal': { stationId: '8635750', name: 'Lewisetta',            lat: 37.996, lng: -76.464 },
};

async function coopsFetch(stationId: string, product: string, hours = 24) {
  const url = new URL(COOPS_BASE);
  url.searchParams.set('station', stationId);
  url.searchParams.set('product', product);
  url.searchParams.set('date', 'latest');
  url.searchParams.set('units', 'metric');
  url.searchParams.set('time_zone', 'gmt');
  url.searchParams.set('format', 'json');
  url.searchParams.set('application', 'pearl_platform');

  console.log('[CO-OPS]', url.toString());

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'PEARL Platform (contact: info@localseafoodprojects.com)' },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[CO-OPS] Error ${res.status}: ${body.slice(0, 300)}`);
    return { error: `CO-OPS API error: ${res.status}`, detail: body.slice(0, 200) };
  }
  return res.json();
}

async function usgsOgcFetch(collection: string, params: Record<string, string> = {}) {
  const url = new URL(`${USGS_OGC_BASE}/collections/${collection}/items`);
  url.searchParams.set('f', 'json');
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim() !== '') url.searchParams.set(k, v);
  }

  console.log('[USGS-OGC]', url.toString());

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[USGS-OGC] Error ${res.status}: ${body.slice(0, 300)}`);
    return { error: `USGS OGC API error: ${res.status}`, detail: body.slice(0, 200) };
  }
  return res.json();
}

// Parse CSV text to array of objects
function csvToJson(csv: string): any[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const results: any[] = [];
  for (let i = 1; i < lines.length && i < 200; i++) { // Cap at 200 rows
    const values = parseCSVLine(lines[i]);
    const obj: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] || '';
    }
    results.push(obj);
  }
  return results;
}

// Handle quoted CSV fields properly
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

// ─── USGS Instantaneous Values Helper ───────────────────────────────────────
// Real-time sensor data updated every 15 minutes. No API key needed.
// Parameter codes: 00300=DO, 00010=Temp, 00400=pH, 00095=Conductivity,
//                  63680=Turbidity, 00060=Discharge, 00065=Gage Height,
//                  00480=Salinity, 00600=TN, 00665=TP
async function usgsIvFetch(params: Record<string, string> = {}) {
  const url = new URL(USGS_IV_BASE);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 60 }, // Cache only 1 minute — this is real-time data
  });
  if (!res.ok) {
    return { error: `USGS IV API error: ${res.status} ${res.statusText}` };
  }
  return res.json();
}

// Find USGS sites in a bounding box that have real-time data
async function usgsSiteFetch(params: Record<string, string> = {}) {
  const url = new URL(USGS_SITE_BASE);
  url.searchParams.set('format', 'mapper');
  url.searchParams.set('siteOutput', 'expanded');
  url.searchParams.set('outputDataTypeCd', 'iv'); // Only sites with instantaneous values
  url.searchParams.set('siteStatus', 'active');
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 }, // Cache 1 hour — site list rarely changes
  });
  if (!res.ok) {
    return { error: `USGS Site API error: ${res.status} ${res.statusText}` };
  }
  return res.json();
}

// ─── ATTAINS Helper (EPA 303(d) / Assessment Data) ────────────────────────────
// API docs: https://www.epa.gov/waterdata/get-data-access-public-attains-data
async function attainsFetch(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${ATTAINS_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim() !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store', // ATTAINS responses too large for Next.js fetch cache
    signal: AbortSignal.timeout(120_000), // 2 min for ad-hoc queries
  });
  if (!res.ok) {
    return { error: `ATTAINS API error: ${res.status} ${res.statusText}` };
  }
  return res.json();
}

// ─── ECHO Helper (EPA Enforcement & Compliance) ───────────────────────────────
// API docs: https://echo.epa.gov/tools/web-services
async function echoFetch(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${ECHO_BASE}/${endpoint}`);
  url.searchParams.set('output', 'JSON');
  for (const [k, v] of Object.entries(params)) {
    if (v && v.trim() !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 }, // Cache 1h
  });
  if (!res.ok) {
    return { error: `ECHO API error: ${res.status} ${res.statusText}` };
  }
  return res.json();
}

// ─── EJScreen Helper (point query) ────────────────────────────────────────────
async function ejscreenFetch(lat: number, lng: number) {
  // Primary: EPA EJScreen REST broker (may be offline under current admin)
  // Fallback: PEDP mirror at pedp-ejscreen.azurewebsites.net
  const urls = [
    `${EJSCREEN_BASE}?namestr=&geometry=${lng},${lat}&distance=1&unit=9035&aession=&f=json`,
    `https://pedp-ejscreen.azurewebsites.net/mapper/ejscreenRESTbroker1.aspx?namestr=&geometry=${lng},${lat}&distance=1&unit=9035&f=json`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 604800 }, // Cache 7 days — EJScreen is static annually
      });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) return data;
      }
    } catch { /* try next URL */ }
  }
  return { error: 'EJScreen unavailable (both EPA and PEDP mirrors failed)' };
}

// ─── GET handler ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const action = sp.get('action');

  try {
    switch (action) {

      // ════════════════════════════════════════════════════════════════════════
      // WATER REPORTER ACTIONS (existing)
      // ════════════════════════════════════════════════════════════════════════

      case 'datasets': {
        const data = await wrFetch('/datasets', {
          bbox: sp.get('bbox') || '',
          huc: sp.get('huc') || '',
          point: sp.get('point') || '',
          radius: sp.get('radius') || '',
          limit: sp.get('limit') || '100',
          page: sp.get('page') || '1',
        });
        return NextResponse.json(data);
      }

      case 'stations': {
        const sets = sp.get('sets') || sp.get('dataset_id') || '';
        const data = await wrFetch('/stations', {
          sets,
          huc: sp.get('huc') || '',
          bbox: sp.get('bbox') || '',
          geo_format: 'xy',
        });
        return NextResponse.json(data);
      }

      case 'parameters': {
        const data = await wrFetch('/parameters', {
          dataset_id: sp.get('dataset_id') || '',
          station_id: sp.get('station_id') || '',
        });
        return NextResponse.json(data);
      }

      case 'readings': {
        const data = await wrFetch('/readings', {
          station_id: sp.get('station_id') || '',
          parameter_id: sp.get('parameter_id') || '',
          limit: sp.get('limit') || '50',
          start_date: sp.get('start_date') || '',
          end_date: sp.get('end_date') || '',
          colorize: 'true',
          label: 'true',
        });
        return NextResponse.json(data);
      }

      case 'nearest': {
        const data = await wrFetch('/stations/nearest', {
          lng: sp.get('lng') || '',
          lat: sp.get('lat') || '',
          radius: sp.get('radius') || '5000',
          geo_format: 'xy',
          nn: 'true',
        });
        return NextResponse.json(data);
      }

      case 'watersheds': {
        const data = await wrFetch('/watersheds/intersect', {
          lng: sp.get('lng') || '',
          lat: sp.get('lat') || '',
        });
        return NextResponse.json(data);
      }

      // ════════════════════════════════════════════════════════════════════════
      // CBP DATAHUB ACTIONS
      // ════════════════════════════════════════════════════════════════════════

      // List all CBP monitoring stations
      case 'cbp-stations': {
        const data = await cbpFetch('/api.json/Station');
        return NextResponse.json({ source: 'cbp', data });
      }

      // List water quality programs
      case 'cbp-programs': {
        const data = await cbpFetch('/api.json/WaterQuality/Programs');
        return NextResponse.json({ source: 'cbp', data });
      }

      // List water quality projects
      case 'cbp-projects': {
        const data = await cbpFetch('/api.json/WaterQuality/Projects');
        return NextResponse.json({ source: 'cbp', data });
      }

      // Get HUC8 regions
      case 'cbp-huc8': {
        const data = await cbpFetch('/api.json/HUC8');
        return NextResponse.json({ source: 'cbp', data });
      }

      // Get HUC12 sub-regions
      case 'cbp-huc12': {
        const data = await cbpFetch('/api.json/HUC12');
        return NextResponse.json({ source: 'cbp', data });
      }

      // Get Bay Segments
      case 'cbp-segments': {
        const data = await cbpFetch('/api.json/CBSeg2003');
        return NextResponse.json({ source: 'cbp', data });
      }

      // Get substances/parameters
      case 'cbp-substances': {
        const data = await cbpFetch('/api.json/Subtances');
        return NextResponse.json({ source: 'cbp', data });
      }

      // Get data streams
      case 'cbp-datastreams': {
        const data = await cbpFetch('/api.json/DataStreams');
        return NextResponse.json({ source: 'cbp', data });
      }

      // Get water quality data for a station (filtered by date range)
      // Example: ?action=cbp-waterquality&station=CB3.3C&startDate=2024-01-01&endDate=2025-01-01
      case 'cbp-waterquality': {
        const station = sp.get('station') || '';
        const startDate = sp.get('startDate') || '';
        const endDate = sp.get('endDate') || '';
        const program = sp.get('program') || '';
        const format = 'json';

        // Build the data download URL with query parameters
        let path = `/api.${format}/WaterQuality`;
        const queryParts: string[] = [];
        if (station) queryParts.push(`station=${encodeURIComponent(station)}`);
        if (startDate) queryParts.push(`startDate=${encodeURIComponent(startDate)}`);
        if (endDate) queryParts.push(`endDate=${encodeURIComponent(endDate)}`);
        if (program) queryParts.push(`program=${encodeURIComponent(program)}`);
        if (queryParts.length) path += `?${queryParts.join('&')}`;

        const data = await cbpFetch(path);
        return NextResponse.json({ source: 'cbp', data });
      }

      // ════════════════════════════════════════════════════════════════════════
      // WQP STATION SEARCH + USGS DAILY VALUES (national WQ coverage)
      // ════════════════════════════════════════════════════════════════════════

      // Search WQP monitoring stations (still works)
      case 'wqp-stations': {
        const params: Record<string, string> = {};
        const passthrough = ['statecode', 'countycode', 'huc', 'siteType',
          'organization', 'siteid', 'characteristicName', 'bBox',
          'within', 'lat', 'long', 'startDateLo', 'startDateHi',
          'sampleMedia', 'sorted', 'zip'];
        for (const key of passthrough) {
          const val = sp.get(key);
          if (val) params[key] = val;
        }
        const data = await wqpStationFetch(params);
        if ('error' in data) return NextResponse.json({ source: 'wqp', ...data }, { status: 502 });
        return NextResponse.json({ source: 'wqp', data, count: Array.isArray(data) ? data.length : 0 });
      }

      // USGS Samples Data API (discrete WQ — national coverage)
      // Example: ?action=usgs-samples&monitoringLocationIdentifier=USGS-01493112&usgsPCode=00300&activityStartDateLower=2023-01-01
      // Example: ?action=usgs-samples&hydrologicUnit=02060005&usgsPCode=00300&activityStartDateLower=2023-01-01
      // Example: ?action=usgs-samples&boundingBox=-76.2,39.1,-75.9,39.4&usgsPCode=00300
      case 'usgs-samples': {
        const params: Record<string, string> = {};
        const passthrough = ['monitoringLocationIdentifier', 'usgsPCode', 'characteristicGroup',
          'characteristic', 'activityStartDateLower', 'activityStartDateUpper',
          'activityMediaName', 'hydrologicUnit', 'boundingBox', 'stateFips',
          'countryFips', 'countyFips', 'siteTypeCode', 'pointLocationLatitude',
          'pointLocationLongitude', 'pointLocationWithinMiles'];
        for (const key of passthrough) {
          const val = sp.get(key);
          if (val) params[key] = val;
        }
        const data = await usgsSamplesFetch('/results/narrow', params);
        if ('error' in data) return NextResponse.json({ source: 'usgs-samples', ...data }, { status: 502 });
        return NextResponse.json({ source: 'usgs-samples', data, count: Array.isArray(data) ? data.length : 0 });
      }

      // USGS Samples summary for a station
      // Example: ?action=usgs-samples-summary&monitoringLocationIdentifier=USGS-01493112
      case 'usgs-samples-summary': {
        const monLocId = sp.get('monitoringLocationIdentifier') || '';
        if (!monLocId) return NextResponse.json({ error: 'monitoringLocationIdentifier required' }, { status: 400 });
        const data = await usgsSamplesFetch(`/summary/${monLocId}`, {});
        if ('error' in data) return NextResponse.json({ source: 'usgs-samples', ...data }, { status: 502 });
        return NextResponse.json({ source: 'usgs-samples', data, count: Array.isArray(data) ? data.length : 0 });
      }

      // ════════════════════════════════════════════════════════════════════════
      // MARACOOS ERDDAP — MD DNR CONTINUOUS MONITORING (Eyes on the Bay)
      // ════════════════════════════════════════════════════════════════════════

      // Get latest reading from a specific MDDNR station
      // Example: ?action=erddap-latest&datasetId=mddnr_Jug_Bay
      // Example: ?action=erddap-latest&region=patuxent
      case 'erddap-latest': {
        const datasetId = sp.get('datasetId') || '';
        const regionKey = sp.get('region') || '';
        const station = datasetId
          ? { datasetId, name: datasetId, lat: 0, lng: 0 }
          : ERDDAP_STATION_MAP[regionKey];
        if (!station) {
          return NextResponse.json({
            error: 'Provide datasetId or region',
            availableRegions: Object.keys(ERDDAP_STATION_MAP),
          }, { status: 400 });
        }
        const data = await erddapFetch(station.datasetId);
        if ('error' in data) return NextResponse.json({ source: 'erddap', ...data }, { status: 502 });
        return NextResponse.json({ source: 'erddap', station: station.name, data });
      }

      // Get time range from an MDDNR station
      // Example: ?action=erddap-range&datasetId=mddnr_Jug_Bay&start=2025-01-01&end=2025-02-01
      case 'erddap-range': {
        const dsId = sp.get('datasetId') || '';
        const regionKey2 = sp.get('region') || '';
        const station2 = dsId
          ? { datasetId: dsId, name: dsId, lat: 0, lng: 0 }
          : ERDDAP_STATION_MAP[regionKey2];
        if (!station2) {
          return NextResponse.json({ error: 'Provide datasetId or region' }, { status: 400 });
        }
        const start = sp.get('start') || '';
        const end = sp.get('end') || '';
        let constraints = '&orderByLimit("500,time/desc")';
        if (start) constraints += `&time>=${start}T00:00:00Z`;
        if (end) constraints += `&time<=${end}T23:59:59Z`;
        const data = await erddapFetch(station2.datasetId, constraints);
        if ('error' in data) return NextResponse.json({ source: 'erddap', ...data }, { status: 502 });
        return NextResponse.json({ source: 'erddap', station: station2.name, data, count: Array.isArray(data) ? data.length : 0 });
      }

      // List all mapped ERDDAP stations
      case 'erddap-stations': {
        return NextResponse.json({
          source: 'erddap',
          provider: 'MARACOOS / MD DNR Eyes on the Bay',
          stations: Object.entries(ERDDAP_STATION_MAP).map(([region, s]) => ({
            region, ...s, url: `${ERDDAP_BASE}/${s.datasetId}.html`
          })),
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // NOAA CO-OPS — Tides, Water Temperature, Conductivity
      // ════════════════════════════════════════════════════════════════════════

      // Get latest reading from a CO-OPS station
      // Example: ?action=coops-latest&stationId=8574680
      // Example: ?action=coops-latest&region=maryland_middle_branch
      case 'coops-latest': {
        const stationId = sp.get('stationId') || '';
        const regionKey = sp.get('region') || '';
        const station = stationId
          ? { stationId, name: stationId, lat: 0, lng: 0 }
          : COOPS_STATION_MAP[regionKey];
        if (!station) {
          return NextResponse.json({
            error: 'Provide stationId or region',
            availableRegions: Object.keys(COOPS_STATION_MAP),
          }, { status: 400 });
        }

        // Fetch water_temperature and conductivity in parallel
        const [tempData, condData, waterLevelData] = await Promise.all([
          coopsFetch(station.stationId, 'water_temperature'),
          coopsFetch(station.stationId, 'conductivity'),
          coopsFetch(station.stationId, 'water_level'),
        ]);

        return NextResponse.json({
          source: 'noaa-coops',
          station: station.name,
          stationId: station.stationId,
          water_temperature: tempData,
          conductivity: condData,
          water_level: waterLevelData,
        });
      }

      // Get specific CO-OPS product for a station
      // Example: ?action=coops-product&stationId=8574680&product=water_temperature
      case 'coops-product': {
        const sid = sp.get('stationId') || '8574680';
        const product = sp.get('product') || 'water_temperature';
        const data = await coopsFetch(sid, product);
        if ('error' in data) return NextResponse.json({ source: 'noaa-coops', ...data }, { status: 502 });
        return NextResponse.json({ source: 'noaa-coops', stationId: sid, product, data });
      }

      // List all mapped CO-OPS stations
      case 'coops-stations': {
        return NextResponse.json({
          source: 'noaa-coops',
          provider: 'NOAA Center for Operational Oceanographic Products and Services',
          stations: Object.entries(COOPS_STATION_MAP).map(([region, s]) => ({
            region, ...s, url: `https://tidesandcurrents.noaa.gov/stationhome.html?id=${s.stationId}`
          })),
        });
      }

      // USGS Daily Values (OGC API) — continuous sensor data
      case 'usgs-daily': {
        const params: Record<string, string> = {};
        const passthrough = ['monitoring_location_id', 'parameter_code', 'statistic_id',
          'datetime', 'bbox', 'state_name', 'limit', 'offset'];
        for (const key of passthrough) {
          const val = sp.get(key);
          if (val) params[key] = val;
        }
        if (!params.limit) params.limit = '50';
        const data = await usgsOgcFetch('daily', params);
        if ('error' in data) return NextResponse.json({ source: 'usgs-daily', ...data }, { status: 502 });
        return NextResponse.json({ source: 'usgs-daily', data });
      }

      // USGS Monitoring Locations (national) via OGC API
      // Example: ?action=usgs-locations&state_name=Maryland&site_type_code=ST&limit=20
      case 'usgs-locations': {
        const params: Record<string, string> = {};
        const passthrough = ['monitoring_location_id', 'state_name', 'county_name',
          'site_type_code', 'bbox', 'limit', 'offset', 'hydrologic_unit_code'];
        for (const key of passthrough) {
          const val = sp.get(key);
          if (val) params[key] = val;
        }
        if (!params.limit) params.limit = '50';
        const data = await usgsOgcFetch('monitoring-locations', params);
        if ('error' in data) return NextResponse.json({ source: 'usgs-ogc', ...data }, { status: 502 });
        return NextResponse.json({ source: 'usgs-ogc', data });
      }

      // WQP Results — true national multi-provider results (EPA, state, tribal, local via STORET/STEWARDS)
      // Example: ?action=wqp-results&characteristicName=Dissolved+oxygen+(DO)&lat=39.27&long=-76.58&within=15&startDateLo=2024-01-01
      // Example: ?action=wqp-results&characteristicName=Phosphorus&statecode=US:24&startDateLo=2024-01-01
      // Example: ?action=wqp-results&characteristicName=Nitrogen&huc=02060003&startDateLo=2024-01-01
      case 'wqp-results': {
        const params: Record<string, string> = {};
        const passthrough = ['characteristicName', 'characteristicType', 'statecode', 'countycode',
          'huc', 'siteType', 'organization', 'siteid', 'sampleMedia',
          'startDateLo', 'startDateHi', 'lat', 'long', 'within',
          'bBox', 'providers', 'sorted', 'dataProfile'];
        for (const key of passthrough) {
          const val = sp.get(key);
          if (val) params[key] = val;
        }
        // Default to Water sample media if not specified
        if (!params.sampleMedia) params.sampleMedia = 'Water';
        const data = await wqpResultsFetch(params);
        if ('error' in data) return NextResponse.json({ source: 'wqp', ...data }, { status: 502 });
        return NextResponse.json({ source: 'wqp', data, count: Array.isArray(data) ? data.length : 0 });
      }

      // ════════════════════════════════════════════════════════════════════════
      // USGS REAL-TIME (Instantaneous Values) ACTIONS
      // ════════════════════════════════════════════════════════════════════════

      // Get real-time sensor data by bounding box
      // Example: ?action=usgs-iv&bBox=-76.7,39.2,-76.5,39.35&parameterCd=00300,00010,00400
      case 'usgs-iv': {
        const data = await usgsIvFetch({
          bBox: sp.get('bBox') || sp.get('bbox') || '',
          huc: sp.get('huc') || '',
          sites: sp.get('sites') || '',
          stateCd: sp.get('stateCd') || '',
          parameterCd: sp.get('parameterCd') || '00300,00010,00400,00095,63680',
          period: sp.get('period') || 'PT2H',
          siteType: sp.get('siteType') || 'ST,ES', // Streams and Estuaries
          siteStatus: 'active',
        });
        return NextResponse.json({ source: 'usgs-iv', data });
      }

      // Find USGS sites with real-time sensors in a bbox
      // Example: ?action=usgs-sites&bBox=-76.7,39.2,-76.5,39.35
      case 'usgs-sites': {
        const data = await usgsSiteFetch({
          bBox: sp.get('bBox') || sp.get('bbox') || '',
          huc: sp.get('huc') || '',
          stateCd: sp.get('stateCd') || '',
          siteType: sp.get('siteType') || 'ST,ES',
          hasDataTypeCd: 'iv',
        });
        return NextResponse.json({ source: 'usgs', data });
      }

      // Get real-time data for a specific USGS site
      // Example: ?action=usgs-site-iv&sites=01589440&period=PT4H
      case 'usgs-site-iv': {
        const sites = sp.get('sites') || '';
        if (!sites) {
          return NextResponse.json({ error: 'sites parameter required' }, { status: 400 });
        }
        const data = await usgsIvFetch({
          sites,
          parameterCd: sp.get('parameterCd') || '00300,00010,00400,00095,63680,00060,00065,00480',
          period: sp.get('period') || 'PT2H',
        });
        return NextResponse.json({ source: 'usgs-iv', data });
      }

      // ════════════════════════════════════════════════════════════════════════
      // ════════════════════════════════════════════════════════════════════════

      // Multi-source query: tries BWB → CBP → WQP and returns best available
      // Example: ?action=unified&lat=39.263&lng=-76.623&regionId=maryland_middle_branch
      case 'unified': {
        const lat = sp.get('lat') || '';
        const lng = sp.get('lng') || '';
        const huc = sp.get('huc') || '';
        const stationId = sp.get('bwbStationId') || '';
        const datasetId = sp.get('bwbDatasetId') || '';

        const results: any = { sources: [] };

        // 1. Try BWB (Water Reporter) — hardcoded station
        if (stationId && datasetId) {
          try {
            const wrData = await wrFetch('/parameters', {
              dataset_id: datasetId,
              station_id: stationId,
            });
            if (wrData.features?.length) {
              results.waterReporter = {
                source: 'Blue Water Baltimore',
                sourceShort: 'BWB',
                stationId: stationId,
                parameters: wrData.features,
              };
              results.sources.push('BWB');
            }
          } catch (e) { /* skip */ }
        }

        // 2. Try WQP (EPA + USGS) for the area
        if (huc) {
          try {
            const wqpData = await wqpStationFetch({
              huc: huc,
              siteType: 'Stream',
              sorted: 'yes',
            });
            if (Array.isArray(wqpData) && wqpData.length > 0) {
              results.wqp = {
                source: 'EPA/USGS Water Quality Portal',
                sourceShort: 'WQP',
                stationCount: wqpData.length,
                stations: wqpData.slice(0, 10), // Top 10 nearest
              };
              results.sources.push('WQP');
            }
          } catch (e) { /* skip */ }
        }

        // 3. Try CBP DataHub
        try {
          const cbpStations = await cbpFetch('/api.json/Station');
          if (Array.isArray(cbpStations) && cbpStations.length > 0) {
            results.cbp = {
              source: 'Chesapeake Bay Program',
              sourceShort: 'CBP',
              stationCount: cbpStations.length,
              available: true,
            };
            results.sources.push('CBP');
          }
        } catch (e) { /* skip */ }

        return NextResponse.json(results);
      }

      // ════════════════════════════════════════════════════════════════════════
      // EPA ATTAINS — National 303(d) / Assessment Data
      // ════════════════════════════════════════════════════════════════════════

      // Get assessments for a state (or search by waterbody name)
      // Example: ?action=attains-assessments&statecode=CA&assessmentUnitName=San+Francisco
      case 'attains-assessments': {
        const params: Record<string, string> = {};
        // NOTE: The ATTAINS "assessments" endpoint uses "state" (not "stateCode")
        if (sp.get('statecode')) params.state = sp.get('statecode')!.toUpperCase();
        if (sp.get('organizationId')) params.organizationId = sp.get('organizationId')!;
        if (sp.get('assessmentUnitIdentifier')) params.assessmentUnitIdentifier = sp.get('assessmentUnitIdentifier')!;
        if (sp.get('assessmentUnitName')) params.assessmentUnitName = sp.get('assessmentUnitName')!;
        if (sp.get('useAttainment')) params.useSupport = sp.get('useAttainment')!;
        if (sp.get('parameterName')) params.parameter = sp.get('parameterName')!;
        const data = await attainsFetch('assessments', params);
        if (data?.error) return NextResponse.json({ source: 'attains', endpoint: 'assessments', ...data }, { status: 502 });
        return NextResponse.json({ source: 'attains', endpoint: 'assessments', data });
      }

      // State-level impairment summary
      // Example: ?action=attains-state-summary&statecode=CA
      case 'attains-state-summary': {
        const stateCode = (sp.get('statecode') || '').toUpperCase();
        const STATE_ORG: Record<string, string> = {
          AL: 'ADEM', AK: '21AKAL', AZ: 'AZDEQ', AR: 'ARDEQ', CA: 'SWRCB', CO: 'CDPHE',
          CT: 'CT_DEP', DE: 'DNRECWQ', DC: 'DOEE', FL: 'FLASRCE', GA: 'GAEPD', HI: 'HI_DOH',
          ID: 'IDEQ', IL: 'IL_EPA', IN: 'IDEM', IA: 'IADNR', KS: 'KDHE', KY: 'KDOW',
          LA: 'LADEQ', ME: 'MEDEP', MD: 'MDDNR', MA: 'MADEP', MI: 'MIDEQ', MN: 'MNPCA',
          MS: 'MSDEQ', MO: 'MDNR', MT: 'MTDEQ', NE: 'NDEQ', NV: 'NVDEP', NH: 'NHDES',
          NJ: 'NJDEP', NM: 'NMED', NY: 'NYDEC', NC: 'NC_DEQD', ND: 'NDDH', OH: 'OHEPAS',
          OK: 'OWRB', OR: 'ODEQ', PA: 'PADEP', RI: 'RIDEM', SC: 'SCDHEC', SD: 'SDDENR',
          TN: 'TDEC', TX: 'TCEQMAIN', UT: 'UTAHDWQ', VT: 'VTANR', VA: 'VADEQ',
          WA: 'WAECY', WV: 'WVDEP', WI: 'WIDNR', WY: 'WYDEQ',
        };
        const orgId = sp.get('organizationId') || STATE_ORG[stateCode] || '';
        if (!orgId) {
          return NextResponse.json({ error: 'Provide statecode or organizationId' }, { status: 400 });
        }
        const data = await attainsFetch('stateSummary', {
          organizationId: orgId,
          reportingCycle: sp.get('reportingCycle') || '',
        });
        return NextResponse.json({ source: 'attains', endpoint: 'stateSummary', state: stateCode, data });
      }

      // TMDL/actions lookup
      // Example: ?action=attains-actions&statecode=MD&type=TMDL
      case 'attains-actions': {
        const params: Record<string, string> = {};
        // NOTE: The ATTAINS "actions" endpoint uses "stateCode" (camelCase)
        if (sp.get('statecode')) params.stateCode = sp.get('statecode')!.toUpperCase();
        if (sp.get('organizationId')) params.organizationId = sp.get('organizationId')!;
        if (sp.get('type')) params.type = sp.get('type')!;
        params.limit = sp.get('limit') || '50';
        const data = await attainsFetch('actions', params);
        return NextResponse.json({ source: 'attains', endpoint: 'actions', data });
      }

      // Simplified impaired waterbodies for NCC (flattened)
      // Example: ?action=attains-impaired&statecode=CA&limit=100
      case 'attains-impaired': {
        const stateCode = (sp.get('statecode') || '').toUpperCase();
        if (!stateCode) {
          return NextResponse.json({ error: 'statecode required' }, { status: 400 });
        }
        const data = await attainsFetch('assessments', {
          state: stateCode,
          useSupport: 'N',
        });
        // Flatten org-level containers → individual assessments
        const orgItems = data?.items || [];
        const allAssessments = orgItems.flatMap((org: any) => org?.assessments || []);
        const simplified = allAssessments.map((item: any) => {
          const auId = (item?.assessmentUnitIdentifier || '').trim();
          // Primary: parameters[].parameterName
          const causes: string[] = (item?.parameters || [])
            .map((p: any) => (p?.parameterName || '').trim())
            .filter((n: string) => n && n !== 'CAUSE UNKNOWN' && n !== 'CAUSE UNKNOWN - IMPAIRED BIOTA');
          // Fallback: useAttainments path
          if (causes.length === 0) {
            const legacy = (item?.useAttainments || []).flatMap((u: any) =>
              (u?.threatenedActivities || []).concat(u?.impairedActivities || [])
                .flatMap((a: any) => (a?.associatedCauses || []).map((c: any) => c?.causeName))
            ).filter(Boolean);
            causes.push(...legacy);
          }
          return {
            id: auId,
            name: auId,
            state: stateCode,
            status: item?.overallStatus || '',
            category: item?.epaIRCategory || '',
            cycle: item?.cycleLastAssessedText || '',
            causes: [...new Set(causes)],
            causeCount: new Set(causes).size,
          };
        });
        return NextResponse.json({
          source: 'attains', state: stateCode,
          total: data?.count || simplified.length,
          waterbodies: simplified,
        });
      }

      // Bulk state assessments — fetches ALL assessment units (Cat 1-5) for a state
      // Returns simplified list with category, causes, status for each waterbody
      // Example: ?action=attains-bulk&statecode=MD&limit=1000
      case 'attains-bulk': {
        const stateCode = (sp.get('statecode') || '').toUpperCase();
        if (!stateCode) {
          return NextResponse.json({ error: 'statecode required' }, { status: 400 });
        }
        // NOTE: ATTAINS "assessments" endpoint uses "state" (not "stateCode")
        // and does not support a "limit" parameter
        const data = await attainsFetch('assessments', {
          state: stateCode,
        });
        if (data?.error) {
          return NextResponse.json({ source: 'attains', state: stateCode, error: data.error, waterbodies: [] });
        }
        // ATTAINS returns items as org-level containers: items[] → each has assessments[]
        // We need to flatten: items[].assessments[] → single array of assessment objects
        const orgItems = data?.items || [];
        const allAssessments = orgItems.flatMap((org: any) => org?.assessments || []);
        // Debug: if no assessments found, include first item's keys to identify correct nesting
        if (allAssessments.length === 0 && orgItems.length > 0) {
          const firstItem = orgItems[0];
          return NextResponse.json({
            source: 'attains', state: stateCode,
            error: 'No assessments found in nested structure',
            _debug: {
              itemCount: orgItems.length,
              firstItemKeys: Object.keys(firstItem || {}),
              firstItemSample: JSON.stringify(firstItem).slice(0, 500),
            },
            waterbodies: [],
          });
        }
        const waterbodies = allAssessments.map((item: any) => {
          // ATTAINS API: fields are directly on the assessment object (not nested under .assessmentUnit)
          const auId = (item?.assessmentUnitIdentifier || '').trim();

          // Extract causes from parameters[] (primary) and useAttainments[] (fallback)
          const causesSet = new Set<string>();
          for (const p of (item?.parameters || [])) {
            const pName = (p?.parameterName || '').trim();
            if (pName && pName !== 'CAUSE UNKNOWN' && pName !== 'CAUSE UNKNOWN - IMPAIRED BIOTA') {
              causesSet.add(pName);
            }
            if (causesSet.size >= 5) break;
          }
          // Fallback: useAttainments path (may exist on some entries)
          if (causesSet.size === 0) {
            outer: for (const u of (item?.useAttainments || [])) {
              for (const a of (u?.threatenedActivities || []).concat(u?.impairedActivities || [])) {
                for (const c of (a?.associatedCauses || [])) {
                  if (c?.causeName) causesSet.add(c.causeName);
                  if (causesSet.size >= 5) break outer;
                }
              }
            }
          }

          const category = item?.epaIRCategory || '';
          let alertLevel: string = 'none';
          if (category.includes('5')) alertLevel = 'high';
          else if (category.includes('4')) alertLevel = 'medium';
          else if (category.includes('3')) alertLevel = 'low';

          return {
            id: auId,
            name: auId, // Name resolved by cache builder; bulk endpoint uses ID
            category,
            alertLevel,
            causes: [...causesSet],
            causeCount: causesSet.size,
          };
        });
        return NextResponse.json({
          source: 'attains', state: stateCode,
          total: data?.count || waterbodies.length,
          fetched: waterbodies.length,
          waterbodies,
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // ATTAINS National Cache — pre-built buffer for all 51 states
      // Fetches in background, serves instantly on repeat requests
      // ════════════════════════════════════════════════════════════════════════

      // Full cache with waterbody arrays — READ ONLY, does NOT trigger build
      // Example: ?action=attains-national-cache
      case 'attains-national-cache': {
        const data = getAttainsCache();
        return NextResponse.json(data, {
          headers: {
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          },
        });
      }

      // Trigger cache build (call once from terminal: curl localhost:3000/api/water-data?action=attains-build)
      // Example: ?action=attains-build
      case 'attains-build': {
        const status = getCacheStatus();
        if (status.status === 'building') {
          return NextResponse.json({ message: 'Build already in progress', ...status });
        }
        if (status.status === 'ready' && status.loadedStates >= status.totalStates) {
          return NextResponse.json({ message: 'Cache already complete', ...status });
        }
        // Trigger build — non-blocking, returns immediately
        // Incremental: only fetches states not already cached
        triggerAttainsBuild();
        return NextResponse.json({
          message: `Build started (${status.loadedStates} already cached, fetching ${status.totalStates - status.loadedStates} remaining)`,
          ...getCacheStatus(),
        });
      }

      // Lightweight status check — for polling during build (no waterbody data)
      // Example: ?action=attains-national-status
      case 'attains-national-status': {
        const status = getCacheStatus();
        return NextResponse.json(status, {
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
      }

      // Summary with counts per state but no waterbody arrays (~5KB vs ~2MB)
      // Example: ?action=attains-national-summary
      case 'attains-national-summary': {
        const summary = getAttainsCacheSummary();
        return NextResponse.json(summary, {
          headers: {
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          },
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // EPA ECHO — MS4 / NPDES Permit Compliance
      // ════════════════════════════════════════════════════════════════════════

      // Search CWA facilities by state
      // Example: ?action=echo-facilities&p_st=CA&p_med=CWA
      case 'echo-facilities': {
        const params: Record<string, string> = {};
        if (sp.get('p_st')) params.p_st = sp.get('p_st')!;
        if (sp.get('p_huc')) params.p_huc = sp.get('p_huc')!;
        if (sp.get('p_sic')) params.p_sic = sp.get('p_sic')!;
        if (sp.get('p_med')) params.p_med = sp.get('p_med') || 'CWA';
        if (sp.get('p_ct')) params.p_ct = sp.get('p_ct')!;
        params.responseset = sp.get('responseset') || '20';
        const data = await echoFetch('get_facilities', params);
        return NextResponse.json({ source: 'echo', data });
      }

      // ════════════════════════════════════════════════════════════════════════
      // EPA EJSCREEN — EJ Index Point Lookup
      // ════════════════════════════════════════════════════════════════════════

      // Example: ?action=ejscreen&lat=37.6&lng=-122.15
      case 'ejscreen': {
        const lat = parseFloat(sp.get('lat') || '');
        const lng = parseFloat(sp.get('lng') || '');
        if (isNaN(lat) || isNaN(lng)) {
          return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
        }
        const data = await ejscreenFetch(lat, lng);
        return NextResponse.json({ source: 'ejscreen', data });
      }

      // ════════════════════════════════════════════════════════════════════════
      // USGS STATE DISCOVERY — All active gauges in a state
      // ════════════════════════════════════════════════════════════════════════

      // Example: ?action=usgs-state-discovery&stateCd=CA&parameterCd=00300
      case 'usgs-state-discovery': {
        const stateCd = sp.get('stateCd') || '';
        if (!stateCd) {
          return NextResponse.json({ error: 'stateCd required' }, { status: 400 });
        }
        const data = await usgsSiteFetch({
          stateCd,
          siteType: sp.get('siteType') || 'ST,ES,LK',
          hasDataTypeCd: 'iv',
          parameterCd: sp.get('parameterCd') || '00300',
          siteStatus: 'active',
        });
        return NextResponse.json({ source: 'usgs-discovery', stateCd, data });
      }

      // ════════════════════════════════════════════════════════════════════════
      // SIGNALS FEED — Beach closures, harvest stops, water quality advisories
      // Aggregates EPA BEACON, state shellfish data, and sensor threshold alerts
      // Example: ?action=signals&limit=30&statecode=MD
      // ════════════════════════════════════════════════════════════════════════
      case 'signals': {
        const limit = parseInt(sp.get('limit') || '30', 10);
        const stateFilter = (sp.get('statecode') || 'MD').toUpperCase();
        const signals: any[] = [];

        // 1. EPA BEACON — Beach advisories & closures (national)
        try {
          const beaconUrl = `https://watersgeo.epa.gov/beacon2/beaches.json?state=${stateFilter}`;
          const beaconRes = await fetch(beaconUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10_000),
            next: { revalidate: 900 }, // 15 min cache
          });
          if (beaconRes.ok) {
            const beaconData = await beaconRes.json();
            const beaches = beaconData?.features || beaconData || [];
            for (const b of (Array.isArray(beaches) ? beaches : [])) {
              const props = b?.properties || b;
              const status = (props?.BEACH_STATUS || props?.beachStatus || '').toString().toUpperCase();
              if (status.includes('CLOS') || status.includes('ADVIS')) {
                signals.push({
                  type: 'beach_closure',
                  severity: status.includes('CLOS') ? 'high' : 'medium',
                  title: `Beach ${status.includes('CLOS') ? 'Closure' : 'Advisory'}: ${props?.BEACH_NAME || props?.beachName || 'Unknown Beach'}`,
                  location: props?.BEACH_NAME || props?.beachName || '',
                  county: props?.COUNTY_NAME || props?.countyName || '',
                  state: stateFilter,
                  source: 'EPA BEACON',
                  reason: props?.ADVISORY_REASON || props?.advisoryReason || props?.NOTIFICATION_REASON || '',
                  startDate: props?.ADVISORY_START_DATE || props?.advisoryStartDate || '',
                  endDate: props?.ADVISORY_END_DATE || props?.advisoryEndDate || '',
                  lat: props?.LATITUDE || props?.latitude || b?.geometry?.coordinates?.[1] || null,
                  lng: props?.LONGITUDE || props?.longitude || b?.geometry?.coordinates?.[0] || null,
                  timestamp: props?.ADVISORY_START_DATE || props?.advisoryStartDate || new Date().toISOString(),
                });
              }
            }
          }
        } catch (e: any) {
          console.warn('[Signals] BEACON fetch failed:', e.message);
        }

        // 2. MD DNR Shellfish Harvest Area closures (Chesapeake-specific — only for MD)
        if (stateFilter === 'MD') {
          try {
            const shellfishUrl = 'https://mde.maryland.gov/programs/water/shellfish_harvest/Pages/index.aspx';
            signals.push({
              type: 'harvest_monitoring',
              severity: 'info',
              title: 'MD Shellfish Harvest Area Monitoring Active',
              location: 'Chesapeake Bay & Coastal Bays',
              state: 'MD',
              source: 'MDE Shellfish Program',
              reason: 'Continuous monitoring of conditional harvest areas. Check MDE for current closure status.',
              sourceUrl: shellfishUrl,
              timestamp: new Date().toISOString(),
            });
          } catch (e: any) {
            console.warn('[Signals] Shellfish status failed:', e.message);
          }
        }

        // 3. USGS real-time multi-parameter analysis — threshold alerts + sewage discharge detection
        // Sewage signature = simultaneous DO crash + conductivity spike + turbidity surge at same station
        // This pattern would have caught the Jan 2026 Potomac Interceptor collapse within hours
        const SENTINEL_SITES: Record<string, string> = {
          MD: '01589440,01585219,01594440',  // Back River, Patapsco, Patuxent
          VA: '01668000,02035000,02037500',  // Rappahannock, James, James at Richmond
          DC: '01646500,01651000',            // Potomac at Georgetown, Anacostia
          DE: '01483700,01484100',            // St Jones, Murderkill
          PA: '01576000,01570500',            // Susquehanna, Susquehanna at Harrisburg
          CA: '11169025,11162765',            // SF Bay stations
          FL: '02323500,02320500',            // Suwannee, St Johns
        };
        const sentinelSites = SENTINEL_SITES[stateFilter] || '';
        if (sentinelSites) {
          try {
            // Fetch DO (00300), Temp (00010), Conductivity (00095), Turbidity (63680)
            // All four needed for sewage discharge signature detection
            const ivUrl = `${USGS_IV_BASE}?format=json&sites=${sentinelSites}&parameterCd=00300,00010,00095,63680&period=PT6H&siteStatus=active`;
            const ivRes = await fetch(ivUrl, {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(15_000),
              next: { revalidate: 300 },
            });
            if (ivRes.ok) {
              const ivData = await ivRes.json();
              const timeSeries = ivData?.value?.timeSeries || [];

              // Group all parameters by site for cross-correlation
              const siteReadings: Record<string, {
                name: string; siteCode: string;
                DO?: { val: number; prev: number; time: string };
                conductivity?: { val: number; prev: number; time: string };
                turbidity?: { val: number; prev: number; time: string };
                temp?: { val: number; time: string };
              }> = {};

              for (const ts of timeSeries) {
                const paramCode = ts?.variable?.variableCode?.[0]?.value;
                const siteName = ts?.sourceInfo?.siteName || 'Unknown';
                const siteCode = ts?.sourceInfo?.siteCode?.[0]?.value || '';
                const values = ts?.values?.[0]?.value || [];
                if (values.length === 0) continue;

                const latest = values[values.length - 1];
                const val = parseFloat(latest?.value);
                if (isNaN(val)) continue;

                // Get previous reading for rate-of-change detection
                const prevReading = values.length >= 2 ? values[values.length - 2] : null;
                const prevVal = prevReading ? parseFloat(prevReading.value) : val;

                if (!siteReadings[siteCode]) {
                  siteReadings[siteCode] = { name: siteName, siteCode };
                }
                const site = siteReadings[siteCode];

                if (paramCode === '00300') site.DO = { val, prev: isNaN(prevVal) ? val : prevVal, time: latest.dateTime };
                if (paramCode === '00095') site.conductivity = { val, prev: isNaN(prevVal) ? val : prevVal, time: latest.dateTime };
                if (paramCode === '63680') site.turbidity = { val, prev: isNaN(prevVal) ? val : prevVal, time: latest.dateTime };
                if (paramCode === '00010') site.temp = { val, time: latest.dateTime };
              }

              // Analyze each site for anomalies and sewage signatures
              for (const [siteCode, site] of Object.entries(siteReadings)) {
                const timestamp = site.DO?.time || site.conductivity?.time || site.turbidity?.time || new Date().toISOString();

                // ── Sewage Discharge Signature Detection ──
                // Pattern: DO drops sharply + conductivity spikes + turbidity surges
                // Any 2 of 3 = warning, all 3 = critical (probable discharge event)
                let sewageIndicators = 0;
                const sewageDetails: string[] = [];

                if (site.DO && site.DO.val < 4 && site.DO.prev > 0 && (site.DO.prev - site.DO.val) / site.DO.prev > 0.25) {
                  sewageIndicators++;
                  sewageDetails.push(`DO crashed ${((1 - site.DO.val / site.DO.prev) * 100).toFixed(0)}% to ${site.DO.val.toFixed(1)} mg/L`);
                }
                if (site.conductivity && site.conductivity.prev > 0 && (site.conductivity.val - site.conductivity.prev) / site.conductivity.prev > 0.30) {
                  sewageIndicators++;
                  sewageDetails.push(`conductivity spiked ${((site.conductivity.val / site.conductivity.prev - 1) * 100).toFixed(0)}% to ${site.conductivity.val.toFixed(0)} µS/cm`);
                }
                if (site.turbidity && site.turbidity.val > 50 && site.turbidity.prev > 0 && (site.turbidity.val - site.turbidity.prev) / site.turbidity.prev > 0.40) {
                  sewageIndicators++;
                  sewageDetails.push(`turbidity surged ${((site.turbidity.val / site.turbidity.prev - 1) * 100).toFixed(0)}% to ${site.turbidity.val.toFixed(0)} NTU`);
                }

                if (sewageIndicators >= 2) {
                  signals.push({
                    type: 'discharge_signature',
                    severity: sewageIndicators >= 3 ? 'high' : 'medium',
                    title: `${sewageIndicators >= 3 ? '⚠️ Probable Sewage Discharge' : 'Potential Discharge Event'}: ${site.name}`,
                    location: site.name,
                    state: stateFilter,
                    source: 'PEARL Multi-Parameter Analysis',
                    reason: `Simultaneous anomaly detected: ${sewageDetails.join('; ')}. Pattern consistent with untreated sewage discharge or CSO/SSO event. Recommend immediate investigation of upstream outfalls and interceptors.`,
                    indicators: sewageIndicators,
                    details: sewageDetails,
                    siteCode,
                    timestamp,
                  });
                }

                // ── Standard single-parameter threshold alerts ──
                // (only if not already flagged as part of a discharge signature)
                if (sewageIndicators < 2) {
                  if (site.DO && site.DO.val < 4) {
                    signals.push({
                      type: 'sensor_alert',
                      severity: site.DO.val < 2 ? 'high' : 'medium',
                      title: `${site.DO.val < 2 ? 'Hypoxic' : 'Low DO'} Alert: ${site.name}`,
                      location: site.name,
                      state: stateFilter,
                      source: 'USGS Real-Time',
                      reason: `Dissolved oxygen at ${site.DO.val.toFixed(1)} mg/L (${site.DO.val < 2 ? 'critically low — aquatic life at risk' : 'below 4 mg/L stress threshold'})`,
                      value: site.DO.val,
                      unit: 'mg/L',
                      parameter: 'Dissolved Oxygen',
                      siteCode,
                      timestamp,
                    });
                  }

                  if (site.temp && site.temp.val > 30) {
                    signals.push({
                      type: 'sensor_alert',
                      severity: 'medium',
                      title: `Elevated Water Temperature: ${site.name}`,
                      location: site.name,
                      state: stateFilter,
                      source: 'USGS Real-Time',
                      reason: `Water temperature at ${site.temp.val.toFixed(1)}°C — above 30°C thermal stress threshold`,
                      value: site.temp.val,
                      unit: '°C',
                      parameter: 'Water Temperature',
                      siteCode,
                      timestamp,
                    });
                  }

                  // Standalone turbidity spike (not part of sewage pattern)
                  if (site.turbidity && site.turbidity.val > 100) {
                    signals.push({
                      type: 'sensor_alert',
                      severity: site.turbidity.val > 250 ? 'high' : 'medium',
                      title: `High Turbidity: ${site.name}`,
                      location: site.name,
                      state: stateFilter,
                      source: 'USGS Real-Time',
                      reason: `Turbidity at ${site.turbidity.val.toFixed(0)} NTU — may indicate sediment runoff, construction discharge, or upstream disturbance`,
                      value: site.turbidity.val,
                      unit: 'NTU',
                      parameter: 'Turbidity',
                      siteCode,
                      timestamp,
                    });
                  }
                }
              }
            }
          } catch (e: any) {
            console.warn('[Signals] USGS multi-parameter analysis failed:', e.message);
          }
        } // end if (sentinelSites)

        // 4. EPA ECHO — Recent significant violations / enforcement actions
        // Catches reported spills, permit violations, and enforcement that utilities self-report
        try {
          const echoUrl = `${ECHO_BASE}/get_facility_info?output=JSON&p_st=${stateFilter}&p_med=CWA&p_qiv=VIOL&p_act=Y&responseset=10`;
          const echoRes = await fetch(echoUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10_000),
            next: { revalidate: 1800 }, // 30 min cache
          });
          if (echoRes.ok) {
            const echoData = await echoRes.json();
            const facilities = echoData?.Results?.Facilities || [];
            for (const fac of facilities.slice(0, 5)) {
              const facName = fac?.CWPName || fac?.FacName || 'Unknown Facility';
              const qtrStatus = fac?.CWPSNCStatus || fac?.CWPStatus || '';
              const isSignificant = qtrStatus.includes('S') || qtrStatus.includes('SNC');
              if (!isSignificant) continue;

              signals.push({
                type: 'permit_violation',
                severity: 'high',
                title: `CWA Violation: ${facName}`,
                location: facName,
                state: stateFilter,
                source: 'EPA ECHO',
                reason: `Facility in significant non-compliance with Clean Water Act permit. Status: ${qtrStatus}. May indicate ongoing unpermitted discharge affecting downstream water quality.`,
                facilityId: fac?.RegistryID || fac?.CWPFacilityID || '',
                latitude: fac?.FacLat || null,
                longitude: fac?.FacLong || null,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (e: any) {
          console.warn('[Signals] ECHO violations check failed:', e.message);
        }

        // 5. NWS Active Alerts — water-relevant weather warnings
        try {
          const nwsUrl = `https://api.weather.gov/alerts/active?area=${stateFilter}&status=actual&message_type=alert`;
          const nwsRes = await fetch(nwsUrl, {
            headers: {
              'Accept': 'application/geo+json',
              'User-Agent': 'PEARL Platform (info@localseafoodprojects.com)',
            },
            signal: AbortSignal.timeout(10_000),
            next: { revalidate: 600 }, // 10 min cache
          });
          if (nwsRes.ok) {
            const nwsData = await nwsRes.json();
            const features = nwsData?.features || [];
            const waterKeywords = ['Flood', 'Flash Flood', 'Storm', 'Hurricane', 'Tropical', 'Tsunami', 'Coastal Flood', 'Storm Surge'];

            const wqImpactMap: Record<string, string> = {
              'Flood': 'Expect elevated turbidity, nutrient loading, potential CSO/SSO overflows',
              'Flash Flood': 'Rapid sediment mobilization, sewage infrastructure overwhelm risk, dangerous bacterial spikes',
              'Storm': 'Stormwater surge increases pollutant loading, runoff from impervious surfaces',
              'Hurricane': 'Risk of saltwater intrusion, infrastructure damage, sewage bypass events',
              'Tropical': 'Risk of saltwater intrusion, infrastructure damage, sewage bypass events',
              'Tsunami': 'Saltwater intrusion, coastal infrastructure damage, debris contamination',
              'Coastal Flood': 'Saltwater intrusion into freshwater systems, septic system flooding',
              'Storm Surge': 'Saltwater intrusion, wastewater treatment plant inundation risk',
            };

            for (const f of features) {
              const props = f?.properties || {};
              const event = props?.event || '';
              const matchedKeyword = waterKeywords.find(kw => event.includes(kw));
              if (!matchedKeyword) continue;

              const nwsSeverity = (props?.severity || '').toString();
              const severity = (nwsSeverity === 'Extreme' || nwsSeverity === 'Severe') ? 'high'
                : nwsSeverity === 'Moderate' ? 'medium' : 'low';

              signals.push({
                type: 'weather_alert',
                severity,
                title: props?.headline || `${event} — ${stateFilter}`,
                location: (props?.areaDesc || '').slice(0, 200),
                state: stateFilter,
                source: 'NWS',
                reason: (props?.description || '').slice(0, 300),
                event,
                wqImpact: wqImpactMap[matchedKeyword] || 'Monitor downstream water quality for post-event impacts',
                urgency: props?.urgency || '',
                onset: props?.onset || '',
                expires: props?.expires || '',
                timestamp: props?.sent || props?.onset || new Date().toISOString(),
              });
            }
          }
        } catch (e: any) {
          console.warn('[Signals] NWS weather alerts failed:', e.message);
        }

        // 6. FEMA Disaster Declarations — recent declarations affecting water infrastructure
        try {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const femaUrl = `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$filter=state eq '${stateFilter}' and declarationDate gt '${thirtyDaysAgo}'&$top=5&$orderby=declarationDate desc`;
          const femaRes = await fetch(femaUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10_000),
            next: { revalidate: 3600 }, // 1 hour cache
          });
          if (femaRes.ok) {
            const femaData = await femaRes.json();
            const declarations = femaData?.DisasterDeclarationsSummaries || [];

            const femaWqImpact: Record<string, string> = {
              'Flood': 'Widespread contamination of water sources, sewage system overflows, drinking water advisories likely',
              'Hurricane': 'Major risk of sewage bypass events, saltwater intrusion, water treatment plant damage',
              'Severe Storm': 'Stormwater infrastructure overwhelm, increased pollutant loading to receiving waters',
              'Fire': 'Post-fire ash runoff increases phosphorus and turbidity in downstream watersheds',
              'Tornado': 'Infrastructure damage may cause sewage spills, debris contamination of waterways',
              'Earthquake': 'Pipe breaks may cause sewage releases, water main contamination',
            };

            for (const d of declarations) {
              const incidentType = d?.incidentType || '';
              const wqImpact = Object.entries(femaWqImpact).find(([key]) => incidentType.includes(key))?.[1]
                || 'Potential disruption to water/wastewater infrastructure; monitor downstream water quality';

              signals.push({
                type: 'disaster_declaration',
                severity: 'high',
                title: d?.declarationTitle || `FEMA Disaster: ${incidentType}`,
                location: d?.designatedArea || stateFilter,
                state: stateFilter,
                source: 'FEMA',
                reason: `Federal disaster declaration (${d?.declarationType || 'DR'}). Incident: ${incidentType}. Declared: ${d?.declarationDate?.split('T')[0] || 'unknown'}.`,
                disasterType: d?.declarationType || '',
                incidentType,
                wqImpact,
                disasterNumber: d?.disasterNumber || '',
                declarationDate: d?.declarationDate || '',
                timestamp: d?.declarationDate || new Date().toISOString(),
              });
            }
          }
        } catch (e: any) {
          console.warn('[Signals] FEMA disaster declarations failed:', e.message);
        }

        // Sort by severity (high → medium → info) then by timestamp descending
        const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 };
        signals.sort((a, b) => {
          const sevDiff = (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
          if (sevDiff !== 0) return sevDiff;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        return NextResponse.json({
          source: 'signals',
          state: stateFilter,
          count: Math.min(signals.length, limit),
          total: signals.length,
          generated: new Date().toISOString(),
          signals: signals.slice(0, limit),
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // Debug: test all sources server-side for a region
      // Example: ?action=debug-region&regionId=maryland_back_river
      // ════════════════════════════════════════════════════════════════════════
      case 'debug-region': {
        const debugRegion = sp.get('regionId') || '';
        const debug: Record<string, any> = { regionId: debugRegion, timestamp: new Date().toISOString(), sources: {} };

        // 1. Test USGS IV
        try {
          const testUrl = `https://waterservices.usgs.gov/nwis/iv?format=json&sites=01589440&parameterCd=00300,00010&period=PT2H`;
          const r = await fetch(testUrl, { headers: { 'Accept': 'application/json' } });
          const j = await r.json();
          const ts = j?.value?.timeSeries || [];
          debug.sources.usgsIv = { status: r.status, timeSeriesCount: ts.length, sampleParams: ts.slice(0, 2).map((t: any) => t?.variable?.variableCode?.[0]?.value) };
        } catch (e: any) { debug.sources.usgsIv = { error: e.message }; }

        // 2. Test ERDDAP
        try {
          const testUrl = `https://erddap.maracoos.org/erddap/tabledap/mddnr_Budds_Landing.csv?time,mass_concentration_of_oxygen_in_sea_water&orderByLimit(%22time,1%22)`;
          const r = await fetch(testUrl);
          const text = await r.text();
          debug.sources.erddap = { status: r.status, bodyLength: text.length, firstLines: text.split('\n').slice(0, 4) };
        } catch (e: any) { debug.sources.erddap = { error: e.message }; }

        // 3. Test CO-OPS (Baltimore)
        try {
          const testUrl = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=8574680&product=water_temperature&date=latest&units=metric&time_zone=gmt&format=json&application=pearl_platform`;
          const r = await fetch(testUrl, { headers: { 'User-Agent': 'PEARL Platform (info@localseafoodprojects.com)' } });
          const j = await r.json();
          debug.sources.coops = { status: r.status, hasData: !!j?.data?.length, latestValue: j?.data?.[0]?.v, latestTime: j?.data?.[0]?.t, raw: j };
        } catch (e: any) { debug.sources.coops = { error: e.message }; }

        // 4. Test USGS Samples
        try {
          const testUrl = `https://api.waterdata.usgs.gov/samples-data/results/narrow?monitoringLocationIdentifier=USGS-01589440&usgsPCode=00300&activityStartDateLower=2024-01-01&activityMediaName=Water&mimeType=text%2Fcsv`;
          const r = await fetch(testUrl);
          const text = await r.text();
          debug.sources.usgsSamples = { status: r.status, bodyLength: text.length, firstLines: text.split('\n').slice(0, 4) };
        } catch (e: any) { debug.sources.usgsSamples = { error: e.message }; }

        // 5. Test Water Reporter (BWB)
        try {
          const token = getToken();
          debug.sources.bwb = { hasToken: !!(token && token !== 'your_token_here') };
          if (token && token !== 'your_token_here') {
            const r = await wrFetch('/parameters', { dataset_id: '860', station_id: '8756' });
            debug.sources.bwb.featureCount = r?.features?.length || 0;
            debug.sources.bwb.sampleParams = r?.features?.slice(0, 3).map((f: any) => f.normalized_name);
          }
        } catch (e: any) { debug.sources.bwb.error = e.message; }

        // 6. Test ATTAINS (EPA 303d)
        try {
          const r = await attainsFetch('assessments', { state: 'MD' });
          const count = r?.count || 0;
          const firstItem = r?.items?.[0];
          debug.sources.attains = {
            status: count > 0 ? 'ok' : 'empty',
            totalAssessments: count,
            sampleWaterbody: firstItem?.assessments?.[0]?.assessmentUnitIdentifier || null,
            sampleCategory: firstItem?.epaIRCategory || null,
          };
        } catch (e: any) { debug.sources.attains = { error: e.message }; }

        // 7. Test EJScreen
        try {
          const r = await ejscreenFetch(39.2644, -76.6264); // Baltimore
          debug.sources.ejscreen = {
            hasData: !!r && !r.error,
            error: r?.error || null,
            sampleFields: r ? Object.keys(r).slice(0, 5) : [],
          };
        } catch (e: any) { debug.sources.ejscreen = { error: e.message }; }

        // Summary
        const coopsVal = debug.sources.coops?.latestValue;
        debug.summary = {
          usgsIv: debug.sources.usgsIv?.timeSeriesCount > 0 ? '✅ working' : '❌ no data',
          erddap: debug.sources.erddap?.bodyLength > 100 ? '✅ working' : '❌ no data',
          coops: coopsVal ? `✅ working (${coopsVal}°C)` : '❌ no data',
          usgsSamples: debug.sources.usgsSamples?.bodyLength > 100 ? '✅ working' : '❌ no data',
          bwb: debug.sources.bwb?.featureCount > 0 ? '✅ working' : debug.sources.bwb?.hasToken ? '❌ no data' : '⚠️ no token',
          attains: debug.sources.attains?.totalAssessments > 0 ? '✅ working' : debug.sources.attains?.error ? '❌ error' : '❌ no data',
          ejscreen: debug.sources.ejscreen?.hasData ? '✅ working' : debug.sources.ejscreen?.error ? '⚠️ unavailable' : '❌ no data',
        };

        return NextResponse.json(debug);
      }

      default:
        return NextResponse.json(
          {
            error: 'Missing or invalid action.',
            availableActions: {
              waterReporter: ['datasets', 'stations', 'parameters', 'readings', 'nearest', 'watersheds'],
              usgsRealtime: ['usgs-iv', 'usgs-sites', 'usgs-site-iv', 'usgs-state-discovery'],
              usgsSamples: ['usgs-samples', 'usgs-samples-summary'],
              usgsDaily: ['usgs-daily', 'usgs-locations'],
              attains: ['attains-assessments', 'attains-state-summary', 'attains-actions', 'attains-impaired'],
              echo: ['echo-facilities'],
              ejscreen: ['ejscreen'],
              erddap: ['erddap-latest', 'erddap-range', 'erddap-stations'],
              noaaCoops: ['coops-latest', 'coops-product', 'coops-stations'],
              wqpStations: ['wqp-stations'],
              wqpResults: ['wqp-results'],
              cbpDataHub: ['cbp-stations', 'cbp-programs', 'cbp-projects', 'cbp-huc8', 'cbp-huc12',
                'cbp-segments', 'cbp-substances', 'cbp-datastreams', 'cbp-waterquality'],
              unified: ['unified'],
              debug: ['debug-region'],
              signals: ['signals'],
            }
          },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error('[water-data API]', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
