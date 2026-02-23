import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getAttainsCacheSummary, ensureWarmed as warmAttains } from '@/lib/attainsCache';
import { getWqpCacheStatus, ensureWarmed as warmWqp } from '@/lib/wqpCache';
import { getCedenCacheStatus, ensureWarmed as warmCeden } from '@/lib/cedenCache';
import { getIcisCacheStatus, ensureWarmed as warmIcis } from '@/lib/icisCache';
import { getNwisGwCacheStatus, ensureWarmed as warmNwisGw } from '@/lib/nwisGwCache';
import { getSdwisCacheStatus, ensureWarmed as warmSdwis } from '@/lib/sdwisCache';
import { getEchoCacheStatus, ensureWarmed as warmEcho } from '@/lib/echoCache';
import { getFrsCacheStatus, ensureWarmed as warmFrs } from '@/lib/frsCache';
import { getPfasCacheStatus, ensureWarmed as warmPfas } from '@/lib/pfasCache';
import { getBwbCacheStatus, ensureWarmed as warmBwb } from '@/lib/bwbCache';
import { getCdcNwssCacheStatus, ensureWarmed as warmCdcNwss } from '@/lib/cdcNwssCache';
import { getNdbcCacheStatus, ensureWarmed as warmNdbc } from '@/lib/ndbcCache';
import { getNasaCmrCacheStatus, ensureWarmed as warmNasaCmr } from '@/lib/nasaCmrCache';
import { getNarsCacheStatus, ensureWarmed as warmNars } from '@/lib/narsCache';
import { getDataGovCacheStatus, ensureWarmed as warmDataGov } from '@/lib/dataGovCache';
import { getUsaceCacheStatus, ensureWarmed as warmUsace } from '@/lib/usaceCache';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SourceHealthEntry {
  id: string;
  name: string;
  status: 'online' | 'degraded' | 'offline';
  responseTimeMs: number;
  httpStatus: number | null;
  error: string | null;
  checkedAt: string;
}

// ─── Individual Health Checks ────────────────────────────────────────────────

