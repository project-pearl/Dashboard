'use client';

import type { PearlUser } from '@/lib/authTypes';
import { getEpaRegionForState } from '@/lib/epa-regions';

export type JurisdictionType = 'county' | 'municipality' | 'ms4' | 'utility' | 'watershed' | 'custom';

export interface JurisdictionScope {
  jurisdiction_id: string;
  jurisdiction_name: string;
  jurisdiction_type: JurisdictionType;
  parent_state: string;
  parent_epa_region: number;
  assessment_unit_ids: string[];
  region_ids?: string[];
  name_keywords?: string[];
  parent_jurisdiction_id?: string;  // links sub-municipalities to parent county
}

// ─── Maryland Counties (all 23 counties + Baltimore City) ───────────────────

const MD_COUNTIES: JurisdictionScope[] = [
  {
    jurisdiction_id: 'allegany_county_md',
    jurisdiction_name: 'Allegany County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-ALLE-001'],
    name_keywords: ['allegany', 'cumberland', 'north branch potomac', 'wills creek'],
  },
  {
    jurisdiction_id: 'anne_arundel_county_md',
    jurisdiction_name: 'Anne Arundel County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-ANNE-001', 'MD-ANNE-002', 'MD-ANNE-003'],
    name_keywords: ['anne arundel', 'severn', 'south river', 'magothy', 'patapsco'],
  },
  {
    jurisdiction_id: 'baltimore_county_md',
    jurisdiction_name: 'Baltimore County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-BALCO-001', 'MD-BALCO-002', 'MD-BALCO-003'],
    name_keywords: ['baltimore county', 'gunpowder', 'back river', 'patapsco'],
  },
  {
    jurisdiction_id: 'baltimore_city_md',
    jurisdiction_name: 'Baltimore City',
    jurisdiction_type: 'municipality',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-BALCITY-001', 'MD-BALCITY-002'],
    name_keywords: ['baltimore city', 'inner harbor', 'gwynns', 'jones falls'],
    // Baltimore City is an independent city — no parent county
  },
  {
    jurisdiction_id: 'calvert_county_md',
    jurisdiction_name: 'Calvert County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-CALV-001'],
    name_keywords: ['calvert', 'patuxent', 'chesapeake beach'],
  },
  {
    jurisdiction_id: 'caroline_county_md',
    jurisdiction_name: 'Caroline County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-CARO-001'],
    name_keywords: ['caroline', 'choptank', 'denton'],
  },
  {
    jurisdiction_id: 'carroll_county_md',
    jurisdiction_name: 'Carroll County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-CARR-001'],
    name_keywords: ['carroll', 'westminster', 'liberty reservoir'],
  },
  {
    jurisdiction_id: 'cecil_county_md',
    jurisdiction_name: 'Cecil County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-CECI-001'],
    name_keywords: ['cecil', 'elkton', 'susquehanna', 'elk river'],
  },
  {
    jurisdiction_id: 'charles_county_md',
    jurisdiction_name: 'Charles County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-CHAR-001'],
    name_keywords: ['charles', 'la plata', 'port tobacco', 'mattawoman'],
  },
  {
    jurisdiction_id: 'dorchester_county_md',
    jurisdiction_name: 'Dorchester County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-DORC-001'],
    name_keywords: ['dorchester', 'cambridge', 'choptank', 'blackwater'],
  },
  {
    jurisdiction_id: 'frederick_county_md',
    jurisdiction_name: 'Frederick County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-FRED-001'],
    name_keywords: ['frederick', 'monocacy', 'catoctin'],
  },
  {
    jurisdiction_id: 'garrett_county_md',
    jurisdiction_name: 'Garrett County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-GARR-001'],
    name_keywords: ['garrett', 'deep creek', 'youghiogheny'],
  },
  {
    jurisdiction_id: 'harford_county_md',
    jurisdiction_name: 'Harford County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-HARF-001'],
    name_keywords: ['harford', 'bel air', 'bush river', 'gunpowder'],
  },
  {
    jurisdiction_id: 'howard_county_md',
    jurisdiction_name: 'Howard County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-HOWA-001'],
    name_keywords: ['howard', 'columbia', 'patuxent', 'patapsco'],
  },
  {
    jurisdiction_id: 'kent_county_md',
    jurisdiction_name: 'Kent County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-KENT-001'],
    name_keywords: ['kent', 'chestertown', 'chester river'],
  },
  {
    jurisdiction_id: 'montgomery_county_md',
    jurisdiction_name: 'Montgomery County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-MONT-001', 'MD-MONT-002', 'MD-MONT-003'],
    name_keywords: ['montgomery', 'potomac', 'rock creek', 'anacostia'],
  },
  {
    jurisdiction_id: 'prince_georges_county_md',
    jurisdiction_name: "Prince George's County",
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-PG-001', 'MD-PG-002', 'MD-PG-003'],
    name_keywords: ['prince george', 'anacostia', 'patuxent', 'western branch'],
  },
  {
    jurisdiction_id: 'queen_annes_county_md',
    jurisdiction_name: "Queen Anne's County",
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-QA-001'],
    name_keywords: ['queen anne', 'centreville', 'chester river', 'corsica'],
  },
  {
    jurisdiction_id: 'st_marys_county_md',
    jurisdiction_name: "St. Mary's County",
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-SM-001'],
    name_keywords: ['st mary', 'leonardtown', 'patuxent', 'st marys river'],
  },
  {
    jurisdiction_id: 'somerset_county_md',
    jurisdiction_name: 'Somerset County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-SOME-001'],
    name_keywords: ['somerset', 'princess anne', 'crisfield', 'pocomoke'],
  },
  {
    jurisdiction_id: 'talbot_county_md',
    jurisdiction_name: 'Talbot County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-TALB-001'],
    name_keywords: ['talbot', 'easton', 'tred avon', 'miles river'],
  },
  {
    jurisdiction_id: 'washington_county_md',
    jurisdiction_name: 'Washington County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-WASH-001'],
    name_keywords: ['washington county', 'hagerstown', 'antietam', 'conococheague'],
  },
  {
    jurisdiction_id: 'wicomico_county_md',
    jurisdiction_name: 'Wicomico County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-WICO-001'],
    name_keywords: ['wicomico', 'salisbury', 'wicomico river'],
  },
  {
    jurisdiction_id: 'worcester_county_md',
    jurisdiction_name: 'Worcester County',
    jurisdiction_type: 'county',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: ['MD-WORC-001'],
    name_keywords: ['worcester', 'ocean city', 'pocomoke', 'sinepuxent'],
  },
];

