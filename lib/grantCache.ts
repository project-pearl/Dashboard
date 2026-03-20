/**
 * Grant Opportunities Cache — Real-time federal and foundation grant data
 *
 * Populated by /api/cron/rebuild-grants (daily cron)
 * Tracks: Federal grants, foundation opportunities, application deadlines
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type GrantType =
  | 'federal-grant'
  | 'state-grant'
  | 'foundation-grant'
  | 'corporate-grant'
  | 'research-grant'
  | 'infrastructure-grant';

export type GrantStatus =
  | 'open'
  | 'closing-soon'
  | 'closed'
  | 'awarded'
  | 'cancelled';

export type EligibilityType =
  | 'state-gov'
  | 'local-gov'
  | 'nonprofit'
  | 'university'
  | 'tribe'
  | 'private'
  | 'individual';

export interface GrantOpportunity {
  id: string;
  title: string;
  agency: string;                    // EPA, NOAA, NSF, etc.
  funder: string;                    // Organization providing funding
  type: GrantType;
  status: GrantStatus;
  openDate: string;
  closeDate: string;
  awardDate?: string;
  fundingAmount: {
    min?: number;
    max?: number;
    total: number;
  };
  awards: {
    anticipated: number;
    typical: number;
  };
  eligibility: EligibilityType[];
  description: string;
  waterQualityRelevance: string;
  requirements: string[];
  matchingFunds: {
    required: boolean;
    percentage?: number;
    description?: string;
  };
  programs: string[];               // CWA, SDWA, WIFIA, SRF, etc.
  keywords: string[];
  cfda?: string;                    // Catalog of Federal Domestic Assistance number
  applicationUrl: string;
  contactEmail?: string;
  contactPhone?: string;
  lastUpdated: string;
  jurisdiction?: string;             // For state/local grants
  tags: string[];
}

export interface GrantDeadline {
  grantId: string;
  title: string;
  agency: string;
  closeDate: string;
  daysRemaining: number;
  urgency: 'critical' | 'urgent' | 'moderate' | 'normal';
  fundingAmount: number;
  applicationUrl: string;
}

export interface GrantMatch {
  grant: GrantOpportunity;
  matchScore: number;               // 0-100 compatibility score
  matchReasons: string[];
  eligibilityMet: boolean;
  fundingFit: 'excellent' | 'good' | 'fair' | 'poor';
}

interface GridCell {
  grants: GrantOpportunity[];
  deadlines: GrantDeadline[];
}

export interface GrantCacheMeta {
  built: string;
  grantCount: number;
  openGrantCount: number;
  totalFunding: number;
  deadlineCount: number;
  agenciesProcessed: string[];
  gridCells: number;
  sourcesProcessed: string[];
}

interface GrantCacheData {
  _meta: GrantCacheMeta;
  grid: Record<string, GridCell>;
  _buildInProgress: boolean;
  _buildStartedAt: string | null;
}

export interface GrantLookupResult {
  grants: GrantOpportunity[];
  deadlines: GrantDeadline[];
  cacheBuilt: string;
  lastUpdated: string;
  totalFunding: number;
}

// ── Cache State ──────────────────────────────────────────────────────────────

let grantCache: GrantCacheData = {
  _meta: {
    built: '',
    grantCount: 0,
    openGrantCount: 0,
    totalFunding: 0,
    deadlineCount: 0,
    agenciesProcessed: [],
    gridCells: 0,
    sourcesProcessed: []
  },
  grid: {},
  _buildInProgress: false,
  _buildStartedAt: null
};

const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000; // 12 minutes
const CACHE_KEY = 'grant-cache';

// ── Grid Utils ───────────────────────────────────────────────────────────────

function gridKey(jurisdiction: string): string {
  return jurisdiction?.toLowerCase() || 'federal';
}

function loadCacheFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'grants.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?._meta || !data?.grid) return false;
    grantCache = data;
    console.log(`[Grant Cache] Loaded from disk (${data._meta.grantCount} grants)`);
    return true;
  } catch {
    return false;
  }
}

function saveCacheToDisk(data: GrantCacheData): void {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, 'grants.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(data);
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[Grant Cache] Saved to disk (${sizeMB}MB, ${data._meta.grantCount} grants)`);
  } catch {}
  grantCache = data;
}

// ── Build Lock Management ────────────────────────────────────────────────────

function isBuildInProgress(): boolean {
  if (!grantCache._buildInProgress) return false;

  const startedAt = grantCache._buildStartedAt;
  if (!startedAt) return false;

  const elapsed = Date.now() - new Date(startedAt).getTime();
  if (elapsed > BUILD_LOCK_TIMEOUT_MS) {
    console.log('Grant cache build lock expired, auto-clearing');
    grantCache._buildInProgress = false;
    grantCache._buildStartedAt = null;
    saveCacheToDisk(grantCache);
    return false;
  }

  return true;
}

function setBuildInProgress(inProgress: boolean): void {
  grantCache._buildInProgress = inProgress;
  grantCache._buildStartedAt = inProgress ? new Date().toISOString() : null;
  saveCacheToDisk(grantCache);
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
  if (grantCache._meta.built) return;
  if (_blobChecked) return;
  _blobChecked = true;

  try {
    const blobData = await loadCacheFromBlob(CACHE_KEY);
    if (blobData?._meta?.built) {
      grantCache = blobData;
      saveCacheToDisk(grantCache);
    }
  } catch (error) {
    console.warn('Failed to load grant cache:', error);
  }
}

// ── Sync Access (for backward compatibility) ────────────────────────────────

export function getGrantsOpen(): GrantOpportunity[] {
  ensureDiskLoaded();
  if (!grantCache._meta.built) return [];

  const allGrants: GrantOpportunity[] = [];
  Object.values(grantCache.grid).forEach(cell => {
    allGrants.push(...cell.grants.filter(g => g.status === 'open'));
  });

  return allGrants.slice(0, 50);
}

export function getGrantsAll(): GrantOpportunity[] {
  ensureDiskLoaded();
  if (!grantCache._meta.built) return [];

  const allGrants: GrantOpportunity[] = [];
  Object.values(grantCache.grid).forEach(cell => {
    allGrants.push(...cell.grants);
  });

  return allGrants.slice(0, 100);
}

// ── Async Access ─────────────────────────────────────────────────────────────

export async function getGrantOpportunities(
  jurisdiction?: string,
  eligibility?: EligibilityType,
  maxAmount?: number,
  keywords?: string[]
): Promise<GrantLookupResult> {
  await ensureWarmed();

  const allGrants: GrantOpportunity[] = [];
  const allDeadlines: GrantDeadline[] = [];

  // Aggregate from appropriate grid cells
  if (!jurisdiction || jurisdiction === 'federal') {
    Object.values(grantCache.grid).forEach(cell => {
      allGrants.push(...cell.grants);
      allDeadlines.push(...cell.deadlines);
    });
  } else {
    const key = gridKey(jurisdiction);
    const cell = grantCache.grid[key];
    if (cell) {
      allGrants.push(...cell.grants);
      allDeadlines.push(...cell.deadlines);
    }
  }

  // Apply filters
  let filteredGrants = allGrants;

  if (eligibility) {
    filteredGrants = filteredGrants.filter(grant =>
      grant.eligibility.includes(eligibility)
    );
  }

  if (maxAmount) {
    filteredGrants = filteredGrants.filter(grant =>
      grant.fundingAmount.min ? grant.fundingAmount.min <= maxAmount : true
    );
  }

  if (keywords && keywords.length > 0) {
    filteredGrants = filteredGrants.filter(grant => {
      const searchText = `${grant.title} ${grant.description} ${grant.keywords.join(' ')}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    });
  }

  // Sort by deadline (urgent first) and funding amount
  filteredGrants.sort((a, b) => {
    const aDeadline = new Date(a.closeDate).getTime();
    const bDeadline = new Date(b.closeDate).getTime();
    const now = Date.now();

    // Prioritize grants closing soon
    if (aDeadline - now < 30 * 24 * 60 * 60 * 1000 && bDeadline - now >= 30 * 24 * 60 * 60 * 1000) return -1;
    if (bDeadline - now < 30 * 24 * 60 * 60 * 1000 && aDeadline - now >= 30 * 24 * 60 * 60 * 1000) return 1;

    // Then by funding amount (highest first)
    return b.fundingAmount.total - a.fundingAmount.total;
  });

  const totalFunding = filteredGrants.reduce((sum, grant) => sum + grant.fundingAmount.total, 0);

  return {
    grants: filteredGrants.slice(0, 50), // Limit for performance
    deadlines: allDeadlines
      .filter(deadline => new Date(deadline.closeDate) > new Date())
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 20),
    cacheBuilt: grantCache._meta.built,
    lastUpdated: grantCache._meta.built,
    totalFunding
  };
}

export async function getUpcomingDeadlines(daysAhead: number = 30): Promise<GrantDeadline[]> {
  await ensureWarmed();

  const now = new Date();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  const allDeadlines: GrantDeadline[] = [];
  Object.values(grantCache.grid).forEach(cell => {
    allDeadlines.push(...cell.deadlines);
  });

  return allDeadlines
    .filter(deadline => {
      const closeDate = new Date(deadline.closeDate);
      return closeDate > now && closeDate <= cutoffDate;
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export async function findGrantMatches(
  criteria: {
    organization: string;
    eligibility: EligibilityType[];
    focusAreas: string[];
    maxFunding?: number;
    geography?: string;
  }
): Promise<GrantMatch[]> {
  await ensureWarmed();

  const allGrants: GrantOpportunity[] = [];
  Object.values(grantCache.grid).forEach(cell => {
    allGrants.push(...cell.grants.filter(g => g.status === 'open' || g.status === 'closing-soon'));
  });

  const matches: GrantMatch[] = allGrants
    .map(grant => {
      let score = 0;
      const reasons: string[] = [];

      // Eligibility check (mandatory)
      const eligibilityMet = grant.eligibility.some(e => criteria.eligibility.includes(e));
      if (!eligibilityMet) return null;

      score += 25; // Base score for eligibility
      reasons.push(`Eligible for ${grant.eligibility.filter(e => criteria.eligibility.includes(e)).join(', ')}`);

      // Focus area alignment
      const focusMatch = criteria.focusAreas.filter(area =>
        grant.keywords.some(keyword => keyword.toLowerCase().includes(area.toLowerCase())) ||
        grant.description.toLowerCase().includes(area.toLowerCase())
      );
      if (focusMatch.length > 0) {
        score += Math.min(focusMatch.length * 15, 30);
        reasons.push(`Matches focus areas: ${focusMatch.join(', ')}`);
      }

      // Funding fit
      let fundingFit: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
      if (criteria.maxFunding) {
        const grantMin = grant.fundingAmount.min || 0;
        const grantMax = grant.fundingAmount.max || grant.fundingAmount.total;

        if (criteria.maxFunding >= grantMin && criteria.maxFunding <= grantMax * 1.2) {
          fundingFit = 'excellent';
          score += 20;
          reasons.push('Funding amount is excellent fit');
        } else if (criteria.maxFunding >= grantMin * 0.8) {
          fundingFit = 'good';
          score += 15;
          reasons.push('Funding amount is good fit');
        } else if (criteria.maxFunding >= grantMin * 0.5) {
          fundingFit = 'fair';
          score += 10;
          reasons.push('Funding amount is fair fit');
        } else {
          fundingFit = 'poor';
          reasons.push('Funding amount may not be sufficient');
        }
      }

      // Geography bonus
      if (criteria.geography && grant.jurisdiction === criteria.geography) {
        score += 10;
        reasons.push(`Geographic match: ${criteria.geography}`);
      }

      // Deadline urgency (bonus for more time to apply)
      const daysRemaining = Math.ceil((new Date(grant.closeDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      if (daysRemaining > 30) {
        score += 10;
        reasons.push('Ample time to prepare application');
      } else if (daysRemaining < 14) {
        score -= 5;
        reasons.push('Deadline approaching soon');
      }

      return {
        grant,
        matchScore: Math.min(score, 100),
        matchReasons: reasons,
        eligibilityMet,
        fundingFit
      };
    })
    .filter((match): match is GrantMatch => match !== null)
    .filter(match => match.matchScore >= 25) // Minimum viable score
    .sort((a, b) => b.matchScore - a.matchScore);

  return matches.slice(0, 20);
}

export function addGrantOpportunity(grant: GrantOpportunity): void {
  const key = gridKey(grant.jurisdiction || 'federal');
  if (!grantCache.grid[key]) {
    grantCache.grid[key] = { grants: [], deadlines: [] };
  }

  grantCache.grid[key].grants.push(grant);

  // Generate deadline if applicable
  const daysRemaining = Math.ceil((new Date(grant.closeDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysRemaining > 0 && daysRemaining <= 90) {
    const urgency: 'critical' | 'urgent' | 'moderate' | 'normal' =
      daysRemaining <= 7 ? 'critical' :
      daysRemaining <= 14 ? 'urgent' :
      daysRemaining <= 30 ? 'moderate' : 'normal';

    grantCache.grid[key].deadlines.push({
      grantId: grant.id,
      title: grant.title,
      agency: grant.agency,
      closeDate: grant.closeDate,
      daysRemaining,
      urgency,
      fundingAmount: grant.fundingAmount.total,
      applicationUrl: grant.applicationUrl
    });
  }

  saveCacheToDisk(grantCache);
}

export async function setGrantCache(newData: GrantCacheData): Promise<void> {
  grantCache = newData;
  saveCacheToDisk(grantCache);
  await saveCacheToBlob(CACHE_KEY, grantCache);
}

export function getBuildStatus(): { inProgress: boolean; startedAt: string | null } {
  return {
    inProgress: isBuildInProgress(),
    startedAt: grantCache._buildStartedAt
  };
}

export async function getGrantCacheDelta(): Promise<CacheDelta | null> {
  await ensureWarmed();
  return computeCacheDelta('grants', grantCache._meta.built);
}

export { setBuildInProgress, isBuildInProgress };