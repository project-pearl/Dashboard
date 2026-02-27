/* ═══════════════════════════════════════════════════════════════════════════
   Treatment Planner — Data, Types & Calculator Engine
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── TYPES ─────────────────────────────────────────────────────────────── */

export interface Watershed {
  id: string;
  state: string;
  name: string;
  huc: string;
  acres: number;
  flowMGD: number;
  salinity: number;
  doMgL: number;
  baseline: Record<ContaminantKey, number>;
  causes: string[];
  context: string;
  treatable: number;
  aquaculture: { name: string; type: string }[];
}

export type ContaminantKey = "tss" | "bac" | "nit" | "pho" | "pfas" | "trash";

export interface TreatmentModule {
  id: string;
  cat: ModuleCategory;
  name: string;
  icon: string;
  costPer: number;
  defUnits: number;
  gpm: number;
  salMax: number;
  mo: number;
  doBoost: number;
  tss: number;
  bac: number;
  nit: number;
  pho: number;
  pfas: number;
  trash: number;
  isBMP: boolean;
  alwaysOn?: boolean;
  boost?: number;
  isAddon?: boolean;
  hasOpex?: boolean;
  isSrc?: boolean;
  isDO?: boolean;
  isInfra?: boolean;
  trl?: number;
  pilotNote?: string;
  desc?: string;
}

export type ModuleCategory =
  | "Infrastructure"
  | "Interception"
  | "PEARL ALIA"
  | "Biological"
  | "Mechanical"
  | "Chemical"
  | "Source Control"
  | "DO Mgmt"
  | "Emerging";

export interface NGO {
  id: string;
  name: string;
  icon: string;
  type: string;
  value: number;
  grant: boolean;
  desc: string;
}

export interface CommunityEvent {
  id: string;
  name: string;
  icon: string;
  cat: string;
  freq: string;
  cost: number;
  volunteers: number;
  desc: string;
  // Optional stat fields
  lbsRemoved?: number;
  samples?: number;
  lbsFiltered?: number;
  treesPlanted?: number;
  gardensBuilt?: number;
  lbsCollected?: number;
  drainsMarked?: number;
  students?: number;
  milesPatrolled?: number;
  attendees?: number;
}

export interface Grant {
  id: string;
  name: string;
  match: number;
  maxAmt: number;
  cats: ModuleCategory[];
}

export interface CalcResult {
  active: (TreatmentModule & { units: number; totalCost: number })[];
  capex: number;
  aliaUnits: number;
  teams: number;
  annualOpex: number;
  totalOpex: number;
  lifecycle: number;
  netCapex: number;
  netLifecycle: number;
  totGPM: number;
  projDO: number;
  ach: Record<ContaminantKey, number>;
  avg: number;
  grants: (Grant & { eligible: number; savings: number })[];
  grantTotal: number;
  met: boolean;
}

/* ─── CONSTANTS ─────────────────────────────────────────────────────────── */

export const OPEX_TEAM_YEAR = 200_000;
export const ALIA_PER_TEAM = 12;

export const CK: ContaminantKey[] = ["tss", "bac", "nit", "pho", "pfas", "trash"];

export const CONTAMINANT_LABELS: Record<ContaminantKey, string> = {
  tss: "Sediment / TSS",
  bac: "Bacteria",
  nit: "Nitrogen",
  pho: "Phosphorus",
  pfas: "PFAS",
  trash: "Trash & Debris",
};

export const CONTAMINANT_COLORS: Record<ContaminantKey, string> = {
  tss: "#8d6748",
  bac: "#c62828",
  nit: "#2e7d32",
  pho: "#1565c0",
  pfas: "#6a1b9a",
  trash: "#546e7a",
};

/* ─── WATERSHEDS ─────────────────────────────────────────────────────────── */

