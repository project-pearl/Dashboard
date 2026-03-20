// app/api/provenance/route.ts
// Returns real provenance metadata for a given metric — sources it from
// actual cache build timestamps, record counts, and cron schedules.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';

// Lazy-load cache status functions to avoid bundling everything at import time
async function getCacheStatuses() {
  const [
    { getCacheStatus: getAttainsStatus },
    { getWqpCacheStatus },
    { getIcisCacheStatus },
    { getSdwisCacheStatus },
    { getEchoCacheStatus },
    { getEchoEffluentCacheStatus },
    { getFrsCacheStatus },
    { getTriCacheStatus },
    { getUsgsIvCacheStatus },
    { getNwisGwCacheStatus },
    { getNwpsCacheStatus },
    { getCoopsCacheStatus },
    { getFemaCacheStatus },
    { getEJScreenCacheStatus },
    { getCDCWonderCacheStatus },
    { getHpsaCacheStatus },
  ] = await Promise.all([
    import('@/lib/attainsCache'),
    import('@/lib/wqpCache'),
    import('@/lib/icisCache'),
    import('@/lib/sdwisCache'),
    import('@/lib/echoCache'),
    import('@/lib/echoEffluentCache'),
    import('@/lib/frsCache'),
    import('@/lib/triCache'),
    import('@/lib/nwisIvCache'),
    import('@/lib/nwisGwCache'),
    import('@/lib/nwpsCache'),
    import('@/lib/coopsCache'),
    import('@/lib/femaCache'),
    import('@/lib/ejscreenCache'),
    import('@/lib/cdcWonderCache'),
    import('@/lib/hrsaHpsaCache'),
  ]);

  return {
    attains: getAttainsStatus(),
    wqp: getWqpCacheStatus(),
    icis: getIcisCacheStatus(),
    sdwis: getSdwisCacheStatus(),
    echo: getEchoCacheStatus(),
    echoEffluent: getEchoEffluentCacheStatus(),
    frs: getFrsCacheStatus(),
    tri: getTriCacheStatus(),
    nwisIv: getUsgsIvCacheStatus(),
    nwisGw: getNwisGwCacheStatus(),
    nwps: getNwpsCacheStatus(),
    coops: getCoopsCacheStatus(),
    fema: getFemaCacheStatus(),
    ejscreen: getEJScreenCacheStatus(),
    cdcWonder: getCDCWonderCacheStatus(),
    hrsaHpsa: getHpsaCacheStatus(),
  };
}

// Map metric names to the caches that source them
interface SourceMapping {
  cacheKeys: string[];         // Which caches contribute
  agency: string;              // Federal agency
  apiEndpoint: string;         // Original API source
  refreshSchedule: string;     // Cron schedule description
  epaMethod: string;           // Analytical/regulatory method
  dataDescription: string;     // What the data represents
}

