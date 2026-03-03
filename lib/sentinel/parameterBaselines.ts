/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Parameter Baselines                                */
/*  30-day rolling baselines for USGS IV parameters per HUC-8.       */
/*  Provides z-score deviations for coordination/classification.      */
/* ------------------------------------------------------------------ */

import fs from 'fs';
import path from 'path';
import { BLOB_PATHS, DISK_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface BaselineEntry {
  mean: number;
  stdDev: number;
  count: number;
  lastUpdated: string;
}

type BaselineMap = Record<string, BaselineEntry>; // key: "huc8|paramCd"

/* ------------------------------------------------------------------ */
/*  State                                                             */
/* ------------------------------------------------------------------ */

let _baselines: BaselineMap = {};
let _diskLoaded = false;
let _blobChecked = false;
let _dirty = false;

function baselineKey(huc8: string, paramCd: string): string {
  return `${huc8}|${paramCd}`;
}

/* ------------------------------------------------------------------ */
/*  Disk/Blob Persistence                                             */
/* ------------------------------------------------------------------ */

function diskPath(): string {
  return path.resolve(process.cwd(), DISK_PATHS.baselines);
}

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  try {
    const raw = fs.readFileSync(diskPath(), 'utf-8');
    const parsed = JSON.parse(raw) as BaselineMap;
    if (parsed && typeof parsed === 'object') _baselines = parsed;
  } catch { /* no disk cache */ }
}

function saveToDisk(): void {
  try {
    const dir = path.dirname(diskPath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(diskPath(), JSON.stringify(_baselines));
  } catch { /* non-fatal */ }
}

export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (Object.keys(_baselines).length > 0) return;
  if (_blobChecked) return;
  _blobChecked = true;

  const data = await loadCacheFromBlob<BaselineMap>(BLOB_PATHS.baselines);
  if (data && Object.keys(data).length > 0) {
    _baselines = data;
    saveToDisk();
  }
}

export async function persistBaselines(): Promise<void> {
  if (!_dirty) return;
  _dirty = false;
  saveToDisk();
  await saveCacheToBlob(BLOB_PATHS.baselines, _baselines);
}

/* ------------------------------------------------------------------ */
/*  Incremental Update (Welford's online algorithm)                   */
/* ------------------------------------------------------------------ */

export function updateBaseline(huc8: string, paramCd: string, value: number): void {
  ensureDiskLoaded();
  const key = baselineKey(huc8, paramCd);
  const entry = _baselines[key];

  if (!entry) {
    _baselines[key] = {
      mean: value,
      stdDev: 0,
      count: 1,
      lastUpdated: new Date().toISOString(),
    };
    _dirty = true;
    return;
  }

  const newCount = entry.count + 1;
  const delta = value - entry.mean;
  const newMean = entry.mean + delta / newCount;
  const delta2 = value - newMean;

  // Running variance (Welford's)
  const m2 = (entry.stdDev * entry.stdDev) * (entry.count - 1) + delta * delta2;
  const newStdDev = newCount > 1 ? Math.sqrt(m2 / (newCount - 1)) : 0;

  // Cap at 30 days of samples (~2880 for 15-min USGS data)
  const cappedCount = Math.min(newCount, 2880);

  _baselines[key] = {
    mean: newMean,
    stdDev: newStdDev,
    count: cappedCount,
    lastUpdated: new Date().toISOString(),
  };
  _dirty = true;
}

/* ------------------------------------------------------------------ */
/*  Z-Score Query                                                     */
/* ------------------------------------------------------------------ */

export function getDeviation(huc8: string, paramCd: string, value: number): number | null {
  ensureDiskLoaded();
  const key = baselineKey(huc8, paramCd);
  const entry = _baselines[key];

  if (!entry || entry.count < 10 || entry.stdDev === 0) return null;
  return (value - entry.mean) / entry.stdDev;
}

export function getBaseline(huc8: string, paramCd: string): BaselineEntry | null {
  ensureDiskLoaded();
  return _baselines[baselineKey(huc8, paramCd)] ?? null;
}

export function getAllBaselines(): BaselineMap {
  ensureDiskLoaded();
  return _baselines;
}
