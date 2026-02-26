/**
 * Cache-Derived Signal Generators
 *
 * Reads from 10 in-memory caches (already populated by daily crons) and produces
 * Signal[] objects for the AI insights pipeline. Zero new API calls — all data
 * is synchronous reads from warmed caches.
 */

import type { Signal } from './signals';
import { getNwpsAllGauges } from './nwpsCache';
import { getCoopsAllStations } from './coopsCache';
import { getNdbcAllStations } from './ndbcCache';
import { getSnotelAllStations } from './snotelCache';
import { getCdcNwssAllStates } from './cdcNwssCache';
import { getEchoAllData } from './echoCache';
import { getPfasAllResults } from './pfasCache';
import { getTriAllFacilities } from './triCache';
import { getUsaceAllLocations } from './usaceCache';
import { getBwbAllStations } from './bwbCache';

const MAX_PER_SOURCE = 25;
const now = () => new Date().toISOString();

function mkId(src: string, key: string): string {
  return `${src}-${key.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}-${Date.now().toString(36).slice(-4)}`;
}

// ── 1. NWPS Flood Gauges ────────────────────────────────────────────────────

function generateNwpsSignals(): Signal[] {
  const gauges = getNwpsAllGauges();
  return gauges
    .filter(g => g.status === 'minor' || g.status === 'moderate' || g.status === 'major')
    .slice(0, MAX_PER_SOURCE)
    .map(g => ({
      id: mkId('nwps', g.lid),
      source: 'nwps' as const,
      sourceLabel: 'NOAA NWPS',
      category: 'flood' as const,
      title: `${g.status.charAt(0).toUpperCase() + g.status.slice(1)} flooding: ${g.name}`,
      summary: `${g.status} flood stage at ${g.name}, ${g.state}${g.observed?.primary != null ? ` (${g.observed.primary} ${g.observed.unit})` : ''}.`,
      publishedAt: g.observed?.time || now(),
      url: `https://water.weather.gov/ahps2/hydrograph.php?gage=${g.lid.toLowerCase()}`,
      state: g.state,
      waterbody: g.name,
      pearlRelevant: true,
      tags: ['flood', g.status, 'nwps'],
      confidence: 0.95,
    }));
}

// ── 2. CO-OPS Tidal/Coastal ─────────────────────────────────────────────────

function generateCoopsSignals(): Signal[] {
  const stations = getCoopsAllStations();
  return stations
    .filter(s =>
      (s.waterTemp != null && s.waterTemp > 32) ||
      (s.waterLevel != null && Math.abs(s.waterLevel) > 2)
    )
    .slice(0, MAX_PER_SOURCE)
    .map(s => {
      const highTemp = s.waterTemp != null && s.waterTemp > 32;
      return {
        id: mkId('coops', s.id),
        source: 'coops' as const,
        sourceLabel: 'NOAA CO-OPS',
        category: 'advisory' as const,
        title: highTemp
          ? `Elevated water temperature: ${s.name}`
          : `Abnormal water level: ${s.name}`,
        summary: highTemp
          ? `Water temperature ${s.waterTemp}°C at ${s.name}, ${s.state}.`
          : `Water level ${s.waterLevel}m at ${s.name}, ${s.state}.`,
        publishedAt: s.waterLevelTime || now(),
        url: `https://tidesandcurrents.noaa.gov/stationhome.html?id=${s.id}`,
        state: s.state,
        pearlRelevant: true,
        tags: ['coastal', highTemp ? 'temperature' : 'water-level'],
        confidence: 0.85,
      };
    });
}

// ── 3. NDBC Buoys ───────────────────────────────────────────────────────────

