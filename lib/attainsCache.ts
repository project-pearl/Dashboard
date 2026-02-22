// lib/attainsCache.ts
// Server-side singleton cache for ATTAINS national data
// Fetches all 51 states in background, serves instantly on subsequent requests
// ATTAINS data updates biannually — cache refreshes every 12 hours
// Persists to disk so cache survives server restarts

const ATTAINS_BASE = 'https://attains.epa.gov/attains-public/api';
const ATTAINS_GIS = 'https://gispub.epa.gov/arcgis/rest/services/OW/ATTAINS_Assessment/MapServer/1/query';
const LARGE_STATE_THRESHOLD = 50_000; // States with >50k assessments use GIS fallback
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days — ATTAINS updates biannually
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 3000;
const FETCH_TIMEOUT_MS = 300_000;     // 5 min per fetch — large states (CA, TX, NY) need time
const RETRY_TIMEOUT_MS = 480_000;     // 8 min on retry pass
const RETRY_DELAY_MS = 5000;          // 5s between retries

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CachedWaterbody {
  id: string;
  name: string;
  category: string;
  alertLevel: 'high' | 'medium' | 'low' | 'none';
  tmdlStatus: 'needed' | 'completed' | 'alternative' | 'not-pollutant' | 'na';
  causes: string[];
  causeCount: number;
  lat?: number | null;
  lon?: number | null;
}

export interface StateSummary {
  state: string;
  total: number;          // total in EPA (may exceed stored count)
  fetched: number;        // how many we processed
  stored: number;         // how many we're sending (after cap)
  high: number;
  medium: number;
  low: number;
  none: number;
  tmdlNeeded: number;     // Cat 5 — impaired, no TMDL
  tmdlCompleted: number;  // Cat 4a — impaired, TMDL done
  tmdlAlternative: number; // Cat 4b — other controls
  topCauses: string[];    // top 5 causes statewide
  waterbodies: CachedWaterbody[];
}

export interface CacheStatus {
  status: 'cold' | 'building' | 'ready' | 'stale';
  loadedStates: number;
  totalStates: number;
  lastBuilt: string | null;   // ISO timestamp
  buildStarted: string | null;
  statesLoaded: string[];     // which states are done
  statesMissing: string[];    // which states failed both passes
}

export interface CacheResponse {
  cacheStatus: CacheStatus;
  states: Record<string, StateSummary>;
}

// ─── All US state abbreviations ────────────────────────────────────────────────

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL',
  'GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

// Priority states load first (Chesapeake + high-pop)
const PRIORITY = ['MD','VA','DC','PA','DE','FL','WV','CA','TX','NY','NJ','OH','NC','MA','GA','IL','MI','WA','OR'];

const MAX_PER_STATE = 2000; // Memory cap per state

// ─── Singleton State ───────────────────────────────────────────────────────────

let cache: Record<string, StateSummary> = {};
let loadedStates = new Set<string>();
let buildStatus: 'cold' | 'building' | 'ready' | 'stale' = 'cold';
let lastBuilt: Date | null = null;
let buildStarted: Date | null = null;
let buildPromise: Promise<void> | null = null;

