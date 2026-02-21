// lib/useWaterData.ts
// Unified React hook — fetches real water quality data from multiple sources
// Priority: USGS IV → BWB → ERDDAP → MMW → NOAA → USGS Samples → USGS DV → WQP → STATE → EPA_EF → Reference → Mock
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// ─── Station Registry (lazy-loaded at runtime to avoid 5.9MB bundle) ────────
// Contains 12,000+ confirmed monitoring stations across all 51 states
// Loaded from /data/station-registry.json on first access

interface RegistryData {
  regions: Record<string, { lat: number; lng: number; huc8: string; stateCode: string; name: string }>;
  usgsSiteMap: Record<string, string>;
  wqpStationMap: Record<string, { siteId: string; provider: string; name: string }>;
  coverage: Record<string, { hasData: boolean; sources: string[] }>;
}

let _registryCache: RegistryData | null = null;
let _registryPromise: Promise<RegistryData> | null = null;

function loadRegistry(): Promise<RegistryData> {
  if (_registryCache) return Promise.resolve(_registryCache);
  if (!_registryPromise) {
    _registryPromise = fetch('/data/station-registry.json')
      .then(r => r.json())
      .then((data: RegistryData) => { _registryCache = data; return data; })
      .catch(() => {
        _registryPromise = null;
        return { regions: {}, usgsSiteMap: {}, wqpStationMap: {}, coverage: {} } as RegistryData;
      });
  }
  return _registryPromise;
}

// Synchronous accessors — return empty until registry loads, then populated
function getRegistryRegions(): Record<string, { lat: number; lng: number; huc8: string; stateCode: string; name: string }> {
  return _registryCache?.regions ?? {};
}
function getRegistryUSGS(): Record<string, string> {
  return _registryCache?.usgsSiteMap ?? {};
}
function getRegistryWQP(): Record<string, { siteId: string; provider: string; name: string }> {
  return _registryCache?.wqpStationMap ?? {};
}
function getRegistryCoverage(): Record<string, { hasData: boolean; sources: string[] }> {
  return _registryCache?.coverage ?? {};
}

// ─── Source Definitions ──────────────────────────────────────────────────────
export type DataSourceId =
  | 'USGS' | 'USGS_DV' | 'BWB' | 'CBP' | 'WQP'
  | 'ERDDAP' | 'NOAA' | 'MMW' | 'EPA_EF'
  | 'STATE' | 'NASA_STREAM' | 'HYDROSHARE'
  | 'CEDEN'
  | 'REFERENCE' | 'MOCK';

export interface DataSourceInfo {
  id: DataSourceId;
  name: string;
  fullName: string;
  color: string;       // Tailwind bg class
  textColor: string;   // Tailwind text class
  url: string;
  description: string;
}

export const DATA_SOURCES: Record<DataSourceId, DataSourceInfo> = {
  USGS: {
    id: 'USGS',
    name: 'USGS Real-Time',
    fullName: 'USGS Instantaneous Values Service',
    color: 'bg-cyan-100',
    textColor: 'text-cyan-700',
    url: 'https://waterservices.usgs.gov',
    description: 'Real-time sensor data updated every 15 minutes',
  },
  BWB: {
    id: 'BWB',
    name: 'Blue Water Baltimore',
    fullName: 'Blue Water Baltimore via Water Reporter',
    color: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    url: 'https://waterreporter.org',
    description: 'Community-based water quality monitoring',
  },
  CBP: {
    id: 'CBP',
    name: 'Chesapeake Bay Program',
    fullName: 'Chesapeake Bay Program DataHub',
    color: 'bg-blue-100',
    textColor: 'text-blue-700',
    url: 'https://datahub.chesapeakebay.net',
    description: 'Federal/state Chesapeake watershed monitoring (1984–present)',
  },
  CEDEN: {
    id: 'CEDEN',
    name: 'CEDEN',
    fullName: 'California Environmental Data Exchange Network',
    color: 'bg-amber-100',
    textColor: 'text-amber-700',
    url: 'https://data.ca.gov/dataset/surface-water-chemistry-results',
    description: 'California state water quality data (chemistry, toxicity) via Open Data Portal',
  },
  WQP: {
    id: 'WQP',
    name: 'EPA / USGS',
    fullName: 'Water Quality Portal (EPA + USGS)',
    color: 'bg-violet-100',
    textColor: 'text-violet-700',
    url: 'https://www.waterqualitydata.us',
    description: 'National water quality data aggregating EPA, USGS, and state partners',
  },
  ERDDAP: {
    id: 'ERDDAP',
    name: 'MD DNR',
    fullName: 'MD DNR Eyes on the Bay via MARACOOS ERDDAP',
    color: 'bg-teal-100',
    textColor: 'text-teal-700',
    url: 'https://erddap.maracoos.org/erddap/tabledap/',
    description: 'Continuous tidal water quality monitoring (15-min intervals)',
  },
  NOAA: {
    id: 'NOAA',
    name: 'NOAA CO-OPS',
    fullName: 'NOAA Tides & Currents (CO-OPS)',
    color: 'bg-sky-100',
    textColor: 'text-sky-700',
    url: 'https://tidesandcurrents.noaa.gov',
    description: 'Real-time water temperature, conductivity, and water levels',
  },
  USGS_DV: {
    id: 'USGS_DV',
    name: 'USGS Daily',
    fullName: 'USGS Daily Values Service',
    color: 'bg-cyan-50',
    textColor: 'text-cyan-600',
    url: 'https://waterservices.usgs.gov',
    description: 'Daily aggregated values (min/max/mean) from USGS monitoring stations',
  },
  MMW: {
    id: 'MMW',
    name: 'Monitor My Watershed',
    fullName: 'Monitor My Watershed (EnviroDIY/Stroud)',
    color: 'bg-lime-100',
    textColor: 'text-lime-700',
    url: 'https://monitormywatershed.org',
    description: 'Citizen science sensor data from the EnviroDIY/Stroud Research Center network',
  },
  EPA_EF: {
    id: 'EPA_EF',
    name: 'EPA Envirofacts',
    fullName: 'EPA Envirofacts (SDWIS/TRI/PCS)',
    color: 'bg-orange-100',
    textColor: 'text-orange-700',
    url: 'https://data.epa.gov/efservice/',
    description: 'EPA compliance data — SDWIS violations, TRI releases, PCS permit compliance',
  },
  STATE: {
    id: 'STATE',
    name: 'State Portal',
    fullName: 'State Open Data Portal',
    color: 'bg-rose-100',
    textColor: 'text-rose-700',
    url: '',
    description: 'Water quality data from state open data portals (MD iMap, VA DEQ, CA Open Data)',
  },
  NASA_STREAM: {
    id: 'NASA_STREAM',
    name: 'NASA STREAM',
    fullName: 'NASA Satellite-derived Water Quality',
    color: 'bg-indigo-100',
    textColor: 'text-indigo-700',
    url: 'https://earthdata.nasa.gov',
    description: 'Satellite-derived chlorophyll-a, turbidity, and Secchi depth estimates',
  },
  HYDROSHARE: {
    id: 'HYDROSHARE',
    name: 'HydroShare',
    fullName: 'CUAHSI HydroShare Repository',
    color: 'bg-fuchsia-100',
    textColor: 'text-fuchsia-700',
    url: 'https://www.hydroshare.org',
    description: 'Hydrologic dataset repository from CUAHSI research network',
  },
  REFERENCE: {
    id: 'REFERENCE',
    name: 'Reference',
    fullName: 'Agency Reference Data',
    color: 'bg-amber-100',
    textColor: 'text-amber-700',
    url: '',
    description: 'Last recorded data from state/federal agency reports and assessments',
  },
  MOCK: {
    id: 'MOCK',
    name: 'Simulated',
    fullName: 'PEARL Simulated Data',
    color: 'bg-gray-100',
    textColor: 'text-gray-500',
    url: '',
    description: 'Modeled data based on regional averages and pilot results',
  },
};

// ─── BWB Station Mapping (known Baltimore stations) ─────────────────────────
interface BWBStation {
  datasetId: number;
  stationId: number;
  stationName: string;
  lastSampled: string;
}

const BWB_STATION_MAP: Record<string, BWBStation> = {
  maryland_middle_branch:   { datasetId: 860, stationId: 8756, stationName: 'Middle Branch A', lastSampled: '2025-11-13' },
  maryland_inner_harbor:    { datasetId: 860, stationId: 8789, stationName: 'Dragon Boats', lastSampled: '2025-11-13' },
  maryland_jones_falls:     { datasetId: 860, stationId: 8751, stationName: 'Jones Falls Outlet', lastSampled: '2025-11-13' },
  maryland_gwynns_falls:    { datasetId: 860, stationId: 8787, stationName: 'Lower Gwynns Falls G', lastSampled: '2026-01-14' },
  maryland_bear_creek:      { datasetId: 860, stationId: 8744, stationName: 'Bear Creek', lastSampled: '2025-10-07' },
  maryland_curtis_bay:      { datasetId: 860, stationId: 8745, stationName: 'Curtis Bay', lastSampled: '2025-10-07' },
  maryland_patapsco_river:  { datasetId: 860, stationId: 8747, stationName: 'Mainstem B', lastSampled: '2025-10-07' },
  maryland_stony_creek:     { datasetId: 860, stationId: 8741, stationName: 'Stoney Creek', lastSampled: '2025-10-07' },
  maryland_back_river:      { datasetId: 860, stationId: 32693, stationName: 'Back River Mainstem A', lastSampled: '2023-08-31' },
  maryland_canton:          { datasetId: 860, stationId: 8754, stationName: 'Canton Park', lastSampled: '2025-11-13' },
  maryland_ferry_bar:       { datasetId: 860, stationId: 8758, stationName: 'Ferry Bar Park', lastSampled: '2025-11-13' },
  maryland_ft_mchenry:      { datasetId: 860, stationId: 8755, stationName: 'Ft. McHenry Channel', lastSampled: '2025-09-03' },
  maryland_curtis_creek:    { datasetId: 860, stationId: 8760, stationName: 'Curtis Creek', lastSampled: '2025-10-07' },
  maryland_bodkin_creek:    { datasetId: 860, stationId: 8761, stationName: 'Bodkin Creek', lastSampled: '2025-08-27' },
  maryland_rock_creek:      { datasetId: 860, stationId: 8740, stationName: 'Rock Creek', lastSampled: '2025-10-07' },
};

// ─── USGS Site Map — merged from registry + hand-verified legacy entries ─────
// Registry provides 1,200+ auto-discovered sites; legacy entries preserved for
// Baltimore-area and Chesapeake-specific stations with known best gauges
const LEGACY_USGS_SITES: Record<string, string> = {
  // Maryland — Baltimore area (hand-verified best matches)
  maryland_jones_falls:      '01589440',
  maryland_gwynns_falls:     '01589300',
  maryland_patapsco_river:   '01589000',
  maryland_patapsco:         '01589000',
  maryland_back_river:       '01585200',
  maryland_bear_creek:       '01585200',
  maryland_middle_branch:    '01589440',
  maryland_inner_harbor:     '01589440',
  maryland_gunpowder:        '01581920',
  // Maryland — Chesapeake tributaries
  maryland_chester_river:    '01493112',
  maryland_chester:          '01493112',
  maryland_choptank_river:   '01491000',
  maryland_choptank:         '01491000',
  maryland_patuxent_river:   '01594440',
  maryland_patuxent:         '01594440',
  maryland_severn_river:     '01589520',
  maryland_severn:           '01589520',
  maryland_magothy_river:    '01589520',
  maryland_magothy:          '01589520',
  maryland_potomac:          '01646500',
  maryland_nanticoke_river:  '01488500',
  maryland_monocacy_river:   '01643000',
  maryland_antietam_creek:   '01619500',
  maryland_rock_creek_aa:    '01589520',
  chesapeake_bay_main:       '01594440',
  // Delaware
  delaware_christina_river:  '01478000',
  delaware_christina:        '01478000',
  delaware_brandywine:       '01481000',
  delaware_st_jones:         '01483700',
  delaware_red_clay:         '01479000',
  delaware_appoquinimink:    '01483700',
  // Virginia
  virginia_james_river:      '02037500',
  virginia_james_lower:      '02037500',
  virginia_james:            '02037500',
  virginia_elizabeth_river:  '02043500',
  virginia_elizabeth:        '02043500',
  virginia_rappahannock:     '01668000',
  virginia_rappahannock_tidal: '01668000',
  virginia_shenandoah:       '01636500',
  virginia_lynnhaven:        '02043500',
  virginia_york_river:       '01674500',
  virginia_york:             '01674500',
  virginia_back_bay:         '02043500',
  // DC
  dc_potomac:                '01646500',
  dc_anacostia:              '01651000',
  dc_rock_creek:             '01648000',
  dc_oxon_run:               '01653500',
  dc_watts_branch:           '01651800',
  // West Virginia
  westvirginia_potomac_sb:   '01608500',
  westvirginia_shenandoah:   '01636500',
  westvirginia_opequon:      '01616500',
  westvirginia_cacapon:      '01611500',
  westvirginia_lost_river:   '01606500',
  // Pennsylvania
  pennsylvania_susquehanna:  '01578310',
  pennsylvania_susquehanna_lower: '01578310',
  pennsylvania_conestoga:    '01576754',
  pennsylvania_swatara:      '01572190',
  pennsylvania_codorus:      '01575500',
  pennsylvania_pequea:       '01576787',
  // New York
  newyork_chemung:           '01531000',
  newyork_susquehanna_upper: '01503000',
  newyork_cayuga_inlet:      '04234000',
  // California
  california_sf_bay:         '374811122235001',
  california_los_angeles:    '11103000',
  california_santa_monica:   '11101250',
  california_san_diego:      '11023000',
  california_sacramento:     '11447650',
  // Florida — PEARL pilot
  florida_escambia:          '02376033',
  florida_blackwater:        '02370000',
  florida_pensacola_bay:     '02376033',
  florida_yellow_river:      '02368000',
  florida_apalachicola:      '02359170',
  florida_tampa_bay:         '02306028',
  florida_charlotte_harbor:  '02297460',
  // Utah
  utah_great_salt_lake:      '10010000',
  utah_jordan:               '10171000',
  utah_utah_lake:            '10166500',
};

