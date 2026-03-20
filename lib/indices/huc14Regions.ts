/**
 * HUC-14 High-Value Regions Identification
 *
 * Defines and manages critical regions that warrant sub-subwatershed analysis
 * for premium PIN Precision+ intelligence services.
 */

export interface HighValueRegion {
  id: string;
  name: string;
  type: 'metropolitan' | 'infrastructure' | 'superfund' | 'military';
  priority: 'critical' | 'high' | 'medium';
  huc12Coverage: string[]; // Parent HUC-12s containing this region
  huc14List?: string[]; // Specific HUC-14s if mapped
  geometry?: {
    type: 'Polygon' | 'Point';
    coordinates: number[][] | number[];
  };
  description: string;
  stakeholders: string[];
  riskFactors: string[];
  premiumTier: boolean;
}

/**
 * Major Metropolitan Areas (Population > 1M + Critical Water Infrastructure)
 */
const METRO_REGIONS: HighValueRegion[] = [
  {
    id: 'nyc-metro',
    name: 'New York Metropolitan Area',
    type: 'metropolitan',
    priority: 'critical',
    huc12Coverage: ['020302060901', '020302060902', '020302060903', '020302060904'],
    description: 'NYC water supply watersheds, Hudson River corridor, 20M+ population',
    stakeholders: ['DEP NYC', 'EPA Region 2', 'NYSDEC', 'Port Authority'],
    riskFactors: ['Population density', 'Industrial discharge', 'Legacy contamination', 'Climate flooding'],
    premiumTier: true
  },
  {
    id: 'la-basin',
    name: 'Los Angeles Basin',
    type: 'metropolitan',
    priority: 'critical',
    huc12Coverage: ['180701021201', '180701021202', '180701021203'],
    description: 'LA River watershed, coastal drainage, 15M+ population, water scarcity',
    stakeholders: ['LA Sanitation', 'EPA Region 9', 'SWRCB', 'Metropolitan Water District'],
    riskFactors: ['Water scarcity', 'Urban runoff', 'Groundwater contamination', 'Wildfire ash'],
    premiumTier: true
  },
  {
    id: 'chicago-metro',
    name: 'Chicago Metropolitan Area',
    type: 'metropolitan',
    priority: 'critical',
    huc12Coverage: ['071200031201', '071200031202', '071200031203'],
    description: 'Lake Michigan watershed, Great Lakes water supply, 10M+ population',
    stakeholders: ['Chicago Water Mgmt', 'EPA Region 5', 'IEPA', 'MWRD'],
    riskFactors: ['Great Lakes contamination', 'Combined sewer overflows', 'Industrial legacy'],
    premiumTier: true
  },
  {
    id: 'dc-metro',
    name: 'Washington DC Metropolitan Area',
    type: 'metropolitan',
    priority: 'critical',
    huc12Coverage: ['020700100801', '020700100802'],
    description: 'Potomac River watershed, federal facilities, 7M+ population',
    stakeholders: ['DC Water', 'EPA HQ', 'WSSC', 'Fairfax Water'],
    riskFactors: ['Federal security', 'Potomac contamination', 'Urban density'],
    premiumTier: true
  },
  {
    id: 'baltimore-metro',
    name: 'Baltimore Metropolitan Area',
    type: 'metropolitan',
    priority: 'critical',
    huc12Coverage: ['020600020401', '020600020402', '020600020403'],
    description: 'Chesapeake Bay watershed, Port of Baltimore, 3M+ population, steel industry legacy',
    stakeholders: ['Baltimore Water', 'EPA Region 3', 'MD MDE', 'Port of Baltimore'],
    riskFactors: ['Industrial legacy contamination', 'Combined sewer overflows', 'Chesapeake Bay impacts', 'Urban runoff'],
    premiumTier: true
  },
  {
    id: 'philadelphia-metro',
    name: 'Philadelphia Metropolitan Area',
    type: 'metropolitan',
    priority: 'critical',
    huc12Coverage: ['020402020201', '020402020202', '020402020203'],
    description: 'Delaware River watershed, 6M+ population, industrial corridor',
    stakeholders: ['Philadelphia Water', 'EPA Region 3', 'PADEP', 'Delaware River Basin Commission'],
    riskFactors: ['Industrial discharge', 'Combined sewers', 'Legacy contamination', 'Delaware River pollution'],
    premiumTier: true
  },
  {
    id: 'virginia-beach-metro',
    name: 'Virginia Beach-Norfolk Metropolitan Area',
    type: 'metropolitan',
    priority: 'high',
    huc12Coverage: ['030102000301', '030102000302'],
    description: 'Hampton Roads, naval facilities, Chesapeake Bay mouth, 1.8M+ population',
    stakeholders: ['Norfolk Water', 'EPA Region 3', 'VA DEQ', 'US Navy'],
    riskFactors: ['Military contamination', 'Coastal flooding', 'Agricultural runoff', 'Chesapeake Bay discharge'],
    premiumTier: true
  }
];