// ─── Maryland Municipalities (incorporated cities/towns) ────────────────────

function mdMunicipality(id: string, name: string, parentId: string, keywords?: string[]): JurisdictionScope {
  return {
    jurisdiction_id: id,
    jurisdiction_name: name,
    jurisdiction_type: 'municipality',
    parent_state: 'MD',
    parent_epa_region: 3,
    assessment_unit_ids: [],
    parent_jurisdiction_id: parentId,
    name_keywords: keywords,
  };
}

const MD_MUNICIPALITIES: JurisdictionScope[] = [
  // Allegany County
  mdMunicipality('cumberland_md', 'City of Cumberland', 'allegany_county_md', ['cumberland', 'wills creek']),
  mdMunicipality('frostburg_md', 'City of Frostburg', 'allegany_county_md', ['frostburg']),
  mdMunicipality('barton_md', 'Town of Barton', 'allegany_county_md'),
  mdMunicipality('lonaconing_md', 'Town of Lonaconing', 'allegany_county_md'),
  mdMunicipality('luke_md', 'Town of Luke', 'allegany_county_md'),
  mdMunicipality('midland_md', 'Town of Midland', 'allegany_county_md'),
  mdMunicipality('westernport_md', 'Town of Westernport', 'allegany_county_md'),

  // Anne Arundel County
  mdMunicipality('city_of_annapolis_md', 'City of Annapolis', 'anne_arundel_county_md', ['annapolis', 'severn', 'spa creek', 'back creek']),
  mdMunicipality('highland_beach_md', 'Town of Highland Beach', 'anne_arundel_county_md', ['highland beach']),

  // Baltimore County — no incorporated municipalities (unincorporated county)

  // Calvert County — no incorporated municipalities

  // Caroline County
  mdMunicipality('denton_md', 'Town of Denton', 'caroline_county_md', ['denton']),
  mdMunicipality('federalsburg_md', 'Town of Federalsburg', 'caroline_county_md'),
  mdMunicipality('greensboro_md', 'Town of Greensboro', 'caroline_county_md'),
  mdMunicipality('hillsboro_md', 'Town of Hillsboro', 'caroline_county_md'),
  mdMunicipality('marydel_md', 'Town of Marydel', 'caroline_county_md'),
  mdMunicipality('preston_md', 'Town of Preston', 'caroline_county_md'),
  mdMunicipality('ridgely_md', 'Town of Ridgely', 'caroline_county_md'),

  // Carroll County
  mdMunicipality('hampstead_md', 'Town of Hampstead', 'carroll_county_md'),
  mdMunicipality('manchester_md', 'Town of Manchester', 'carroll_county_md'),
  mdMunicipality('mount_airy_md', 'Town of Mount Airy', 'carroll_county_md'),
  mdMunicipality('new_windsor_md', 'Town of New Windsor', 'carroll_county_md'),
  mdMunicipality('sykesville_md', 'Town of Sykesville', 'carroll_county_md'),
  mdMunicipality('taneytown_md', 'City of Taneytown', 'carroll_county_md'),
  mdMunicipality('union_bridge_md', 'Town of Union Bridge', 'carroll_county_md'),
  mdMunicipality('westminster_md', 'City of Westminster', 'carroll_county_md', ['westminster']),

  // Cecil County
  mdMunicipality('elkton_md', 'Town of Elkton', 'cecil_county_md', ['elkton']),
  mdMunicipality('cecilton_md', 'Town of Cecilton', 'cecil_county_md'),
  mdMunicipality('charlestown_md', 'Town of Charlestown', 'cecil_county_md'),
  mdMunicipality('chesapeake_city_md', 'Town of Chesapeake City', 'cecil_county_md'),
  mdMunicipality('north_east_md', 'Town of North East', 'cecil_county_md'),
  mdMunicipality('perryville_md', 'Town of Perryville', 'cecil_county_md'),
  mdMunicipality('port_deposit_md', 'Town of Port Deposit', 'cecil_county_md'),
  mdMunicipality('rising_sun_md', 'Town of Rising Sun', 'cecil_county_md'),

  // Charles County
  mdMunicipality('la_plata_md', 'Town of La Plata', 'charles_county_md', ['la plata']),
  mdMunicipality('indian_head_md', 'Town of Indian Head', 'charles_county_md'),

  // Dorchester County
  mdMunicipality('cambridge_md', 'City of Cambridge', 'dorchester_county_md', ['cambridge']),
  mdMunicipality('church_creek_md', 'Town of Church Creek', 'dorchester_county_md'),
  mdMunicipality('east_new_market_md', 'Town of East New Market', 'dorchester_county_md'),
  mdMunicipality('hurlock_md', 'Town of Hurlock', 'dorchester_county_md'),
  mdMunicipality('secretary_md', 'Town of Secretary', 'dorchester_county_md'),
  mdMunicipality('vienna_md', 'Town of Vienna', 'dorchester_county_md'),

  // Frederick County
  mdMunicipality('frederick_city_md', 'City of Frederick', 'frederick_county_md', ['frederick city', 'carroll creek']),
  mdMunicipality('brunswick_md', 'City of Brunswick', 'frederick_county_md', ['brunswick']),
  mdMunicipality('burkittsville_md', 'Town of Burkittsville', 'frederick_county_md'),
  mdMunicipality('emmitsburg_md', 'Town of Emmitsburg', 'frederick_county_md', ['emmitsburg']),
  mdMunicipality('middletown_md', 'Town of Middletown', 'frederick_county_md'),
  mdMunicipality('myersville_md', 'Town of Myersville', 'frederick_county_md'),
  mdMunicipality('new_market_md', 'Town of New Market', 'frederick_county_md'),
  mdMunicipality('thurmont_md', 'Town of Thurmont', 'frederick_county_md', ['thurmont']),
  mdMunicipality('walkersville_md', 'Town of Walkersville', 'frederick_county_md'),
  mdMunicipality('woodsboro_md', 'Town of Woodsboro', 'frederick_county_md'),

  // Garrett County
  mdMunicipality('oakland_md', 'Town of Oakland', 'garrett_county_md', ['oakland']),
  mdMunicipality('accident_md', 'Town of Accident', 'garrett_county_md'),
  mdMunicipality('deer_park_md', 'Town of Deer Park', 'garrett_county_md'),
  mdMunicipality('friendsville_md', 'Town of Friendsville', 'garrett_county_md'),
  mdMunicipality('grantsville_md', 'Town of Grantsville', 'garrett_county_md'),
  mdMunicipality('kitzmiller_md', 'Town of Kitzmiller', 'garrett_county_md'),
  mdMunicipality('loch_lynn_heights_md', 'Town of Loch Lynn Heights', 'garrett_county_md'),
  mdMunicipality('mountain_lake_park_md', 'Town of Mountain Lake Park', 'garrett_county_md'),

  // Harford County
  mdMunicipality('bel_air_md', 'Town of Bel Air', 'harford_county_md', ['bel air']),
  mdMunicipality('aberdeen_md', 'City of Aberdeen', 'harford_county_md', ['aberdeen']),
  mdMunicipality('havre_de_grace_md', 'City of Havre de Grace', 'harford_county_md', ['havre de grace']),

  // Howard County — no incorporated municipalities

  // Kent County
  mdMunicipality('chestertown_md', 'Town of Chestertown', 'kent_county_md', ['chestertown']),
  mdMunicipality('galena_md', 'Town of Galena', 'kent_county_md'),
  mdMunicipality('millington_md', 'Town of Millington', 'kent_county_md'),
  mdMunicipality('rock_hall_md', 'Town of Rock Hall', 'kent_county_md'),

  // Montgomery County
  mdMunicipality('rockville_md', 'City of Rockville', 'montgomery_county_md', ['rockville']),
  mdMunicipality('gaithersburg_md', 'City of Gaithersburg', 'montgomery_county_md', ['gaithersburg']),
  mdMunicipality('takoma_park_md', 'City of Takoma Park', 'montgomery_county_md', ['takoma park']),
  mdMunicipality('poolesville_md', 'Town of Poolesville', 'montgomery_county_md', ['poolesville']),
  mdMunicipality('brookeville_md', 'Town of Brookeville', 'montgomery_county_md'),
  mdMunicipality('barnesville_md', 'Town of Barnesville', 'montgomery_county_md'),
  mdMunicipality('chevy_chase_md', 'Town of Chevy Chase', 'montgomery_county_md'),
  mdMunicipality('garrett_park_md', 'Town of Garrett Park', 'montgomery_county_md'),
  mdMunicipality('glen_echo_md', 'Town of Glen Echo', 'montgomery_county_md'),
  mdMunicipality('kensington_md', 'Town of Kensington', 'montgomery_county_md', ['kensington']),
  mdMunicipality('laytonsville_md', 'Town of Laytonsville', 'montgomery_county_md'),
  mdMunicipality('somerset_town_md', 'Town of Somerset', 'montgomery_county_md'),
  mdMunicipality('washington_grove_md', 'Town of Washington Grove', 'montgomery_county_md'),

  // Prince George's County
  mdMunicipality('bowie_md', 'City of Bowie', 'prince_georges_county_md', ['bowie']),
  mdMunicipality('college_park_md', 'City of College Park', 'prince_georges_county_md', ['college park']),
  mdMunicipality('greenbelt_md', 'City of Greenbelt', 'prince_georges_county_md', ['greenbelt']),
  mdMunicipality('hyattsville_md', 'City of Hyattsville', 'prince_georges_county_md', ['hyattsville']),
  mdMunicipality('laurel_md', 'City of Laurel', 'prince_georges_county_md', ['laurel']),
  mdMunicipality('upper_marlboro_md', 'Town of Upper Marlboro', 'prince_georges_county_md', ['upper marlboro']),
  mdMunicipality('berwyn_heights_md', 'Town of Berwyn Heights', 'prince_georges_county_md'),
  mdMunicipality('bladensburg_md', 'Town of Bladensburg', 'prince_georges_county_md'),
  mdMunicipality('brentwood_md', 'Town of Brentwood', 'prince_georges_county_md'),
  mdMunicipality('capitol_heights_md', 'Town of Capitol Heights', 'prince_georges_county_md'),
  mdMunicipality('cheverly_md', 'Town of Cheverly', 'prince_georges_county_md'),
  mdMunicipality('colmar_manor_md', 'Town of Colmar Manor', 'prince_georges_county_md'),
  mdMunicipality('cottage_city_md', 'Town of Cottage City', 'prince_georges_county_md'),
  mdMunicipality('district_heights_md', 'City of District Heights', 'prince_georges_county_md'),
  mdMunicipality('edmonston_md', 'Town of Edmonston', 'prince_georges_county_md'),
  mdMunicipality('fairmount_heights_md', 'Town of Fairmount Heights', 'prince_georges_county_md'),
  mdMunicipality('forest_heights_md', 'Town of Forest Heights', 'prince_georges_county_md'),
  mdMunicipality('landover_hills_md', 'Town of Landover Hills', 'prince_georges_county_md'),
  mdMunicipality('morningside_md', 'Town of Morningside', 'prince_georges_county_md'),
  mdMunicipality('mount_rainier_md', 'City of Mount Rainier', 'prince_georges_county_md'),
  mdMunicipality('new_carrollton_md', 'City of New Carrollton', 'prince_georges_county_md'),
  mdMunicipality('north_brentwood_md', 'Town of North Brentwood', 'prince_georges_county_md'),
  mdMunicipality('riverdale_park_md', 'Town of Riverdale Park', 'prince_georges_county_md'),
  mdMunicipality('seat_pleasant_md', 'City of Seat Pleasant', 'prince_georges_county_md'),
  mdMunicipality('university_park_md', 'Town of University Park', 'prince_georges_county_md'),

  // Queen Anne's County
  mdMunicipality('centreville_md', 'Town of Centreville', 'queen_annes_county_md', ['centreville']),
  mdMunicipality('church_hill_md', 'Town of Church Hill', 'queen_annes_county_md'),
  mdMunicipality('queen_anne_md', 'Town of Queen Anne', 'queen_annes_county_md'),
  mdMunicipality('queenstown_md', 'Town of Queenstown', 'queen_annes_county_md'),
  mdMunicipality('sudlersville_md', 'Town of Sudlersville', 'queen_annes_county_md'),
  mdMunicipality('templeville_md', 'Town of Templeville', 'queen_annes_county_md'),

  // St. Mary's County
  mdMunicipality('leonardtown_md', 'Town of Leonardtown', 'st_marys_county_md', ['leonardtown']),

  // Somerset County
  mdMunicipality('princess_anne_md', 'Town of Princess Anne', 'somerset_county_md', ['princess anne']),
  mdMunicipality('crisfield_md', 'City of Crisfield', 'somerset_county_md', ['crisfield']),

  // Talbot County
  mdMunicipality('easton_md', 'Town of Easton', 'talbot_county_md', ['easton']),
  mdMunicipality('oxford_md', 'Town of Oxford', 'talbot_county_md'),
  mdMunicipality('st_michaels_md', 'Town of St. Michaels', 'talbot_county_md', ['st michaels']),
  mdMunicipality('trappe_md', 'Town of Trappe', 'talbot_county_md'),

  // Washington County
  mdMunicipality('hagerstown_md', 'City of Hagerstown', 'washington_county_md', ['hagerstown']),
  mdMunicipality('boonsboro_md', 'Town of Boonsboro', 'washington_county_md', ['boonsboro']),
  mdMunicipality('clear_spring_md', 'Town of Clear Spring', 'washington_county_md'),
  mdMunicipality('funkstown_md', 'Town of Funkstown', 'washington_county_md', ['funkstown']),
  mdMunicipality('hancock_md', 'Town of Hancock', 'washington_county_md', ['hancock']),
  mdMunicipality('keedysville_md', 'Town of Keedysville', 'washington_county_md'),
  mdMunicipality('sharpsburg_md', 'Town of Sharpsburg', 'washington_county_md'),
  mdMunicipality('smithsburg_md', 'Town of Smithsburg', 'washington_county_md'),
  mdMunicipality('williamsport_md', 'Town of Williamsport', 'washington_county_md', ['williamsport']),

  // Wicomico County
  mdMunicipality('salisbury_md', 'City of Salisbury', 'wicomico_county_md', ['salisbury']),
  mdMunicipality('delmar_md', 'Town of Delmar', 'wicomico_county_md', ['delmar']),
  mdMunicipality('fruitland_md', 'City of Fruitland', 'wicomico_county_md', ['fruitland']),
  mdMunicipality('hebron_md', 'Town of Hebron', 'wicomico_county_md'),
  mdMunicipality('mardela_springs_md', 'Town of Mardela Springs', 'wicomico_county_md'),
  mdMunicipality('pittsville_md', 'Town of Pittsville', 'wicomico_county_md'),
  mdMunicipality('sharptown_md', 'Town of Sharptown', 'wicomico_county_md'),
  mdMunicipality('willards_md', 'Town of Willards', 'wicomico_county_md'),

  // Worcester County
  mdMunicipality('ocean_city_md', 'Town of Ocean City', 'worcester_county_md', ['ocean city']),
  mdMunicipality('berlin_md', 'Town of Berlin', 'worcester_county_md', ['berlin']),
  mdMunicipality('pocomoke_city_md', 'City of Pocomoke City', 'worcester_county_md', ['pocomoke city']),
  mdMunicipality('snow_hill_md', 'Town of Snow Hill', 'worcester_county_md', ['snow hill']),
];

