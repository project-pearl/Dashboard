/**
 * Human-readable delta utilities for cache change descriptions.
 * Used by BriefingChangesCard, DeltaChangelog, and PipelineHealthIndicator.
 */

import type { CacheDelta } from './cacheUtils';

// ── Cache Metadata ──────────────────────────────────────────────────────────

export const CACHE_META: Record<string, { friendlyName: string; agency: string; cadence: string }> = {
  wqp:            { friendlyName: 'Water Quality Portal',       agency: 'EPA / USGS',   cadence: 'Daily' },
  attains:        { friendlyName: 'EPA ATTAINS',                agency: 'EPA',           cadence: 'Daily' },
  ceden:          { friendlyName: 'CEDEN Water Quality',        agency: 'CA SWRCB',      cadence: 'Daily' },
  icis:           { friendlyName: 'ICIS-NPDES Enforcement',     agency: 'EPA',           cadence: 'Daily' },
  sdwis:          { friendlyName: 'SDWIS Drinking Water',       agency: 'EPA',           cadence: 'Daily' },
  nwisGw:         { friendlyName: 'USGS WDFN Groundwater',     agency: 'USGS',          cadence: 'Daily' },
  echo:           { friendlyName: 'EPA ECHO',                   agency: 'EPA',           cadence: 'Weekly' },
  frs:            { friendlyName: 'EPA FRS Facilities',         agency: 'EPA',           cadence: 'Weekly' },
  pfas:           { friendlyName: 'PFAS Contamination',         agency: 'EPA',           cadence: 'Daily' },
  insights:       { friendlyName: 'AI Insights',                agency: 'PIN',           cadence: 'Daily' },
  stateReports:   { friendlyName: 'State Reports',              agency: 'Multi-agency',  cadence: 'Daily' },
  bwb:            { friendlyName: 'Beach Water Quality',        agency: 'EPA',           cadence: 'Daily' },
  cdcNwss:        { friendlyName: 'CDC NWSS Wastewater',        agency: 'CDC',           cadence: 'Daily' },
  ndbc:           { friendlyName: 'NOAA NDBC Buoys',            agency: 'NOAA',          cadence: 'Daily' },
  nasaCmr:        { friendlyName: 'NASA CMR Satellite',         agency: 'NASA',          cadence: 'Daily' },
  nars:           { friendlyName: 'EPA NARS',                   agency: 'EPA',           cadence: 'Weekly' },
  dataGov:        { friendlyName: 'Data.gov Datasets',          agency: 'GSA',           cadence: 'Weekly' },
  usace:          { friendlyName: 'USACE Infrastructure',       agency: 'USACE',         cadence: 'Weekly' },
  stateIR:        { friendlyName: 'State Integrated Reports',   agency: 'States',        cadence: 'Annual' },
  nwisIv:         { friendlyName: 'USGS Instantaneous Values',  agency: 'USGS',          cadence: 'Hourly' },
  usgsAlerts:     { friendlyName: 'USGS Water Alerts',          agency: 'USGS',          cadence: 'Hourly' },
  nwsAlerts:      { friendlyName: 'NWS Weather Alerts',         agency: 'NOAA',          cadence: 'Hourly' },
  nwps:           { friendlyName: 'NWS River Forecasts',        agency: 'NOAA',          cadence: 'Daily' },
  coops:          { friendlyName: 'NOAA CO-OPS Tides',          agency: 'NOAA',          cadence: 'Daily' },
  snotel:         { friendlyName: 'NRCS SNOTEL',                agency: 'USDA',          cadence: 'Daily' },
  tri:            { friendlyName: 'TRI Toxic Releases',         agency: 'EPA',           cadence: 'Weekly' },
  usaSpending:    { friendlyName: 'USAspending Awards',         agency: 'Treasury',      cadence: 'Weekly' },
  grantsGov:      { friendlyName: 'Grants.gov Opportunities',   agency: 'HHS',           cadence: 'Daily' },
  sam:            { friendlyName: 'SAM.gov Contracts',           agency: 'GSA',           cadence: 'Weekly' },
  fema:           { friendlyName: 'FEMA Disasters',             agency: 'FEMA',          cadence: 'Daily' },
  superfund:      { friendlyName: 'Superfund Sites',            agency: 'EPA',           cadence: 'Weekly' },
};

// ── Section → Cache Mapping ─────────────────────────────────────────────────

export const SECTION_TO_CACHES: Record<string, string[]> = {
  icis:                  ['icis'],
  sdwis:                 ['sdwis'],
  impairmentprofile:     ['attains', 'wqp'],
  groundwater:           ['nwisGw'],
  'contaminants-tracker': ['pfas', 'tri', 'cdcNwss'],
  'habitat-ecology':     ['attains', 'nars'],
  'data-latency':        ['wqp', 'attains', 'icis', 'sdwis', 'nwisGw', 'echo', 'coops'],
  'sentinel-briefing':   ['nwisIv', 'usgsAlerts', 'nwsAlerts'],
  'briefing-changes':    ['wqp', 'attains', 'icis', 'sdwis', 'nwisGw', 'echo', 'pfas'],
  'funding-landscape':   ['usaSpending', 'grantsGov', 'sam'],
  'disaster-emergency':  ['fema', 'nwsAlerts', 'usgsAlerts'],
};

// ── Describe Delta ──────────────────────────────────────────────────────────

/**
 * Convert a CacheDelta into a human-readable sentence.
 * e.g. "ATTAINS: +142 waterbodies (3,456 → 3,598), 2 new states (CA, TX)"
 */
export function describeDelta(cacheName: string, delta: CacheDelta): string {
  const meta = CACHE_META[cacheName];
  const label = meta?.friendlyName ?? cacheName;

  if (!delta.dataChanged) return `${label}: No changes`;

  const parts: string[] = [];

  for (const [key, { before, after, diff }] of Object.entries(delta.counts)) {
    if (diff === 0) continue;
    const sign = diff > 0 ? '+' : '';
    parts.push(`${sign}${diff.toLocaleString()} ${key} (${before.toLocaleString()} → ${after.toLocaleString()})`);
  }

  if (delta.states) {
    if (delta.states.added.length > 0) {
      parts.push(`${delta.states.added.length} new state${delta.states.added.length > 1 ? 's' : ''} (${delta.states.added.join(', ')})`);
    }
    if (delta.states.removed.length > 0) {
      parts.push(`${delta.states.removed.length} removed state${delta.states.removed.length > 1 ? 's' : ''} (${delta.states.removed.join(', ')})`);
    }
  }

  return parts.length > 0 ? `${label}: ${parts.join(', ')}` : `${label}: Data changed`;
}

// ── Significance Detection ──────────────────────────────────────────────────

/**
 * Returns true if any count entry has >10% change relative to the before value.
 */
export function isSignificantSwing(delta: CacheDelta): boolean {
  for (const { before, diff } of Object.values(delta.counts)) {
    if (before === 0 && diff !== 0) return true;
    if (before > 0 && Math.abs(diff) / before > 0.1) return true;
  }
  return false;
}
