// =============================================================================
// lib/wqp/client.ts — Water Quality Portal API client
// =============================================================================
//
// WQP API docs: https://www.waterqualitydata.us/webservices_documentation
//
// This client handles:
//   - On-demand queries when a user loads a waterbody or state
//   - Response parsing (CSV → typed objects)
//   - Timeout handling (WQP can be slow on large queries)
//   - Rate limiting (be a good citizen — WQP is a shared resource)
//
// Usage:
//   import { fetchStations, fetchResults, fetchSummary } from "@/lib/wqp/client";
//   const stations = await fetchStations({ statecode: "US:24", countycode: "US:24:003" });
//   const results = await fetchResults({ siteid: "USGS-01589440", startDateLo: "01-01-2023" });
//
// =============================================================================

import type { WQPQuery, WQPStation, WQPResult, WQPSummary } from "./types";

const WQP_BASE = "https://www.waterqualitydata.us";
const WQP_TIMEOUT_MS = 30_000; // 30s — WQP can be slow
const WQP_MAX_RETRIES = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Query builder
// ─────────────────────────────────────────────────────────────────────────────

function buildQueryString(params: WQPQuery): string {
  const parts: string[] = [];

  if (params.statecode) parts.push(`statecode=${encodeURIComponent(params.statecode)}`);
  if (params.countycode) parts.push(`countycode=${encodeURIComponent(params.countycode)}`);
  if (params.huc) parts.push(`huc=${encodeURIComponent(params.huc)}`);
  if (params.siteid) parts.push(`siteid=${encodeURIComponent(params.siteid)}`);
  if (params.organization) parts.push(`organization=${encodeURIComponent(params.organization)}`);
  if (params.startDateLo) parts.push(`startDateLo=${encodeURIComponent(params.startDateLo)}`);
  if (params.startDateHi) parts.push(`startDateHi=${encodeURIComponent(params.startDateHi)}`);
  if (params.sampleMedia) parts.push(`sampleMedia=${encodeURIComponent(params.sampleMedia)}`);
  if (params.dataProfile) parts.push(`dataProfile=${encodeURIComponent(params.dataProfile)}`);
  if (params.sorted) parts.push(`sorted=${params.sorted}`);

  if (params.characteristicName) {
    for (const c of params.characteristicName) {
      parts.push(`characteristicName=${encodeURIComponent(c)}`);
    }
  }

  // Always request CSV — smaller payloads, faster parsing
  parts.push(`mimeType=csv`);
  parts.push(`zip=no`);

  return parts.join("&");
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV parser (lightweight, no external dependency)
// ─────────────────────────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch with timeout + retry
// ─────────────────────────────────────────────────────────────────────────────

async function wqpFetch(url: string, retries = WQP_MAX_RETRIES): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WQP_TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Accept": "text/csv",
          "User-Agent": "PIN-Water-Intelligence/1.0 (pinwater.org; doug@pinwater.org)",
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`WQP returned ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (err) {
      if (attempt === retries) throw err;
      // Back off before retry
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error("WQP fetch failed after retries");
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — Stations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch monitoring stations from WQP.
 *
 * Use cases:
 *   - User loads a waterbody → get all monitoring stations in that HUC/area
 *   - User loads a state → get station count and locations
 *   - User clicks a county → get stations in that county
 *
 * Keep queries scoped. Never pull all stations for a large state without
 * a county or HUC filter — the response will be huge and slow.
 */
export async function fetchStations(params: WQPQuery): Promise<WQPStation[]> {
  const qs = buildQueryString(params);
  const url = `${WQP_BASE}/data/Station/search?${qs}`;
  const csv = await wqpFetch(url);
  const rows = parseCSV(csv);

  return rows.map((r) => ({
    MonitoringLocationIdentifier: r.MonitoringLocationIdentifier || "",
    MonitoringLocationName: r.MonitoringLocationName || "",
    MonitoringLocationTypeName: r.MonitoringLocationTypeName || "",
    HUCEightDigitCode: r.HUCEightDigitCode || "",
    LatitudeMeasure: parseFloat(r.LatitudeMeasure) || 0,
    LongitudeMeasure: parseFloat(r.LongitudeMeasure) || 0,
    OrganizationIdentifier: r.OrganizationIdentifier || "",
    OrganizationFormalName: r.OrganizationFormalName || "",
    StateName: r.StateName || "",
    CountyName: r.CountyName || "",
    ProviderName: r.ProviderName || "",
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — Results (observations)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch observation results from WQP.
 *
 * ⚠️  ALWAYS scope this tightly:
 *   - By siteid (single station) + date range, OR
 *   - By HUC + characteristicName + date range, OR
 *   - By county + characteristicName + date range
 *
 * NEVER call this with only a statecode — you'll get millions of rows
 * and the request will timeout.
 *
 * Use dataProfile: "narrowResult" for a compact response format.
 */
export async function fetchResults(params: WQPQuery): Promise<WQPResult[]> {
  // Safety: refuse unscoped queries that will timeout
  if (!params.siteid && !params.huc && !params.countycode) {
    if (params.statecode && !params.characteristicName?.length) {
      throw new Error(
        "WQP query too broad: state-level result queries require at least " +
        "a characteristicName filter. Use fetchSummary() for state overviews."
      );
    }
  }

  const qs = buildQueryString({ ...params, dataProfile: params.dataProfile || "narrowResult" });
  const url = `${WQP_BASE}/data/Result/search?${qs}`;
  const csv = await wqpFetch(url);
  const rows = parseCSV(csv);

  return rows.map((r) => ({
    MonitoringLocationIdentifier: r.MonitoringLocationIdentifier || "",
    ActivityStartDate: r.ActivityStartDate || "",
    ActivityStartTime: r.ActivityStartTime || undefined,
    CharacteristicName: r.CharacteristicName || "",
    ResultMeasureValue: r.ResultMeasureValue || null,
    ResultMeasure_MeasureUnitCode: r.ResultMeasure_MeasureUnitCode || null,
    ResultStatusIdentifier: r.ResultStatusIdentifier || "",
    ResultValueTypeName: r.ResultValueTypeName || "",
    DetectionQuantitationLimitTypeName: r.DetectionQuantitationLimitTypeName || undefined,
    DetectionQuantitationLimitMeasure_MeasureValue:
      r.DetectionQuantitationLimitMeasure_MeasureValue || undefined,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API — Summary (counts per station, no raw data)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch summary data from WQP.
 *
 * This is the safe call for state-level and county-level overviews.
 * Returns station locations + activity/result counts without downloading
 * the actual observations. Fast even for large states.
 *
 * Use this for:
 *   - State card: "Maryland has X monitoring stations with Y observations"
 *   - Map: plot station locations with size scaled to result count
 *   - Org breakdown: which organizations contribute data in this area
 */
export async function fetchSummary(params: WQPQuery): Promise<WQPSummary[]> {
  const qs = buildQueryString(params);
  const url = `${WQP_BASE}/data/summary/monitoringLocation/search?${qs}`;
  const csv = await wqpFetch(url);
  const rows = parseCSV(csv);

  return rows.map((r) => ({
    MonitoringLocationIdentifier: r.MonitoringLocationIdentifier || "",
    MonitoringLocationName: r.MonitoringLocationName || "",
    MonitoringLocationTypeName: r.MonitoringLocationTypeName || "",
    LatitudeMeasure: parseFloat(r.LatitudeMeasure) || 0,
    LongitudeMeasure: parseFloat(r.LongitudeMeasure) || 0,
    OrganizationIdentifier: r.OrganizationIdentifier || "",
    OrganizationFormalName: r.OrganizationFormalName || "",
    StateName: r.StateName || "",
    activityCount: parseInt(r.activityCount || "0", 10),
    resultCount: parseInt(r.resultCount || "0", 10),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// FIPS code reference (for query building)
// ─────────────────────────────────────────────────────────────────────────────

export const STATE_FIPS: Record<string, string> = {
  AL: "US:01", AK: "US:02", AZ: "US:04", AR: "US:05", CA: "US:06",
  CO: "US:08", CT: "US:09", DE: "US:10", DC: "US:11", FL: "US:12",
  GA: "US:13", HI: "US:15", ID: "US:16", IL: "US:17", IN: "US:18",
  IA: "US:19", KS: "US:20", KY: "US:21", LA: "US:22", ME: "US:23",
  MD: "US:24", MA: "US:25", MI: "US:26", MN: "US:27", MS: "US:28",
  MO: "US:29", MT: "US:30", NE: "US:31", NV: "US:32", NH: "US:33",
  NJ: "US:34", NM: "US:35", NY: "US:36", NC: "US:37", ND: "US:38",
  OH: "US:39", OK: "US:40", OR: "US:41", PA: "US:42", RI: "US:44",
  SC: "US:45", SD: "US:46", TN: "US:47", TX: "US:48", UT: "US:49",
  VT: "US:50", VA: "US:51", WA: "US:53", WV: "US:54", WI: "US:55",
  WY: "US:56", AS: "US:60", GU: "US:66", MP: "US:69", PR: "US:72",
  VI: "US:78",
};
