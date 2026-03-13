/**
 * Cyber Risk Cache — Server-side state-keyed cache for water system
 * cybersecurity risk assessments derived from EPA ECHO compliance gaps,
 * SCADA indicators, and proximity to military installations.
 *
 * Populated by /api/cron/rebuild-cyber-risk (daily at 11 PM UTC).
 * State-keyed: Record<string, CyberRiskAssessment[]>
 *
 * Links to water quality via SDWIS/ECHO compliance gaps and digital
 * exposure scoring for supervisory control systems.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CyberRiskAssessment {
  registryId: string;
  facilityName: string;
  state: string;
  city: string;
  lat: number;
  lng: number;
  systemSize: 'very_small' | 'small' | 'medium' | 'large' | 'very_large';
  populationServed: number;
  complianceGaps: {
    recentViolations: number;
    sncStatus: boolean;
    dmrMissing: boolean;
    inspectionOverdue: boolean;
  };
  digitalExposure: {
    hasScadaIndicators: boolean;
    systemComplexity: number;
  };
  cyberRiskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  nearMilitary: boolean;
  militaryDistanceMi: number | null;
}

interface CyberRiskCacheMeta {
  built: string;
  assessmentCount: number;
  statesCovered: number;
  criticalCount: number;
}

interface CyberRiskCacheData {
  _meta: CyberRiskCacheMeta;
  byState: Record<string, CyberRiskAssessment[]>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CyberRiskCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'cyber-risk.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.byState) return false;
    _memCache = { _meta: data.meta, byState: data.byState };
    _cacheSource = 'disk';
    console.log(`[Cyber Risk Cache] Loaded from disk (${data.meta.assessmentCount} assessments, built ${data.meta.built})`);
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
    const file = path.join(dir, 'cyber-risk.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, byState: _memCache.byState });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Cyber Risk Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; byState: any }>('cache/cyber-risk.json');
  if (data?.meta && data?.byState) {
    _memCache = { _meta: data.meta, byState: data.byState };
    _cacheSource = 'blob';
    console.warn(`[Cyber Risk Cache] Loaded from blob (${data.meta.assessmentCount} assessments)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCyberRisk(state: string): CyberRiskAssessment[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.byState[state.toUpperCase()] || [];
}

export function getCyberRiskAll(): Record<string, CyberRiskAssessment[]> {
  ensureDiskLoaded();
  if (!_memCache) return {};
  return _memCache.byState;
}

export function getHighRiskSystems(): CyberRiskAssessment[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: CyberRiskAssessment[] = [];
  for (const assessments of Object.values(_memCache.byState)) {
    for (const a of assessments) {
      if (a.riskLevel === 'high' || a.riskLevel === 'critical') {
        results.push(a);
      }
    }
  }
  return results;
}

export function getCriticalNearMilitary(): CyberRiskAssessment[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  const results: CyberRiskAssessment[] = [];
  for (const assessments of Object.values(_memCache.byState)) {
    for (const a of assessments) {
      if (a.riskLevel === 'critical' && a.nearMilitary) {
        results.push(a);
      }
    }
  }
  return results;
}

export async function setCyberRiskCache(data: CyberRiskCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { assessmentCount: _memCache._meta.assessmentCount, statesCovered: _memCache._meta.statesCovered, criticalCount: _memCache._meta.criticalCount }
    : null;
  const newCounts = { assessmentCount: data._meta.assessmentCount, statesCovered: data._meta.statesCovered, criticalCount: data._meta.criticalCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[Cyber Risk Cache] Updated: ${data._meta.assessmentCount} assessments, ` +
    `${data._meta.statesCovered} states, ${data._meta.criticalCount} critical`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/cyber-risk.json', { meta: data._meta, byState: data.byState });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCyberRiskBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Cyber Risk Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCyberRiskBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCyberRiskCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    assessmentCount: _memCache._meta.assessmentCount,
    statesCovered: _memCache._meta.statesCovered,
    criticalCount: _memCache._meta.criticalCount,
    lastDelta: _lastDelta,
  };
}
