// app/api/cache-status/route.ts
// Unified cache status endpoint — returns last-built timestamps, record counts,
// and staleness flags for all 12 cache modules.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
import { getGrantCacheDelta, ensureWarmed as warmGrants } from '@/lib/grantCache';
import { getSamCacheStatus, ensureWarmed as warmSam } from '@/lib/samGovCache';
import { getUsdmCacheStatus, ensureWarmed as warmUsdm } from '@/lib/usdmCache';
import { getUsgsDvCacheStatus, ensureWarmed as warmUsgsDv } from '@/lib/usgsDvCache';
import { getCoopsDerivedCacheStatus, ensureWarmed as warmCoopsDerived } from '@/lib/coopsDerivedCache';
import { getErddapSatCacheStatus, ensureWarmed as warmErddapSat } from '@/lib/erddapSatCache';
import { getNasaStreamCacheStatus, ensureWarmed as warmNasaStream } from '@/lib/nasaStreamCache';
import { getNwmCacheStatus, ensureWarmed as warmNwm } from '@/lib/nwmCache';
import { getIpacCacheStatus, ensureWarmed as warmIpac } from '@/lib/ipacCache';
import { geteDNACacheStatus, ensureeDNAWarmed } from '@/lib/ednaCache';
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
import { getEnvironmentalTrackingCacheStatus, ensureWarmed as warmEnvironmentalTracking } from '@/lib/environmentalTrackingCache';
import { getHealthDataGovCacheStatus, ensureWarmed as warmHealthDataGov } from '@/lib/healthDataGovCache';
import { getOpenFDACacheStatus, ensureWarmed as warmOpenFDA } from '@/lib/openFDACache';
import { getHpsaCacheStatus, ensureWarmed as warmHrsaHpsa } from '@/lib/hrsaHpsaCache';
import { getEJScreenCacheStatus, ensureWarmed as warmEJScreen } from '@/lib/ejscreenCache';
import { getCampdCacheStatus, ensureWarmed as warmCampd } from '@/lib/campdCache';
import { getClimateNormalsCacheStatus, ensureWarmed as warmClimateNormals } from '@/lib/climateNormalsCache';
import { getMyHealthfinderCacheStatus, ensureWarmed as warmMyHealthfinder } from '@/lib/myhealthfinderCache';
import { getATSDRToxicologyCacheStatus, ensureWarmed as warmATSDRToxicology } from '@/lib/atsdrToxicologyCache';
import { getUSGSWQPCacheStatus, ensureWarmed as warmUSGSWQP } from '@/lib/usgsWqpCache';
import { getDataCDCGovCacheStatus, ensureWarmed as warmDataCDCGov } from '@/lib/dataCdcGovCache';
import { getDoDPFASCacheStatus, ensureWarmed as warmDoDPFAS } from '@/lib/dodPfasCache';
import { getUsgsOgcCacheStatus, ensureWarmed as warmUsgsOgc } from '@/lib/usgsOgcCache';
import { getNgwmnCacheStatus, ensureWarmed as warmNgwmn } from '@/lib/ngwmnCache';
import { getFloodImpactCacheStatus, ensureWarmed as warmFloodImpact } from '@/lib/floodImpactCache';
import { getEpaPfasAnalyticsCacheStatus, ensureWarmed as warmEpaPfas } from '@/lib/epaPfasAnalyticsCache';
import { getDodPfasSitesCacheStatus, ensureWarmed as warmDodPfasSites } from '@/lib/dodPfasSitesCache';
import { getNwsForecastCacheStatus, ensureWarmed as warmNwsForecast } from '@/lib/nwsForecastCache';
import { getWaterAvailCacheStatus, ensureWarmed as warmWaterAvail } from '@/lib/usgsWaterAvailCache';
import { getCyberRiskCacheStatus, ensureWarmed as warmCyberRisk } from '@/lib/cyberRiskCache';
import { getGemsStatCacheStatus, ensureWarmed as warmGemStat } from '@/lib/gemstatCache';
import { getCopernicusCdsCacheStatus, ensureWarmed as warmCopernicusCds } from '@/lib/copernicusCdsCache';
import { getHealthSummary, ensureWarmed as warmSentinelHealth } from '@/lib/sentinel/sentinelHealth';
import { getQueueStats, ensureWarmed as warmSentinelQueue } from '@/lib/sentinel/eventQueue';
import { getScoredHucsSummary, ensureWarmed as warmSentinelScores } from '@/lib/sentinel/scoringEngine';
import { SENTINEL_FLAGS } from '@/lib/sentinel/config';
import { getWqxModernCacheStatus, ensureWarmed as warmWqxModern } from '@/lib/wqxModernCache';
import { getStnFloodCacheStatus, ensureWarmed as warmStnFlood } from '@/lib/stnFloodCache';
import { getDmrViolationsCacheStatus, ensureWarmed as warmDmrViolations } from '@/lib/echoDmrViolationsCache';
import { getHabForecastCacheStatus, ensureWarmed as warmHabForecast } from '@/lib/habForecastCache';
import { getStreamStatsCacheStatus, ensureWarmed as warmStreamStats } from '@/lib/streamStatsCache';
import { getEReportingCacheStatus, ensureWarmed as warmEReporting } from '@/lib/eReportingCache';
import { getCdcPlacesCacheStatus, ensureWarmed as warmCdcPlaces } from '@/lib/cdcPlacesCache';
import { getCoastwatchCacheStatus, ensureWarmed as warmCoastwatch } from '@/lib/coastwatchCache';
import { getIcisAirCacheStatus, ensureWarmed as warmIcisAir } from '@/lib/icisAirCache';
import { getSsurgoCacheStatus, ensureWarmed as warmSsurgo } from '@/lib/ssurgoCache';
import { getNadpPfasCacheStatus, ensureWarmed as warmNadpPfas } from '@/lib/nadpPfasCache';
import { getMs4PermitCacheStatus, ensureWarmed as warmMs4Permit } from '@/lib/ms4PermitCache';
import { getNlcdCacheStatus, ensureWarmed as warmNlcd } from '@/lib/nlcdCache';
import { getEchoBiosolidsCacheStatus, ensureWarmed as warmEchoBiosolids } from '@/lib/echoBiosolidsCache';
import { getCoopsPredictionsCacheStatus, ensureWarmed as warmCoopsPredictions } from '@/lib/coopsPredictionsCache';
import { getVolcanoCacheStatus, ensureWarmed as warmVolcano } from '@/lib/volcanoCache';
import { getOshaWaterCacheStatus, ensureWarmed as warmOshaWater } from '@/lib/oshaWaterCache';
import { getSwdiCacheStatus, ensureWarmed as warmSwdi } from '@/lib/swdiCache';
import { getNassLivestockCacheStatus, ensureWarmed as warmNassLivestock } from '@/lib/nassLivestockCache';
import { getNassCropsCacheStatus, ensureWarmed as warmNassCrops } from '@/lib/nassCropsCache';
import { getCongressCacheStatus, ensureWarmed as warmCongress } from '@/lib/congressCache';
import { getPhmsaPipelineCacheStatus, ensureWarmed as warmPhmsaPipeline } from '@/lib/phmsaPipelineCache';
import { getNexradQpeCacheStatus, ensureWarmed as warmNexradQpe } from '@/lib/nexradQpeCache';
import { getEpaOppPesticideCacheStatus, ensureWarmed as warmEpaOppPesticide } from '@/lib/epaOppPesticideCache';
import { getHypoxiaCacheStatus, ensureWarmed as warmHypoxia } from '@/lib/hypoxiaCache';
import { getForceProtectionCacheStatus, ensureWarmed as warmForceProtection } from '@/lib/forceProtectionCache';

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

  // EMERGENCY FIX: Disable cache warming to prevent memory exhaustion
  // TODO: Implement smarter status checking without loading full cache data
  console.log('[Cache Status] Warming disabled to prevent memory issues');

  const wqp = getWqpCacheStatus();
  const attains = getAttainsCacheStatus();
  const ceden = getCedenCacheStatus();
  const icis = getIcisCacheStatus();
  const sdwis = getSdwisCacheStatus();
  const nwisGw = getNwisGwCacheStatus();
  const echo = getEchoCacheStatus();
  const frs = getFrsCacheStatus();
  const pfas = getPfasCacheStatus();
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
  const grantsGov = getGrantCacheDelta();
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
  const edna = await geteDNACacheStatus();
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
  const environmentalTracking = getEnvironmentalTrackingCacheStatus();
  const healthDataGov = getHealthDataGovCacheStatus();
  const openFDA = getOpenFDACacheStatus();
  const hrsaHpsa = getHpsaCacheStatus();
  const ejscreen = getEJScreenCacheStatus();
  const campd = getCampdCacheStatus();
  const climateNormals = getClimateNormalsCacheStatus();
  const myHealthfinder = getMyHealthfinderCacheStatus();
  const atsdrToxicology = getATSDRToxicologyCacheStatus();
  const usgsWqp = getUSGSWQPCacheStatus();
  const dataCdcGov = getDataCDCGovCacheStatus();
  const dodPfas = getDoDPFASCacheStatus();
  const usgsOgc = getUsgsOgcCacheStatus();
  const ngwmn = getNgwmnCacheStatus();
  const floodImpact = getFloodImpactCacheStatus();
  const epaPfas = getEpaPfasAnalyticsCacheStatus();
  const dodPfasSites = getDodPfasSitesCacheStatus();
  const nwsForecast = getNwsForecastCacheStatus();
  const waterAvail = getWaterAvailCacheStatus();
  const cyberRisk = getCyberRiskCacheStatus();
  const gemstat = getGemsStatCacheStatus();
  const copernicusCds = getCopernicusCdsCacheStatus();
  const wqxModern = getWqxModernCacheStatus();
  const stnFlood = getStnFloodCacheStatus();
  const dmrViolations = getDmrViolationsCacheStatus();
  const habForecast = getHabForecastCacheStatus();
  const streamStats = getStreamStatsCacheStatus();
  const eReporting = getEReportingCacheStatus();
  const cdcPlaces = getCdcPlacesCacheStatus();
  const coastwatch = getCoastwatchCacheStatus();
  const icisAir = getIcisAirCacheStatus();
  const ssurgo = getSsurgoCacheStatus();
  const nadpPfas = getNadpPfasCacheStatus();
  const ms4Permit = getMs4PermitCacheStatus();
  const nlcd = getNlcdCacheStatus();
  const echoBiosolids = getEchoBiosolidsCacheStatus();
  const coopsPredictions = getCoopsPredictionsCacheStatus();
  const volcano = getVolcanoCacheStatus();
  const oshaWater = getOshaWaterCacheStatus();
  const swdi = getSwdiCacheStatus();
  const nassLivestock = getNassLivestockCacheStatus();
  const nassCrops = getNassCropsCacheStatus();
  const congress = getCongressCacheStatus();
  const phmsaPipeline = getPhmsaPipelineCacheStatus();
  const nexradQpe = getNexradQpeCacheStatus();
  const epaOppPesticide = getEpaOppPesticideCacheStatus();
  const hypoxia = getHypoxiaCacheStatus();
  const forceProtection = getForceProtectionCacheStatus();

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
    edna: {
      ...edna,
      ...staleness(edna.loaded ? (edna as any).built : null),
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
    environmentalTracking: {
      ...environmentalTracking,
      ...staleness(environmentalTracking.loaded ? (environmentalTracking as any).built : null),
    },
    healthDataGov: {
      ...healthDataGov,
      ...staleness(healthDataGov.loaded ? (healthDataGov as any).built : null),
    },
    openFDA: {
      ...openFDA,
      ...staleness(openFDA.loaded ? (openFDA as any).built : null),
    },
    hrsaHpsa: {
      ...hrsaHpsa,
      ...staleness(hrsaHpsa.loaded ? (hrsaHpsa as any).built : null),
    },
    ejscreen: {
      ...ejscreen,
      ...staleness(ejscreen.loaded ? (ejscreen as any).built : null),
    },
    campd: {
      ...campd,
      ...staleness(campd.loaded ? (campd as any).built : null),
    },
    climateNormals: {
      ...climateNormals,
      ...staleness(climateNormals.loaded ? (climateNormals as any).built : null),
    },
    myHealthfinder: {
      ...myHealthfinder,
      ...staleness(myHealthfinder.loaded ? (myHealthfinder as any).built : null),
    },
    atsdrToxicology: {
      ...atsdrToxicology,
      ...staleness(atsdrToxicology.loaded ? (atsdrToxicology as any).built : null),
    },
    usgsWqp: {
      ...usgsWqp,
      ...staleness(usgsWqp.loaded ? (usgsWqp as any).built : null),
    },
    dataCdcGov: {
      ...dataCdcGov,
      ...staleness(dataCdcGov.loaded ? (dataCdcGov as any).built : null),
    },
    dodPfas: {
      ...dodPfas,
      ...staleness(dodPfas.loaded ? (dodPfas as any).built : null),
    },
    usgsOgc: {
      ...usgsOgc,
      ...staleness(usgsOgc.loaded ? (usgsOgc as any).built : null),
    },
    ngwmn: {
      ...ngwmn,
      ...staleness(ngwmn.loaded ? (ngwmn as any).built : null),
    },
    floodImpact: {
      ...floodImpact,
      ...staleness(floodImpact.loaded ? (floodImpact as any).built : null),
    },
    epaPfas: {
      ...epaPfas,
      ...staleness(epaPfas.loaded ? (epaPfas as any).built : null),
    },
    dodPfasSites: {
      ...dodPfasSites,
      ...staleness(dodPfasSites.loaded ? (dodPfasSites as any).built : null),
    },
    nwsForecast: {
      ...nwsForecast,
      ...staleness(nwsForecast.loaded ? (nwsForecast as any).built : null),
    },
    waterAvail: {
      ...waterAvail,
      ...staleness(waterAvail.loaded ? (waterAvail as any).built : null),
    },
    cyberRisk: {
      ...cyberRisk,
      ...staleness(cyberRisk.loaded ? (cyberRisk as any).built : null),
    },
    gemstat: {
      ...gemstat,
      ...staleness(gemstat.loaded ? (gemstat as any).built : null),
    },
    copernicusCds: {
      ...copernicusCds,
      ...staleness(copernicusCds.loaded ? (copernicusCds as any).built : null),
    },
    wqxModern: {
      ...wqxModern,
      ...staleness(wqxModern.loaded ? (wqxModern as any).built : null),
    },
    stnFlood: {
      ...stnFlood,
      ...staleness(stnFlood.loaded ? (stnFlood as any).built : null),
    },
    dmrViolations: {
      ...dmrViolations,
      ...staleness(dmrViolations.loaded ? (dmrViolations as any).built : null),
    },
    habForecast: {
      ...habForecast,
      ...staleness(habForecast.loaded ? (habForecast as any).built : null),
    },
    streamStats: {
      ...streamStats,
      ...staleness(streamStats.loaded ? (streamStats as any).built : null),
    },
    eReporting: {
      ...eReporting,
      ...staleness(eReporting.loaded ? (eReporting as any).built : null),
    },
    cdcPlaces: {
      ...cdcPlaces,
      ...staleness(cdcPlaces.loaded ? (cdcPlaces as any).built : null),
    },
    coastwatch: {
      ...coastwatch,
      ...staleness(coastwatch.loaded ? (coastwatch as any).built : null),
    },
    icisAir: {
      ...icisAir,
      ...staleness(icisAir.loaded ? (icisAir as any).built : null),
    },
    ssurgo: {
      ...ssurgo,
      ...staleness(ssurgo.loaded ? (ssurgo as any).built : null),
    },
    nadpPfas: {
      ...nadpPfas,
      ...staleness(nadpPfas.loaded ? (nadpPfas as any).built : null),
    },
    ms4Permit: {
      ...ms4Permit,
      ...staleness(ms4Permit.loaded ? (ms4Permit as any).built : null),
    },
    nlcd: {
      ...nlcd,
      ...staleness(nlcd.loaded ? (nlcd as any).built : null),
    },
    echoBiosolids: {
      ...echoBiosolids,
      ...staleness(echoBiosolids.loaded ? (echoBiosolids as any).built : null),
    },
    coopsPredictions: {
      ...coopsPredictions,
      ...staleness(coopsPredictions.loaded ? (coopsPredictions as any).built : null),
    },
    volcano: {
      ...volcano,
      ...staleness(volcano.loaded ? (volcano as any).built : null),
    },
    oshaWater: {
      ...oshaWater,
      ...staleness(oshaWater.loaded ? (oshaWater as any).built : null),
    },
    swdi: {
      ...swdi,
      ...staleness(swdi.loaded ? (swdi as any).built : null),
    },
    nassLivestock: {
      ...nassLivestock,
      ...staleness(nassLivestock.loaded ? (nassLivestock as any).built : null),
    },
    nassCrops: {
      ...nassCrops,
      ...staleness(nassCrops.loaded ? (nassCrops as any).built : null),
    },
    congress: {
      ...congress,
      ...staleness(congress.loaded ? (congress as any).built : null),
    },
    phmsaPipeline: {
      ...phmsaPipeline,
      ...staleness(phmsaPipeline.loaded ? (phmsaPipeline as any).built : null),
    },
    nexradQpe: {
      ...nexradQpe,
      ...staleness(nexradQpe.loaded ? (nexradQpe as any).built : null),
    },
    epaOppPesticide: {
      ...epaOppPesticide,
      ...staleness(epaOppPesticide.loaded ? (epaOppPesticide as any).built : null),
    },
    hypoxia: {
      ...hypoxia,
      ...staleness(hypoxia.loaded ? (hypoxia as any).built : null),
    },
    forceProtection: {
      ...forceProtection,
      ...staleness(forceProtection.loaded ? (forceProtection as any).built : null),
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