function generateNdbcSignals(): Signal[] {
  const stations = getNdbcAllStations();
  const signals: Signal[] = [];

  for (const s of stations) {
    if (signals.length >= MAX_PER_SOURCE) break;
    const o = s.ocean;
    const obs = s.observation;

    if (o?.dissolvedO2Ppm != null && o.dissolvedO2Ppm < 4) {
      signals.push({
        id: mkId('ndbc', `${s.id}-do`),
        source: 'ndbc', sourceLabel: 'NOAA NDBC',
        category: 'hab', title: `Low dissolved oxygen: ${s.name || s.id}`,
        summary: `DO at ${o.dissolvedO2Ppm} ppm (buoy ${s.id}).`,
        publishedAt: s.observedAt || now(), url: `https://www.ndbc.noaa.gov/station_page.php?station=${s.id}`,
        pearlRelevant: true, tags: ['hypoxia', 'buoy'], confidence: 0.85,
      });
    }
    if (o?.ph != null && (o.ph < 6.5 || o.ph > 9.0)) {
      signals.push({
        id: mkId('ndbc', `${s.id}-ph`),
        source: 'ndbc', sourceLabel: 'NOAA NDBC',
        category: 'advisory', title: `pH anomaly: ${s.name || s.id}`,
        summary: `pH ${o.ph} at buoy ${s.id}.`,
        publishedAt: s.observedAt || now(), url: `https://www.ndbc.noaa.gov/station_page.php?station=${s.id}`,
        pearlRelevant: true, tags: ['ph', 'buoy'], confidence: 0.8,
      });
    }
    if (o?.chlorophyll != null && o.chlorophyll > 20) {
      signals.push({
        id: mkId('ndbc', `${s.id}-chla`),
        source: 'ndbc', sourceLabel: 'NOAA NDBC',
        category: 'hab', title: `High chlorophyll-a: ${s.name || s.id}`,
        summary: `Chl-a ${o.chlorophyll} µg/L at buoy ${s.id}.`,
        publishedAt: s.observedAt || now(), url: `https://www.ndbc.noaa.gov/station_page.php?station=${s.id}`,
        pearlRelevant: true, tags: ['chlorophyll', 'hab', 'buoy'], confidence: 0.85,
      });
    }
    if (o?.turbidity != null && o.turbidity > 50) {
      signals.push({
        id: mkId('ndbc', `${s.id}-turb`),
        source: 'ndbc', sourceLabel: 'NOAA NDBC',
        category: 'advisory', title: `High turbidity: ${s.name || s.id}`,
        summary: `Turbidity ${o.turbidity} FTU at buoy ${s.id}.`,
        publishedAt: s.observedAt || now(), url: `https://www.ndbc.noaa.gov/station_page.php?station=${s.id}`,
        pearlRelevant: true, tags: ['turbidity', 'buoy'], confidence: 0.8,
      });
    }
    if (obs?.waveHeight != null && obs.waveHeight > 4) {
      signals.push({
        id: mkId('ndbc', `${s.id}-wave`),
        source: 'ndbc', sourceLabel: 'NOAA NDBC',
        category: 'advisory', title: `High waves: ${s.name || s.id}`,
        summary: `Wave height ${obs.waveHeight}m at buoy ${s.id}.`,
        publishedAt: s.observedAt || now(), url: `https://www.ndbc.noaa.gov/station_page.php?station=${s.id}`,
        pearlRelevant: true, tags: ['waves', 'buoy'], confidence: 0.8,
      });
    }
  }
  return signals;
}

// ── 4. SNOTEL Snowpack ──────────────────────────────────────────────────────

function generateSnotelSignals(): Signal[] {
  const stations = getSnotelAllStations();
  const signals: Signal[] = [];
  const month = new Date().getMonth(); // 0-indexed

  for (const s of stations) {
    if (signals.length >= MAX_PER_SOURCE) break;

    if (s.snowWaterEquiv != null && s.snowWaterEquiv > 40) {
      signals.push({
        id: mkId('snotel', `${s.id}-flood`),
        source: 'snotel', sourceLabel: 'NRCS SNOTEL',
        category: 'flood', title: `High snowpack: ${s.name}`,
        summary: `SWE ${s.snowWaterEquiv} in at ${s.name}, ${s.state} (elev ${s.elevation} ft). Flood risk if rapid melt.`,
        publishedAt: s.observedDate || now(), url: `https://wcc.sc.egov.usda.gov/nwcc/site?sitenum=${s.id}`,
        state: s.state, pearlRelevant: true, tags: ['snowpack', 'flood-risk'], confidence: 0.8,
      });
    }
    // SWE=0 during winter at high elevation → drought indicator
    if (s.snowWaterEquiv === 0 && s.elevation > 6000 && month >= 10 || (s.snowWaterEquiv === 0 && s.elevation > 6000 && month <= 3)) {
      signals.push({
        id: mkId('snotel', `${s.id}-drought`),
        source: 'snotel', sourceLabel: 'NRCS SNOTEL',
        category: 'advisory', title: `No snowpack: ${s.name}`,
        summary: `Zero SWE at ${s.name} (${s.elevation} ft), ${s.state} during winter. Drought concern.`,
        publishedAt: s.observedDate || now(), url: `https://wcc.sc.egov.usda.gov/nwcc/site?sitenum=${s.id}`,
        state: s.state, pearlRelevant: true, tags: ['drought', 'snowpack'], confidence: 0.7,
      });
    }
    if (s.precip != null && s.precip > 3) {
      signals.push({
        id: mkId('snotel', `${s.id}-precip`),
        source: 'snotel', sourceLabel: 'NRCS SNOTEL',
        category: 'advisory', title: `Heavy precipitation: ${s.name}`,
        summary: `${s.precip} in precipitation at ${s.name}, ${s.state}.`,
        publishedAt: s.observedDate || now(), url: `https://wcc.sc.egov.usda.gov/nwcc/site?sitenum=${s.id}`,
        state: s.state, pearlRelevant: true, tags: ['precipitation', 'heavy-rain'], confidence: 0.75,
      });
    }
  }
  return signals;
}

