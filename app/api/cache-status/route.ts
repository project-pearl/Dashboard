// app/api/cache-status/route.ts
// Unified cache status endpoint — returns last-built timestamps, record counts,
// and staleness flags for all 12 cache modules.

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { getWqpCacheStatus, ensureWarmed as warmWqp } from '@/lib/wqpCache';
import { getCacheStatus as getAttainsCacheStatus, ensureWarmed as warmAttains } from '@/lib/attainsCache';
import { getCedenCacheStatus, ensureWarmed as warmCeden } from '@/lib/cedenCache';
import { getIcisCacheStatus, ensureWarmed as warmIcis } from '@/lib/icisCache';
import { getSdwisCacheStatus, ensureWarmed as warmSdwis } from '@/lib/sdwisCache';
import { getNwisGwCacheStatus, ensureWarmed as warmNwisGw } from '@/lib/nwisGwCache';
import { getEchoCacheStatus, ensureWarmed as warmEcho } from '@/lib/echoCache';
import { getFrsCacheStatus, ensureWarmed as warmFrs } from '@/lib/frsCache';
import { getPfasCacheStatus, ensureWarmed as warmPfas } from '@/lib/pfasCache';
import { getCacheStatus as getInsightsCacheStatus, ensureWarmed as warmInsights } from '@/lib/insightsCache';
import { getStateReportStatus, ensureWarmed as warmStateReports } from '@/lib/stateReportCache';
import { getBwbCacheStatus, ensureWarmed as warmBwb } from '@/lib/bwbCache';
import { getCdcNwssCacheStatus, ensureWarmed as warmCdcNwss } from '@/lib/cdcNwssCache';
import { getNdbcCacheStatus, ensureWarmed as warmNdbc } from '@/lib/ndbcCache';
import { getNasaCmrCacheStatus, ensureWarmed as warmNasaCmr } from '@/lib/nasaCmrCache';
import { getNarsCacheStatus, ensureWarmed as warmNars } from '@/lib/narsCache';
import { getDataGovCacheStatus, ensureWarmed as warmDataGov } from '@/lib/dataGovCache';
import { getUsaceCacheStatus, ensureWarmed as warmUsace } from '@/lib/usaceCache';
import { getStateIRCacheStatus } from '@/lib/stateIRCache';
import { getUsgsIvCacheStatus, ensureWarmed as warmNwisIv } from '@/lib/nwisIvCache';
import { getAlertCacheStatus, ensureWarmed as warmUsgsAlerts } from '@/lib/usgsAlertCache';
import { getNwsAlertCacheStatus, ensureWarmed as warmNwsAlerts } from '@/lib/nwsAlertCache';
import { getNwpsCacheStatus, ensureWarmed as warmNwps } from '@/lib/nwpsCache';
import { getCoopsCacheStatus, ensureWarmed as warmCoops } from '@/lib/coopsCache';
import { getSnotelCacheStatus, ensureWarmed as warmSnotel } from '@/lib/snotelCache';
import { getTriCacheStatus, ensureWarmed as warmTri } from '@/lib/triCache';
import { getFemaCacheStatus, ensureWarmed as warmFema } from '@/lib/femaCache';
import { getSuperfundCacheStatus, ensureWarmed as warmSuperfund } from '@/lib/superfundCache';
import { getUSAsCacheStatus, ensureWarmed as warmUSAs } from '@/lib/usaSpendingCache';
import { getGrantsGovCacheStatus, ensureWarmed as warmGrantsGov } from '@/lib/grantsGovCache';
import { getSamCacheStatus, ensureWarmed as warmSam } from '@/lib/samGovCache';
import { getUsdmCacheStatus, ensureWarmed as warmUsdm } from '@/lib/usdmCache';
import { getUsgsDvCacheStatus, ensureWarmed as warmUsgsDv } from '@/lib/usgsDvCache';
import { getCoopsDerivedCacheStatus, ensureWarmed as warmCoopsDerived } from '@/lib/coopsDerivedCache';
import { getErddapSatCacheStatus, ensureWarmed as warmErddapSat } from '@/lib/erddapSatCache';
import { getNasaStreamCacheStatus, ensureWarmed as warmNasaStream } from '@/lib/nasaStreamCache';
import { getNwmCacheStatus, ensureWarmed as warmNwm } from '@/lib/nwmCache';
import { getIpacCacheStatus, ensureWarmed as warmIpac } from '@/lib/ipacCache';
import { getNceiCacheStatus, ensureWarmed as warmNcei } from '@/lib/nceiCache';
import { getHabsosCacheStatus, ensureWarmed as warmHabsos } from '@/lib/habsosCache';
import { getBeaconCacheStatus, ensureWarmed as warmBeacon } from '@/lib/beaconCache';
import { getSsoCsoCacheStatus, ensureWarmed as warmSsoCso } from '@/lib/ssoCsoCache';
import { getGlerlCacheStatus, ensureWarmed as warmGlerl } from '@/lib/glerlCache';
import { getHefsCacheStatus, ensureWarmed as warmHefs } from '@/lib/hefsCache';
import { getFirmsCacheStatus, ensureWarmed as warmFirms } from '@/lib/firmsCache';
import { getSeismicCacheStatus, ensureWarmed as warmSeismic } from '@/lib/seismicCache';
import { getDamCacheStatus, ensureWarmed as warmDam } from '@/lib/damCache';
import { getEmbassyAqiCacheStatus, ensureWarmed as warmEmbassyAqi } from '@/lib/embassyAqiCache';
import { getNfipClaimsCacheStatus, ensureWarmed as warmNfipClaims } from '@/lib/nfipClaimsCache';
import { getHazMitCacheStatus, ensureWarmed as warmHazMit } from '@/lib/hazMitCache';
import { getUsbrCacheStatus, ensureWarmed as warmUsbr } from '@/lib/usbrCache';
import { getEchoEffluentCacheStatus, ensureWarmed as warmEchoEffluent } from '@/lib/echoEffluentCache';
import { getRcraCacheStatus, ensureWarmed as warmRcra } from '@/lib/rcraCache';
import { getSemsCacheStatus, ensureWarmed as warmSems } from '@/lib/semsCache';
import { getAdvocacyCacheStatus, ensureWarmed as warmAdvocacy } from '@/lib/advocacyCache';
import { getHospitalCacheStatus, ensureWarmed as warmHospitals } from '@/lib/hospitalCache';
import { getWaterborneOutbreakCacheStatus, ensureWarmed as warmOutbreaks } from '@/lib/waterborneIllnessCache';
import { getEnvironmentalHealthCacheStatus, ensureWarmed as warmEnvironmentalHealth } from '@/lib/environmentalHealthCache';
import { getCDCWonderCacheStatus, ensureWarmed as warmCDCWonder } from '@/lib/cdcWonderCache';
import { getHealthSummary, ensureWarmed as warmSentinelHealth } from '@/lib/sentinel/sentinelHealth';
import { getQueueStats, ensureWarmed as warmSentinelQueue } from '@/lib/sentinel/eventQueue';
import { getScoredHucsSummary, ensureWarmed as warmSentinelScores } from '@/lib/sentinel/scoringEngine';
import { SENTINEL_FLAGS } from '@/lib/sentinel/config';