export const WATERSHEDS: Watershed[] = [
  {
    id: "middle_branch", state: "MD", name: "Middle Branch \u2014 Patapsco", huc: "02060003",
    acres: 600, flowMGD: 45, salinity: 8, doMgL: 3.2,
    baseline: { tss: 82, bac: 78, nit: 62, pho: 58, pfas: 28, trash: 75 },
    causes: ["Sediment", "Bacteria", "Nitrogen", "Low DO", "Trash", "CSO"],
    context: "Shallow tidal estuary. CSO from Baltimore. Low DO crisis.",
    treatable: 65,
    aquaculture: [{ name: "Patapsco Blue Crab Sloughing", type: "crab" }],
  },
  {
    id: "potomac_md", state: "MD", name: "Potomac River \u2014 MD Reach", huc: "02070008",
    acres: 18500, flowMGD: 7200, salinity: 2, doMgL: 5.8,
    baseline: { tss: 72, bac: 58, nit: 65, pho: 61, pfas: 22, trash: 30 },
    causes: ["Sediment", "E. coli", "Nitrogen", "Phosphorus", "PCBs"],
    context: "Potomac Interceptor crisis. Source control + tributary intervention.",
    treatable: 60,
    aquaculture: [],
  },
  {
    id: "choptank", state: "MD", name: "Choptank River", huc: "02060005",
    acres: 4200, flowMGD: 520, salinity: 5, doMgL: 4.5,
    baseline: { tss: 48, bac: 32, nit: 70, pho: 65, pfas: 8, trash: 15 },
    causes: ["Nitrogen", "Phosphorus", "Ag Runoff"],
    context: "Eastern Shore ag watershed. Poultry nutrient loading.",
    treatable: 75,
    aquaculture: [
      { name: "Hoopers Island Crab Hatchery", type: "hatchery" },
      { name: "Cambridge Oyster Nursery", type: "hatchery" },
    ],
  },
  {
    id: "back_river", state: "MD", name: "Back River WWTP Outfall", huc: "02060003",
    acres: 180, flowMGD: 180, salinity: 6, doMgL: 2.8,
    baseline: { tss: 85, bac: 90, nit: 80, pho: 78, pfas: 30, trash: 40 },
    causes: ["Nitrogen", "Phosphorus", "Bacteria", "Low DO"],
    context: "Consent decree. 180 MGD discharge.",
    treatable: 70,
    aquaculture: [],
  },
  {
    id: "james_va", state: "VA", name: "James River \u2014 Tidal", huc: "02080201",
    acres: 12000, flowMGD: 9800, salinity: 5, doMgL: 4.8,
    baseline: { tss: 60, bac: 45, nit: 58, pho: 50, pfas: 28, trash: 35 },
    causes: ["Bacteria", "Sediment", "PCBs", "Mercury"],
    context: "Major Bay tributary. Richmond industrial corridor.",
    treatable: 55,
    aquaculture: [],
  },
  {
    id: "maumee_oh", state: "OH", name: "Maumee River \u2014 Lower", huc: "04100009",
    acres: 3800, flowMGD: 4200, salinity: 0, doMgL: 5.5,
    baseline: { tss: 70, bac: 42, nit: 78, pho: 75, pfas: 15, trash: 25 },
    causes: ["Nitrogen", "Phosphorus", "HABs", "Ag Runoff"],
    context: "Primary Lake Erie HAB driver. Toledo water crisis 2014.",
    treatable: 65,
    aquaculture: [],
  },
  {
    id: "caloosahatchee", state: "FL", name: "Caloosahatchee Estuary", huc: "03090205",
    acres: 5500, flowMGD: 2800, salinity: 18, doMgL: 3.8,
    baseline: { tss: 55, bac: 48, nit: 62, pho: 58, pfas: 20, trash: 30 },
    causes: ["Nitrogen", "HABs", "Lake O Discharges"],
    context: "Estuary damaged by Lake O pulse releases.",
    treatable: 45,
    aquaculture: [{ name: "Pine Island Shrimp Hatchery", type: "hatchery" }],
  },
];

/* ─── TREATMENT MODULES ──────────────────────────────────────────────────── */

