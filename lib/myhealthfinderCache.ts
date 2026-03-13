/**
 * MyHealthfinder API Cache
 * Health topics, prevention guidelines, and personalized health recommendations
 * Part of Tier 1 HHS integration - critical for health guidance intelligence
 */

import { HHSAPIClient, type HHSHealthRecord, addMilitaryProximity, correlateWithWaterViolations } from './hhsDataUtils';
import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';

export type HealthTopicCategory = 'prevention' | 'screening' | 'treatment' | 'lifestyle' | 'nutrition' | 'exercise' | 'mental_health' | 'environmental';

export interface MyHealthfinderRecord extends HHSHealthRecord {
  healthfinderSpecific: {
    topicId: string;
    title: string;
    category: HealthTopicCategory;
    audienceType: string;
    ageGroup: string[];
    sexRestriction?: 'male' | 'female';
    recommendationText: string;
    evidenceLevel: 'A' | 'B' | 'C' | 'D' | 'I';
    lastReviewed: string;
    websiteUrl?: string;
    relatedTopics: string[];
    waterSafetyRelated: boolean;
    emergencyPreparednessRelated: boolean;
    militaryRelevance: boolean;
    urgencyLevel: 'routine' | 'important' | 'urgent' | 'critical';
  };
}

interface MyHealthfinderCacheData {
  records: MyHealthfinderRecord[];
  summary: {
    totalTopics: number;
    categoryCounts: Record<HealthTopicCategory, number>;
    evidenceDistribution: Record<string, number>;
    audienceBreakdown: Record<string, number>;
    waterSafetyTopics: number;
    emergencyPreparednessTopics: number;
    militaryRelevantTopics: number;
    urgentRecommendations: number;
  };
  metadata: { lastUpdated: string; dataVersion: string; };
}

let myhealthfinderCache: MyHealthfinderCacheData | null = null;
let lastFetched: string | null = null;
let _buildInProgress = false;
let _buildStartedAt: string | null = null;
let _myhealthfinderCacheLoaded = false;
let _lastDelta: CacheDelta | null = null;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;
const CACHE_FILE = 'myhealthfinder.json';

export function getMyHealthfinderCacheStatus() {
  return {
    loaded: _myhealthfinderCacheLoaded && myhealthfinderCache !== null,
    built: lastFetched,
    recordCount: myhealthfinderCache?.records?.length || 0,
    urgentRecommendations: myhealthfinderCache?.summary?.urgentRecommendations || 0,
    buildInProgress: isBuildInProgress(),
    lastDelta: _lastDelta,
  };
}

export function getMyHealthfinderCache(): MyHealthfinderRecord[] { return myhealthfinderCache?.records || []; }

export async function setMyHealthfinderCache(data: MyHealthfinderCacheData): Promise<void> {
  if (!data.records?.length) { console.warn('No MyHealthfinder data to cache'); return; }
  const prevCounts = myhealthfinderCache ? { recordCount: myhealthfinderCache.summary.totalTopics } : null;
  _lastDelta = computeCacheDelta(prevCounts, { recordCount: data.summary.totalTopics }, lastFetched);
  myhealthfinderCache = data; lastFetched = new Date().toISOString(); _myhealthfinderCacheLoaded = true;
  await saveToDisk(data); await saveCacheToBlob(CACHE_FILE, data);
}

export function setBuildInProgress(inProgress: boolean): void { _buildInProgress = inProgress; _buildStartedAt = inProgress ? new Date().toISOString() : null; }
export function isBuildInProgress(): boolean {
  if (!_buildInProgress) return false;
  if (_buildStartedAt && Date.now() - new Date(_buildStartedAt).getTime() > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('MyHealthfinder build lock expired'); _buildInProgress = false; _buildStartedAt = null; return false;
  }
  return _buildInProgress;
}

export async function ensureWarmed(): Promise<void> {
  if (_myhealthfinderCacheLoaded) return;
  try {
    const diskData = await loadFromDisk();
    if (diskData?.records?.length) { myhealthfinderCache = diskData; _myhealthfinderCacheLoaded = true; return; }
  } catch (e) { console.warn('MyHealthfinder disk load failed:', e); }
  try {
    const blobData = await loadCacheFromBlob<MyHealthfinderCacheData>(CACHE_FILE);
    if (blobData?.records?.length) { myhealthfinderCache = blobData; _myhealthfinderCacheLoaded = true; await saveToDisk(blobData); }
  } catch (e) { console.warn('MyHealthfinder blob load failed:', e); }
}

async function loadFromDisk(): Promise<MyHealthfinderCacheData | null> {
  try {
    if (typeof process === 'undefined') return null;
    const fs = require('fs'); const path = require('path');
    const file = path.join(process.cwd(), '.cache', CACHE_FILE);
    if (!fs.existsSync(file)) return null;
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!data?.records) return null;
    console.log(`[MyHealthfinder Cache] Loaded from disk (${data.records.length} records)`);
    return data;
  } catch (e) { return null; }
}