/**
 * Critical Infrastructure Corridors
 */
const INFRASTRUCTURE_CORRIDORS: HighValueRegion[] = [
  {
    id: 'houston-ship-channel',
    name: 'Houston Ship Channel',
    type: 'infrastructure',
    priority: 'critical',
    huc12Coverage: ['120400031001', '120400031002'],
    description: 'Largest petrochemical complex in US, Port of Houston',
    stakeholders: ['Port of Houston', 'EPA Region 6', 'TCEQ', 'Harris County'],
    riskFactors: ['Petrochemical discharge', 'Shipping accidents', 'Hurricane flooding'],
    premiumTier: true
  },
  {
    id: 'delaware-river-corridor',
    name: 'Delaware River Industrial Corridor',
    type: 'infrastructure',
    priority: 'high',
    huc12Coverage: ['020402020101', '020402020102'],
    description: 'Philadelphia refineries, chemical plants, port facilities',
    stakeholders: ['DRBC', 'EPA Region 3', 'PADEP', 'Port of Philadelphia'],
    riskFactors: ['Refinery discharge', 'Legacy contamination', 'Drinking water intakes'],
    premiumTier: true
  },
  {
    id: 'columbia-river-corridor',
    name: 'Columbia River Energy Corridor',
    type: 'infrastructure',
    priority: 'high',
    huc12Coverage: ['170702011201', '170702011202'],
    description: 'Hydroelectric dams, nuclear facilities, aluminum smelters',
    stakeholders: ['Bonneville Power', 'EPA Region 10', 'OR DEQ', 'WA Ecology'],
    riskFactors: ['Dam safety', 'Nuclear contamination', 'Fish passage'],
    premiumTier: true
  },
  {
    id: 'chesapeake-bay-corridor',
    name: 'Chesapeake Bay Industrial Corridor',
    type: 'infrastructure',
    priority: 'critical',
    huc12Coverage: ['020600020501', '020600020502', '020700100701'],
    description: 'Steel mills, chemical plants, shipping, largest US estuary',
    stakeholders: ['Chesapeake Bay Program', 'EPA Region 3', 'MD MDE', 'VA DEQ'],
    riskFactors: ['Industrial discharge', 'Agricultural runoff', 'Shipping accidents', 'Dead zones'],
    premiumTier: true
  },
  {
    id: 'port-of-baltimore',
    name: 'Port of Baltimore Complex',
    type: 'infrastructure',
    priority: 'high',
    huc12Coverage: ['020600020401'],
    description: 'Major East Coast port, coal terminal, auto import, container shipping',
    stakeholders: ['Port of Baltimore', 'EPA Region 3', 'MD MDE', 'US Coast Guard'],
    riskFactors: ['Coal dust', 'Shipping discharge', 'Stormwater runoff', 'Dredging impacts'],
    premiumTier: true
  },
  {
    id: 'delaware-chemical-corridor',
    name: 'Delaware Chemical Manufacturing Corridor',
    type: 'infrastructure',
    priority: 'critical',
    huc12Coverage: ['020402050101', '020402050102'],
    description: 'DuPont, Chemours, pharmaceutical manufacturing hub',
    stakeholders: ['DNREC', 'EPA Region 3', 'Delaware River Basin Commission'],
    riskFactors: ['PFAS contamination', 'Chemical discharge', 'Groundwater contamination', 'Air emissions'],
    premiumTier: true
  }
];

/**
 * NPL Superfund Sites (High Priority + Water Impact)
 */
