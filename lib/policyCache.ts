/**
 * Policy Tracking Cache — Real-time regulatory policy data
 *
 * Populated by /api/cron/rebuild-policy (daily cron)
 * Tracks: Federal rules, state regulations, EPA guidance, comment periods
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type PolicyStatus =
  | 'proposed'
  | 'comment-period'
  | 'final-rule'
  | 'effective'
  | 'withdrawn'
  | 'superseded';

export type PolicyType =
  | 'federal-rule'
  | 'state-regulation'
  | 'epa-guidance'
  | 'court-decision'
  | 'executive-order'
  | 'congressional-bill';

export type WaterProgram =
  | 'CWA'
  | 'SDWA'
  | 'NPDES'
  | 'RCRA'
  | 'CERCLA'
  | 'TSCA'
  | 'FIFRA';

export interface PolicyRule {
  id: string;
  title: string;
  agency: string;
  type: PolicyType;
  status: PolicyStatus;
  effectiveDate?: string;
  proposedDate?: string;
  commentDeadline?: string;
  docketId?: string;
  federalRegisterNumber?: string;
  cfr?: string;                      // Code of Federal Regulations citation
  jurisdiction: string;              // 'federal' or state abbreviation
  programs: WaterProgram[];
  summary: string;
  impactDescription: string;
  pinConnection: string;             // How this affects PIN users
  assessmentUnits?: number;          // Number of waterbodies affected
  statesAffected: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  sourceUrl: string;
  lastUpdated: string;
}

export interface CommentPeriod {
  ruleId: string;
  docketId: string;
  title: string;
  agency: string;
  openDate: string;
  closeDate: string;
  extendedDate?: string;
  commentsReceived: number;
  commentUrl: string;
  status: 'open' | 'closed' | 'extended';
}

export interface RegulatoryCalendarItem {
  id: string;
  title: string;
  agency: string;
  expectedDate: string;
  type: 'proposed-rule' | 'final-rule' | 'guidance' | 'deadline';
  priority: 'high' | 'medium' | 'low';
  waterQualityRelevance: string;
}

interface GridCell {
  rules: PolicyRule[];
  commentPeriods: CommentPeriod[];
  calendar: RegulatoryCalendarItem[];
}

export interface PolicyCacheMeta {
  built: string;
  ruleCount: number;
  commentPeriodCount: number;
  calendarItemCount: number;
  jurisdictionsProcessed: string[];
  gridCells: number;
  sourcesProcessed: string[];
}

interface PolicyCacheData {
  _meta: PolicyCacheMeta;
  grid: Record<string, GridCell>;
  _buildInProgress: boolean;
  _buildStartedAt: string | null;
}

export interface PolicyLookupResult {
  rules: PolicyRule[];
  commentPeriods: CommentPeriod[];
  calendar: RegulatoryCalendarItem[];
  cacheBuilt: string;
  lastUpdated: string;
}

// ── Cache State ──────────────────────────────────────────────────────────────

let policyCache: PolicyCacheData = {
  _meta: {
    built: '',
    ruleCount: 0,
    commentPeriodCount: 0,
    calendarItemCount: 0,
    jurisdictionsProcessed: [],
    gridCells: 0,
    sourcesProcessed: []
  },
  grid: {},
  _buildInProgress: false,
  _buildStartedAt: null
};

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const CACHE_KEY = 'policy-cache';

// ── Grid Utils ───────────────────────────────────────────────────────────────

function gridKey(jurisdiction: string): string {
  return jurisdiction.toLowerCase();
}

function loadCacheFromDisk(): PolicyCacheData {
  return policyCache;
}

function saveCacheToDisk(data: PolicyCacheData): void {
  policyCache = data;
}

// ── Build Lock Management ────────────────────────────────────────────────────

function isBuildInProgress(): boolean {
  if (!policyCache._buildInProgress) return false;

  const startedAt = policyCache._buildStartedAt;
  if (!startedAt) return false;

  const elapsed = Date.now() - new Date(startedAt).getTime();
  if (elapsed > BUILD_LOCK_TIMEOUT_MS) {
    console.log('Policy cache build lock expired, auto-clearing');
    policyCache._buildInProgress = false;
    policyCache._buildStartedAt = null;
    saveCacheToDisk(policyCache);
    return false;
  }

  return true;
}

function setBuildInProgress(inProgress: boolean): void {
  policyCache._buildInProgress = inProgress;
  policyCache._buildStartedAt = inProgress ? new Date().toISOString() : null;
  saveCacheToDisk(policyCache);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function ensureWarmed(): Promise<void> {
  if (policyCache._meta.built) return;

  try {
    const diskData = loadCacheFromDisk();
    if (diskData._meta.built) {
      policyCache = diskData;
      return;
    }

    const blobData = await loadCacheFromBlob(CACHE_KEY);
    if (blobData?._meta?.built) {
      policyCache = blobData;
      saveCacheToDisk(policyCache);
    }
  } catch (error) {
    console.warn('Failed to load policy cache:', error);
  }
}

export async function getPolicyData(jurisdiction?: string, ruleType?: PolicyType): Promise<PolicyLookupResult> {
  await ensureWarmed();

  if (!jurisdiction || jurisdiction === 'federal') {
    // Return federal/national aggregation
    const allRules: PolicyRule[] = [];
    const allCommentPeriods: CommentPeriod[] = [];
    const allCalendar: RegulatoryCalendarItem[] = [];

    Object.values(policyCache.grid).forEach(cell => {
      allRules.push(...cell.rules);
      allCommentPeriods.push(...cell.commentPeriods);
      allCalendar.push(...cell.calendar);
    });

    // Filter by rule type if specified
    const filteredRules = ruleType
      ? allRules.filter(rule => rule.type === ruleType)
      : allRules;

    return {
      rules: filteredRules.slice(0, 100), // Limit for performance
      commentPeriods: allCommentPeriods.slice(0, 50),
      calendar: allCalendar.slice(0, 30),
      cacheBuilt: policyCache._meta.built,
      lastUpdated: policyCache._meta.built
    };
  }

  const key = gridKey(jurisdiction);
  const cell = policyCache.grid[key] || {
    rules: [],
    commentPeriods: [],
    calendar: []
  };

  const filteredRules = ruleType
    ? cell.rules.filter(rule => rule.type === ruleType)
    : cell.rules;

  return {
    rules: filteredRules,
    commentPeriods: cell.commentPeriods,
    calendar: cell.calendar,
    cacheBuilt: policyCache._meta.built,
    lastUpdated: policyCache._meta.built
  };
}

export async function getActiveCommentPeriods(): Promise<CommentPeriod[]> {
  await ensureWarmed();

  const now = new Date();
  const allCommentPeriods: CommentPeriod[] = [];

  Object.values(policyCache.grid).forEach(cell => {
    allCommentPeriods.push(...cell.commentPeriods);
  });

  return allCommentPeriods.filter(period => {
    const closeDate = new Date(period.extendedDate || period.closeDate);
    return period.status === 'open' && closeDate > now;
  });
}

export async function getUpcomingDeadlines(daysAhead: number = 30): Promise<RegulatoryCalendarItem[]> {
  await ensureWarmed();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  const allCalendar: RegulatoryCalendarItem[] = [];

  Object.values(policyCache.grid).forEach(cell => {
    allCalendar.push(...cell.calendar);
  });

  return allCalendar.filter(item => {
    const expectedDate = new Date(item.expectedDate);
    return expectedDate <= cutoffDate && expectedDate > new Date();
  }).sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime());
}

export function addPolicyRule(rule: PolicyRule): void {
  const key = gridKey(rule.jurisdiction);
  if (!policyCache.grid[key]) {
    policyCache.grid[key] = { rules: [], commentPeriods: [], calendar: [] };
  }

  policyCache.grid[key].rules.push(rule);
  saveCacheToDisk(policyCache);
}

export function addCommentPeriod(period: CommentPeriod): void {
  const key = gridKey('federal'); // Comment periods are typically federal
  if (!policyCache.grid[key]) {
    policyCache.grid[key] = { rules: [], commentPeriods: [], calendar: [] };
  }

  policyCache.grid[key].commentPeriods.push(period);
  saveCacheToDisk(policyCache);
}

export async function setPolicyCache(newData: PolicyCacheData): Promise<void> {
  policyCache = newData;
  saveCacheToDisk(policyCache);
  await saveCacheToBlob(CACHE_KEY, policyCache);
}

export function getBuildStatus(): { inProgress: boolean; startedAt: string | null } {
  return {
    inProgress: isBuildInProgress(),
    startedAt: policyCache._buildStartedAt
  };
}

export async function getPolicyCacheDelta(): Promise<CacheDelta | null> {
  await ensureWarmed();
  return computeCacheDelta('policy', policyCache._meta.built);
}

export { setBuildInProgress, isBuildInProgress };