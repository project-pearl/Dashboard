/**
 * MDE Cache — Server-side cache for Maryland Department of Environment
 * ArcGIS water quality data (303(d)/305(b) Integrated Report, TMDLs).
 *
 * Populated by /api/cron/rebuild-mde (daily cron).
 * Fetches assessment units from MDE ArcGIS REST endpoints with failover.
 * Maryland only — no multi-state generalization.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MdeAssessmentUnit {
  auId: string;            // MDE assessment unit ID (e.g., "MD-ANACOSTIA-02")
  name: string;            // waterbody name
  waterType: string;       // stream, river, lake, estuary
  category: string;        // IR category (1, 2, 3, 4a, 4b, 5)
  causes: string[];        // local cause names
  tmdlStatus: string;      // approved, in-progress, needed, na
  tmdlDate: string | null;
  lat: number | null;
  lon: number | null;
  attainsId: string | null; // cross-referenced ATTAINS AU ID
  sourceLayer: string;     // which ArcGIS layer this came from
}

export interface MdeCacheStatus {
  loaded: boolean;
  assessmentUnits: number;
  lastBuilt: string | null;
}

interface MdeCacheData {
  _meta: {
    built: string;
    assessmentUnits: number;
  };
  units: Record<string, MdeAssessmentUnit>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: MdeCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'mde.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.units) return false;

    _memCache = {
      _meta: {
        built: data.meta.built,
        assessmentUnits: data.meta.assessmentUnits || 0,
      },
      units: data.units,
    };
    _cacheSource = 'disk';
    console.log(
      `[MDE Cache] Loaded from disk (${_memCache._meta.assessmentUnits} units, ` +
      `built ${data.meta.built || 'unknown'})`
    );
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
    const file = path.join(dir, 'mde.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, units: _memCache.units });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[MDE Cache] Saved to disk (${sizeMB}MB, ${_memCache._meta.assessmentUnits} units)`);
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
  const data = await loadCacheFromBlob<{ meta: any; units: any }>('cache/mde.json');
  if (data?.meta && data?.units) {
    _memCache = { _meta: data.meta, units: data.units };
    _cacheSource = 'disk';
    console.warn(`[MDE Cache] Loaded from blob (${data.meta.assessmentUnits} units)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getMdeAssessmentUnits(): MdeAssessmentUnit[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return Object.values(_memCache.units);
}

export function getMdeAssessmentUnit(auId: string): MdeAssessmentUnit | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.units[auId] ?? null;
}

export async function setMdeCache(units: MdeAssessmentUnit[]): Promise<void> {
  const prevCounts = _memCache
    ? { assessmentUnits: _memCache._meta.assessmentUnits }
    : null;
  const newCounts = { assessmentUnits: units.length };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);

  // Build lookup map keyed by auId
  const unitMap: Record<string, MdeAssessmentUnit> = {};
  for (const u of units) {
    unitMap[u.auId] = u;
  }

  // Cross-reference with ATTAINS
  try {
    const { getAttainsCache } = require('./attainsCache');
    const attainsData = getAttainsCache();
    if (attainsData?.states?.MD?.waterbodies) {
      const mdWaterbodies = attainsData.states.MD.waterbodies;
      for (const unit of units) {
        // Try exact ID match first
        const match = mdWaterbodies.find(
          (wb: { id: string; name: string }) =>
            wb.id === unit.auId ||
            wb.id.replace(/-/g, '').toLowerCase() === unit.auId.replace(/-/g, '').toLowerCase()
        );
        if (match) {
          unit.attainsId = match.id;
        } else {
          // Fallback: case-insensitive substring match on name
          const nameLower = unit.name.toLowerCase();
          const nameMatch = mdWaterbodies.find(
            (wb: { id: string; name: string }) =>
              wb.name && wb.name.toLowerCase() === nameLower
          );
          if (nameMatch) {
            unit.attainsId = nameMatch.id;
          }
        }
      }
      const matched = units.filter(u => u.attainsId).length;
      console.log(`[MDE Cache] ATTAINS cross-ref: ${matched}/${units.length} units matched`);
    }
  } catch {
    console.warn('[MDE Cache] ATTAINS cross-ref skipped (cache not available)');
  }

  _memCache = {
    _meta: {
      built: new Date().toISOString(),
      assessmentUnits: units.length,
    },
    units: unitMap,
  };
  _cacheSource = 'memory (cron)';
  console.log(`[MDE Cache] In-memory updated: ${units.length} assessment units`);
  saveToDisk();
  await saveCacheToBlob('cache/mde.json', { meta: _memCache._meta, units: _memCache.units });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isMdeBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[MDE Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setMdeBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getMdeCacheStatus(): MdeCacheStatus & { source?: string | null; lastDelta?: CacheDelta | null } {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, assessmentUnits: 0, lastBuilt: null, source: null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    assessmentUnits: _memCache._meta.assessmentUnits,
    lastBuilt: _memCache._meta.built,
    lastDelta: _lastDelta,
  };
}