const SUPERFUND_SITES: HighValueRegion[] = [
  {
    id: 'hanford-site',
    name: 'Hanford Nuclear Reservation',
    type: 'superfund',
    priority: 'critical',
    huc12Coverage: ['170702011301', '170702011302'],
    description: 'Largest nuclear cleanup in US, Columbia River groundwater contamination',
    stakeholders: ['DOE', 'EPA Region 10', 'WA Ecology', 'Tri-Party Agreement'],
    riskFactors: ['Radioactive contamination', 'Groundwater plumes', 'River discharge'],
    premiumTier: true
  },
  {
    id: 'berkeley-pit',
    name: 'Berkeley Pit/Butte',
    type: 'superfund',
    priority: 'critical',
    huc12Coverage: ['100300020201'],
    description: 'Acid mine drainage, heavy metals, largest contiguous toxic waste site',
    stakeholders: ['EPA Region 8', 'MT DEQ', 'Atlantic Richfield'],
    riskFactors: ['Acid mine drainage', 'Heavy metal contamination', 'Groundwater migration'],
    premiumTier: true
  },
  {
    id: 'gowanus-canal',
    name: 'Gowanus Canal',
    type: 'superfund',
    priority: 'high',
    huc12Coverage: ['020302060905'],
    description: 'Urban industrial canal, coal tar contamination, dense population',
    stakeholders: ['EPA Region 2', 'NYSDEC', 'NYC DEP', 'Brooklyn community'],
    riskFactors: ['Coal tar contamination', 'Urban runoff', 'Combined sewers'],
    premiumTier: true
  },
  {
    id: 'diamond-alkali',
    name: 'Diamond Alkali/Passaic River',
    type: 'superfund',
    priority: 'critical',
    huc12Coverage: ['020302030201'],
    description: 'Dioxin contamination, Newark Bay complex, 17-mile river section',
    stakeholders: ['EPA Region 2', 'NJDEP', 'Occidental Chemical'],
    riskFactors: ['Dioxin contamination', 'Sediment mobility', 'Fish consumption advisories'],
    premiumTier: true
  },
  {
    id: 'anacostia-river',
    name: 'Anacostia River/Kenilworth Park',
    type: 'superfund',
    priority: 'high',
    huc12Coverage: ['020700100901'],
    description: 'Urban industrial contamination, PCBs, heavy metals, environmental justice area',
    stakeholders: ['EPA Region 3', 'DC DOEE', 'National Park Service'],
    riskFactors: ['PCB contamination', 'Heavy metals', 'Urban runoff', 'Environmental justice'],
    premiumTier: true
  },
  {
    id: 'aberdeen-proving-ground',
    name: 'Aberdeen Proving Ground',
    type: 'superfund',
    priority: 'critical',
    huc12Coverage: ['020600020301'],
    description: 'Military ordnance testing, chemical weapons disposal, groundwater contamination',
    stakeholders: ['US Army', 'EPA Region 3', 'MD MDE'],
    riskFactors: ['Chemical weapons', 'Ordnance contamination', 'Groundwater plumes', 'Chesapeake Bay proximity'],
    premiumTier: true
  },
  {
    id: 'elizabeth-mine',
    name: 'Elizabeth Mine/Ompompanoosuc River',
    type: 'superfund',
    priority: 'high',
    huc12Coverage: ['010802010201'],
    description: 'Copper mine acid drainage, Connecticut River watershed contamination',
    stakeholders: ['EPA Region 1', 'VT ANR', 'NH DES'],
    riskFactors: ['Acid mine drainage', 'Copper contamination', 'Connecticut River impacts'],
    premiumTier: true
  },
  {
    id: 'avtex-fibers',
    name: 'Avtex Fibers/South River',
    type: 'superfund',
    priority: 'high',
    huc12Coverage: ['020700100601'],
    description: 'Mercury contamination from rayon production, South/South Fork Shenandoah Rivers',
    stakeholders: ['EPA Region 3', 'VA DEQ', 'Shenandoah Riverkeeper'],
    riskFactors: ['Mercury contamination', 'Fish consumption advisories', 'Shenandoah River impacts'],
    premiumTier: true
  }
];

/**
 * Military Installations (Strategic + Water Risk)
 */
