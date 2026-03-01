/**
 * Shared constants used across cron jobs and cache modules.
 */

// All 50 US states + DC (51 total) — used by daily cron jobs.
export const ALL_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY',
] as const;

export type USState = (typeof ALL_STATES)[number];

// All states with FIPS codes (used by WQP which needs FIPS in the URL)
export const ALL_STATES_WITH_FIPS: [string, string][] = [
  ['AL', '01'], ['AK', '02'], ['AZ', '04'], ['AR', '05'], ['CA', '06'],
  ['CO', '08'], ['CT', '09'], ['DE', '10'], ['DC', '11'], ['FL', '12'],
  ['GA', '13'], ['HI', '15'], ['ID', '16'], ['IL', '17'], ['IN', '18'],
  ['IA', '19'], ['KS', '20'], ['KY', '21'], ['LA', '22'], ['ME', '23'],
  ['MD', '24'], ['MA', '25'], ['MI', '26'], ['MN', '27'], ['MS', '28'],
  ['MO', '29'], ['MT', '30'], ['NE', '31'], ['NV', '32'], ['NH', '33'],
  ['NJ', '34'], ['NM', '35'], ['NY', '36'], ['NC', '37'], ['ND', '38'],
  ['OH', '39'], ['OK', '40'], ['OR', '41'], ['PA', '42'], ['RI', '44'],
  ['SC', '45'], ['SD', '46'], ['TN', '47'], ['TX', '48'], ['UT', '49'],
  ['VT', '50'], ['VA', '51'], ['WA', '53'], ['WV', '54'], ['WI', '55'],
  ['WY', '56'],
];

// 19 legacy priority states (kept for reference / fallback)
export const PRIORITY_STATES = [
  'MD', 'VA', 'DC', 'PA', 'DE', 'FL', 'WV', 'CA', 'TX', 'NY',
  'NJ', 'OH', 'NC', 'MA', 'GA', 'IL', 'MI', 'WA', 'OR',
] as const;

export type PriorityState = (typeof PRIORITY_STATES)[number];

// Legacy: priority states with FIPS (kept for reference)
export const PRIORITY_STATES_WITH_FIPS: [string, string][] = [
  ['MD', '24'], ['VA', '51'], ['DC', '11'], ['PA', '42'], ['DE', '10'],
  ['FL', '12'], ['WV', '54'], ['CA', '06'], ['TX', '48'], ['NY', '36'],
  ['NJ', '34'], ['OH', '39'], ['NC', '37'], ['MA', '25'], ['GA', '13'],
  ['IL', '17'], ['MI', '26'], ['WA', '53'], ['OR', '41'],
];

/** States with active water quality / nutrient credit trading programs.
 *  Used to gate the WQT sidebar item — don't show if state has no program. */
export const NUTRIENT_TRADING_STATES = new Set([
  'MD',  // Maryland Water Quality Trading Program (MDE + MDA)
  'VA',  // Virginia Nutrient Credit Exchange
  'PA',  // Pennsylvania Nutrient Credit Trading (Chesapeake Bay)
  'CT',  // Connecticut Nitrogen Credit Exchange (Long Island Sound)
  'CO',  // Colorado Water Quality Trading
  'OH',  // Ohio Water Quality Trading (Great Miami River)
  'OR',  // Oregon Water Quality Trading (Willamette)
  'NC',  // North Carolina Nutrient Offset (Neuse/Tar-Pamlico)
  'WI',  // Wisconsin Water Quality Trading (Fox River, Rock River)
  'ID',  // Idaho Water Quality Trading
  'IN',  // Indiana Water Quality Trading (Sugar Creek)
  'MT',  // Montana Water Quality Trading
  'MN',  // Minnesota Water Quality Trading (emerging)
  'FL',  // Florida Water Quality Trading (emerging)
  'WV',  // West Virginia Nutrient Trading (Chesapeake Bay, emerging)
]);

