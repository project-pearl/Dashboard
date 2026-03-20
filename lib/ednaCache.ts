/**
 * eDNA Cache — Server-side HUC12-level cache for environmental DNA species detections.
 *
 * Populated by /api/cron/rebuild-edna (weekly Tuesday).
 * HUC12-level cache — keyed by 12-digit HUC watershed code.
 * Sources: GBIF occurrence API, USGS biological sampling, EPA invasive species data.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface eDNADetection {
  gbifKey?: number;              // GBIF occurrence key
  scientificName: string;        // Species scientific name
  commonName?: string;           // Species common name
  detectionDate: string;         // ISO date of detection
  samplingMethod: 'eDNA' | 'visual' | 'physical' | 'acoustic';
  confidence: 'high' | 'medium' | 'low';
  coordinates: { lat: number; lng: number };
  datasetKey?: string;           // Source dataset identifier
  threatStatus?: 'endangered' | 'threatened' | 'invasive' | 'native';
}

export interface eDNAData {
  huc12: string;                 // 12-digit HUC watershed code
  totalDetections: number;       // Total species detections
  uniqueSpecies: number;         // Unique species count
  endangeredCount: number;       // T&E species detected
  invasiveCount: number;         // Invasive species detected
  lastSampled: string | null;    // Most recent sampling date
  confidenceScore: number;       // 0-100 data quality score
  detections: eDNADetection[];   // Individual detection records
  biodiversityIndex: number;     // 0-100 composite diversity score
}

interface eDNACacheData {
  _meta: { built: string; hucCount: number; totalDetections: number };
  hucs: Record<string, eDNAData>;
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: eDNACacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// Build lock (auto-clearing, 12-minute timeout)
let _buildInProgress = false;
let _buildStartedAt: number | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'edna.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?._meta || !data?.hucs) return false;
    _memCache = data;
    _cacheSource = 'disk';
    console.log(`[eDNA Cache] Loaded from disk (${data._meta.hucCount} HUCs, ${data._meta.totalDetections} detections, built ${data._meta.built})`);
    return true;
  } catch (err) {
    console.warn('[eDNA Cache] Failed to load from disk:', err);
    return false;
  }
}

function saveToDisk(data: eDNACacheData): void {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs');
    const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const file = path.join(cacheDir, 'edna.json');
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(`[eDNA Cache] Saved to disk (${data._meta.hucCount} HUCs)`);
  } catch (err) {
    console.warn('[eDNA Cache] Failed to save to disk:', err);
  }
}

function ensureDiskLoaded(): void {
  if (!_memCache && typeof process !== 'undefined') {
    loadFromDisk();
  }
}

// ── Blob Persistence ─────────────────────────────────────────────────────────

async function loadFromBlob(): Promise<void> {
  try {
    const data = await loadCacheFromBlob('edna.json');
    if (data?._meta && data?.hucs) {
      _memCache = data;
      _cacheSource = 'blob';
      console.log(`[eDNA Cache] Loaded from blob (${data._meta.hucCount} HUCs, built ${data._meta.built})`);
    }
  } catch (err) {
    console.warn('[eDNA Cache] Failed to load from blob:', err);
  }
}

// ── Build Lock Management ────────────────────────────────────────────────────

export function iseDNABuildInProgress(): boolean {
  if (!_buildInProgress) return false;

  // Auto-clear stale locks
  if (_buildStartedAt && (Date.now() - _buildStartedAt) > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[eDNA Cache] Auto-clearing stale build lock');
    _buildInProgress = false;
    _buildStartedAt = null;
    return false;
  }

  return true;
}

export function seteDNABuildInProgress(inProgress: boolean): void {
  _buildInProgress = inProgress;
  _buildStartedAt = inProgress ? Date.now() : null;
}

// ── Cache Warming ────────────────────────────────────────────────────────────

export async function ensureeDNAWarmed(): Promise<void> {
  if (_memCache) return;

  ensureDiskLoaded();
  if (_memCache) return;

  await loadFromBlob();
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function geteDNAData(huc12: string): Promise<eDNAData | null> {
  await ensureeDNAWarmed();
  if (!_memCache) return null;
  return _memCache.hucs[huc12] || null;
}

export async function geteDNACacheStatus() {
  await ensureeDNAWarmed();
  if (!_memCache) {
    return {
      loaded: false,
      source: null,
      hucCount: 0,
      totalDetections: 0,
      built: null,
      lastDelta: null,
    };
  }

  return {
    loaded: true,
    source: _cacheSource,
    hucCount: _memCache._meta.hucCount,
    totalDetections: _memCache._meta.totalDetections,
    built: _memCache._meta.built,
    lastDelta: _lastDelta,
  };
}

export async function seteDNACache(newData: eDNACacheData): Promise<void> {
  const oldData = _memCache;
  _memCache = newData;
  _cacheSource = 'fresh';

  // Compute delta for monitoring
  if (oldData) {
    _lastDelta = computeCacheDelta(
      oldData._meta.hucCount,
      newData._meta.hucCount,
      'HUCs with eDNA data'
    );
  }

  // Persist to both disk and blob
  saveToDisk(newData);
  await saveCacheToBlob('edna.json', newData);
}

// ── Utility Functions ────────────────────────────────────────────────────────

export function calculateBiodiversityIndex(detections: eDNADetection[]): number {
  if (detections.length === 0) return 0;

  const uniqueSpecies = new Set(detections.map(d => d.scientificName)).size;
  const highConfidenceCount = detections.filter(d => d.confidence === 'high').length;
  const recentCount = detections.filter(d => {
    const daysSince = (Date.now() - new Date(d.detectionDate).getTime()) / (24 * 60 * 60 * 1000);
    return daysSince <= 365; // Within last year
  }).length;

  // Biodiversity index: species richness + data quality + recency
  const richness = Math.min(uniqueSpecies / 20, 1) * 40;  // Max 40 points for 20+ species
  const quality = (highConfidenceCount / Math.max(detections.length, 1)) * 30;  // Max 30 points
  const recency = (recentCount / Math.max(detections.length, 1)) * 30;  // Max 30 points

  return Math.round(richness + quality + recency);
}

export function classifyThreatStatus(scientificName: string, commonName?: string): 'endangered' | 'threatened' | 'invasive' | 'native' {
  // This would integrate with USFWS and invasive species databases
  // For now, basic keyword detection
  const name = `${scientificName} ${commonName || ''}`.toLowerCase();

  // Common invasive aquatic species keywords
  const invasiveKeywords = ['rusty crayfish', 'zebra mussel', 'asian carp', 'northern snakehead', 'hydrilla', 'eurasian milfoil'];
  if (invasiveKeywords.some(keyword => name.includes(keyword))) {
    return 'invasive';
  }

  // Would be enhanced with USFWS ECOS integration for T&E status
  return 'native'; // Default assumption
}