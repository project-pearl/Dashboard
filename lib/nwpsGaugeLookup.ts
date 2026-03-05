/* ------------------------------------------------------------------ */
/*  NWPS Gauge Lookup — Flood stage thresholds + USGS ID mapping      */
/*                                                                    */
/*  Parses the NWPS all-gauges CSV report to provide:                 */
/*  - Flood stage thresholds (action, minor, moderate, major)         */
/*  - NWS SHEF ID (LID) ↔ USGS site number mapping                   */
/*  - Gauge lat/lng and state                                         */
/*                                                                    */
/*  Lazy-loaded on first access, cached to disk + blob.               */
/* ------------------------------------------------------------------ */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GaugeFloodInfo {
  lid: string;                // NWS SHEF ID (e.g., "PTTP1")
  usgsId: string | null;     // USGS site number (e.g., "03085152")
  name: string;
  state: string;
  lat: number;
  lng: number;
  /** Stage thresholds in feet (-9999 = not defined) */
  actionStage: number | null;
  minorStage: number | null;
  moderateStage: number | null;
  majorStage: number | null;
  unit: string;              // "ft" or "m"
}

interface GaugeLookupData {
  byLid: Record<string, GaugeFloodInfo>;
  byUsgsId: Record<string, GaugeFloodInfo>;
  fetchedAt: string;
}

// ── Singleton Cache ──────────────────────────────────────────────────────────

let _lookupData: GaugeLookupData | null = null;
let _loading: Promise<void> | null = null;

const CSV_URL = 'https://water.noaa.gov/resources/downloads/reports/nwps_all_gauges_report.csv';
const BLOB_PATH = 'cache/nwps-gauge-lookup.json';
const DISK_PATH = '.cache/nwps-gauge-lookup.json';
const FETCH_TIMEOUT_MS = 30_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // refresh weekly

// ── CSV Parsing ──────────────────────────────────────────────────────────────

function parseStage(value: string): number | null {
  const num = parseFloat(value);
  if (isNaN(num) || num <= -9999) return null;
  return num;
}

function parseCsv(csvText: string): GaugeLookupData {
  const lines = csvText.split('\n');
  if (lines.length < 2) return { byLid: {}, byUsgsId: {}, fetchedAt: new Date().toISOString() };

  // Header indices (CSV columns are comma-separated with potential quoting)
  const byLid: Record<string, GaugeFloodInfo> = {};
  const byUsgsId: Record<string, GaugeFloodInfo> = {};

  // Skip header (line 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV split — fields may contain quoted commas
    const fields = splitCsvLine(line);
    if (fields.length < 21) continue;

    const lid = fields[3]?.trim();
    if (!lid) continue;

    const lat = parseFloat(fields[6]?.trim() || '');
    const lng = parseFloat(fields[7]?.trim() || '');
    if (isNaN(lat) || isNaN(lng)) continue;

    const info: GaugeFloodInfo = {
      lid,
      usgsId: fields[5]?.trim() || null,
      name: fields[0]?.trim() || '',
      state: fields[10]?.trim() || '',
      lat,
      lng,
      actionStage: parseStage(fields[16]?.trim() || ''),
      minorStage: parseStage(fields[17]?.trim() || ''),
      moderateStage: parseStage(fields[18]?.trim() || ''),
      majorStage: parseStage(fields[19]?.trim() || ''),
      unit: fields[20]?.trim() || 'ft',
    };

    byLid[lid] = info;
    if (info.usgsId) byUsgsId[info.usgsId] = info;
  }

  return { byLid, byUsgsId, fetchedAt: new Date().toISOString() };
}

/** Split CSV line respecting quoted fields */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const pathMod = require('path');
    const file = pathMod.join(process.cwd(), DISK_PATH);
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw) as GaugeLookupData;
    if (!data?.byLid || Object.keys(data.byLid).length === 0) return false;
    _lookupData = data;
    console.log(`[NWPS Gauge Lookup] Loaded from disk (${Object.keys(data.byLid).length} gauges)`);
    return true;
  } catch {
    return false;
  }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_lookupData) return;
    const fs = require('fs');
    const pathMod = require('path');
    const dir = pathMod.join(process.cwd(), '.cache');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      pathMod.join(process.cwd(), DISK_PATH),
      JSON.stringify(_lookupData),
      'utf-8',
    );
  } catch { /* non-fatal */ }
}

// ── Loader ──────────────────────────────────────────────────────────────────

async function fetchAndParse(): Promise<void> {
  try {
    const res = await fetch(CSV_URL, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[NWPS Gauge Lookup] CSV fetch failed: HTTP ${res.status}`);
      return;
    }
    const csvText = await res.text();
    _lookupData = parseCsv(csvText);
    console.log(`[NWPS Gauge Lookup] Parsed ${Object.keys(_lookupData.byLid).length} gauges from CSV`);
    saveToDisk();
    await saveCacheToBlob(BLOB_PATH, _lookupData).catch(() => {});
  } catch (err: any) {
    console.warn(`[NWPS Gauge Lookup] Fetch error: ${err.message}`);
  }
}

async function ensureLoaded(): Promise<void> {
  if (_lookupData) {
    // Check freshness
    const age = Date.now() - new Date(_lookupData.fetchedAt).getTime();
    if (age < MAX_AGE_MS) return;
    // Stale — refresh in background but don't block
    fetchAndParse().catch(() => {});
    return;
  }

  if (_loading) return _loading;

  _loading = (async () => {
    // Try disk
    if (loadFromDisk()) {
      _loading = null;
      return;
    }

    // Try blob
    const blobData = await loadCacheFromBlob<GaugeLookupData>(BLOB_PATH);
    if (blobData?.byLid && Object.keys(blobData.byLid).length > 0) {
      _lookupData = blobData;
      console.log(`[NWPS Gauge Lookup] Loaded from blob (${Object.keys(blobData.byLid).length} gauges)`);
      _loading = null;
      return;
    }

    // Fetch fresh CSV
    await fetchAndParse();
    _loading = null;
  })();

  return _loading;
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Ensure lookup is loaded (call before using get functions) */
export async function ensureWarmed(): Promise<void> {
  await ensureLoaded();
}

/** Get flood thresholds by NWS SHEF ID (LID) */
export function getByLid(lid: string): GaugeFloodInfo | null {
  return _lookupData?.byLid[lid] ?? null;
}

/** Get flood thresholds by USGS site number */
export function getByUsgsId(usgsId: string): GaugeFloodInfo | null {
  return _lookupData?.byUsgsId[usgsId] ?? null;
}

/** Get all gauge flood info records */
export function getAllGaugeInfo(): GaugeFloodInfo[] {
  if (!_lookupData) return [];
  return Object.values(_lookupData.byLid);
}

/** Get count of loaded gauges */
export function getGaugeCount(): number {
  return _lookupData ? Object.keys(_lookupData.byLid).length : 0;
}

/** Get lookup status */
export function getLookupStatus() {
  return {
    loaded: !!_lookupData,
    gaugeCount: _lookupData ? Object.keys(_lookupData.byLid).length : 0,
    fetchedAt: _lookupData?.fetchedAt ?? null,
  };
}
