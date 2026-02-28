// app/api/water-data/route.ts
// Unified server-side proxy for multiple water quality data sources
// Sources: Water Reporter (BWB), Chesapeake Bay Program DataHub, USGS (IV, Samples, Daily), MARACOOS ERDDAP (MD DNR)
import { NextRequest, NextResponse } from 'next/server';
import { getAttainsCache, getAttainsCacheSummary, getCacheStatus, triggerAttainsBuild, ensureWarmed as warmAttains } from '@/lib/attainsCache';
import { getCedenCache, getCedenCacheStatus, ensureWarmed as warmCeden } from '@/lib/cedenCache';
import { getWqpCache, getWqpCacheStatus, ensureWarmed as warmWqp } from '@/lib/wqpCache';
import { getStateReport, getAllStateReports, getStateReportStatus, ensureWarmed as warmStateReports } from '@/lib/stateReportCache';
import { buildStateAssessmentData } from '@/lib/stateAssessmentBuilder';
import { generateReportCard } from '@/lib/stateFindings';

const WR_BASE = 'https://api.waterreporter.org';
const CBP_BASE = 'https://datahub.chesapeakebay.net';
const USGS_IV_BASE = 'https://waterservices.usgs.gov/nwis/iv';
const USGS_SITE_BASE = 'https://waterservices.usgs.gov/nwis/site';
const USGS_OGC_BASE = 'https://api.waterdata.usgs.gov/ogcapi/v0';
const ATTAINS_BASE = 'https://attains.epa.gov/attains-public/api';
const ECHO_BASE = 'https://echo.epa.gov/api/rest_services';
const EJSCREEN_BASE = 'https://ejscreen.epa.gov/mapper/ejscreenRESTbroker1.aspx';
const CEDEN_BASE    = 'https://data.ca.gov/api/3/action';

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