function staleness(built: string | null | undefined): { stale: boolean; ageHours: number | null } {
  if (!built) return { stale: true, ageHours: null };
  const ageMs = Date.now() - new Date(built).getTime();
  const ageHours = Math.round(ageMs / (1000 * 60 * 60) * 10) / 10;
  return { stale: ageHours > 48, ageHours };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Warm caches from blob storage in batches of 6 (avoid overwhelming network)
  const warmBatches = [
    [warmWqp, warmAttains, warmCeden, warmIcis, warmSdwis, warmNwisGw],
    [warmEcho, warmFrs, warmPfas, warmInsights, warmStateReports, warmBwb],
    [warmCdcNwss, warmNdbc, warmNasaCmr, warmNars, warmDataGov, warmUsace],
    [warmNwisIv, warmUsgsAlerts, warmNwsAlerts, warmNwps, warmCoops, warmSnotel],
    [warmTri, warmUSAs, warmGrantsGov, warmSam, warmSentinelHealth, warmSentinelQueue, warmSentinelScores],
    [warmFema, warmSuperfund, warmUsdm, warmUsgsDv, warmCoopsDerived, warmErddapSat],
    [warmNasaStream, warmNwm, warmIpac, warmNcei, warmHabsos, warmGlerl, warmHefs, warmBeacon, warmSsoCso, warmFirms, warmSeismic, warmDam, warmEmbassyAqi],
    [warmNfipClaims, warmHazMit, warmUsbr, warmEchoEffluent, warmRcra, warmSems, warmAdvocacy],
    [warmHospitals, warmOutbreaks, warmEnvironmentalHealth, warmCDCWonder],
  ];
  for (const batch of warmBatches) {
    await Promise.allSettled(batch.map(fn => fn()));
  }

  const wqp = getWqpCacheStatus();
  const attains = getAttainsCacheStatus();
  const ceden = getCedenCacheStatus();
  const icis = getIcisCacheStatus();
  const sdwis = getSdwisCacheStatus();
  const nwisGw = getNwisGwCacheStatus();
  const echo = getEchoCacheStatus();
  const frs = getFrsCacheStatus();
  const pfas = getPfasCacheStatus();
  const insights = getInsightsCacheStatus();
  const stateReports = getStateReportStatus();
  const bwb = getBwbCacheStatus();
  const cdcNwss = getCdcNwssCacheStatus();
  const ndbc = getNdbcCacheStatus();
  const nasaCmr = getNasaCmrCacheStatus();
  const nars = getNarsCacheStatus();
  const dataGov = getDataGovCacheStatus();
  const usace = getUsaceCacheStatus();
  const stateIR = getStateIRCacheStatus();
  const nwisIv = getUsgsIvCacheStatus();
  const usgsAlerts = getAlertCacheStatus();
  const nwsAlerts = getNwsAlertCacheStatus();
  const nwps = getNwpsCacheStatus();
  const coops = getCoopsCacheStatus();
  const snotel = getSnotelCacheStatus();
  const tri = getTriCacheStatus();
  const usaSpending = getUSAsCacheStatus();
  const grantsGov = getGrantsGovCacheStatus();
  const sam = getSamCacheStatus();
  const fema = getFemaCacheStatus();
  const superfund = getSuperfundCacheStatus();
  const usdm = getUsdmCacheStatus();
  const usgsDv = getUsgsDvCacheStatus();
  const coopsDerived = getCoopsDerivedCacheStatus();
  const erddapSat = getErddapSatCacheStatus();
  const nasaStream = getNasaStreamCacheStatus();
  const nwm = getNwmCacheStatus();
  const ipac = getIpacCacheStatus();
  const ncei = getNceiCacheStatus();
  const habsos = getHabsosCacheStatus();
  const beacon = getBeaconCacheStatus();
  const ssoCso = getSsoCsoCacheStatus();
  const glerl = getGlerlCacheStatus();
  const hefs = getHefsCacheStatus();
  const firms = getFirmsCacheStatus();
  const seismic = getSeismicCacheStatus();
  const dam = getDamCacheStatus();
  const embassyAqi = getEmbassyAqiCacheStatus();
  const nfipClaims = getNfipClaimsCacheStatus();
  const hazMit = getHazMitCacheStatus();
  const usbr = getUsbrCacheStatus();
  const echoEffluent = getEchoEffluentCacheStatus();
  const rcra = getRcraCacheStatus();
  const sems = getSemsCacheStatus();
  const advocacy = getAdvocacyCacheStatus();
  const hospitals = getHospitalCacheStatus();
  const outbreaks = getWaterborneOutbreakCacheStatus();
  const environmentalHealth = getEnvironmentalHealthCacheStatus();
  const cdcWonder = getCDCWonderCacheStatus();

  const caches = {
    wqp: {
      ...wqp,
      ...staleness(wqp.loaded ? (wqp as any).built : null),
    },
    attains: {
      loaded: attains.status !== 'cold',
      source: attains.source,
      status: attains.status,
      statesLoaded: attains.statesLoaded.length,
      statesMissing: attains.statesMissing.length,
      lastDelta: attains.lastDelta,
      ...staleness(attains.lastBuilt),
    },
    ceden: {
      ...ceden,
      ...staleness(ceden.loaded ? (ceden as any).built : null),
    },
    icis: {
      ...icis,
      ...staleness(icis.loaded ? (icis as any).built : null),
    },
    sdwis: {
      ...sdwis,
      ...staleness(sdwis.loaded ? (sdwis as any).built : null),
    },
    nwisGw: {
      ...nwisGw,
      ...staleness(nwisGw.loaded ? (nwisGw as any).built : null),
    },
    echo: {
      ...echo,
      ...staleness(echo.loaded ? (echo as any).built : null),
    },
    frs: {
      ...frs,
      ...staleness(frs.loaded ? (frs as any).built : null),
    },
    pfas: {
      ...pfas,
      ...staleness(pfas.loaded ? (pfas as any).built : null),
    },
    insights: {
      ...insights,
      ...staleness(insights.lastFullBuild),
    },
    stateReports: {
      ...stateReports,
      ...staleness(stateReports.built),
    },
    bwb: {
      ...bwb,
      ...staleness(bwb.loaded ? (bwb as any).built : null),
    },
    cdcNwss: {
      ...cdcNwss,
      ...staleness(cdcNwss.loaded ? (cdcNwss as any).built : null),
    },
    ndbc: {
      ...ndbc,
      ...staleness(ndbc.loaded ? (ndbc as any).built : null),
    },
    nasaCmr: {
      ...nasaCmr,
      ...staleness(nasaCmr.loaded ? (nasaCmr as any).built : null),
    },
    nars: {
      ...nars,
      ...staleness(nars.loaded ? (nars as any).built : null),
    },
    dataGov: {
      ...dataGov,
      ...staleness(dataGov.loaded ? (dataGov as any).built : null),
    },
    usace: {
      ...usace,
      ...staleness(usace.loaded ? (usace as any).built : null),
    },
    stateIR: {
      ...stateIR,
      ...staleness(stateIR.loaded ? (stateIR as any).generated : null),
    },
    nwisIv: {
      ...nwisIv,
      ...staleness(nwisIv.loaded ? (nwisIv as any).built : null),
    },
    usgsAlerts: {
      ...usgsAlerts,
      ...staleness(usgsAlerts.loaded ? (usgsAlerts as any).built : null),
    },
    nwsAlerts: {
      ...nwsAlerts,
      ...staleness(nwsAlerts.loaded ? (nwsAlerts as any).built : null),
    },
    nwps: {
      ...nwps,
      ...staleness(nwps.loaded ? (nwps as any).built : null),
    },
    coops: {
      ...coops,
      ...staleness(coops.loaded ? (coops as any).built : null),
    },
    snotel: {
      ...snotel,
      ...staleness(snotel.loaded ? (snotel as any).built : null),
    },
    tri: {
      ...tri,
      ...staleness(tri.loaded ? (tri as any).built : null),
    },
    usaSpending: {
      ...usaSpending,
      ...staleness(usaSpending.loaded ? (usaSpending as any).built : null),
    },
    grantsGov: {
      ...grantsGov,
      ...staleness(grantsGov.loaded ? (grantsGov as any).built : null),
    },
    sam: {
      ...sam,
      ...staleness(sam.loaded ? (sam as any).built : null),
    },
    fema: {
      ...fema,
      ...staleness(fema.loaded ? (fema as any).built : null),
    },
    superfund: {
      ...superfund,
      ...staleness(superfund.loaded ? (superfund as any).built : null),
    },
    usdm: {
      ...usdm,
      ...staleness(usdm.loaded ? (usdm as any).built : null),
    },
    usgsDv: {
      ...usgsDv,
      ...staleness(usgsDv.loaded ? (usgsDv as any).built : null),
    },
    coopsDerived: {
      ...coopsDerived,
      ...staleness(coopsDerived.loaded ? (coopsDerived as any).built : null),
    },
    erddapSat: {
      ...erddapSat,
      ...staleness(erddapSat.loaded ? (erddapSat as any).built : null),
    },
    nasaStream: {
      ...nasaStream,
      ...staleness(nasaStream.loaded ? (nasaStream as any).built : null),
    },
    nwm: {
      ...nwm,
      ...staleness(nwm.loaded ? (nwm as any).built : null),
    },
    ipac: {
      ...ipac,
      ...staleness(ipac.loaded ? (ipac as any).built : null),
    },
    ncei: {
      ...ncei,
      ...staleness(ncei.loaded ? (ncei as any).built : null),
    },
    habsos: {
      ...habsos,
      ...staleness(habsos.loaded ? (habsos as any).built : null),
    },
    beacon: {
      ...beacon,
      ...staleness(beacon.loaded ? (beacon as any).built : null),
    },
    ssoCso: {
      ...ssoCso,
      ...staleness(ssoCso.loaded ? (ssoCso as any).built : null),
    },
    glerl: {
      ...glerl,
      ...staleness(glerl.loaded ? (glerl as any).built : null),
    },
    hefs: {
      ...hefs,
      ...staleness(hefs.loaded ? (hefs as any).built : null),
    },
    firms: {
      ...firms,
      ...staleness(firms.loaded ? (firms as any).built : null),
    },
    seismic: {
      ...seismic,
      ...staleness(seismic.loaded ? (seismic as any).built : null),
    },
    dam: {
      ...dam,
      ...staleness(dam.loaded ? (dam as any).built : null),
    },
    embassyAqi: {
      ...embassyAqi,
      ...staleness(embassyAqi.loaded ? (embassyAqi as any).built : null),
    },
    nfipClaims: {
      ...nfipClaims,
      ...staleness(nfipClaims.loaded ? (nfipClaims as any).built : null),
    },
    hazMit: {
      ...hazMit,
      ...staleness(hazMit.loaded ? (hazMit as any).built : null),
    },
    usbr: {
      ...usbr,
      ...staleness(usbr.loaded ? (usbr as any).built : null),
    },
    echoEffluent: {
      ...echoEffluent,
      ...staleness(echoEffluent.loaded ? (echoEffluent as any).built : null),
    },
    rcra: {
      ...rcra,
      ...staleness(rcra.loaded ? (rcra as any).built : null),
    },
    sems: {
      ...sems,
      ...staleness(sems.loaded ? (sems as any).built : null),
    },
    advocacy: {
      ...advocacy,
      ...staleness(advocacy.loaded ? (advocacy as any).built : null),
    },
    hospitals: {
      ...hospitals,
      ...staleness(hospitals.loaded ? (hospitals as any).built : null),
    },
    outbreaks: {
      ...outbreaks,
      ...staleness(outbreaks.loaded ? (outbreaks as any).built : null),
    },
    environmentalHealth: {
      ...environmentalHealth,
      ...staleness(environmentalHealth.loaded ? (environmentalHealth as any).built : null),
    },
    cdcWonder: {
      ...cdcWonder,
      ...staleness(cdcWonder.loaded ? (cdcWonder as any).built : null),
    },
  };

  const loadedCount = Object.values(caches).filter((c: any) => c.loaded !== false && c.status !== 'cold' && c.status !== 'idle').length;
  const staleCount = Object.values(caches).filter((c: any) => c.stale).length;

  // Delta summary — aggregate lastDelta from all caches
  const allDeltas = Object.values(caches).map((c: any) => c.lastDelta ?? null);
  const cachesWithDeltas = allDeltas.filter(d => d !== null).length;
  const cachesDataChanged = allDeltas.filter(d => d?.dataChanged === true).length;
  const cachesUnchanged = allDeltas.filter(d => d !== null && d.dataChanged === false).length;
  const cachesNoDelta = allDeltas.filter(d => d === null).length;

  // Sentinel summary (lightweight, no extra warming needed)
  let sentinel = null;
  if (SENTINEL_FLAGS.ENABLED) {
    try {
      const health = getHealthSummary();
      const queue = getQueueStats();
      const scores = getScoredHucsSummary();
      sentinel = { health, queue, scores };
    } catch {
      sentinel = { error: 'failed to load sentinel status' };
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary: {
      total: Object.keys(caches).length,
      loaded: loadedCount,
      stale: staleCount,
      deltaSummary: {
        cachesWithDeltas,
        cachesDataChanged,
        cachesUnchanged,
        cachesNoDelta,
      },
    },
    caches,
    sentinel,
  });
}