// ─── Load from disk on startup ─────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'attains-national.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.states || !data?.meta) return false;

    cache = data.states;
    const stateKeys = Object.keys(cache);
    loadedStates = new Set(stateKeys);
    lastBuilt = data.meta.lastBuilt ? new Date(data.meta.lastBuilt) : null;
    buildStatus = lastBuilt && (Date.now() - lastBuilt.getTime() < CACHE_TTL_MS) ? 'ready' : 'stale';

    console.log(`[ATTAINS Cache] Loaded from disk (${stateKeys.length} states, built ${lastBuilt?.toISOString() || 'unknown'})`);
    return true;
  } catch {
    return false;
  }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined') return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, 'attains-national.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: { lastBuilt: lastBuilt?.toISOString(), stateCount: loadedStates.size },
      states: cache,
    });
    fs.writeFileSync(file, payload, 'utf-8');
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[ATTAINS Cache] Saved to disk (${sizeMB}MB, ${loadedStates.size} states)`);
  } catch {
    // Disk save is optional — fail silently
  }
}

// Try loading from disk on first access (not module init)
let _diskLoaded = false;
function ensureDiskLoaded() {
  if (!_diskLoaded) {
    _diskLoaded = true;
    loadFromDisk();
  }
}

// ─── GIS MapServer fallback for huge states (PA: 216k assessments) ────────────

const GIS_CAUSE_FIELDS: Record<string, string> = {
  mercury: 'Mercury', nutrients: 'Nutrients', sediment: 'Sediment',
  pathogens: 'Pathogens', temperature: 'Temperature',
  metals_other_than_mercury: 'Metals (Other than Mercury)',
  ph_acidity_caustic_conditions: 'pH/Acidity/Caustic Conditions',
  habitat_alterations: 'Habitat Alterations', oxygen_depletion: 'Oxygen Depletion',
  algal_growth: 'Algal Growth', turbidity: 'Turbidity',
  flow_alterations: 'Flow Alterations', pesticides: 'Pesticides',
  toxic_organics: 'Toxic Organics', toxic_inorganics: 'Toxic Inorganics',
  polychlorinated_biphenyls_pcbs: 'PCBs', pfas: 'PFAS',
};

async function gisQuery(params: Record<string, string>): Promise<any> {
  const url = new URL(ATTAINS_GIS);
  url.searchParams.set('f', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`GIS HTTP ${res.status}`);
  return res.json();
}

async function fetchViaGIS(stateCode: string): Promise<StateSummary | null> {
  console.log(`[ATTAINS Cache] ${stateCode}: using GIS MapServer (large state)`);

  // Category breakdown
  const catData = await gisQuery({
    where: `STATE='${stateCode}'`,
    outStatistics: JSON.stringify([
      { statisticType: 'count', onStatisticField: 'OBJECTID', outStatisticFieldName: 'cnt' }
    ]),
    groupByFieldsForStatistics: 'IRCATEGORY',
  });

  let high = 0, medium = 0, low = 0, none = 0;
  let tmdlNeeded = 0, tmdlCompleted = 0, tmdlAlternative = 0;
  let total = 0;

  for (const f of catData.features) {
    const cat: string = f.attributes.IRCATEGORY || '';
    const cnt: number = f.attributes.cnt || 0;
    total += cnt;
    if (cat.startsWith('5')) { high += cnt; tmdlNeeded += cnt; }
    else if (cat === '4A' || cat === '4a') { medium += cnt; tmdlCompleted += cnt; }
    else if (cat === '4B' || cat === '4b') { medium += cnt; tmdlAlternative += cnt; }
    else if (cat === '4C' || cat === '4c') { medium += cnt; }
    else if (cat.startsWith('4')) { medium += cnt; tmdlCompleted += cnt; }
    else if (cat.startsWith('3')) { low += cnt; }
    else { none += cnt; }
  }

  // Cause counts (parallel)
  const causeFields = Object.keys(GIS_CAUSE_FIELDS);
  const causeFreq: Record<string, number> = {};
  await Promise.all(causeFields.map(async (field) => {
    try {
      const data = await gisQuery({
        where: `STATE='${stateCode}' AND ISIMPAIRED='Y' AND ${field}='Cause'`,
        returnCountOnly: 'true',
      });
      if (data.count > 0) causeFreq[GIS_CAUSE_FIELDS[field]] = data.count;
    } catch { /* skip */ }
  }));

  const topCauses = Object.entries(causeFreq)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name);

  // Fetch impaired waterbodies with pagination
  const causeOutFields = causeFields.join(',');
  const waterbodies: CachedWaterbody[] = [];
  const PAGE = 1000;

  for (const catFilter of ["IRCATEGORY LIKE '5%'", "IRCATEGORY LIKE '4%'"]) {
    let offset = 0;
    let keepGoing = true;
    while (keepGoing && waterbodies.length < MAX_PER_STATE) {
      const data = await gisQuery({
        where: `STATE='${stateCode}' AND ${catFilter}`,
        outFields: `assessmentunitidentifier,assessmentunitname,ircategory,${causeOutFields}`,
        resultRecordCount: String(PAGE),
        resultOffset: String(offset),
        returnGeometry: 'true',
        returnCentroid: 'true',
        outSR: '4326',
      });
      const features = data.features || [];
      for (const f of features) {
        if (waterbodies.length >= MAX_PER_STATE) break;
        const a = f.attributes;
        const cat: string = a.ircategory || '';
        const causes: string[] = [];
        for (const cf of causeFields) {
          if (a[cf] === 'Cause') causes.push(GIS_CAUSE_FIELDS[cf]);
          if (causes.length >= 5) break;
        }
        const isHigh = cat.startsWith('5');
        let tmdlStatus: CachedWaterbody['tmdlStatus'] = isHigh ? 'needed' : 'completed';
        if (cat === '4B' || cat === '4b') tmdlStatus = 'alternative';
        else if (cat === '4C' || cat === '4c') tmdlStatus = 'not-pollutant';

        // Extract centroid from geometry
        const centroid = f.centroid || f.geometry?.centroid;
        const geom = f.geometry;
        let lat: number | null = null;
        let lon: number | null = null;
        if (centroid) {
          lat = centroid.y ?? centroid.lat ?? null;
          lon = centroid.x ?? centroid.lon ?? centroid.lng ?? null;
        } else if (geom) {
          // Point geometry or ring centroid fallback
          if (geom.y != null && geom.x != null) { lat = geom.y; lon = geom.x; }
          else if (geom.points?.[0]) { lat = geom.points[0][1]; lon = geom.points[0][0]; }
        }

        waterbodies.push({
          id: a.assessmentunitidentifier || '',
          name: a.assessmentunitname || a.assessmentunitidentifier || '',
          category: cat,
          alertLevel: isHigh ? 'high' : 'medium',
          tmdlStatus,
          causes,
          causeCount: causes.length,
          lat,
          lon,
        });
      }
      offset += PAGE;
      keepGoing = features.length === PAGE;
    }
    if (waterbodies.length >= MAX_PER_STATE) break;
  }

  console.log(`[ATTAINS Cache] ${stateCode}: GIS complete — ${total} total, ${waterbodies.length} stored`);
  return {
    state: stateCode, total, fetched: high + medium, stored: waterbodies.length,
    high, medium, low, none, tmdlNeeded, tmdlCompleted, tmdlAlternative,
    topCauses, waterbodies,
  };
}

// ─── ATTAINS fetch helper (server-side, no Next.js cache) ──────────────────────

async function fetchAttainsState(stateCode: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<StateSummary | null> {
  try {
    // ── Check assessment count first — huge states (PA: 216k) need impaired-only filter ──
    let totalCount = 0;
    try {
      const countUrl = new URL(`${ATTAINS_BASE}/assessments`);
      countUrl.searchParams.set('state', stateCode);
      countUrl.searchParams.set('returnCountOnly', 'Y');
      const countRes = await fetch(countUrl.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(60_000), // 1 min for count-only
      });
      if (countRes.ok) {
        const countData = await countRes.json();
        totalCount = countData?.count || 0;
        if (totalCount > LARGE_STATE_THRESHOLD) {
          // Large states can't be fetched via REST API — use GIS MapServer instead
          console.log(`[ATTAINS Cache] ${stateCode}: ${totalCount} assessments — switching to GIS fallback`);
          return fetchViaGIS(stateCode);
        }
      }
    } catch {
      // Count check failed — proceed with full fetch
    }

    const url = new URL(`${ATTAINS_BASE}/assessments`);
    url.searchParams.set('state', stateCode);

    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      console.warn(`[ATTAINS Cache] ${stateCode}: HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const orgItems = data?.items || [];
    const allAssessments = orgItems.flatMap((org: any) => org?.assessments || []);

    if (allAssessments.length === 0) {
      return {
        state: stateCode, total: 0, fetched: 0, stored: 0,
        high: 0, medium: 0, low: 0, none: 0,
        tmdlNeeded: 0, tmdlCompleted: 0, tmdlAlternative: 0,
        topCauses: [], waterbodies: [],
      };
    }

    // Process all assessments for accurate counts
    const causeFreq: Record<string, number> = {};
    let high = 0, medium = 0, low = 0, none = 0;
    let tmdlNeeded = 0, tmdlCompleted = 0, tmdlAlternative = 0;

    // ── Fetch assessment unit NAMES + LOCATIONS from separate endpoint ──
    // The assessments endpoint doesn't include waterbody names or coordinates,
    // so we fetch them from the assessmentUnits endpoint and join by ID
    const nameMap = new Map<string, string>();
    const locMap = new Map<string, { lat: number; lon: number }>();
    try {
      const auUrl = new URL(`${ATTAINS_BASE}/assessmentUnits`);
      auUrl.searchParams.set('stateCode', stateCode);
      auUrl.searchParams.set('returnCountOnly', 'N');
      const auRes = await fetch(auUrl.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (auRes.ok) {
        const auData = await auRes.json();
        const auItems = auData?.items || [];
        for (const org of auItems) {
          for (const unit of (org?.assessmentUnits || [])) {
            const uid = (unit?.assessmentUnitIdentifier || '').trim();
            const uname = (unit?.assessmentUnitName || '').trim();
            if (uid && uname) nameMap.set(uid, uname);
            // Extract location if available
            const lat = unit?.locationDescriptionLatitude ?? unit?.latitude ?? null;
            const lon = unit?.locationDescriptionLongitude ?? unit?.longitude ?? null;
            if (uid && lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
              locMap.set(uid, { lat: Number(lat), lon: Number(lon) });
            }
          }
        }
        console.log(`[ATTAINS Cache] ${stateCode}: resolved ${nameMap.size} names, ${locMap.size} locations`);
      }
    } catch (e: any) {
      console.warn(`[ATTAINS Cache] ${stateCode}: name lookup failed (${e.message}) — using IDs as fallback`);
    }

    const processed: CachedWaterbody[] = allAssessments.map((item: any) => {
      // ATTAINS API: fields are directly on the assessment object (not nested under .assessmentUnit)
      const auId = (item?.assessmentUnitIdentifier || '').trim();
      const auName = nameMap.get(auId) || auId; // Resolve name from assessmentUnits endpoint, fall back to ID

      // Extract causes from parameters[] (primary path) and useAttainments[] (legacy/fallback)
      const causesSet = new Set<string>();

      // Primary: parameters[].parameterName — present on all assessment types
      for (const p of (item?.parameters || [])) {
        const pName = (p?.parameterName || '').trim();
        if (pName && pName !== 'CAUSE UNKNOWN' && pName !== 'CAUSE UNKNOWN - IMPAIRED BIOTA') {
          causesSet.add(pName);
          causeFreq[pName] = (causeFreq[pName] || 0) + 1;
        }
        if (causesSet.size >= 5) break;
      }

      // Fallback: useAttainments[].impairedActivities/threatenedActivities (may exist on some entries)
      if (causesSet.size === 0) {
        outer: for (const u of (item?.useAttainments || [])) {
          for (const a of (u?.threatenedActivities || []).concat(u?.impairedActivities || [])) {
            for (const c of (a?.associatedCauses || [])) {
              if (c?.causeName) {
                causesSet.add(c.causeName);
                causeFreq[c.causeName] = (causeFreq[c.causeName] || 0) + 1;
              }
              if (causesSet.size >= 5) break outer;
            }
          }
        }
      }

      const category = (item?.epaIRCategory || '').trim();
      let alertLevel: 'high' | 'medium' | 'low' | 'none' = 'none';
      let tmdlStatus: 'needed' | 'completed' | 'alternative' | 'not-pollutant' | 'na' = 'na';

      if (category.includes('5')) {
        alertLevel = 'high'; high++;
        tmdlStatus = 'needed'; tmdlNeeded++;
      } else if (category.includes('4')) {
        alertLevel = 'medium'; medium++;
        if (category.includes('4A') || category.includes('4a')) {
          tmdlStatus = 'completed'; tmdlCompleted++;
        } else if (category.includes('4B') || category.includes('4b')) {
          tmdlStatus = 'alternative'; tmdlAlternative++;
        } else if (category.includes('4C') || category.includes('4c')) {
          tmdlStatus = 'not-pollutant';
        } else {
          tmdlStatus = 'completed'; tmdlCompleted++;
        }
      } else if (category.includes('3')) {
        alertLevel = 'low'; low++;
      } else {
        none++;
      }

      const loc = locMap.get(auId);
      return {
        id: auId,
        name: auName,
        category,
        alertLevel,
        tmdlStatus,
        causes: [...causesSet],
        causeCount: causesSet.size,
        lat: loc?.lat ?? null,
        lon: loc?.lon ?? null,
      };
    });

    // Cap stored waterbodies — keep all impaired, sample healthy
    let stored: CachedWaterbody[];
    if (processed.length > MAX_PER_STATE) {
      const impaired = processed.filter(w => w.alertLevel === 'high' || w.alertLevel === 'medium');
      const healthy = processed.filter(w => w.alertLevel !== 'high' && w.alertLevel !== 'medium');
      const healthyCap = Math.max(0, MAX_PER_STATE - impaired.length);
      stored = [...impaired.slice(0, MAX_PER_STATE), ...healthy.slice(0, healthyCap)].slice(0, MAX_PER_STATE);
    } else {
      stored = processed;
    }

    // Top 5 causes statewide
    const topCauses = Object.entries(causeFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    return {
      state: stateCode,
      total: totalCount || data?.count || allAssessments.length,
      fetched: allAssessments.length,
      stored: stored.length,
      high, medium, low, none,
      tmdlNeeded, tmdlCompleted, tmdlAlternative,
      topCauses,
      waterbodies: stored,
    };
  } catch (e: any) {
    console.warn(`[ATTAINS Cache] ${stateCode} failed:`, e.message);
    return null;
  }
}

