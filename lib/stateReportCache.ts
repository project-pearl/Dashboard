/**
 * State Data Report Cache — Server-side aggregation of coverage, freshness,
 * parameter breadth, and AI readiness per state.
 *
 * Built as a post-processing step after the daily WQP cron.
 * Cross-references station registry, ATTAINS cache, and WQP cache.
 * Persists to disk following the same pattern as attainsCache/wqpCache.
 */

import { getAttainsCache, type StateSummary } from './attainsCache';
import { getWqpAllRecords, type WqpRecord } from './wqpCache';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FreshnessTier {
  label: string;
  maxDays: number;      // upper bound (Infinity for last bucket)
  count: number;
  pct: number;
}

export interface ParameterCoverage {
  key: string;          // PEARL key (DO, pH, temperature, etc.)
  stationCount: number;
  recordCount: number;
  latestDate: string;
  freshness: 'live' | 'recent' | 'aging' | 'stale' | 'archival';
}

export interface SourceBreakdown {
  source: string;
  waterbodyCount: number;
}

export interface AIReadinessFactors {
  freshness: number;     // 0-30
  coverage: number;      // 0-25
  parameterBreadth: number; // 0-25
  sourceRedundancy: number; // 0-20
}

export interface StateDataReport {
  stateCode: string;

  // Coverage
  totalWaterbodies: number;
  monitoredWaterbodies: number;
  unmonitoredWaterbodies: number;
  monitoredPct: number;
  coverageGrade: string;

  // ATTAINS Impairment
  impairedCount: number;
  healthyCount: number;
  tmdlNeeded: number;
  topCauses: string[];

  // WQP Freshness
  wqpRecordCount: number;
  wqpStationCount: number;
  freshnessTiers: FreshnessTier[];
  medianAgeDays: number;
  freshnessGrade: string;

  // Parameter Coverage
  parameterCoverage: ParameterCoverage[];
  parameterCount: number;
  parameterGrade: string;

  // Source Breakdown
  sourceBreakdown: SourceBreakdown[];
  activeSourceCount: number;

  // AI Readiness
  aiReadinessScore: number;
  aiReadinessGrade: string;
  aiReadinessFactors: AIReadinessFactors;
}

export interface StateReportCacheData {
  _meta: {
    built: string;
    stateCount: number;
  };
  reports: Record<string, StateDataReport>;
}

// ── FIPS to Abbreviation (server-side, no dependency on leafletMapUtils) ────

const FIPS_TO_ABBR: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC',
  '12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY',
  '22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT',
  '31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH',
  '40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT',
  '50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY',
};

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL',
  'GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function letterGrade(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

function freshnessLabel(ageDays: number): ParameterCoverage['freshness'] {
  if (ageDays <= 1) return 'live';
  if (ageDays <= 7) return 'recent';
  if (ageDays <= 30) return 'aging';
  if (ageDays <= 90) return 'stale';
  return 'archival';
}

// ── Station Registry (server-side fs load) ───────────────────────────────────

interface RegistryRegion {
  lat: number;
  lng: number;
  huc8: string;
  stateCode: string;  // "US:XX" FIPS format
  name: string;
}

interface RegistryData {
  regions: Record<string, RegistryRegion>;
  coverage: Record<string, { hasData: boolean; sources: string[] }>;
  usgsSiteMap: Record<string, string>;
  wqpStationMap: Record<string, { siteId: string; provider: string; name: string }>;
}