// ── 5. CDC NWSS Wastewater ──────────────────────────────────────────────────

function generateCdcNwssSignals(): Signal[] {
  const stateData = getCdcNwssAllStates();
  if (!stateData) return [];

  const signals: Signal[] = [];
  for (const [state, data] of Object.entries(stateData)) {
    if (signals.length >= MAX_PER_SOURCE) break;
    let stateCount = 0;
    for (const r of data.records) {
      if (stateCount >= 3) break;
      if ((r.percentile != null && r.percentile >= 90) ||
          (r.detectProp15d != null && r.detectProp15d >= 0.8)) {
        signals.push({
          id: mkId('cdc-nwss', `${r.wwtpId}-${r.dateEnd}`),
          source: 'cdc-nwss', sourceLabel: 'CDC NWSS',
          category: 'bacteria',
          title: `Elevated wastewater pathogen: ${r.countyNames}, ${state}`,
          summary: `${r.percentile != null && r.percentile >= 90 ? `${r.percentile}th percentile` : `Detection rate ${((r.detectProp15d || 0) * 100).toFixed(0)}%`} at WWTP serving ${r.populationServed.toLocaleString()} people.`,
          publishedAt: r.dateEnd || now(),
          url: 'https://www.cdc.gov/nwss/wastewater-surveillance.html',
          state, pearlRelevant: true, tags: ['wastewater', 'pathogen', 'surveillance'], confidence: 0.85,
        });
        stateCount++;
      }
    }
  }
  return signals;
}

// ── 6. ECHO Compliance ──────────────────────────────────────────────────────

function generateEchoSignals(): Signal[] {
  const data = getEchoAllData();
  return data.facilities
    .filter(f => f.qtrsInViolation >= 4)
    .slice(0, MAX_PER_SOURCE)
    .map(f => ({
      id: mkId('echo', f.registryId),
      source: 'echo' as const,
      sourceLabel: 'EPA ECHO',
      category: 'enforcement' as const,
      title: `Chronic violator: ${f.name}`,
      summary: `${f.name} (${f.state}) in violation for ${f.qtrsInViolation} quarters. Status: ${f.complianceStatus}.`,
      publishedAt: now(),
      url: `https://echo.epa.gov/detailed-facility-report?fid=${f.registryId}`,
      state: f.state, pearlRelevant: true,
      tags: ['compliance', 'violation', 'chronic'], confidence: 0.9,
    }));
}

// ── 7. PFAS Detections ──────────────────────────────────────────────────────

function generatePfasSignals(): Signal[] {
  const results = getPfasAllResults();
  return results
    .filter(r => r.detected && r.resultValue != null && r.resultValue > 0)
    .slice(0, MAX_PER_SOURCE)
    .map(r => ({
      id: mkId('pfas', `${r.facilityName}-${r.contaminant}`),
      source: 'pfas' as const,
      sourceLabel: 'EPA UCMR/PFAS',
      category: 'contamination' as const,
      title: `PFAS detected: ${r.facilityName}`,
      summary: `${r.contaminant} at ${r.resultValue} ppt in ${r.facilityName}, ${r.state}.`,
      publishedAt: r.sampleDate || now(),
      url: 'https://www.epa.gov/dwucmr',
      state: r.state, pearlRelevant: true,
      tags: ['pfas', 'contamination', 'drinking-water'], confidence: 0.9,
    }));
}

// ── 8. TRI Toxic Releases ───────────────────────────────────────────────────