async function saveToDisk(data: MyHealthfinderCacheData): Promise<void> {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs'); const path = require('path');
    const cacheDir = path.join(process.cwd(), '.cache'); const file = path.join(cacheDir, CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
    console.log(`[MyHealthfinder Cache] Saved to disk (${data.records.length} records)`);
  } catch (e) { console.warn('MyHealthfinder disk save failed:', e); }
}

export function processMyHealthfinderData(rawRecords: any[]): MyHealthfinderRecord[] {
  return rawRecords.map(raw => ({
    id: `myhealthfinder_${raw.Id || raw.topic_id || Date.now()}`,
    source: 'myhealthfinder',
    location: { state: 'US' },
    temporal: { reportDate: raw.LastUpdate || raw.last_reviewed || new Date().toISOString(), year: new Date().getFullYear() },
    healthMetrics: [{ category: 'prevention', measure: 'recommendation', value: getRecommendationScore(raw.Grade), unit: 'grade' }],
    healthfinderSpecific: {
      topicId: raw.Id || raw.topic_id,
      title: raw.Title || raw.topic_title || 'Untitled Topic',
      category: categorizeHealthTopic(raw.Categories || raw.category),
      audienceType: raw.Sections?.find((s: any) => s.Title === 'Who needs this')?.Description || 'general',
      ageGroup: extractAgeGroups(raw.MyHFTitle || raw.title),
      sexRestriction: extractSexRestriction(raw.MyHFTitle || raw.title),
      recommendationText: extractRecommendationText(raw.Sections || []),
      evidenceLevel: normalizeEvidenceGrade(raw.Grade || raw.evidence_level),
      lastReviewed: raw.LastUpdate || raw.last_reviewed || new Date().toISOString(),
      websiteUrl: raw.AccessibleVersion || raw.url,
      relatedTopics: extractRelatedTopics(raw.RelatedItems || []),
      waterSafetyRelated: isWaterSafetyRelated(raw.Title, raw.Sections),
      emergencyPreparednessRelated: isEmergencyPreparedness(raw.Title, raw.Sections),
      militaryRelevance: isMilitaryRelevant(raw.Title, raw.Sections),
      urgencyLevel: determineUrgencyLevel(raw.Grade, raw.Title, raw.Sections),
    }
  }));
}

function categorizeHealthTopic(categories: any): HealthTopicCategory {
  const cats = Array.isArray(categories) ? categories : [categories];
  const categoryText = cats.map(c => c?.Title || c?.name || c).join(' ').toLowerCase();

  if (categoryText.includes('prevent') || categoryText.includes('immuniz')) return 'prevention';
  if (categoryText.includes('screen') || categoryText.includes('test')) return 'screening';
  if (categoryText.includes('treat') || categoryText.includes('medicin')) return 'treatment';
  if (categoryText.includes('nutrition') || categoryText.includes('diet')) return 'nutrition';
  if (categoryText.includes('exercise') || categoryText.includes('physical')) return 'exercise';
  if (categoryText.includes('mental') || categoryText.includes('stress')) return 'mental_health';
  if (categoryText.includes('environment') || categoryText.includes('chemical')) return 'environmental';
  return 'lifestyle';
}

function extractAgeGroups(title: string): string[] {
  const ageGroups: string[] = [];
  const titleLower = title?.toLowerCase() || '';
  if (titleLower.includes('child') || titleLower.includes('kid')) ageGroups.push('children');
  if (titleLower.includes('teen') || titleLower.includes('adolesc')) ageGroups.push('adolescents');
  if (titleLower.includes('adult') || titleLower.includes('grown')) ageGroups.push('adults');
  if (titleLower.includes('older') || titleLower.includes('senior')) ageGroups.push('older_adults');
  return ageGroups.length > 0 ? ageGroups : ['adults'];
}

function extractSexRestriction(title: string): 'male' | 'female' | undefined {
  const titleLower = title?.toLowerCase() || '';
  if (titleLower.includes('women') || titleLower.includes('female')) return 'female';
  if (titleLower.includes('men') || titleLower.includes('male')) return 'male';
  return undefined;
}

function extractRecommendationText(sections: any[]): string {
  const actionSection = sections?.find(s =>
    s?.Title?.includes('action') || s?.Title?.includes('recommendation') || s?.Title?.includes('what')
  );
  return actionSection?.Description || sections?.[0]?.Description || 'See full recommendation';
}

function normalizeEvidenceGrade(grade: string): 'A' | 'B' | 'C' | 'D' | 'I' {
  const g = grade?.toUpperCase() || '';
  if (['A', 'B', 'C', 'D', 'I'].includes(g)) return g as 'A' | 'B' | 'C' | 'D' | 'I';
  return 'I';
}

function extractRelatedTopics(relatedItems: any[]): string[] {
  return relatedItems?.map(item => item?.Title || item?.topic || item) || [];
}

