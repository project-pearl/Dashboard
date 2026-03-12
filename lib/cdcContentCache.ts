/**
 * CDC Content Services API Cache
 * Emergency communications, outbreak media, and public health alerts
 * Part of Tier 1 HHS integration - critical for emergency communications intelligence
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

export type CDCContentCategory = 'emergency_alert' | 'outbreak_media' | 'health_guidance' | 'press_release' | 'safety_communication';

export interface CDCContentRecord extends HHSHealthRecord {
  contentSpecific: {
    contentType: CDCContentCategory;
    title: string;
    summary: string;
    contentUrl?: string;
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    targetAudience: string[];
    topics: string[];
    mediaType: 'text' | 'video' | 'audio' | 'image' | 'document';
    waterRelated: boolean;
    emergencyStatus: boolean;
    publicationDate: string;
  };
}

interface CDCContentCacheData {
  records: CDCContentRecord[];
  summary: {
    totalRecords: number;
    categoryCounts: Record<CDCContentCategory, number>;
    urgencyDistribution: Record<string, number>;
    waterRelatedContent: number;
    emergencyAlerts: number;
    recentAlerts: number;
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let cdcContentCache: CDCContentCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _cdcContentCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'cdc-content.json';

export function getCDCContentCacheStatus() {
  return {
    loaded: _cdcContentCacheLoaded && cdcContentCache !== null,
    built: lastFetched,
    recordCount: cdcContentCache?.records?.length || 0,
    emergencyAlerts: cdcContentCache?.summary?.emergencyAlerts || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getCDCContentCache(): CDCContentRecord[] { return cdcContentCache?.records || []; }

export async function setCDCContentCache(data: CDCContentCacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No CDC Content data to cache'); return; }
  const prevCounts = cdcContentCache ? { recordCount: cdcContentCache.summary.totalRecords } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalRecords }, lastFetched);
  cdcContentCache = data; lastFetched = new Date().toISOString(); _cdcContentCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('CDC Content build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_cdcContentCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { cdcContentCache = diskData; _cdcContentCacheLoaded = true; return; }
  } catch (e) { console.warn('CDC Content disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<CDCContentCacheData>(CACHE_FILE);
    if (blobData?.records?.length) { cdcContentCache = blobData; _cdcContentCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('CDC Content blob load failed:', e); }
}

async function loadFromDisk(): Promise<CDCContentCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[CDC Content Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: CDCContentCacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[CDC Content Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('CDC Content disk save failed:', e); }
}

export function processCDCContentData(rawRecords: any[]): CDCContentRecord[] {
  return rawRecords.map(raw => ({
    id: `cdc_content_${raw.id || Date.now()}`,
    source: 'cdc_content',
    location: { state: 'US' },
    temporal: { reportDate: raw.date_published || raw.last_reviewed || new Date().toISOString(), year: new Date(raw.date_published || new Date()).getFullYear() },
    healthMetrics: [{ category: 'communication', measure: 'urgency', value: raw.urgency_level === 'critical' ? 100 : raw.urgency_level === 'high' ? 75 : 50, unit: 'score' }],
    contentSpecific: {
      contentType: categorizeContent(raw.content_type || raw.type),
      title: raw.title || 'Untitled Content',
      summary: raw.summary || raw.description || '',
      contentUrl: raw.url || raw.link,
      urgencyLevel: normalizeUrgency(raw.urgency || raw.priority),
      targetAudience: Array.isArray(raw.audience) ? raw.audience : (raw.audience ? [raw.audience] : ['general']),
      topics: Array.isArray(raw.topics) ? raw.topics : (raw.topic ? [raw.topic] : []),
      mediaType: raw.media_type || 'text',
      waterRelated: isContentWaterRelated(raw.title, raw.summary, raw.topics),
      emergencyStatus: isEmergencyContent(raw.urgency, raw.type),
      publicationDate: raw.date_published || raw.last_reviewed || new Date().toISOString(),
    }
  }));
}

function categorizeContent(contentType: string): CDCContentCategory {
  const type = contentType?.toLowerCase() || '';
  if (type.includes('emergency') || type.includes('alert')) return 'emergency_alert';
  if (type.includes('outbreak') || type.includes('media')) return 'outbreak_media';
  if (type.includes('guidance') || type.includes('recommendation')) return 'health_guidance';
  if (type.includes('press') || type.includes('release')) return 'press_release';
  return 'safety_communication';
}

function normalizeUrgency(urgency: string): 'low' | 'medium' | 'high' | 'critical' {
  const u = urgency?.toLowerCase() || '';
  if (u.includes('critical') || u.includes('emergency')) return 'critical';
  if (u.includes('high') || u.includes('urgent')) return 'high';
  if (u.includes('medium') || u.includes('moderate')) return 'medium';
  return 'low';
}

function isContentWaterRelated(title: string, summary: string, topics: any): boolean {
  const text = `${title} ${summary} ${Array.isArray(topics) ? topics.join(' ') : topics || ''}`.toLowerCase();
  return ['water', 'drinking', 'aqua', 'contamination', 'waterborne'].some(keyword => text.includes(keyword));
}

function isEmergencyContent(urgency: string, type: string): boolean {
  const text = `${urgency || ''} ${type || ''}`.toLowerCase();
  return text.includes('emergency') || text.includes('critical') || text.includes('alert');
}

export async function fetchCDCContentData(): Promise<any[]> {
  // Mock CDC content data - in practice would fetch from CDC Content API
  const currentDate = new Date();
  const mockContent = [
    { id: 1, title: 'Water System Contamination Alert', summary: 'Emergency alert for bacterial contamination in municipal water system', content_type: 'emergency_alert', urgency: 'critical', audience: ['public', 'health_officials'], topics: ['water_safety', 'contamination'], date_published: new Date(currentDate.getTime() - 86400000).toISOString() },
    { id: 2, title: 'Waterborne Illness Investigation Update', summary: 'Ongoing investigation of E.coli outbreak linked to recreational water', content_type: 'outbreak_media', urgency: 'high', audience: ['public', 'media'], topics: ['waterborne_illness', 'e_coli'], date_published: new Date(currentDate.getTime() - 172800000).toISOString() },
    { id: 3, title: 'Safe Water Practices During Emergency', summary: 'Guidance for ensuring water safety during natural disasters', content_type: 'health_guidance', urgency: 'medium', audience: ['emergency_responders', 'public'], topics: ['water_safety', 'emergency_preparedness'], date_published: new Date(currentDate.getTime() - 259200000).toISOString() },
  ];
  return mockContent;
}

export async function buildCDCContentCacheData(records: CDCContentRecord[]): Promise<CDCContentCacheData> {
  const categoryCounts: Record<CDCContentCategory, number> = { emergency_alert: 0, outbreak_media: 0, health_guidance: 0, press_release: 0, safety_communication: 0 };
  const urgencyDistribution: Record<string, number> = {};
  let waterRelatedContent = 0; let emergencyAlerts = 0;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let recentAlerts = 0;

  records.forEach(record => {
    categoryCounts[record.contentSpecific.contentType]++;
    urgencyDistribution[record.contentSpecific.urgencyLevel] = (urgencyDistribution[record.contentSpecific.urgencyLevel] || 0) + 1;
    if (record.contentSpecific.waterRelated) waterRelatedContent++;
    if (record.contentSpecific.emergencyStatus) emergencyAlerts++;
    if (new Date(record.contentSpecific.publicationDate).getTime() > oneWeekAgo) recentAlerts++;
  });

  return {
    records, summary: { totalRecords: records.length, categoryCounts, urgencyDistribution, waterRelatedContent, emergencyAlerts, recentAlerts },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

export function getEmergencyAlerts(): CDCContentRecord[] {
  return cdcContentCache?.records?.filter(r => r.contentSpecific.emergencyStatus && r.contentSpecific.urgencyLevel === 'critical') || [];
}

export function getWaterRelatedContent(): CDCContentRecord[] {
  return cdcContentCache?.records?.filter(r => r.contentSpecific.waterRelated) || [];
}