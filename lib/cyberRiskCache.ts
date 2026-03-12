/**
 * Cyber Risk Cache — Water sector cybersecurity risk assessments.
 *
 * Populated by /api/cron/rebuild-cyber-risk (weekly cron).
 * Derived cache — reads existing ECHO, SDWIS, FRS caches. No external API.
 * State-keyed for state-level lookups.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type SystemSize = 'very_small' | 'small' | 'medium' | 'large' | 'very_large';
export type CyberRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ComplianceGaps {
  recentViolations: number;
  sncStatus: boolean;
  dmrMissing: boolean;
  inspectionOverdue: boolean;
}

export interface DigitalExposure {
  hasScadaIndicators: boolean;
  systemComplexity: number;
}

export interface CyberRiskAssessment {
  registryId: string;
  facilityName: string;
  state: string;
  city: string;
  lat: number;
  lng: number;
  systemSize: SystemSize;
  populationServed: number;
  complianceGaps: ComplianceGaps;
  digitalExposure: DigitalExposure;
  cyberRiskScore: number;
  riskLevel: CyberRiskLevel;
  nearMilitary: boolean;
  militaryDistanceMi: number | null;
}

export interface CyberRiskCacheMeta {
  built: string;
  assessmentCount: number;
  stateCount: number;
  highRiskCount: number;
  criticalCount: number;
  nearMilitaryCount: number;
}

interface CyberRiskCacheData {
  _meta: CyberRiskCacheMeta;
  states: Record<string, CyberRiskAssessment[]>;
}

export interface CyberRiskLookupResult {
  assessments: CyberRiskAssessment[];
  cacheBuilt: string;
  fromCache: true;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: CyberRiskCacheData | null = null;
let _cacheSource: 'disk' | 'memory (cron)' | null = null;
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
    if (!data?.meta || !data?.states) return false;
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.log(`[Cyber Risk Cache] Loaded from disk (${_memCache._meta.assessmentCount} assessments)`);
    return true;
  } catch { return false; }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_memCache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, states: _memCache.states });
    fs.writeFileSync(path.join(dir, 'cyber-risk.json'), payload, 'utf-8');
    console.log(`[Cyber Risk Cache] Saved to disk (${(Buffer.byteLength(payload) / 1024 / 1024).toFixed(1)}MB)`);
  } catch { /* optional */ }
}

let _diskLoaded = false;
function ensureDiskLoaded() { if (!_diskLoaded) { _diskLoaded = true; loadFromDisk(); } }

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_memCache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<{ meta: any; states: any }>('cache/cyber-risk.json');
  if (data?.meta && data?.states) {
    _memCache = { _meta: data.meta, states: data.states };
    _cacheSource = 'disk';
    console.warn(`[Cyber Risk Cache] Loaded from blob (${data.meta.assessmentCount} assessments)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getCyberRisk(state: string): CyberRiskLookupResult | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const assessments = _memCache.states[state.toUpperCase()];
  if (!assessments || assessments.length === 0) return null;
  return { assessments, cacheBuilt: _memCache._meta.built, fromCache: true };
}

export function getCyberRiskAll(): Record<string, CyberRiskAssessment[]> | null {
  ensureDiskLoaded();
  return _memCache?.states ?? null;
}

export function getHighRiskSystems(): CyberRiskAssessment[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const result: CyberRiskAssessment[] = [];
  for (const assessments of Object.values(_memCache.states)) {
    for (const a of assessments) {
      if (a.riskLevel === 'high' || a.riskLevel === 'critical') result.push(a);
    }
  }
  return result;
}

export function getCriticalNearMilitary(): CyberRiskAssessment[] | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  const result: CyberRiskAssessment[] = [];
  for (const assessments of Object.values(_memCache.states)) {
    for (const a of assessments) {
      if (a.riskLevel === 'critical' && a.nearMilitary) result.push(a);
    }
  }
  return result;
}

export async function setCyberRiskCache(data: CyberRiskCacheData): Promise<void> {
  const prev = _memCache ? { assessmentCount: _memCache._meta.assessmentCount, stateCount: _memCache._meta.stateCount, highRiskCount: _memCache._meta.highRiskCount, criticalCount: _memCache._meta.criticalCount } : null;
  const next = { assessmentCount: data._meta.assessmentCount, stateCount: data._meta.stateCount, highRiskCount: data._meta.highRiskCount, criticalCount: data._meta.criticalCount };
  _lastDelta = computeCacheDelta(prev, next, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(`[Cyber Risk Cache] Updated: ${data._meta.assessmentCount} assessments, ${data._meta.criticalCount} critical`);
  saveToDisk();
  await saveCacheToBlob('cache/cyber-risk.json', { meta: data._meta, states: data.states });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isCyberRiskBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Cyber Risk Cache] Auto-clearing stale build lock');
    _buildInProgress = false; _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setCyberRiskBuildInProgress(v: boolean): void {
  _buildInProgress = v; _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getCyberRiskCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true, source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built, assessmentCount: _memCache._meta.assessmentCount,
    stateCount: _memCache._meta.stateCount, highRiskCount: _memCache._meta.highRiskCount,
    criticalCount: _memCache._meta.criticalCount, nearMilitaryCount: _memCache._meta.nearMilitaryCount,
    lastDelta: _lastDelta,
  };
}