// ─── Merged Jurisdiction List ───────────────────────────────────────────────

export const JURISDICTIONS: JurisdictionScope[] = [
  ...MD_COUNTIES,
  ...MD_MUNICIPALITIES,
];

// ─── Lookup Helpers ─────────────────────────────────────────────────────────

/** Look up a jurisdiction by exact id, with legacy fallback (e.g. `anne_arundel_county` → `anne_arundel_county_md`). */
export function getJurisdictionById(id?: string | null): JurisdictionScope | null {
  if (!id) return null;
  const key = id.trim().toLowerCase();
  const exact = JURISDICTIONS.find((j) => j.jurisdiction_id.toLowerCase() === key);
  if (exact) return exact;
  // Legacy fallback: try appending _md suffix
  const withSuffix = JURISDICTIONS.find((j) => j.jurisdiction_id.toLowerCase() === `${key}_md`);
  return withSuffix ?? null;
}

export function getJurisdictionsForState(stateAbbr?: string | null): JurisdictionScope[] {
  if (!stateAbbr) return JURISDICTIONS;
  return JURISDICTIONS.filter((j) => j.parent_state === stateAbbr.toUpperCase());
}

/** Counties/independent cities (no parent_jurisdiction_id) for a given state. */
export function getTopLevelJurisdictions(stateAbbr?: string): JurisdictionScope[] {
  const all = stateAbbr
    ? JURISDICTIONS.filter((j) => j.parent_state === stateAbbr.toUpperCase())
    : JURISDICTIONS;
  return all.filter((j) => !j.parent_jurisdiction_id);
}