function generateTriSignals(): Signal[] {
  const facilities = getTriAllFacilities();
  return facilities
    .filter(f => f.totalReleases > 100_000 || f.carcinogenReleases > 0)
    .slice(0, MAX_PER_SOURCE)
    .map(f => ({
      id: mkId('tri', f.triId),
      source: 'tri' as const,
      sourceLabel: 'EPA TRI',
      category: 'contamination' as const,
      title: f.carcinogenReleases > 0
        ? `Carcinogen releases: ${f.facilityName}`
        : `Major toxic releases: ${f.facilityName}`,
      summary: `${f.facilityName} (${f.city}, ${f.state}): ${f.totalReleases.toLocaleString()} lbs total${f.carcinogenReleases > 0 ? `, ${f.carcinogenReleases.toLocaleString()} lbs carcinogens` : ''}. Top: ${f.topChemicals.slice(0, 3).join(', ')}.`,
      publishedAt: now(),
      url: `https://enviro.epa.gov/triexplorer/release_fac_profile?TRI=${f.triId}`,
      state: f.state, pearlRelevant: true,
      tags: ['toxic-release', 'contamination', ...(f.carcinogenReleases > 0 ? ['carcinogen'] : [])], confidence: 0.9,
    }));
}

// ── 9. USACE Reservoir Temps ────────────────────────────────────────────────

function generateUsaceSignals(): Signal[] {
  const locations = getUsaceAllLocations();
  return locations
    .filter(l => l.waterTemp != null && l.waterTemp > 30)
    .slice(0, MAX_PER_SOURCE)
    .map(l => ({
      id: mkId('usace', l.name),
      source: 'usace' as const,
      sourceLabel: 'USACE',
      category: 'advisory' as const,
      title: `High reservoir temperature: ${l.name}`,
      summary: `Water temp ${l.waterTemp}°C at ${l.name} (${l.office}), ${l.state}.`,
      publishedAt: l.waterTempTime || now(),
      url: 'https://water.usace.army.mil/',
      state: l.state, pearlRelevant: true,
      tags: ['reservoir', 'temperature'], confidence: 0.8,
    }));
}

// ── 10. BWB Water Quality ───────────────────────────────────────────────────

function generateBwbSignals(): Signal[] {
  const stations = getBwbAllStations();
  const signals: Signal[] = [];

  for (const s of stations) {
    if (signals.length >= MAX_PER_SOURCE) break;
    for (const p of s.parameters) {
      if (signals.length >= MAX_PER_SOURCE) break;
      if (p.latestValue == null) continue;

      const n = p.normalizedName.toLowerCase();
      let triggered = false;
      let category: Signal['category'] = 'advisory';
      let detail = '';

      if (n.includes('e. coli') || n.includes('ecoli')) {
        if (p.latestValue > 410) { triggered = true; category = 'bacteria'; detail = `E. coli ${p.latestValue} ${p.unit}`; }
      } else if (n.includes('enterococcus') || n.includes('entero')) {
        if (p.latestValue > 104) { triggered = true; category = 'bacteria'; detail = `Enterococcus ${p.latestValue} ${p.unit}`; }
      } else if (n.includes('dissolved oxygen') || n === 'do') {
        if (p.latestValue < 5) { triggered = true; detail = `DO ${p.latestValue} ${p.unit}`; }
      } else if (n.includes('turbidity')) {
        if (p.latestValue > 50) { triggered = true; detail = `Turbidity ${p.latestValue} ${p.unit}`; }
      }

      if (triggered) {
        signals.push({
          id: mkId('bwb', `${s.stationId}-${p.normalizedName}`),
          source: 'bwb', sourceLabel: 'Water Reporter',
          category,
          title: `${category === 'bacteria' ? 'Bacteria exceedance' : 'Water quality alert'}: ${s.name}`,
          summary: `${detail} at ${s.name}.`,
          publishedAt: p.latestDate || now(),
          url: 'https://www.waterreporter.org/',
          pearlRelevant: true, tags: ['community-monitoring', category], confidence: 0.75,
        });
      }
    }
  }
  return signals;
}

// ── Entry Point ─────────────────────────────────────────────────────────────

const CATEGORY_PRIORITY: Record<string, number> = {
  flood: 0, contamination: 1, bacteria: 2, enforcement: 3,
  hab: 4, advisory: 5, spill: 0, safety: 5, regulatory: 6, general: 7,
};

export function generateCacheSignals(): Signal[] {
  const all = [
    ...generateNwpsSignals(),
    ...generateCoopsSignals(),
    ...generateNdbcSignals(),
    ...generateSnotelSignals(),
    ...generateCdcNwssSignals(),
    ...generateEchoSignals(),
    ...generatePfasSignals(),
    ...generateTriSignals(),
    ...generateUsaceSignals(),
    ...generateBwbSignals(),
  ];

  all.sort((a, b) => {
    const aPri = CATEGORY_PRIORITY[a.category] ?? 99;
    const bPri = CATEGORY_PRIORITY[b.category] ?? 99;
    return aPri - bPri;
  });

  return all;
}