// Legacy (hand-verified) sites take priority over registry auto-discovered ones
// Computed dynamically: registry loads at runtime, legacy always available
export function getUSGSSiteMap(): Record<string, string> {
  return { ...getRegistryUSGS(), ...LEGACY_USGS_SITES };
}
export const USGS_SITE_MAP: Record<string, string> = new Proxy(LEGACY_USGS_SITES, {
  get(target, prop: string) {
    return LEGACY_USGS_SITES[prop] ?? getRegistryUSGS()[prop];
  },
  has(target, prop: string) {
    return prop in LEGACY_USGS_SITES || prop in getRegistryUSGS();
  },
  ownKeys() {
    return [...new Set([...Object.keys(getRegistryUSGS()), ...Object.keys(LEGACY_USGS_SITES)])];
  },
  getOwnPropertyDescriptor(target, prop) {
    const val = LEGACY_USGS_SITES[prop as string] ?? getRegistryUSGS()[prop as string];
    if (val !== undefined) return { configurable: true, enumerable: true, value: val };
    return undefined;
  }
});

// ─── Region → HUC + Coordinate Mapping ──────────────────────────────────────
// HUC codes enable CBP DataHub and WQP queries for any Chesapeake/US region
// ─── Region Metadata — merged from registry + hand-verified legacy entries ───
// Registry provides 12,000+ auto-discovered waterbodies; legacy entries preserved
// for Baltimore/Chesapeake stations with CBP station IDs and HUC12 codes
interface RegionMeta {
  lat: number;
  lng: number;
  huc8: string;
  huc12?: string;
  cbpStation?: string;
  stateCode: string;
  name: string;
}

const LEGACY_REGIONS: Record<string, RegionMeta> = {
  // Maryland — Baltimore area
  maryland_middle_branch:    { lat: 39.263, lng: -76.623, huc8: '02060003', stateCode: 'US:24', name: 'Middle Branch Patapsco' },
  maryland_inner_harbor:     { lat: 39.285, lng: -76.610, huc8: '02060003', stateCode: 'US:24', name: 'Inner Harbor' },
  maryland_jones_falls:      { lat: 39.290, lng: -76.612, huc8: '02060003', stateCode: 'US:24', name: 'Jones Falls' },
  maryland_gwynns_falls:     { lat: 39.275, lng: -76.657, huc8: '02060003', stateCode: 'US:24', name: 'Gwynns Falls' },
  maryland_back_river:       { lat: 39.262, lng: -76.476, huc8: '02060003', stateCode: 'US:24', name: 'Back River' },
  maryland_bear_creek:       { lat: 39.250, lng: -76.460, huc8: '02060003', stateCode: 'US:24', name: 'Bear Creek' },
  maryland_curtis_bay:       { lat: 39.215, lng: -76.577, huc8: '02060003', stateCode: 'US:24', name: 'Curtis Bay' },
  maryland_patapsco_river:   { lat: 39.235, lng: -76.535, huc8: '02060003', stateCode: 'US:24', name: 'Patapsco River' },
  maryland_patapsco:         { lat: 39.235, lng: -76.535, huc8: '02060003', stateCode: 'US:24', name: 'Patapsco River' },
  maryland_stony_creek:      { lat: 39.203, lng: -76.537, huc8: '02060003', stateCode: 'US:24', name: 'Stony Creek' },
  maryland_severn_river:     { lat: 39.060, lng: -76.535, huc8: '02060004', stateCode: 'US:24', name: 'Severn River' },
  maryland_severn:           { lat: 39.060, lng: -76.535, huc8: '02060004', stateCode: 'US:24', name: 'Severn River' },
  maryland_south_river:      { lat: 38.945, lng: -76.545, huc8: '02060004', stateCode: 'US:24', name: 'South River' },
  maryland_magothy_river:    { lat: 39.105, lng: -76.490, huc8: '02060004', stateCode: 'US:24', name: 'Magothy River' },
  maryland_magothy:          { lat: 39.105, lng: -76.490, huc8: '02060004', stateCode: 'US:24', name: 'Magothy River' },
  maryland_chester_river:    { lat: 39.090, lng: -76.055, huc8: '02060005', stateCode: 'US:24', name: 'Chester River' },
  maryland_chester:          { lat: 39.090, lng: -76.055, huc8: '02060005', stateCode: 'US:24', name: 'Chester River' },
  maryland_choptank_river:   { lat: 38.880, lng: -75.785, huc8: '02060005', stateCode: 'US:24', name: 'Choptank River' },
  maryland_choptank:         { lat: 38.880, lng: -75.785, huc8: '02060005', stateCode: 'US:24', name: 'Choptank River' },
  maryland_patuxent_river:   { lat: 38.680, lng: -76.695, huc8: '02060006', stateCode: 'US:24', name: 'Patuxent River' },
  maryland_patuxent:         { lat: 38.680, lng: -76.695, huc8: '02060006', stateCode: 'US:24', name: 'Patuxent River' },
  maryland_nanticoke_river:  { lat: 38.550, lng: -75.910, huc8: '02060008', stateCode: 'US:24', name: 'Nanticoke River' },
  maryland_wicomico_river:   { lat: 38.370, lng: -75.600, huc8: '02060009', stateCode: 'US:24', name: 'Wicomico River' },
  maryland_pocomoke_river:   { lat: 38.080, lng: -75.570, huc8: '02060010', stateCode: 'US:24', name: 'Pocomoke River' },
  maryland_sassafras_river:  { lat: 39.380, lng: -75.960, huc8: '02060002', stateCode: 'US:24', name: 'Sassafras River' },
  maryland_elk_river:        { lat: 39.520, lng: -75.860, huc8: '02060002', stateCode: 'US:24', name: 'Elk River' },
  maryland_northeast_river:  { lat: 39.525, lng: -75.950, huc8: '02060002', stateCode: 'US:24', name: 'Northeast River' },
  maryland_gunpowder:        { lat: 39.340, lng: -76.365, huc8: '02060003', stateCode: 'US:24', name: 'Gunpowder Falls' },
  maryland_potomac:          { lat: 38.980, lng: -77.035, huc8: '02070010', stateCode: 'US:24', name: 'Potomac River' },
  chesapeake_bay_main:       { lat: 38.570, lng: -76.380, huc8: '02060001', stateCode: 'US:24', name: 'Chesapeake Bay Mainstem' },
  // DC
  dc_potomac:                { lat: 38.905, lng: -77.040, huc8: '02070010', stateCode: 'US:11', name: 'Potomac River' },
  dc_anacostia:              { lat: 38.880, lng: -76.950, huc8: '02070010', stateCode: 'US:11', name: 'Anacostia River' },
  dc_rock_creek:             { lat: 38.950, lng: -77.050, huc8: '02070010', stateCode: 'US:11', name: 'Rock Creek' },
  dc_oxon_run:               { lat: 38.830, lng: -76.990, huc8: '02070010', stateCode: 'US:11', name: 'Oxon Run' },
  dc_watts_branch:           { lat: 38.895, lng: -76.935, huc8: '02070010', stateCode: 'US:11', name: 'Watts Branch' },
  // Florida — PEARL pilot
  florida_escambia:          { lat: 30.610, lng: -87.210, huc8: '03140305', stateCode: 'US:12', name: 'Escambia River' },
  florida_blackwater:        { lat: 30.810, lng: -86.740, huc8: '03140104', stateCode: 'US:12', name: 'Blackwater River' },
  florida_pensacola_bay:     { lat: 30.350, lng: -87.190, huc8: '03140305', stateCode: 'US:12', name: 'Pensacola Bay' },
  florida_yellow_river:      { lat: 30.760, lng: -86.610, huc8: '03140103', stateCode: 'US:12', name: 'Yellow River' },
};

// Legacy (hand-verified) entries take priority; registry fills in 12,000+ new waterbodies
export function getRegionMeta(): Record<string, RegionMeta> {
  return { ...getRegistryRegions(), ...LEGACY_REGIONS };
}
export const REGION_META: Record<string, RegionMeta> = new Proxy(LEGACY_REGIONS as Record<string, RegionMeta>, {
  get(target, prop: string) {
    return LEGACY_REGIONS[prop] ?? getRegistryRegions()[prop];
  },
  has(target, prop: string) {
    return prop in LEGACY_REGIONS || prop in getRegistryRegions();
  },
  ownKeys() {
    return [...new Set([...Object.keys(getRegistryRegions()), ...Object.keys(LEGACY_REGIONS)])];
  },
  getOwnPropertyDescriptor(target, prop) {
    const val = (LEGACY_REGIONS as Record<string, RegionMeta>)[prop as string] ?? getRegistryRegions()[prop as string];
    if (val !== undefined) return { configurable: true, enumerable: true, value: val };
    return undefined;
  }
});

// ─── Reference Data: Last recorded agency values (fallback when live APIs fail) ──
// Sources: MDE 303(d)/305(b) assessments, CBP monitoring reports, EPA data, state agency reports
// These are REAL values from published reports — not modeled. Updated manually when new reports publish.

interface ReferenceReading {
  value: number;
  unit: string;
  reportDate: string;    // Date of the report/sample
}

interface ReferenceEntry {
  source: string;           // e.g. "MDE 2024 Integrated Report"
  reportDate: string;       // Report publication date
  reportUrl?: string;       // Link to source document
  parameters: Record<string, ReferenceReading>;
}