async function check(
  id: string,
  name: string,
  url: string,
  timeoutMs: number,
  method: 'GET' | 'HEAD' = 'GET',
): Promise<SourceHealthEntry> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'PEARL-HealthCheck/1.0' },
    });
    const elapsed = Date.now() - start;
    return {
      id,
      name,
      status: res.ok ? (elapsed > 5000 ? 'degraded' : 'online') : 'offline',
      responseTimeMs: elapsed,
      httpStatus: res.status,
      error: res.ok ? null : `HTTP ${res.status}`,
      checkedAt: new Date().toISOString(),
    };
  } catch (e: unknown) {
    return {
      id,
      name,
      status: 'offline',
      responseTimeMs: Date.now() - start,
      httpStatus: null,
      error: e instanceof Error ? e.message : 'Network error',
      checkedAt: new Date().toISOString(),
    };
  }
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET() {
  // Warm all caches from blob in parallel (cold-start recovery)
  await Promise.all([
    warmAttains(), warmWqp(), warmCeden(), warmIcis(), warmSdwis(),
    warmNwisGw(), warmEcho(), warmFrs(), warmPfas(), warmBwb(),
    warmCdcNwss(), warmNdbc(), warmNasaCmr(), warmNars(), warmDataGov(), warmUsace(),
  ]);

  const bwbToken = process.env.WATER_REPORTER_API_KEY || '';

  const checks = await Promise.allSettled([
    // Source 1: USGS Real-Time IV
    check(
      'USGS',
      'USGS Real-Time',
      'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01589440&parameterCd=00300&period=PT1H',
      8_000,
    ),
    // Source 2: USGS Daily Values
    check(
      'USGS_DV',
      'USGS Daily',
      'https://api.waterdata.usgs.gov/ogcapi/v0/collections/daily?f=json&limit=1',
      8_000,
    ),
    // Source 3: Blue Water Baltimore / Water Reporter
    bwbToken && bwbToken !== 'your_token_here'
      ? check(
          'BWB',
          'Blue Water Baltimore',
          `https://api.waterreporter.org/datasets?limit=1&access_token=${bwbToken}`,
          8_000,
        )
      : Promise.resolve<SourceHealthEntry>({
          id: 'BWB',
          name: 'Blue Water Baltimore',
          status: 'offline',
          responseTimeMs: -1,
          httpStatus: null,
          error: 'API key not configured',
          checkedAt: new Date().toISOString(),
        }),
    // Source 4: Chesapeake Bay Program
    check(
      'CBP',
      'Chesapeake Bay Program',
      'https://datahub.chesapeakebay.net/api/WaterQuality/WaterQualityStation/',
      8_000,
    ),
    // Source 5: Water Quality Portal
    check(
      'WQP',
      'EPA / USGS (WQP)',
      'https://www.waterqualitydata.us/wqx3/Result/search?siteid=USGS-01589440&characteristicName=Dissolved+oxygen&mimeType=csv&dataProfile=narrow&startDateLo=01-01-2025&startDateHi=01-02-2025',
      15_000,
    ),
    // Source 6: ERDDAP / MD DNR
    check(
      'ERDDAP',
      'MD DNR (ERDDAP)',
      'https://erddap.maracoos.org/erddap/info/index.json?page=1&itemsPerPage=1',
      8_000,
    ),
    // Source 7: NOAA CO-OPS
    check(
      'NOAA',
      'NOAA CO-OPS',
      'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=8574680&product=water_temperature&date=latest&units=metric&time_zone=gmt&format=json&application=pearl_platform',
      8_000,
    ),
    // Source 8: Monitor My Watershed (no /api/v1/ — use organizations endpoint)
    check(
      'MMW',
      'Monitor My Watershed',
      'https://monitormywatershed.org/api/organizations/',
      10_000,
    ),
    // Source 9: EPA Envirofacts
    check(
      'EPA_EF',
      'EPA Envirofacts',
      'https://data.epa.gov/efservice/WATER_SYSTEM/STATE_CODE/MD/ROWS/0:0/JSON',
      8_000,
    ),
    // Source 10: NASA STREAM
    check(
      'NASA_STREAM',
      'NASA STREAM',
      'https://earthdata.nasa.gov',
      5_000,
      'HEAD',
    ),
    // Source 11: HydroShare
    check(
      'HYDROSHARE',
      'HydroShare',
      'https://www.hydroshare.org/hsapi/resource/?count=1',
      8_000,
    ),
    // Source 12: CEDEN
    check(
      'CEDEN',
      'CEDEN',
      'https://data.ca.gov/api/3/action/package_show?id=surface-water-chemistry-results',
      8_000,
    ),
    // Source 13: State Portals (internal proxy)
    check(
      'STATE',
      'State Portal',
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/water-data?action=state-portal&state=MD&limit=1`,
      10_000,
    ),
    // Source 14: EPA ICIS (NPDES compliance)
    check(
      'ICIS',
      'EPA ICIS Compliance',
      'https://data.epa.gov/efservice/ICIS_PERMIT/STATE_ABBR/MD/ROWS/0:0/JSON',
      8_000,
    ),
    // Source 15: USGS NWIS Groundwater
    check(
      'USGS_GW',
      'USGS Groundwater',
      'https://waterservices.usgs.gov/nwis/gwlevels/?format=json&stateCd=MD&period=P7D&siteStatus=active',
      10_000,
    ),
    // Source 16: EPA ATTAINS
    check(
      'ATTAINS',
      'EPA ATTAINS',
      'https://attains.epa.gov/attains-public/api/states',
      8_000,
    ),
    // Source 17: EPA ICIS DMR
    check(
      'ICIS_DMR',
      'EPA ICIS DMR',
      'https://data.epa.gov/efservice/ICIS_DMR/STATE_ABBR/MD/ROWS/0:0/JSON',
      10_000,
    ),
    // Source 18: EPA ECHO Facilities
    check(
      'ECHO',
      'EPA ECHO Facilities',
      'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?output=JSON&p_st=MD&responseset=1',
      8_000,
    ),
    // Source 19: EPA ECHO Violations
    check(
      'ECHO_V',
      'EPA ECHO Violations',
      'https://echodata.epa.gov/echo/cwa_rest_services.get_facilities?output=JSON&p_st=MD&p_qiv=Y&responseset=1',
      8_000,
    ),
    // Source 20: EPA FRS WWTPs
    check(
      'FRS',
      'EPA FRS WWTPs',
      'https://data.epa.gov/efservice/FRS_PROGRAM_FACILITY/PGM_SYS_ACRNM/NPDES/COUNT/JSON',
      8_000,
    ),
    // Source 21: EPA PFAS (UCMR tables removed from Envirofacts; using ECHO tools as proxy)
    check(
      'PFAS',
      'EPA PFAS Data',
      'https://echo.epa.gov/trends/pfas-tools',
      8_000,
      'HEAD',
    ),
    // Source 22: CDC Wastewater
    check(
      'CDC_NWSS',
      'CDC Wastewater',
      'https://data.cdc.gov/resource/2ew6-ywp6.json?$limit=1',
      8_000,
    ),
    // Source 23: NPS Water Quality (org code changed: NPSTORET → 11NPSWRD_WQX)
    check(
      'NPS',
      'NPS Water Quality',
      'https://www.waterqualitydata.us/data/Result/search?organization=11NPSWRD_WQX&mimeType=csv&zip=no&sorted=no&startDateLo=01-01-2025&startDateHi=02-01-2025',
      15_000,
    ),
    // Source 24: NOAA Buoys
    check(
      'NOAA_NDBC',
      'NOAA Buoys',
      'https://www.ndbc.noaa.gov/data/realtime2/',
      8_000,
      'HEAD',
    ),
    // Source 25: FL DBHYDRO (old API decommissioned; new UI at insights.sfwmd.gov)
    check(
      'FL_DBHYDRO',
      'FL DBHYDRO',
      'https://insights.sfwmd.gov/',
      8_000,
      'HEAD',
    ),
    // Source 26: NY Open Data (Beach Water Testing: Beginning 2015)
    check(
      'STATE_NY',
      'NY Open Data',
      'https://data.ny.gov/resource/wwwd-za77.json?$limit=1',
      8_000,
    ),
    // Source 27: NJ DEP (ArcGIS — no Socrata WQ data exists)
    check(
      'STATE_NJ',
      'NJ DEP Monitoring',
      'https://mapsdep.nj.gov/arcgis/rest/services/Features/Environmental_mon_water/MapServer/8/query?where=1%3D1&returnCountOnly=true&f=json',
      10_000,
    ),
    // Source 28: PA Open Data (Federated Water Quality Monitoring 1998-Current)
    check(
      'STATE_PA',
      'PA Open Data',
      'https://data.pa.gov/resource/vna2-gb3x.json?$limit=1',
      8_000,
    ),
    // Source 29: VA DEQ (ArcGIS — VA uses CKAN, not Socrata)
    check(
      'STATE_VA',
      'VA DEQ Monitoring',
      'https://gisdata.deq.virginia.gov/arcgis/rest/services/public/EDMA/MapServer/2/query?where=1%3D1&returnCountOnly=true&f=json',
      10_000,
    ),
    // Source 30: NASA CMR (satellite dataset catalog)
    check(
      'NASA_CMR',
      'NASA Earthdata CMR',
      'https://cmr.earthdata.nasa.gov/search/collections.json?keyword=chlorophyll&has_granules=true&page_size=1',
      8_000,
    ),
    // Source 31: EPA NARS (national aquatic resource surveys — static CSV files)
    check(
      'EPA_NARS',
      'EPA NARS Surveys',
      'https://www.epa.gov/national-aquatic-resource-surveys/data-national-aquatic-resource-surveys',
      8_000,
      'HEAD',
    ),
    // Source 32: Data.gov CKAN (US open data catalog)
    check(
      'DATAGOV',
      'Data.gov Catalog',
      'https://catalog.data.gov/api/3/action/package_search?q=water+quality&rows=1',
      8_000,
    ),
    // Source 33: USACE CWMS (Army Corps reservoirs)
    check(
      'USACE',
      'USACE Reservoirs',
      'https://cwms-data.usace.army.mil/cwms-data/offices?format=json',
      8_000,
    ),
    // Source 34: USGS NLDI (hydrologic network navigation)
    check(
      'USGS_NLDI',
      'USGS NLDI',
      'https://api.water.usgs.gov/nldi/linked-data',
      8_000,
    ),
  ]);

  const sources: SourceHealthEntry[] = [];
  for (const result of checks) {
    if (result.status === 'fulfilled') {
      sources.push(result.value);
    }
  }

  // ─── Datapoint Summary ──────────────────────────────────────────────────────
  const attainsSummary = getAttainsCacheSummary();
  const attainsStates = Object.values(attainsSummary.states);
  const attainsWaterbodies = attainsStates.reduce((sum, s) => sum + s.stored, 0);
  const attainsAssessments = attainsStates.reduce((sum, s) => sum + s.total, 0);

  const wqpStatus = getWqpCacheStatus();
  const wqpRecords = wqpStatus.loaded ? (wqpStatus as { totalRecords: number }).totalRecords : 0;
  const wqpStates = wqpStatus.loaded ? (wqpStatus as { statesProcessed: string[] }).statesProcessed.length : 0;

  const cedenStatus = getCedenCacheStatus();
  const cedenChem = cedenStatus.loaded ? (cedenStatus as { chemistryRecords: number }).chemistryRecords : 0;
  const cedenTox = cedenStatus.loaded ? (cedenStatus as { toxicityRecords: number }).toxicityRecords : 0;

  const icisStatus = getIcisCacheStatus();
  const icisPermits = icisStatus.loaded ? (icisStatus as { permitCount: number }).permitCount : 0;
  const icisViolations = icisStatus.loaded ? (icisStatus as { violationCount: number }).violationCount : 0;
  const icisDmr = icisStatus.loaded ? (icisStatus as { dmrCount: number }).dmrCount : 0;
  const icisEnforcement = icisStatus.loaded ? (icisStatus as { enforcementCount: number }).enforcementCount : 0;

  const nwisGwStatus = getNwisGwCacheStatus();
  const nwisGwSites = nwisGwStatus.loaded ? (nwisGwStatus as { siteCount: number }).siteCount : 0;
  const nwisGwLevels = nwisGwStatus.loaded ? (nwisGwStatus as { levelCount: number }).levelCount : 0;

  const sdwisStatus = getSdwisCacheStatus();
  const sdwisSystems = sdwisStatus.loaded ? (sdwisStatus as { systemCount: number }).systemCount : 0;
  const sdwisViolations = sdwisStatus.loaded ? (sdwisStatus as { violationCount: number }).violationCount : 0;
  const sdwisEnforcement = sdwisStatus.loaded ? (sdwisStatus as { enforcementCount: number }).enforcementCount : 0;

  const echoStatus = getEchoCacheStatus();
  const echoFacilities = echoStatus.loaded ? (echoStatus as { facilityCount: number }).facilityCount : 0;
  const echoViolations = echoStatus.loaded ? (echoStatus as { violationCount: number }).violationCount : 0;

  const frsStatus = getFrsCacheStatus();
  const frsFacilities = frsStatus.loaded ? (frsStatus as { facilityCount: number }).facilityCount : 0;

  const pfasStatus = getPfasCacheStatus();
  const pfasResults = pfasStatus.loaded ? (pfasStatus as { resultCount: number }).resultCount : 0;

  const bwbStatus = getBwbCacheStatus();
  const bwbStations = bwbStatus.loaded ? (bwbStatus as { stationCount: number }).stationCount : 0;
  const bwbReadings = bwbStatus.loaded ? (bwbStatus as { parameterReadings: number }).parameterReadings : 0;

  const cdcNwssStatus = getCdcNwssCacheStatus();
  const cdcNwssRecords = cdcNwssStatus.loaded ? (cdcNwssStatus as { recordCount: number }).recordCount : 0;

  const ndbcStatus = getNdbcCacheStatus();
  const ndbcStations = ndbcStatus.loaded ? (ndbcStatus as { stationCount: number }).stationCount : 0;

  const nasaCmrStatus = getNasaCmrCacheStatus();
  const nasaCmrCollections = nasaCmrStatus.loaded ? (nasaCmrStatus as { collectionCount: number }).collectionCount : 0;

  const narsStatus = getNarsCacheStatus();
  const narsSites = narsStatus.loaded ? (narsStatus as { siteCount: number }).siteCount : 0;

  const dataGovStatus = getDataGovCacheStatus();
  const dataGovDatasets = dataGovStatus.loaded ? (dataGovStatus as { datasetCount: number }).datasetCount : 0;

  const usaceStatus = getUsaceCacheStatus();
  const usaceLocations = usaceStatus.loaded ? (usaceStatus as { locationCount: number }).locationCount : 0;

  const datapoints = {
    attains: { states: attainsStates.length, waterbodies: attainsWaterbodies, assessments: attainsAssessments },
    wqp: { records: wqpRecords, states: wqpStates },
    ceden: { chemistry: cedenChem, toxicity: cedenTox },
    icis: { permits: icisPermits, violations: icisViolations, dmr: icisDmr, enforcement: icisEnforcement },
    nwisGw: { sites: nwisGwSites, levels: nwisGwLevels },
    sdwis: { systems: sdwisSystems, violations: sdwisViolations, enforcement: sdwisEnforcement },
    echo: { facilities: echoFacilities, violations: echoViolations },
    frs: { facilities: frsFacilities },
    pfas: { results: pfasResults },
    bwb: { stations: bwbStations, readings: bwbReadings },
    cdcNwss: { records: cdcNwssRecords },
    ndbc: { stations: ndbcStations },
    nasaCmr: { collections: nasaCmrCollections },
    nars: { sites: narsSites },
    dataGov: { datasets: dataGovDatasets },
    usace: { locations: usaceLocations },
    total: attainsWaterbodies + wqpRecords + cedenChem + cedenTox + icisPermits + icisViolations + icisDmr + icisEnforcement + nwisGwSites + nwisGwLevels + sdwisSystems + sdwisViolations + sdwisEnforcement + echoFacilities + echoViolations + frsFacilities + pfasResults + bwbStations + bwbReadings + cdcNwssRecords + ndbcStations + narsSites + usaceLocations,
  };

  return NextResponse.json(
    { timestamp: new Date().toISOString(), sources, datapoints },
    {
      headers: {
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=180',
      },
    },
  );
}
