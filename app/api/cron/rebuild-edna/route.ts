// app/api/cron/rebuild-edna/route.ts
// Cron endpoint — fetches environmental DNA species detection data.
// Sources: GBIF occurrence API (eDNA basis of record), USGS biological sampling.
// Builds HUC12-level cache for biodiversity and ecological health assessment.
// Schedule: weekly Tuesday 4:00 AM via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  seteDNACache, geteDNACacheStatus,
  iseDNABuildInProgress, seteDNABuildInProgress,
  calculateBiodiversityIndex, classifyThreatStatus,
  type eDNAData, type eDNADetection,
} from '@/lib/ednaCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const GBIF_OCCURRENCE_API = 'https://api.gbif.org/v1/occurrence/search';
const USGS_BIOLOGICAL_API = 'https://waterservices.usgs.gov/nwis/site/';
const FETCH_TIMEOUT_MS = 30_000;
const CONCURRENCY = 3;  // Conservative for GBIF rate limits
const DELAY_MS = 1000;
const MAX_RECORDS_PER_HUC = 500;

// Priority HUC12s for initial implementation (Chesapeake Bay watershed)
const PRIORITY_HUCS = [
  '020700020301', '020700020302', '020700020303', // Patapsco River (Baltimore)
  '020600010501', '020600010502', '020600010503', // Potomac River (DC area)
  '020801040101', '020801040102', '020801040103', // James River (Richmond)
  '020700050301', '020700050302', '020700050303', // Susquehanna River
];

interface GBIFOccurrence {
  key: number;
  scientificName: string;
  species?: string;
  vernacularName?: string;
  decimalLatitude: number;
  decimalLongitude: number;
  eventDate: string;
  basisOfRecord: string;
  samplingProtocol?: string;
  datasetKey: string;
  occurrenceStatus: string;
  coordinateUncertaintyInMeters?: number;
}

interface USGSBiologicalSite {
  site_no: string;
  station_nm: string;
  dec_lat_va: number;
  dec_long_va: number;
  huc_cd: string;
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function huc8ToHuc12Approximation(huc8: string): string[] {
  // Approximate HUC12s within a HUC8 - in production, use NHD/WBD lookup
  const baseHuc12s: string[] = [];
  for (let i = 1; i <= 20; i++) {
    baseHuc12s.push(`${huc8}${i.toString().padStart(4, '0')}`);
  }
  return baseHuc12s.slice(0, 10); // Return first 10 approximated HUC12s
}

function coordinatesToHuc12(lat: number, lng: number): string | null {
  // Simplified HUC12 lookup - in production, use USGS WBD spatial service
  // For now, approximate based on geographic regions

  // Chesapeake Bay region approximation
  if (lat >= 36.5 && lat <= 40.0 && lng >= -79.5 && lng <= -75.0) {
    // Return appropriate Chesapeake HUC12 based on coordinates
    if (lat >= 39.0 && lng >= -77.0) return '020700020301'; // Patapsco area
    if (lat >= 38.5 && lng >= -77.5) return '020600010501'; // Potomac area
    return '020801040101'; // James River area
  }

  return null; // Outside priority area for now
}

async function fetchGBIFOccurrences(huc12: string): Promise<eDNADetection[]> {
  try {
    // GBIF query for eDNA detections within HUC12 bounding box
    // In production, would use precise HUC12 geometry
    const params = new URLSearchParams({
      basisOfRecord: 'MACHINE_OBSERVATION',
      hasCoordinate: 'true',
      hasGeospatialIssue: 'false',
      country: 'US',
      occurrenceStatus: 'PRESENT',
      limit: MAX_RECORDS_PER_HUC.toString(),
      // Would add geometry parameter for HUC12 bounds
    });

    const url = `${GBIF_OCCURRENCE_API}?${params}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PEARL-Platform/1.0 (eDNA Integration)',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[eDNA Cron] GBIF ${huc12}: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const occurrences: GBIFOccurrence[] = data.results || [];

    const detections: eDNADetection[] = [];

    for (const occ of occurrences) {
      // Filter for aquatic species and eDNA sampling
      const iseDNA = occ.samplingProtocol?.toLowerCase().includes('edna') ||
                     occ.basisOfRecord === 'MACHINE_OBSERVATION';

      if (!iseDNA || !occ.decimalLatitude || !occ.decimalLongitude) continue;

      // Basic aquatic species filter (fish, amphibians, mollusks, etc.)
      const speciesName = occ.scientificName?.toLowerCase() || '';
      const vernacularName = occ.vernacularName?.toLowerCase() || '';
      const isAquatic = ['fish', 'mussel', 'clam', 'crayfish', 'amphibian', 'turtle', 'salamander', 'frog'].some(
        keyword => speciesName.includes(keyword) || vernacularName.includes(keyword)
      );

      if (!isAquatic) continue;

      const confidence = occ.coordinateUncertaintyInMeters && occ.coordinateUncertaintyInMeters < 100 ? 'high' :
                        occ.coordinateUncertaintyInMeters && occ.coordinateUncertaintyInMeters < 1000 ? 'medium' : 'low';

      detections.push({
        gbifKey: occ.key,
        scientificName: occ.scientificName,
        commonName: occ.vernacularName,
        detectionDate: occ.eventDate,
        samplingMethod: 'eDNA',
        confidence,
        coordinates: {
          lat: occ.decimalLatitude,
          lng: occ.decimalLongitude,
        },
        datasetKey: occ.datasetKey,
        threatStatus: classifyThreatStatus(occ.scientificName, occ.vernacularName),
      });
    }

    console.log(`[eDNA Cron] ${huc12}: Found ${detections.length} eDNA detections`);
    return detections;

  } catch (err) {
    console.error(`[eDNA Cron] GBIF error for ${huc12}:`, err);
    return [];
  }
}

async function fetchUSGSBiologicalSites(huc12: string): Promise<eDNADetection[]> {
  try {
    const huc8 = huc12.slice(0, 8);
    const params = new URLSearchParams({
      format: 'json',
      huc: huc8,
      siteType: 'ST',  // Stream sites
      hasDataTypeCd: 'bio',  // Biological data
    });

    const url = `${USGS_BIOLOGICAL_API}?${params}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[eDNA Cron] USGS ${huc12}: HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const sites: USGSBiologicalSite[] = data.value?.timeSeries || [];

    // For now, return placeholder - would need biological data endpoint
    console.log(`[eDNA Cron] ${huc12}: Found ${sites.length} USGS biological sites`);
    return []; // Would implement biological data fetch

  } catch (err) {
    console.error(`[eDNA Cron] USGS error for ${huc12}:`, err);
    return [];
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (iseDNABuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'eDNA build already in progress',
      cache: await geteDNACacheStatus(),
    });
  }

