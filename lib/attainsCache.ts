// lib/attainsCache.ts
// Server-side singleton cache for ATTAINS national data
// - Fetches all 51 states in background via cron (time-budgeted)
// - Serves instantly on subsequent requests
// - ATTAINS updates ~biannually — this cache uses a long TTL
// - Persists to local disk (.cache/) + Vercel Blob (cross-instance)

import { put, list } from '@vercel/blob';

// ─── Config ────────────────────────────────────────────────────────────────────

const ATTAINS_BASE = "https://attains.epa.gov/attains-public/api";
const ATTAINS_GIS =
  "https://gispub.epa.gov/arcgis/rest/services/OW/ATTAINS_Assessment/MapServer/1/query";

const LARGE_STATE_THRESHOLD = 50_000; // States with >50k assessments use GIS fallback
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days — ATTAINS updates biannually
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 3000;

const FETCH_TIMEOUT_MS = 90_000; // 90s per fetch — must fit within 300s function limit
const RETRY_TIMEOUT_MS = 480_000; // 8 min on retry pass
const RETRY_DELAY_MS = 5000; // 5s between retries

// Cap per state in memory: keep all impaired, sample healthy up to this count
const MAX_PER_STATE = 2000;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CachedWaterbody {
  id: string;
  name: string;
  category: string;
  alertLevel: "high" | "medium" | "low" | "none";
  tmdlStatus: "needed" | "completed" | "alternative" | "not-pollutant" | "na";
  causes: string[];
  causeCount: number;
  lat?: number | null;
  lon?: number | null;
}

export interface StateSummary {
  state: string;
  total: number; // total in EPA (may exceed stored count)
  fetched: number; // how many we processed (raw)
  stored: number; // how many we're keeping in memory (after cap)
  high: number;
  medium: number;
  low: number;
  none: number;
  tmdlNeeded: number; // Cat 5 — impaired, no TMDL
  tmdlCompleted: number; // Cat 4a — impaired, TMDL done
  tmdlAlternative: number; // Cat 4b — other controls
  topCauses: string[]; // top 5 causes statewide
  waterbodies: CachedWaterbody[];
}

export interface CacheStatus {
  status: "cold" | "building" | "ready" | "stale";
  source: string | null;
  loadedStates: number;
  totalStates: number;
  lastBuilt: string | null; // ISO timestamp
  buildStarted: string | null;
  statesLoaded: string[]; // which states are done
  statesMissing: string[]; // which states failed or pending
}

export interface CacheResponse {
  cacheStatus: CacheStatus;
  states: Record<string, StateSummary>;
}

// ─── States and priority ───────────────────────────────────────────────────────

const ALL_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

// Priority states load first (Chesapeake + high-pop)
const PRIORITY = [
  "MD",
  "VA",
  "DC",
  "PA",
  "DE",
  "FL",
  "WV",
  "CA",
  "TX",
  "NY",
  "NJ",
  "OH",
  "NC",
  "MA",
  "GA",
  "IL",
  "MI",
  "WA",
  "OR",
];

// ─── Singleton State ───────────────────────────────────────────────────────────

let cache: Record<string, StateSummary> = {};
let loadedStates = new Set<string>();
let buildStatus: "cold" | "building" | "ready" | "stale" = "cold";
let lastBuilt: Date | null = null;
let buildStarted: Date | null = null;
let buildPromise: Promise<void> | null = null;
let _cacheSource: "disk" | "blob" | "memory (self-build)" | "memory (cron)" | null =
  null;

// ─── Portable timeout helper ───────────────────────────────────────────────────

function withTimeout(ms: number): AbortSignal | undefined {
  const anySignal = (AbortSignal as unknown) as { timeout?: (ms: number) => AbortSignal };
  if (typeof anySignal?.timeout === "function") return anySignal.timeout(ms);
  try {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), ms);
    return ac.signal;
  } catch {
    return undefined;
  }
}

