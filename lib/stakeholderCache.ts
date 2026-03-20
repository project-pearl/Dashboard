/**
 * Stakeholder Activity Cache — Real-time stakeholder monitoring data
 *
 * Populated by /api/cron/rebuild-stakeholder (daily cron)
 * Tracks: public comments, media mentions, legislative activity, NGO actions
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type StakeholderActivityType =
  | 'public-comment'
  | 'media-mention'
  | 'legislative'
  | 'ngo-action'
  | 'industry-position'
  | 'academic-research'
  | 'agency-notice'
  | 'legal-filing';

export type StakeholderStatus =
  | 'action-required'
  | 'monitoring'
  | 'review-needed'
  | 'prepare-response'
  | 'pending'
  | 'closed';

export interface StakeholderActivity {
  id: string;
  type: StakeholderActivityType;
  stakeholder: string;           // Organization/entity name
  title: string;                 // Brief activity title
  description: string;           // Detailed description
  status: StakeholderStatus;
  dateDetected: string;          // ISO date when we detected this
  activityDate: string;          // ISO date when activity occurred
  sourceUrl?: string;           // Link to original source
  jurisdiction: string;          // State abbreviation or 'federal'
  tags: string[];               // Topic tags (pfas, tmdl, enforcement, etc.)
  priority: 'low' | 'medium' | 'high';
  sentiment: 'positive' | 'neutral' | 'negative';
  relatedPrograms: string[];    // CWA, SDWA, etc.
}

export interface MediaMention {
  id: string;
  outlet: string;
  headline: string;
  publishedAt: string;
  url: string;
  jurisdiction: string;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  reach: number;                // Estimated audience size
}

export interface PublicComment {
  id: string;
  docketId: string;
  title: string;
  submittedBy: string;
  submittedAt: string;
  commentText: string;
  jurisdiction: string;
  ruleTitle: string;
  status: 'open' | 'closed' | 'under-review';
  responseDeadline?: string;
}

export interface LegislativeActivity {
  id: string;
  billNumber: string;
  title: string;
  chamber: 'house' | 'senate' | 'joint';
  status: string;
  lastAction: string;
  lastActionDate: string;
  jurisdiction: string;
  sponsor: string;
  waterQualityRelevance: string;
  nextHearing?: string;
}

interface GridCell {
  activities: StakeholderActivity[];
  media: MediaMention[];
  comments: PublicComment[];
  legislative: LegislativeActivity[];
}

export interface StakeholderCacheMeta {
  built: string;
  activityCount: number;
  mediaCount: number;
  commentCount: number;
  legislativeCount: number;
  jurisdictionsProcessed: string[];
  gridCells: number;
  sourcesProcessed: string[];
}

interface StakeholderCacheData {
  _meta: StakeholderCacheMeta;
  grid: Record<string, GridCell>;
  _buildInProgress: boolean;
  _buildStartedAt: string | null;
}

export interface StakeholderLookupResult {
  activities: StakeholderActivity[];
  media: MediaMention[];
  comments: PublicComment[];
  legislative: LegislativeActivity[];
  cacheBuilt: string;
  lastUpdated: string;
}

// ── Cache State ──────────────────────────────────────────────────────────────

let stakeholderCache: StakeholderCacheData = {
  _meta: {
    built: '',
    activityCount: 0,
    mediaCount: 0,
    commentCount: 0,
    legislativeCount: 0,
    jurisdictionsProcessed: [],
    gridCells: 0,
    sourcesProcessed: []
  },
  grid: {},
  _buildInProgress: false,
  _buildStartedAt: null
};

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const CACHE_KEY = 'stakeholder-cache';

// ── Grid Utils ───────────────────────────────────────────────────────────────

function gridKey(jurisdiction: string): string {
  return jurisdiction.toLowerCase();
}

function loadCacheFromDisk(): StakeholderCacheData {
  // Disk persistence helper (would implement actual file I/O)
  return stakeholderCache;
}

function saveCacheToDisk(data: StakeholderCacheData): void {
  // Disk persistence helper (would implement actual file I/O)
  stakeholderCache = data;
}

// ── Build Lock Management ────────────────────────────────────────────────────

function isBuildInProgress(): boolean {
  if (!stakeholderCache._buildInProgress) return false;

  const startedAt = stakeholderCache._buildStartedAt;
  if (!startedAt) return false;

  const elapsed = Date.now() - new Date(startedAt).getTime();
  if (elapsed > BUILD_LOCK_TIMEOUT_MS) {
    console.log('Stakeholder cache build lock expired, auto-clearing');
    stakeholderCache._buildInProgress = false;
    stakeholderCache._buildStartedAt = null;
    saveCacheToDisk(stakeholderCache);
    return false;
  }

  return true;
}

function setBuildInProgress(inProgress: boolean): void {
  stakeholderCache._buildInProgress = inProgress;
  stakeholderCache._buildStartedAt = inProgress ? new Date().toISOString() : null;
  saveCacheToDisk(stakeholderCache);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function ensureWarmed(): Promise<void> {
  if (stakeholderCache._meta.built) return;

  try {
    const diskData = loadCacheFromDisk();
    if (diskData._meta.built) {
      stakeholderCache = diskData;
      return;
    }

    const blobData = await loadCacheFromBlob(CACHE_KEY);
    if (blobData?._meta?.built) {
      stakeholderCache = blobData;
      saveCacheToDisk(stakeholderCache);
    }
  } catch (error) {
    console.warn('Failed to load stakeholder cache:', error);
  }
}

export async function getStakeholderData(jurisdiction?: string): Promise<StakeholderLookupResult> {
  await ensureWarmed();

  if (!jurisdiction || jurisdiction === 'federal') {
    // Return national aggregation
    const allActivities: StakeholderActivity[] = [];
    const allMedia: MediaMention[] = [];
    const allComments: PublicComment[] = [];
    const allLegislative: LegislativeActivity[] = [];

    Object.values(stakeholderCache.grid).forEach(cell => {
      allActivities.push(...cell.activities);
      allMedia.push(...cell.media);
      allComments.push(...cell.comments);
      allLegislative.push(...cell.legislative);
    });

    return {
      activities: allActivities.slice(0, 50), // Limit for performance
      media: allMedia.slice(0, 30),
      comments: allComments.slice(0, 20),
      legislative: allLegislative.slice(0, 15),
      cacheBuilt: stakeholderCache._meta.built,
      lastUpdated: stakeholderCache._meta.built
    };
  }

  const key = gridKey(jurisdiction);
  const cell = stakeholderCache.grid[key] || {
    activities: [],
    media: [],
    comments: [],
    legislative: []
  };

  return {
    activities: cell.activities,
    media: cell.media,
    comments: cell.comments,
    legislative: cell.legislative,
    cacheBuilt: stakeholderCache._meta.built,
    lastUpdated: stakeholderCache._meta.built
  };
}

export function addStakeholderActivity(activity: StakeholderActivity): void {
  const key = gridKey(activity.jurisdiction);
  if (!stakeholderCache.grid[key]) {
    stakeholderCache.grid[key] = { activities: [], media: [], comments: [], legislative: [] };
  }

  stakeholderCache.grid[key].activities.push(activity);
  saveCacheToDisk(stakeholderCache);
}

export function addMediaMention(mention: MediaMention): void {
  const key = gridKey(mention.jurisdiction);
  if (!stakeholderCache.grid[key]) {
    stakeholderCache.grid[key] = { activities: [], media: [], comments: [], legislative: [] };
  }

  stakeholderCache.grid[key].media.push(mention);
  saveCacheToDisk(stakeholderCache);
}

export function addPublicComment(comment: PublicComment): void {
  const key = gridKey(comment.jurisdiction);
  if (!stakeholderCache.grid[key]) {
    stakeholderCache.grid[key] = { activities: [], media: [], comments: [], legislative: [] };
  }

  stakeholderCache.grid[key].comments.push(comment);
  saveCacheToDisk(stakeholderCache);
}

export async function setStakeholderCache(newData: StakeholderCacheData): Promise<void> {
  stakeholderCache = newData;
  saveCacheToDisk(stakeholderCache);
  await saveCacheToBlob(CACHE_KEY, stakeholderCache);
}

export function getBuildStatus(): { inProgress: boolean; startedAt: string | null } {
  return {
    inProgress: isBuildInProgress(),
    startedAt: stakeholderCache._buildStartedAt
  };
}

export async function getStakeholderCacheDelta(): Promise<CacheDelta | null> {
  await ensureWarmed();
  return computeCacheDelta('stakeholder', stakeholderCache._meta.built);
}

export { setBuildInProgress, isBuildInProgress };