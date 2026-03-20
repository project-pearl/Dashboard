/**
 * Force Protection Intelligence Cache — Derived server-side cache that
 * cross-correlates upstream caches (SDWIS, PFAS, DoD PFAS, EPA PFAS,
 * Cyber Risk, Water Availability, ATTAINS, Flood Impact) per military
 * installation to surface compound threat convergence and monitoring gaps.
 *
 * No external API calls — reads only from other caches.
 * Populated by /api/cron/rebuild-force-protection (weekly, Sunday 4:15 AM UTC).
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { computeCacheDelta, type CacheDelta } from './cacheUtils';
import { haversineDistance } from './geoUtils';
import { getSdwisCache, type SdwisSystem, type SdwisViolation } from './sdwisCache';
import { getPfasCache, type PfasResult } from './pfasCache';
import { getDoDPFASCache, type DoDPFASAssessment } from './dodPfasCache';
import { getEpaPfasExceedances, type EpaPfasFacility } from './epaPfasAnalyticsCache';
import { getCyberRisk, type CyberRiskAssessment } from './cyberRiskCache';
import { getWaterAvailAll, type WaterAvailIndicator } from './usgsWaterAvailCache';
import { getFloodImpactCache, type FloodImpactZone } from './floodImpactCache';
import { getAttainsCache } from './attainsCache';
import installationsData from '@/data/military-installations.json';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NearbyWaterSystem {
  pwsid: string;
  name: string;
  population: number;
  distanceKm: number;
  activeViolations: number;
  healthBasedViolations: number;
  hasUcmr5Samples: boolean;
  pfasDetected: boolean;
  ucmr5SampleCount: number;
}

export interface ForceProtectionAssessment {
  installationId: string;
  installationName: string;
  state: string;
  branch: string;
  lat: number;
  lng: number;

  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';

  waterSystems: NearbyWaterSystem[];

  pfas: {
    dodAssessmentPhase: string | null;
    pfasDetectedOnBase: boolean;
    drinkingWaterExceedance: boolean;
    nearbyEpaFacilities: number;
    monitoringGap: boolean;
  };

  cyber: {
    assessedSystems: number;
    highCriticalCount: number;
    avgRiskScore: number;
  };

  watershed: {
    huc8: string;
    huc8Name: string;
    droughtSeverity: string;
    trend: string;
    impairedWaterbodies: number;
    tmdlNeeded: number;
  };

  flood: {
    activeFloodZones: number;
    highRiskZones: number;
    infraAtRisk: number;
  };

  coverageGaps: string[];
  convergenceCount: number;
  convergenceDomains: string[];

  updatedAt: string;
}

interface ForceProtectionMeta {
  built: string;
  installationCount: number;
  avgRiskScore: number;
  elevatedCount: number;
  gapCount: number;
}

interface ForceProtectionCacheData {
  _meta: ForceProtectionMeta;
  assessments: ForceProtectionAssessment[];
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _memCache: ForceProtectionCacheData | null = null;
let _cacheSource: string | null = null;
let _lastDelta: CacheDelta | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'force-protection.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.meta || !data?.assessments) return false;
    _memCache = { _meta: data.meta, assessments: data.assessments };
    _cacheSource = 'disk';
    console.log(`[Force Protection Cache] Loaded from disk (${data.meta.installationCount} installations, built ${data.meta.built})`);
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
    const file = path.join(dir, 'force-protection.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ meta: _memCache._meta, assessments: _memCache.assessments });
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[Force Protection Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<{ meta: any; assessments: any }>('cache/force-protection.json');
  if (data?.meta && data?.assessments) {
    _memCache = { _meta: data.meta, assessments: data.assessments };
    _cacheSource = 'blob';
    console.warn(`[Force Protection Cache] Loaded from blob (${data.meta.installationCount} installations)`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function getForceProtectionAll(): ForceProtectionAssessment[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return _memCache.assessments;
}

export function getForceProtectionById(installationId: string): ForceProtectionAssessment | null {
  ensureDiskLoaded();
  if (!_memCache) return null;
  return _memCache.assessments.find(a => a.installationId === installationId) || null;
}

export function getTopRiskInstallations(n: number): ForceProtectionAssessment[] {
  ensureDiskLoaded();
  if (!_memCache) return [];
  return [..._memCache.assessments]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, n);
}

export async function setForceProtectionCache(data: ForceProtectionCacheData): Promise<void> {
  const prevCounts = _memCache
    ? { installationCount: _memCache._meta.installationCount, elevatedCount: _memCache._meta.elevatedCount, gapCount: _memCache._meta.gapCount }
    : null;
  const newCounts = { installationCount: data._meta.installationCount, elevatedCount: data._meta.elevatedCount, gapCount: data._meta.gapCount };
  _lastDelta = computeCacheDelta(prevCounts, newCounts, _memCache?._meta.built ?? null);
  _memCache = data;
  _cacheSource = 'memory (cron)';
  console.log(
    `[Force Protection Cache] Updated: ${data._meta.installationCount} installations, ` +
    `avg risk ${data._meta.avgRiskScore}, ${data._meta.elevatedCount} elevated+`,
  );
  saveToDisk();
  await saveCacheToBlob('cache/force-protection.json', { meta: data._meta, assessments: data.assessments });
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isForceProtectionBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[Force Protection Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setForceProtectionBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getForceProtectionCacheStatus() {
  ensureDiskLoaded();
  if (!_memCache) return { loaded: false, source: null as string | null };
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _memCache._meta.built,
    installationCount: _memCache._meta.installationCount,
    avgRiskScore: _memCache._meta.avgRiskScore,
    elevatedCount: _memCache._meta.elevatedCount,
    gapCount: _memCache._meta.gapCount,
    lastDelta: _lastDelta,
  };
}

// ── Risk Score Computation ──────────────────────────────────────────────────

const RISK_WEIGHTS = {
  waterSupply: 0.25,
  pfas: 0.20,
  cyber: 0.15,
  watershed: 0.15,
  flood: 0.10,
  monitoring: 0.15,
};

function computeWaterSupplyScore(systems: NearbyWaterSystem[]): number {
  if (systems.length === 0) return 0;
  let score = 0;
  for (const s of systems) {
    score += Math.min(s.activeViolations * 10, 30);
    score += s.healthBasedViolations * 15;
  }
  return Math.min(score / systems.length, 100);
}

function computePfasScore(pfas: ForceProtectionAssessment['pfas']): number {
  let score = 0;
  if (pfas.pfasDetectedOnBase) score += 40;
  if (pfas.drinkingWaterExceedance) score += 30;
  if (pfas.monitoringGap) score += 20;
  score += Math.min(pfas.nearbyEpaFacilities * 5, 20);
  return Math.min(score, 100);
}

function computeCyberScore(cyber: ForceProtectionAssessment['cyber']): number {
  if (cyber.assessedSystems === 0) return 0;
  return Math.min(cyber.avgRiskScore * 1.2, 100);
}

function computeWatershedScore(watershed: ForceProtectionAssessment['watershed']): number {
  let score = 0;
  const droughtMap: Record<string, number> = { None: 0, D0: 15, D1: 30, D2: 50, D3: 70, D4: 90 };
  score += droughtMap[watershed.droughtSeverity] || 0;
  if (watershed.trend === 'declining') score += 15;
  score += Math.min(watershed.impairedWaterbodies * 3, 20);
  return Math.min(score, 100);
}

function computeFloodScore(flood: ForceProtectionAssessment['flood']): number {
  let score = 0;
  score += flood.activeFloodZones * 15;
  score += flood.highRiskZones * 25;
  score += Math.min(flood.infraAtRisk * 10, 30);
  return Math.min(score, 100);
}

function computeMonitoringScore(systems: NearbyWaterSystem[], pfas: ForceProtectionAssessment['pfas']): number {
  if (systems.length === 0) return 0;
  const noUcmr5 = systems.filter(s => !s.hasUcmr5Samples).length;
  let score = (noUcmr5 / systems.length) * 60;
  if (pfas.monitoringGap) score += 30;
  return Math.min(score, 100);
}

function riskLevel(score: number): ForceProtectionAssessment['riskLevel'] {
  if (score >= 81) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 41) return 'elevated';
  if (score >= 21) return 'moderate';
  return 'low';
}

// ── Build Engine ────────────────────────────────────────────────────────────

const PROXIMITY_KM = 40;

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  branch: string;
  state: string | null;
}

export function buildForceProtectionCache(): ForceProtectionAssessment[] {
  const installations: Installation[] = (installationsData as any[])
    .filter((inst: any) => inst.state !== null && inst.type === 'installation')
    .map((inst: any) => ({
      id: inst.id,
      name: inst.name,
      lat: inst.lat,
      lng: inst.lng,
      branch: inst.branch,
      state: inst.state,
    }));

  console.log(`[Force Protection Build] Processing ${installations.length} CONUS installations`);

  // Pre-fetch global datasets
  const allEpaFacilities = getEpaPfasExceedances();
  const waterAvailAll = getWaterAvailAll();
  const attainsData = getAttainsCache();
  const attainsStates = attainsData.cacheStatus.status !== 'cold' ? attainsData.states ?? {} : {};

  const assessments: ForceProtectionAssessment[] = [];

  for (const inst of installations) {
    // ── 1. SDWIS: nearby water systems + violations ──
    const sdwisResult = getSdwisCache(inst.lat, inst.lng);
    const nearbySystems: NearbyWaterSystem[] = [];

    if (sdwisResult) {
      const systemMap = new Map<string, SdwisSystem>();
      for (const sys of sdwisResult.systems) {
        const dist = haversineDistance({ lat: inst.lat, lng: inst.lng }, { lat: sys.lat, lng: sys.lng });
        if (dist <= PROXIMITY_KM) {
          systemMap.set(sys.pwsid, sys);
        }
      }

      // Count violations per system
      const violationCounts = new Map<string, { total: number; healthBased: number }>();
      for (const v of sdwisResult.violations) {
        const dist = haversineDistance({ lat: inst.lat, lng: inst.lng }, { lat: v.lat, lng: v.lng });
        if (dist <= PROXIMITY_KM && systemMap.has(v.pwsid)) {
          const counts = violationCounts.get(v.pwsid) || { total: 0, healthBased: 0 };
          counts.total++;
          if (v.isHealthBased) counts.healthBased++;
          violationCounts.set(v.pwsid, counts);
        }
      }

      // ── 2. PFAS (UCMR5) nearby ──
      const pfasResult = getPfasCache(inst.lat, inst.lng);
      const pfasResultsBySystem = new Map<string, PfasResult[]>();
      if (pfasResult) {
        for (const r of pfasResult.results) {
          const dist = haversineDistance({ lat: inst.lat, lng: inst.lng }, { lat: r.lat, lng: r.lng });
          if (dist <= PROXIMITY_KM) {
            // Group by facility name (UCMR5 doesn't have pwsid directly)
            const key = r.facilityName;
            if (!pfasResultsBySystem.has(key)) pfasResultsBySystem.set(key, []);
            pfasResultsBySystem.get(key)!.push(r);
          }
        }
      }

      for (const [pwsid, sys] of systemMap) {
        const vc = violationCounts.get(pwsid) || { total: 0, healthBased: 0 };
        const dist = haversineDistance({ lat: inst.lat, lng: inst.lng }, { lat: sys.lat, lng: sys.lng });
        // Check if this system has UCMR5 data (match by facility name)
        const pfasForSystem = pfasResultsBySystem.get(sys.name);
        const hasUcmr5 = !!pfasForSystem && pfasForSystem.length > 0;
        const detected = pfasForSystem?.some(r => r.detected) ?? false;

        nearbySystems.push({
          pwsid,
          name: sys.name,
          population: sys.population,
          distanceKm: Math.round(dist * 10) / 10,
          activeViolations: vc.total,
          healthBasedViolations: vc.healthBased,
          hasUcmr5Samples: hasUcmr5,
          pfasDetected: detected,
          ucmr5SampleCount: pfasForSystem?.length ?? 0,
        });
      }
    }

    // Sort by distance
    nearbySystems.sort((a, b) => a.distanceKm - b.distanceKm);

    // ── 3. DoD PFAS assessment ──
    const dodPfasResults = getDoDPFASCache(inst.lat, inst.lng);
    const matchedDod = dodPfasResults?.find(d =>
      d.matchedInstallationId === inst.id ||
      d.installationName.toLowerCase().includes(inst.name.toLowerCase().split(' ')[0]),
    );

    // ── 4. EPA PFAS exceedances nearby ──
    const nearbyEpa = allEpaFacilities.filter(f => {
      const dist = haversineDistance({ lat: inst.lat, lng: inst.lng }, { lat: f.lat, lng: f.lng });
      return dist <= PROXIMITY_KM;
    });

    const pfasDetectedOnBase = matchedDod?.pfasDetected ?? false;
    const drinkingWaterExceedance = matchedDod?.drinkingWaterExceedance ?? false;
    const monitoringGap = pfasDetectedOnBase && nearbySystems.some(s => !s.hasUcmr5Samples);

    const pfasInfo: ForceProtectionAssessment['pfas'] = {
      dodAssessmentPhase: matchedDod?.phase ?? null,
      pfasDetectedOnBase,
      drinkingWaterExceedance,
      nearbyEpaFacilities: nearbyEpa.length,
      monitoringGap,
    };

    // ── 5. Cyber risk of nearby utilities ──
    const cyberAssessments = inst.state ? getCyberRisk(inst.state) : [];
    const nearbyCyber = cyberAssessments.filter(c => {
      const dist = haversineDistance({ lat: inst.lat, lng: inst.lng }, { lat: c.lat, lng: c.lng });
      return dist <= PROXIMITY_KM;
    });
    const cyberInfo: ForceProtectionAssessment['cyber'] = {
      assessedSystems: nearbyCyber.length,
      highCriticalCount: nearbyCyber.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').length,
      avgRiskScore: nearbyCyber.length > 0
        ? Math.round(nearbyCyber.reduce((sum, c) => sum + c.cyberRiskScore, 0) / nearbyCyber.length)
        : 0,
    };

    // ── 6. Watershed / drought ──
    const stateIndicators = inst.state && waterAvailAll ? waterAvailAll[inst.state] : null;
    const nearestHuc = stateIndicators?.[0]; // first HUC-8 for state (simplified)
    const watershedInfo: ForceProtectionAssessment['watershed'] = {
      huc8: nearestHuc?.huc8 ?? 'N/A',
      huc8Name: nearestHuc?.huc8Name ?? 'Unknown',
      droughtSeverity: nearestHuc?.droughtSeverity ?? 'None',
      trend: nearestHuc?.trend ?? 'stable',
      impairedWaterbodies: 0,
      tmdlNeeded: 0,
    };

    // ── 7. ATTAINS impaired waterbodies ──
    if (inst.state && attainsStates) {
      const stateAttains = attainsStates[inst.state];
      if (stateAttains) {
        // Use state-level aggregate counts (lighter than scanning all waterbodies)
        watershedInfo.impairedWaterbodies = stateAttains.high + stateAttains.medium;
        watershedInfo.tmdlNeeded = stateAttains.tmdlNeeded;
      }
    }

    // ── 8. Flood impact ──
    const floodZones = getFloodImpactCache(inst.lat, inst.lng) || [];
    const floodInfo: ForceProtectionAssessment['flood'] = {
      activeFloodZones: floodZones.length,
      highRiskZones: floodZones.filter(z => z.floodStatus === 'major' || z.floodStatus === 'moderate').length,
      infraAtRisk: floodZones.reduce((sum, z) => sum + z.nearbyInfrastructure.length, 0),
    };

    // ── Compute risk scores ──
    const waterScore = computeWaterSupplyScore(nearbySystems);
    const pfasScore = computePfasScore(pfasInfo);
    const cyberScore = computeCyberScore(cyberInfo);
    const wsScore = computeWatershedScore(watershedInfo);
    const floodScore = computeFloodScore(floodInfo);
    const monScore = computeMonitoringScore(nearbySystems, pfasInfo);

    const compositeScore = Math.round(
      waterScore * RISK_WEIGHTS.waterSupply +
      pfasScore * RISK_WEIGHTS.pfas +
      cyberScore * RISK_WEIGHTS.cyber +
      wsScore * RISK_WEIGHTS.watershed +
      floodScore * RISK_WEIGHTS.flood +
      monScore * RISK_WEIGHTS.monitoring,
    );

    // ── Coverage gaps ──
    const gaps: string[] = [];
    const noUcmr5Count = nearbySystems.filter(s => !s.hasUcmr5Samples).length;
    if (noUcmr5Count > 0) gaps.push(`${noUcmr5Count}/${nearbySystems.length} nearby systems lack UCMR5 monitoring`);
    if (pfasDetectedOnBase && monitoringGap) gaps.push('DoD PFAS detected but nearby utilities have no UCMR5 samples');
    if (nearbySystems.some(s => s.healthBasedViolations > 0)) gaps.push('Health-based violations at serving utility');
    if (cyberInfo.highCriticalCount > 0) gaps.push(`${cyberInfo.highCriticalCount} nearby system(s) with high/critical cyber risk`);
    if (watershedInfo.droughtSeverity !== 'None' && watershedInfo.trend === 'declining') gaps.push('Drought conditions with declining trend');
    if (nearbySystems.length === 0) gaps.push('No SDWIS water systems found within 40km');

    // ── Convergence domains ──
    const CONVERGENCE_THRESHOLD = 30;
    const convergenceDomains: string[] = [];
    if (waterScore >= CONVERGENCE_THRESHOLD) convergenceDomains.push('Water Supply');
    if (pfasScore >= CONVERGENCE_THRESHOLD) convergenceDomains.push('PFAS');
    if (cyberScore >= CONVERGENCE_THRESHOLD) convergenceDomains.push('Cyber');
    if (wsScore >= CONVERGENCE_THRESHOLD) convergenceDomains.push('Watershed');
    if (floodScore >= CONVERGENCE_THRESHOLD) convergenceDomains.push('Flood');
    if (monScore >= CONVERGENCE_THRESHOLD) convergenceDomains.push('Monitoring');

    assessments.push({
      installationId: inst.id,
      installationName: inst.name,
      state: inst.state!,
      branch: inst.branch,
      lat: inst.lat,
      lng: inst.lng,
      riskScore: compositeScore,
      riskLevel: riskLevel(compositeScore),
      waterSystems: nearbySystems,
      pfas: pfasInfo,
      cyber: cyberInfo,
      watershed: watershedInfo,
      flood: floodInfo,
      coverageGaps: gaps,
      convergenceCount: convergenceDomains.length,
      convergenceDomains,
      updatedAt: new Date().toISOString(),
    });
  }

  // Sort by risk score descending
  assessments.sort((a, b) => b.riskScore - a.riskScore);

  return assessments;
}