export const MODULES: TreatmentModule[] = [
  // Infrastructure
  { id: "sensors",  cat: "Infrastructure", name: "PIN Sensor Array",          icon: "\ud83d\udce1", costPer: 8500,  defUnits: 6,  gpm: 0,   salMax: 99, mo: 1,  doBoost: 0,    tss: 0,  bac: 0,  nit: 0,  pho: 0,  pfas: 0,  trash: 0,  isBMP: true,  alwaysOn: true, desc: "Real-time DO, pH, turbidity, flow, temp monitoring at outfall points." },
  { id: "pin_ai",   cat: "Infrastructure", name: "PIN AI Engine",            icon: "\ud83e\udd16", costPer: 36000, defUnits: 1,  gpm: 0,   salMax: 99, mo: 1,  doBoost: 0,    tss: 0,  bac: 0,  nit: 0,  pho: 0,  pfas: 0,  trash: 0,  isBMP: true,  alwaysOn: true, boost: 0.12, desc: "Adaptive control, storm response, spill detection. +12% efficacy uplift." },
  // Interception
  { id: "trash_wheel", cat: "Interception", name: "Trash Wheel Interceptor",  icon: "\u2638\ufe0f", costPer: 85000, defUnits: 2,  gpm: 0,   salMax: 99, mo: 3,  doBoost: 0,    tss: 5,  bac: 0,  nit: 0,  pho: 0,  pfas: 0,  trash: 90, isBMP: true,  desc: "Solar/hydro powered. Removes floatables at CSO outfalls." },
  { id: "skimmer",     cat: "Interception", name: "Surface Skimmer",          icon: "\ud83d\udd04", costPer: 28000, defUnits: 3,  gpm: 0,   salMax: 99, mo: 1,  doBoost: 0,    tss: 3,  bac: 0,  nit: 0,  pho: 0,  pfas: 0,  trash: 65, isBMP: true,  desc: "Floating debris/oil removal. Rapid deploy. Pairs with trash wheel." },
  { id: "screen",      cat: "Interception", name: "Mechanical Screening",     icon: "\u2699\ufe0f", costPer: 48000, defUnits: 2,  gpm: 250, salMax: 99, mo: 2,  doBoost: 0,    tss: 65, bac: 15, nit: 5,  pho: 8,  pfas: 0,  trash: 80, isBMP: true,  desc: "250 GPM/unit. Rapid solids & trash removal upstream of ALIA." },
  // PEARL ALIA
  { id: "alia_50",     cat: "PEARL ALIA",   name: "ALIA 50 GPM \u2014 Base Unit", icon: "\ud83e\uddea", costPer: 15000, defUnits: 8,  gpm: 50,  salMax: 25, mo: 4,  doBoost: 0.15, tss: 92, bac: 94, nit: 35, pho: 28, pfas: 0,  trash: 0,  isBMP: false, pilotNote: "MDE BMP certification pending \u2014 deploy as monitored pilot.", hasOpex: true },
  { id: "alia_pfas",   cat: "PEARL ALIA",   name: "  + PFAS Adsorption Kit", icon: "\ud83d\udd27", costPer: 3500,  defUnits: 8,  gpm: 0,   salMax: 25, mo: 0,  doBoost: 0,    tss: 0,  bac: 0,  nit: 0,  pho: 0,  pfas: 65, trash: 0,  isBMP: false, isAddon: true, desc: "Functionalized resin media per ALIA unit. PFAS adsorption." },
  { id: "alia_uv",     cat: "PEARL ALIA",   name: "  + UV Disinfection Kit", icon: "\u2600\ufe0f", costPer: 4200,  defUnits: 8,  gpm: 0,   salMax: 25, mo: 0,  doBoost: 0,    tss: 0,  bac: 15, nit: 0,  pho: 0,  pfas: 0,  trash: 0,  isBMP: false, isAddon: true, desc: "Add-on UV module per unit. Boosts bac kill to 99%+." },
  { id: "alia_ozone",  cat: "PEARL ALIA",   name: "  + Ozone Kit",           icon: "\u26a1", costPer: 5500,  defUnits: 4,  gpm: 0,   salMax: 25, mo: 0,  doBoost: 0.3,  tss: 0,  bac: 10, nit: 5,  pho: 0,  pfas: 12, trash: 0,  isBMP: false, isAddon: true, desc: "Ozone add-on. DO boost + pathogen polish + partial PFAS oxidation." },
  { id: "alia_aqua",   cat: "PEARL ALIA",   name: "ALIA 5 GPM \u2014 AquaCulture", icon: "\ud83d\udc1a", costPer: 5200,  defUnits: 3,  gpm: 5,   salMax: 30, mo: 2,  doBoost: 0.05, tss: 90, bac: 92, nit: 30, pho: 25, pfas: 0,  trash: 0,  isBMP: false, pilotNote: "AquaCulture pilot \u2014 hatchery/sloughing op intake.", hasOpex: true },
  // Biological
  { id: "wetland",     cat: "Biological",   name: "Constructed Wetland",      icon: "\ud83c\udf3f", costPer: 175000, defUnits: 2, gpm: 200, salMax: 8,  mo: 14, doBoost: 0.4,  tss: 75, bac: 65, nit: 55, pho: 60, pfas: 0,  trash: 10, isBMP: true,  desc: "200 GPM/cell (~2ac). Habitat + nutrient polish." },
  { id: "ats",         cat: "Biological",   name: "Algal Turf Scrubber",      icon: "\ud83d\udfe2", costPer: 55000,  defUnits: 3, gpm: 100, salMax: 15, mo: 6,  doBoost: 0.3,  tss: 40, bac: 20, nit: 65, pho: 70, pfas: 0,  trash: 0,  isBMP: true,  desc: "100 GPM/unit. Nutrient capture \u2192 harvestable biomass/fertilizer." },
  { id: "float_wet",   cat: "Biological",   name: "Floating Treatment Wetland", icon: "\ud83c\udf31", costPer: 18000, defUnits: 6, gpm: 0,   salMax: 15, mo: 3,  doBoost: 0.2,  tss: 30, bac: 25, nit: 40, pho: 35, pfas: 0,  trash: 5,  isBMP: true,  desc: "Per island (~100 sq ft). Root uptake. Shading reduces HABs." },
  { id: "bioretention", cat: "Biological",  name: "Bioretention Cell",        icon: "\ud83c\udf3b", costPer: 35000,  defUnits: 4, gpm: 30,  salMax: 5,  mo: 4,  doBoost: 0.05, tss: 85, bac: 60, nit: 50, pho: 55, pfas: 10, trash: 20, isBMP: true,  desc: "30 GPM/cell. Engineered soil + bio-uptake." },
  // Mechanical
  { id: "daf",         cat: "Mechanical",   name: "Dissolved Air Flotation",   icon: "\ud83d\udca8", costPer: 65000,  defUnits: 2, gpm: 150, salMax: 99, mo: 3,  doBoost: 0.1,  tss: 88, bac: 40, nit: 10, pho: 15, pfas: 5,  trash: 30, isBMP: true,  desc: "150 GPM/unit. Microbubble separation \u2014 algae/TSS." },
  { id: "mbr",         cat: "Mechanical",   name: "Membrane Bioreactor",       icon: "\ud83d\udd2c", costPer: 125000, defUnits: 1, gpm: 500, salMax: 5,  mo: 8,  doBoost: 0,    tss: 99, bac: 99, nit: 70, pho: 75, pfas: 15, trash: 0,  isBMP: true,  desc: "500 GPM/unit. Near-sterile. WWTP point-source polishing." },
  // Chemical
  { id: "ozone_sa",    cat: "Chemical",     name: "Ozone Disinfection",        icon: "\u26a1", costPer: 70000,  defUnits: 2, gpm: 150, salMax: 99, mo: 3,  doBoost: 0.8,  tss: 20, bac: 99, nit: 10, pho: 5,  pfas: 25, trash: 0,  isBMP: true,  desc: "150 GPM/unit. 99% pathogen kill. Major DO boost." },
  { id: "uv_sa",       cat: "Chemical",     name: "UV Disinfection",           icon: "\ud83c\udf1e", costPer: 45000,  defUnits: 2, gpm: 200, salMax: 99, mo: 2,  doBoost: 0,    tss: 5,  bac: 97, nit: 0,  pho: 0,  pfas: 0,  trash: 0,  isBMP: true,  desc: "200 GPM/unit. Chemical-free pathogen kill." },
  { id: "gac",         cat: "Chemical",     name: "Granular Activated Carbon", icon: "\u2b1b", costPer: 48000,  defUnits: 2, gpm: 100, salMax: 99, mo: 3,  doBoost: 0,    tss: 30, bac: 40, nit: 8,  pho: 5,  pfas: 75, trash: 0,  isBMP: true,  desc: "100 GPM/unit. PFAS adsorption. Media replacement 12\u201318mo." },
  { id: "resin",       cat: "Chemical",     name: "Ion Exchange Resin",        icon: "\ud83e\uddea", costPer: 78000,  defUnits: 1, gpm: 75,  salMax: 10, mo: 4,  doBoost: 0,    tss: 10, bac: 10, nit: 45, pho: 40, pfas: 90, trash: 0,  isBMP: true,  desc: "75 GPM/unit. Highest PFAS removal + selective nitrate." },
  // Source Control
  { id: "riparian",    cat: "Source Control", name: "Riparian Buffer Restoration", icon: "\ud83c\udf32", costPer: 8000,  defUnits: 20, gpm: 0, salMax: 99, mo: 3,  doBoost: 0.05, tss: 45, bac: 20, nit: 30, pho: 35, pfas: 0,  trash: 15, isBMP: true, isSrc: true, desc: "Per acre. Intercepts overland flow. Improves with maturity." },
  { id: "ag_bmp",      cat: "Source Control", name: "Agricultural BMP Package",  icon: "\ud83c\udf3e", costPer: 12000, defUnits: 15, gpm: 0, salMax: 99, mo: 4,  doBoost: 0,    tss: 40, bac: 15, nit: 50, pho: 45, pfas: 0,  trash: 0,  isBMP: true, isSrc: true, desc: "Per farm. Cover crops, no-till, nutrient management plan." },
  { id: "green_infra", cat: "Source Control", name: "Green Infrastructure",     icon: "\ud83c\udf33", costPer: 42000, defUnits: 4,  gpm: 0, salMax: 99, mo: 8,  doBoost: 0.05, tss: 55, bac: 25, nit: 30, pho: 35, pfas: 5,  trash: 30, isBMP: true, isSrc: true, desc: "Bioswales, rain gardens, permeable pavement." },
  { id: "septic",      cat: "Source Control", name: "Septic Upgrade / Connect",  icon: "\ud83d\udebd", costPer: 18000, defUnits: 10, gpm: 0, salMax: 99, mo: 6,  doBoost: 0,    tss: 20, bac: 80, nit: 60, pho: 50, pfas: 10, trash: 0,  isBMP: true, isSrc: true, desc: "Per parcel. Eliminate failing septic \u2014 phosphorus/bacteria source." },
  { id: "detention",   cat: "Source Control", name: "Stormwater Detention",      icon: "\ud83c\udfd7\ufe0f", costPer: 65000, defUnits: 3, gpm: 0, salMax: 99, mo: 6, doBoost: 0.1, tss: 70, bac: 30, nit: 20, pho: 25, pfas: 0, trash: 35, isBMP: true, isSrc: true, desc: "Engineered detention. Settles solids before receiving water." },
  // DO Mgmt
  { id: "aerator",     cat: "DO Mgmt",      name: "Mechanical Aeration",       icon: "\ud83e\udee7", costPer: 22000,  defUnits: 4, gpm: 0, salMax: 99, mo: 2,  doBoost: 1.2,  tss: 0,  bac: 0,  nit: 5,  pho: 0,  pfas: 0,  trash: 0,  isBMP: true, isDO: true, desc: "Direct O\u2082 injection. ~5 ac/unit. PIN AI modulates output." },
  { id: "hypo_oxy",    cat: "DO Mgmt",      name: "Hypolimnetic Oxygenation",  icon: "\ud83d\udd35", costPer: 95000,  defUnits: 1, gpm: 0, salMax: 99, mo: 6,  doBoost: 2.0,  tss: 0,  bac: 0,  nit: 10, pho: 5,  pfas: 0,  trash: 0,  isBMP: true, isDO: true, desc: "Deep-water O\u2082. Prevents phosphorus release from sediment." },
  // Emerging
  { id: "electrocoag", cat: "Emerging",     name: "Electrocoagulation",        icon: "\ud83d\udd0b", costPer: 45000,  defUnits: 2, gpm: 80, salMax: 99, mo: 3,  doBoost: 0,    tss: 85, bac: 70, nit: 25, pho: 65, pfas: 45, trash: 0,  isBMP: false, trl: 7, pilotNote: "TRL 7 \u2014 monitored pilot required." },
  { id: "biochar",     cat: "Emerging",     name: "Biochar Filtration",         icon: "\u267b\ufe0f", costPer: 30000,  defUnits: 2, gpm: 60, salMax: 99, mo: 4,  doBoost: 0,    tss: 60, bac: 35, nit: 40, pho: 55, pfas: 60, trash: 0,  isBMP: false, trl: 6, pilotNote: "TRL 6 \u2014 pilot + monitoring." },
  { id: "pfas_foam",   cat: "Emerging",     name: "PFAS Foam Fractionation",    icon: "\ud83e\uddeb", costPer: 62000,  defUnits: 1, gpm: 40, salMax: 99, mo: 5,  doBoost: 0,    tss: 5,  bac: 5,  nit: 0,  pho: 0,  pfas: 95, trash: 0,  isBMP: false, trl: 5, pilotNote: "TRL 5 \u2014 requires pilot program." },
  { id: "sed_cap",     cat: "Emerging",     name: "Sediment Capping",           icon: "\ud83e\udea8", costPer: 120000, defUnits: 1, gpm: 0,  salMax: 99, mo: 8,  doBoost: 0,    tss: 10, bac: 5,  nit: 5,  pho: 15, pfas: 30, trash: 0,  isBMP: false, isSrc: true, pilotNote: "Site-specific design required." },
];