const METRIC_SOURCE_MAP: Record<string, SourceMapping> = {
  'Dissolved Oxygen':        { cacheKeys: ['wqp', 'nwisIv'], agency: 'EPA / USGS', apiEndpoint: 'Water Quality Portal + USGS NWIS IV', refreshSchedule: 'WQP daily, NWIS every 5 min', epaMethod: 'EPA Method 360.1 / ASTM D888', dataDescription: 'Continuous and discrete DO measurements from federal monitoring networks' },
  'Total Nitrogen':          { cacheKeys: ['wqp', 'attains'], agency: 'EPA / USGS', apiEndpoint: 'Water Quality Portal', refreshSchedule: 'Daily cache rebuild', epaMethod: 'EPA Method 351.2', dataDescription: 'Discrete water quality sample results from WQP' },
  'Total Phosphorus':        { cacheKeys: ['wqp', 'attains'], agency: 'EPA / USGS', apiEndpoint: 'Water Quality Portal', refreshSchedule: 'Daily cache rebuild', epaMethod: 'EPA Method 365.1', dataDescription: 'Discrete water quality sample results from WQP' },
  'Turbidity':               { cacheKeys: ['wqp', 'nwisIv'], agency: 'EPA / USGS', apiEndpoint: 'Water Quality Portal + USGS NWIS IV', refreshSchedule: 'WQP daily, NWIS every 5 min', epaMethod: 'EPA Method 180.1 / ASTM D6910', dataDescription: 'Continuous and discrete turbidity measurements' },
  'E. coli':                 { cacheKeys: ['wqp'], agency: 'EPA', apiEndpoint: 'Water Quality Portal', refreshSchedule: 'Daily cache rebuild', epaMethod: 'EPA Method 1103.1', dataDescription: 'Bacteria monitoring results from WQP' },
  'pH':                      { cacheKeys: ['wqp', 'nwisIv'], agency: 'EPA / USGS', apiEndpoint: 'Water Quality Portal + USGS NWIS IV', refreshSchedule: 'WQP daily, NWIS every 5 min', epaMethod: 'EPA Method 150.1 / ASTM D1293', dataDescription: 'Continuous and discrete pH measurements' },
  'TSS':                     { cacheKeys: ['wqp'], agency: 'EPA', apiEndpoint: 'Water Quality Portal', refreshSchedule: 'Daily cache rebuild', epaMethod: 'EPA Method 160.2', dataDescription: 'Total suspended solids from discrete samples' },
  'Temperature':             { cacheKeys: ['wqp', 'nwisIv', 'coops'], agency: 'EPA / USGS / NOAA', apiEndpoint: 'WQP + NWIS + CO-OPS', refreshSchedule: 'NWIS every 5 min, CO-OPS every 6 hrs, WQP daily', epaMethod: 'ASTM D1498', dataDescription: 'Water temperature from multiple federal monitoring networks' },
  'Flow Rate':               { cacheKeys: ['nwisIv'], agency: 'USGS', apiEndpoint: 'USGS NWIS Instantaneous Values', refreshSchedule: 'Every 5 minutes', epaMethod: 'USGS continuous discharge methods', dataDescription: 'Real-time streamflow from USGS gaging stations' },
  'Water Quality Score':     { cacheKeys: ['attains', 'wqp', 'icis', 'sdwis'], agency: 'EPA (multi-source)', apiEndpoint: 'ATTAINS + WQP + ICIS + SDWIS', refreshSchedule: 'ATTAINS every 30 min, others daily', epaMethod: 'PIN 14-Layer Composite Index', dataDescription: 'Composite score from 14 indices across all federal water data sources' },
  'Compliance Score':        { cacheKeys: ['icis', 'echo', 'sdwis'], agency: 'EPA', apiEndpoint: 'ICIS-NPDES + ECHO + SDWIS', refreshSchedule: 'Daily cache rebuild', epaMethod: 'EPA NPDES 40 CFR §122.26', dataDescription: 'Permit compliance status from EPA enforcement databases' },
  'EJ Vulnerability':        { cacheKeys: ['ejscreen'], agency: 'EPA / CDC / Census', apiEndpoint: 'EJScreen (Harvard DataVerse) + CDC EJI + Census ACS', refreshSchedule: 'Weekly rebuild', epaMethod: 'EPA EJScreen methodology + CDC EJI 2024', dataDescription: 'Environmental justice indices at census block group / tract level' },
  'Impaired Waterbodies':    { cacheKeys: ['attains'], agency: 'EPA', apiEndpoint: 'EPA ATTAINS', refreshSchedule: 'Every 30 minutes', epaMethod: 'CWA Section 303(d) / 305(b)', dataDescription: 'Waterbody assessment and impairment listings from state reporting' },
  'SDWIS Violations':        { cacheKeys: ['sdwis'], agency: 'EPA', apiEndpoint: 'EPA SDWIS', refreshSchedule: 'Daily cache rebuild', epaMethod: 'SDWA compliance monitoring', dataDescription: 'Drinking water system violations and enforcement actions' },
  'NPDES Permits':           { cacheKeys: ['icis', 'echo'], agency: 'EPA', apiEndpoint: 'ICIS-NPDES + ECHO', refreshSchedule: 'Daily cache rebuild', epaMethod: 'CWA Section 402', dataDescription: 'Discharge permit compliance and violation data' },
  'DMR Violations':          { cacheKeys: ['echoEffluent'], agency: 'EPA', apiEndpoint: 'EPA ECHO Effluent', refreshSchedule: 'Daily cache rebuild', epaMethod: 'Discharge Monitoring Reports (40 CFR §122.41)', dataDescription: 'Effluent discharge monitoring violations' },
  'TRI Releases':            { cacheKeys: ['tri'], agency: 'EPA', apiEndpoint: 'EPA TRI / Envirofacts', refreshSchedule: 'Daily cache rebuild', epaMethod: 'EPCRA Section 313', dataDescription: 'Toxic chemical release data from industrial facilities' },
  'Flood Risk':              { cacheKeys: ['nwps', 'fema'], agency: 'NOAA / FEMA', apiEndpoint: 'NWPS + FEMA Declarations', refreshSchedule: 'NWPS every 30 min, FEMA daily', epaMethod: 'NWS river forecast methodology', dataDescription: 'Flood predictions and disaster declarations' },
  'Groundwater Level':       { cacheKeys: ['nwisGw'], agency: 'USGS', apiEndpoint: 'USGS NWIS Groundwater', refreshSchedule: 'Daily cache rebuild', epaMethod: 'USGS groundwater monitoring methods', dataDescription: 'Groundwater level measurements from USGS monitoring wells' },
  'MS4 Total':               { cacheKeys: ['icis', 'echo', 'attains'], agency: 'EPA', apiEndpoint: 'ICIS + ECHO + ATTAINS', refreshSchedule: 'Daily cache rebuild', epaMethod: 'CWA Section 402(p) MS4 permits', dataDescription: 'Municipal stormwater permit compliance data' },
  'Compliance Burden':       { cacheKeys: ['icis', 'echo', 'sdwis'], agency: 'EPA', apiEndpoint: 'ICIS + ECHO + SDWIS', refreshSchedule: 'Daily cache rebuild', epaMethod: 'EPA enforcement compliance analysis', dataDescription: 'Composite compliance burden from permit and enforcement data' },
  'Sustainability Score':    { cacheKeys: ['attains', 'wqp', 'tri'], agency: 'EPA (multi-source)', apiEndpoint: 'ATTAINS + WQP + TRI', refreshSchedule: 'Daily', epaMethod: 'PIN ESG Water Framework', dataDescription: 'ESG-aligned water sustainability score from multiple data sources' },
  'PFAS Detection':          { cacheKeys: ['echo', 'wqp'], agency: 'EPA', apiEndpoint: 'ECHO + WQP', refreshSchedule: 'Daily', epaMethod: 'EPA Method 533 / 537.1', dataDescription: 'PFAS contamination data from discharge monitoring and water quality samples' },
};