/** State-specific WQT program details for display. */
export const WQT_PROGRAM_INFO: Record<string, {
  name: string;
  agency: string;
  agencyAbbr: string;
  url: string;
  watershed?: string;
  sectors: ('wastewater' | 'stormwater' | 'agriculture' | 'septic' | 'aquaculture')[];
  nutrients: ('nitrogen' | 'phosphorus' | 'sediment')[];
  maturity: 'active' | 'emerging';
}> = {
  MD: {
    name: 'Maryland Water Quality Trading Program',
    agency: 'Maryland Department of the Environment',
    agencyAbbr: 'MDE',
    url: 'https://mde.maryland.gov/programs/water/WQT/Pages/index.aspx',
    watershed: 'Chesapeake Bay',
    sectors: ['wastewater', 'stormwater', 'agriculture', 'septic', 'aquaculture'],
    nutrients: ['nitrogen', 'phosphorus', 'sediment'],
    maturity: 'active',
  },
  VA: {
    name: 'Virginia Nutrient Credit Exchange',
    agency: 'Virginia Dept. of Environmental Quality',
    agencyAbbr: 'VA DEQ',
    url: 'https://www.deq.virginia.gov/water/water-quality/nutrient-credit-exchange',
    watershed: 'Chesapeake Bay',
    sectors: ['wastewater', 'stormwater', 'agriculture'],
    nutrients: ['nitrogen', 'phosphorus'],
    maturity: 'active',
  },
  PA: {
    name: 'Pennsylvania Nutrient Credit Trading',
    agency: 'PA Dept. of Environmental Protection',
    agencyAbbr: 'PA DEP',
    url: 'https://www.dep.pa.gov/Business/Water/CleanWater/NutrientTrading/Pages/default.aspx',
    watershed: 'Chesapeake Bay',
    sectors: ['wastewater', 'agriculture'],
    nutrients: ['nitrogen', 'phosphorus', 'sediment'],
    maturity: 'active',
  },
  CT: {
    name: 'Connecticut Nitrogen Credit Exchange',
    agency: 'CT Dept. of Energy & Environmental Protection',
    agencyAbbr: 'CT DEEP',
    url: 'https://portal.ct.gov/deep/water/municipal-wastewater/nitrogen-credit-exchange-program',
    watershed: 'Long Island Sound',
    sectors: ['wastewater'],
    nutrients: ['nitrogen'],
    maturity: 'active',
  },
  OH: {
    name: 'Ohio Water Quality Trading',
    agency: 'Ohio Environmental Protection Agency',
    agencyAbbr: 'Ohio EPA',
    url: 'https://epa.ohio.gov/divisions-and-offices/surface-water/permitting/water-quality-trading',
    watershed: 'Great Miami River',
    sectors: ['wastewater', 'agriculture'],
    nutrients: ['nitrogen', 'phosphorus'],
    maturity: 'active',
  },
  CO: {
    name: 'Colorado Water Quality Trading',
    agency: 'CO Dept. of Public Health & Environment',
    agencyAbbr: 'CDPHE',
    url: 'https://cdphe.colorado.gov/wq-trading',
    sectors: ['wastewater', 'agriculture', 'stormwater'],
    nutrients: ['nitrogen', 'phosphorus'],
    maturity: 'active',
  },
  NC: {
    name: 'North Carolina Nutrient Offset Program',
    agency: 'NC Dept. of Environmental Quality',
    agencyAbbr: 'NC DEQ',
    url: 'https://www.deq.nc.gov/about/divisions/water-resources/planning/nonpoint-source-management/nutrient-offset-program',
    watershed: 'Neuse / Tar-Pamlico',
    sectors: ['wastewater', 'agriculture', 'stormwater'],
    nutrients: ['nitrogen', 'phosphorus'],
    maturity: 'active',
  },
  OR: {
    name: 'Oregon Water Quality Trading',
    agency: 'Oregon Dept. of Environmental Quality',
    agencyAbbr: 'OR DEQ',
    url: 'https://www.oregon.gov/deq/wq/Pages/Trading.aspx',
    watershed: 'Willamette',
    sectors: ['wastewater', 'agriculture'],
    nutrients: ['phosphorus'],
    maturity: 'active',
  },
  WI: {
    name: 'Wisconsin Water Quality Trading',
    agency: 'Wisconsin Dept. of Natural Resources',
    agencyAbbr: 'WI DNR',
    url: 'https://dnr.wisconsin.gov/topic/SurfaceWater/WaterQualityTrading',
    watershed: 'Fox River / Rock River',
    sectors: ['wastewater', 'agriculture'],
    nutrients: ['phosphorus'],
    maturity: 'active',
  },
  ID: {
    name: 'Idaho Water Quality Trading',
    agency: 'Idaho Dept. of Environmental Quality',
    agencyAbbr: 'ID DEQ',
    url: 'https://www.deq.idaho.gov/',
    sectors: ['agriculture', 'wastewater'],
    nutrients: ['phosphorus'],
    maturity: 'emerging',
  },
  IN: {
    name: 'Indiana Water Quality Trading',
    agency: 'Indiana Dept. of Environmental Management',
    agencyAbbr: 'IDEM',
    url: 'https://www.in.gov/idem/',
    watershed: 'Sugar Creek',
    sectors: ['wastewater', 'agriculture'],
    nutrients: ['nitrogen', 'phosphorus'],
    maturity: 'emerging',
  },
  MT: {
    name: 'Montana Water Quality Trading',
    agency: 'Montana Dept. of Environmental Quality',
    agencyAbbr: 'MT DEQ',
    url: 'https://deq.mt.gov/',
    sectors: ['agriculture', 'wastewater'],
    nutrients: ['nitrogen', 'phosphorus'],
    maturity: 'emerging',
  },
  MN: {
    name: 'Minnesota Water Quality Trading',
    agency: 'Minnesota Pollution Control Agency',
    agencyAbbr: 'MPCA',
    url: 'https://www.pca.state.mn.us/',
    sectors: ['wastewater', 'agriculture'],
    nutrients: ['nitrogen', 'phosphorus'],
    maturity: 'emerging',
  },
  FL: {
    name: 'Florida Water Quality Trading',
    agency: 'Florida Dept. of Environmental Protection',
    agencyAbbr: 'FL DEP',
    url: 'https://floridadep.gov/',
    sectors: ['wastewater', 'agriculture', 'stormwater'],
    nutrients: ['nitrogen', 'phosphorus'],
    maturity: 'emerging',
  },
  WV: {
    name: 'West Virginia Nutrient Trading',
    agency: 'WV Dept. of Environmental Protection',
    agencyAbbr: 'WV DEP',
    url: 'https://dep.wv.gov/',
    watershed: 'Chesapeake Bay',
    sectors: ['wastewater', 'agriculture'],
    nutrients: ['nitrogen', 'phosphorus'],
    maturity: 'emerging',
  },
};