/** Sub-municipalities under a given parent county. */
export function getChildJurisdictions(parentId: string): JurisdictionScope[] {
  return JURISDICTIONS.filter((j) => j.parent_jurisdiction_id === parentId);
}

/** Whether a jurisdiction has any children. */
export function hasChildJurisdictions(parentId: string): boolean {
  return JURISDICTIONS.some((j) => j.parent_jurisdiction_id === parentId);
}

/** Get the parent jurisdiction of a child (reverse lookup). */
export function getParentJurisdiction(childId: string): JurisdictionScope | null {
  const child = getJurisdictionById(childId);
  if (!child?.parent_jurisdiction_id) return null;
  return getJurisdictionById(child.parent_jurisdiction_id);
}

/** Display label with parent context: "City of Annapolis (Anne Arundel County)" or "Anne Arundel County". */
export function getJurisdictionDisplayLabel(id: string): string {
  const j = getJurisdictionById(id);
  if (!j) return id;
  if (j.parent_jurisdiction_id) {
    const parent = getJurisdictionById(j.parent_jurisdiction_id);
    return parent ? `${j.jurisdiction_name} (${parent.jurisdiction_name})` : j.jurisdiction_name;
  }
  return j.jurisdiction_name;
}

// ─── Existing functions (unchanged) ─────────────────────────────────────────