export const MODULE_CATS: ModuleCategory[] = [
  "Infrastructure", "Interception", "PEARL ALIA", "Biological",
  "Mechanical", "Chemical", "Source Control", "DO Mgmt", "Emerging",
];

export const CAT_COLORS: Record<ModuleCategory, string> = {
  "Infrastructure": "#1565c0",
  "Interception":   "#e53935",
  "PEARL ALIA":     "#2e7d32",
  "Biological":     "#388e3c",
  "Mechanical":     "#0277bd",
  "Chemical":       "#6a1b9a",
  "Source Control":  "#e65100",
  "DO Mgmt":        "#0288d1",
  "Emerging":       "#7b1fa2",
};

/* ─── NGO PARTNERS ────────────────────────────────────────────────────────── */

export const NGOS: NGO[] = [
  { id: "cbf",    name: "Chesapeake Bay Foundation",       icon: "\ud83e\udd80", type: "Advocacy & Monitoring",  value: 25000, grant: true,  desc: "In-kind monitoring, legal advocacy, public engagement." },
  { id: "tnc",    name: "The Nature Conservancy",          icon: "\ud83c\udf3f", type: "Land & Habitat",          value: 40000, grant: true,  desc: "Riparian land acquisition, habitat restoration." },
  { id: "wk",     name: "Waterkeeper Alliance",            icon: "\ud83d\udca7", type: "Water Quality Monitoring", value: 15000, grant: false, desc: "Patrol and citizen science data. Enforcement partnerships." },
  { id: "du",     name: "Ducks Unlimited",                 icon: "\ud83e\udd86", type: "Wetland Restoration",     value: 55000, grant: true,  desc: "Wetland design, funding match, restoration contracts." },
  { id: "tu",     name: "Trout Unlimited",                 icon: "\ud83d\udc1f", type: "Stream Restoration",      value: 20000, grant: true,  desc: "Cold-water stream restoration, riparian work." },
  { id: "ar",     name: "American Rivers",                 icon: "\ud83c\udfde\ufe0f", type: "Dam Removal / Flow",  value: 30000, grant: true,  desc: "Flow restoration, dam removal, instream habitat." },
  { id: "cf",     name: "Chesapeake Conservancy",          icon: "\ud83d\uddfa\ufe0f", type: "GIS & Data",          value: 18000, grant: false, desc: "Precision conservation GIS, land use mapping." },
  { id: "bl",     name: "Blue Water Baltimore",            icon: "\ud83d\udd35", type: "Urban Stormwater",         value: 22000, grant: false, desc: "Urban outfall monitoring, community science, education." },
  { id: "wca",    name: "Local Watershed Association",     icon: "\ud83c\udf0a", type: "Grassroots / Local",       value: 8000,  grant: false, desc: "Community outreach, volunteer coordination, stewardship." },
  { id: "bioha",  name: "Biohabitats Inc.",                icon: "\ud83c\udf31", type: "Ecological Engineering",   value: 45000, grant: false, desc: "Design services partner \u2014 wetland and stream restoration." },
  { id: "sea",    name: "Sea Grant Program",               icon: "\ud83d\udd2c", type: "Research & Science",       value: 35000, grant: true,  desc: "University research, monitoring, technical support." },
  { id: "epa_vol", name: "EPA Volunteer Monitor Network",  icon: "\ud83d\udccb", type: "Federal Support",          value: 12000, grant: true,  desc: "EPA-trained monitors. Plugs into ATTAINS data feed." },
];

