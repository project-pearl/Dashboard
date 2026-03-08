/**
 * Cron endpoint — fetches MDE ArcGIS water quality assessment data for Maryland.
 * Discovers available layers from MDE's ArcGIS REST endpoints with multi-endpoint
 * failover, queries features with pagination, and normalizes to MdeAssessmentUnit[].
 *
 * Endpoint priority chain:
 *   1. mde.geodata.md.gov (primary state-hosted)
 *   2. mdewin64.mde.state.md.us (mirror)
 *   3. services.arcgis.com/njFNhDsUCentVYJW (ArcGIS Online fallback)
 *
 * Schedule: daily 9 AM UTC (after ATTAINS at 7 AM) via Vercel cron.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setMdeCache,
  isMdeBuildInProgress,
  setMdeBuildInProgress,
  type MdeAssessmentUnit,
} from '@/lib/mdeCache';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 30_000;
const PAGE_SIZE = 2000;
const DELAY_BETWEEN_PAGES_MS = 2_000;
const DELAY_BETWEEN_SERVICES_MS = 5_000;

// Endpoint priority chain — try in order until one works
const ENDPOINT_CHAIN = [
  {
    label: 'MDE GeoData (primary)',
    servicesUrl: 'https://mde.geodata.md.gov/arcgis/rest/services',
    waterQualityPath: '/Water_Quality',
  },
  {
    label: 'MDE Win64 (mirror)',
    servicesUrl: 'https://mdewin64.mde.state.md.us/arcgis/rest/services',
    waterQualityPath: '',
  },
  {
    label: 'ArcGIS Online (fallback)',
    servicesUrl: 'https://services.arcgis.com/njFNhDsUCentVYJW/ArcGIS/rest/services',
    waterQualityPath: '',
  },
];

// Keywords to match water quality / assessment services
const SERVICE_KEYWORDS = ['water', 'quality', 'tmdl', '303d', 'ir', 'assessment', 'impair', 'integrat'];

// ── ArcGIS Helpers ───────────────────────────────────────────────────────────

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'PEARL-MDE-Cron/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function discoverServices(endpoint: typeof ENDPOINT_CHAIN[0]): Promise<string[]> {
  const baseUrl = endpoint.servicesUrl + endpoint.waterQualityPath;
  const data = await fetchJson(`${baseUrl}?f=json`);

  const serviceUrls: string[] = [];

  // Check top-level services
  const services = data.services || [];
  for (const svc of services) {
    const name: string = (svc.name || '').toLowerCase();
    const type: string = svc.type || '';
    if ((type === 'MapServer' || type === 'FeatureServer') &&
        SERVICE_KEYWORDS.some(kw => name.includes(kw))) {
      serviceUrls.push(`${endpoint.servicesUrl}/${svc.name}/${type}`);
    }
  }

  // Check folders for nested services
  const folders = data.folders || [];
  for (const folder of folders) {
    const folderLower = (folder as string).toLowerCase();
    if (!SERVICE_KEYWORDS.some(kw => folderLower.includes(kw))) continue;
    try {
      const folderData = await fetchJson(`${endpoint.servicesUrl}/${folder}?f=json`);
      for (const svc of (folderData.services || [])) {
        const type: string = svc.type || '';
        if (type === 'MapServer' || type === 'FeatureServer') {
          serviceUrls.push(`${endpoint.servicesUrl}/${svc.name}/${type}`);
        }
      }
    } catch {
      // skip inaccessible folders
    }
  }

  return serviceUrls;
}

async function getLayerIds(serviceUrl: string): Promise<{ id: number; name: string }[]> {
  const data = await fetchJson(`${serviceUrl}?f=json`);
  const layers: { id: number; name: string }[] = [];
  for (const layer of (data.layers || [])) {
    layers.push({ id: layer.id, name: layer.name || `Layer ${layer.id}` });
  }
  return layers;
}

async function queryLayerFeatures(
  serviceUrl: string,
  layerId: number,
  layerName: string,
): Promise<MdeAssessmentUnit[]> {
  const units: MdeAssessmentUnit[] = [];
  let offset = 0;
  let hasMore = true;

  // First, get field names to know what's available
  let fields: string[] = [];
  try {
    const meta = await fetchJson(`${serviceUrl}/${layerId}?f=json`);
    fields = (meta.fields || []).map((f: { name: string }) => f.name.toLowerCase());
  } catch {
    // If metadata fails, try querying anyway with outFields=*
  }

  while (hasMore) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      returnGeometry: 'true',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: 'json',
    });

    try {
      const data = await fetchJson(`${serviceUrl}/${layerId}/query?${params}`);
      const features = data.features || [];

      if (features.length === 0) {
        hasMore = false;
        break;
      }

      for (const feat of features) {
        const attrs = feat.attributes || {};
        const geom = feat.geometry || {};

        const unit = normalizeFeature(attrs, geom, layerName, fields);
        if (unit) units.push(unit);
      }

      offset += features.length;

      // Check if there are more
      if (data.exceededTransferLimit === false || features.length < PAGE_SIZE) {
        hasMore = false;
      }

      // Rate limit
      if (hasMore) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_PAGES_MS));
      }
    } catch (err) {
      console.warn(`[MDE Cron] Error querying ${layerName} offset ${offset}: ${err}`);
      hasMore = false;
    }
  }

  return units;
}

function normalizeFeature(
  attrs: Record<string, any>,
  geom: { x?: number; y?: number; rings?: number[][][] },
  layerName: string,
  _fields: string[],
): MdeAssessmentUnit | null {
  // Try common ArcGIS field names for assessment unit data
  const auId =
    findAttr(attrs, 'AU_ID', 'ASSESSMENT_UNIT_ID', 'AssessmentUnitId', 'AU_NAME_ID', 'AUID',
      'assessment_unit_identifier', 'assessmentunitidentifier', 'OBJECTID');
  if (!auId) return null;

  const name =
    findAttr(attrs, 'AU_NAME', 'WATER_NAME', 'WaterName', 'WATERBODY_NAME', 'NAME',
      'assessmentunitname', 'assessment_unit_name', 'waterbodyname') || '';

  const waterType =
    findAttr(attrs, 'WATER_TYPE', 'WaterType', 'WATERBODY_TYPE', 'AU_TYPE',
      'watertype', 'watertypecode') || 'unknown';

  const category =
    findAttr(attrs, 'IR_CATEGORY', 'CATEGORY', 'IR_CAT', 'Category',
      'ircategory', 'overallstatus', 'OVERALL_STATUS') || '';

  const causeRaw =
    findAttr(attrs, 'CAUSE', 'CAUSES', 'IMPAIRMENT_CAUSE', 'CauseOfImpairment',
      'cause_name', 'causename', 'POLLUTANT', 'pollutant') || '';
  const causes = causeRaw
    ? causeRaw.split(/[,;|]/).map((c: string) => c.trim()).filter(Boolean)
    : [];

  const tmdlStatus =
    findAttr(attrs, 'TMDL_STATUS', 'TMDLStatus', 'TMDL', 'tmdlstatus',
      'tmdl_completion_status') || 'na';

  const tmdlDateRaw =
    findAttr(attrs, 'TMDL_DATE', 'TMDL_APPROVAL_DATE', 'TMDLDate', 'tmdldate',
      'tmdl_approval_date');
  let tmdlDate: string | null = null;
  if (tmdlDateRaw) {
    // ArcGIS often returns epoch ms
    if (typeof tmdlDateRaw === 'number' && tmdlDateRaw > 1e10) {
      tmdlDate = new Date(tmdlDateRaw).toISOString().split('T')[0];
    } else if (typeof tmdlDateRaw === 'string') {
      tmdlDate = tmdlDateRaw;
    }
  }

  // Extract coordinates
  let lat: number | null = null;
  let lon: number | null = null;

  // Point geometry
  if (geom.x != null && geom.y != null) {
    lon = geom.x;
    lat = geom.y;
  }
  // Polygon geometry — use centroid of first ring
  else if (geom.rings && geom.rings.length > 0) {
    const ring = geom.rings[0];
    if (ring.length > 0) {
      let sumX = 0, sumY = 0;
      for (const pt of ring) {
        sumX += pt[0];
        sumY += pt[1];
      }
      lon = sumX / ring.length;
      lat = sumY / ring.length;
    }
  }

  // Also check for lat/lon in attributes
  if (lat === null || lon === null) {
    const attrLat = findAttr(attrs, 'LATITUDE', 'LAT', 'Y', 'latitude');
    const attrLon = findAttr(attrs, 'LONGITUDE', 'LON', 'LONG', 'X', 'longitude');
    if (attrLat != null && attrLon != null) {
      lat = Number(attrLat);
      lon = Number(attrLon);
      if (isNaN(lat) || isNaN(lon)) { lat = null; lon = null; }
    }
  }

  return {
    auId: String(auId),
    name,
    waterType,
    category,
    causes,
    tmdlStatus,
    tmdlDate,
    lat,
    lon,
    attainsId: null,
    sourceLayer: layerName,
  };
}

/** Find first non-null/undefined attribute value by trying multiple field names. */
function findAttr(attrs: Record<string, any>, ...keys: string[]): any {
  for (const key of keys) {
    // Try exact match
    if (attrs[key] != null && attrs[key] !== '') return attrs[key];
    // Try case-insensitive
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(attrs)) {
      if (k.toLowerCase() === lower && v != null && v !== '') return v;
    }
  }
  return null;
}

// ── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (isMdeBuildInProgress()) {
    return NextResponse.json({ status: 'skipped', reason: 'build in progress' });
  }

  setMdeBuildInProgress(true);
  const startTime = Date.now();

  try {
    let allUnits: MdeAssessmentUnit[] = [];
    let usedEndpoint = '';

    // Try each endpoint in priority order
    for (const endpoint of ENDPOINT_CHAIN) {
      console.log(`[MDE Cron] Trying ${endpoint.label}...`);
      try {
        const serviceUrls = await discoverServices(endpoint);
        if (serviceUrls.length === 0) {
          console.warn(`[MDE Cron] ${endpoint.label}: no matching services found`);
          continue;
        }

        console.log(`[MDE Cron] ${endpoint.label}: found ${serviceUrls.length} services`);

        for (const serviceUrl of serviceUrls) {
          try {
            const layers = await getLayerIds(serviceUrl);
            console.log(`[MDE Cron] ${serviceUrl}: ${layers.length} layers`);

            for (const layer of layers) {
              try {
                const units = await queryLayerFeatures(serviceUrl, layer.id, layer.name);
                if (units.length > 0) {
                  console.log(`[MDE Cron] ${layer.name}: ${units.length} features`);
                  allUnits.push(...units);
                }
              } catch (err) {
                console.warn(`[MDE Cron] Failed querying layer ${layer.name}: ${err}`);
              }
            }

            await new Promise(r => setTimeout(r, DELAY_BETWEEN_SERVICES_MS));
          } catch (err) {
            console.warn(`[MDE Cron] Failed service ${serviceUrl}: ${err}`);
          }
        }

        if (allUnits.length > 0) {
          usedEndpoint = endpoint.label;
          break; // Success — stop trying other endpoints
        }
      } catch (err) {
        console.warn(`[MDE Cron] ${endpoint.label} failed: ${err}`);
      }
    }

    // Deduplicate by auId (prefer first occurrence)
    const seen = new Set<string>();
    const deduped: MdeAssessmentUnit[] = [];
    for (const unit of allUnits) {
      if (!seen.has(unit.auId)) {
        seen.add(unit.auId);
        deduped.push(unit);
      }
    }

    // Empty-data guard — skip cache update if 0 records
    if (deduped.length === 0) {
      console.warn('[MDE Cron] No assessment units found from any endpoint — preserving existing cache');
      return NextResponse.json({
        status: 'warning',
        message: 'No data from any endpoint — cache preserved',
        elapsed: Date.now() - startTime,
      });
    }

    // Persist to cache
    await setMdeCache(deduped);

    const elapsed = Date.now() - startTime;
    console.log(`[MDE Cron] Complete: ${deduped.length} units from ${usedEndpoint} (${elapsed}ms)`);

    recordCronRun('rebuild-mde', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'ok',
      assessmentUnits: deduped.length,
      endpoint: usedEndpoint,
      elapsed,
    });
  } catch (err) {
    console.error('[MDE Cron] Fatal error:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-mde' } });

    notifySlackCronFailure({ cronName: 'rebuild-mde', error: err instanceof Error ? err.message : 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-mde', 'error', Date.now() - startTime, err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { status: 'error', error: String(err) },
      { status: 500 },
    );
  } finally {
    setMdeBuildInProgress(false);
  }
}