export const REFERENCE_DATA: Record<string, ReferenceEntry> = {
  // ─── Maryland ─────────────────────────────────────────────────────────────
  maryland_middle_branch: {
    source: 'MDE 2024 Integrated Report / BWB 2024 Harbor Report',
    reportDate: '2024-06-15',
    parameters: {
      DO:          { value: 4.8,   unit: 'mg/L',  reportDate: '2024-06-15' },
      TN:          { value: 2.15,  unit: 'mg/L',  reportDate: '2024-06-15' },
      TP:          { value: 0.12,  unit: 'mg/L',  reportDate: '2024-06-15' },
      TSS:         { value: 28.0,  unit: 'mg/L',  reportDate: '2024-06-15' },
      turbidity:   { value: 18.5,  unit: 'NTU',   reportDate: '2024-06-15' },
      pH:          { value: 7.4,   unit: 'SU',    reportDate: '2024-06-15' },
      temperature: { value: 22.3,  unit: '°C',    reportDate: '2024-06-15' },
      bacteria:    { value: 320,   unit: 'MPN/100mL', reportDate: '2024-06-15' },
    },
  },
  maryland_inner_harbor: {
    source: 'BWB 2024 Harbor Monitoring',
    reportDate: '2024-11-13',
    parameters: {
      DO:          { value: 6.2,   unit: 'mg/L',  reportDate: '2024-11-13' },
      TN:          { value: 1.85,  unit: 'mg/L',  reportDate: '2024-11-13' },
      TP:          { value: 0.09,  unit: 'mg/L',  reportDate: '2024-11-13' },
      TSS:         { value: 22.0,  unit: 'mg/L',  reportDate: '2024-11-13' },
      turbidity:   { value: 14.2,  unit: 'NTU',   reportDate: '2024-11-13' },
      pH:          { value: 7.6,   unit: 'SU',    reportDate: '2024-11-13' },
      temperature: { value: 12.8,  unit: '°C',    reportDate: '2024-11-13' },
    },
  },
  maryland_patapsco: {
    source: 'MDE 2024 Integrated Report',
    reportDate: '2024-04-01',
    parameters: {
      DO:          { value: 7.1,   unit: 'mg/L',  reportDate: '2024-04-01' },
      TN:          { value: 1.65,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TP:          { value: 0.08,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TSS:         { value: 18.0,  unit: 'mg/L',  reportDate: '2024-04-01' },
      turbidity:   { value: 11.0,  unit: 'NTU',   reportDate: '2024-04-01' },
      pH:          { value: 7.5,   unit: 'SU',    reportDate: '2024-04-01' },
      temperature: { value: 16.5,  unit: '°C',    reportDate: '2024-04-01' },
    },
  },
  maryland_patapsco_river: {
    source: 'MDE 2024 Integrated Report',
    reportDate: '2024-04-01',
    parameters: {
      DO:          { value: 7.1,   unit: 'mg/L',  reportDate: '2024-04-01' },
      TN:          { value: 1.65,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TP:          { value: 0.08,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TSS:         { value: 18.0,  unit: 'mg/L',  reportDate: '2024-04-01' },
      turbidity:   { value: 11.0,  unit: 'NTU',   reportDate: '2024-04-01' },
      pH:          { value: 7.5,   unit: 'SU',    reportDate: '2024-04-01' },
      temperature: { value: 16.5,  unit: '°C',    reportDate: '2024-04-01' },
    },
  },
  maryland_gwynns_falls: {
    source: 'BWB 2024 Monitoring / USGS Gwynns Falls LTER',
    reportDate: '2024-10-14',
    parameters: {
      DO:          { value: 5.4,   unit: 'mg/L',  reportDate: '2024-10-14' },
      TN:          { value: 3.20,  unit: 'mg/L',  reportDate: '2024-10-14' },
      TP:          { value: 0.18,  unit: 'mg/L',  reportDate: '2024-10-14' },
      TSS:         { value: 42.0,  unit: 'mg/L',  reportDate: '2024-10-14' },
      turbidity:   { value: 28.0,  unit: 'NTU',   reportDate: '2024-10-14' },
      pH:          { value: 7.2,   unit: 'SU',    reportDate: '2024-10-14' },
      bacteria:    { value: 890,   unit: 'MPN/100mL', reportDate: '2024-10-14' },
    },
  },
  maryland_back_river: {
    source: 'MDE 2024 Integrated Report',
    reportDate: '2024-04-01',
    parameters: {
      DO:          { value: 5.8,   unit: 'mg/L',  reportDate: '2024-04-01' },
      TN:          { value: 4.10,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TP:          { value: 0.22,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TSS:         { value: 24.0,  unit: 'mg/L',  reportDate: '2024-04-01' },
      turbidity:   { value: 16.0,  unit: 'NTU',   reportDate: '2024-04-01' },
      pH:          { value: 7.3,   unit: 'SU',    reportDate: '2024-04-01' },
    },
  },
  maryland_bear_creek: {
    source: 'BWB 2024 Harbor Report',
    reportDate: '2024-10-07',
    parameters: {
      DO:          { value: 5.5,   unit: 'mg/L',  reportDate: '2024-10-07' },
      TN:          { value: 2.40,  unit: 'mg/L',  reportDate: '2024-10-07' },
      TP:          { value: 0.14,  unit: 'mg/L',  reportDate: '2024-10-07' },
      TSS:         { value: 20.0,  unit: 'mg/L',  reportDate: '2024-10-07' },
      pH:          { value: 7.4,   unit: 'SU',    reportDate: '2024-10-07' },
    },
  },
  maryland_gunpowder: {
    source: 'MDE 2024 Integrated Report / USGS 01582500',
    reportDate: '2024-04-01',
    parameters: {
      DO:          { value: 8.9,   unit: 'mg/L',  reportDate: '2024-04-01' },
      TN:          { value: 1.20,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TP:          { value: 0.04,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TSS:         { value: 8.0,   unit: 'mg/L',  reportDate: '2024-04-01' },
      turbidity:   { value: 4.5,   unit: 'NTU',   reportDate: '2024-04-01' },
      pH:          { value: 7.8,   unit: 'SU',    reportDate: '2024-04-01' },
      temperature: { value: 14.2,  unit: '°C',    reportDate: '2024-04-01' },
    },
  },
  maryland_severn: {
    source: 'MDE 2024 Integrated Report / MD DNR Eyes on the Bay',
    reportDate: '2024-08-15',
    parameters: {
      DO:          { value: 5.2,   unit: 'mg/L',  reportDate: '2024-08-15' },
      TN:          { value: 0.95,  unit: 'mg/L',  reportDate: '2024-08-15' },
      TP:          { value: 0.05,  unit: 'mg/L',  reportDate: '2024-08-15' },
      TSS:         { value: 12.0,  unit: 'mg/L',  reportDate: '2024-08-15' },
      turbidity:   { value: 7.8,   unit: 'NTU',   reportDate: '2024-08-15' },
      pH:          { value: 7.8,   unit: 'SU',    reportDate: '2024-08-15' },
      salinity:    { value: 8.5,   unit: 'ppt',   reportDate: '2024-08-15' },
      temperature: { value: 26.1,  unit: '°C',    reportDate: '2024-08-15' },
    },
  },
  maryland_severn_river: {
    source: 'MDE 2024 Integrated Report / MD DNR Eyes on the Bay',
    reportDate: '2024-08-15',
    parameters: {
      DO:          { value: 5.2,   unit: 'mg/L',  reportDate: '2024-08-15' },
      TN:          { value: 0.95,  unit: 'mg/L',  reportDate: '2024-08-15' },
      TP:          { value: 0.05,  unit: 'mg/L',  reportDate: '2024-08-15' },
      salinity:    { value: 8.5,   unit: 'ppt',   reportDate: '2024-08-15' },
      temperature: { value: 26.1,  unit: '°C',    reportDate: '2024-08-15' },
    },
  },
  maryland_magothy: {
    source: 'MDE 2024 Integrated Report',
    reportDate: '2024-04-01',
    parameters: {
      DO:          { value: 6.0,   unit: 'mg/L',  reportDate: '2024-04-01' },
      TN:          { value: 0.85,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TP:          { value: 0.04,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TSS:         { value: 10.0,  unit: 'mg/L',  reportDate: '2024-04-01' },
      pH:          { value: 7.9,   unit: 'SU',    reportDate: '2024-04-01' },
      salinity:    { value: 7.2,   unit: 'ppt',   reportDate: '2024-04-01' },
    },
  },
  maryland_magothy_river: {
    source: 'MDE 2024 Integrated Report',
    reportDate: '2024-04-01',
    parameters: {
      DO:          { value: 6.0,   unit: 'mg/L',  reportDate: '2024-04-01' },
      TN:          { value: 0.85,  unit: 'mg/L',  reportDate: '2024-04-01' },
      TP:          { value: 0.04,  unit: 'mg/L',  reportDate: '2024-04-01' },
      salinity:    { value: 7.2,   unit: 'ppt',   reportDate: '2024-04-01' },
    },
  },
  maryland_chester: {
    source: 'CBP 2024 Bay Barometer / MDE 2024',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 6.8,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 1.40,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.06,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 14.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      turbidity:   { value: 9.0,   unit: 'NTU',   reportDate: '2024-06-01' },
      pH:          { value: 7.7,   unit: 'SU',    reportDate: '2024-06-01' },
      salinity:    { value: 6.0,   unit: 'ppt',   reportDate: '2024-06-01' },
    },
  },
  maryland_chester_river: {
    source: 'CBP 2024 Bay Barometer / MDE 2024',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 6.8,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 1.40,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.06,  unit: 'mg/L',  reportDate: '2024-06-01' },
      salinity:    { value: 6.0,   unit: 'ppt',   reportDate: '2024-06-01' },
    },
  },
  maryland_choptank: {
    source: 'CBP 2024 / USGS Choptank LTER',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 7.2,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 1.85,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.08,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 16.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      turbidity:   { value: 10.5,  unit: 'NTU',   reportDate: '2024-06-01' },
      pH:          { value: 7.6,   unit: 'SU',    reportDate: '2024-06-01' },
      salinity:    { value: 9.5,   unit: 'ppt',   reportDate: '2024-06-01' },
    },
  },
  maryland_choptank_river: {
    source: 'CBP 2024 / USGS Choptank LTER',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 7.2,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 1.85,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.08,  unit: 'mg/L',  reportDate: '2024-06-01' },
      salinity:    { value: 9.5,   unit: 'ppt',   reportDate: '2024-06-01' },
    },
  },
  maryland_patuxent: {
    source: 'MDE 2024 / MD DNR Jug Bay Monitoring',
    reportDate: '2024-08-01',
    parameters: {
      DO:          { value: 6.5,   unit: 'mg/L',  reportDate: '2024-08-01' },
      TN:          { value: 1.10,  unit: 'mg/L',  reportDate: '2024-08-01' },
      TP:          { value: 0.05,  unit: 'mg/L',  reportDate: '2024-08-01' },
      TSS:         { value: 11.0,  unit: 'mg/L',  reportDate: '2024-08-01' },
      turbidity:   { value: 7.0,   unit: 'NTU',   reportDate: '2024-08-01' },
      pH:          { value: 7.6,   unit: 'SU',    reportDate: '2024-08-01' },
      salinity:    { value: 4.2,   unit: 'ppt',   reportDate: '2024-08-01' },
      temperature: { value: 27.5,  unit: '°C',    reportDate: '2024-08-01' },
    },
  },
  maryland_patuxent_river: {
    source: 'MDE 2024 / MD DNR Jug Bay Monitoring',
    reportDate: '2024-08-01',
    parameters: {
      DO:          { value: 6.5,   unit: 'mg/L',  reportDate: '2024-08-01' },
      TN:          { value: 1.10,  unit: 'mg/L',  reportDate: '2024-08-01' },
      TP:          { value: 0.05,  unit: 'mg/L',  reportDate: '2024-08-01' },
      salinity:    { value: 4.2,   unit: 'ppt',   reportDate: '2024-08-01' },
    },
  },
  maryland_potomac: {
    source: 'ICPRB 2024 Potomac Basin Report / USGS',
    reportDate: '2024-09-01',
    parameters: {
      DO:          { value: 8.2,   unit: 'mg/L',  reportDate: '2024-09-01' },
      TN:          { value: 1.75,  unit: 'mg/L',  reportDate: '2024-09-01' },
      TP:          { value: 0.07,  unit: 'mg/L',  reportDate: '2024-09-01' },
      TSS:         { value: 15.0,  unit: 'mg/L',  reportDate: '2024-09-01' },
      turbidity:   { value: 8.5,   unit: 'NTU',   reportDate: '2024-09-01' },
      pH:          { value: 7.9,   unit: 'SU',    reportDate: '2024-09-01' },
      temperature: { value: 21.0,  unit: '°C',    reportDate: '2024-09-01' },
    },
  },
  maryland_rock_creek_aa: {
    source: 'MDE 2024 / Anne Arundel Co. MS4 Report',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 5.8,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 1.90,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.10,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 20.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      turbidity:   { value: 13.0,  unit: 'NTU',   reportDate: '2024-06-01' },
      pH:          { value: 7.4,   unit: 'SU',    reportDate: '2024-06-01' },
    },
  },
  chesapeake_bay_main: {
    source: 'CBP 2024 Bay Barometer / EPA Chesapeake Progress',
    reportDate: '2024-08-01',
    parameters: {
      DO:          { value: 5.5,   unit: 'mg/L',  reportDate: '2024-08-01' },
      TN:          { value: 0.78,  unit: 'mg/L',  reportDate: '2024-08-01' },
      TP:          { value: 0.03,  unit: 'mg/L',  reportDate: '2024-08-01' },
      TSS:         { value: 8.0,   unit: 'mg/L',  reportDate: '2024-08-01' },
      turbidity:   { value: 5.2,   unit: 'NTU',   reportDate: '2024-08-01' },
      pH:          { value: 8.0,   unit: 'SU',    reportDate: '2024-08-01' },
      salinity:    { value: 14.5,  unit: 'ppt',   reportDate: '2024-08-01' },
      temperature: { value: 25.8,  unit: '°C',    reportDate: '2024-08-01' },
    },
  },

  // ─── DC ───────────────────────────────────────────────────────────────────
  dc_anacostia: {
    source: 'DOEE 2024 Anacostia Report / AWS',
    reportDate: '2024-09-01',
    parameters: {
      DO:          { value: 5.0,   unit: 'mg/L',  reportDate: '2024-09-01' },
      TN:          { value: 2.80,  unit: 'mg/L',  reportDate: '2024-09-01' },
      TP:          { value: 0.15,  unit: 'mg/L',  reportDate: '2024-09-01' },
      TSS:         { value: 35.0,  unit: 'mg/L',  reportDate: '2024-09-01' },
      turbidity:   { value: 22.0,  unit: 'NTU',   reportDate: '2024-09-01' },
      pH:          { value: 7.3,   unit: 'SU',    reportDate: '2024-09-01' },
      bacteria:    { value: 580,   unit: 'MPN/100mL', reportDate: '2024-09-01' },
    },
  },
  dc_rock_creek: {
    source: 'DOEE 2024 / NPS Rock Creek Monitoring',
    reportDate: '2024-07-01',
    parameters: {
      DO:          { value: 7.5,   unit: 'mg/L',  reportDate: '2024-07-01' },
      TN:          { value: 1.50,  unit: 'mg/L',  reportDate: '2024-07-01' },
      TP:          { value: 0.06,  unit: 'mg/L',  reportDate: '2024-07-01' },
      TSS:         { value: 14.0,  unit: 'mg/L',  reportDate: '2024-07-01' },
      pH:          { value: 7.7,   unit: 'SU',    reportDate: '2024-07-01' },
    },
  },

  // ─── Virginia ─────────────────────────────────────────────────────────────
  virginia_elizabeth: {
    source: 'VA DEQ 2024 WQ Assessment / HRSD',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 4.5,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 1.90,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.11,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 25.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      turbidity:   { value: 16.0,  unit: 'NTU',   reportDate: '2024-06-01' },
      pH:          { value: 7.5,   unit: 'SU',    reportDate: '2024-06-01' },
      salinity:    { value: 18.0,  unit: 'ppt',   reportDate: '2024-06-01' },
    },
  },
  virginia_james: {
    source: 'VA DEQ 2024 WQ Assessment',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 6.8,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 1.20,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.06,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 16.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      pH:          { value: 7.6,   unit: 'SU',    reportDate: '2024-06-01' },
      salinity:    { value: 5.0,   unit: 'ppt',   reportDate: '2024-06-01' },
    },
  },
  virginia_james_lower: {
    source: 'VA DEQ 2024 WQ Assessment',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 6.8,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 1.20,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.06,  unit: 'mg/L',  reportDate: '2024-06-01' },
      salinity:    { value: 5.0,   unit: 'ppt',   reportDate: '2024-06-01' },
    },
  },
  virginia_york: {
    source: 'VA DEQ 2024 / VIMS York River Monitoring',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 7.0,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 0.80,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.04,  unit: 'mg/L',  reportDate: '2024-06-01' },
      pH:          { value: 7.8,   unit: 'SU',    reportDate: '2024-06-01' },
      salinity:    { value: 12.0,  unit: 'ppt',   reportDate: '2024-06-01' },
    },
  },
  virginia_rappahannock: {
    source: 'VA DEQ 2024 WQ Assessment',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 7.5,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 1.05,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.05,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 12.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      pH:          { value: 7.7,   unit: 'SU',    reportDate: '2024-06-01' },
      salinity:    { value: 3.5,   unit: 'ppt',   reportDate: '2024-06-01' },
    },
  },

  // ─── Florida (PEARL pilot region) ────────────────────────────────────────
  florida_escambia: {
    source: 'FDEP 2024 Basin Assessment / PEARL Pilot Jan 2025',
    reportDate: '2025-01-16',
    parameters: {
      DO:          { value: 6.8,   unit: 'mg/L',  reportDate: '2025-01-16' },
      TN:          { value: 0.95,  unit: 'mg/L',  reportDate: '2025-01-16' },
      TP:          { value: 0.05,  unit: 'mg/L',  reportDate: '2025-01-16' },
      TSS:         { value: 15.0,  unit: 'mg/L',  reportDate: '2025-01-16' },
      turbidity:   { value: 8.2,   unit: 'NTU',   reportDate: '2025-01-16' },
      pH:          { value: 7.4,   unit: 'SU',    reportDate: '2025-01-16' },
      temperature: { value: 14.0,  unit: '°C',    reportDate: '2025-01-16' },
    },
  },
  florida_pensacola_bay: {
    source: 'FDEP 2024 Basin Assessment',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 6.2,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 0.72,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.04,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 10.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      salinity:    { value: 22.0,  unit: 'ppt',   reportDate: '2024-06-01' },
      pH:          { value: 7.9,   unit: 'SU',    reportDate: '2024-06-01' },
    },
  },
  florida_blackwater: {
    source: 'FDEP 2024 Basin Assessment',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 5.5,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 0.60,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.03,  unit: 'mg/L',  reportDate: '2024-06-01' },
      pH:          { value: 5.8,   unit: 'SU',    reportDate: '2024-06-01' },
      temperature: { value: 22.0,  unit: '°C',    reportDate: '2024-06-01' },
    },
  },
  florida_yellow_river: {
    source: 'FDEP 2024 Basin Assessment / NWFWMD',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 6.0,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 0.55,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.03,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 12.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      pH:          { value: 6.2,   unit: 'SU',    reportDate: '2024-06-01' },
      temperature: { value: 23.0,  unit: '°C',    reportDate: '2024-06-01' },
    },
  },
  florida_apalachicola: {
    source: 'FDEP 2024 Basin Assessment / ANERR',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 6.5,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 0.68,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.04,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 14.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      turbidity:   { value: 9.0,   unit: 'NTU',   reportDate: '2024-06-01' },
      pH:          { value: 7.6,   unit: 'SU',    reportDate: '2024-06-01' },
      salinity:    { value: 12.5,  unit: 'ppt',   reportDate: '2024-06-01' },
      temperature: { value: 25.0,  unit: '°C',    reportDate: '2024-06-01' },
    },
  },
  florida_tampa_bay: {
    source: 'TBEP 2024 State of the Bay / FDEP',
    reportDate: '2024-08-01',
    parameters: {
      DO:          { value: 5.8,   unit: 'mg/L',  reportDate: '2024-08-01' },
      TN:          { value: 0.72,  unit: 'mg/L',  reportDate: '2024-08-01' },
      TP:          { value: 0.05,  unit: 'mg/L',  reportDate: '2024-08-01' },
      TSS:         { value: 10.0,  unit: 'mg/L',  reportDate: '2024-08-01' },
      turbidity:   { value: 6.5,   unit: 'NTU',   reportDate: '2024-08-01' },
      pH:          { value: 8.0,   unit: 'SU',    reportDate: '2024-08-01' },
      salinity:    { value: 26.0,  unit: 'ppt',   reportDate: '2024-08-01' },
      temperature: { value: 29.5,  unit: '°C',    reportDate: '2024-08-01' },
      chlorophyll: { value: 8.2,   unit: 'µg/L',  reportDate: '2024-08-01' },
    },
  },
  florida_charlotte_harbor: {
    source: 'CHNEP 2024 Report / FDEP Basin Assessment',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 5.5,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 0.58,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.06,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 8.0,   unit: 'mg/L',  reportDate: '2024-06-01' },
      turbidity:   { value: 5.0,   unit: 'NTU',   reportDate: '2024-06-01' },
      pH:          { value: 7.8,   unit: 'SU',    reportDate: '2024-06-01' },
      salinity:    { value: 20.0,  unit: 'ppt',   reportDate: '2024-06-01' },
      temperature: { value: 27.0,  unit: '°C',    reportDate: '2024-06-01' },
    },
  },

  // ─── Pennsylvania (Chesapeake headwaters) ────────────────────────────────
  pennsylvania_conestoga: {
    source: 'PA DEP 2024 / USGS Chesapeake LTER',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 8.0,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 5.80,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.28,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 45.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      turbidity:   { value: 30.0,  unit: 'NTU',   reportDate: '2024-06-01' },
      pH:          { value: 7.8,   unit: 'SU',    reportDate: '2024-06-01' },
    },
  },
  pennsylvania_susquehanna_lower: {
    source: 'SRBC 2024 / USGS Conowingo',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 9.2,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 1.80,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.06,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 18.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      turbidity:   { value: 10.0,  unit: 'NTU',   reportDate: '2024-06-01' },
      pH:          { value: 7.9,   unit: 'SU',    reportDate: '2024-06-01' },
    },
  },

  // ─── West Virginia ────────────────────────────────────────────────────────
  westvirginia_potomac_sb: {
    source: 'WV DEP 2024 / ICPRB',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 9.5,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 0.65,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.02,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 6.0,   unit: 'mg/L',  reportDate: '2024-06-01' },
      pH:          { value: 8.1,   unit: 'SU',    reportDate: '2024-06-01' },
      temperature: { value: 18.0,  unit: '°C',    reportDate: '2024-06-01' },
    },
  },

  // ─── Delaware ─────────────────────────────────────────────────────────────
  delaware_christina: {
    source: 'DNREC 2024 WQ Assessment',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 6.5,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 3.20,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.18,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 22.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      pH:          { value: 7.3,   unit: 'SU',    reportDate: '2024-06-01' },
    },
  },
  delaware_brandywine: {
    source: 'DNREC 2024 / Brandywine Conservancy',
    reportDate: '2024-06-01',
    parameters: {
      DO:          { value: 8.5,   unit: 'mg/L',  reportDate: '2024-06-01' },
      TN:          { value: 2.10,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TP:          { value: 0.08,  unit: 'mg/L',  reportDate: '2024-06-01' },
      TSS:         { value: 12.0,  unit: 'mg/L',  reportDate: '2024-06-01' },
      pH:          { value: 7.6,   unit: 'SU',    reportDate: '2024-06-01' },
    },
  },
};