/* ─── COMMUNITY EVENTS ────────────────────────────────────────────────────── */

export const EVENTS: CommunityEvent[] = [
  { id: "shore_clean",  name: "Shoreline Cleanup Day",          icon: "\ud83e\uddf9", cat: "Stewardship",  freq: "Quarterly",   cost: 2500,  volunteers: 40, lbsRemoved: 800,   desc: "Organized trash removal. Feeds trash-reduction metrics." },
  { id: "cit_monitor",  name: "Citizen Science Water Monitoring", icon: "\ud83e\uddea", cat: "Monitoring",  freq: "Monthly",     cost: 1200,  volunteers: 15, samples: 24,       desc: "Community-collected samples submitted to ATTAINS." },
  { id: "oyster_reefs", name: "Community Oyster Reef Planting",  icon: "\ud83e\uddea", cat: "Habitat",      freq: "Bi-annual",   cost: 4500,  volunteers: 60, lbsFiltered: 500,  desc: "Public reef planting events aligned with ALIA sites." },
  { id: "tree_plant",   name: "Riparian Tree Planting Day",      icon: "\ud83c\udf33", cat: "Restoration",  freq: "Annual",      cost: 3000,  volunteers: 80, treesPlanted: 200, desc: "Buffer establishment. Aligned with riparian BMP." },
  { id: "rain_garden",  name: "Rain Garden Workshop",            icon: "\ud83c\udf27\ufe0f", cat: "Education", freq: "Semi-annual", cost: 1800, volunteers: 25, gardensBuilt: 8,  desc: "Homeowner training. LID installation + maintenance." },
  { id: "oyster_shell", name: "Oyster Shell Recycling Drive",    icon: "\ud83d\udc1a", cat: "Habitat",      freq: "Bi-annual",   cost: 800,   volunteers: 20, lbsCollected: 2000, desc: "Shell collection for reef substrate. Restaurant partnerships." },
  { id: "storm_drain",  name: "Storm Drain Marking",             icon: "\ud83d\udeab", cat: "Stewardship",  freq: "Annual",      cost: 1500,  volunteers: 30, drainsMarked: 150, desc: "Public education. 'No Dumping \u2014 Drains to Bay' markers." },
  { id: "school_stem",  name: "School STEM Water Program",       icon: "\ud83d\udcda", cat: "Education",    freq: "Annual",      cost: 5000,  volunteers: 10, students: 300,     desc: "K-12 curriculum. Sensor demos, water testing, PEARL story." },
  { id: "kayak_survey", name: "Kayak Waterbody Survey",          icon: "\ud83d\udea3", cat: "Monitoring",   freq: "Quarterly",   cost: 2200,  volunteers: 20, milesPatrolled: 8, desc: "Visual survey and floating debris documentation." },
  { id: "pub_meeting",  name: "Community Stakeholder Forum",     icon: "\ud83c\udfdb\ufe0f", cat: "Engagement", freq: "Quarterly", cost: 1500, volunteers: 0,  attendees: 75,    desc: "Regulatory update meetings. Keeps public informed." },
];