// ─── CBP DataHub POST Helper (Toxics, Living Resources) ───────────────────
async function cbpPostFetch(path: string, body: Record<string, string>) {
  const url = `${CBP_BASE}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: new URLSearchParams(body).toString(),
    next: { revalidate: 600 },
  });
  if (!res.ok) return { error: `CBP DataHub error: ${res.status} ${res.statusText}` };
  return res.json();
}

// ─── CEDEN (CA Open Data Portal) SQL Helper ──────────────────────────────────
async function cedenSqlFetch(sql: string) {
  const url = new URL(`${CEDEN_BASE}/datastore_search_sql`);
  url.searchParams.set('sql', sql);
  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 3600 }, // 1hr cache — data updates weekly
  });
  if (!res.ok) return { error: `CEDEN API error: ${res.status} ${res.statusText}` };
  const json = await res.json();
  if (!json.success) return { error: json.error?.message || 'CEDEN query failed' };
  return { data: json.result?.records || [], total: json.result?.total || 0 };
}

// CEDEN resource IDs
const CEDEN_CHEM_2025 = '97b8bb60-8e58-4c97-a07f-d51a48cd36d4';
const CEDEN_CHEM_AUG  = 'e07c5e0b-cace-4b70-9f13-b3e696cd5a99';
const CEDEN_TOX       = 'bd484e9b-426a-4ba6-ba4d-f5f8ce095836';

// ─── CBP Date Format Helper (M-D-YYYY) ───────────────────────────────────────
function toCbpDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()}`;
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
// USGS discrete samples — use WQP (wqp-results action) instead

// ─── CBIBS — Chesapeake Bay Interpretive Buoy System (real-time) ─────────────
// Replaces MARACOOS ERDDAP (frozen at 2018). Real-time temp, salinity, conductivity.
// API docs: https://mw.buoybay.noaa.gov/api/v1
const CBIBS_BASE = 'https://mw.buoybay.noaa.gov/api/v1';
const CBIBS_API_KEY = process.env.CBIBS_API_KEY || 'e824512c1a763440b7fd909ffac81705f76b213e'; // test key

// CBIBS stations mapped to PEARL regions
const CBIBS_STATION_MAP: Record<string, { stationCode: string; name: string; lat: number; lng: number }> = {
  // Baltimore Harbor area
  'maryland_middle_branch':  { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'maryland_inner_harbor':   { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'maryland_patapsco_river': { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'maryland_patapsco':       { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'maryland_back_river':     { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'maryland_bear_creek':     { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'maryland_curtis_bay':     { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'maryland_stony_creek':    { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'maryland_canton':         { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'maryland_jones_falls':    { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'maryland_gwynns_falls':   { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'baltimore':               { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  // Annapolis / Western Shore
  'maryland_severn_river':   { stationCode: 'AN', name: 'Annapolis',          lat: 38.964, lng: -76.447 },
  'maryland_severn':         { stationCode: 'AN', name: 'Annapolis',          lat: 38.964, lng: -76.447 },
  'maryland_magothy_river':  { stationCode: 'AN', name: 'Annapolis',          lat: 38.964, lng: -76.447 },
  'annapolis':               { stationCode: 'AN', name: 'Annapolis',          lat: 38.964, lng: -76.447 },
  'chesapeake_bay_main':     { stationCode: 'AN', name: 'Annapolis',          lat: 38.964, lng: -76.447 },
  // Gooses Reef (mid-bay)
  'maryland_choptank_river': { stationCode: 'GR', name: 'Gooses Reef',        lat: 38.556, lng: -76.415 },
  'maryland_choptank':       { stationCode: 'GR', name: 'Gooses Reef',        lat: 38.556, lng: -76.415 },
  'maryland_chester_river':  { stationCode: 'GR', name: 'Gooses Reef',        lat: 38.556, lng: -76.415 },
  // Potomac
  'maryland_potomac':        { stationCode: 'PL', name: 'Potomac',            lat: 38.033, lng: -76.337 },
  'dc_potomac':              { stationCode: 'PL', name: 'Potomac',            lat: 38.033, lng: -76.337 },
  // Stingray Point / York Spit (Virginia side)
  'virginia_york_river':     { stationCode: 'YS', name: 'York Spit',          lat: 37.208, lng: -76.269 },
  'virginia_rappahannock':   { stationCode: 'SR', name: 'Stingray Point',     lat: 37.568, lng: -76.263 },
  // Short keys
  'patuxent':                { stationCode: 'PL', name: 'Potomac',            lat: 38.033, lng: -76.337 },
  'upper_bay':               { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
  'gunpowder':               { stationCode: 'BH', name: 'Baltimore Harbor',   lat: 39.223, lng: -76.530 },
};

async function cbibsFetch(stationCode: string) {
  const url = `${CBIBS_BASE}/json/station/${stationCode}?key=${CBIBS_API_KEY}`;
  console.log('[CBIBS]', url.replace(CBIBS_API_KEY, '***'));

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[CBIBS] Error ${res.status}: ${body.slice(0, 300)}`);
    return { error: `CBIBS error: ${res.status}`, detail: body.slice(0, 200) };
  }
  return res.json();
}

// Legacy ERDDAP kept for backwards compatibility but data is stale (2018)
const ERDDAP_BASE = 'https://erddap.maracoos.org/erddap/tabledap';
const ERDDAP_STATION_MAP: Record<string, { datasetId: string; name: string; lat: number; lng: number }> = {
  'patuxent':      { datasetId: 'mddnr_Jug_Bay',                 name: 'Jug Bay',              lat: 38.7813, lng: -76.7137 },
  'chester':       { datasetId: 'mddnr_Harris_Creek_Upstream',   name: 'Harris Creek',         lat: 38.7732, lng: -76.2823 },
  'choptank':      { datasetId: 'mddnr_Harris_Creek_Downstream', name: 'Harris Creek Down',    lat: 38.7125, lng: -76.3168 },
  'upper_bay':     { datasetId: 'mddnr_Havre_de_Grace',          name: 'Havre de Grace',       lat: 39.5478, lng: -76.0848 },
  'budds_landing': { datasetId: 'mddnr_Budds_Landing',           name: 'Budds Landing',        lat: 39.3723, lng: -75.8399 },
};

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
  try {
    return await res.json();
  } catch (e) {
    console.warn(`[CO-OPS] JSON parse failed for ${product}@${stationId}:`, e instanceof Error ? e.message : e);
    return { error: 'CO-OPS returned invalid JSON' };
  }
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
      // CBP API uses path segments: /api.json/WaterQuality/WaterQuality/{StartDate}/{EndDate}/{DataStream}/{ProgramId}/{ProjectId}/{GeoAttr}/{AttrId}/{SubstanceId}
      // Date format: M-D-YYYY
      case 'cbp-waterquality': {
        const startDate = sp.get('startDate') || '';
        const endDate = sp.get('endDate') || '';
        const dataStream = sp.get('dataStream') || '0,1';
        const program = sp.get('program') || '2'; // 2 = Tidal
        const project = sp.get('project') || '0'; // 0 = all
        const geoAttr = sp.get('geoAttr') || 'HUC8';
        const attrId = sp.get('huc8') || sp.get('station') || '';
        const substance = sp.get('substance') || '0'; // 0 = all

        const cbpStart = startDate.includes('-') && startDate.length > 7 ? toCbpDate(startDate) : (startDate || '1-1-2024');
        const cbpEnd = endDate.includes('-') && endDate.length > 7 ? toCbpDate(endDate) : (endDate || '1-1-2026');

        const path = `/api.json/WaterQuality/WaterQuality/${cbpStart}/${cbpEnd}/${dataStream}/${program}/${project}/${geoAttr}/${attrId}/${substance}`;
        const data = await cbpFetch(path);
        return NextResponse.json({ source: 'cbp', data });
      }

      // ── CBP Fluorescence (chlorophyll fluorescence profiles) ──────────────
      // GET /api.json/Fluorescence/{direction}/{startDate}/{endDate}/HUC8/{huc8}
      case 'cbp-fluorescence': {
        const huc8 = sp.get('huc8') || '';
        const startDate = sp.get('startDate') || '1-1-2024';
        const endDate = sp.get('endDate') || '1-1-2026';
        const direction = sp.get('direction') || 'Vertical';
        const path = `/api.json/Fluorescence/${direction}/${startDate}/${endDate}/HUC8/${huc8}`;
        const data = await cbpFetch(path);
        return NextResponse.json({ source: 'cbp', data });
      }

      // ── CBP Point Source — Facility Information ─────────────────────────
      // GET /api.json/PointSource/FacilityInformation/State/{stateAbbr}
      case 'cbp-pointsource-facilities': {
        const state = sp.get('state') || 'MD';
        const path = `/api.json/PointSource/FacilityInformation/State/${state}`;
        const data = await cbpFetch(path);
        return NextResponse.json({ source: 'cbp', data });
      }

      // ── CBP Point Source — Load Data for a facility ─────────────────────
      // GET /api.json/PointSource/LoadData/{startDate}/{endDate}/Facility/{npdes}
      case 'cbp-pointsource-loads': {
        const npdes = sp.get('npdes') || '';
        const startDate = sp.get('startDate') || '1-1-2024';
        const endDate = sp.get('endDate') || '1-1-2026';
        const path = `/api.json/PointSource/LoadData/${startDate}/${endDate}/Facility/${npdes}`;
        const data = await cbpFetch(path);
        return NextResponse.json({ source: 'cbp', data });
      }

      // ── CBP Toxics — Chemical Contaminant data (POST) ───────────────────
      // POST /api.json/Toxics/ChemicalContaminant/{startDate}/{endDate}/HUC8
      case 'cbp-toxics': {
        const huc8 = sp.get('huc8') || '';
        const startDate = sp.get('startDate') || '1-1-2020';
        const endDate = sp.get('endDate') || '1-1-2026';
        const mediaTypes = sp.get('mediaTypes') || 'WAT,SED';
        const path = `/api.json/Toxics/ChemicalContaminant/${startDate}/${endDate}/HUC8`;
        const data = await cbpPostFetch(path, {
          geographicalAttributesList: huc8,
          mediaTypesList: mediaTypes,
        });
        return NextResponse.json({ source: 'cbp', data });
      }

      // ── CBP Living Resources — Tidal Benthic IBI (POST) ────────────────
      // POST /api.json/LivingResources/TidalBenthic/IBI/{startDate}/{endDate}/{projectId}/HUC8
      case 'cbp-livingresources': {
        const huc8 = sp.get('huc8') || '';
        const startDate = sp.get('startDate') || '1-1-2020';
        const endDate = sp.get('endDate') || '1-1-2026';
        const projectId = sp.get('projectId') || '1'; // 1 = BEN
        const path = `/api.json/LivingResources/TidalBenthic/IBI/${startDate}/${endDate}/${projectId}/HUC8`;
        const data = await cbpPostFetch(path, {
          geographicalAttributesList: huc8,
        });
        return NextResponse.json({ source: 'cbp', data });
      }

      // ── CBP Living Resources — Lookup (GET, for discovery) ──────────────
      case 'cbp-livingresources-lookup': {
        const startDate = sp.get('startDate') || '1-1-2020';
        const endDate = sp.get('endDate') || '1-1-2026';
        const projectId = sp.get('projectId') || '1';
        const path = `/api.json/LivingResources/TidalBenthic/IBI/${startDate}/${endDate}/${projectId}/HUC8`;
        const data = await cbpFetch(path);
        return NextResponse.json({ source: 'cbp', data });
      }

      // ════════════════════════════════════════════════════════════════════════
      // CEDEN — California Environmental Data Exchange Network (data.ca.gov)
      // ════════════════════════════════════════════════════════════════════════

      // Chemistry results near a lat/lng (bounding box ±0.05° ~5km)
      case 'ceden-chemistry': {
        const lat = parseFloat(sp.get('lat') || '');
        const lng = parseFloat(sp.get('lng') || '');
        if (isNaN(lat) || isNaN(lng)) {
          return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
        }
        const analyte = sp.get('analyte') || '';
        const delta = 0.05;
        const analyteClause = analyte ? ` AND "Analyte" = '${analyte.replace(/'/g, "''")}'` : '';
        const sql = `SELECT "StationName","StationCode","SampleDate","Analyte","Result","Unit","Latitude","Longitude","DataQuality","MatrixName","SampleAgency" FROM "${CEDEN_CHEM_2025}" WHERE "Latitude" BETWEEN ${lat - delta} AND ${lat + delta} AND "Longitude" BETWEEN ${lng - delta} AND ${lng + delta} AND "DataQuality" NOT IN ('MetaData','Reject')${analyteClause} ORDER BY "SampleDate" DESC LIMIT 200`;
        let result = await cedenSqlFetch(sql);
        // Fallback to augmentation dataset if primary returns nothing
        if (!('error' in result) && result.data.length === 0) {
          const sqlAug = sql.replace(CEDEN_CHEM_2025, CEDEN_CHEM_AUG);
          result = await cedenSqlFetch(sqlAug);
        }
        if ('error' in result) return NextResponse.json(result, { status: 502 });
        return NextResponse.json({ source: 'ceden', type: 'chemistry', ...result });
      }

      // Toxicity results near a lat/lng
      case 'ceden-toxicity': {
        const lat = parseFloat(sp.get('lat') || '');
        const lng = parseFloat(sp.get('lng') || '');
        if (isNaN(lat) || isNaN(lng)) {
          return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
        }
        const delta = 0.05;
        const sql = `SELECT "StationName","StationCode","SampleDate","OrganismName","Analyte","Result","Unit","Mean","StdDev","SigEffectCode","MatrixName","MethodName","Latitude","Longitude","DataQuality" FROM "${CEDEN_TOX}" WHERE "Latitude" BETWEEN ${lat - delta} AND ${lat + delta} AND "Longitude" BETWEEN ${lng - delta} AND ${lng + delta} AND "DataQuality" NOT IN ('MetaData','Reject') ORDER BY "SampleDate" DESC LIMIT 100`;
        const result = await cedenSqlFetch(sql);
        if ('error' in result) return NextResponse.json(result, { status: 502 });
        return NextResponse.json({ source: 'ceden', type: 'toxicity', ...result });
      }

      // Station search by name or code
      case 'ceden-search': {
        const stationCode = sp.get('stationCode') || '';
        const stationName = sp.get('stationName') || '';
        const resource = sp.get('resource') === 'toxicity' ? CEDEN_TOX : CEDEN_CHEM_2025;
        if (!stationCode && !stationName) {
          return NextResponse.json({ error: 'stationCode or stationName required' }, { status: 400 });
        }
        const where = stationCode
          ? `"StationCode" = '${stationCode.replace(/'/g, "''")}'`
          : `"StationName" ILIKE '%${stationName.replace(/'/g, "''").replace(/%/g, '')}%'`;
        const sql = `SELECT DISTINCT "StationName","StationCode","Latitude","Longitude" FROM "${resource}" WHERE ${where} LIMIT 50`;
        const result = await cedenSqlFetch(sql);
        if ('error' in result) return NextResponse.json(result, { status: 502 });
        return NextResponse.json({ source: 'ceden', type: 'stations', ...result });
      }

      // Cache-first lookup (reads from data/ceden-cache.json built by Python)
      case 'ceden-cached': {
        await warmCeden();
        const lat = parseFloat(sp.get('lat') || '');
        const lng = parseFloat(sp.get('lng') || '');
        if (isNaN(lat) || isNaN(lng)) {
          return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
        }
        const cached = getCedenCache(lat, lng);
        if (cached) {
          return NextResponse.json({ source: 'ceden', ...cached });
        }
        return NextResponse.json({ source: 'ceden', chemistry: [], toxicity: [], fromCache: false });
      }

      // Cache status (for debug/monitoring)
      case 'ceden-cache-status': {
        await warmCeden();
        return NextResponse.json(getCedenCacheStatus());
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

      // USGS samples available via WQP (wqp-results action)

      // ════════════════════════════════════════════════════════════════════════
      // MARACOOS ERDDAP — MD DNR CONTINUOUS MONITORING (Eyes on the Bay)
      // ════════════════════════════════════════════════════════════════════════

      // Get latest reading from a specific MDDNR station
      // CBIBS real-time data (replaces stale ERDDAP)
      // Example: ?action=erddap-latest&region=maryland_middle_branch
      // Example: ?action=erddap-latest&stationCode=BH
      case 'erddap-latest': {
        const regionKey = sp.get('region') || '';
        const stationCode = sp.get('stationCode') || '';
        const cbibsStation = stationCode
          ? { stationCode, name: stationCode, lat: 0, lng: 0 }
          : CBIBS_STATION_MAP[regionKey];

        if (cbibsStation) {
          // Use CBIBS (real-time)
          const data = await cbibsFetch(cbibsStation.stationCode);
          if (data && !data.error) {
            // Normalize to ERDDAP-like output for cascade compatibility
            const stationData = Array.isArray(data) ? data[0] : data;
            const normalized = [{
              time: stationData?.last_updated || new Date().toISOString(),
              sea_water_temperature: stationData?.sea_water_temperature ?? stationData?.water_temp ?? '',
              sea_water_salinity: stationData?.sea_water_salinity ?? stationData?.salinity ?? '',
              sea_water_electrical_conductivity: stationData?.sea_water_electrical_conductivity ?? '',
              source: 'CBIBS',
            }];
            return NextResponse.json({ source: 'cbibs', station: cbibsStation.name, data: normalized });
          }
        }

        // Fallback to legacy ERDDAP (stale but may have historical data)
        const erddapStation = ERDDAP_STATION_MAP[regionKey];
        if (erddapStation) {
          return NextResponse.json({
            source: 'erddap',
            station: erddapStation.name,
            warning: 'ERDDAP data is stale (last updated 2018). CBIBS station not available for this region.',
            data: [],
          });
        }

        return NextResponse.json({
          error: 'Provide region or stationCode',
          availableCBIBS: [...new Set(Object.values(CBIBS_STATION_MAP).map(s => s.stationCode))],
        }, { status: 400 });
      }

      // List all mapped CBIBS + legacy ERDDAP stations
      case 'erddap-stations': {
        const cbibsStations = [...new Set(Object.values(CBIBS_STATION_MAP).map(s => s.stationCode))];
        return NextResponse.json({
          source: 'cbibs',
          provider: 'NOAA CBIBS (Chesapeake Bay Interpretive Buoy System)',
          note: 'Replaces stale MARACOOS ERDDAP (frozen at 2018)',
          stations: cbibsStations.map(code => {
            const entry = Object.values(CBIBS_STATION_MAP).find(s => s.stationCode === code)!;
            return { code, name: entry.name, lat: entry.lat, lng: entry.lng };
          }),
        });
      }

      // CBIBS all stations with latest readings
      // Example: ?action=cbibs-all
      case 'cbibs-all': {
        try {
          const url = `${CBIBS_BASE}/json/station?key=${CBIBS_API_KEY}`;
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000),
            next: { revalidate: 300 },
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'cbibs', error: `CBIBS error: ${res.status}` }, { status: 502 });
          }
          const data = await res.json();
          return NextResponse.json({ source: 'cbibs', data });
        } catch (e: any) {
          return NextResponse.json({ source: 'cbibs', error: e.message }, { status: 502 });
        }
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
        try {
          const [tempData, condData, waterLevelData] = await Promise.all([
            coopsFetch(station.stationId, 'water_temperature').catch(() => ({ error: 'fetch failed' })),
            coopsFetch(station.stationId, 'conductivity').catch(() => ({ error: 'fetch failed' })),
            coopsFetch(station.stationId, 'water_level').catch(() => ({ error: 'fetch failed' })),
          ]);

          return NextResponse.json({
            source: 'noaa-coops',
            station: station.name,
            stationId: station.stationId,
            water_temperature: tempData,
            conductivity: condData,
            water_level: waterLevelData,
          });
        } catch (e: any) {
          return NextResponse.json({ source: 'noaa-coops', error: e.message || 'CO-OPS fetch failed' }, { status: 502 });
        }
      }

      // Get specific CO-OPS product for a station
      // Example: ?action=coops-product&stationId=8574680&product=water_temperature
      case 'coops-product': {
        const sid = sp.get('stationId') || '8574680';
        const product = sp.get('product') || 'water_temperature';
        try {
          const data = await coopsFetch(sid, product);
          if ('error' in data) return NextResponse.json({ source: 'noaa-coops', ...data }, { status: 502 });
          return NextResponse.json({ source: 'noaa-coops', stationId: sid, product, data });
        } catch (e: any) {
          return NextResponse.json({ source: 'noaa-coops', error: e.message || 'CO-OPS product fetch failed' }, { status: 502 });
        }
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

      // WQP Cached — instant lookup from pre-baked spatial grid (19 priority states)
      // Example: ?action=wqp-cached&lat=39.27&lng=-76.58
      case 'wqp-cached': {
        await warmWqp();
        const lat = parseFloat(sp.get('lat') || '');
        const lng = parseFloat(sp.get('lng') || '');
        if (isNaN(lat) || isNaN(lng)) {
          return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
        }
        const result = getWqpCache(lat, lng);
        if (!result) {
          return NextResponse.json({ source: 'wqp-cache', cached: false, data: [] });
        }
        return NextResponse.json({
          source: 'wqp-cache',
          cached: true,
          data: result.data,
          count: result.data.length,
          cacheBuilt: result.cacheBuilt,
          statesProcessed: result.statesProcessed,
        }, {
          headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
        });
      }

      // WQP cache status
      // Example: ?action=wqp-cache-status
      case 'wqp-cache-status': {
        await warmWqp();
        return NextResponse.json({ source: 'wqp-cache', ...getWqpCacheStatus() }, {
          headers: { 'Cache-Control': 'no-cache' },
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // STATE DATA REPORT CARD
      // ════════════════════════════════════════════════════════════════════════

      // Single state report
      // Example: ?action=state-data-report&state=MD
      case 'state-data-report': {
        await warmStateReports();
        const state = sp.get('state')?.toUpperCase();
        if (!state) {
          return NextResponse.json({ error: 'Missing state parameter' }, { status: 400 });
        }
        const report = getStateReport(state);
        if (!report) {
          return NextResponse.json({ error: `No report for state ${state}`, status: getStateReportStatus() }, { status: 404 });
        }
        return NextResponse.json(report, {
          headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
        });
      }

      // All state reports
      // Example: ?action=state-data-report-all
      case 'state-data-report-all': {
        await warmStateReports();
        const allReports = getAllStateReports();
        if (!allReports) {
          return NextResponse.json({ error: 'State reports not yet built', status: getStateReportStatus() }, { status: 404 });
        }
        return NextResponse.json(allReports, {
          headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
        });
      }

      // ════════════════════════════════════════════════════════════════════════
      // STATE ASSESSMENT (Report Card from all caches)
      // ════════════════════════════════════════════════════════════════════════

      // Aggregate all caches into a StateAssessmentData → ReportCard
      // Example: ?action=state-assessment&state=MD
      case 'state-assessment': {
        const stateCode = sp.get('state');
        if (!stateCode) {
          return NextResponse.json({ error: 'state parameter required' }, { status: 400 });
        }
        // Warm all caches used by buildStateAssessmentData in parallel
        const [
          { ensureWarmed: warmSdwis },
          { ensureWarmed: warmIcis },
          { ensureWarmed: warmEcho },
          { ensureWarmed: warmNwisGw },
          { ensureWarmed: warmPfas },
        ] = await Promise.all([
          import('@/lib/sdwisCache'),
          import('@/lib/icisCache'),
          import('@/lib/echoCache'),
          import('@/lib/nwisGwCache'),
          import('@/lib/pfasCache'),
        ]);
        await Promise.all([
          warmAttains(),
          warmSdwis(),
          warmIcis(),
          warmEcho(),
          warmNwisGw(),
          warmPfas(),
          warmStateReports(),
        ]);
        const assessmentData = buildStateAssessmentData(stateCode);
        const reportCard = generateReportCard(assessmentData);
        return NextResponse.json(reportCard, {
          headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
        });
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
        await warmAttains();
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
        await warmAttains();
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
        await warmAttains();
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
        console.log('[EJScreen Response]', JSON.stringify(data).slice(0, 500));
        console.log('[EJScreen Keys]', data && !data.error ? Object.keys(data).slice(0, 30).join(', ') : 'ERROR or empty');
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
            const waterKeywords = ['Flood', 'Flash Flood', 'Storm', 'Hurricane', 'Tropical', 'Tsunami', 'Coastal Flood', 'Storm Surge', 'Landslide', 'Winter Storm', 'Debris Flow', 'Avalanche'];

            const wqImpactMap: Record<string, string> = {
              'Flood': 'Expect elevated turbidity, nutrient loading, potential CSO/SSO overflows',
              'Flash Flood': 'Rapid sediment mobilization, sewage infrastructure overwhelm risk, dangerous bacterial spikes',
              'Storm': 'Stormwater surge increases pollutant loading, runoff from impervious surfaces',
              'Hurricane': 'Risk of saltwater intrusion, infrastructure damage, sewage bypass events',
              'Tropical': 'Risk of saltwater intrusion, infrastructure damage, sewage bypass events',
              'Tsunami': 'Saltwater intrusion, coastal infrastructure damage, debris contamination',
              'Coastal Flood': 'Saltwater intrusion into freshwater systems, septic system flooding',
              'Storm Surge': 'Saltwater intrusion, wastewater treatment plant inundation risk',
              'Landslide': 'Massive sediment mobilization, turbidity spikes in downstream waterways, potential dam/infrastructure blockage',
              'Winter Storm': 'Snowmelt surge increases pollutant loading, road salt contamination of waterways',
              'Debris Flow': 'Extreme sediment and contaminant loading, destruction of riparian zones, long-term turbidity impacts',
              'Avalanche': 'Snowmelt surge risk, sediment mobilization when debris field thaws',
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
      // Monitor My Watershed (MMW) — EnviroDIY/Stroud citizen science sensors
      // Example: ?action=mmw-sites&lat=39.27&lng=-76.58&radius=25
      // Example: ?action=mmw-latest&lat=39.27&lng=-76.58&radius=25
      // ════════════════════════════════════════════════════════════════════════
      case 'mmw-sites':
      case 'mmw-latest': {
        const lat = sp.get('lat');
        const lng = sp.get('lng');
        const radiusKm = parseFloat(sp.get('radius') || '25');
        if (!lat || !lng) {
          return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
        }
        const targetLat = parseFloat(lat);
        const targetLng = parseFloat(lng);

        try {
          // MMW has no REST API — site data is embedded as JSON in the /browse/ HTML page
          const browseRes = await fetch('https://monitormywatershed.org/browse/', {
            signal: AbortSignal.timeout(25_000),
          });
          if (!browseRes.ok) {
            console.error(`[MMW] browse returned ${browseRes.status}`);
            return NextResponse.json({ source: 'mmw', error: `MMW browse error: ${browseRes.status}`, data: [] }, { status: 502 });
          }
          const html = await browseRes.text();

          // Extract embedded JSON — use indexOf for speed on 1MB+ HTML (regex is slow here)
          const startTag = '<script id="sites-data" type="application/json">';
          const startIdx = html.indexOf(startTag);
          const endIdx = startIdx >= 0 ? html.indexOf('</script>', startIdx + startTag.length) : -1;
          const jsonStr = startIdx >= 0 && endIdx >= 0 ? html.slice(startIdx + startTag.length, endIdx).trim() : null;
          if (!jsonStr) {
            console.error('[MMW] Could not find sites-data script tag in HTML');
            return NextResponse.json({ source: 'mmw', error: 'Could not parse site data from MMW', data: [] }, { status: 502 });
          }
          let allSites: any;
          try {
            allSites = JSON.parse(jsonStr);
          } catch (parseErr) {
            console.error('[MMW] JSON.parse failed:', parseErr instanceof Error ? parseErr.message : parseErr);
            return NextResponse.json({ source: 'mmw', error: 'MMW returned malformed site data JSON', data: [] }, { status: 502 });
          }

          // Haversine distance filter
          const toRad = (d: number) => d * Math.PI / 180;
          const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLng = toRad(lng2 - lng1);
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          };

          const nearbySites = (Array.isArray(allSites) ? allSites : [])
            .filter((s: any) => s.latitude && s.longitude)
            .map((s: any) => ({ ...s, distance: haversine(targetLat, targetLng, parseFloat(s.latitude), parseFloat(s.longitude)) }))
            .filter((s: any) => s.distance <= radiusKm)
            .sort((a: any, b: any) => a.distance - b.distance)
            .slice(0, 10);

          if (action === 'mmw-sites') {
            return NextResponse.json({ source: 'mmw', data: nearbySites, total: nearbySites.length });
          }

          // For mmw-latest: scrape nearest site's page for result_ids, then fetch CSV data
          const results: any[] = [];
          for (const site of nearbySites.slice(0, 3)) {
            const siteCode = site.code || site.id;
            if (!siteCode) continue;

            try {
              // Get site detail page to extract result_ids
              const siteRes = await fetch(`https://monitormywatershed.org/sites/${siteCode}/`, {
                signal: AbortSignal.timeout(10_000),
              });
              if (!siteRes.ok) continue;
              const siteHtml = await siteRes.text();

              // Extract result-ids from download button attribute
              const idsMatch = siteHtml.match(/result-ids="([^"]+)"/);
              if (!idsMatch) continue;
              const resultIds = idsMatch[1].split(',').slice(0, 4); // limit to 4 params

              // Fetch latest values from each result_id
              for (const rid of resultIds) {
                try {
                  const csvRes = await fetch(`https://monitormywatershed.org/api/csv-values/?result_id=${rid.trim()}`, {
                    signal: AbortSignal.timeout(8_000),
                  });
                  if (!csvRes.ok) continue;
                  const csvText = await csvRes.text();
                  const lines = csvText.trim().split('\n');

                  // CSV has metadata headers (lines starting with #), then column headers, then data
                  const dataLines = lines.filter(l => !l.startsWith('#'));
                  if (dataLines.length < 2) continue;
                  const headers = dataLines[0].split(',');
                  const lastRow = dataLines[dataLines.length - 1].split(',');

                  // Extract variable name from metadata
                  const varLine = lines.find(l => l.startsWith('#VariableName'));
                  const variableName = varLine ? varLine.split(',')[1]?.trim()?.replace(/"/g, '') : headers[3] || 'Unknown';
                  const unitLine = lines.find(l => l.startsWith('#VariableUnitsAbbreviation'));
                  const unit = unitLine ? unitLine.split(',')[1]?.trim()?.replace(/"/g, '') : '';

                  const value = lastRow[3] || lastRow[lastRow.length - 1] || '';
                  const datetime = lastRow[0] || '';

                  if (value && !isNaN(parseFloat(value))) {
                    results.push({
                      variable_name: variableName,
                      value: parseFloat(value),
                      unit,
                      datetime,
                      station_name: site.name || siteCode,
                      site_code: siteCode,
                      distance_km: site.distance?.toFixed(1),
                    });
                  }
                } catch { /* skip failed result_id */ }
              }
            } catch { /* skip failed site */ }
            if (results.length > 0) break; // use first site with data
          }

          return NextResponse.json({ source: 'mmw', data: results, siteCount: nearbySites.length });
        } catch (e: any) {
          console.error('[MMW] Unhandled error:', e.message || e);
          return NextResponse.json({ source: 'mmw', error: e.message, data: [] }, { status: 502 });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // EPA Envirofacts — SDWIS violations, TRI releases, PCS permit compliance
      // Path-based URL syntax: /TABLE/COLUMN/OPERATOR/VALUE/JSON
      // Example: ?action=envirofacts-sdwis&state=MD&limit=20
      // Example: ?action=envirofacts-tri&state=MD&zipcode=21201
      // Example: ?action=envirofacts-pcs&state=MD
      // ════════════════════════════════════════════════════════════════════════
      case 'envirofacts-sdwis': {
        const state = sp.get('state') || 'MD';
        const pwsidParam = sp.get('pwsid') || '';
        const limit = sp.get('limit') || '20';
        try {
          // Fetch violations, systems, and enforcement in parallel
          const stateFilter = pwsidParam ? `PWSID/${pwsidParam}` : `PRIMACY_AGENCY_CODE/${state}`;
          const sysFilter = pwsidParam ? `PWSID/${pwsidParam}` : `STATE_CODE/${state}/PWS_TYPE_CODE/CWS`;
          const enfFilter = pwsidParam ? `PWSID/${pwsidParam}` : `STATE_CODE/${state}`;

          const [violRes, sysRes, enfRes] = await Promise.allSettled([
            fetch(`https://data.epa.gov/efservice/VIOLATION/${stateFilter}/ROWS/0:${limit}/JSON`, {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(15_000),
              next: { revalidate: 3600 },
            }),
            fetch(`https://data.epa.gov/efservice/WATER_SYSTEM/${sysFilter}/ROWS/0:${limit}/JSON`, {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(15_000),
              next: { revalidate: 3600 },
            }),
            fetch(`https://data.epa.gov/efservice/ENFORCEMENT_ACTION/${enfFilter}/ROWS/0:${limit}/JSON`, {
              headers: { 'Accept': 'application/json' },
              signal: AbortSignal.timeout(15_000),
              next: { revalidate: 3600 },
            }),
          ]);

          const violations = violRes.status === 'fulfilled' && violRes.value.ok
            ? await violRes.value.json() : [];
          const systems = sysRes.status === 'fulfilled' && sysRes.value.ok
            ? await sysRes.value.json() : [];
          const enforcement = enfRes.status === 'fulfilled' && enfRes.value.ok
            ? await enfRes.value.json() : [];

          return NextResponse.json({
            source: 'envirofacts-sdwis', state,
            violations, systems, enforcement,
            violationCount: Array.isArray(violations) ? violations.length : 0,
            systemCount: Array.isArray(systems) ? systems.length : 0,
            enforcementCount: Array.isArray(enforcement) ? enforcement.length : 0,
          });
        } catch (e: any) {
          return NextResponse.json({ source: 'envirofacts-sdwis', error: e.message }, { status: 502 });
        }
      }

      case 'envirofacts-tri': {
        const state = (sp.get('state') || 'MD').toUpperCase();
        const zipcode = sp.get('zipcode') || '';
        const limit = sp.get('limit') || '20';
        try {
          let path = `https://data.epa.gov/efservice/TRI_FACILITY/STATE_ABBR/${state}`;
          if (zipcode) path += `/ZIP_CODE/${zipcode}`;
          path += `/ROWS/0:${limit}/JSON`;
          console.log('[Envirofacts-TRI]', path);
          const res = await fetch(path, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000),
            next: { revalidate: 3600 },
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'envirofacts-tri', error: `EPA error: ${res.status}` }, { status: 502 });
          }
          const data = await res.json();
          return NextResponse.json({ source: 'envirofacts-tri', state, count: data.length, data });
        } catch (e: any) {
          return NextResponse.json({ source: 'envirofacts-tri', error: e.message }, { status: 502 });
        }
      }

      case 'envirofacts-pcs': {
        const state = (sp.get('state') || 'MD').toUpperCase();
        const limit = sp.get('limit') || '20';
        try {
          const url = `https://data.epa.gov/efservice/PCS_PERMIT_FACILITY/STATE_CODE/${state}/ROWS/0:${limit}/JSON`;
          console.log('[Envirofacts-PCS]', url);
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000),
            next: { revalidate: 3600 },
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'envirofacts-pcs', error: `EPA error: ${res.status}` }, { status: 502 });
          }
          const data = await res.json();
          return NextResponse.json({ source: 'envirofacts-pcs', state, count: data.length, data });
        } catch (e: any) {
          return NextResponse.json({ source: 'envirofacts-pcs', error: e.message }, { status: 502 });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // ICIS — EPA NPDES permit compliance data (permits, violations, DMR,
      // enforcement, inspections) via Envirofacts REST API + spatial cache
      // ════════════════════════════════════════════════════════════════════════

      case 'icis-permits': {
        const state = (sp.get('state') || 'MD').toUpperCase();
        const permit = sp.get('permit') || '';
        const limit = sp.get('limit') || '100';
        try {
          const filter = permit
            ? `NPDES_ID/${encodeURIComponent(permit)}`
            : `STATE_ABBR/${state}`;
          const url = `https://data.epa.gov/efservice/ICIS_PERMITS/${filter}/ROWS/0:${limit}/JSON`;
          console.log('[ICIS-Permits]', url);
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000),
            next: { revalidate: 3600 },
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'icis-permits', error: `EPA error: ${res.status}` }, { status: 502 });
          }
          const data = await res.json();
          return NextResponse.json({ source: 'icis-permits', state, permit: permit || undefined, count: data.length, data });
        } catch (e: any) {
          return NextResponse.json({ source: 'icis-permits', error: e.message }, { status: 502 });
        }
      }

      case 'icis-violations': {
        const state = (sp.get('state') || 'MD').toUpperCase();
        const permit = sp.get('permit') || '';
        const limit = sp.get('limit') || '100';
        try {
          const filter = permit
            ? `NPDES_ID/${encodeURIComponent(permit)}`
            : `STATE_ABBR/${state}`;
          const url = `https://data.epa.gov/efservice/ICIS_VIOLATIONS/${filter}/ROWS/0:${limit}/JSON`;
          console.log('[ICIS-Violations]', url);
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000),
            next: { revalidate: 3600 },
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'icis-violations', error: `EPA error: ${res.status}` }, { status: 502 });
          }
          const data = await res.json();
          return NextResponse.json({ source: 'icis-violations', state, permit: permit || undefined, count: data.length, data });
        } catch (e: any) {
          return NextResponse.json({ source: 'icis-violations', error: e.message }, { status: 502 });
        }
      }

      case 'icis-dmr': {
        const state = (sp.get('state') || 'MD').toUpperCase();
        const permit = sp.get('permit') || '';
        const limit = sp.get('limit') || '100';
        try {
          const filter = permit
            ? `NPDES_ID/${encodeURIComponent(permit)}`
            : `STATE_ABBR/${state}`;
          const url = `https://data.epa.gov/efservice/ICIS_DMR_MEASUREMENTS/${filter}/ROWS/0:${limit}/JSON`;
          console.log('[ICIS-DMR]', url);
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000),
            next: { revalidate: 3600 },
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'icis-dmr', error: `EPA error: ${res.status}` }, { status: 502 });
          }
          const data = await res.json();
          return NextResponse.json({ source: 'icis-dmr', state, permit: permit || undefined, count: data.length, data });
        } catch (e: any) {
          return NextResponse.json({ source: 'icis-dmr', error: e.message }, { status: 502 });
        }
      }

      case 'icis-enforcement': {
        const state = (sp.get('state') || 'MD').toUpperCase();
        const limit = sp.get('limit') || '100';
        try {
          const url = `https://data.epa.gov/efservice/ICIS_ENFORCEMENT_ACTIONS/STATE_ABBR/${state}/ROWS/0:${limit}/JSON`;
          console.log('[ICIS-Enforcement]', url);
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000),
            next: { revalidate: 3600 },
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'icis-enforcement', error: `EPA error: ${res.status}` }, { status: 502 });
          }
          const data = await res.json();
          return NextResponse.json({ source: 'icis-enforcement', state, count: data.length, data });
        } catch (e: any) {
          return NextResponse.json({ source: 'icis-enforcement', error: e.message }, { status: 502 });
        }
      }

      case 'icis-cached': {
        const lat = parseFloat(sp.get('lat') || '');
        const lng = parseFloat(sp.get('lng') || '');
        if (isNaN(lat) || isNaN(lng)) {
          return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
        }
        try {
          const { getIcisCache, ensureWarmed: warmIcis } = await import('@/lib/icisCache');
          await warmIcis();
          const result = getIcisCache(lat, lng);
          if (!result) {
            return NextResponse.json({ source: 'icis-cached', message: 'No cached ICIS data for this location', data: null });
          }
          return NextResponse.json({ source: 'icis-cached', lat, lng, ...result });
        } catch (e: any) {
          return NextResponse.json({ source: 'icis-cached', error: e.message }, { status: 502 });
        }
      }

      case 'icis-cache-status': {
        try {
          const { getIcisCacheStatus, ensureWarmed: warmIcis } = await import('@/lib/icisCache');
          await warmIcis();
          return NextResponse.json({ source: 'icis-cache-status', ...getIcisCacheStatus() });
        } catch (e: any) {
          return NextResponse.json({ source: 'icis-cache-status', error: e.message }, { status: 502 });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // EPA SDWIS — Safe Drinking Water cached spatial data
      // ════════════════════════════════════════════════════════════════════════

      case 'sdwis-cached': {
        const lat = parseFloat(sp.get('lat') || '');
        const lng = parseFloat(sp.get('lng') || '');
        if (isNaN(lat) || isNaN(lng)) {
          return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
        }
        try {
          const { getSdwisCache, ensureWarmed: warmSdwis } = await import('@/lib/sdwisCache');
          await warmSdwis();
          const result = getSdwisCache(lat, lng);
          if (!result) {
            return NextResponse.json({ source: 'sdwis-cached', message: 'No cached SDWIS data for this location', data: null });
          }
          return NextResponse.json({ source: 'sdwis-cached', lat, lng, ...result });
        } catch (e: any) {
          return NextResponse.json({ source: 'sdwis-cached', error: e.message }, { status: 502 });
        }
      }

      case 'sdwis-cache-status': {
        try {
          const { getSdwisCacheStatus, ensureWarmed: warmSdwis } = await import('@/lib/sdwisCache');
          await warmSdwis();
          return NextResponse.json({ source: 'sdwis-cache-status', ...getSdwisCacheStatus() });
        } catch (e: any) {
          return NextResponse.json({ source: 'sdwis-cache-status', error: e.message }, { status: 502 });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // USGS NWIS Groundwater — cached spatial data + live lookups
      // ════════════════════════════════════════════════════════════════════════

      case 'nwis-gw-cached': {
        const lat = parseFloat(sp.get('lat') || '');
        const lng = parseFloat(sp.get('lng') || '');
        if (isNaN(lat) || isNaN(lng)) {
          return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
        }
        try {
          const { getNwisGwCache, ensureWarmed: warmNwisGw } = await import('@/lib/nwisGwCache');
          await warmNwisGw();
          const result = getNwisGwCache(lat, lng);
          if (!result) {
            return NextResponse.json({ source: 'nwis-gw-cached', message: 'No cached GW data for this location', data: null });
          }
          return NextResponse.json({ source: 'nwis-gw-cached', lat, lng, ...result });
        } catch (e: any) {
          return NextResponse.json({ source: 'nwis-gw-cached', error: e.message }, { status: 502 });
        }
      }

      case 'nwis-gw-cache-status': {
        try {
          const { getNwisGwCacheStatus, ensureWarmed: warmNwisGw } = await import('@/lib/nwisGwCache');
          await warmNwisGw();
          return NextResponse.json({ source: 'nwis-gw-cache-status', ...getNwisGwCacheStatus() });
        } catch (e: any) {
          return NextResponse.json({ source: 'nwis-gw-cache-status', error: e.message }, { status: 502 });
        }
      }

      // Live: list groundwater sites for a state
      // Example: ?action=nwis-gw-sites&state=MD
      case 'nwis-gw-sites': {
        const state = (sp.get('state') || '').toUpperCase();
        if (!state) {
          return NextResponse.json({ error: 'state required' }, { status: 400 });
        }
        try {
          const url = `https://waterservices.usgs.gov/nwis/gwlevels/?format=json&stateCd=${state}&period=P30D&siteStatus=active`;
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(30_000),
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'nwis-gw-sites', error: `USGS HTTP ${res.status}` }, { status: 502 });
          }
          const json = await res.json();
          const timeSeries = json?.value?.timeSeries || [];
          const seen = new Set<string>();
          const sites = timeSeries
            .map((ts: any) => {
              const src = ts.sourceInfo;
              if (!src) return null;
              const code = src.siteCode?.[0]?.value || '';
              if (!code || seen.has(code)) return null;
              seen.add(code);
              const geo = src.geoLocation?.geogLocation;
              return {
                siteNumber: code,
                siteName: src.siteName || '',
                lat: parseFloat(geo?.latitude || '0'),
                lng: parseFloat(geo?.longitude || '0'),
              };
            })
            .filter(Boolean);
          return NextResponse.json({ source: 'nwis-gw-sites', state, count: sites.length, data: sites });
        } catch (e: any) {
          return NextResponse.json({ source: 'nwis-gw-sites', error: e.message }, { status: 502 });
        }
      }

      // Live: discrete levels for a specific well
      // Example: ?action=nwis-gw-levels&siteNumber=392105077123401&period=P90D
      case 'nwis-gw-levels': {
        const siteNumber = sp.get('siteNumber') || sp.get('site') || '';
        const period = sp.get('period') || 'P90D';
        if (!siteNumber) {
          return NextResponse.json({ error: 'siteNumber required' }, { status: 400 });
        }
        try {
          const url = `https://waterservices.usgs.gov/nwis/gwlevels/?format=json&sites=${siteNumber}&period=${period}`;
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'nwis-gw-levels', error: `USGS HTTP ${res.status}` }, { status: 502 });
          }
          const json = await res.json();
          const timeSeries = json?.value?.timeSeries || [];
          const levels: any[] = [];
          for (const ts of timeSeries) {
            const variable = ts.variable;
            const values = ts.values?.[0]?.value || [];
            for (const v of values) {
              const val = parseFloat(v.value);
              if (isNaN(val) || val === (variable?.noDataValue ?? -999999)) continue;
              levels.push({
                dateTime: v.dateTime,
                value: Math.round(val * 100) / 100,
                parameterCd: variable?.variableCode?.[0]?.value || '',
                parameterName: variable?.variableName || '',
                unit: variable?.unit?.unitCode || 'ft',
                qualifier: v.qualifiers || '',
              });
            }
          }
          return NextResponse.json({ source: 'nwis-gw-levels', siteNumber, count: levels.length, data: levels });
        } catch (e: any) {
          return NextResponse.json({ source: 'nwis-gw-levels', error: e.message }, { status: 502 });
        }
      }

      // Live: latest real-time IV reading for a well
      // Example: ?action=nwis-gw-realtime&siteNumber=392105077123401
      case 'nwis-gw-realtime': {
        const siteNumber = sp.get('siteNumber') || sp.get('site') || '';
        if (!siteNumber) {
          return NextResponse.json({ error: 'siteNumber required' }, { status: 400 });
        }
        try {
          const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${siteNumber}&parameterCd=72019,62610,62611&period=P1D`;
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'nwis-gw-realtime', error: `USGS HTTP ${res.status}` }, { status: 502 });
          }
          const json = await res.json();
          const timeSeries = json?.value?.timeSeries || [];
          const readings: any[] = [];
          for (const ts of timeSeries) {
            const variable = ts.variable;
            const values = ts.values?.[0]?.value || [];
            if (values.length > 0) {
              const latest = values[values.length - 1];
              const val = parseFloat(latest.value);
              if (!isNaN(val) && val !== (variable?.noDataValue ?? -999999)) {
                readings.push({
                  dateTime: latest.dateTime,
                  value: Math.round(val * 100) / 100,
                  parameterCd: variable?.variableCode?.[0]?.value || '',
                  parameterName: variable?.variableName || '',
                  unit: variable?.unit?.unitCode || 'ft',
                });
              }
            }
          }
          return NextResponse.json({ source: 'nwis-gw-realtime', siteNumber, data: readings });
        } catch (e: any) {
          return NextResponse.json({ source: 'nwis-gw-realtime', error: e.message }, { status: 502 });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // EPA FRS — WWTP Facility Registry (locations, capacities, permit IDs)
      // ════════════════════════════════════════════════════════════════════════

      // Example: ?action=frs-wwtps&state=MD&limit=500
      case 'frs-wwtps': {
        const state = (sp.get('state') || '').toUpperCase();
        const limit = sp.get('limit') || '500';
        try {
          const filter = state
            ? `STATE_CODE/${state}/PGM_SYS_ACRNM/NPDES`
            : 'PGM_SYS_ACRNM/NPDES';
          const url = `https://data.epa.gov/efservice/FRS_PROGRAM_FACILITY/${filter}/ROWS/0:${limit}/JSON`;
          console.log('[FRS-WWTPs]', url);
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(30_000),
            next: { revalidate: 86400 },
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'frs-wwtps', error: `EPA error: ${res.status}` }, { status: 502 });
          }
          const data = await res.json();
          return NextResponse.json({ source: 'frs-wwtps', state: state || 'ALL', count: data.length, data });
        } catch (e: any) {
          return NextResponse.json({ source: 'frs-wwtps', error: e.message }, { status: 502 });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // CDC NWSS — Wastewater Pathogen Surveillance (COVID, RSV, Influenza)
      // ════════════════════════════════════════════════════════════════════════

      // Example: ?action=cdc-nwss&state=MD&limit=1000
      // Example: ?action=cdc-nwss&limit=5000  (national)
      case 'cdc-nwss': {
        const stateAbbr = (sp.get('state') || '').toUpperCase();
        const limit = sp.get('limit') || '1000';
        // CDC NWSS uses full state names (e.g. "Maryland") not abbreviations
        const ABBR_TO_NAME: Record<string, string> = {
          AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
          CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',
          HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
          LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
          MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
          NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
          OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
          SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
          WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
        };
        try {
          let url = `https://data.cdc.gov/resource/2ew6-ywp6.json?$limit=${encodeURIComponent(limit)}&$order=${encodeURIComponent('date_end DESC')}`;
          if (stateAbbr) {
            const fullName = ABBR_TO_NAME[stateAbbr] || stateAbbr;
            // Socrata SoQL needs %27 for single quotes in $where clauses
            url += `&$where=reporting_jurisdiction%3D%27${encodeURIComponent(fullName)}%27`;
          }
          console.log('[CDC-NWSS]', url);
          const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(30_000),
            cache: 'no-store',
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            return NextResponse.json({ source: 'cdc-nwss', error: `CDC error: ${res.status}`, detail: errText.slice(0, 200), url }, { status: 502 });
          }
          const data = await res.json();
          return NextResponse.json({ source: 'cdc-nwss', state: stateAbbr || 'ALL', count: data.length, debugUrl: url, data });
        } catch (e: any) {
          return NextResponse.json({ source: 'cdc-nwss', error: e.message }, { status: 502 });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // State Portal — routes to state-specific adapters
      // Example: ?action=state-portal&state=MD&lat=39.27&lng=-76.58
      // ════════════════════════════════════════════════════════════════════════
      case 'state-portal': {
        const state = (sp.get('state') || '').toUpperCase();
        const lat = sp.get('lat');
        const lng = sp.get('lng');
        if (!state) {
          return NextResponse.json({ error: 'state required (e.g., MD, VA, CA)' }, { status: 400 });
        }

        try {
          const { fetchStatePortalData } = await import('@/lib/statePortalAdapters');
          const data = await fetchStatePortalData(state, {
            lat: lat ? parseFloat(lat) : undefined,
            lng: lng ? parseFloat(lng) : undefined,
          });
          // Non-CA states fall through to WQP — return empty with adapter hint
          if (data.adapter === 'wqp-fallthrough') {
            return NextResponse.json({
              source: 'state-portal', state, data: [], adapter: 'wqp-fallthrough',
              hint: 'Use ?action=wqp-results for non-CA states',
            });
          }
          return NextResponse.json({ source: 'state-portal', state, ...data });
        } catch (e: any) {
          return NextResponse.json({ source: 'state-portal', error: e.message, data: [] }, { status: 502 });
        }
      }

      // ════════════════════════════════════════════════════════════════════════
      // HydroShare — dataset search by keyword
      // Example: ?action=hydroshare-search&q=Chesapeake+Bay
      // ════════════════════════════════════════════════════════════════════════
      case 'hydroshare-search': {
        const query = sp.get('q') || sp.get('query') || '';
        if (!query) {
          return NextResponse.json({ error: 'q (query) required' }, { status: 400 });
        }

        try {
          const hsUrl = `https://www.hydroshare.org/hsapi/resource/?text=${encodeURIComponent(query)}&type=CompositeResource&count=10`;
          console.log('[HydroShare]', hsUrl);
          const res = await fetch(hsUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15_000),
            next: { revalidate: 3600 },
          });
          if (!res.ok) {
            return NextResponse.json({ source: 'hydroshare', error: `HydroShare error: ${res.status}` }, { status: 502 });
          }
          const data = await res.json();
          const results = data?.results || data || [];
          return NextResponse.json({
            source: 'hydroshare',
            query,
            count: results.length,
            data: results.slice(0, 10).map((r: any) => ({
              id: r.resource_id || r.short_id,
              title: r.resource_title || r.title,
              abstract: (r.abstract || '').slice(0, 200),
              authors: r.creators?.map((c: any) => c.name)?.slice(0, 3) || [],
              url: r.resource_url || `https://www.hydroshare.org/resource/${r.resource_id || r.short_id}`,
              created: r.date_created,
              subjects: r.subjects?.slice(0, 5) || [],
            })),
          });
        } catch (e: any) {
          return NextResponse.json({ source: 'hydroshare', error: e.message }, { status: 502 });
        }
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
              attains: ['attains-assessments', 'attains-actions', 'attains-impaired', 'attains-national-cache', 'attains-national-summary', 'attains-national-status', 'attains-build'],
              echo: ['echo-facilities'],
              ejscreen: ['ejscreen'],
              erddap: ['erddap-latest', 'erddap-range', 'erddap-stations'],
              noaaCoops: ['coops-latest', 'coops-product', 'coops-stations'],
              mmw: ['mmw-sites', 'mmw-latest'],
              envirofacts: ['envirofacts-sdwis', 'envirofacts-tri', 'envirofacts-pcs'],
              icis: ['icis-permits', 'icis-violations', 'icis-dmr', 'icis-enforcement', 'icis-cached', 'icis-cache-status'],
              nwisGw: ['nwis-gw-cached', 'nwis-gw-cache-status', 'nwis-gw-sites', 'nwis-gw-levels', 'nwis-gw-realtime'],
              sdwis: ['sdwis-cached', 'sdwis-cache-status'],
              statePortal: ['state-portal'],
              hydroshare: ['hydroshare-search'],
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