function isWaterSafetyRelated(title: string, sections: any[]): boolean {
  const text = `${title} ${sections?.map(s => s?.Description).join(' ')}`.toLowerCase();
  return ['water', 'drinking', 'contamination', 'well', 'fluoride'].some(keyword => text.includes(keyword));
}

function isEmergencyPreparedness(title: string, sections: any[]): boolean {
  const text = `${title} ${sections?.map(s => s?.Description).join(' ')}`.toLowerCase();
  return ['emergency', 'disaster', 'preparedness', 'first aid', 'evacuation'].some(keyword => text.includes(keyword));
}

function isMilitaryRelevant(title: string, sections: any[]): boolean {
  const text = `${title} ${sections?.map(s => s?.Description).join(' ')}`.toLowerCase();
  return ['military', 'veteran', 'deployment', 'combat', 'service member', 'ptsd'].some(keyword => text.includes(keyword));
}

function determineUrgencyLevel(grade: string, title: string, sections: any[]): 'routine' | 'important' | 'urgent' | 'critical' {
  const gradeLevel = normalizeEvidenceGrade(grade);
  const text = `${title} ${sections?.map(s => s?.Description).join(' ')}`.toLowerCase();

  if (gradeLevel === 'A' && text.includes('prevent')) return 'critical';
  if (gradeLevel === 'A') return 'urgent';
  if (gradeLevel === 'B') return 'important';
  return 'routine';
}

function getRecommendationScore(grade: string): number {
  const gradeScores = { 'A': 95, 'B': 85, 'C': 75, 'D': 65, 'I': 50 };
  return gradeScores[normalizeEvidenceGrade(grade)] || 50;
}

export async function fetchMyHealthfinderData(): Promise<any[]> {
  // Mock MyHealthfinder data - in practice would fetch from HHS MyHealthfinder API
  const mockTopics = [
    { Id: '1', Title: 'Get screened for colorectal cancer', Grade: 'A', Categories: [{ Title: 'Screening' }], LastUpdate: new Date().toISOString(), Sections: [{ Title: 'What is it?', Description: 'Regular screening can help prevent colorectal cancer' }] },
    { Id: '2', Title: 'Drink water instead of sugary drinks', Grade: 'B', Categories: [{ Title: 'Nutrition' }], LastUpdate: new Date().toISOString(), Sections: [{ Title: 'Why is it important?', Description: 'Choose water for better health and hydration' }] },
    { Id: '3', Title: 'Emergency preparedness for families', Grade: 'A', Categories: [{ Title: 'Prevention' }], LastUpdate: new Date().toISOString(), Sections: [{ Title: 'Be prepared', Description: 'Create family emergency plans and supply kits including safe water storage' }] },
  ];
  return mockTopics;
}

export async function buildMyHealthfinderCacheData(records: MyHealthfinderRecord[]): Promise<MyHealthfinderCacheData> {
  const categoryCounts: Record<HealthTopicCategory, number> = { prevention: 0, screening: 0, treatment: 0, lifestyle: 0, nutrition: 0, exercise: 0, mental_health: 0, environmental: 0 };
  const evidenceDistribution: Record<string, number> = {};
  const audienceBreakdown: Record<string, number> = {};
  let waterSafetyTopics = 0; let emergencyPreparednessTopics = 0; let militaryRelevantTopics = 0; let urgentRecommendations = 0;

  records.forEach(record => {
    categoryCounts[record.healthfinderSpecific.category]++;
    evidenceDistribution[record.healthfinderSpecific.evidenceLevel] = (evidenceDistribution[record.healthfinderSpecific.evidenceLevel] || 0) + 1;
    audienceBreakdown[record.healthfinderSpecific.audienceType] = (audienceBreakdown[record.healthfinderSpecific.audienceType] || 0) + 1;
    if (record.healthfinderSpecific.waterSafetyRelated) waterSafetyTopics++;
    if (record.healthfinderSpecific.emergencyPreparednessRelated) emergencyPreparednessTopics++;
    if (record.healthfinderSpecific.militaryRelevance) militaryRelevantTopics++;
    if (['urgent', 'critical'].includes(record.healthfinderSpecific.urgencyLevel)) urgentRecommendations++;
  });

  return {
    records, summary: { totalTopics: records.length, categoryCounts, evidenceDistribution, audienceBreakdown, waterSafetyTopics, emergencyPreparednessTopics, militaryRelevantTopics, urgentRecommendations },
    metadata: { lastUpdated: new Date().toISOString(), dataVersion: '2.0' }
  };
}

export function getWaterSafetyRecommendations(): MyHealthfinderRecord[] {
  return myhealthfinderCache?.records?.filter(r => r.healthfinderSpecific.waterSafetyRelated) || [];
}

export function getEmergencyPreparednessGuidance(): MyHealthfinderRecord[] {
  return myhealthfinderCache?.records?.filter(r => r.healthfinderSpecific.emergencyPreparednessRelated) || [];
}

export function getMilitaryHealthGuidance(): MyHealthfinderRecord[] {
  return myhealthfinderCache?.records?.filter(r => r.healthfinderSpecific.militaryRelevance) || [];
}