/* ─── GRANTS ──────────────────────────────────────────────────────────────── */

export const GRANTS: Grant[] = [
  { id: "cwsrf",     name: "Clean Water SRF",          match: 0.50, maxAmt: 5_000_000,  cats: ["Source Control", "Biological", "Mechanical", "Chemical", "DO Mgmt"] },
  { id: "319h",      name: "EPA 319(h) NPS",           match: 0.60, maxAmt: 500_000,    cats: ["Source Control", "Biological"] },
  { id: "nfwf",      name: "NFWF Chesapeake Bay",      match: 0.50, maxAmt: 300_000,    cats: ["Source Control", "Biological", "PEARL ALIA", "Interception"] },
  { id: "glri",      name: "Great Lakes Restoration",   match: 0.75, maxAmt: 2_000_000,  cats: ["Source Control", "Biological", "PEARL ALIA", "DO Mgmt"] },
  { id: "usda_eqip", name: "USDA EQIP",               match: 0.75, maxAmt: 450_000,    cats: ["Source Control"] },
  { id: "noaa_hab",  name: "NOAA Habitat Restoration",  match: 0.65, maxAmt: 1_000_000,  cats: ["Biological", "PEARL ALIA"] },
  { id: "wiin",      name: "WIIN / WIFIA",             match: 0.49, maxAmt: 10_000_000, cats: ["Mechanical", "Chemical", "DO Mgmt"] },
  { id: "swg",       name: "State Wildlife Grant",      match: 0.50, maxAmt: 200_000,    cats: ["Biological", "PEARL ALIA"] },
];