// ─── Reference data helper ──────────────────────────────────────────────────
export function getReferenceData(regionId: string): ReferenceEntry | null {
  return REFERENCE_DATA[regionId] || null;
}

// ─── Parameter mapping (WR normalized_name → PEARL key) ─────────────────────
const WR_TO_PEARL: Record<string, string> = {
  'dissolved_oxygen_mg_l': 'DO',
  'total_nitrogen_mg_l': 'TN',
  'total_phosphorus_mg_l': 'TP',
  'turbidity_ntu': 'turbidity',
  'salinity_ppt': 'salinity',
  'enterococcus_bacteria_mpn_100ml': 'bacteria',
  'temperature_c': 'temperature',
  'ph_su': 'pH',
  'secchi_depth_m': 'secchiDepth',
  'lab_chlorophyll_ug_l': 'chlorophyll',
  'specific_conductance_us_cm': 'conductivity',
};

// WQP characteristicName → PEARL key
const WQP_TO_PEARL: Record<string, string> = {
  'Dissolved oxygen (DO)': 'DO',
  'Dissolved Oxygen': 'DO',
  'pH': 'pH',
  'Turbidity': 'turbidity',
  'Total Nitrogen, mixed forms': 'TN',
  'Nitrogen': 'TN',
  'Nitrate': 'TN',
  'Total Phosphorus, mixed forms': 'TP',
  'Phosphorus': 'TP',
  'Total suspended solids': 'TSS',
  'Salinity': 'salinity',
  'Escherichia coli': 'bacteria',
  'Enterococcus': 'bacteria',
  'Temperature, water': 'temperature',
  'Chlorophyll a': 'chlorophyll',
  'Specific conductance': 'conductivity',
};

// USGS parameter codes → PEARL key
const USGS_PARAM_TO_PEARL: Record<string, string> = {
  '00300': 'DO',           // Dissolved oxygen, mg/L
  '00010': 'temperature',  // Temperature, water, °C
  '00400': 'pH',           // pH
  '00095': 'conductivity', // Specific conductance, µS/cm
  '63680': 'turbidity',    // Turbidity, FNU
  '00060': 'discharge',    // Discharge, ft³/s
  '00065': 'gageHeight',   // Gage height, ft
  '00480': 'salinity',     // Salinity, ppt
  '00600': 'TN',           // Total nitrogen, mg/L
  '00665': 'TP',           // Total phosphorus, mg/L
  '00076': 'turbidity',    // Turbidity, NTU (alternate code)
  '99133': 'nitrateNitrite', // Nitrate + nitrite, mg/L
};

// CEDEN analyte name → PEARL key
const CEDEN_TO_PEARL: Record<string, string> = {
  'Oxygen, Dissolved, Total': 'DO',
  'Oxygen, Dissolved': 'DO',
  'Temperature': 'temperature',
  'pH': 'pH',
  'Turbidity, Total': 'turbidity',
  'Turbidity': 'turbidity',
  'E. coli': 'bacteria',
  'Enterococcus': 'bacteria',
  'Enterococcus, Total': 'bacteria',
  'Coliform, Fecal': 'bacteria',
  'Nitrogen, Total': 'TN',
  'Nitrogen, Total Kjeldahl': 'TN',
  'Phosphorus as P': 'TP',
  'Phosphorus, Total': 'TP',
  'Chlorophyll a': 'chlorophyll',
  'SpecificConductivity': 'conductivity',
  'Specific Conductance': 'conductivity',
  'Salinity': 'salinity',
  'Total Suspended Solids': 'TSS',
  'Suspended Sediment Concentration': 'TSS',
};

// FIPS state code → state abbreviation (all 51 US states + DC)
const FIPS_TO_ABBR: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ParameterReading {
  pearlKey: string;
  value: number;
  unit: string;
  source: DataSourceId;
  stationName: string;
  lastSampled: string | null;
  parameterName: string;
}

export interface WaterDataResult {
  // Data by PEARL parameter key, with source attribution per-param
  parameters: Record<string, ParameterReading>;
  // Which sources provided data
  activeSources: DataSourceId[];
  // Primary source (most parameters)
  primarySource: DataSourceInfo;
  // Station info
  stationName: string;
  lastSampled: string | null;
  // All source details for the attribution panel
  sourceDetails: Array<{
    source: DataSourceInfo;
    parameterCount: number;
    stationName: string;
    lastSampled: string | null;
  }>;
}