const MILITARY_INSTALLATIONS: HighValueRegion[] = [
  {
    id: 'camp-lejeune',
    name: 'Marine Corps Base Camp Lejeune',
    type: 'military',
    priority: 'critical',
    huc12Coverage: ['030300040801'],
    description: 'PFAS contamination, drinking water crisis, 170,000 affected',
    stakeholders: ['USMC', 'EPA Region 4', 'NC DEQ', 'VA'],
    riskFactors: ['PFAS contamination', 'TCE plumes', 'Drinking water safety'],
    premiumTier: true
  },
  {
    id: 'naval-air-station-pensacola',
    name: 'Naval Air Station Pensacola',
    type: 'military',
    priority: 'high',
    huc12Coverage: ['031601040301'],
    description: 'PFAS firefighting foam, Pensacola Bay contamination',
    stakeholders: ['US Navy', 'EPA Region 4', 'FL DEP', 'Pensacola'],
    riskFactors: ['PFAS contamination', 'Bay ecosystem', 'Groundwater migration'],
    premiumTier: true
  },
  {
    id: 'mcchord-afb',
    name: 'Joint Base Lewis-McChord',
    type: 'military',
    priority: 'high',
    huc12Coverage: ['171100110801'],
    description: 'PFAS water supply contamination, Puget Sound watershed',
    stakeholders: ['US Army/Air Force', 'EPA Region 10', 'WA Ecology', 'Tacoma Water'],
    riskFactors: ['PFAS contamination', 'Puget Sound discharge', 'Public water supply'],
    premiumTier: true
  },
  {
    id: 'wright-patterson-afb',
    name: 'Wright-Patterson Air Force Base',
    type: 'military',
    priority: 'high',
    huc12Coverage: ['050802030401'],
    description: 'PFAS groundwater plumes, Mad River watershed, Dayton area',
    stakeholders: ['US Air Force', 'EPA Region 5', 'OH EPA', 'Miami Valley Water'],
    riskFactors: ['PFAS plumes', 'Groundwater migration', 'Public wells'],
    premiumTier: true
  },
  {
    id: 'fort-detrick',
    name: 'Fort Detrick',
    type: 'military',
    priority: 'critical',
    huc12Coverage: ['020700100501'],
    description: 'Biological research facility, TCE contamination, Potomac watershed',
    stakeholders: ['US Army', 'EPA Region 3', 'MD MDE', 'Frederick County'],
    riskFactors: ['TCE contamination', 'Biological research', 'Potomac River proximity'],
    premiumTier: true
  },
  {
    id: 'naval-station-norfolk',
    name: 'Naval Station Norfolk',
    type: 'military',
    priority: 'critical',
    huc12Coverage: ['030102000301'],
    description: 'World\'s largest naval base, Elizabeth River contamination, shipyard operations',
    stakeholders: ['US Navy', 'EPA Region 3', 'VA DEQ', 'Norfolk'],
    riskFactors: ['Shipyard contamination', 'Fuel spills', 'Elizabeth River pollution', 'PFAS firefighting foam'],
    premiumTier: true
  },
  {
    id: 'newport-news-shipbuilding',
    name: 'Newport News Shipbuilding',
    type: 'military',
    priority: 'critical',
    huc12Coverage: ['030102000302'],
    description: 'Nuclear submarine/carrier construction, James River industrial contamination',
    stakeholders: ['Huntington Ingalls', 'US Navy', 'EPA Region 3', 'VA DEQ'],
    riskFactors: ['Nuclear materials', 'Industrial discharge', 'James River contamination', 'Shipyard waste'],
    premiumTier: true
  },
  {
    id: 'dover-air-force-base',
    name: 'Dover Air Force Base',
    type: 'military',
    priority: 'high',
    huc12Coverage: ['020801050201'],
    description: 'Strategic airlift, fuel contamination, Delaware Bay watershed',
    stakeholders: ['US Air Force', 'EPA Region 3', 'DNREC', 'Kent County DE'],
    riskFactors: ['Fuel contamination', 'PFAS firefighting foam', 'Groundwater migration', 'Delaware Bay proximity'],
    premiumTier: true
  },
  {
    id: 'andrews-air-force-base',
    name: 'Joint Base Andrews',
    type: 'military',
    priority: 'critical',
    huc12Coverage: ['020700100801'],
    description: 'Presidential airlift, fuel spills, Potomac River watershed contamination',
    stakeholders: ['US Air Force', 'EPA Region 3', 'MD MDE', 'Prince George\'s County'],
    riskFactors: ['Fuel contamination', 'PFAS contamination', 'Potomac River impacts', 'Presidential security'],
    premiumTier: true
  },
  {
    id: 'quantico-marine-base',
    name: 'Marine Corps Base Quantico',
    type: 'military',
    priority: 'critical',
    huc12Coverage: ['020700100701'],
    description: 'FBI training, ordnance disposal, Potomac River contamination',
    stakeholders: ['USMC', 'FBI', 'EPA Region 3', 'VA DEQ'],
    riskFactors: ['Ordnance contamination', 'Training chemicals', 'Potomac River impacts', 'Groundwater contamination'],
    premiumTier: true
  },
  {
    id: 'aberdeen-proving-ground-military',
    name: 'Aberdeen Proving Ground (Military Operations)',
    type: 'military',
    priority: 'critical',
    huc12Coverage: ['020600020301'],
    description: 'Chemical/biological testing, ordnance disposal, Chesapeake Bay watershed',
    stakeholders: ['US Army', 'EPA Region 3', 'MD MDE', 'Aberdeen'],
    riskFactors: ['Chemical agents', 'Ordnance waste', 'Chesapeake Bay contamination', 'Groundwater plumes'],
    premiumTier: true
  }
];