/* ─── HELPERS ────────────────────────────────────────────────────────────── */

export function fmt(v: number): string {
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1000) return "$" + (v / 1000).toFixed(0) + "K";
  return "$" + v;
}

export function fmtN(v: number): string {
  return v.toLocaleString();
}

/* ─── CALCULATOR ENGINE ──────────────────────────────────────────────────── */

export function runCalc(
  ws: Watershed,
  selectedModules: Set<string>,
  unitCounts: Record<string, number>,
  timelineYrs: number,
  targetPct: number,
): CalcResult | null {
  if (!ws || !selectedModules.size) return null;

  const active = MODULES.filter(m => selectedModules.has(m.id)).map(m => ({
    ...m,
    units: Math.max(1, unitCounts[m.id] ?? m.defUnits),
    totalCost: (unitCounts[m.id] ?? m.defUnits) * m.costPer,
  }));

  const capex = active.reduce((s, m) => s + m.totalCost, 0);
  let totGPM = 0;
  let totDO = 0;
  active.forEach(m => {
    if (m.gpm > 0 && !m.isAddon) totGPM += m.gpm * m.units;
    totDO += m.doBoost * m.units;
  });

  const aliaUnits = active.filter(m => m.hasOpex).reduce((s, m) => s + m.units, 0);
  const teams = aliaUnits > 0 ? Math.max(1, Math.ceil(aliaUnits / ALIA_PER_TEAM)) : 0;
  const annualOpex = teams * OPEX_TEAM_YEAR;
  const totalOpex = annualOpex * timelineYrs;
  const lifecycle = capex + totalOpex;

  const boost = active.find(m => m.boost);
  const treatable = ws.treatable;
  const ach: Record<string, number> = {};

  CK.forEach(k => {
    let rem = 100;
    // Source-control modules reduce load first
    active.filter(m => m.isSrc && m[k] > 0).forEach(m => {
      rem *= 1 - (m[k] * 0.4) / 100;
    });
    // Flow-based treatment efficiency
    const eff = ws.flowMGD > 0 ? Math.min(1, (totGPM / 1440) / ws.flowMGD) : 0.6;
    active
      .filter(m => !m.isAddon && !m.isSrc && !m.isInfra && m[k] > 0 && m.gpm > 0)
      .sort((a, b) => b[k] - a[k])
      .forEach(m => {
        rem *= 1 - (m[k] / 100) * eff;
      });
    // Add-ons
    active.filter(m => m.isAddon && m[k] > 0).forEach(m => {
      rem *= 1 - m[k] / 100;
    });
    // Interception modules
    active
      .filter(m => ["trash_wheel", "skimmer"].includes(m.id) && m[k] > 0)
      .forEach(m => {
        rem *= 1 - m[k] / 100;
      });
    let v = 100 - rem;
    if (boost) v = Math.min(99, v * (1 + boost.boost));
    ach[k] = Math.min(Math.round(v * 10) / 10, treatable + 10);
  });

  const activeKeys = CK.filter(k => ws.baseline[k] > 0);
  const avg = activeKeys.length > 0
    ? CK.reduce((s, k) => s + (ws.baseline[k] > 0 ? (ach[k] ?? 0) : 0), 0) / activeKeys.length
    : 0;

  const grants: (Grant & { eligible: number; savings: number })[] = [];
  for (const g of GRANTS) {
    const ec = active.filter(m => g.cats.includes(m.cat)).reduce((s, m) => s + m.totalCost, 0);
    const sv = Math.min(ec * g.match, g.maxAmt);
    if (sv > 1000) grants.push({ ...g, eligible: ec, savings: Math.round(sv) });
  }
  const grantTotal = grants.reduce((s, g) => s + g.savings, 0);

  return {
    active,
    capex,
    aliaUnits,
    teams,
    annualOpex,
    totalOpex,
    lifecycle,
    netCapex: Math.max(0, capex - grantTotal),
    netLifecycle: Math.max(0, lifecycle - grantTotal),
    totGPM,
    projDO: Math.min(10, ws.doMgL + totDO),
    ach: ach as Record<ContaminantKey, number>,
    avg,
    grants,
    grantTotal,
    met: avg >= targetPct * 0.9,
  };
}
