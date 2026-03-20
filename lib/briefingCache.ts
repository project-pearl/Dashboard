/**
 * Briefing Cache — Real-time overnight changes and stakeholder activity data
 *
 * Populated by /api/cron/build-briefings (daily cron at 1 AM)
 * Aggregates overnight changes from EPA ECHO, SDWIS, ATTAINS, state DEQ systems
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type BriefingEntityType =
  | 'local' | 'ms4' | 'utility' | 'k12' | 'ngo'
  | 'university' | 'esg' | 'biotech' | 'investor';

export interface ChangeItem {
  id: string;
  timestamp: string;
  type: 'enforcement' | 'violation' | 'permit' | 'monitoring' | 'alert' | 'compliance' | 'infrastructure';
  source: 'EPA_ECHO' | 'SDWIS' | 'ATTAINS' | 'STATE_DEQ' | 'SCADA' | 'USGS' | 'FDA' | 'SEC';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  summary: string;
  details: string;
  entityRelevance: BriefingEntityType[];
  geography?: {
    state?: string;
    county?: string;
    locality?: string;
    lat?: number;
    lng?: number;
  };
  facilityId?: string;
  permitId?: string;
  waterbodyId?: string;
  actionRequired: boolean;
  deadline?: string;
  contactInfo?: string;
}

export interface StakeholderItem {
  id: string;
  timestamp: string;
  type: 'media' | 'complaint' | 'council' | 'public_comment' | 'advocacy' | 'regulatory_response';
  source: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  details: string;
  entityRelevance: BriefingEntityType[];
  geography?: {
    state?: string;
    county?: string;
    locality?: string;
  };
  status: 'monitor' | 'review_needed' | 'prepare_briefing' | 'immediate_action';
  dueDate?: string;
  assignedTo?: string;
  tags: string[];
}

export interface BriefingData {
  entityType: BriefingEntityType;
  entityName: string;
  state: string;
  changes: ChangeItem[];
  stakeholders: StakeholderItem[];
  lastUpdated: string;
  totalChanges: number;
  criticalCount: number;
  actionRequiredCount: number;
}

interface GridCell {
  briefings: Record<string, BriefingData>; // Keyed by entityType-entityName-state
}

export interface BriefingCacheMeta {
  built: string;
  totalBriefings: number;
  totalChanges: number;
  totalStakeholderItems: number;
  entitiesProcessed: number;
  statesProcessed: string[];
  sourcesProcessed: string[];
  gridCells: number;
}

interface BriefingCacheData {
  _meta: BriefingCacheMeta;
  grid: Record<string, GridCell>;
  _buildInProgress: boolean;
  _buildStartedAt: string | null;
}

export interface BriefingLookupResult {
  briefingData: BriefingData | null;
  cacheBuilt: string;
  lastUpdated: string;
}

// ── Cache State ──────────────────────────────────────────────────────────────

let briefingCache: BriefingCacheData = {
  _meta: {
    built: '',
    totalBriefings: 0,
    totalChanges: 0,
    totalStakeholderItems: 0,
    entitiesProcessed: 0,
    statesProcessed: [],
    sourcesProcessed: [],
    gridCells: 0,
  },
  grid: {},
  _buildInProgress: false,
  _buildStartedAt: null
};

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const CACHE_KEY = 'briefing-cache';

// ── Grid Utils ───────────────────────────────────────────────────────────────

function gridKey(state: string): string {
  return state.toLowerCase();
}

function briefingKey(entityType: BriefingEntityType, entityName: string, state: string): string {
  return `${entityType}-${entityName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${state.toLowerCase()}`;
}

function loadCacheFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'briefings.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?._meta || !data?.grid) return false;
    briefingCache = data;
    console.log(`[Briefing Cache] Loaded from disk (${data._meta.totalBriefings} briefings)`);
    return true;
  } catch {
    return false;
  }
}

function saveCacheToDisk(data: BriefingCacheData): void {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, 'briefings.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(data);
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[Briefing Cache] Saved to disk (${sizeMB}MB, ${data._meta.totalBriefings} briefings)`);
  } catch {}
  briefingCache = data;
}

// ── Build Lock Management ────────────────────────────────────────────────────

function isBuildInProgress(): boolean {
  if (!briefingCache._buildInProgress) return false;

  const startedAt = briefingCache._buildStartedAt;
  if (!startedAt) return false;

  const elapsed = Date.now() - new Date(startedAt).getTime();
  if (elapsed > BUILD_LOCK_TIMEOUT_MS) {
    console.log('Briefing cache build lock expired, auto-clearing');
    briefingCache._buildInProgress = false;
    briefingCache._buildStartedAt = null;
    saveCacheToDisk(briefingCache);
    return false;
  }

  return true;
}

function setBuildInProgress(inProgress: boolean): void {
  briefingCache._buildInProgress = inProgress;
  briefingCache._buildStartedAt = inProgress ? new Date().toISOString() : null;
  saveCacheToDisk(briefingCache);
}

// ── Public API ───────────────────────────────────────────────────────────────

let _diskLoaded = false;
function ensureDiskLoaded() {
  if (!_diskLoaded) {
    _diskLoaded = true;
    loadCacheFromDisk();
  }
}

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (briefingCache._meta.built) return;
  if (_blobChecked) return;
  _blobChecked = true;

  try {
    const blobData = await loadCacheFromBlob(CACHE_KEY);
    if (blobData?._meta?.built) {
      briefingCache = blobData;
      saveCacheToDisk(briefingCache);
    }
  } catch (error) {
    console.warn('Failed to load briefing cache:', error);
  }
}

// ── Sync Access ──────────────────────────────────────────────────────────────

export function getBriefingData(
  entityType: BriefingEntityType,
  entityName: string,
  state: string
): BriefingData | null {
  ensureDiskLoaded();
  if (!briefingCache._meta.built) return null;

  const gKey = gridKey(state);
  const bKey = briefingKey(entityType, entityName, state);
  const cell = briefingCache.grid[gKey];

  return cell?.briefings[bKey] || null;
}

export function getRecentChanges(
  entityType?: BriefingEntityType,
  state?: string,
  hoursBack: number = 24
): ChangeItem[] {
  ensureDiskLoaded();
  if (!briefingCache._meta.built) return [];

  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const allChanges: ChangeItem[] = [];

  Object.values(briefingCache.grid).forEach(cell => {
    Object.values(cell.briefings).forEach(briefing => {
      if (entityType && !briefing.entityType.includes(entityType)) return;
      if (state && briefing.state !== state) return;

      briefing.changes.forEach(change => {
        if (change.timestamp >= cutoff) {
          allChanges.push(change);
        }
      });
    });
  });

  return allChanges.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 50);
}

// ── Async Access ─────────────────────────────────────────────────────────────

export async function getBriefingDataAsync(
  entityType: BriefingEntityType,
  entityName: string,
  state: string
): Promise<BriefingLookupResult> {
  await ensureWarmed();

  const briefingData = getBriefingData(entityType, entityName, state);

  return {
    briefingData,
    cacheBuilt: briefingCache._meta.built,
    lastUpdated: briefingData?.lastUpdated || briefingCache._meta.built,
  };
}

// ── Cache Management ─────────────────────────────────────────────────────────

export function addBriefingData(briefing: BriefingData): void {
  const gKey = gridKey(briefing.state);
  const bKey = briefingKey(briefing.entityType, briefing.entityName, briefing.state);

  if (!briefingCache.grid[gKey]) {
    briefingCache.grid[gKey] = { briefings: {} };
  }

  briefingCache.grid[gKey].briefings[bKey] = briefing;
  saveCacheToDisk(briefingCache);
}

export async function setBriefingCache(newData: BriefingCacheData): Promise<void> {
  briefingCache = newData;
  saveCacheToDisk(briefingCache);
  await saveCacheToBlob(CACHE_KEY, briefingCache);
}

export function getBuildStatus(): { inProgress: boolean; startedAt: string | null } {
  return {
    inProgress: isBuildInProgress(),
    startedAt: briefingCache._buildStartedAt
  };
}

export async function getBriefingCacheDelta(): Promise<CacheDelta | null> {
  await ensureWarmed();
  return computeCacheDelta('briefings', briefingCache._meta.built);
}

export { setBuildInProgress, isBuildInProgress };