export interface UseWaterDataResult {
  waterData: WaterDataResult | null;
  isLoading: boolean;
  error: string | null;
  hasRealData: boolean;
  primarySource: DataSourceInfo;
  refetch: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useWaterData(regionId: string | null): UseWaterDataResult {
  const [waterData, setWaterData] = useState<WaterDataResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [registryReady, setRegistryReady] = useState(!!_registryCache);

  // Trigger lazy load of station registry on mount
  useEffect(() => {
    if (!_registryCache) {
      loadRegistry().then(() => setRegistryReady(true));
    }
  }, []);

  const refetch = useCallback(() => setFetchTrigger(t => t + 1), []);

  const regionMeta = regionId ? REGION_META[regionId] : null;
  const bwbStation = regionId ? BWB_STATION_MAP[regionId] : null;

  useEffect(() => {
    if (!regionId || !regionMeta) {
      setWaterData(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      const allParams: Record<string, ParameterReading> = {};
      const sourceDetails: WaterDataResult['sourceDetails'] = [];
      const activeSources: DataSourceId[] = [];

      // ── Source 0: USGS Real-Time (Instantaneous Values) ─────────────────
      // 15-minute sensor data — highest priority, freshest readings
      if (regionMeta) {
        try {
          const knownSiteId = regionId ? USGS_SITE_MAP[regionId] : null;
          let fetchUrl: string;

          if (knownSiteId) {
            fetchUrl = `/api/water-data?action=usgs-site-iv&sites=${knownSiteId}&parameterCd=00300,00010,00400,00095,63680,00480,00600,00665&period=PT24H`;
          } else {
            const delta = 0.15;
            const bbox = `${regionMeta.lng - delta},${regionMeta.lat - delta},${regionMeta.lng + delta},${regionMeta.lat + delta}`;
            fetchUrl = `/api/water-data?action=usgs-iv&bBox=${bbox}&parameterCd=00300,00010,00400,00095,63680,00480,00600,00665&period=PT24H&siteType=ST,ES,LK`;
          }

          console.log(`[PEARL Source 0] USGS IV: ${fetchUrl.slice(0, 120)}...`);
          const controller = new AbortController();
          const ivTimer = setTimeout(() => controller.abort(), 12000);
          const res = await fetch(fetchUrl, { signal: controller.signal });
          clearTimeout(ivTimer);
          if (res.ok) {
            const json = await res.json();
            const timeSeries = json?.data?.value?.timeSeries || [];
            console.log(`[PEARL Source 0] USGS IV response: ${timeSeries.length} timeSeries`);
            let usgsStationName = 'USGS Sensor';
            let usgsLastTime: string | null = null;
            let count = 0;

            for (const ts of timeSeries) {
              const paramCode = ts?.variable?.variableCode?.[0]?.value;
              const pearlKey = paramCode ? USGS_PARAM_TO_PEARL[paramCode] : null;
              if (!pearlKey) continue;

              // Get the most recent value
              const values = ts?.values?.[0]?.value || [];
              const latest = values[values.length - 1];
              if (!latest || latest.value === '' || latest.value === '-999999') continue;

              const numValue = parseFloat(latest.value);
              if (isNaN(numValue)) continue;

              const stationName = ts?.sourceInfo?.siteName || 'USGS Sensor';
              const dateTime = latest.dateTime || null;

              if (!allParams[pearlKey]) {
                allParams[pearlKey] = {
                  pearlKey,
                  value: numValue,
                  unit: ts?.variable?.unit?.unitCode || '',
                  source: 'USGS',
                  stationName,
                  lastSampled: dateTime,
                  parameterName: ts?.variable?.variableName || paramCode,
                };
                count++;
                usgsStationName = stationName;
                if (dateTime) usgsLastTime = dateTime;
              }
            }

            if (count > 0) {
              activeSources.push('USGS');
              sourceDetails.push({
                source: DATA_SOURCES.USGS,
                parameterCount: count,
                stationName: usgsStationName,
                lastSampled: usgsLastTime,
              });
            }
          }
        } catch (e) {
          console.warn(`[PEARL Source 0] USGS IV failed:`, e instanceof Error ? e.message : e);
        }
      }

      // ── Source 1: BWB (Water Reporter) ──────────────────────────────────
      if (bwbStation) {
        try {
          const res = await fetch(
            `/api/water-data?action=parameters&dataset_id=${bwbStation.datasetId}&station_id=${bwbStation.stationId}`
          );
          if (res.ok) {
            const data = await res.json();
            const features = data.features || [];
            let count = 0;
            for (const p of features) {
              const pearlKey = WR_TO_PEARL[p.normalized_name];
              if (pearlKey && p.newest_value != null) {
                allParams[pearlKey] = {
                  pearlKey,
                  value: p.newest_value,
                  unit: p.unit || '',
                  source: 'BWB',
                  stationName: bwbStation.stationName,
                  lastSampled: p.last_sampled || bwbStation.lastSampled,
                  parameterName: p.name,
                };
                count++;
              }
            }
            if (count > 0) {
              activeSources.push('BWB');
              sourceDetails.push({
                source: DATA_SOURCES.BWB,
                parameterCount: count,
                stationName: bwbStation.stationName,
                lastSampled: bwbStation.lastSampled,
              });
            }
          }
        } catch (e) { /* BWB unavailable, continue to next source */ }
      }

      // ── Source 2: CBIBS — Chesapeake Bay real-time buoy data ─────────────
      // Replaces MARACOOS ERDDAP (frozen at 2018). Real-time temp, salinity, conductivity.
      // CBIBS stations: BH (Baltimore), AN (Annapolis), GR (Gooses Reef), PL (Potomac), YS (York Spit), SR (Stingray Point)
      const CBIBS_REGION_MAP: Record<string, string> = {
        'maryland_middle_branch':  'BH', 'maryland_inner_harbor': 'BH', 'maryland_patapsco_river': 'BH',
        'maryland_patapsco': 'BH', 'maryland_back_river': 'BH', 'maryland_bear_creek': 'BH',
        'maryland_curtis_bay': 'BH', 'maryland_stony_creek': 'BH', 'maryland_canton': 'BH',
        'maryland_jones_falls': 'BH', 'maryland_gwynns_falls': 'BH', 'maryland_gunpowder': 'BH',
        'baltimore': 'BH', 'upper_bay': 'BH', 'gunpowder': 'BH',
        'maryland_severn_river': 'AN', 'maryland_severn': 'AN', 'maryland_magothy_river': 'AN',
        'maryland_magothy': 'AN', 'annapolis': 'AN', 'chesapeake_bay_main': 'AN',
        'maryland_choptank_river': 'GR', 'maryland_choptank': 'GR',
        'maryland_chester_river': 'GR', 'maryland_chester': 'GR',
        'maryland_potomac': 'PL', 'dc_potomac': 'PL', 'patuxent': 'PL',
        'virginia_york_river': 'YS', 'virginia_york': 'YS',
        'virginia_rappahannock': 'SR', 'virginia_rappahannock_tidal': 'SR',
      };

      const cbibsCode = CBIBS_REGION_MAP[regionId];
      if (cbibsCode && (!allParams['temperature'] || !allParams['salinity'])) {
        console.log(`[PEARL Source 2] CBIBS: querying station ${cbibsCode} for ${regionId}`);
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12000);
          const cbibsRes = await fetch(
            `/api/water-data?action=erddap-latest&region=${regionId}`,
            { signal: controller.signal }
          ).catch(() => null);
          clearTimeout(timer);

          if (cbibsRes?.ok) {
            const json = await cbibsRes.json();
            const rows = Array.isArray(json?.data) ? json.data : [];
            if (rows.length > 0) {
              const row = rows[0];
              const cbibsTime = row.time || null;
              const stationName = `CBIBS ${json?.station || cbibsCode}`;

              // Temperature (°C)
              const tempVal = parseFloat(row.sea_water_temperature);
              if (!isNaN(tempVal) && tempVal > -5 && !allParams['temperature']) {
                allParams['temperature'] = {
                  pearlKey: 'temperature', value: tempVal, unit: '°C',
                  source: 'ERDDAP', stationName, lastSampled: cbibsTime, parameterName: 'Water Temperature',
                };
              }

              // Salinity (PSU)
              const salVal = parseFloat(row.sea_water_salinity);
              if (!isNaN(salVal) && salVal >= 0 && !allParams['salinity']) {
                allParams['salinity'] = {
                  pearlKey: 'salinity', value: salVal, unit: 'PSU',
                  source: 'ERDDAP', stationName, lastSampled: cbibsTime, parameterName: 'Salinity',
                };
              }

              // Conductivity (S/m → convert to µS/cm)
              const condVal = parseFloat(row.sea_water_electrical_conductivity);
              if (!isNaN(condVal) && condVal > 0 && !allParams['conductivity']) {
                allParams['conductivity'] = {
                  pearlKey: 'conductivity', value: condVal * 10000, unit: 'µS/cm',
                  source: 'ERDDAP', stationName, lastSampled: cbibsTime, parameterName: 'Conductivity',
                };
              }

              const erddapCount = Object.values(allParams).filter(p => p.source === 'ERDDAP').length;
              if (erddapCount > 0) {
                activeSources.push('ERDDAP');
                sourceDetails.push({
                  source: DATA_SOURCES.ERDDAP,
                  parameterCount: erddapCount,
                  stationName,
                  lastSampled: cbibsTime,
                });
                console.log(`[PEARL Source 2] CBIBS: filled ${erddapCount} params from ${stationName}`);
              }
            }
          }
        } catch (e) {
          console.warn(`[PEARL Source 2] CBIBS failed:`, e instanceof Error ? e.message : e);
        }
      }

      // ── Source 3: Monitor My Watershed — citizen science sensor data ────────
      // EnviroDIY/Stroud Research Center network — query by lat/lng proximity
      const mmwMissingKeys = ['DO', 'temperature', 'pH', 'conductivity', 'turbidity'].filter(k => !allParams[k]);
      if (mmwMissingKeys.length > 0 && regionMeta) {
        try {
          const MMW_PARAM_TO_PEARL: Record<string, string> = {
            'Dissolved Oxygen': 'DO',
            'Temperature': 'temperature',
            'pH': 'pH',
            'Electrical Conductivity': 'conductivity',
            'Specific Conductance': 'conductivity',
            'Turbidity': 'turbidity',
          };

          const controller = new AbortController();
          const mmwTimer = setTimeout(() => controller.abort(), 10000);
          const mmwRes = await fetch(
            `/api/water-data?action=mmw-latest&lat=${regionMeta.lat}&lng=${regionMeta.lng}&radius=25`,
            { signal: controller.signal }
          ).catch(() => null);
          clearTimeout(mmwTimer);

          if (mmwRes?.ok) {
            const mmwJson = await mmwRes.json().catch(() => null);
            if (!mmwJson) { console.warn('[PEARL Source 3] MMW returned invalid JSON'); }
            const results = mmwJson?.data || [];
            let mmwCount = 0;
            let mmwStationName = 'MMW Station';
            let mmwLastTime: string | null = null;

            for (const r of results) {
              const paramName = r.variable_name || r.variableName || '';
              const pearlKey = MMW_PARAM_TO_PEARL[paramName];
              if (!pearlKey || allParams[pearlKey]) continue;

              const value = parseFloat(r.value ?? r.dataValue ?? '');
              if (isNaN(value)) continue;

              mmwStationName = r.station_name || r.siteName || 'MMW Station';
              mmwLastTime = r.datetime || r.timestamp || null;
              allParams[pearlKey] = {
                pearlKey,
                value,
                unit: r.unit || r.variableUnitsAbbreviation || '',
                source: 'MMW',
                stationName: mmwStationName,
                lastSampled: mmwLastTime,
                parameterName: paramName,
              };
              mmwCount++;
            }

            if (mmwCount > 0) {
              activeSources.push('MMW');
              sourceDetails.push({
                source: DATA_SOURCES.MMW,
                parameterCount: mmwCount,
                stationName: mmwStationName,
                lastSampled: mmwLastTime,
              });
              console.log(`[PEARL Source 3] MMW: filled ${mmwCount} params`);
            }
          }
        } catch (e) {
          console.warn(`[PEARL Source 3] MMW failed:`, e instanceof Error ? e.message : e);
        }
      }

      // ── Source 4: NOAA CO-OPS — Water temp, conductivity for tidal stations ──
      // Key MD stations: 8574680 (Baltimore), 8575512 (Annapolis), 8577330 (Solomons),
      //   8573364 (Tolchester), 8571892 (Cambridge), 8573927 (Chesapeake City), 8570283 (Ocean City)
      const BALT = { stationId: '8574680', name: 'Baltimore (Fort McHenry)' };
      const ANNP = { stationId: '8575512', name: 'Annapolis' };
      const SOLM = { stationId: '8577330', name: 'Solomons Island' };
      const TOLC = { stationId: '8573364', name: 'Tolchester Beach' };
      const CAMB = { stationId: '8571892', name: 'Cambridge' };
      const CHCY = { stationId: '8573927', name: 'Chesapeake City' };
      const OCCI = { stationId: '8570283', name: 'Ocean City Inlet' };
      const HDGR = { stationId: '8574070', name: 'Havre de Grace' };

      const COOPS_STATION_MAP: Record<string, { stationId: string; name: string }> = {
        // Baltimore Harbor & tributaries → Baltimore station
        'maryland_middle_branch':  BALT,
        'maryland_inner_harbor':   BALT,
        'maryland_back_river':     BALT,
        'maryland_bear_creek':     BALT,
        'maryland_curtis_bay':     BALT,
        'maryland_patapsco_river': BALT,
        'maryland_patapsco':       BALT,
        'maryland_stony_creek':    BALT,
        'maryland_canton':         BALT,
        'maryland_ferry_bar':      BALT,
        'maryland_ft_mchenry':     BALT,
        'maryland_curtis_creek':   BALT,
        'maryland_bodkin_creek':   BALT,
        'maryland_rock_creek':     BALT,
        'maryland_jones_falls':    BALT,
        'maryland_gwynns_falls':   BALT,
        'maryland_gunpowder':      HDGR,
        'baltimore':               BALT,
        // Western Shore → Annapolis or Solomons
        'maryland_severn_river':   ANNP,
        'maryland_severn':         ANNP,
        'maryland_south_river':    ANNP,
        'maryland_magothy_river':  ANNP,
        'maryland_magothy':        ANNP,
        'maryland_rock_creek_aa':  ANNP,
        'annapolis':               ANNP,
        'maryland_patuxent_river': SOLM,
        'maryland_patuxent':       SOLM,
        'maryland_potomac':        { stationId: '8594900', name: 'Washington, DC' },
        'chesapeake_bay_main':     ANNP,
        'patuxent':                SOLM,
        // Upper Bay → Chesapeake City / Tolchester
        'maryland_sassafras_river': CHCY,
        'upper_bay':               CHCY,
        // Mid-Bay Eastern Shore → Tolchester / Cambridge
        'maryland_chester_river':  TOLC,
        'maryland_chester':        TOLC,
        'lower_bay':               TOLC,
        'maryland_choptank_river': CAMB,
        'maryland_choptank':       CAMB,
        'cambridge':               CAMB,
        // Lower Eastern Shore → Cambridge
        'maryland_nanticoke_river': CAMB,
        'maryland_wicomico_river':  CAMB,
        'maryland_pocomoke_river':  OCCI,
        // Coastal → Ocean City
        'coastal_bays':            OCCI,
        // Delaware → Delaware City / Lewes
        'delaware_christina_river':  { stationId: '8551762', name: 'Delaware City' },
        'delaware_christina':        { stationId: '8551762', name: 'Delaware City' },
        'delaware_brandywine':       { stationId: '8551762', name: 'Delaware City' },
        'delaware_appoquinimink':    { stationId: '8551762', name: 'Delaware City' },
        'delaware_red_clay':         { stationId: '8551762', name: 'Delaware City' },
        'delaware_st_jones':         { stationId: '8551910', name: 'Reedy Point' },
        'delaware_broadkill':        { stationId: '8557380', name: 'Lewes' },
        'delaware_indian_river':     { stationId: '8557380', name: 'Lewes' },
        'delaware_rehoboth_bay':     { stationId: '8557380', name: 'Lewes' },
        'delaware_nanticoke_de':     { stationId: '8571892', name: 'Cambridge' },
        // DC → Washington DC station
        'dc_potomac':                { stationId: '8594900', name: 'Washington, DC' },
        'dc_anacostia':              { stationId: '8594900', name: 'Washington, DC' },
        'dc_rock_creek':             { stationId: '8594900', name: 'Washington, DC' },
        'dc_oxon_run':               { stationId: '8594900', name: 'Washington, DC' },
        'dc_watts_branch':           { stationId: '8594900', name: 'Washington, DC' },
        'dc_hickey_run':             { stationId: '8594900', name: 'Washington, DC' },
        // Virginia → Sewells Point / CBBT
        'virginia_elizabeth':        { stationId: '8638610', name: 'Sewells Point' },
        'virginia_elizabeth_river':  { stationId: '8638610', name: 'Sewells Point' },
        'virginia_lynnhaven':        { stationId: '8638863', name: 'CBBT' },
        'virginia_back_bay':         { stationId: '8638863', name: 'CBBT' },
        'virginia_james_lower':      { stationId: '8638610', name: 'Sewells Point' },
        'virginia_james_river':      { stationId: '8638610', name: 'Sewells Point' },
        'virginia_james':            { stationId: '8638610', name: 'Sewells Point' },
        'virginia_york_river':       { stationId: '8637689', name: 'Yorktown' },
        'virginia_york':             { stationId: '8637689', name: 'Yorktown' },
        'virginia_rappahannock':     { stationId: '8635750', name: 'Lewisetta' },
        'virginia_rappahannock_tidal': { stationId: '8635750', name: 'Lewisetta' },
        // Florida — Gulf Coast tidal stations
        'florida_apalachicola':      { stationId: '8728690', name: 'Apalachicola' },
        'florida_tampa_bay':         { stationId: '8726607', name: 'Old Port Tampa' },
        'florida_charlotte_harbor':  { stationId: '8725520', name: 'Fort Myers' },
        'florida_pensacola_bay':     { stationId: '8729840', name: 'Pensacola' },
        'florida_escambia':          { stationId: '8729840', name: 'Pensacola' },
        // California — Pacific Coast tidal stations
        'california_sf_bay':         { stationId: '9414290', name: 'San Francisco' },
        'california_los_angeles':    { stationId: '9410660', name: 'Los Angeles' },
        'california_santa_monica':   { stationId: '9410660', name: 'Los Angeles' },
        'california_san_diego':      { stationId: '9410170', name: 'San Diego' },
        'california_sacramento':     { stationId: '9414523', name: 'Redwood City (South Bay)' },
      };

      const coopsStation = COOPS_STATION_MAP[regionId];
      if (coopsStation && (!allParams['temperature'] || !allParams['conductivity'])) {
        console.log(`[PEARL Source 4] CO-OPS: querying station ${coopsStation.stationId} (${coopsStation.name}) for ${regionId}`);
        try {
          const coopsProducts: { key: string; product: string }[] = [];
          if (!allParams['temperature'])  coopsProducts.push({ key: 'temperature', product: 'water_temperature' });
          if (!allParams['conductivity']) coopsProducts.push({ key: 'conductivity', product: 'conductivity' });

          const coopsResults = await Promise.all(
            coopsProducts.map(async ({ key, product }) => {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 12000);
              try {
                const res = await fetch(
                  `/api/water-data?action=coops-product&stationId=${coopsStation.stationId}&product=${product}`,
                  { signal: controller.signal }
                );
                clearTimeout(timeout);
                if (!res.ok) return null;
                const json = await res.json();
                // CO-OPS returns { data: { data: [{ v: "12.3", t: "2026-02-15 14:00" }] } }
                // or { data: [{ v: "12.3", t: "..." }] } depending on product
                const readings = json?.data?.data || json?.data || [];
                if (readings.length > 0) {
                  const latest = readings[readings.length - 1];
                  const val = parseFloat(latest.v);
                  if (!isNaN(val)) {
                    return { key, value: val, time: latest.t || '' };
                  }
                }
                return null;
              } catch { clearTimeout(timeout); return null; }
            })
          );

          let coopsCount = 0;
          let coopsTime = '';
          console.log(`[PEARL Source 4] CO-OPS results:`, coopsResults.map(r => r ? `${r.key}=${r.value}` : 'null'));
          for (const r of coopsResults) {
            if (r) {
              allParams[r.key] = { pearlKey: r.key, value: r.value, unit: r.key === 'temperature' ? '°C' : 'uS/cm', source: 'NOAA', stationName: coopsStation.name, lastSampled: r.time || coopsTime || null, parameterName: r.key };
              coopsCount++;
              if (r.time) coopsTime = r.time;
            }
          }

          if (coopsCount > 0) {
            activeSources.push('NOAA');
            sourceDetails.push({
              source: DATA_SOURCES.NOAA,
              parameterCount: coopsCount,
              stationName: coopsStation.name,
              lastSampled: coopsTime,
            });
          }
        } catch (e) {
          console.warn(`[PEARL Source 4] CO-OPS failed:`, e instanceof Error ? e.message : e);
        }
      }

      // ── Source 4: USGS Samples API — discrete WQ with national coverage ──
      // Uses known station IDs or lat/lng proximity search
      const missingKeys = ['DO', 'TN', 'TP', 'turbidity', 'TSS', 'pH', 'temperature'].filter(k => !allParams[k]);
      const samplesSiteId = USGS_SITE_MAP[regionId];
      if (missingKeys.length > 0 && (samplesSiteId || regionMeta)) {
        try {
          const paramCodeMap: Record<string, string> = {
            DO: '00300',
            TN: '00600',
            TP: '00665',
            turbidity: '63680',
            TSS: '00530',
            pH: '00400',
            temperature: '00010',
          };

          const eighteenMonthsAgo = new Date();
          eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
          const startDate = eighteenMonthsAgo.toISOString().split('T')[0];

          // Helper: fetch with 8-second timeout
          const fetchWithTimeout = async (url: string, timeoutMs = 12000): Promise<Response | null> => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
              const res = await fetch(url, { signal: controller.signal });
              clearTimeout(timer);
              return res;
            } catch {
              clearTimeout(timer);
              return null;
            }
          };

          // Build base query — by station ID or by lat/lng proximity
          let baseQuery = '';
          if (samplesSiteId) {
            baseQuery = `monitoringLocationIdentifier=USGS-${samplesSiteId}`;
          } else if (regionMeta) {
            baseQuery = `pointLocationLatitude=${regionMeta.lat}&pointLocationLongitude=${regionMeta.lng}&pointLocationWithinMiles=15`;
          }

          // Fetch top 3 missing params in parallel
          const topMissing = missingKeys.slice(0, 3);
          const fetches = topMissing.map(async (key) => {
            const paramCode = paramCodeMap[key];
            if (!paramCode) return;
            const res = await fetchWithTimeout(
              `/api/water-data?action=usgs-samples&${baseQuery}` +
              `&usgsPCode=${paramCode}` +
              `&activityStartDateLower=${startDate}` +
              `&activityMediaName=Water`
            );
            if (!res || !res.ok) return;
            try {
              const json = await res.json();
              const results = Array.isArray(json?.data) ? json.data : [];
              if (results.length > 0) {
                // Sort by date descending to get most recent
                const sorted = results.sort((a: any, b: any) => {
                  const dateA = a['Activity Start Date'] || a.ActivityStartDate || '';
                  const dateB = b['Activity Start Date'] || b.ActivityStartDate || '';
                  return dateB.localeCompare(dateA);
                });
                const latest = sorted[0];
                // Narrow profile columns: Result Value, Activity Start Date, Monitoring Location Identifier, etc.
                const rawValue = latest['Result Value'] || latest.ResultMeasureValue || '';
                const value = parseFloat(rawValue);
                if (!isNaN(value) && !allParams[key]) {
                  allParams[key] = {
                    pearlKey: key,
                    value,
                    unit: latest['Result Unit'] || latest.ResultMeasure_MeasureUnitCode || '',
                    source: 'USGS',
                    stationName: (latest['Monitoring Location Identifier'] || latest.MonitoringLocationIdentifier || 'USGS Station').replace('USGS-', 'USGS '),
                    lastSampled: latest['Activity Start Date'] || latest.ActivityStartDate || null,
                    parameterName: latest['Characteristic Name'] || latest.CharacteristicName || key,
                  };
                }
              }
            } catch { /* parse error */ }
          });

          await Promise.allSettled(fetches);

          const usgsSamplesCount = Object.values(allParams).filter(p => p.source === 'USGS').length;
          if (usgsSamplesCount > 0 && !activeSources.includes('USGS')) {
            activeSources.push('USGS');
            const usgsSamplesParams = Object.values(allParams).filter(p => p.source === 'USGS');
            sourceDetails.push({
              source: DATA_SOURCES.USGS,
              parameterCount: usgsSamplesCount,
              stationName: usgsSamplesParams[0]?.stationName || 'USGS Station',
              lastSampled: usgsSamplesParams[0]?.lastSampled || null,
            });
          }
        } catch (e) {
          console.warn(`[PEARL Source 5] USGS Samples failed:`, e instanceof Error ? e.message : e);
        }
      }