// ─── Background Build ──────────────────────────────────────────────────────────

export async function triggerAttainsBuild(): Promise<void> {
  ensureDiskLoaded();
  return buildCache();
}

async function buildCache(): Promise<void> {
  if (buildStatus === 'building') {
    console.log('[ATTAINS Cache] Build already in progress, skipping');
    return;
  }

  buildStatus = 'building';
  buildStarted = new Date();

  // Only fetch states not already in memory
  const remaining = ALL_STATES.filter(s => !PRIORITY.includes(s));
  const loadOrder = [...PRIORITY.filter(s => ALL_STATES.includes(s)), ...remaining];
  const toFetch = loadOrder.filter(s => !loadedStates.has(s));

  if (toFetch.length === 0) {
    console.log(`[ATTAINS Cache] All ${loadedStates.size} states already cached`);
    buildStatus = 'ready';
    lastBuilt = new Date();
    return;
  }

  console.log(`[ATTAINS Cache] Building ${toFetch.length} states (${loadedStates.size} already cached)...`);

  const failedStates: string[] = [];

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(st => fetchAttainsState(st))
    );

    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled' && result.value) {
        cache[batch[j]] = result.value;
        loadedStates.add(batch[j]);
        console.log(`[ATTAINS Cache] ${batch[j]}: ${result.value.fetched} waterbodies (${loadedStates.size}/${ALL_STATES.length})`);
      } else {
        const reason = result.status === 'rejected' ? result.reason?.message : 'null result';
        console.warn(`[ATTAINS Cache] ${batch[j]}: FAILED (${reason}) — will retry`);
        failedStates.push(batch[j]);
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < toFetch.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // ── RETRY PASS: failed states get a second chance, one at a time with longer timeout ──
  if (failedStates.length > 0) {
    console.log(`[ATTAINS Cache] Retrying ${failedStates.length} failed states with ${RETRY_TIMEOUT_MS / 1000}s timeout...`);
    for (const st of failedStates) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      try {
        const result = await fetchAttainsState(st, RETRY_TIMEOUT_MS);
        if (result) {
          cache[st] = result;
          loadedStates.add(st);
          console.log(`[ATTAINS Cache] ${st}: RETRY SUCCESS — ${result.fetched} waterbodies (${loadedStates.size}/${ALL_STATES.length})`);
        } else {
          console.warn(`[ATTAINS Cache] ${st}: RETRY returned null — skipping`);
        }
      } catch (e: any) {
        console.warn(`[ATTAINS Cache] ${st}: RETRY FAILED — ${e.message}`);
      }
    }
  }

  buildStatus = 'ready';
  lastBuilt = new Date();
  const elapsed = ((lastBuilt.getTime() - buildStarted.getTime()) / 1000).toFixed(1);
  const retried = failedStates.length;
  const stillMissing = ALL_STATES.filter(s => !loadedStates.has(s));
  console.log(`[ATTAINS Cache] Build complete — ${loadedStates.size}/${ALL_STATES.length} states in ${elapsed}s${retried > 0 ? ` (${retried} retried)` : ''}${stillMissing.length > 0 ? ` | MISSING: ${stillMissing.join(', ')}` : ''}`);

  // Persist to disk
  saveToDisk();
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the current cache status without triggering a build.
 */
