import { feature } from 'topojson-client';
import statesTopo from 'us-atlas/states-10m.json';

// ─── Tile URLs ───────────────────────────────────────────────────────────────
export const CARTO_TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const CARTO_DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
export const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

// ─── State Names & Lookups ──────────────────────────────────────────────────
export const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
  LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};

export const FIPS_TO_ABBR: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC',
  '12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY',
  '22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT',
  '31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH',
  '40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT',
  '50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY',
};

export const NAME_TO_ABBR: Record<string, string> = Object.entries(STATE_NAMES).reduce(
  (acc, [abbr, name]) => { acc[name] = abbr; return acc; },
  {} as Record<string, string>
);

// ─── GeoJSON feature → state abbreviation ────────────────────────────────────
export interface GeoFeature {
  id: string;
  properties?: { name?: string };
  rsmKey?: string;
}

export function geoToAbbr(g: GeoFeature): string | undefined {
  if (g.id) {
    const fips = String(g.id).padStart(2, '0');
    if (FIPS_TO_ABBR[fips]) return FIPS_TO_ABBR[fips];
  }
  if (g.properties?.name && NAME_TO_ABBR[g.properties.name]) return NAME_TO_ABBR[g.properties.name];
  return undefined;
}

// ─── GeoJSON from TopoJSON ──────────────────────────────────────────────────
export function getStatesGeoJSON() {
  return feature(statesTopo as any, (statesTopo as any).objects.states);
}

// ─── Leaflet-compatible state centers: [lat, lng] + zoom ─────────────────────
// Converted from the old geoMercator [lon, lat] + scale convention.
export const STATE_GEO_LEAFLET: Record<string, { center: [number, number]; zoom: number }> = {
  AL: { center: [32.8, -86.8], zoom: 7 },
  AK: { center: [64.0, -153.0], zoom: 4 },
  AZ: { center: [34.2, -111.7], zoom: 7 },
  AR: { center: [34.8, -92.4], zoom: 7 },
  CA: { center: [37.5, -119.5], zoom: 6 },
  CO: { center: [39.0, -105.5], zoom: 7 },
  CT: { center: [41.6, -72.7], zoom: 9 },
  DE: { center: [39.0, -75.5], zoom: 9 },
  DC: { center: [38.9, -77.02], zoom: 12 },
  FL: { center: [28.5, -82.5], zoom: 7 },
  GA: { center: [32.7, -83.5], zoom: 7 },
  HI: { center: [20.5, -157.0], zoom: 7 },
  ID: { center: [44.5, -114.5], zoom: 6 },
  IL: { center: [40.0, -89.2], zoom: 7 },
  IN: { center: [39.8, -86.3], zoom: 7 },
  IA: { center: [42.0, -93.5], zoom: 7 },
  KS: { center: [38.5, -98.5], zoom: 7 },
  KY: { center: [37.8, -85.3], zoom: 7 },
  LA: { center: [31.0, -92.0], zoom: 7 },
  ME: { center: [45.5, -69.0], zoom: 7 },
  MD: { center: [39.0, -77.0], zoom: 8 },
  MA: { center: [42.3, -71.8], zoom: 8 },
  MI: { center: [44.0, -85.5], zoom: 7 },
  MN: { center: [46.3, -94.5], zoom: 6 },
  MS: { center: [32.7, -89.7], zoom: 7 },
  MO: { center: [38.5, -92.5], zoom: 7 },
  MT: { center: [47.0, -109.6], zoom: 6 },
  NE: { center: [41.5, -99.8], zoom: 7 },
  NV: { center: [39.5, -117.0], zoom: 6 },
  NH: { center: [43.8, -71.6], zoom: 8 },
  NJ: { center: [40.1, -74.7], zoom: 8 },
  NM: { center: [34.5, -106.0], zoom: 7 },
  NY: { center: [42.5, -75.5], zoom: 7 },
  NC: { center: [35.5, -79.5], zoom: 7 },
  ND: { center: [47.5, -100.5], zoom: 7 },
  OH: { center: [40.2, -82.8], zoom: 7 },
  OK: { center: [35.5, -97.5], zoom: 7 },
  OR: { center: [44.0, -120.5], zoom: 7 },
  PA: { center: [41.0, -77.6], zoom: 7 },
  RI: { center: [41.7, -71.5], zoom: 10 },
  SC: { center: [33.8, -80.9], zoom: 8 },
  SD: { center: [44.5, -100.2], zoom: 7 },
  TN: { center: [35.8, -86.3], zoom: 7 },
  TX: { center: [31.5, -99.5], zoom: 6 },
  UT: { center: [39.5, -111.7], zoom: 7 },
  VT: { center: [44.0, -72.6], zoom: 8 },
  VA: { center: [37.8, -79.5], zoom: 7 },
  WA: { center: [47.5, -120.5], zoom: 7 },
  WV: { center: [38.6, -80.6], zoom: 8 },
  WI: { center: [44.5, -89.8], zoom: 7 },
  WY: { center: [43.0, -107.5], zoom: 7 },
  US: { center: [39.8, -98.5], zoom: 4 },
};