      if (cancelled) return;

      // ── Source 6: USGS Daily Values — daily aggregates (min/max/mean) ──────
      // Uses OGC /dv endpoint for mean daily values (statistic_id=00003)
      // Only queries for params still missing after real-time + samples
      const dvMissingKeys = ['DO', 'temperature', 'pH', 'conductivity', 'turbidity', 'discharge'].filter(k => !allParams[k]);
      const dvSiteId = USGS_SITE_MAP[regionId];
      if (dvMissingKeys.length > 0 && dvSiteId) {
        try {
          const dvParamCodes: Record<string, string> = {
            DO: '00300', temperature: '00010', pH: '00400',
            conductivity: '00095', turbidity: '63680', discharge: '00060',
          };
          const codesToFetch = dvMissingKeys.map(k => dvParamCodes[k]).filter(Boolean);
          if (codesToFetch.length > 0) {
            const controller = new AbortController();
            const dvTimer = setTimeout(() => controller.abort(), 12000);
            const dvRes = await fetch(
              `/api/water-data?action=usgs-daily&monitoring_location_id=USGS-${dvSiteId}` +
              `&parameter_code=${codesToFetch.join(',')}` +
              `&statistic_id=00003&limit=50`,
              { signal: controller.signal }
            ).catch(() => null);
            clearTimeout(dvTimer);

            if (dvRes?.ok) {
              const dvJson = await dvRes.json();
              const features = dvJson?.data?.features || [];
              let dvCount = 0;

              for (const feat of features) {
                const props = feat.properties || feat;
                const paramCode = props.parameter_code || props.parameterCode || '';
                const pearlKey = USGS_PARAM_TO_PEARL[paramCode];
                if (!pearlKey || allParams[pearlKey]) continue;

                const value = parseFloat(props.value ?? props.result ?? '');
                if (isNaN(value)) continue;

                allParams[pearlKey] = {
                  pearlKey,
                  value,
                  unit: props.unit || '',
                  source: 'USGS_DV',
                  stationName: `USGS ${dvSiteId} (Daily)`,
                  lastSampled: props.time || props.datetime || null,
                  parameterName: pearlKey,
                };
                dvCount++;
              }

              if (dvCount > 0) {
                activeSources.push('USGS_DV');
                sourceDetails.push({
                  source: DATA_SOURCES.USGS_DV,
                  parameterCount: dvCount,
                  stationName: `USGS ${dvSiteId} (Daily)`,
                  lastSampled: Object.values(allParams).find(p => p.source === 'USGS_DV')?.lastSampled || null,
                });
                console.log(`[PEARL Source 6] USGS DV: filled ${dvCount} params`);
              }
            }
          }
        } catch (e) {
          console.warn(`[PEARL Source 6] USGS DV failed:`, e instanceof Error ? e.message : e);
        }
      }

      if (cancelled) return;

      // ── Source 7: Water Quality Portal — true multi-provider national WQ data ────
      // Queries waterqualitydata.us for EPA STORET + STEWARDS (state, tribal, local)
      // USGS data excluded since Source 4 already covers it
      // Strategy: Try pre-baked cache first (instant, 19 priority states), fall back to live API
      const wqpMissingKeys = ['DO', 'TN', 'TP', 'turbidity', 'TSS', 'pH', 'temperature', 'enterococcus', 'e_coli', 'fecal_coliform', 'chlorophyll_a', 'conductivity'].filter(k => !allParams[k]);
      if (wqpMissingKeys.length > 0 && regionMeta) {
        let wqpCacheHit = false;

        // 7a: Try WQP cache first (instant for pre-baked priority states)
        try {
          const cacheController = new AbortController();
          const cacheTimer = setTimeout(() => cacheController.abort(), 3000);
          const cacheRes = await fetch(
            `/api/water-data?action=wqp-cached&lat=${regionMeta.lat}&lng=${regionMeta.lng}`,
            { signal: cacheController.signal }
          ).catch(() => null);
          clearTimeout(cacheTimer);

          if (cacheRes?.ok) {
            const cacheJson = await cacheRes.json();
            if (cacheJson.cached === true && Array.isArray(cacheJson.data) && cacheJson.data.length > 0) {
              for (const rec of cacheJson.data) {
                if (rec.key && !allParams[rec.key]) {
                  allParams[rec.key] = {
                    pearlKey: rec.key,
                    value: rec.val,
                    unit: rec.unit || '',
                    source: 'WQP',
                    stationName: rec.name || rec.stn || 'WQP Station',
                    lastSampled: rec.date || null,
                    parameterName: rec.char || rec.key,
                  };
                }
              }
              const cachedCount = Object.values(allParams).filter(p => p.source === 'WQP').length;
              if (cachedCount > 0) {
                wqpCacheHit = true;
                activeSources.push('WQP');
                const wqpParams = Object.values(allParams).filter(p => p.source === 'WQP');
                sourceDetails.push({
                  source: DATA_SOURCES.WQP,
                  parameterCount: cachedCount,
                  stationName: wqpParams[0]?.stationName || 'WQP Station',
                  lastSampled: wqpParams[0]?.lastSampled || null,
                });
                console.log(`[PEARL Source 7] WQP cache hit: filled ${cachedCount} params`);
              }
            }
          }
        } catch { /* cache miss — fall through to live */ }

        // 7b: Live WQP fetch (fallback for cache miss / non-priority states)
        const wqpStillMissing = wqpMissingKeys.filter(k => !allParams[k]);
        if (!wqpCacheHit && wqpStillMissing.length > 0) {
          try {
            const wqpCharMap: Record<string, string> = {
              DO: 'Dissolved oxygen (DO)',
              TN: 'Nitrogen',
              TP: 'Phosphorus',
              turbidity: 'Turbidity',
              TSS: 'Total suspended solids',
              pH: 'pH',
              temperature: 'Temperature, water',
              enterococcus: 'Enterococcus',
              e_coli: 'Escherichia coli',
              fecal_coliform: 'Fecal Coliform',
              chlorophyll_a: 'Chlorophyll a',
              conductivity: 'Specific conductance',
            };

            const eighteenMonthsAgo = new Date();
            eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
            const wqpStartDate = eighteenMonthsAgo.toISOString().split('T')[0];

            const fetchWithTimeout = async (url: string, timeoutMs = 15000): Promise<Response | null> => {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), timeoutMs);
              try {
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timer);
                return res;
              } catch {
                clearTimeout(timer);
                return null;
              }
            };

            // Fetch top 4 missing params in parallel via lat/lng proximity
            const topWqpMissing = wqpStillMissing.slice(0, 4);
            const wqpFetches = topWqpMissing.map(async (key) => {
              const charName = wqpCharMap[key];
              if (!charName) return;
              const res = await fetchWithTimeout(
                `/api/water-data?action=wqp-results` +
                `&characteristicName=${encodeURIComponent(charName)}` +
                `&lat=${regionMeta.lat}&long=${regionMeta.lng}&within=15` +
                `&startDateLo=${wqpStartDate}` +
                `&sampleMedia=Water`
              );
              if (!res || !res.ok) return;
              try {
                const json = await res.json();
                const results = Array.isArray(json?.data) ? json.data : [];
                if (results.length > 0) {
                  const sorted = results.sort((a: any, b: any) => {
                    const dateA = a.ActivityStartDate || a['Activity Start Date'] || '';
                    const dateB = b.ActivityStartDate || b['Activity Start Date'] || '';
                    return dateB.localeCompare(dateA);
                  });
                  const latest = sorted[0];
                  const rawValue = latest.ResultMeasureValue || latest['ResultMeasure/MeasureValue'] || latest['Result Value'] || '';
                  const value = parseFloat(rawValue);
                  if (!isNaN(value) && !allParams[key]) {
                    const unit =
                      latest['ResultMeasure/MeasureUnitCode'] ||
                      latest['ResultMeasure.MeasureUnitCode'] ||
                      latest.ResultMeasure_MeasureUnitCode ||
                      latest['Result Unit'] || '';
                    const monLocName = latest.MonitoringLocationName || latest['Monitoring Location Name'] || '';
                    const monLocId = latest.MonitoringLocationIdentifier || latest['Monitoring Location Identifier'] || '';
                    const orgName = latest.OrganizationFormalName || latest['Organization Formal Name'] || '';
                    allParams[key] = {
                      pearlKey: key,
                      value,
                      unit,
                      source: 'WQP',
                      stationName: monLocName || monLocId || orgName || 'WQP Station',
                      lastSampled: latest.ActivityStartDate || latest['Activity Start Date'] || null,
                      parameterName: latest.CharacteristicName || latest['Characteristic Name'] || key,
                    };
                  }
                }
              } catch { /* parse error */ }
            });