export function getCacheStatus(): CacheStatus {
  ensureDiskLoaded();
  return {
    status: buildStatus,
    loadedStates: loadedStates.size,
    totalStates: ALL_STATES.length,
    lastBuilt: lastBuilt?.toISOString() || null,
    buildStarted: buildStarted?.toISOString() || null,
    statesLoaded: [...loadedStates],
    statesMissing: ALL_STATES.filter(s => !loadedStates.has(s)),
  };
}

/**
 * Get cached data. If cache is cold or stale, triggers background build.
 * Returns whatever is available immediately (may be partial during build).
 */
export function getAttainsCache(): CacheResponse {
  ensureDiskLoaded();
  // Check staleness
  if (buildStatus === 'ready' && lastBuilt) {
    const age = Date.now() - lastBuilt.getTime();
    if (age > CACHE_TTL_MS) {
      buildStatus = 'stale';
    }
  }

  // Trigger build if needed (non-blocking)
  if (buildStatus === 'cold' || buildStatus === 'stale') {
    if (!buildPromise) {
      buildPromise = buildCache().finally(() => { buildPromise = null; });
    }
  }

  return {
    cacheStatus: getCacheStatus(),
    states: { ...cache },
  };
}

/**
 * Get just a summary (no waterbody arrays) — lighter payload for status checks.
 */
export function getAttainsCacheSummary(): {
  cacheStatus: CacheStatus;
  states: Record<string, Omit<StateSummary, 'waterbodies'>>;
} {
  ensureDiskLoaded();
  const summary: Record<string, Omit<StateSummary, 'waterbodies'>> = {};
  for (const [st, data] of Object.entries(cache)) {
    const { waterbodies, ...rest } = data;
    summary[st] = rest;
  }

  // Trigger build if needed
  if (buildStatus === 'cold' || buildStatus === 'stale') {
    if (!buildPromise) {
      buildPromise = buildCache().finally(() => { buildPromise = null; });
    }
  }

  return {
    cacheStatus: getCacheStatus(),
    states: summary,
  };
}
