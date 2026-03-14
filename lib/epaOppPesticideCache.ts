/**
 * EPA OPP Pesticide Benchmark Cache — Server-side flat cache for EPA Office
 * of Pesticide Programs aquatic life and human health benchmarks.
 *
 * Populated by /api/cron/rebuild-epa-opp-pesticide (weekly).
 * Source: EPA OPP — pesticide aquatic life benchmarks, MCLs, and
 * health advisories for water quality screening.
 *
 * Flat cache: { _meta, benchmarks: PesticideBenchmark[] }
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PesticideBenchmark {
  chemicalName: string;
  casNumber: string;
  pesticideType: string;
  aquaticLifeBenchmark: number | null;
  aquaticLifeBenchmarkUnit: string;
  humanHealthBenchmark: number | null;
  humanHealthBenchmarkUnit: string;
  mcl: number | null;
  ha: number | null;
  ecologicalRisk: 'low' | 'moderate' | 'high';
  lastUpdated: string;
}

interface EpaOppPesticideCacheMeta {
  built: string;
  benchmarkCount: number;
  highRiskCount: number;
}

interface EpaOppPesticideCacheData {
  _meta: EpaOppPesticideCacheMeta;
  benchmarks: PesticideBenchmark[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: EpaOppPesticideCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'epa-opp-pesticide.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.benchmarks) return false;
    _memCache = { _meta: data.meta, benchmarks: data.benchmarks };
    _cacheSource = 'disk';
    console.log(`[EPA OPP Pesticide Cache] Loaded from disk (${data.meta.benchmarkCount} benchmarks, built ${data.meta.built})`);
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
    const file = path.join(dir, 'epa-opp-pesticide.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, benchmarks: _memCache.benchmarks });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[EPA OPP Pesticide Cache] Saved to disk`);
  } catch {
    // fail silently
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
  const data = await loadCacheFromBlob<{ meta: any; benchmarks: any }>('cache/epa-opp-pesticide.json');
  if (data?.meta && data?.benchmarks) {
    _memCache = { _meta: data.meta, benchmarks: data.benchmarks };
    _cacheSource = 'blob';
    console.warn(`[EPA OPP Pesticide Cache] Loaded from blob (${data.meta.benchmarkCount} benchmarks)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getAllPesticideBenchmarks(): PesticideBenchmark[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.benchmarks;
}

export function getPesticideByName(name: string): PesticideBenchmark | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const lower = name.toLowerCase();
  return _memCache.benchmarks.find(b => b.chemicalName.toLowerCase() === lower) || null;
}

export async function setEpaOppPesticideCache(data: EpaOppPesticideCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { benchmarkCount: _memCache._meta.benchmarkCount, highRiskCount: _memCache._meta.highRiskCount }
    : null;
  const newCounts = { benchmarkCount: data._meta.benchmarkCount, highRiskCount: data._meta.highRiskCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[EPA OPP Pesticide Cache] Updated: ${data._meta.benchmarkCount} benchmarks, ` +
    `${data._meta.highRiskCount} high risk`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/epa-opp-pesticide.json', { meta: data._meta, benchmarks: data.benchmarks });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isEpaOppPesticideBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[EPA OPP Pesticide Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setEpaOppPesticideBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getEpaOppPesticideCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    benchmarkCount: _memCache._meta.benchmarkCount,
    highRiskCount: _memCache._meta.highRiskCount,
    lastDelta: _lastDelta,
  };
}