            await Promise.allSettled(wqpFetches);

            const wqpCount = Object.values(allParams).filter(p => p.source === 'WQP').length;
            if (wqpCount > 0 && !activeSources.includes('WQP')) {
              activeSources.push('WQP');
              const wqpParams = Object.values(allParams).filter(p => p.source === 'WQP');
              sourceDetails.push({
                source: DATA_SOURCES.WQP,
                parameterCount: wqpCount,
                stationName: wqpParams[0]?.stationName || 'WQP Station',
                lastSampled: wqpParams[0]?.lastSampled || null,
              });
              console.log(`[PEARL Source 7] WQP live: filled ${wqpCount} params`);
            }
          } catch (e) {
            console.warn(`[PEARL Source 7] WQP live failed:`, e instanceof Error ? e.message : e);
          }
        }
      }

      if (cancelled) return;

      // ── Source 8: State Open Data Portals — state-specific WQ data ─────
      // Queries WQP-backed state adapters for all 51 US states + DC
      const stateCode = regionMeta?.stateCode?.split(':')?.[1] || '';
      const stateMissingKeys = ['DO', 'TN', 'TP', 'turbidity', 'TSS', 'pH', 'temperature'].filter(k => !allParams[k]);
      const stateAbbr = FIPS_TO_ABBR[stateCode] || '';
      if (stateMissingKeys.length > 0 && stateAbbr && regionMeta) {
        try {
          const controller = new AbortController();
          const stateTimer = setTimeout(() => controller.abort(), 12000);
          const stateRes = await fetch(
            `/api/water-data?action=state-portal&state=${stateAbbr}&lat=${regionMeta.lat}&lng=${regionMeta.lng}`,
            { signal: controller.signal }
          ).catch(() => null);
          clearTimeout(stateTimer);

          if (stateRes?.ok) {
            const stateJson = await stateRes.json();
            const stateResults = stateJson?.data || [];
            let stateCount = 0;
            let stateStationName = `${stateAbbr} Portal`;

            const STATE_PARAM_MAP: Record<string, string> = {
              'Dissolved Oxygen': 'DO', 'Dissolved oxygen': 'DO', 'DO': 'DO',
              'Temperature': 'temperature', 'Water Temperature': 'temperature',
              'pH': 'pH',
              'Turbidity': 'turbidity',
              'Total Nitrogen': 'TN', 'Nitrogen': 'TN',
              'Total Phosphorus': 'TP', 'Phosphorus': 'TP',
              'Total Suspended Solids': 'TSS', 'TSS': 'TSS',
            };

            for (const r of stateResults) {
              const paramName = r.parameter || r.characteristic || '';
              const pearlKey = STATE_PARAM_MAP[paramName];
              if (!pearlKey || allParams[pearlKey]) continue;

              const value = parseFloat(r.value ?? r.result ?? '');
              if (isNaN(value)) continue;

              stateStationName = r.station_name || r.siteName || `${stateAbbr} Portal`;
              allParams[pearlKey] = {
                pearlKey,
                value,
                unit: r.unit || '',
                source: 'STATE',
                stationName: stateStationName,
                lastSampled: r.date || r.datetime || null,
                parameterName: paramName,
              };
              stateCount++;
            }

            if (stateCount > 0) {
              activeSources.push('STATE');
              sourceDetails.push({
                source: DATA_SOURCES.STATE,
                parameterCount: stateCount,
                stationName: stateStationName,
                lastSampled: Object.values(allParams).find(p => p.source === 'STATE')?.lastSampled || null,
              });
              console.log(`[PEARL Source 8] State Portal: filled ${stateCount} params from ${stateAbbr}`);
            }
          }
        } catch (e) {
          console.warn(`[PEARL Source 8] State Portal failed:`, e instanceof Error ? e.message : e);
        }
      }

      if (cancelled) return;

      // ── Source 9: EPA Envirofacts — compliance enrichment (non-blocking) ──
      // SDWIS violations, TRI releases — not standard WQ parameters
      // Runs as enrichment alongside cascade, adds metadata to result
      if (regionMeta) {
        try {
          const efStateAbbr = FIPS_TO_ABBR[stateCode] || '';
          if (efStateAbbr) {
            const controller = new AbortController();
            const efTimer = setTimeout(() => controller.abort(), 10000);
            const efRes = await fetch(
              `/api/water-data?action=envirofacts-sdwis&state=${efStateAbbr}&limit=5`,
              { signal: controller.signal }
            ).catch(() => null);
            clearTimeout(efTimer);

            if (efRes?.ok) {
              const efJson = await efRes.json();
              const violations = efJson?.data || [];
              if (violations.length > 0) {
                // Store as special enrichment parameter (not a standard WQ measurement)
                allParams['_epa_violations'] = {
                  pearlKey: '_epa_violations',
                  value: violations.length,
                  unit: 'violations',
                  source: 'EPA_EF',
                  stationName: `EPA Envirofacts (${efStateAbbr})`,
                  lastSampled: new Date().toISOString(),
                  parameterName: 'SDWIS Violations',
                };
                if (!activeSources.includes('EPA_EF')) {
                  activeSources.push('EPA_EF');
                  sourceDetails.push({
                    source: DATA_SOURCES.EPA_EF,
                    parameterCount: 1,
                    stationName: `EPA Envirofacts (${efStateAbbr})`,
                    lastSampled: new Date().toISOString(),
                  });
                }
                console.log(`[PEARL Source 9] EPA_EF: ${violations.length} SDWIS violations for ${efStateAbbr}`);
              }
            }
          }
        } catch (e) {
          console.warn(`[PEARL Source 9] EPA_EF failed:`, e instanceof Error ? e.message : e);
        }
      }

      if (cancelled) return;

      // ── Source 9b: CBP DataHub Enrichment — Chesapeake watershed only ───
      // Fluorescence, Point Source, Toxics, Benthic IBI
      // Only fires for HUC8 codes in Chesapeake Bay watershed (0206xxxx, 0207xxxx)
      const huc8 = regionMeta?.huc8 || '';
      const isChesapeakeWatershed = huc8.startsWith('0206') || huc8.startsWith('0207');
      if (isChesapeakeWatershed && regionMeta) {
        try {
          const stateFipsToAbbr2: Record<string, string> = { '24': 'MD', '51': 'VA', '06': 'CA', '11': 'DC', '10': 'DE', '42': 'PA', '36': 'NY', '54': 'WV', '12': 'FL' };
          const cbpStateAbbr = stateFipsToAbbr2[stateCode] || 'MD';
          const now = new Date();
          const twoYrsAgo = `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear() - 2}`;
          const fiveYrsAgo = `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear() - 5}`;
          const today = `${now.getMonth() + 1}-${now.getDate()}-${now.getFullYear()}`;

          const cbpFetches = [
            // Fluorescence (chlorophyll profiles)
            fetch(`/api/water-data?action=cbp-fluorescence&huc8=${huc8}&startDate=${twoYrsAgo}&endDate=${today}&direction=Vertical`, { signal: AbortSignal.timeout(10000) }).catch(() => null),
            // Point Source facilities
            fetch(`/api/water-data?action=cbp-pointsource-facilities&state=${cbpStateAbbr}`, { signal: AbortSignal.timeout(10000) }).catch(() => null),
            // Toxics
            fetch(`/api/water-data?action=cbp-toxics&huc8=${huc8}&startDate=${fiveYrsAgo}&endDate=${today}`, { signal: AbortSignal.timeout(10000) }).catch(() => null),
            // Benthic IBI
            fetch(`/api/water-data?action=cbp-livingresources&huc8=${huc8}&startDate=${fiveYrsAgo}&endDate=${today}`, { signal: AbortSignal.timeout(10000) }).catch(() => null),
          ];

          const [fluorRes, psRes, toxRes, benRes] = await Promise.allSettled(cbpFetches);
          let cbpEnrichCount = 0;

          // Fluorescence
          if (fluorRes.status === 'fulfilled' && fluorRes.value?.ok) {
            const fJson = await fluorRes.value.json().catch(() => null);
            const records = Array.isArray(fJson?.data) ? fJson.data : [];
            if (records.length > 0) {
              const latest = records[records.length - 1];
              allParams['_cbp_fluorescence'] = {
                pearlKey: '_cbp_fluorescence',
                value: latest.ReportingValue ?? latest.reportingValue ?? records.length,
                unit: 'UG/L',
                source: 'CBP',
                stationName: `CBP Fluorescence (${huc8})`,
                lastSampled: latest.SampleDate || latest.sampleDate || new Date().toISOString(),
                parameterName: 'Chlorophyll Fluorescence (CHL_F)',
              };
              cbpEnrichCount++;
            }
          }

          // Point Source
          if (psRes.status === 'fulfilled' && psRes.value?.ok) {
            const psJson = await psRes.value.json().catch(() => null);
            const facilities = Array.isArray(psJson?.data) ? psJson.data : [];
            if (facilities.length > 0) {
              const active = facilities.filter((f: any) => f.Status === 'Active' || f.status === 'Active');
              allParams['_cbp_pointsource'] = {
                pearlKey: '_cbp_pointsource',
                value: active.length || facilities.length,
                unit: 'facilities',
                source: 'CBP',
                stationName: `CBP Point Source (${cbpStateAbbr})`,
                lastSampled: new Date().toISOString(),
                parameterName: 'Point Source Facilities',
              };
              cbpEnrichCount++;
            }
          }

          // Toxics
          if (toxRes.status === 'fulfilled' && toxRes.value?.ok) {
            const txJson = await toxRes.value.json().catch(() => null);
            const samples = Array.isArray(txJson?.data) ? txJson.data : [];
            if (samples.length > 0) {
              allParams['_cbp_toxics'] = {
                pearlKey: '_cbp_toxics',
                value: samples.length,
                unit: 'samples',
                source: 'CBP',
                stationName: `CBP Toxics (${huc8})`,
                lastSampled: new Date().toISOString(),
                parameterName: 'Contaminant Monitoring',
              };
              cbpEnrichCount++;
            }
          }

          // Benthic IBI
          if (benRes.status === 'fulfilled' && benRes.value?.ok) {
            const bnJson = await benRes.value.json().catch(() => null);
            const records = Array.isArray(bnJson?.data) ? bnJson.data : [];
            if (records.length > 0) {
              const latest = records[records.length - 1];
              allParams['_cbp_benthic'] = {
                pearlKey: '_cbp_benthic',
                value: latest.IBIScore ?? latest.ibiScore ?? latest.IBI ?? records.length,
                unit: 'IBI score',
                source: 'CBP',
                stationName: `CBP Benthic (${huc8})`,
                lastSampled: latest.SampleDate || latest.sampleDate || new Date().toISOString(),
                parameterName: 'Benthic Index of Biotic Integrity',
              };
              cbpEnrichCount++;
            }
          }

          if (cbpEnrichCount > 0 && !activeSources.includes('CBP')) {
            activeSources.push('CBP');
            sourceDetails.push({
              source: DATA_SOURCES.CBP,
              parameterCount: cbpEnrichCount,
              stationName: `CBP DataHub (${huc8})`,
              lastSampled: new Date().toISOString(),
            });
          }
          console.log(`[PEARL Source 9b] CBP DataHub: ${cbpEnrichCount} enrichment params for HUC8 ${huc8}`);
        } catch (e) {
          console.warn(`[PEARL Source 9b] CBP DataHub enrichment failed:`, e instanceof Error ? e.message : e);
        }
      }

      if (cancelled) return;

      // ── Source 9c: CEDEN — California state WQ data (chemistry + toxicity) ──
      // Cache-first: reads from data/ceden-cache.json (built by scripts/ceden_cache.py)
      // Falls back to live data.ca.gov API on cache miss
      // Only fires for California (FIPS 06)
      const isCalifornia = stateCode === '06';
      if (isCalifornia && regionMeta) {
        try {
          const cedenLat = regionMeta.lat;
          const cedenLng = regionMeta.lng;
          let cedenCount = 0;
          let cedenStation = '';
          let cedenTime: string | null = null;
          let bacteriaTotal = 0;
          let bacteriaStation = '';
          let bacteriaTime: string | null = null;
          let chemRecords: any[] = [];
          let toxRecords: any[] = [];

          // Try cache first (instant — reads from local JSON)
          const cacheRes = await fetch(`/api/water-data?action=ceden-cached&lat=${cedenLat}&lng=${cedenLng}`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
          const cacheJson = cacheRes?.ok ? await cacheRes.json().catch(() => null) : null;

          if (cacheJson?.fromCache && (cacheJson.chemistry?.length > 0 || cacheJson.toxicity?.length > 0)) {
            // Cache hit — use pre-fetched data
            console.log(`[PEARL Source 9c] CEDEN cache hit: ${cacheJson.chemistry?.length || 0} chem, ${cacheJson.toxicity?.length || 0} tox`);
            // Normalize cache records to match live API field names
            chemRecords = (cacheJson.chemistry || []).map((r: any) => ({
              Analyte: r.analyte, Result: r.val, Unit: r.unit,
              StationName: r.name, SampleDate: r.date, pearl_key: r.key,
              Latitude: r.lat, Longitude: r.lng,
            }));
            toxRecords = (cacheJson.toxicity || []).map((r: any) => ({
              StationName: r.name, SampleDate: r.date, OrganismName: r.organism,
              Analyte: r.analyte, Result: r.val, Mean: r.mean,
              SigEffectCode: r.sig, Unit: r.unit,
            }));
          } else {
            // Cache miss — fall back to live API
            console.log(`[PEARL Source 9c] CEDEN cache miss, falling back to live API`);
            const cedenFetches = [
              fetch(`/api/water-data?action=ceden-chemistry&lat=${cedenLat}&lng=${cedenLng}`, { signal: AbortSignal.timeout(12000) }).catch(() => null),
              fetch(`/api/water-data?action=ceden-toxicity&lat=${cedenLat}&lng=${cedenLng}`, { signal: AbortSignal.timeout(12000) }).catch(() => null),
            ];
            const [chemRes, toxRes] = await Promise.allSettled(cedenFetches);
            if (chemRes.status === 'fulfilled' && chemRes.value?.ok) {
              const cJson = await chemRes.value.json().catch(() => null);
              chemRecords = Array.isArray(cJson?.data) ? cJson.data : [];
            }
            if (toxRes.status === 'fulfilled' && toxRes.value?.ok) {
              const tJson = await toxRes.value.json().catch(() => null);
              toxRecords = Array.isArray(tJson?.data) ? tJson.data : [];
            }
          }

          // Process chemistry records → fill standard PEARL params + count bacteria
          const seen = new Set<string>();
          for (const r of chemRecords) {
            const analyte = r.Analyte || r.analyte || '';
            const pearlKey = r.pearl_key || CEDEN_TO_PEARL[analyte];
            if (!pearlKey) continue;

            // Count bacteria indicators for meta-param
            if (['E. coli', 'Enterococcus', 'Enterococcus, Total', 'Coliform, Fecal', 'Coliform, Total'].includes(analyte)) {
              bacteriaTotal++;
              if (!bacteriaStation) bacteriaStation = r.StationName || r.stationName || '';
              if (!bacteriaTime) bacteriaTime = r.SampleDate || r.sampleDate || null;
            }

            if (seen.has(pearlKey)) continue;
            seen.add(pearlKey);

            const value = parseFloat(r.Result ?? r.result ?? '');
            if (isNaN(value)) continue;

            if (!cedenStation) cedenStation = r.StationName || r.stationName || 'CEDEN Station';
            if (!cedenTime) cedenTime = r.SampleDate || r.sampleDate || null;

            // Only fill gaps — don't overwrite upstream sources
            if (!allParams[pearlKey]) {
              allParams[pearlKey] = {
                pearlKey,
                value,
                unit: r.Unit || r.unit || '',
                source: 'CEDEN',
                stationName: r.StationName || r.stationName || 'CEDEN Station',
                lastSampled: r.SampleDate || r.sampleDate || null,
                parameterName: analyte,
              };
              cedenCount++;
            }
          }

          // Store bacteria indicator meta-param
          if (bacteriaTotal > 0) {
            allParams['_ceden_bacteria'] = {
              pearlKey: '_ceden_bacteria',
              value: bacteriaTotal,
              unit: 'samples',
              source: 'CEDEN',
              stationName: bacteriaStation || cedenStation || 'CEDEN',
              lastSampled: bacteriaTime || cedenTime,
              parameterName: 'Bacteria Indicators (E.coli, Enterococcus, Coliform)',
            };
            cedenCount++;
          }

          // Toxicity results → store as meta-param
          if (toxRecords.length > 0) {
            const latest = toxRecords[0];
            allParams['_ceden_toxicity'] = {
              pearlKey: '_ceden_toxicity',
              value: toxRecords.length,
              unit: 'tests',
              source: 'CEDEN',
              stationName: latest.StationName || latest.stationName || 'CEDEN Toxicity',
              lastSampled: latest.SampleDate || latest.sampleDate || null,
              parameterName: `Toxicity: ${latest.OrganismName || latest.organismName || 'organism'} — ${latest.SigEffectCode || latest.sigEffectCode || 'N/A'}`,
            };
            cedenCount++;
          }

          if (cedenCount > 0 && !activeSources.includes('CEDEN')) {
            activeSources.push('CEDEN');
            sourceDetails.push({
              source: DATA_SOURCES.CEDEN,
              parameterCount: cedenCount,
              stationName: cedenStation || 'CEDEN (CA Open Data)',
              lastSampled: cedenTime || new Date().toISOString(),
            });
          }
          console.log(`[PEARL Source 9c] CEDEN: ${cedenCount} params for CA location (${cedenLat}, ${cedenLng})`);
        } catch (e) {
          console.warn(`[PEARL Source 9c] CEDEN enrichment failed:`, e instanceof Error ? e.message : e);
        }
      }

      if (cancelled) return;

      // ── Source 10: Reference Data (agency reports fallback) ─────────────
      // If live sources returned nothing or are sparse, fill from reference data
      const refEntry = regionId ? REFERENCE_DATA[regionId] : null;
      if (refEntry) {
        let refCount = 0;
        for (const [key, reading] of Object.entries(refEntry.parameters)) {
          if (!allParams[key]) {
            allParams[key] = {
              pearlKey: key,
              value: reading.value,
              unit: reading.unit,
              source: 'REFERENCE',
              stationName: refEntry.source,
              lastSampled: reading.reportDate,
              parameterName: key,
            };
            refCount++;
          }
        }
        if (refCount > 0) {
          activeSources.push('REFERENCE');
          sourceDetails.push({
            source: DATA_SOURCES.REFERENCE,
            parameterCount: refCount,
            stationName: refEntry.source,
            lastSampled: refEntry.reportDate,
          });
          console.log(`[PEARL Source 10] Reference data: filled ${refCount} params from "${refEntry.source}" (${refEntry.reportDate})`);
        }
      }

      if (cancelled) return;

      // ── Build result ───────────────────────────────────────────────────
      console.log(`[PEARL] ${regionId} cascade complete:`, {
        sources: activeSources,
        params: Object.keys(allParams),
        paramCount: Object.keys(allParams).length,
        details: sourceDetails.map(s => `${s.source.id}(${s.parameterCount})`),
      });
      const hasRealData = Object.keys(allParams).length > 0;
      const hasLiveData = activeSources.some(s => s !== 'REFERENCE');
      const primarySourceId: DataSourceId = activeSources[0] || 'MOCK';

      const result: WaterDataResult = {
        parameters: allParams,
        activeSources,
        primarySource: DATA_SOURCES[primarySourceId],
        stationName: sourceDetails[0]?.stationName || regionMeta.name,
        lastSampled: sourceDetails[0]?.lastSampled || null,
        sourceDetails,
      };

      setWaterData(hasRealData ? result : null);
      if (!hasRealData) {
        setError('No real-time or reference data found — using modeled data');
      } else if (!hasLiveData) {
        // We have reference data but no live feeds
        setError(null); // Clear error — reference data is real, just not live
      }
    })()
      .catch(err => {
        if (!cancelled) {
          setError(err.message || 'Failed to fetch water data');
          setWaterData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [regionId, regionMeta, bwbStation, fetchTrigger]);

  return {
    waterData,
    isLoading,
    error,
    hasRealData: !!waterData && Object.keys(waterData.parameters).length > 0,
    primarySource: waterData?.primarySource || DATA_SOURCES.MOCK,
    refetch,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Check if a region has any real data source configured */
export function hasRealDataSource(regionId: string): boolean {
  return regionId in REGION_META;
}

/** Get all region IDs with metadata */
export function getAllMappedRegions(): string[] {
  return Object.keys(REGION_META);
}

/** Get source info by ID */
export function getSourceInfo(id: DataSourceId): DataSourceInfo {
  return DATA_SOURCES[id];
}

// ─── Registry-aware helpers ──────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  'US:01': 'Alabama', 'US:02': 'Alaska', 'US:04': 'Arizona', 'US:05': 'Arkansas',
  'US:06': 'California', 'US:08': 'Colorado', 'US:09': 'Connecticut', 'US:10': 'Delaware',
  'US:11': 'District of Columbia', 'US:12': 'Florida', 'US:13': 'Georgia', 'US:15': 'Hawaii',
  'US:16': 'Idaho', 'US:17': 'Illinois', 'US:18': 'Indiana', 'US:19': 'Iowa',
  'US:20': 'Kansas', 'US:21': 'Kentucky', 'US:22': 'Louisiana', 'US:23': 'Maine',
  'US:24': 'Maryland', 'US:25': 'Massachusetts', 'US:26': 'Michigan', 'US:27': 'Minnesota',
  'US:28': 'Mississippi', 'US:29': 'Missouri', 'US:30': 'Montana', 'US:31': 'Nebraska',
  'US:32': 'Nevada', 'US:33': 'New Hampshire', 'US:34': 'New Jersey', 'US:35': 'New Mexico',
  'US:36': 'New York', 'US:37': 'North Carolina', 'US:38': 'North Dakota', 'US:39': 'Ohio',
  'US:40': 'Oklahoma', 'US:41': 'Oregon', 'US:42': 'Pennsylvania', 'US:44': 'Rhode Island',
  'US:45': 'South Carolina', 'US:46': 'South Dakota', 'US:47': 'Tennessee', 'US:48': 'Texas',
  'US:49': 'Utah', 'US:50': 'Vermont', 'US:51': 'Virginia', 'US:53': 'Washington',
  'US:54': 'West Virginia', 'US:55': 'Wisconsin', 'US:56': 'Wyoming',
};

/** Get waterbodies for a state, sorted alphabetically */
export function getWaterbodiesByState(stateCode: string): { id: string; name: string }[] {
  return Object.entries(REGION_META)
    .filter(([_, meta]) => meta.stateCode === stateCode)
    .map(([id, meta]) => ({ id, name: meta.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Search waterbodies by name across all states */
export function searchWaterbodies(query: string, limit = 20): { id: string; name: string; state: string }[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return Object.entries(REGION_META)
    .filter(([_, meta]) => meta.name.toLowerCase().includes(q))
    .slice(0, limit)
    .map(([id, meta]) => ({
      id,
      name: meta.name,
      state: STATE_NAMES[meta.stateCode] || meta.stateCode,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Get all states that have waterbody data, with counts */
export function getStatesWithData(): { code: string; name: string; count: number }[] {
  const states = new Map<string, number>();
  for (const meta of Object.values(REGION_META)) {
    states.set(meta.stateCode, (states.get(meta.stateCode) || 0) + 1);
  }
  return Array.from(states.entries())
    .map(([code, count]) => ({ code, name: STATE_NAMES[code] || code, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Check if a waterbody has confirmed monitoring data in the registry */
export function hasConfirmedData(regionId: string): boolean {
  return getRegistryCoverage()[regionId]?.hasData ?? false;
}

/** Get data sources available for a waterbody */
export function getAvailableSources(regionId: string): string[] {
  return getRegistryCoverage()[regionId]?.sources ?? [];
}

// Comprehensive data source checker — used by NCC for waterbody classification
// Checks all source maps: USGS, BWB, registry, and known ERDDAP/COOPS regions
const ERDDAP_REGION_IDS = new Set([
  'maryland_patuxent_river','maryland_patuxent','maryland_chester_river','maryland_chester',
  'maryland_choptank_river','maryland_choptank','maryland_sassafras_river','maryland_back_river',
  'maryland_bear_creek','maryland_gunpowder','maryland_middle_branch','maryland_inner_harbor',
  'maryland_patapsco_river','maryland_patapsco','maryland_nanticoke_river','maryland_wicomico_river',
  'maryland_pocomoke_river','maryland_severn_river','maryland_severn','maryland_magothy_river',
  'maryland_magothy','maryland_rock_creek_aa','maryland_potomac','chesapeake_bay_main',
]);
const COOPS_REGION_IDS = new Set([
  'maryland_middle_branch','maryland_inner_harbor','maryland_back_river','maryland_bear_creek',
  'maryland_curtis_bay','maryland_gwynns_falls','maryland_jones_falls','maryland_patapsco_river',
  'maryland_patapsco','maryland_stony_creek','maryland_canton','maryland_ferry_bar',
  'maryland_ft_mchenry','maryland_curtis_creek','maryland_bodkin_creek','maryland_rock_creek',
  'maryland_chester_river','maryland_chester','maryland_choptank_river','maryland_choptank',
  'maryland_nanticoke_river','maryland_patuxent_river','maryland_patuxent','maryland_severn_river',
  'maryland_severn','maryland_magothy_river','maryland_magothy','maryland_south_river',
  'maryland_sassafras_river','maryland_potomac','maryland_pocomoke_river','maryland_wicomico_river',
  'maryland_rock_creek_aa','dc_anacostia','dc_potomac','dc_rock_creek','dc_oxon_run',
  'dc_watts_branch','dc_hickey_run','virginia_elizabeth','virginia_elizabeth_river',
  'virginia_james','virginia_james_lower','virginia_james_river','virginia_lynnhaven',
  'virginia_rappahannock','virginia_rappahannock_tidal','virginia_york','virginia_york_river',
  'virginia_back_bay','delaware_christina','delaware_christina_river','delaware_brandywine',
  'delaware_st_jones','delaware_red_clay','delaware_appoquinimink',
  'florida_escambia','florida_pensacola_bay','florida_tampa_bay','florida_charlotte_harbor',
  'florida_apalachicola','california_sf_bay','california_los_angeles','california_san_diego',
  'california_santa_monica','california_sacramento',
]);

export function getWaterbodyDataSources(regionId: string): string[] {
  const sources: string[] = [];
  if (USGS_SITE_MAP[regionId]) sources.push('USGS');
  if (BWB_STATION_MAP[regionId]) sources.push('BWB');
  if (ERDDAP_REGION_IDS.has(regionId)) sources.push('ERDDAP');
  if (COOPS_REGION_IDS.has(regionId)) sources.push('NOAA');
  // Registry-discovered sources (WQP etc)
  const regSources = getRegistryCoverage()[regionId]?.sources ?? [];
  for (const s of regSources) {
    if (!sources.includes(s)) sources.push(s);
  }
  return sources;
}

export function getWaterbodyStatus(regionId: string): 'monitored' | 'unmonitored' {
  return getWaterbodyDataSources(regionId).length > 0 ? 'monitored' : 'unmonitored';
}