// ─── Disk persistence (per instance) ───────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === "undefined") return false;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");
    const file = path.join(process.cwd(), ".cache", "attains-national.json");
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, "utf-8");
    const data = JSON.parse(raw);
    if (!data?.states || !data?.meta) return false;

    cache = data.states;
    const stateKeys = Object.keys(cache);
    loadedStates = new Set(stateKeys);
    lastBuilt = data.meta.lastBuilt ? new Date(data.meta.lastBuilt) : null;
    buildStatus =
      lastBuilt && Date.now() - lastBuilt.getTime() < CACHE_TTL_MS ? "ready" : "stale";
    _cacheSource = "disk";

    console.log(
      `[ATTAINS Cache] Loaded from disk (${stateKeys.length} states, built ${
        lastBuilt?.toISOString() || "unknown"
      })`
    );
    return true;
  } catch {
    return false;
  }
}

function saveToDisk(): void {
  try {
    if (typeof process === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require("path");
    const dir = path.join(process.cwd(), ".cache");
    const file = path.join(dir, "attains-national.json");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({
      meta: { lastBuilt: lastBuilt?.toISOString(), stateCount: loadedStates.size },
      states: cache,
    });
    fs.writeFileSync(file, payload, "utf-8");
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

// ─── Vercel Blob persistence (cross-instance) ────────────────────────────────

const BLOB_PATH = 'cache/attains-national.json';

async function saveToBlob(): Promise<boolean> {
  try {
    const payload = JSON.stringify({
      meta: { lastBuilt: lastBuilt?.toISOString(), stateCount: loadedStates.size },
      states: cache,
    });
    await put(BLOB_PATH, payload, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
    const sizeMB = (Buffer.byteLength(payload) / 1024 / 1024).toFixed(1);
    console.log(`[ATTAINS Cache] Saved to Vercel Blob (${sizeMB}MB, ${loadedStates.size} states)`);
    return true;
  } catch (e: any) {
    console.warn(`[ATTAINS Cache] Blob save failed: ${e.message}`);
    return false;
  }
}

async function loadFromBlob(): Promise<boolean> {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    if (blobs.length === 0) return false;

    const res = await fetch(blobs[0].downloadUrl);
    if (!res.ok) return false;

    const data = await res.json();
    if (!data?.states || !data?.meta) return false;

    cache = data.states;
    const stateKeys = Object.keys(cache);
    loadedStates = new Set(stateKeys);
    lastBuilt = data.meta.lastBuilt ? new Date(data.meta.lastBuilt) : null;
    buildStatus =
      lastBuilt && Date.now() - lastBuilt.getTime() < CACHE_TTL_MS ? "ready" : "stale";
    _cacheSource = "blob";

    console.log(
      `[ATTAINS Cache] Loaded from Vercel Blob (${stateKeys.length} states, built ${
        lastBuilt?.toISOString() || "unknown"
      })`
    );
    return true;
  } catch (e: any) {
    console.warn(`[ATTAINS Cache] Blob load failed: ${e.message}`);
    return false;
  }
}

let _blobChecked = false;

/**
 * Async warm-up: tries disk first (sync), then Vercel Blob if cache is still empty.
 * Call this at the start of ATTAINS data-serving routes.
 */
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (loadedStates.size > 0) return;
  if (_blobChecked) return;
  _blobChecked = true;
  await loadFromBlob();
}

// ─── GIS MapServer fallback for huge states (e.g., PA has very large counts) ──

const GIS_CAUSE_FIELDS: Record<string, string> = {
  mercury: "Mercury",
  nutrients: "Nutrients",
  sediment: "Sediment",
  pathogens: "Pathogens",
  temperature: "Temperature",
  metals_other_than_mercury: "Metals (Other than Mercury)",
  ph_acidity_caustic_conditions: "pH/Acidity/Caustic Conditions",
  habitat_alterations: "Habitat Alterations",
  oxygen_depletion: "Oxygen Depletion",
  algal_growth: "Algal Growth",
  turbidity: "Turbidity",
  flow_alterations: "Flow Alterations",
  pesticides: "Pesticides",
  toxic_organics: "Toxic Organics",
  toxic_inorganics: "Toxic Inorganics",
  polychlorinated_biphenyls_pcbs: "PCBs",
  pfas: "PFAS",
};

async function gisQuery(params: Record<string, string>): Promise<any> {
  const url = new URL(ATTAINS_GIS);
  url.searchParams.set("f", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: withTimeout(60_000) });
  if (!res.ok) throw new Error(`GIS HTTP ${res.status}`);
  return res.json();
}

async function fetchViaGIS(stateCode: string): Promise<StateSummary | null> {
  console.log(`[ATTAINS Cache] ${stateCode}: using GIS MapServer (large state)`);

  // Category breakdown
  const catData = await gisQuery({
    where: `STATE='${stateCode}'`,
    outStatistics: JSON.stringify([
      { statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "cnt" },
    ]),
    groupByFieldsForStatistics: "IRCATEGORY",
  });

  let high = 0,
    medium = 0,
    low = 0,
    none = 0;
  let tmdlNeeded = 0,
    tmdlCompleted = 0,
    tmdlAlternative = 0;
  let total = 0;

  for (const f of catData.features || []) {
    const catRaw: string = (f.attributes?.IRCATEGORY ?? f.attributes?.ircategory ?? "").toString();
    const cat = catRaw.toUpperCase();
    const cnt: number = f.attributes?.cnt || 0;
    total += cnt;
    if (cat.startsWith("5")) {
      high += cnt;
      tmdlNeeded += cnt;
    } else if (cat.startsWith("4A")) {
      medium += cnt;
      tmdlCompleted += cnt;
    } else if (cat.startsWith("4B")) {
      medium += cnt;
      tmdlAlternative += cnt;
    } else if (cat.startsWith("4C")) {
      medium += cnt;
    } else if (cat.startsWith("4")) {
      medium += cnt;
      tmdlCompleted += cnt;
    } else if (cat.startsWith("3")) {
      low += cnt;
    } else {
      none += cnt;
    }
  }

  // Cause counts (parallel)
  const causeFields = Object.keys(GIS_CAUSE_FIELDS);
  const causeFreq: Record<string, number> = {};
  await Promise.all(
    causeFields.map(async (field) => {
      try {
        const data = await gisQuery({
          where: `STATE='${stateCode}' AND ISIMPAIRED='Y' AND ${field}='Cause'`,
          returnCountOnly: "true",
        });
        if (data.count > 0) causeFreq[GIS_CAUSE_FIELDS[field]] = data.count;
      } catch {
        /* skip */
      }
    })
  );
  const topCauses = Object.entries(causeFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Fetch impaired waterbodies with pagination
  const causeOutFields = causeFields.join(",");
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
        returnGeometry: "true",
        returnCentroid: "true",
        outSR: "4326",
      });
      const features = data.features || [];
      for (const f of features) {
        if (waterbodies.length >= MAX_PER_STATE) break;
        const a = f.attributes || {};

        // Attribute casing fallback
        const catRaw: string = (a.ircategory || a.IRCATEGORY || "").toString();
        const cat = catRaw.toUpperCase();
        const id: string = (
          a.assessmentunitidentifier ||
          a.ASSESSMENTUNITIDENTIFIER ||
          ""
        ).toString();
        const nm: string = (
          a.assessmentunitname ||
          a.ASSESSMENTUNITNAME ||
          id
        ).toString();

        const causes: string[] = [];
        for (const cf of causeFields) {
          if (a[cf] === "Cause") causes.push(GIS_CAUSE_FIELDS[cf]);
          if (causes.length >= 5) break;
        }

        const isHigh = cat.startsWith("5");
        let tmdlStatus: CachedWaterbody["tmdlStatus"] = isHigh ? "needed" : "completed";
        if (cat.startsWith("4B")) tmdlStatus = "alternative";
        else if (cat.startsWith("4C")) tmdlStatus = "not-pollutant";

        // Centroid/geom
        const centroid = f.centroid || f.geometry?.centroid;
        const geom = f.geometry;
        let lat: number | null = null;
        let lon: number | null = null;
        if (centroid) {
          lat = centroid.y ?? centroid.lat ?? null;
          lon = centroid.x ?? centroid.lon ?? centroid.lng ?? null;
        } else if (geom) {
          if (geom.y != null && geom.x != null) {
            lat = geom.y;
            lon = geom.x;
          } else if (geom.points?.[0]) {
            lat = geom.points[0][1];
            lon = geom.points[0][0];
          }
        }

        waterbodies.push({
          id,
          name: nm,
          category: cat,
          alertLevel: isHigh ? "high" : "medium",
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

  console.log(
    `[ATTAINS Cache] ${stateCode}: GIS complete — ${total} total, ${waterbodies.length} stored`
  );

  return {
    state: stateCode,
    total,
    fetched: high + medium,
    stored: waterbodies.length,
    high,
    medium,
    low,
    none,
    tmdlNeeded,
    tmdlCompleted,
    tmdlAlternative,
    topCauses,
    waterbodies,
  };
}

// ─── REST path fetch + AU enrichment ───────────────────────────────────────────

async function fetchAttainsState(
  stateCode: string,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<StateSummary | null> {
  try {
    // Count check — huge states switch to GIS fallback
    let totalCount = 0;
    try {
      const countUrl = new URL(`${ATTAINS_BASE}/assessments`);
      countUrl.searchParams.set("state", stateCode);
      countUrl.searchParams.set("returnCountOnly", "Y");
      const countRes = await fetch(countUrl.toString(), {
        headers: { Accept: "application/json" },
        signal: withTimeout(60_000),
      });
      if (countRes.ok) {
        const countData = await countRes.json();
        totalCount = countData?.count || 0;
        if (totalCount > LARGE_STATE_THRESHOLD) {
          console.log(
            `[ATTAINS Cache] ${stateCode}: ${totalCount} assessments — switching to GIS fallback`
          );
          return fetchViaGIS(stateCode);
        }
      }
    } catch {
      // If count fails, try REST anyway
    }

    const url = new URL(`${ATTAINS_BASE}/assessments`);
    url.searchParams.set("state", stateCode);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: withTimeout(timeoutMs),
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
        state: stateCode,
        total: 0,
        fetched: 0,
        stored: 0,
        high: 0,
        medium: 0,
        low: 0,
        none: 0,
        tmdlNeeded: 0,
        tmdlCompleted: 0,
        tmdlAlternative: 0,
        topCauses: [],
        waterbodies: [],
      };
    }

    // AU name/coord lookup — per organization to avoid truncation
    const nameMap = new Map<string, string>();
    const locMap = new Map<string, { lat: number; lon: number }>();

    try {
      const orgIds = Array.from(
        new Set(
          orgItems
            .map((o: any) => (o?.organizationIdentifier || "").trim())
            .filter(Boolean)
        )
      );

      for (const orgId of orgIds) {
        const auUrl = new URL(`${ATTAINS_BASE}/assessmentUnits`);
        auUrl.searchParams.set("organizationId", orgId);
        auUrl.searchParams.set("stateCode", stateCode);
        auUrl.searchParams.set("returnCountOnly", "N");

        const auRes = await fetch(auUrl.toString(), {
          headers: { Accept: "application/json" },
          signal: withTimeout(timeoutMs),
        });
        if (!auRes.ok) continue;

        const auData = await auRes.json();
        const auItems = auData?.items || [];
        for (const org of auItems) {
          for (const unit of org?.assessmentUnits || []) {
            const uid = (unit?.assessmentUnitIdentifier || "").trim();
            const uname = (unit?.assessmentUnitName || "").trim();
            if (uid && uname) nameMap.set(uid, uname);

            const lat =
              unit?.locationDescriptionLatitude ?? unit?.latitude ?? null;
            const lon =
              unit?.locationDescriptionLongitude ?? unit?.longitude ?? null;
            if (
              uid &&
              lat != null &&
              lon != null &&
              !isNaN(Number(lat)) &&
              !isNaN(Number(lon))
            ) {
              locMap.set(uid, { lat: Number(lat), lon: Number(lon) });
            }
          }
        }
      }
      console.log(
        `[ATTAINS Cache] ${stateCode}: resolved ${nameMap.size} names, ${locMap.size} locations`
      );
    } catch (e: any) {
      console.warn(
        `[ATTAINS Cache] ${stateCode}: AU lookup failed (${e.message}) — using IDs as fallback`
      );
    }

    // Counters and cause frequency
    const causeFreq: Record<string, number> = {};
    let high = 0,
      medium = 0,
      low = 0,
      none = 0;
    let tmdlNeeded = 0,
      tmdlCompleted = 0,
      tmdlAlternative = 0;

    // Map assessments
    const processed: CachedWaterbody[] = allAssessments.map((item: any) => {
      const auId = (item?.assessmentUnitIdentifier || "").trim();
      const auName = nameMap.get(auId) || auId;

      // Extract causes from parameters[] (primary) then useAttainments fallback
      const causesSet = new Set<string>();

      for (const p of item?.parameters || []) {
        const pName = (p?.parameterName || "").trim();
        if (
          pName &&
          pName !== "CAUSE UNKNOWN" &&
          pName !== "CAUSE UNKNOWN - IMPAIRED BIOTA"
        ) {
          causesSet.add(pName);
          causeFreq[pName] = (causeFreq[pName] || 0) + 1;
        }
        if (causesSet.size >= 5) break;
      }

      if (causesSet.size === 0) {
        outer: for (const u of item?.useAttainments || []) {
          const list = (u?.threatenedActivities || []).concat(
            u?.impairedActivities || []
          );
          for (const a of list) {
            for (const c of a?.associatedCauses || []) {
              const cn = c?.causeName?.trim();
              if (cn) {
                causesSet.add(cn);
                causeFreq[cn] = (causeFreq[cn] || 0) + 1;
                if (causesSet.size >= 5) break outer;
              }
            }
          }
        }
      }

      const category = (item?.epaIRCategory || "").trim().toUpperCase();
      let alertLevel: "high" | "medium" | "low" | "none" = "none";
      let tmdlStatus: CachedWaterbody["tmdlStatus"] = "na";

      if (category.startsWith("5")) {
        alertLevel = "high";
        high++;
        tmdlStatus = "needed";
        tmdlNeeded++;
      } else if (category.startsWith("4")) {
        alertLevel = "medium";
        medium++;
        if (category.startsWith("4A")) {
          tmdlStatus = "completed";
          tmdlCompleted++;
        } else if (category.startsWith("4B")) {
          tmdlStatus = "alternative";
          tmdlAlternative++;
        } else if (category.startsWith("4C")) {
          tmdlStatus = "not-pollutant";
        } else {
          tmdlStatus = "completed";
          tmdlCompleted++;
        }
      } else if (category.startsWith("3")) {
        alertLevel = "low";
        low++;
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
      const impaired = processed.filter(
        (w) => w.alertLevel === "high" || w.alertLevel === "medium"
      );
      const healthy = processed.filter(
        (w) => w.alertLevel !== "high" && w.alertLevel !== "medium"
      );
      const healthyCap = Math.max(0, MAX_PER_STATE - impaired.length);
      stored = [...impaired.slice(0, MAX_PER_STATE), ...healthy.slice(0, healthyCap)].slice(
        0,
        MAX_PER_STATE
      );
    } else {
      stored = processed;
    }

    const topCauses = Object.entries(causeFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    return {
      state: stateCode,
      total: totalCount || data?.count || allAssessments.length,
      fetched: allAssessments.length,
      stored: stored.length,
      high,
      medium,
      low,
      none,
      tmdlNeeded,
      tmdlCompleted,
      tmdlAlternative,
      topCauses,
      waterbodies: stored,
    };
  } catch (e: any) {
    console.warn(`[ATTAINS Cache] ${stateCode} failed:`, e.message);
    return null;
  }
}

// ─── Background Build (cron + dev trigger) ─────────────────────────────────────

export async function triggerAttainsBuild(): Promise<void> {
  ensureDiskLoaded();
  return buildCache();
}

/**
 * Time-budgeted build — processes as many states as possible within the
 * given time budget, saves progress, and returns what was done.
 * Designed for Vercel cron (maxDuration 300s).
 */
export async function buildAttainsChunk(timeBudgetMs: number): Promise<{
  processed: string[];
  failed: string[];
  alreadyCached: number;
  totalStates: number;
  savedToDisk: boolean;
  savedToBlob: boolean;
}> {
  ensureDiskLoaded();

  const cronStart = Date.now();
  const deadline = cronStart + timeBudgetMs;

  const remaining = ALL_STATES.filter((s) => !PRIORITY.includes(s));
  const loadOrder = [...PRIORITY.filter((s) => ALL_STATES.includes(s)), ...remaining];
  const toFetch = loadOrder.filter((s) => !loadedStates.has(s));
  const alreadyCached = loadedStates.size;

  if (toFetch.length === 0) {
    // All states cached — just update timestamps
    if (buildStatus !== "ready") {
      buildStatus = "ready";
      lastBuilt = new Date();
      _cacheSource = _cacheSource || "memory (cron)";
    }
    return {
      processed: [],
      failed: [],
      alreadyCached,
      totalStates: ALL_STATES.length,
      savedToDisk: false,
      savedToBlob: false,
    };
  }

  buildStatus = "building";
  buildStarted = new Date();

  const processed: string[] = [];
  const failed: string[] = [];

  for (const st of toFetch) {
    // Check time budget — leave 30s for save + response
    if (Date.now() > deadline - 30_000) {
      console.log(
        `[ATTAINS Cron] Time budget reached — stopping after ${processed.length} states`
      );
      break;
    }

    try {
      const result = await fetchAttainsState(st);
      if (result) {
        cache[st] = result;
        loadedStates.add(st);
        processed.push(st);
        console.log(
          `[ATTAINS Cron] ${st}: ${result.stored} waterbodies (${loadedStates.size}/${ALL_STATES.length})`
        );
      } else {
        failed.push(st);
        console.warn(`[ATTAINS Cron] ${st}: null result`);
      }
    } catch (e: any) {
      failed.push(st);
      console.warn(`[ATTAINS Cron] ${st}: FAILED (${e.message})`);
    }

    // Small delay between states
    if (Date.now() < deadline - 35_000) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Update status
  const allDone = loadedStates.size >= ALL_STATES.length;
  buildStatus = allDone ? "ready" : loadedStates.size > 0 ? "ready" : "cold";
  if (processed.length > 0) {
    lastBuilt = new Date();
    _cacheSource = "memory (cron)";
  }

  // Save progress (disk + Vercel Blob for cross-instance persistence)
  let savedToDisk = false;
  let savedToBlob = false;
  if (processed.length > 0) {
    saveToDisk();
    savedToDisk = true;
    savedToBlob = await saveToBlob();
  }

  const elapsed = ((Date.now() - cronStart) / 1000).toFixed(1);
  const stillMissing = ALL_STATES.filter((s) => !loadedStates.has(s));
  console.log(
    `[ATTAINS Cron] Chunk complete in ${elapsed}s — ${processed.length} new, ${failed.length} failed, ` +
      `${loadedStates.size}/${ALL_STATES.length} total${
        stillMissing.length > 0 ? ` | remaining: ${stillMissing.join(", ")}` : ""
      }${savedToBlob ? " | blob saved" : ""}`
  );

  return { processed, failed, alreadyCached, totalStates: ALL_STATES.length, savedToDisk, savedToBlob };
}

async function buildCache(): Promise<void> {
  if (buildStatus === "building") {
    console.log("[ATTAINS Cache] Build already in progress, skipping");
    return;
  }

  buildStatus = "building";
  buildStarted = new Date();

  // Only fetch states not already in memory
  const remaining = ALL_STATES.filter((s) => !PRIORITY.includes(s));
  const loadOrder = [...PRIORITY.filter((s) => ALL_STATES.includes(s)), ...remaining];
  const toFetch = loadOrder.filter((s) => !loadedStates.has(s));

  if (toFetch.length === 0) {
    console.log(`[ATTAINS Cache] All ${loadedStates.size} states already cached`);
    buildStatus = "ready";
    lastBuilt = new Date();
    return;
  }

  console.log(
    `[ATTAINS Cache] Building ${toFetch.length} states (${loadedStates.size} already cached)...`
  );

  const failedStates: string[] = [];

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((st) => fetchAttainsState(st)));

    for (let j = 0; j < batch.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled" && result.value) {
        cache[batch[j]] = result.value;
        loadedStates.add(batch[j]);
        console.log(
          `[ATTAINS Cache] ${batch[j]}: ${result.value.fetched} waterbodies (${loadedStates.size}/${ALL_STATES.length})`
        );
      } else {
        const reason = result.status === "rejected" ? result.reason?.message : "null result";
        console.warn(`[ATTAINS Cache] ${batch[j]}: FAILED (${reason}) — will retry`);
        failedStates.push(batch[j]);
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < toFetch.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // Retry pass (one-by-one, longer timeout)
  if (failedStates.length > 0) {
    console.log(
      `[ATTAINS Cache] Retrying ${failedStates.length} failed states with ${
        RETRY_TIMEOUT_MS / 1000
      }s timeout...`
    );
    for (const st of failedStates) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      try {
        const result = await fetchAttainsState(st, RETRY_TIMEOUT_MS);
        if (result) {
          cache[st] = result;
          loadedStates.add(st);
          console.log(
            `[ATTAINS Cache] ${st}: RETRY SUCCESS — ${result.fetched} waterbodies (${loadedStates.size}/${ALL_STATES.length})`
          );
        } else {
          console.warn(`[ATTAINS Cache] ${st}: RETRY returned null — skipping`);
        }
      } catch (e: any) {
        console.warn(`[ATTAINS Cache] ${st}: RETRY FAILED — ${e.message}`);
      }
    }
  }

  buildStatus = "ready";
  lastBuilt = new Date();
  _cacheSource = "memory (self-build)";
  const elapsed = ((lastBuilt.getTime() - buildStarted.getTime()) / 1000).toFixed(1);
  const retried = failedStates.length;
  const stillMissing = ALL_STATES.filter((s) => !loadedStates.has(s));
  console.log(
    `[ATTAINS Cache] Build complete — ${loadedStates.size}/${ALL_STATES.length} states in ${elapsed}s${
      retried > 0 ? ` (${retried} retried)` : ""
    }${stillMissing.length > 0 ? ` | MISSING: ${stillMissing.join(", ")}` : ""}`
  );

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
    source: _cacheSource,
    loadedStates: loadedStates.size,
    totalStates: ALL_STATES.length,
    lastBuilt: lastBuilt?.toISOString() || null,
    buildStarted: buildStarted?.toISOString() || null,
    statesLoaded: [...loadedStates],
    statesMissing: ALL_STATES.filter((s) => !loadedStates.has(s)),
  };
}

/**
 * Get cached data. If cache is cold or stale, DOES NOT self-trigger a build.
 * Cron handles builds — this returns whatever is available immediately.
 */
export function getAttainsCache(): CacheResponse {
  ensureDiskLoaded();
  // Check staleness
  if (buildStatus === "ready" && lastBuilt) {
    const age = Date.now() - lastBuilt.getTime();
    if (age > CACHE_TTL_MS) {
      buildStatus = "stale";
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
  states: Record<string, Omit<StateSummary, "waterbodies">>;
} {
  ensureDiskLoaded();
  const summary: Record<string, Omit<StateSummary, "waterbodies">> = {};
  for (const [st, data] of Object.entries(cache)) {
    const { waterbodies, ...rest } = data;
    summary[st] = rest;
  }

  return {
    cacheStatus: getCacheStatus(),
    states: summary,
  };
}