/**
 * Combined high-value regions registry
 */
export const HIGH_VALUE_REGIONS: HighValueRegion[] = [
  ...METRO_REGIONS,
  ...INFRASTRUCTURE_CORRIDORS,
  ...SUPERFUND_SITES,
  ...MILITARY_INSTALLATIONS
];

/**
 * Get all HUC-12s that should have HUC-14 analysis
 */
export function getHuc14Coverage(): string[] {
  const huc12Set = new Set<string>();

  HIGH_VALUE_REGIONS
    .filter(region => region.premiumTier)
    .forEach(region => {
      region.huc12Coverage.forEach(huc12 => huc12Set.add(huc12));
    });

  return Array.from(huc12Set).sort();
}

/**
 * Check if a HUC-12 qualifies for HUC-14 premium analysis
 */
export function isHuc14Eligible(huc12: string): boolean {
  return HIGH_VALUE_REGIONS.some(region =>
    region.premiumTier && region.huc12Coverage.includes(huc12)
  );
}

/**
 * Get high-value regions containing a specific HUC-12
 */
export function getRegionsForHuc12(huc12: string): HighValueRegion[] {
  return HIGH_VALUE_REGIONS.filter(region =>
    region.huc12Coverage.includes(huc12)
  );
}

/**
 * Get regions by type and priority
 */
export function getRegionsByType(type: HighValueRegion['type']): HighValueRegion[] {
  return HIGH_VALUE_REGIONS.filter(region => region.type === type);
}

export function getRegionsByPriority(priority: HighValueRegion['priority']): HighValueRegion[] {
  return HIGH_VALUE_REGIONS.filter(region => region.priority === priority);
}

/**
 * Get premium tier summary statistics
 */
export function getPremiumTierStats() {
  const premiumRegions = HIGH_VALUE_REGIONS.filter(r => r.premiumTier);
  const huc12Coverage = getHuc14Coverage();

  return {
    totalRegions: premiumRegions.length,
    byType: {
      metropolitan: premiumRegions.filter(r => r.type === 'metropolitan').length,
      infrastructure: premiumRegions.filter(r => r.type === 'infrastructure').length,
      superfund: premiumRegions.filter(r => r.type === 'superfund').length,
      military: premiumRegions.filter(r => r.type === 'military').length
    },
    byPriority: {
      critical: premiumRegions.filter(r => r.priority === 'critical').length,
      high: premiumRegions.filter(r => r.priority === 'high').length,
      medium: premiumRegions.filter(r => r.priority === 'medium').length
    },
    huc12Coverage: huc12Coverage.length,
    estimatedHuc14s: huc12Coverage.length * 8, // ~8 HUC-14s per HUC-12 average
    marketValue: premiumRegions.length * 150_000, // $150K per premium region annually
    midAtlanticExpansion: {
      newRegions: premiumRegions.filter(r =>
        r.id.includes('baltimore') || r.id.includes('philadelphia') ||
        r.id.includes('virginia-beach') || r.id.includes('chesapeake') ||
        r.id.includes('delaware') || r.id.includes('anacostia') ||
        r.id.includes('aberdeen') || r.id.includes('norfolk') ||
        r.id.includes('newport-news') || r.id.includes('dover') ||
        r.id.includes('andrews') || r.id.includes('quantico')
      ).length,
      additionalMarketValue: 12 * 150_000 // 12 new Mid-Atlantic regions
    }
  };
}