  seteDNABuildInProgress(true);
  const startTime = Date.now();

  try {
    const hucData: Record<string, eDNAData> = {};
    let totalDetections = 0;
    let fetchErrors = 0;

    // Process priority HUCs in batches
    for (let i = 0; i < PRIORITY_HUCS.length; i += CONCURRENCY) {
      const batch = PRIORITY_HUCS.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map(async (huc12) => {
          try {
            // Fetch from multiple sources
            const [gbifDetections, usgsDetections] = await Promise.all([
              fetchGBIFOccurrences(huc12),
              fetchUSGSBiologicalSites(huc12),
            ]);

            const allDetections = [...gbifDetections, ...usgsDetections];
            const uniqueSpecies = new Set(allDetections.map(d => d.scientificName)).size;
            const endangeredCount = allDetections.filter(d =>
              d.threatStatus === 'endangered' || d.threatStatus === 'threatened'
            ).length;
            const invasiveCount = allDetections.filter(d => d.threatStatus === 'invasive').length;

            const lastSampled = allDetections.length > 0
              ? allDetections.sort((a, b) =>
                  new Date(b.detectionDate).getTime() - new Date(a.detectionDate).getTime()
                )[0].detectionDate
              : null;

            const confidenceScore = allDetections.length > 0
              ? Math.round((allDetections.filter(d => d.confidence === 'high').length / allDetections.length) * 100)
              : 0;

            hucData[huc12] = {
              huc12,
              totalDetections: allDetections.length,
              uniqueSpecies,
              endangeredCount,
              invasiveCount,
              lastSampled,
              confidenceScore,
              detections: allDetections,
              biodiversityIndex: calculateBiodiversityIndex(allDetections),
            };

            totalDetections += allDetections.length;
            return { huc12, success: true, detections: allDetections.length };

          } catch (err) {
            console.error(`[eDNA Cron] Error processing ${huc12}:`, err);
            fetchErrors++;
            return { huc12, success: false, error: err };
          }
        })
      );

      // Log batch results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          console.log(`[eDNA Cron] ${result.value.huc12}: ${result.value.success ? 'Success' : 'Failed'}`);
        }
      }

      // Rate limiting delay between batches
      if (i + CONCURRENCY < PRIORITY_HUCS.length) {
        await delay(DELAY_MS);
      }
    }

    // Build final cache data
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        hucCount: Object.keys(hucData).length,
        totalDetections,
      },
      hucs: hucData,
    };

    // Save cache
    await seteDNACache(cacheData);

    const duration = Date.now() - startTime;
    await recordCronRun('rebuild-edna', true, duration);

    return NextResponse.json({
      status: 'success',
      duration: `${duration}ms`,
      hucCount: Object.keys(hucData).length,
      totalDetections,
      fetchErrors,
      cache: await geteDNACacheStatus(),
    });

  } catch (err) {
    const duration = Date.now() - startTime;
    const error = err instanceof Error ? err.message : 'Unknown error';

    Sentry.captureException(err);
    await recordCronRun('rebuild-edna', false, duration, error);
    await notifySlackCronFailure('rebuild-edna', error);

    return NextResponse.json({
      status: 'error',
      error,
      duration: `${duration}ms`,
      cache: await geteDNACacheStatus(),
    }, { status: 500 });

  } finally {
    seteDNABuildInProgress(false);
  }
}