// Fallback for metrics not in the map
const DEFAULT_SOURCE: SourceMapping = {
  cacheKeys: ['attains'],
  agency: 'EPA',
  apiEndpoint: 'EPA ATTAINS',
  refreshSchedule: 'Every 30 minutes',
  epaMethod: 'EPA QA/R-5 Composite',
  dataDescription: 'Federal water quality assessment data',
};

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const metricName = request.nextUrl.searchParams.get('metric') || '';
  const mapping = METRIC_SOURCE_MAP[metricName] || DEFAULT_SOURCE;

  try {
    const statuses = await getCacheStatuses();

    // Build real lineage from cache metadata
    const lineage = mapping.cacheKeys.map(key => {
      const status = (statuses as any)[key];
      const built = status?.built || status?.lastUpdated || null;
      const loaded = status?.loaded ?? false;
      const recordCount = status?.recordCount ?? status?.stateCount ?? status?.opportunityCount ?? 0;

      return {
        cacheKey: key,
        loaded,
        built,
        recordCount,
        source: status?.source || null,
        staleness: built ? Math.round((Date.now() - new Date(built).getTime()) / 60000) : null,
      };
    });

    return NextResponse.json({
      metric: metricName,
      agency: mapping.agency,
      apiEndpoint: mapping.apiEndpoint,
      refreshSchedule: mapping.refreshSchedule,
      epaMethod: mapping.epaMethod,
      dataDescription: mapping.dataDescription,
      caches: lineage,
      allCachesLoaded: lineage.every(c => c.loaded),
      oldestBuild: lineage.filter(c => c.built).sort((a, b) => new Date(a.built!).getTime() - new Date(b.built!).getTime())[0]?.built || null,
      newestBuild: lineage.filter(c => c.built).sort((a, b) => new Date(b.built!).getTime() - new Date(a.built!).getTime())[0]?.built || null,
      totalRecords: lineage.reduce((sum, c) => sum + c.recordCount, 0),
    });
  } catch (err: any) {
    return NextResponse.json({
      metric: metricName,
      agency: mapping.agency,
      apiEndpoint: mapping.apiEndpoint,
      refreshSchedule: mapping.refreshSchedule,
      epaMethod: mapping.epaMethod,
      dataDescription: mapping.dataDescription,
      caches: [],
      error: err.message,
    });
  }
}