function normalizeId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function getRoleJurisdictionIds(user: PearlUser | null): string[] {
  if (!user) return [];
  const rawValues = [
    (user as any).jurisdictionId,
    (user as any).jurisdiction_id,
    user.ms4Jurisdiction,
    (user as any).requestedJurisdiction,
  ].filter(Boolean) as string[];

  const ids = new Set<string>();
  for (const raw of rawValues) {
    const exact = getJurisdictionById(raw);
    if (exact) {
      ids.add(exact.jurisdiction_id);
      continue;
    }
    const normalized = normalizeId(raw);
    const byNormalized = getJurisdictionById(normalized);
    if (byNormalized) ids.add(byNormalized.jurisdiction_id);
  }
  return Array.from(ids);
}

export function getAssignedJurisdictions(user: PearlUser | null): JurisdictionScope[] {
  const ids = getRoleJurisdictionIds(user);
  return ids.map((id) => getJurisdictionById(id)).filter(Boolean) as JurisdictionScope[];
}

type ScopeRow = { id?: string; name?: string; state?: string };

export function scopeRowsByJurisdiction<T extends ScopeRow>(
  rows: T[],
  jurisdiction: JurisdictionScope | null
): T[] {
  if (!jurisdiction) return rows;

  const scopedByState = rows.filter((r) => !r.state || r.state.toUpperCase() === jurisdiction.parent_state);
  const statePool = scopedByState.length > 0 ? scopedByState : rows;

  const idSet = new Set((jurisdiction.assessment_unit_ids || []).map((id) => id.toLowerCase()));
  const byId = idSet.size > 0
    ? statePool.filter((r) => !!r.id && idSet.has(String(r.id).toLowerCase()))
    : [];
  if (byId.length > 0) return byId;

  const keywordSource = jurisdiction.name_keywords && jurisdiction.name_keywords.length > 0
    ? jurisdiction.name_keywords
    : jurisdiction.jurisdiction_name.split(/\s+/);
  const tokens = keywordSource
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length >= 3 && !['county', 'city', 'of', 'the'].includes(t));

  if (tokens.length === 0) return statePool;

  return statePool.filter((r) => {
    const name = (r.name || '').toLowerCase();
    return tokens.some((t) => name.includes(t));
  });
}

export function buildCustomJurisdiction(input: {
  id: string;
  name: string;
  type?: JurisdictionType;
  parentState: string;
  assessmentUnitIds?: string[];
  regionIds?: string[];
  keywords?: string[];
}): JurisdictionScope {
  const parentState = input.parentState.toUpperCase();
  return {
    jurisdiction_id: normalizeId(input.id),
    jurisdiction_name: input.name.trim(),
    jurisdiction_type: input.type || 'custom',
    parent_state: parentState,
    parent_epa_region: getEpaRegionForState(parentState) || 0,
    assessment_unit_ids: input.assessmentUnitIds || [],
    region_ids: input.regionIds || [],
    name_keywords: input.keywords || [],
  };
}