function loadStationRegistry(): RegistryData | null {
  try {
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), 'public', 'data', 'station-registry.json');
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: StateReportCacheData | null = null;

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'state-reports.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?._meta || !data?.reports) return false;
    _memCache = data;
    console.log(`[State Reports] Loaded from disk (${data._meta.stateCount} states, built ${data._meta.built})`);
    return true;
  } catch {
    return false;
  }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_memCache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, 'state-reports.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_memCache);
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[State Reports] Saved to disk (${sizeMB}MB, ${_memCache._meta.stateCount} states)`);
  } catch {
    // Disk save is optional — fail silently
  }
}

let _diskLoaded = false;
function ensureDiskLoaded() {
  if (!_diskLoaded) {
    _diskLoaded = true;
    loadFromDisk();
  }
}

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<StateReportCacheData>('cache/state-reports.json');
  if (data?._meta && data?.reports) {
    _memCache = data;
    console.warn(`[State Reports] Loaded from blob (${data._meta.stateCount} states, built ${data._meta.built})`);
  }
}

// ── Core Build Logic ─────────────────────────────────────────────────────────

export function buildStateReports(): StateReportCacheData {
  const registry = loadStationRegistry();
  const attainsData = getAttainsCache();
  const wqpRecords = getWqpAllRecords();

  const now = Date.now();
  const reports: Record<string, StateDataReport> = {};

  // Index registry regions by state abbreviation
  const regionsByState: Record<string, { id: string; region: RegistryRegion }[]> = {};
  if (registry) {
    for (const [id, region] of Object.entries(registry.regions)) {
      // stateCode is "US:XX" — extract FIPS and convert to abbreviation
      const fips = region.stateCode?.replace('US:', '');
      const abbr = fips ? FIPS_TO_ABBR[fips] : undefined;
      if (abbr) {
        if (!regionsByState[abbr]) regionsByState[abbr] = [];
        regionsByState[abbr].push({ id, region });
      }
    }
  }

  // Index WQP records by state
  const wqpByState: Record<string, WqpRecord[]> = {};
  for (const rec of wqpRecords) {
    const st = rec.state;
    if (st) {
      if (!wqpByState[st]) wqpByState[st] = [];
      wqpByState[st].push(rec);
    }
  }

  for (const stateAbbr of ALL_STATES) {
    const stateRegions = regionsByState[stateAbbr] || [];
    const totalWaterbodies = stateRegions.length;

    // ── Coverage ──────────────────────────────────────────────────────────
    let monitoredCount = 0;
    const sourceCounts: Record<string, number> = {};

    for (const { id } of stateRegions) {
      const cov = registry?.coverage?.[id];
      const hasUsgs = !!registry?.usgsSiteMap?.[id];
      const hasWqp = !!registry?.wqpStationMap?.[id as keyof typeof registry.wqpStationMap];

      if ((cov && cov.hasData) || hasUsgs || hasWqp) {
        monitoredCount++;
        if (cov?.sources) {
          for (const src of cov.sources) {
            sourceCounts[src] = (sourceCounts[src] || 0) + 1;
          }
        }
        if (hasUsgs) sourceCounts['USGS'] = (sourceCounts['USGS'] || 0) + 1;
        if (hasWqp) sourceCounts['WQP'] = (sourceCounts['WQP'] || 0) + 1;
      }
    }

    const unmonitoredCount = totalWaterbodies - monitoredCount;
    const monitoredPct = totalWaterbodies > 0 ? Math.round((monitoredCount / totalWaterbodies) * 100) : 0;

    // ── ATTAINS ──────────────────────────────────────────────────────────
    const attains: StateSummary | undefined = attainsData.states[stateAbbr];
    const impairedCount = attains ? (attains.high + attains.medium) : 0;
    const healthyCount = attains ? (attains.low + attains.none) : 0;
    const tmdlNeeded = attains?.tmdlNeeded || 0;
    const topCauses = attains?.topCauses || [];

    // ── WQP Freshness ────────────────────────────────────────────────────
    const stateWqp = wqpByState[stateAbbr] || [];
    const stations = new Set(stateWqp.map(r => r.stn));

    // Compute age in days for each record
    const ageDays: number[] = [];
    for (const rec of stateWqp) {
      const recDate = new Date(rec.date).getTime();
      if (!isNaN(recDate)) {
        ageDays.push(Math.max(0, (now - recDate) / (1000 * 60 * 60 * 24)));
      }
    }
    ageDays.sort((a, b) => a - b);

    const medianAge = ageDays.length > 0 ? Math.round(ageDays[Math.floor(ageDays.length / 2)]) : 999;

    // 6 freshness buckets
    const tierDefs = [
      { label: '<24h', maxDays: 1 },
      { label: '<7d', maxDays: 7 },
      { label: '<30d', maxDays: 30 },
      { label: '<90d', maxDays: 90 },
      { label: '<1yr', maxDays: 365 },
      { label: '>1yr', maxDays: Infinity },
    ];
    const tierCounts = new Array(tierDefs.length).fill(0);
    for (const age of ageDays) {
      for (let i = 0; i < tierDefs.length; i++) {
        if (age <= tierDefs[i].maxDays) {
          tierCounts[i]++;
          break;
        }
      }
    }
    const freshnessTiers: FreshnessTier[] = tierDefs.map((t, i) => ({
      label: t.label,
      maxDays: t.maxDays,
      count: tierCounts[i],
      pct: ageDays.length > 0 ? Math.round((tierCounts[i] / ageDays.length) * 100) : 0,
    }));

    // Freshness grade: based on % of records < 90 days old
    const recentPct = ageDays.length > 0
      ? Math.round(ageDays.filter(a => a <= 90).length / ageDays.length * 100)
      : 0;
    const freshnessGrade = stateWqp.length === 0 ? 'F' : letterGrade(recentPct);

    // ── Parameter Coverage ───────────────────────────────────────────────
    const paramMap: Record<string, { stations: Set<string>; count: number; latestDate: string }> = {};
    for (const rec of stateWqp) {
      if (!paramMap[rec.key]) {
        paramMap[rec.key] = { stations: new Set(), count: 0, latestDate: '' };
      }
      const p = paramMap[rec.key];
      p.stations.add(rec.stn);
      p.count++;
      if (rec.date > p.latestDate) p.latestDate = rec.date;
    }

    const parameterCoverage: ParameterCoverage[] = Object.entries(paramMap)
      .map(([key, p]) => {
        const latestMs = new Date(p.latestDate).getTime();
        const age = isNaN(latestMs) ? 999 : (now - latestMs) / (1000 * 60 * 60 * 24);
        return {
          key,
          stationCount: p.stations.size,
          recordCount: p.count,
          latestDate: p.latestDate,
          freshness: freshnessLabel(age),
        };
      })
      .sort((a, b) => b.recordCount - a.recordCount);

    // PEARL has ~10 canonical parameters; grade on how many a state covers
    const CANONICAL_PARAMS = ['DO', 'pH', 'temperature', 'turbidity', 'TN', 'TP', 'bacteria', 'conductivity', 'TSS', 'chlorophyll'];
    const coveredParams = parameterCoverage.filter(p => CANONICAL_PARAMS.includes(p.key)).length;
    const parameterGrade = letterGrade((coveredParams / CANONICAL_PARAMS.length) * 100);

    // ── Source Breakdown ─────────────────────────────────────────────────
    const sourceBreakdown: SourceBreakdown[] = Object.entries(sourceCounts)
      .map(([source, waterbodyCount]) => ({ source, waterbodyCount }))
      .sort((a, b) => b.waterbodyCount - a.waterbodyCount);

    const activeSourceCount = sourceBreakdown.length;

    // ── AI Readiness Score (0-100) ───────────────────────────────────────
    // Freshness (30 pts): % of records < 90 days × 0.3
    const freshnessPts = Math.round(recentPct * 0.3);

    // Coverage (25 pts): monitoredPct × 0.25
    const coveragePts = Math.round(monitoredPct * 0.25);

    // Parameter breadth (25 pts): covered params / 10 × 25
    const paramPts = Math.round((coveredParams / CANONICAL_PARAMS.length) * 25);

    // Source redundancy (20 pts): min(activeSourceCount / 3, 1) × 20
    const redundancyPts = Math.round(Math.min(activeSourceCount / 3, 1) * 20);

    const aiReadinessScore = freshnessPts + coveragePts + paramPts + redundancyPts;

    reports[stateAbbr] = {
      stateCode: stateAbbr,
      totalWaterbodies,
      monitoredWaterbodies: monitoredCount,
      unmonitoredWaterbodies: unmonitoredCount,
      monitoredPct,
      coverageGrade: letterGrade(monitoredPct),
      impairedCount,
      healthyCount,
      tmdlNeeded,
      topCauses,
      wqpRecordCount: stateWqp.length,
      wqpStationCount: stations.size,
      freshnessTiers,
      medianAgeDays: medianAge,
      freshnessGrade,
      parameterCoverage,
      parameterCount: parameterCoverage.length,
      parameterGrade,
      sourceBreakdown,
      activeSourceCount,
      aiReadinessScore,
      aiReadinessGrade: letterGrade(aiReadinessScore),
      aiReadinessFactors: {
        freshness: freshnessPts,
        coverage: coveragePts,
        parameterBreadth: paramPts,
        sourceRedundancy: redundancyPts,
      },
    };
  }

  const cacheData: StateReportCacheData = {
    _meta: {
      built: new Date().toISOString(),
      stateCount: Object.keys(reports).length,
    },
    reports,
  };

  _memCache = cacheData;
  saveToDisk();
  saveCacheToBlob('cache/state-reports.json', cacheData).catch(() => {});
  console.warn(`[State Reports] Built ${cacheData._meta.stateCount} state reports`);
  return cacheData;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getStateReport(state: string): StateDataReport | null {
  ensureDiskLoaded();
  return _memCache?.reports[state.toUpperCase()] || null;
}

export function getAllStateReports(): StateReportCacheData | null {
  ensureDiskLoaded();
  return _memCache;
}

export function getStateReportStatus(): { loaded: boolean; built: string | null; stateCount: number } {
  ensureDiskLoaded();
  return {
    loaded: !!_memCache,
    built: _memCache?._meta.built || null,
    stateCount: _memCache?._meta.stateCount || 0,
  };
}
